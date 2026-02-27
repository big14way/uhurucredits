// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IJuniorTranche} from "./interfaces/IJuniorTranche.sol";
import {ILoanManager} from "./interfaces/ILoanManager.sol";

contract SeniorTranche is ERC4626, AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant LOAN_MANAGER_ROLE = keccak256("LOAN_MANAGER_ROLE");

    address public loanManager;
    address public juniorTranche;

    event LoanDisbursed(address indexed borrower, uint256 amount);
    event RepaymentReceived(uint256 principal, uint256 interest, uint256 seniorShare, uint256 juniorShare);

    constructor(IERC20 _usdc)
        ERC4626(_usdc)
        ERC20("Uhuru Senior Vault", "uSENIOR")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function setLoanManager(address _loanManager) external onlyRole(DEFAULT_ADMIN_ROLE) {
        loanManager = _loanManager;
    }

    function setJuniorTranche(address _juniorTranche) external onlyRole(DEFAULT_ADMIN_ROLE) {
        juniorTranche = _juniorTranche;
    }

    function totalAssets() public view override returns (uint256) {
        uint256 balance = IERC20(asset()).balanceOf(address(this));
        if (loanManager != address(0)) {
            balance += ILoanManager(loanManager).getTotalOutstanding();
        }
        return balance;
    }

    function disburseLoan(uint256 amount, address borrower) external onlyRole(LOAN_MANAGER_ROLE) nonReentrant whenNotPaused {
        IERC20(asset()).safeTransfer(borrower, amount);
        emit LoanDisbursed(borrower, amount);
    }

    function receiveRepayment(uint256 principal, uint256 interest) external onlyRole(LOAN_MANAGER_ROLE) nonReentrant {
        uint256 seniorShare = (interest * 80) / 100;
        uint256 juniorShare = interest - seniorShare;
        if (juniorShare > 0 && juniorTranche != address(0)) {
            IERC20(asset()).safeTransfer(juniorTranche, juniorShare);
            IJuniorTranche(juniorTranche).receiveInterest(juniorShare);
        }
        emit RepaymentReceived(principal, interest, seniorShare, juniorShare);
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
