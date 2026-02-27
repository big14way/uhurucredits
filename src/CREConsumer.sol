// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ICreditIdentity} from "./interfaces/ICreditIdentity.sol";

contract CREConsumer is Ownable {
    address public forwarderAddress;
    ICreditIdentity public creditIdentity;
    mapping(address => uint256) public lastReportBlock;

    event CreditScoreReceived(address indexed wallet, uint16 score, uint256 timestamp);

    constructor() Ownable(msg.sender) {}

    function onReport(bytes calldata rawReport) external {
        require(msg.sender == forwarderAddress, "Only Forwarder");

        (address wallet, uint16 score, bool worldIdVerified, bool reclaimVerified) =
            abi.decode(rawReport, (address, uint16, bool, bool));

        require(score <= 1000, "Score exceeds max");

        creditIdentity.updateScore(wallet, score, worldIdVerified, reclaimVerified);
        lastReportBlock[wallet] = block.number;

        emit CreditScoreReceived(wallet, score, block.timestamp);
    }

    function setForwarder(address _forwarder) external onlyOwner {
        forwarderAddress = _forwarder;
    }

    function setCreditIdentity(address _creditIdentity) external onlyOwner {
        creditIdentity = ICreditIdentity(_creditIdentity);
    }
}
