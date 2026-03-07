import express from "express";
import cors from "cors";
import helmet from "helmet";
import axios from "axios";
import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { CreditIdentityABI, LoanManagerABI } from "./abi";

// Load .env from the backend root regardless of working directory
dotenv.config({ path: path.join(__dirname, "..", ".env"), override: true });

const app = express();
app.use(cors());
app.use(helmet());
app.use(express.json());

const PORT = process.env.PORT || 3001;

// In-memory stores
const monoAccounts = new Map<string, string>(); // walletAddress -> accountId
const reclaimProofs = new Map<
  string,
  { walletAddress: string; mpesaBalance: number; verified: boolean }
>();
const worldIdProofs = new Map<
  string,
  { proof: any; nullifierHash: string; signal: string }
>();
const creditJobs = new Map<
  string,
  { walletAddress: string; status: string; createdAt: number }
>();

// Persistent profile store — survives backend restarts
interface InMemoryProfile {
  score: number;
  worldIdVerified: boolean;
  reclaimVerified: boolean;
  lastUpdated: number;
}

const DATA_FILE = path.join(__dirname, "..", "data", "profiles.json");

function loadProfiles(): Map<string, InMemoryProfile> {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    if (fs.existsSync(DATA_FILE)) {
      const raw = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
      return new Map(Object.entries(raw));
    }
  } catch {
    console.warn("Could not load profiles.json, starting fresh");
  }
  return new Map();
}

function saveProfiles(profiles: Map<string, InMemoryProfile>) {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(Object.fromEntries(profiles), null, 2));
  } catch (err: any) {
    console.warn("Could not save profiles.json:", err.message);
  }
}

const inMemoryProfiles = loadProfiles();
console.log(`Loaded ${inMemoryProfiles.size} persisted profile(s)`);

// Scoring logic (mirrors on-chain getMaxLoanAmount)
function computeMaxLoanAmount(score: number): number {
  if (score >= 850) return 5000;
  if (score >= 700) return 2000;
  if (score >= 550) return 500;
  if (score >= 400) return 100;
  return 0;
}

function computeScore(
  worldIdVerified: boolean,
  reclaimVerified: boolean,
  monoLinked: boolean
): number {
  let score = 300; // base (not eligible)
  if (worldIdVerified) score += 100; // → 400, just eligible
  if (reclaimVerified) score += 150; // M-Pesa proof → better tier
  if (monoLinked) score += 160;     // Bank linked → better tier
  return Math.min(score, 1000);
}

// CRE simulation — runs the WASM workflow locally per-user
const CRE_WORKFLOW_DIR = path.join(__dirname, "..", "..", "uhuru-cre", "credit-scoring");
const CRE_PROJECT_ROOT = path.join(__dirname, "..", "..", "uhuru-cre");

async function runCRESimulation(
  walletAddress: string,
  worldIdVerified: boolean,
  reclaimVerified: boolean,
  monoAccountId: string
): Promise<number | null> {
  return new Promise((resolve) => {
    const payload = JSON.stringify({
      wallet: walletAddress,
      worldIdVerified,
      reclaimVerified,
      monoAccountId: monoAccountId || "",
    });

    const creBin = process.env.CRE_BIN || "cre";
    const proc = spawn(
      creBin,
      [
        "workflow", "simulate", CRE_WORKFLOW_DIR,
        "-R", CRE_PROJECT_ROOT,
        "-T", "staging-settings",
        "--http-payload", payload,
        "--non-interactive",
        "--trigger-index", "1",
      ],
      {
        cwd: CRE_WORKFLOW_DIR,
        env: {
          ...process.env,
          // CRE secrets: pass Mono key (empty if not configured — score gracefully degrades)
          MONO_SECRET_KEY: process.env.MONO_SECRET_KEY || "",
        },
      }
    );

    let stdout = "";
    proc.stdout?.on("data", (d: Buffer) => { stdout += d.toString(); });
    proc.stderr?.on("data", (_d: Buffer) => { /* suppress */ });

    const timer = setTimeout(() => {
      proc.kill();
      console.warn(`[CRE] Simulation timed out for ${walletAddress}`);
      resolve(null);
    }, 120_000);

    proc.on("close", (code) => {
      clearTimeout(timer);
      const match = stdout.match(/UHURU_CRE_SCORE:(\{[^\n]+\})/);
      if (match) {
        try {
          const result = JSON.parse(match[1]);
          console.log(`[CRE] Score for ${walletAddress}: ${result.score}`);
          resolve(typeof result.score === "number" ? result.score : null);
          return;
        } catch { /* fall through */ }
      }
      console.warn(`[CRE] Simulation exited (code=${code}), no score found`);
      resolve(null);
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      console.warn(`[CRE] Failed to spawn: ${err.message}`);
      resolve(null);
    });
  });
}

