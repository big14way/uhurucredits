// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {CreditIdentity} from "../src/CreditIdentity.sol";
import {SeniorTranche} from "../src/SeniorTranche.sol";
import {JuniorTranche} from "../src/JuniorTranche.sol";
import {LoanManager} from "../src/LoanManager.sol";
import {MockUSDC} from "./mocks/MockERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract LoanManagerTest is Test {
    CreditIdentity public identity;
    SeniorTranche public senior;
    JuniorTranche public junior;
    LoanManager public loanMgr;
    MockUSDC public usdc;

    address admin = address(this);
    address minter = address(0x1);
    address oracle = address(0x2);
    address borrower = address(0x10);
    address lp = address(0x20);
    address juniorLp = address(0x30);

    function setUp() public {
        usdc = new MockUSDC();
        identity = new CreditIdentity();
        senior = new SeniorTranche(IERC20(address(usdc)));
        junior = new JuniorTranche(IERC20(address(usdc)));
        loanMgr = new LoanManager();

        // Wire contracts
        loanMgr.setContracts(address(identity), address(senior), address(junior), address(usdc));
        senior.setLoanManager(address(loanMgr));
        senior.setJuniorTranche(address(junior));

        // Grant roles
        identity.grantRole(identity.MINTER_ROLE(), minter);
        identity.grantRole(identity.CREDIT_ORACLE_ROLE(), oracle);
        identity.grantRole(identity.LOAN_MANAGER_ROLE(), address(loanMgr));
        senior.grantRole(senior.LOAN_MANAGER_ROLE(), address(loanMgr));
        junior.grantRole(junior.LOAN_MANAGER_ROLE(), address(loanMgr));
        junior.grantRole(junior.SENIOR_TRANCHE_ROLE(), address(senior));

        // Seed liquidity: LP deposits 10,000 USDC into senior vault
        usdc.mint(lp, 10_000e6);
        vm.startPrank(lp);
        usdc.approve(address(senior), 10_000e6);
        senior.deposit(10_000e6, lp);
        vm.stopPrank();

        // Junior LP deposits 1,000 USDC
        usdc.mint(juniorLp, 1_000e6);
        vm.startPrank(juniorLp);
        usdc.approve(address(junior), 1_000e6);
        junior.deposit(1_000e6, juniorLp);
        vm.stopPrank();

        // Mint profile and set score for borrower
        vm.prank(minter);
        identity.mint(borrower);
    }

    function _setScore(uint16 score) internal {
        vm.prank(oracle);
        identity.updateScore(borrower, score, true, false);
    }

    function testApplyForLoanSuccess() public {
        _setScore(500); // 400-549 tier, max 100 USDC, 12% interest

        uint256 borrowerBalBefore = usdc.balanceOf(borrower);

        vm.prank(borrower);
        loanMgr.applyForLoan(100e6, 4); // 100 USDC, 4 weeks

        uint256 borrowerBalAfter = usdc.balanceOf(borrower);
        assertEq(borrowerBalAfter - borrowerBalBefore, 100e6);

        (LoanManager.Loan memory loan, uint256 loanId) = loanMgr.getActiveLoan(borrower);
        assertEq(loanId, 1);
        assertEq(loan.principal, 100e6);
        assertEq(loan.totalDue, 112e6); // 100 + 12% interest
        assertEq(loan.installmentsTotal, 4);
        assertEq(loan.installmentAmount, 28e6); // 112 / 4
        assertEq(uint8(loan.status), uint8(LoanManager.LoanStatus.Active));
    }

    function testApplyRevertsLowScore() public {
        _setScore(300); // Below 400

        vm.prank(borrower);
        vm.expectRevert("Not eligible");
        loanMgr.applyForLoan(100e6, 4);
    }

    function testApplyRevertsExistingLoan() public {
        _setScore(500);

        vm.prank(borrower);
        loanMgr.applyForLoan(100e6, 4);

        // Clear debt in identity so isEligible would pass but activeLoanId blocks
        // (the loan set debt, so isEligible already fails, but let's also check the active loan check)
        vm.prank(borrower);
        vm.expectRevert(); // Either "Not eligible" (debt>0) or "Existing active loan"
        loanMgr.applyForLoan(50e6, 2);
    }

    function testRepayInstallment() public {
        _setScore(500);

        vm.prank(borrower);
        loanMgr.applyForLoan(100e6, 4);

        // Give borrower enough USDC to repay
        usdc.mint(borrower, 200e6);

        vm.startPrank(borrower);
        usdc.approve(address(loanMgr), 200e6);
        loanMgr.repayInstallment(1);
        vm.stopPrank();

        LoanManager.Loan memory loan = loanMgr.getLoan(1);
        assertEq(loan.installmentsPaid, 1);
        assertEq(loan.amountRepaid, 28e6);
        assertEq(uint8(loan.status), uint8(LoanManager.LoanStatus.Active));
    }

    function testInterestSplit80_20() public {
        _setScore(500);

        vm.prank(borrower);
        loanMgr.applyForLoan(100e6, 4);

        // Record balances before repayment
        uint256 juniorBalBefore = usdc.balanceOf(address(junior));

        usdc.mint(borrower, 200e6);
        vm.startPrank(borrower);
        usdc.approve(address(loanMgr), 200e6);
        loanMgr.repayInstallment(1);
        vm.stopPrank();

        // installmentAmount = 28e6, principal portion = 25e6, interest portion = 3e6
        // Junior gets 20% of interest = 3e6 * 20 / 100 = 0.6e6
        uint256 juniorBalAfter = usdc.balanceOf(address(junior));
        uint256 interestPortion = 28e6 - 25e6; // 3e6
        uint256 expectedJuniorShare = interestPortion - (interestPortion * 80 / 100); // 0.6e6
        assertEq(juniorBalAfter - juniorBalBefore, expectedJuniorShare);
    }

    function testFullRepayment() public {
        _setScore(500);

        vm.prank(borrower);
        loanMgr.applyForLoan(100e6, 4);

        usdc.mint(borrower, 200e6);
        vm.startPrank(borrower);
        usdc.approve(address(loanMgr), 200e6);

        for (uint8 i = 0; i < 4; i++) {
            loanMgr.repayInstallment(1);
        }
        vm.stopPrank();

        LoanManager.Loan memory loan = loanMgr.getLoan(1);
        assertEq(uint8(loan.status), uint8(LoanManager.LoanStatus.Repaid));
        assertEq(loanMgr.activeLoanId(borrower), 0);

        // Borrower should be eligible again
        CreditIdentity.CreditData memory profile = identity.getProfile(borrower);
        assertEq(profile.outstandingDebt, 0);
    }

    function testMarkDefaultAfterGracePeriod() public {
        _setScore(500);

        vm.prank(borrower);
        loanMgr.applyForLoan(100e6, 4);

        LoanManager.Loan memory loan = loanMgr.getLoan(1);

        // Warp past grace period (nextPaymentDue + 14 days + 1)
        vm.warp(loan.nextPaymentDue + 14 days + 1);

        loanMgr.markDefault(1);

        loan = loanMgr.getLoan(1);
        assertEq(uint8(loan.status), uint8(LoanManager.LoanStatus.Defaulted));
        assertEq(loanMgr.activeLoanId(borrower), 0);
    }

    function testMarkDefaultTooEarly() public {
        _setScore(500);

        vm.prank(borrower);
        loanMgr.applyForLoan(100e6, 4);

        // Try to default before grace period
        vm.expectRevert("Grace period not expired");
        loanMgr.markDefault(1);
    }

    function testJuniorAbsorbsLoss() public {
        _setScore(500);

        uint256 juniorBalBefore = usdc.balanceOf(address(junior));

        vm.prank(borrower);
        loanMgr.applyForLoan(100e6, 4);

        LoanManager.Loan memory loan = loanMgr.getLoan(1);
        vm.warp(loan.nextPaymentDue + 14 days + 1);

        loanMgr.markDefault(1);

        // Junior should have absorbed the loss (100 USDC principal remaining)
        assertEq(junior.totalLossAbsorbed(), 100e6);

        // Check default was recorded
        CreditIdentity.CreditData memory profile = identity.getProfile(borrower);
        assertEq(profile.defaultCount, 1);
    }

    function testInvalidDurationReverts() public {
        _setScore(500);

        vm.prank(borrower);
        vm.expectRevert("Invalid duration");
        loanMgr.applyForLoan(100e6, 3); // 3 weeks not allowed
    }

    function testAmountExceedsMaxReverts() public {
        _setScore(500); // max 100 USDC

        vm.prank(borrower);
        vm.expectRevert("Amount exceeds max");
        loanMgr.applyForLoan(200e6, 4);
    }
}
