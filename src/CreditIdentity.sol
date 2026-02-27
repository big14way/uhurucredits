// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC5192} from "./interfaces/IERC5192.sol";

contract CreditIdentity is ERC721, AccessControl, IERC5192 {
    bytes32 public constant CREDIT_ORACLE_ROLE = keccak256("CREDIT_ORACLE_ROLE");
    bytes32 public constant LOAN_MANAGER_ROLE = keccak256("LOAN_MANAGER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    struct CreditData {
        uint16 score;
        uint40 lastUpdated;
        bool worldIdVerified;
        bool reclaimVerified;
        uint32 totalLoans;
        uint32 defaultCount;
        uint16 repaymentRate;
        uint256 outstandingDebt;
    }

    mapping(address => uint256) public addressToTokenId;
    mapping(address => bool) private _hasMinted;
    mapping(address => CreditData) public creditData;
    uint256 private _nextTokenId = 1;

    event ScoreUpdated(address indexed wallet, uint16 newScore, uint40 timestamp);
    event ProfileMinted(address indexed wallet, uint256 tokenId);

    constructor() ERC721("Uhuru Credit Identity", "UCID") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    function hasMinted(address wallet) external view returns (bool) {
        return _hasMinted[wallet];
    }

    function mint(address to) external onlyRole(MINTER_ROLE) {
        require(!_hasMinted[to], "Already minted");
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _hasMinted[to] = true;
        addressToTokenId[to] = tokenId;
        emit ProfileMinted(to, tokenId);
        emit Locked(tokenId);
    }

    function updateScore(
        address wallet,
        uint16 score,
        bool worldIdVerified,
        bool reclaimVerified
    ) external onlyRole(CREDIT_ORACLE_ROLE) {
        require(score <= 1000, "Score exceeds max");
        require(_hasMinted[wallet], "No profile");
        CreditData storage data = creditData[wallet];
        data.score = score;
        data.lastUpdated = uint40(block.timestamp);
        data.worldIdVerified = worldIdVerified;
        data.reclaimVerified = reclaimVerified;
        emit ScoreUpdated(wallet, score, uint40(block.timestamp));
    }

    function updateDebt(address wallet, uint256 newDebt) external onlyRole(LOAN_MANAGER_ROLE) {
        creditData[wallet].outstandingDebt = newDebt;
    }

    function incrementLoanCount(address wallet) external onlyRole(LOAN_MANAGER_ROLE) {
        creditData[wallet].totalLoans++;
    }

    function recordDefault(address wallet) external onlyRole(LOAN_MANAGER_ROLE) {
        CreditData storage data = creditData[wallet];
        data.defaultCount++;
        // Recalculate repayment rate
        if (data.totalLoans > 0) {
            uint32 successfulLoans = data.totalLoans - data.defaultCount;
            data.repaymentRate = uint16((successfulLoans * 100) / data.totalLoans);
        }
    }

    function getProfile(address wallet) external view returns (CreditData memory) {
        return creditData[wallet];
    }

    function isEligible(address wallet) external view returns (bool) {
        CreditData memory data = creditData[wallet];
        return data.score >= 400 && data.outstandingDebt == 0;
    }

    function getMaxLoanAmount(address wallet) external view returns (uint256) {
        uint16 score = creditData[wallet].score;
        if (score >= 850) return 5000e6;
        if (score >= 700) return 2000e6;
        if (score >= 550) return 500e6;
        if (score >= 400) return 100e6;
        return 0;
    }

    // ERC-5192: Soulbound — token is always locked
    function locked(uint256 tokenId) external view override returns (bool) {
        _requireOwned(tokenId);
        return true;
    }

    // Override transfers to make soulbound (allow minting from address(0))
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0)) {
            revert("Soulbound: token is non-transferable");
        }
        return super._update(to, tokenId, auth);
    }

    // Override approve to prevent approvals
    function approve(address, uint256) public pure override {
        revert("Soulbound: token is non-transferable");
    }

    function setApprovalForAll(address, bool) public pure override {
        revert("Soulbound: token is non-transferable");
    }

    // Required override for AccessControl + ERC721
    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
