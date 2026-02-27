// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {CreditIdentity} from "../src/CreditIdentity.sol";
import {CCIPSync} from "../src/CCIPSync.sol";

contract DeployArbitrum is Script {
    address constant CCIP_ROUTER_ARB_SEPOLIA = 0x2a9C5afB0d0e4BAb2BCdaE109EC4b0c4Be15a165;
    address constant LINK_ARB_SEPOLIA = 0xb1D4538B4571d411F07960EF2838Ce337FE1E80E;
    uint64 constant BASE_SEPOLIA_SELECTOR = 10344971235874465080;

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        CreditIdentity creditIdentity = new CreditIdentity();
        CCIPSync ccipSync = new CCIPSync(CCIP_ROUTER_ARB_SEPOLIA, LINK_ARB_SEPOLIA);

        // Allow Base Sepolia as source chain
        ccipSync.allowlistSourceChain(BASE_SEPOLIA_SELECTOR, true);
        ccipSync.setCreditIdentity(address(creditIdentity));

        // Grant CREDIT_ORACLE_ROLE to CCIPSync so it can update scores
        creditIdentity.grantRole(creditIdentity.CREDIT_ORACLE_ROLE(), address(ccipSync));

        console.log("Arbitrum CreditIdentity:", address(creditIdentity));
        console.log("Arbitrum CCIPSync:", address(ccipSync));

        vm.stopBroadcast();
    }
}
