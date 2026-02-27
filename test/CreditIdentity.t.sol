// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console} from "forge-std/Test.sol";
import {CreditIdentity} from "../src/CreditIdentity.sol";

contract CreditIdentityTest is Test {
    CreditIdentity public identity;
    address admin = address(this);
    address minter = address(0x1);
    address oracle = address(0x2);
    address loanMgr = address(0x3);
    address user1 = address(0x10);
    address user2 = address(0x20);

    function setUp() public {
        identity = new CreditIdentity();
        identity.grantRole(identity.MINTER_ROLE(), minter);
        identity.grantRole(identity.CREDIT_ORACLE_ROLE(), oracle);
        identity.grantRole(identity.LOAN_MANAGER_ROLE(), loanMgr);
    }

    function testMint() public {
        vm.prank(minter);
        identity.mint(user1);

        assertTrue(identity.hasMinted(user1));
        assertEq(identity.ownerOf(1), user1);
        assertEq(identity.addressToTokenId(user1), 1);

        CreditIdentity.CreditData memory data = identity.getProfile(user1);
        assertEq(data.score, 0);
    }

    function testSoulboundTransferReverts() public {
        vm.prank(minter);
        identity.mint(user1);

        vm.prank(user1);
        vm.expectRevert("Soulbound: token is non-transferable");
        identity.transferFrom(user1, user2, 1);

        vm.prank(user1);
        vm.expectRevert("Soulbound: token is non-transferable");
        identity.approve(user2, 1);

        vm.prank(user1);
        vm.expectRevert("Soulbound: token is non-transferable");
        identity.setApprovalForAll(user2, true);
    }

    function testDoubleMintReverts() public {
        vm.prank(minter);
        identity.mint(user1);

        vm.prank(minter);
        vm.expectRevert("Already minted");
        identity.mint(user1);
    }

    function testOnlyCREConsumerCanUpdateScore() public {
        vm.prank(minter);
        identity.mint(user1);

        // Unauthorized caller reverts
        vm.prank(user1);
        vm.expectRevert();
        identity.updateScore(user1, 500, true, false);

        // Authorized oracle succeeds
        vm.prank(oracle);
        identity.updateScore(user1, 500, true, false);

        CreditIdentity.CreditData memory data = identity.getProfile(user1);
        assertEq(data.score, 500);
        assertTrue(data.worldIdVerified);
    }

    function testIsEligibleFalseBelow400() public {
        vm.prank(minter);
        identity.mint(user1);

        vm.prank(oracle);
        identity.updateScore(user1, 399, false, false);

        assertFalse(identity.isEligible(user1));
    }

    function testIsEligibleTrueAt400() public {
        vm.prank(minter);
        identity.mint(user1);

        vm.prank(oracle);
        identity.updateScore(user1, 400, false, false);

        assertTrue(identity.isEligible(user1));
    }

    function testIsEligibleFalseWithDebt() public {
        vm.prank(minter);
        identity.mint(user1);

        vm.prank(oracle);
        identity.updateScore(user1, 500, false, false);

        vm.prank(loanMgr);
        identity.updateDebt(user1, 100e6);

        assertFalse(identity.isEligible(user1));
    }

    function testGetMaxLoanAmountByTier() public {
        vm.prank(minter);
        identity.mint(user1);

        // Below 400 = 0
        vm.prank(oracle);
        identity.updateScore(user1, 399, false, false);
        assertEq(identity.getMaxLoanAmount(user1), 0);

        // 400-549 = 100 USDC
        vm.prank(oracle);
        identity.updateScore(user1, 400, false, false);
        assertEq(identity.getMaxLoanAmount(user1), 100e6);

        vm.prank(oracle);
        identity.updateScore(user1, 549, false, false);
        assertEq(identity.getMaxLoanAmount(user1), 100e6);

        // 550-699 = 500 USDC
        vm.prank(oracle);
        identity.updateScore(user1, 550, false, false);
        assertEq(identity.getMaxLoanAmount(user1), 500e6);

        vm.prank(oracle);
        identity.updateScore(user1, 699, false, false);
        assertEq(identity.getMaxLoanAmount(user1), 500e6);

        // 700-849 = 2000 USDC
        vm.prank(oracle);
        identity.updateScore(user1, 700, false, false);
        assertEq(identity.getMaxLoanAmount(user1), 2000e6);

        // 850+ = 5000 USDC
        vm.prank(oracle);
        identity.updateScore(user1, 850, false, false);
        assertEq(identity.getMaxLoanAmount(user1), 5000e6);

        vm.prank(oracle);
        identity.updateScore(user1, 1000, false, false);
        assertEq(identity.getMaxLoanAmount(user1), 5000e6);
    }

    function testLockedAlwaysTrue() public {
        vm.prank(minter);
        identity.mint(user1);

        assertTrue(identity.locked(1));
    }
}
