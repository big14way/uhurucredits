// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ISeniorTranche {
    function disburseLoan(uint256 amount, address borrower) external;
    function receiveRepayment(uint256 principal, uint256 interest) external;
}
