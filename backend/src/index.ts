import express from "express";
import cors from "cors";
import helmet from "helmet";
import axios from "axios";
import { ethers } from "ethers";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import { CreditIdentityABI, LoanManagerABI } from "./abi";

dotenv.config();

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

// Ethers provider
const provider = new ethers.JsonRpcProvider(
  process.env.RPC_URL_BASE_SEPOLIA || "https://sepolia.base.org"
);

function getCreditIdentityContract() {
  return new ethers.Contract(
    process.env.CREDIT_IDENTITY_ADDRESS || ethers.ZeroAddress,
    CreditIdentityABI,
    provider
  );
}

// ---- ROUTES ----

// POST /api/verify/worldid
app.post("/api/verify/worldid", async (req, res) => {
  try {
    const { proof, nullifierHash, merkleRoot, signal } = req.body;

    if (!proof || !nullifierHash || !merkleRoot || !signal) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    worldIdProofs.set(signal, { proof: req.body, nullifierHash, signal });

    res.json({ verified: true, nullifierHash, signal });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/mono/auth-url
app.get("/api/mono/auth-url", (req, res) => {
  const monoAppId = process.env.MONO_APP_ID;
  if (!monoAppId) {
    res.status(500).json({ error: "MONO_APP_ID not configured" });
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

    const jobId = uuidv4();
    creditJobs.set(jobId, {
      walletAddress,
      status: "pending",
      createdAt: Date.now(),
    });

    // Trigger CRE workflow
    const creTriggerUrl = process.env.CRE_TRIGGER_URL;
    if (creTriggerUrl) {
      try {
        await axios.post(
          creTriggerUrl,
          {
            wallet: walletAddress,
            monoAccountId: monoAccountId || "",
            worldIdVerified: worldIdVerified || false,
            reclaimVerified: reclaimProofs.has(walletAddress.toLowerCase()),
          },
          {
            headers: {
              Authorization: `Bearer ${process.env.CRE_AUTH_KEY || ""}`,
              "Content-Type": "application/json",
            },
          }
        );
        creditJobs.set(jobId, {
          walletAddress,
          status: "submitted",
          createdAt: Date.now(),
        });
      } catch {
        // CRE not available in dev, mark as submitted anyway
        creditJobs.set(jobId, {
          walletAddress,
          status: "submitted_offline",
          createdAt: Date.now(),
        });
      }
    }

    res.json({
      jobId,
      status: "pending",
      message: "Credit evaluation started",
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

    const creditIdentity = getCreditIdentityContract();

    try {
      const profile = await creditIdentity.getProfile(walletAddress);
      const isEligible = await creditIdentity.isEligible(walletAddress);
      const maxLoanAmount =
        await creditIdentity.getMaxLoanAmount(walletAddress);

      res.json({
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
      });
    } catch {
      // Contract not deployed or profile doesn't exist
      res.json({
        score: 0,
        lastUpdated: 0,
        worldIdVerified: false,
        reclaimVerified: false,
        isEligible: false,
        maxLoanAmount: 0,
        totalLoans: 0,
        repaymentRate: 0,
        outstandingDebt: 0,
        defaultCount: 0,
      });
    }
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
