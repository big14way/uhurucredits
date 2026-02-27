// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {CreditIdentity} from "../src/CreditIdentity.sol";
import {SeniorTranche} from "../src/SeniorTranche.sol";
import {JuniorTranche} from "../src/JuniorTranche.sol";
import {LoanManager} from "../src/LoanManager.sol";
import {CREConsumer} from "../src/CREConsumer.sol";
import {WorldIDGate} from "../src/WorldIDGate.sol";
import {MockUSDC} from "./mocks/MockERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract IntegrationTest is Test {
    CreditIdentity public identity;
    SeniorTranche public senior;
    JuniorTranche public junior;
    LoanManager public loanMgr;
    CREConsumer public creConsumer;
    WorldIDGate public worldIdGate;
    MockUSDC public usdc;

    address admin = address(this);
    address forwarder = address(0xF0);
    address borrower = address(0x10);
    address lp = address(0x20);
    address juniorLp = address(0x30);
    address mockWorldId = address(0x40);

    function setUp() public {
        usdc = new MockUSDC();
        identity = new CreditIdentity();
        senior = new SeniorTranche(IERC20(address(usdc)));
        junior = new JuniorTranche(IERC20(address(usdc)));
        loanMgr = new LoanManager();
        creConsumer = new CREConsumer();

        // Deploy WorldIDGate with mock World ID
        worldIdGate = new WorldIDGate(mockWorldId, address(identity), "app_uhuru_credit", "verify-credit");

        // Wire contracts
        loanMgr.setContracts(address(identity), address(senior), address(junior), address(usdc));
        senior.setLoanManager(address(loanMgr));
        senior.setJuniorTranche(address(junior));
        creConsumer.setCreditIdentity(address(identity));
        creConsumer.setForwarder(forwarder);

        // Grant roles
        identity.grantRole(identity.MINTER_ROLE(), address(worldIdGate));
        identity.grantRole(identity.CREDIT_ORACLE_ROLE(), address(creConsumer));
        identity.grantRole(identity.LOAN_MANAGER_ROLE(), address(loanMgr));
        senior.grantRole(senior.LOAN_MANAGER_ROLE(), address(loanMgr));
        junior.grantRole(junior.LOAN_MANAGER_ROLE(), address(loanMgr));
        junior.grantRole(junior.SENIOR_TRANCHE_ROLE(), address(senior));

        // Seed liquidity
        usdc.mint(lp, 10_000e6);
        vm.startPrank(lp);
        usdc.approve(address(senior), 10_000e6);
        senior.deposit(10_000e6, lp);
        vm.stopPrank();

        usdc.mint(juniorLp, 1_000e6);
        vm.startPrank(juniorLp);
        usdc.approve(address(junior), 1_000e6);
        junior.deposit(1_000e6, juniorLp);
        vm.stopPrank();
    }

    function testFullLifecycle_WorldID_Score_Loan_Repay() public {
        // Step 1: World ID verifyAndMint (mock the worldId.verifyProof call)
        vm.mockCall(
            mockWorldId,
            abi.encodeWithSignature(
                "verifyProof(uint256,uint256,uint256,uint256,uint256,uint256[8])"
            ),
            abi.encode()
        );

        uint256[8] memory proof;
        worldIdGate.verifyAndMint(borrower, 123, 456, proof);

        assertTrue(identity.hasMinted(borrower));
        assertEq(identity.ownerOf(1), borrower);

        // Step 2: CREConsumer receives score report from Forwarder
        bytes memory report = abi.encode(borrower, uint16(650), true, false);
        vm.prank(forwarder);
        creConsumer.onReport(report);

        CreditIdentity.CreditData memory profile = identity.getProfile(borrower);
        assertEq(profile.score, 650);
        assertTrue(profile.worldIdVerified);

        // Step 3: Apply for loan (500 USDC, 4 weeks)
        // Score 550-699: max 500 USDC, 8% interest
        vm.prank(borrower);
        loanMgr.applyForLoan(500e6, 4);

        uint256 borrowerBal = usdc.balanceOf(borrower);
        assertEq(borrowerBal, 500e6);

        (LoanManager.Loan memory loan, uint256 loanId) = loanMgr.getActiveLoan(borrower);
        assertEq(loanId, 1);
        assertEq(loan.principal, 500e6);
        assertEq(loan.totalDue, 540e6); // 500 + 8% = 540
        assertEq(loan.installmentAmount, 135e6); // 540 / 4

        // Step 4: Repay all 4 installments
        usdc.mint(borrower, 200e6); // Give extra for interest
        vm.startPrank(borrower);
        usdc.approve(address(loanMgr), 600e6);

        for (uint8 i = 0; i < 4; i++) {
            loanMgr.repayInstallment(1);
        }
        vm.stopPrank();

        // Step 5: Verify loan is repaid
        loan = loanMgr.getLoan(1);
        assertEq(uint8(loan.status), uint8(LoanManager.LoanStatus.Repaid));

        profile = identity.getProfile(borrower);
        assertEq(profile.outstandingDebt, 0);
        assertEq(profile.totalLoans, 1);
        assertTrue(identity.isEligible(borrower));

        // Step 6: Verify LP can redeem from SeniorTranche with yield
        uint256 lpShares = senior.balanceOf(lp);
        assertTrue(lpShares > 0);

        uint256 redeemableAssets = senior.previewRedeem(lpShares);
        // LP should get back more than deposited (due to interest)
        assertTrue(redeemableAssets >= 10_000e6, "LP should have yield");
    }

    function testDefaultScenario() public {
        // Mock World ID and mint
        vm.mockCall(
            mockWorldId,
            abi.encodeWithSignature(
                "verifyProof(uint256,uint256,uint256,uint256,uint256,uint256[8])"
            ),
            abi.encode()
        );
        uint256[8] memory proof;
        worldIdGate.verifyAndMint(borrower, 123, 789, proof);

        // Set score
        bytes memory report = abi.encode(borrower, uint16(500), true, false);
        vm.prank(forwarder);
        creConsumer.onReport(report);

        // Apply loan (100 USDC, 4 weeks, 12% interest)
        vm.prank(borrower);
        loanMgr.applyForLoan(100e6, 4);

        // Skip 6 weeks (past grace period)
        LoanManager.Loan memory loan = loanMgr.getLoan(1);
        vm.warp(loan.nextPaymentDue + 14 days + 1);

        uint256 juniorBalBefore = usdc.balanceOf(address(junior));

        // Mark default
        loanMgr.markDefault(1);

        // Verify default recorded
        loan = loanMgr.getLoan(1);
        assertEq(uint8(loan.status), uint8(LoanManager.LoanStatus.Defaulted));

        // Verify junior absorbed loss
        assertEq(junior.totalLossAbsorbed(), 100e6);

        // Verify credit identity updated
        CreditIdentity.CreditData memory profile = identity.getProfile(borrower);
        assertEq(profile.defaultCount, 1);
        assertEq(profile.outstandingDebt, 0);
    }

    function testCREConsumerOnlyForwarder() public {
        vm.prank(address(0xBad));
        vm.expectRevert("Only Forwarder");
        creConsumer.onReport(abi.encode(borrower, uint16(500), true, false));
    }

    function testCREConsumerScoreExceedsMax() public {
        // Mint profile first
        vm.mockCall(
            mockWorldId,
            abi.encodeWithSignature(
                "verifyProof(uint256,uint256,uint256,uint256,uint256,uint256[8])"
            ),
            abi.encode()
        );
        uint256[8] memory proof;
        worldIdGate.verifyAndMint(borrower, 123, 999, proof);

        vm.prank(forwarder);
        vm.expectRevert("Score exceeds max");
        creConsumer.onReport(abi.encode(borrower, uint16(1001), true, false));
    }

    function testWorldIDGateDoubleVerifyReverts() public {
        vm.mockCall(
            mockWorldId,
            abi.encodeWithSignature(
                "verifyProof(uint256,uint256,uint256,uint256,uint256,uint256[8])"
            ),
            abi.encode()
        );

        uint256[8] memory proof;
        worldIdGate.verifyAndMint(borrower, 123, 456, proof);

        vm.expectRevert("Already verified");
        worldIdGate.verifyAndMint(address(0x99), 123, 456, proof);
    }
}
