// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IJuniorTranche {
    function receiveInterest(uint256 amount) external;
    function absorbLoss(uint256 amount) external;
}
