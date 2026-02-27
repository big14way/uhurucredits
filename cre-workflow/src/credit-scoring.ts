/**
 * Uhuru Credit - CRE Workflow for Privacy-Preserving Credit Scoring
 *
 * This workflow runs inside Chainlink's CRE (Trusted Execution Environment).
 * It fetches African banking data via Mono.co, computes a credit score,
 * and writes the result on-chain to the CREConsumer contract.
 *
 * CRE Constraints:
 * - Compiles to WASM via Javy/QuickJS (NOT Node.js)
 * - 100MB memory limit, 5-min timeout, 100KB response limit
 * - Only viem and zod are compatible NPM packages
 * - No node:crypto, node:fs, Buffer, process, etc.
 */

import { encodeAbiParameters, parseAbiParameters } from "viem";
import { z } from "zod";
import { computeCreditScore, extractScoringParams } from "./scoring-algorithm";
import type { MonoTransaction } from "./types";

// Config schema — validated at workflow start
const configSchema = z.object({
  monoApiUrl: z.string(),
  contractAddress: z.string(),
  chainSelectorName: z.string(),
  forwarderAddress: z.string(),
});

type Config = z.infer<typeof configSchema>;

// HTTP trigger payload schema
const triggerPayloadSchema = z.object({
  wallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  monoAccountId: z.string(),
  worldIdVerified: z.boolean(),
  reclaimVerified: z.boolean().optional().default(false),
});

/**
 * Fetch transactions from Mono.co API
 * In production CRE, this uses HTTPClient capability with DON consensus
 */
async function fetchMonoTransactions(
  monoApiUrl: string,
  accountId: string,
  monoSecretKey: string
): Promise<MonoTransaction[]> {
  try {
    const response = await fetch(
      `${monoApiUrl}/v2/accounts/${accountId}/transactions?limit=100&period=last90days`,
      {
        headers: {
          Authorization: `Bearer ${monoSecretKey}`,
          "Content-Type": "application/json",
        },
      }
    );
    if (!response.ok) {
      return [];
    }
    const data = (await response.json()) as {
      data?: { transactions?: MonoTransaction[] };
    };
    return data?.data?.transactions || [];
  } catch {
    return [];
  }
}

/**
 * Main CRE workflow handler
 * Called by the CRE runtime when an HTTP trigger is received
 */
export async function handleCreditScoring(
  config: Config,
  triggerBody: unknown,
  secrets: { monoSecretKey?: string }
): Promise<{
  wallet: string;
  score: number;
  worldIdVerified: boolean;
  reclaimVerified: boolean;
  encodedReport: `0x${string}`;
}> {
  // 1. Validate config
  const validatedConfig = configSchema.parse(config);

  // 2. Parse trigger payload
  const payload = triggerPayloadSchema.parse(triggerBody);
  const { wallet, monoAccountId, worldIdVerified, reclaimVerified } = payload;

  // 3. Fetch transaction data via Mono.co
  const transactions = await fetchMonoTransactions(
    validatedConfig.monoApiUrl,
    monoAccountId,
    secrets.monoSecretKey || ""
  );

  // 4. Compute credit score
  const scoringParams = extractScoringParams(
    transactions,
    worldIdVerified,
    reclaimVerified
  );
  const score = computeCreditScore(scoringParams);

  // 5. Encode report for on-chain consumption
  const encodedReport = encodeAbiParameters(
    parseAbiParameters(
      "address wallet, uint16 score, bool worldIdVerified, bool reclaimVerified"
    ),
    [wallet as `0x${string}`, score, worldIdVerified, reclaimVerified]
  );

  return {
    wallet,
    score,
    worldIdVerified,
    reclaimVerified,
    encodedReport,
  };
}

/*
 * CRE SDK Integration (for production deployment):
 *
 * import { Runner, HTTPClient, EVMClient, handler, getNetwork, consensusIdenticalAggregation } from '@chainlink/cre-sdk';
 *
 * const onTrigger = handler((runtime) => {
 *   const config = configSchema.parse(runtime.config);
 *   const payload = triggerPayloadSchema.parse(runtime.trigger?.body || {});
 *
 *   // Fetch via CRE HTTPClient with DON consensus
 *   const httpClient = new HTTPClient();
 *   const monoResult = httpClient.sendRequest(runtime, async () => {
 *     const res = await fetch(`${config.monoApiUrl}/v2/accounts/${payload.monoAccountId}/transactions?limit=100&period=last90days`, {
 *       headers: { 'Authorization': `Bearer ${runtime.secrets?.monoSecretKey}` }
 *     });
 *     return JSON.stringify(await res.json());
 *   }, consensusIdenticalAggregation())(config).result();
 *
 *   const transactions = JSON.parse(monoResult)?.data?.transactions || [];
 *   const scoringParams = extractScoringParams(transactions, payload.worldIdVerified, payload.reclaimVerified);
 *   const score = computeCreditScore(scoringParams);
 *
 *   const encoded = encodeAbiParameters(
 *     parseAbiParameters('address wallet, uint16 score, bool worldIdVerified, bool reclaimVerified'),
 *     [payload.wallet, score, payload.worldIdVerified, payload.reclaimVerified]
 *   );
 *
 *   const report = runtime.report(encoded);
 *   const network = getNetwork(config.chainSelectorName);
 *   const evmClient = new EVMClient(network.chainSelector.selector);
 *   evmClient.writeReport(runtime, { report, contractAddress: config.contractAddress }).result();
 *
 *   return 'Credit score computed and written on-chain';
 * });
 *
 * new Runner().run(onTrigger);
 */
