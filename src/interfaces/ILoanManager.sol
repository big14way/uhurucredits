// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ILoanManager {
    function getTotalOutstanding() external view returns (uint256);
}
