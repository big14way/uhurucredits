export const CreditIdentityABI = [
  {
    inputs: [{ name: "to", type: "address" }],
    name: "mint",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "wallet", type: "address" },
      { name: "score", type: "uint16" },
      { name: "worldIdVerified", type: "bool" },
      { name: "reclaimVerified", type: "bool" },
    ],
    name: "updateScore",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "wallet", type: "address" }],
    name: "hasMinted",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "wallet", type: "address" }],
    name: "getProfile",
    outputs: [
      {
        components: [
          { name: "score", type: "uint16" },
          { name: "lastUpdated", type: "uint40" },
          { name: "worldIdVerified", type: "bool" },
          { name: "reclaimVerified", type: "bool" },
          { name: "totalLoans", type: "uint32" },
          { name: "defaultCount", type: "uint32" },
          { name: "repaymentRate", type: "uint16" },
          { name: "outstandingDebt", type: "uint256" },
        ],
        name: "",
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "wallet", type: "address" }],
    name: "isEligible",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "wallet", type: "address" }],
    name: "getMaxLoanAmount",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export const LoanManagerABI = [
  {
    inputs: [{ name: "borrower", type: "address" }],
    name: "getActiveLoan",
    outputs: [
      {
        components: [
          { name: "borrower", type: "address" },
          { name: "principal", type: "uint256" },
          { name: "totalDue", type: "uint256" },
          { name: "amountRepaid", type: "uint256" },
          { name: "installmentsTotal", type: "uint8" },
          { name: "installmentsPaid", type: "uint8" },
          { name: "installmentAmount", type: "uint256" },
          { name: "nextPaymentDue", type: "uint256" },
          { name: "paymentInterval", type: "uint256" },
          { name: "status", type: "uint8" },
          { name: "missedPayments", type: "uint8" },
        ],
        name: "",
        type: "tuple",
      },
      { name: "loanId", type: "uint256" },
    ],
    stateMutability: "view",
    type: "function",
  },
] as const;
