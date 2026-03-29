// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Attestation {
    struct AttestationData {
        address issuer;
        address tokenAddress;
        string assetType;
        uint256 riskScore;
        string complianceStatus;
        string metadata;
        uint256 timestamp;
    }

    mapping(address => AttestationData) public attestations;
    uint256 public attestationCount;

    event AttestationCreated(
        address indexed tokenAddress,
        address indexed issuer,
        uint256 riskScore
    );

    function attest(
        address tokenAddress,
        string calldata assetType,
        uint256 riskScore,
        string calldata complianceStatus,
        string calldata metadata
    ) external returns (uint256) {
        attestations[tokenAddress] = AttestationData({
            issuer: msg.sender,
            tokenAddress: tokenAddress,
            assetType: assetType,
            riskScore: riskScore,
            complianceStatus: complianceStatus,
            metadata: metadata,
            timestamp: block.timestamp
        });

        attestationCount++;
        emit AttestationCreated(tokenAddress, msg.sender, riskScore);
        return attestationCount;
    }

    function getAttestation(address tokenAddress)
        external
        view
        returns (AttestationData memory)
    {
        return attestations[tokenAddress];
    }
}