// Ethers provider
const provider = new ethers.JsonRpcProvider(
  process.env.RPC_URL_BASE_SEPOLIA || "https://sepolia.base.org"
);

// Optional signer for on-chain writes (requires PRIVATE_KEY env var)
let signer: ethers.Wallet | null = null;
if (process.env.PRIVATE_KEY) {
  try {
    signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    console.log("Backend signer:", signer.address);
  } catch {
    console.warn("Invalid PRIVATE_KEY — running read-only");
  }
}

function getCreditIdentityContract(withSigner = false) {
  return new ethers.Contract(
    process.env.CREDIT_IDENTITY_ADDRESS || ethers.ZeroAddress,
    CreditIdentityABI,
    withSigner && signer ? signer : provider
  );
}

// Try to write score on-chain; swallow errors silently (falls back to in-memory)
async function tryWriteOnChain(
  walletAddress: string,
  score: number,
  worldIdVerified: boolean,
  reclaimVerified: boolean
) {
  if (!signer) return;
  try {
    const contract = getCreditIdentityContract(true);
    const hasMinted = await contract.hasMinted(walletAddress);
    if (!hasMinted) {
      const mintTx = await contract.mint(walletAddress);
      await mintTx.wait();
    }
    const scoreTx = await contract.updateScore(
      walletAddress,
      score,
      worldIdVerified,
      reclaimVerified
    );
    await scoreTx.wait();
    console.log(`On-chain score updated for ${walletAddress}: ${score}`);
  } catch (err: any) {
    console.warn("On-chain write skipped:", err.message?.slice(0, 80));
  }
}

// ---- ROUTES ----

