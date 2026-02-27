// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract JuniorTranche is ERC4626, AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant LOAN_MANAGER_ROLE = keccak256("LOAN_MANAGER_ROLE");
    bytes32 public constant SENIOR_TRANCHE_ROLE = keccak256("SENIOR_TRANCHE_ROLE");

    uint256 public constant MINIMUM_DEPOSIT = 100e6; // 100 USDC
    uint256 public accruedYield;
    uint256 public totalLossAbsorbed;

    event JuniorInterestReceived(uint256 amount);
    event LossAbsorbed(uint256 requestedAmount, uint256 actualAmount);

    constructor(IERC20 _usdc) ERC4626(_usdc) ERC20("Uhuru Junior Vault", "uJUNIOR") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function totalAssets() public view override returns (uint256) {
        return IERC20(asset()).balanceOf(address(this)) + accruedYield;
    }

    function receiveInterest(uint256 amount) external onlyRole(SENIOR_TRANCHE_ROLE) {
        accruedYield += amount;
        emit JuniorInterestReceived(amount);
    }

    function absorbLoss(uint256 amount) external onlyRole(LOAN_MANAGER_ROLE) {
        uint256 balance = IERC20(asset()).balanceOf(address(this));
        uint256 actualAbsorbed = amount > balance ? balance : amount;
        if (actualAbsorbed > 0) {
            // Burn USDC to absorb loss (transfer to dead address or reduce tracked balance)
            totalLossAbsorbed += actualAbsorbed;
        }
        emit LossAbsorbed(amount, actualAbsorbed);
    }

    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
        require(assets >= MINIMUM_DEPOSIT, "Below minimum deposit");
        super._deposit(caller, receiver, assets, shares);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    function supportsInterface(bytes4 interfaceId) public view override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    function decimals() public pure override(ERC4626) returns (uint8) {
        return 6;
    }
}
