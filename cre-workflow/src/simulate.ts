/**
 * Local CRE Workflow Simulation
 * Simulates the credit scoring workflow without the CRE SDK
 * Tests: Mono data fetch -> score computation -> ABI encoding
 */

import { handleCreditScoring } from "./credit-scoring";

async function simulate() {
  console.log("=== Uhuru Credit - CRE Workflow Simulation ===\n");

  const config = {
    monoApiUrl: "https://api.withmono.com",
    contractAddress: "0x0000000000000000000000000000000000000001",
    chainSelectorName: "BASE_SEPOLIA",
    forwarderAddress: "0x0000000000000000000000000000000000000002",
  };

  // Test Case 1: World ID verified only (no bank data)
  console.log("--- Test Case 1: World ID Only (no bank data) ---");
  const result1 = await handleCreditScoring(
    config,
    {
      wallet: "0x1234567890abcdef1234567890abcdef12345678",
      monoAccountId: "test_account_1",
      worldIdVerified: true,
      reclaimVerified: false,
    },
    { monoSecretKey: "" } // No real key, will return empty transactions
  );
  console.log(`Wallet: ${result1.wallet}`);
  console.log(`Score: ${result1.score}`);
  console.log(`World ID: ${result1.worldIdVerified}`);
  console.log(`Reclaim: ${result1.reclaimVerified}`);
  console.log(`Encoded Report: ${result1.encodedReport.slice(0, 66)}...`);
  console.log(`Score in range [0, 1000]: ${result1.score >= 0 && result1.score <= 1000 ? "PASS" : "FAIL"}`);
  console.log();

  // Test Case 2: Both verifications (no bank data)
  console.log("--- Test Case 2: World ID + Reclaim (no bank data) ---");
  const result2 = await handleCreditScoring(
    config,
    {
      wallet: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      monoAccountId: "test_account_2",
      worldIdVerified: true,
      reclaimVerified: true,
    },
    { monoSecretKey: "" }
  );
  console.log(`Score: ${result2.score}`);
  console.log(`Expected: 500 (300 base + 100 worldId + 100 reclaim)`);
  console.log(`Match: ${result2.score === 500 ? "PASS" : "FAIL"}`);
  console.log();

  // Test Case 3: No verification at all
  console.log("--- Test Case 3: No verification ---");
  const result3 = await handleCreditScoring(
    config,
    {
      wallet: "0x9876543210fedcba9876543210fedcba98765432",
      monoAccountId: "test_account_3",
      worldIdVerified: false,
      reclaimVerified: false,
    },
    { monoSecretKey: "" }
  );
  console.log(`Score: ${result3.score}`);
  console.log(`Expected: 300 (base only)`);
  console.log(`Match: ${result3.score === 300 ? "PASS" : "FAIL"}`);
  console.log();

  // Test Case 4: Invalid wallet should fail validation
  console.log("--- Test Case 4: Invalid wallet (should fail) ---");
  try {
    await handleCreditScoring(
      config,
      {
        wallet: "not-a-valid-wallet",
        monoAccountId: "test_account_4",
        worldIdVerified: true,
      },
      { monoSecretKey: "" }
    );
    console.log("FAIL: Should have thrown validation error");
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log(`Correctly rejected invalid wallet: PASS`);
    console.log(`Error: ${msg.slice(0, 80)}...`);
  }
  console.log();

  // Summary
  console.log("=== Simulation Complete ===");
  console.log(`All scores in range [0, 1000]: ${
    [result1, result2, result3].every(r => r.score >= 0 && r.score <= 1000) ? "PASS" : "FAIL"
  }`);
  console.log(`All reports encoded (hex): ${
    [result1, result2, result3].every(r => r.encodedReport.startsWith("0x")) ? "PASS" : "FAIL"
  }`);
}

simulate().catch(console.error);