// POST /api/verify/worldid
app.post("/api/verify/worldid", async (req, res) => {
  try {
    const { proof, nullifierHash, merkleRoot, signal, walletAddress } = req.body;

    if (!proof || !nullifierHash || !merkleRoot) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    const proofKey = nullifierHash || signal || walletAddress;
    if (proofKey) worldIdProofs.set(proofKey, { proof: req.body, nullifierHash, signal: proofKey });

    // Use walletAddress (preferred) or signal as the key for in-memory profile
    const walletKey = (walletAddress || signal || "").toLowerCase();
    if (!walletKey || !ethers.isAddress(walletKey)) {
      res.status(400).json({ error: "Missing walletAddress or signal" });
      return;
    }

    const existing = inMemoryProfiles.get(walletKey) || {
      score: 0,
      worldIdVerified: false,
      reclaimVerified: false,
      lastUpdated: 0,
    };
    inMemoryProfiles.set(walletKey, {
      ...existing,
      worldIdVerified: true,
      lastUpdated: Math.floor(Date.now() / 1000),
    });
    saveProfiles(inMemoryProfiles);

    res.json({ verified: true, nullifierHash, signal });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/mono/auth-url
app.get("/api/mono/auth-url", (req, res) => {
  const monoAppId = process.env.MONO_APP_ID;
  if (!monoAppId) {
    res.json({ url: null, message: "Bank connection coming soon" });
    return;
  }
  const url = `https://connect.mono.co/?key=${monoAppId}&scope=transactions`;
  res.json({ url });
});

// POST /api/mono/exchange
app.post("/api/mono/exchange", async (req, res) => {
  try {
    const { code, walletAddress } = req.body;

    if (!code || !walletAddress) {
      res.status(400).json({ error: "Missing code or walletAddress" });
      return;
    }

    const response = await axios.post(
      "https://api.withmono.com/account/auth",
      { code },
      {
        headers: {
          "mono-sec-key": process.env.MONO_SECRET_KEY || "",
          "Content-Type": "application/json",
        },
      }
    );

    const accountId = response.data?.id;
    if (!accountId) {
      res.status(400).json({ error: "Failed to exchange code" });
      return;
    }

    monoAccounts.set(walletAddress.toLowerCase(), accountId);

    res.json({ accountId, success: true });
  } catch (error: any) {
    res
      .status(500)
      .json({ error: error.response?.data?.message || error.message });
  }
});

// POST /api/credit/request
app.post("/api/credit/request", async (req, res) => {
  try {
    const { walletAddress, monoAccountId, worldIdVerified } = req.body;

    if (!walletAddress || !ethers.isAddress(walletAddress)) {
      res.status(400).json({ error: "Invalid wallet address" });
      return;
    }

    const walletKey = walletAddress.toLowerCase();
    const jobId = uuidv4();
    creditJobs.set(jobId, {
      walletAddress,
      status: "pending",
      createdAt: Date.now(),
    });

    // Determine verification status
    const memProfile = inMemoryProfiles.get(walletKey);
    const isWorldIdVerified =
      worldIdVerified || memProfile?.worldIdVerified || false;
    const isReclaimVerified = reclaimProofs.has(walletKey);
    const isMonoLinked =
      monoAccounts.has(walletKey) || Boolean(monoAccountId);

    // Compute mock score
    const score = computeScore(isWorldIdVerified, isReclaimVerified, isMonoLinked);

    // Store in memory and persist to disk
    inMemoryProfiles.set(walletKey, {
      score,
      worldIdVerified: isWorldIdVerified,
      reclaimVerified: isReclaimVerified,
      lastUpdated: Math.floor(Date.now() / 1000),
    });
    saveProfiles(inMemoryProfiles);

    creditJobs.set(jobId, {
      walletAddress,
      status: "submitted",
      createdAt: Date.now(),
    });

    // Try to write on-chain in background (non-blocking)
    tryWriteOnChain(walletAddress, score, isWorldIdVerified, isReclaimVerified);

    // Run CRE simulation in background — updates score asynchronously with TEE result
    const monoId = monoAccounts.get(walletKey) || (monoAccountId as string) || "";
    (async () => {
      const creScore = await runCRESimulation(walletAddress, isWorldIdVerified, isReclaimVerified, monoId);
      if (creScore !== null && creScore > 0) {
        const current = inMemoryProfiles.get(walletKey);
        // Keep the higher of CRE score and mock score (mock may include Mono bonus)
        const finalScore = Math.max(creScore, current?.score || 0);
        if (finalScore !== current?.score) {
          inMemoryProfiles.set(walletKey, {
            score: finalScore,
            worldIdVerified: isWorldIdVerified,
            reclaimVerified: isReclaimVerified,
            lastUpdated: Math.floor(Date.now() / 1000),
          });
          saveProfiles(inMemoryProfiles);
          tryWriteOnChain(walletAddress, finalScore, isWorldIdVerified, isReclaimVerified);
          console.log(`[CRE] Updated score for ${walletAddress}: ${current?.score} → ${finalScore}`);
        }
      }
    })().catch(() => {});

    res.json({
      jobId,
      status: "submitted",
      score,
      message: "Credit evaluation complete",
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/credit/status/:walletAddress
app.get("/api/credit/status/:walletAddress", async (req, res) => {
  try {
    const { walletAddress } = req.params;

    if (!ethers.isAddress(walletAddress)) {
      res.status(400).json({ error: "Invalid wallet address" });
      return;
    }

    const walletKey = walletAddress.toLowerCase();
    const memProfile = inMemoryProfiles.get(walletKey);

    // Try on-chain data
    let onChainData: any = null;
    try {
      const creditIdentity = getCreditIdentityContract();
      const profile = await creditIdentity.getProfile(walletAddress);
      const isEligible = await creditIdentity.isEligible(walletAddress);
      const maxLoanAmount = await creditIdentity.getMaxLoanAmount(walletAddress);

      onChainData = {
        score: Number(profile.score),
        lastUpdated: Number(profile.lastUpdated),
        worldIdVerified: profile.worldIdVerified,
        reclaimVerified: profile.reclaimVerified,
        isEligible,
        maxLoanAmount: Number(maxLoanAmount) / 1e6,
        totalLoans: Number(profile.totalLoans),
        repaymentRate: Number(profile.repaymentRate),
        outstandingDebt: Number(profile.outstandingDebt) / 1e6,
        defaultCount: Number(profile.defaultCount),
      };
    } catch {
      // Contract unreachable or profile doesn't exist
    }

    // Merge: prefer in-memory when it has a higher score (on-chain may lag)
    const finalScore =
      memProfile && memProfile.score > (onChainData?.score || 0)
        ? memProfile.score
        : onChainData?.score || 0;

    const finalWorldIdVerified =
      memProfile?.worldIdVerified || onChainData?.worldIdVerified || false;
    const finalReclaimVerified =
      memProfile?.reclaimVerified || onChainData?.reclaimVerified || false;

    const finalMaxLoanAmount = Math.max(
      computeMaxLoanAmount(finalScore),
      onChainData?.maxLoanAmount || 0
    );

    res.json({
      score: finalScore,
      lastUpdated:
        memProfile?.lastUpdated || onChainData?.lastUpdated || 0,
      worldIdVerified: finalWorldIdVerified,
      reclaimVerified: finalReclaimVerified,
      isEligible: finalScore >= 400 && (onChainData?.outstandingDebt || 0) === 0,
      maxLoanAmount: finalMaxLoanAmount,
      totalLoans: onChainData?.totalLoans || 0,
      repaymentRate: onChainData?.repaymentRate || 0,
      outstandingDebt: onChainData?.outstandingDebt || 0,
      defaultCount: onChainData?.defaultCount || 0,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/demo/mpesa — demo-only endpoint to simulate M-Pesa verification
// Marks the wallet as reclaimVerified so the score updates to the next tier
app.post("/api/demo/mpesa", async (req, res) => {
  try {
    const { walletAddress } = req.body;
    if (!walletAddress || !ethers.isAddress(walletAddress)) {
      res.status(400).json({ error: "Invalid wallet address" });
      return;
    }
    const walletKey = walletAddress.toLowerCase();
    reclaimProofs.set(walletKey, { walletAddress: walletKey, mpesaBalance: 5000, verified: true });
    const existing = inMemoryProfiles.get(walletKey) || {
      score: 0, worldIdVerified: false, reclaimVerified: false, lastUpdated: 0,
    };
    inMemoryProfiles.set(walletKey, { ...existing, reclaimVerified: true, lastUpdated: Math.floor(Date.now() / 1000) });
    saveProfiles(inMemoryProfiles);
    res.json({ success: true, message: "M-Pesa demo verification recorded" });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/reclaim/start
app.post("/api/reclaim/start", async (req, res) => {
  try {
    const reclaimAppId = process.env.RECLAIM_APP_ID;
    const reclaimAppSecret = process.env.RECLAIM_APP_SECRET;
    const mpesaProviderId = process.env.MPESA_PROVIDER_ID;

    if (!reclaimAppId || !reclaimAppSecret || !mpesaProviderId) {
      res.status(500).json({ error: "Reclaim not configured" });
      return;
    }

    // Dynamic import for ESM compatibility
    const { ReclaimProofRequest } = await import(
      "@reclaimprotocol/js-sdk"
    );

    const proofRequest = await ReclaimProofRequest.init(
      reclaimAppId,
      reclaimAppSecret,
      mpesaProviderId
    );

    const requestUrl = await proofRequest.getRequestUrl();
    const sessionId = uuidv4();

    proofRequest.startSession({
      onSuccess: (proofObj: any) => {
        const walletAddress = req.body.walletAddress?.toLowerCase() || "";
        const context = proofObj?.claimData?.context;
        let mpesaBalance = 0;
        try {
          const parsed = JSON.parse(context);
          mpesaBalance = parseFloat(parsed.extractedParameters?.balance) || 0;
        } catch {
          // fallback
        }
        reclaimProofs.set(walletAddress, {
          walletAddress,
          mpesaBalance,
          verified: true,
        });
      },
      onError: (error: any) => {
        console.error("Reclaim session error:", error);
      },
    });

    res.json({ requestUrl, sessionId });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/reclaim/callback
app.post("/api/reclaim/callback", async (req, res) => {
  try {
    const { walletAddress, proof } = req.body;

    if (!proof || !walletAddress) {
      res.status(400).json({ error: "Missing proof or walletAddress" });
      return;
    }

    let mpesaBalance = 0;
    try {
      const context = proof?.claimData?.context;
      if (context) {
        const parsed = JSON.parse(context);
        mpesaBalance = parseFloat(parsed.extractedParameters?.balance) || 0;
      }
    } catch {
      // fallback
    }

    reclaimProofs.set(walletAddress.toLowerCase(), {
      walletAddress: walletAddress.toLowerCase(),
      mpesaBalance,
      verified: true,
    });

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get("/health", (_, res) => {
  res.json({ status: "ok", timestamp: Date.now() });
});

app.listen(PORT, () => {
  console.log(`Uhuru Credit API running on port ${PORT}`);
});

export default app;
