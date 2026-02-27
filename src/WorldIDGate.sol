// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IWorldID} from "./interfaces/IWorldID.sol";
import {ICreditIdentity} from "./interfaces/ICreditIdentity.sol";

contract WorldIDGate {
    IWorldID public immutable worldId;
    ICreditIdentity public immutable creditIdentity;
    uint256 internal immutable externalNullifierHash;
    uint256 internal immutable groupId = 1; // Orb verified

    mapping(uint256 => bool) public nullifierHashes;

    event VerifiedAndMinted(address indexed wallet, uint256 nullifierHash);

    constructor(
        address _worldId,
        address _creditIdentity,
        string memory _appId,
        string memory _action
    ) {
        worldId = IWorldID(_worldId);
        creditIdentity = ICreditIdentity(_creditIdentity);
        externalNullifierHash = _hashToField(
            abi.encodePacked(_hashToField(abi.encodePacked(_appId)), _action)
        );
    }

    function verifyAndMint(
        address signal,
        uint256 root,
        uint256 nullifierHash,
        uint256[8] calldata proof
    ) external {
        require(!nullifierHashes[nullifierHash], "Already verified");

        worldId.verifyProof(
            root,
            groupId,
            _hashToField(abi.encodePacked(signal)),
            externalNullifierHash,
            nullifierHash,
            proof
        );

        nullifierHashes[nullifierHash] = true;
        creditIdentity.mint(signal);

        emit VerifiedAndMinted(signal, nullifierHash);
    }

    function _hashToField(bytes memory value) internal pure returns (uint256) {
        return uint256(keccak256(value)) >> 8;
    }
}
