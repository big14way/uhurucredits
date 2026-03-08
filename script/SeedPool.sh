#!/bin/bash
# Fund the SeniorTranche with USDC for loan disbursements
# 
# Prerequisites: 
#   1. Get test USDC from https://faucet.circle.com/ for Base Sepolia
#      (Select "USDC", chain "Base Sepolia", paste deployer address: 0x3C343AD077983371b29fee386bdBC8a92E934C51)
#   2. Run this script: ./script/SeedPool.sh <amount_in_usdc>
#
# Example: ./script/SeedPool.sh 1000  (deposits $1000 USDC)

set -e

PRIVATE_KEY=0x515a4878eb658f8630c1f1ef7e49b97e20ab055ff2fde5ed357fdd7168ad3964
RPC=https://sepolia.base.org
USDC=0x036CbD53842c5426634e7929541eC2318f3dCF7e
SENIOR_TRANCHE=0xe468781867732309f62aCD0Fa6Fb00549Bf96299
DEPLOYER=0x3C343AD077983371b29fee386bdBC8a92E934C51

AMOUNT_USDC=${1:-100}
AMOUNT_WEI=$(echo "$AMOUNT_USDC * 1000000" | bc)

echo "=== SeniorTranche Pool Seeding ==="
echo "Amount: $AMOUNT_USDC USDC ($AMOUNT_WEI units)"

# Check current balances
DEPLOYER_USDC=$(cast call $USDC "balanceOf(address)(uint256)" $DEPLOYER --rpc-url $RPC)
POOL_USDC=$(cast call $USDC "balanceOf(address)(uint256)" $SENIOR_TRANCHE --rpc-url $RPC)
echo "Deployer USDC: $DEPLOYER_USDC"
echo "Pool USDC: $POOL_USDC"

if [ "$DEPLOYER_USDC" -lt "$AMOUNT_WEI" ]; then
  echo ""
  echo "ERROR: Deployer has insufficient USDC ($DEPLOYER_USDC < $AMOUNT_WEI)"
  echo ""
  echo "Get test USDC from: https://faucet.circle.com/"
  echo "  Chain: Base Sepolia"
  echo "  Address: $DEPLOYER"
  exit 1
fi

echo ""
echo "Step 1: Approving USDC spend..."
cast send $USDC "approve(address,uint256)" $SENIOR_TRANCHE $AMOUNT_WEI \
  --private-key $PRIVATE_KEY --rpc-url $RPC

echo "Step 2: Depositing into SeniorTranche..."
cast send $SENIOR_TRANCHE "deposit(uint256,address)" $AMOUNT_WEI $DEPLOYER \
  --private-key $PRIVATE_KEY --rpc-url $RPC

NEW_POOL=$(cast call $USDC "balanceOf(address)(uint256)" $SENIOR_TRANCHE --rpc-url $RPC)
echo ""
echo "=== Done! ==="
echo "SeniorTranche USDC balance: $NEW_POOL"
