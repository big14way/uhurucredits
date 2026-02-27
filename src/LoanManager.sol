// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ICreditIdentity} from "./interfaces/ICreditIdentity.sol";
import {ISeniorTranche} from "./interfaces/ISeniorTranche.sol";
import {IJuniorTranche} from "./interfaces/IJuniorTranche.sol";

contract LoanManager is AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum LoanStatus { Active, Repaid, Defaulted }

    struct Loan {
        address borrower;
        uint256 principal;
        uint256 totalDue;
        uint256 amountRepaid;
        uint8 installmentsTotal;
        uint8 installmentsPaid;
        uint256 installmentAmount;
        uint256 nextPaymentDue;
        uint256 paymentInterval;
        LoanStatus status;
        uint8 missedPayments;
    }

    mapping(uint256 => Loan) public loans;
    mapping(address => uint256) public activeLoanId;
    uint256 public nextLoanId = 1;
    uint256 public totalOutstanding;

    ICreditIdentity public creditIdentity;
    ISeniorTranche public seniorTranche;
    IJuniorTranche public juniorTranche;
    IERC20 public usdc;

    bool public contractsSet;

    event LoanCreated(uint256 indexed loanId, address indexed borrower, uint256 amount, uint256 totalDue);
    event InstallmentPaid(uint256 indexed loanId, address indexed borrower, uint256 amount, uint8 installmentsPaid);
    event LoanDefaulted(uint256 indexed loanId, address indexed borrower, uint256 remainingAmount);

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function setContracts(
        address _creditIdentity,
        address _seniorTranche,
        address _juniorTranche,
        address _usdc
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(!contractsSet, "Contracts already set");
        creditIdentity = ICreditIdentity(_creditIdentity);
        seniorTranche = ISeniorTranche(_seniorTranche);
        juniorTranche = IJuniorTranche(_juniorTranche);
        usdc = IERC20(_usdc);
        contractsSet = true;
    }

    function applyForLoan(uint256 amount, uint8 durationWeeks) external nonReentrant {
        require(creditIdentity.isEligible(msg.sender), "Not eligible");
        require(activeLoanId[msg.sender] == 0, "Existing active loan");
        require(amount <= creditIdentity.getMaxLoanAmount(msg.sender), "Amount exceeds max");
        require(
            durationWeeks == 2 || durationWeeks == 4 || durationWeeks == 8,
            "Invalid duration"
        );

        uint256 rate = _getInterestRate(msg.sender);
        uint256 interest = (amount * rate) / 100;
        uint256 totalDue = amount + interest;
        uint256 paymentInterval = (uint256(durationWeeks) * 7 days) / 4;
        uint256 installmentAmount = totalDue / 4;

        uint256 loanId = nextLoanId;
        loans[loanId] = Loan({
            borrower: msg.sender,
            principal: amount,
            totalDue: totalDue,
            amountRepaid: 0,
            installmentsTotal: 4,
            installmentsPaid: 0,
            installmentAmount: installmentAmount,
            nextPaymentDue: block.timestamp + paymentInterval,
            paymentInterval: paymentInterval,
            status: LoanStatus.Active,
            missedPayments: 0
        });

        totalOutstanding += amount;
        activeLoanId[msg.sender] = loanId;
        nextLoanId++;

        creditIdentity.incrementLoanCount(msg.sender);
        creditIdentity.updateDebt(msg.sender, amount);
        seniorTranche.disburseLoan(amount, msg.sender);

        emit LoanCreated(loanId, msg.sender, amount, totalDue);
    }

    function repayInstallment(uint256 loanId) external nonReentrant {
        Loan storage loan = loans[loanId];
        require(loan.borrower == msg.sender, "Not borrower");
        require(loan.status == LoanStatus.Active, "Loan not active");

        uint256 installmentAmount = loan.installmentAmount;

        // Transfer USDC from borrower to this contract
        usdc.safeTransferFrom(msg.sender, address(this), installmentAmount);

        // Calculate principal and interest portions
        uint256 principalPortion = loan.principal / 4;
        uint256 interestPortion = installmentAmount - principalPortion;

        // Approve and send to senior tranche
        usdc.safeIncreaseAllowance(address(seniorTranche), installmentAmount);
        usdc.safeTransfer(address(seniorTranche), installmentAmount);
        seniorTranche.receiveRepayment(principalPortion, interestPortion);

        loan.installmentsPaid++;
        loan.amountRepaid += installmentAmount;
        loan.nextPaymentDue += loan.paymentInterval;
        loan.missedPayments = 0;
        totalOutstanding -= principalPortion;

        if (loan.installmentsPaid == 4) {
            loan.status = LoanStatus.Repaid;
            activeLoanId[loan.borrower] = 0;
            creditIdentity.updateDebt(loan.borrower, 0);
        }

        emit InstallmentPaid(loanId, msg.sender, installmentAmount, loan.installmentsPaid);
    }

    function markDefault(uint256 loanId) external {
        Loan storage loan = loans[loanId];
        require(loan.status == LoanStatus.Active, "Loan not active");
        require(
            block.timestamp > loan.nextPaymentDue + 14 days,
            "Grace period not expired"
        );

        loan.status = LoanStatus.Defaulted;

        uint256 principalPerInstallment = loan.principal / 4;
        uint256 remaining = loan.principal - (uint256(loan.installmentsPaid) * principalPerInstallment);

        totalOutstanding -= remaining;
        activeLoanId[loan.borrower] = 0;

        creditIdentity.recordDefault(loan.borrower);
        creditIdentity.updateDebt(loan.borrower, 0);
        juniorTranche.absorbLoss(remaining);

        emit LoanDefaulted(loanId, loan.borrower, remaining);
    }

    function getTotalOutstanding() external view returns (uint256) {
        return totalOutstanding;
    }

    function getLoan(uint256 loanId) external view returns (Loan memory) {
        return loans[loanId];
    }

    function getActiveLoan(address borrower) external view returns (Loan memory, uint256 loanId) {
        loanId = activeLoanId[borrower];
        return (loans[loanId], loanId);
    }

    function _getInterestRate(address borrower) internal view returns (uint256) {
        uint16 score = creditIdentity.getProfile(borrower).score;
        if (score >= 700) return 5;
        if (score >= 550) return 8;
        return 12; // 400-549
    }
}
