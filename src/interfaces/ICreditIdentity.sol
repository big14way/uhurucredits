// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ICreditIdentity {
    struct CreditData {
        uint16 score;
        uint40 lastUpdated;
        bool worldIdVerified;
        bool reclaimVerified;
        uint32 totalLoans;
        uint32 defaultCount;
        uint16 repaymentRate;
        uint256 outstandingDebt;
    }

    function mint(address to) external;
    function updateScore(address wallet, uint16 score, bool worldIdVerified, bool reclaimVerified) external;
    function updateDebt(address wallet, uint256 newDebt) external;
    function incrementLoanCount(address wallet) external;
    function recordDefault(address wallet) external;
    function getProfile(address wallet) external view returns (CreditData memory);
    function isEligible(address wallet) external view returns (bool);
    function getMaxLoanAmount(address wallet) external view returns (uint256);
    function hasMinted(address wallet) external view returns (bool);
}
