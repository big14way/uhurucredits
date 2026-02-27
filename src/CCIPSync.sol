// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ICreditIdentity} from "./interfaces/ICreditIdentity.sol";
import {Client} from "@chainlink/ccip/libraries/Client.sol";
import {IRouterClient} from "@chainlink/ccip/interfaces/IRouterClient.sol";
import {CCIPReceiver} from "@chainlink/ccip/applications/CCIPReceiver.sol";

contract CCIPSync is CCIPReceiver, AccessControl {
    bytes32 public constant SYNC_ROLE = keccak256("SYNC_ROLE");

    IERC20 public linkToken;
    address public receiverAddress;
    uint64 public destinationChainSelector;
    ICreditIdentity public creditIdentity;

    mapping(uint64 => bool) public allowlistedSourceChains;

    event ScoreSynced(address indexed wallet, uint16 score, bytes32 messageId);
    event ScoreReceived(address indexed wallet, uint16 score);

    constructor(address _router, address _linkToken) CCIPReceiver(_router) {
        linkToken = IERC20(_linkToken);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(SYNC_ROLE, msg.sender);
    }

    function syncScore(address wallet, uint16 score) external onlyRole(SYNC_ROLE) returns (bytes32 messageId) {
        Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
            receiver: abi.encode(receiverAddress),
            data: abi.encode(wallet, score),
            tokenAmounts: new Client.EVMTokenAmount[](0),
            extraArgs: Client._argsToBytes(Client.EVMExtraArgsV1({gasLimit: 200_000})),
            feeToken: address(linkToken)
        });

        uint256 fee = IRouterClient(getRouter()).getFee(destinationChainSelector, message);
        linkToken.approve(getRouter(), fee);
        messageId = IRouterClient(getRouter()).ccipSend(destinationChainSelector, message);

        emit ScoreSynced(wallet, score, messageId);
    }

    function _ccipReceive(Client.Any2EVMMessage memory message) internal override {
        require(allowlistedSourceChains[message.sourceChainSelector], "Source not allowlisted");

        (address wallet, uint16 score) = abi.decode(message.data, (address, uint16));
        creditIdentity.updateScore(wallet, score, false, false);

        emit ScoreReceived(wallet, score);
    }

    function allowlistSourceChain(uint64 chainSelector, bool allowed) external onlyRole(DEFAULT_ADMIN_ROLE) {
        allowlistedSourceChains[chainSelector] = allowed;
    }

    function setReceiverAddress(address _receiver) external onlyRole(DEFAULT_ADMIN_ROLE) {
        receiverAddress = _receiver;
    }

    function setDestinationChainSelector(uint64 _selector) external onlyRole(DEFAULT_ADMIN_ROLE) {
        destinationChainSelector = _selector;
    }

    function setCreditIdentity(address _creditIdentity) external onlyRole(DEFAULT_ADMIN_ROLE) {
        creditIdentity = ICreditIdentity(_creditIdentity);
    }

    function supportsInterface(bytes4 interfaceId) public view override(CCIPReceiver, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
