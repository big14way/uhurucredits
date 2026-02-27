import { ethers } from "ethers";

export const CONTRACTS = {
  CREDIT_IDENTITY: process.env.NEXT_PUBLIC_CREDIT_IDENTITY_ADDRESS || "",
  LOAN_MANAGER: process.env.NEXT_PUBLIC_LOAN_MANAGER_ADDRESS || "",
  SENIOR_TRANCHE: process.env.NEXT_PUBLIC_SENIOR_TRANCHE_ADDRESS || "",
  JUNIOR_TRANCHE: process.env.NEXT_PUBLIC_JUNIOR_TRANCHE_ADDRESS || "",
  USDC: process.env.NEXT_PUBLIC_USDC_ADDRESS || "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
};

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

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
