// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {CreditIdentity} from "../src/CreditIdentity.sol";
import {SeniorTranche} from "../src/SeniorTranche.sol";
import {JuniorTranche} from "../src/JuniorTranche.sol";
import {LoanManager} from "../src/LoanManager.sol";
import {CREConsumer} from "../src/CREConsumer.sol";
import {CCIPSync} from "../src/CCIPSync.sol";
import {WorldIDGate} from "../src/WorldIDGate.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Deploy is Script {
    // Base Sepolia addresses
    address constant USDC_BASE_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address constant WORLD_ID_BASE_SEPOLIA = 0x42Ff98C4e85212a5d31358ACBFe76a621B7F0082;
    address constant CCIP_ROUTER_BASE_SEPOLIA = 0xD3b06cEbF099CE7DA4AcCf578aaebFDBd6e88a93;
    address constant LINK_BASE_SEPOLIA = 0xE4aB69C077896252FAFBD49EFD26B5D171A32410;
    uint64 constant ARB_SEPOLIA_SELECTOR = 3478487238524512106;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        CreditIdentity creditIdentity = new CreditIdentity();
        SeniorTranche seniorTranche = new SeniorTranche(IERC20(USDC_BASE_SEPOLIA));
        JuniorTranche juniorTranche = new JuniorTranche(IERC20(USDC_BASE_SEPOLIA));
        LoanManager loanManager = new LoanManager();
        CREConsumer creConsumer = new CREConsumer();
        CCIPSync ccipSync = new CCIPSync(CCIP_ROUTER_BASE_SEPOLIA, LINK_BASE_SEPOLIA);
        WorldIDGate worldIDGate =
            new WorldIDGate(WORLD_ID_BASE_SEPOLIA, address(creditIdentity), "app_uhuru_credit", "verify-credit");

        // Wire up contracts
        creditIdentity.grantRole(creditIdentity.CREDIT_ORACLE_ROLE(), address(creConsumer));
        creditIdentity.grantRole(creditIdentity.LOAN_MANAGER_ROLE(), address(loanManager));
        creditIdentity.grantRole(creditIdentity.MINTER_ROLE(), address(worldIDGate));
        loanManager.setContracts(
            address(creditIdentity), address(seniorTranche), address(juniorTranche), USDC_BASE_SEPOLIA
        );
        seniorTranche.setLoanManager(address(loanManager));
        seniorTranche.setJuniorTranche(address(juniorTranche));
        seniorTranche.grantRole(seniorTranche.LOAN_MANAGER_ROLE(), address(loanManager));
        juniorTranche.grantRole(juniorTranche.LOAN_MANAGER_ROLE(), address(loanManager));
        juniorTranche.grantRole(juniorTranche.SENIOR_TRANCHE_ROLE(), address(seniorTranche));
        creConsumer.setCreditIdentity(address(creditIdentity));
        ccipSync.setDestinationChainSelector(ARB_SEPOLIA_SELECTOR);

        console.log("CreditIdentity:", address(creditIdentity));
        console.log("SeniorTranche:", address(seniorTranche));
        console.log("JuniorTranche:", address(juniorTranche));
        console.log("LoanManager:", address(loanManager));
        console.log("CREConsumer:", address(creConsumer));
        console.log("CCIPSync:", address(ccipSync));
        console.log("WorldIDGate:", address(worldIDGate));

        vm.stopBroadcast();
    }
}
