import { ethers } from "ethers";

export const CONTRACTS = {
  CREDIT_IDENTITY: (process.env.NEXT_PUBLIC_CREDIT_IDENTITY_ADDRESS || "0x02cB407dF115c7Bf287dEd05aab870485fC800aB").trim(),
  LOAN_MANAGER:    (process.env.NEXT_PUBLIC_LOAN_MANAGER_ADDRESS    || "0xA29373f508CABcB647aC677C329f24a939b29776").trim(),
  SENIOR_TRANCHE:  (process.env.NEXT_PUBLIC_SENIOR_TRANCHE_ADDRESS  || "0xe468781867732309f62aCD0Fa6Fb00549Bf96299").trim(),
  JUNIOR_TRANCHE:  (process.env.NEXT_PUBLIC_JUNIOR_TRANCHE_ADDRESS  || "0x280979E7890bB8DDCaD92eF68c87F98452E5C856").trim(),
  USDC:            (process.env.NEXT_PUBLIC_USDC_ADDRESS            || "0x036CbD53842c5426634e7929541eC2318f3dCF7e").trim(),
  CRE_CONSUMER:    (process.env.NEXT_PUBLIC_CRE_CONSUMER_ADDRESS    || "0xa49Ae8a172017B6394310522c673A38d3D64b0A7").trim(),
  CCIP_SYNC:       (process.env.NEXT_PUBLIC_CCIP_SYNC_ADDRESS       || "0x92e92bc8118aAE7704d1D0b05ec3d20b95F46ADe").trim(),
  WORLD_ID_GATE:   (process.env.NEXT_PUBLIC_WORLD_ID_GATE_ADDRESS   || "0xe0af52d2056fd0D55f5F26275e6F3464582a37E9").trim(),
};

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://uhurucredits.onrender.com";

const BASE_SEPOLIA_CHAIN_ID = "0x14A34"; // 84532

// Switches MetaMask to Base Sepolia, adds it if not present
export async function switchToBaseSepolia(): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const eth = (window as any).ethereum;
  if (!eth) throw new Error("MetaMask not found");
  try {
    await eth.request({ method: "wallet_switchEthereumChain", params: [{ chainId: BASE_SEPOLIA_CHAIN_ID }] });
  } catch (err: any) {
    if (err?.code === 4902) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: BASE_SEPOLIA_CHAIN_ID,
          chainName: "Base Sepolia",
          nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
          rpcUrls: ["https://sepolia.base.org"],
          blockExplorerUrls: ["https://sepolia.basescan.org"],
        }],
      });
    } else {
      throw err;
    }
  }
}

export const CreditIdentityABI = [
  "function getProfile(address wallet) view returns (tuple(uint16 score, uint40 lastUpdated, bool worldIdVerified, bool reclaimVerified, uint32 totalLoans, uint32 defaultCount, uint16 repaymentRate, uint256 outstandingDebt))",
  "function isEligible(address wallet) view returns (bool)",
  "function getMaxLoanAmount(address wallet) view returns (uint256)",
  "function hasMinted(address wallet) view returns (bool)",
] as const;

export const LoanManagerABI = [
  "function applyForLoan(uint256 amount, uint8 durationWeeks) external",
  "function repayInstallment(uint256 loanId) external",
  "function getActiveLoan(address borrower) view returns (tuple(address borrower, uint256 principal, uint256 totalDue, uint256 amountRepaid, uint8 installmentsTotal, uint8 installmentsPaid, uint256 installmentAmount, uint256 nextPaymentDue, uint256 paymentInterval, uint8 status, uint8 missedPayments), uint256 loanId)",
  "function getLoan(uint256 loanId) view returns (tuple(address borrower, uint256 principal, uint256 totalDue, uint256 amountRepaid, uint8 installmentsTotal, uint8 installmentsPaid, uint256 installmentAmount, uint256 nextPaymentDue, uint256 paymentInterval, uint8 status, uint8 missedPayments))",
] as const;

export const ERC20ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
] as const;

// On-chain ABI for wagmi/viem sendTransaction
export const LoanManagerContractABI = [
  {
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "durationWeeks", type: "uint8" },
    ],
    name: "applyForLoan",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "loanId", type: "uint256" }],
    name: "repayInstallment",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

export const ERC20ContractABI = [
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

const provider = new ethers.JsonRpcProvider("https://sepolia.base.org");

export async function getCreditProfile(address: string) {
  try {
    const contract = new ethers.Contract(CONTRACTS.CREDIT_IDENTITY, CreditIdentityABI, provider);
    const profile = await contract.getProfile(address);
    const isEligible = await contract.isEligible(address);
    const maxLoanAmount = await contract.getMaxLoanAmount(address);

    return {
      score: Number(profile.score),
      lastUpdated: Number(profile.lastUpdated),
      worldIdVerified: profile.worldIdVerified,
      reclaimVerified: profile.reclaimVerified,
      totalLoans: Number(profile.totalLoans),
      defaultCount: Number(profile.defaultCount),
      repaymentRate: Number(profile.repaymentRate),
      outstandingDebt: Number(profile.outstandingDebt) / 1e6,
      isEligible,
      maxLoanAmount: Number(maxLoanAmount) / 1e6,
    };
  } catch {
    return null;
  }
}

export async function getActiveLoan(address: string) {
  try {
    const contract = new ethers.Contract(CONTRACTS.LOAN_MANAGER, LoanManagerABI, provider);
    const [loan, loanId] = await contract.getActiveLoan(address);

    if (Number(loanId) === 0) return null;

    return {
      loanId: Number(loanId),
      borrower: loan.borrower,
      principal: Number(loan.principal) / 1e6,
      totalDue: Number(loan.totalDue) / 1e6,
      amountRepaid: Number(loan.amountRepaid) / 1e6,
      installmentsTotal: Number(loan.installmentsTotal),
      installmentsPaid: Number(loan.installmentsPaid),
      installmentAmount: Number(loan.installmentAmount) / 1e6,
      nextPaymentDue: Number(loan.nextPaymentDue),
      paymentInterval: Number(loan.paymentInterval),
      status: Number(loan.status),
      missedPayments: Number(loan.missedPayments),
    };
  } catch {
    return null;
  }
}
