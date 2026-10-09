// SPDX-License-Identifier: MIT
pragma solidity ^0.8.34;

contract MedicalRecord {

    struct RecordVersion {
        bytes32 hash;
        uint256 timestamp;
    }

    mapping(string => RecordVersion[]) private records;

    event RecordHashStored(
        string indexed patientId,
        bytes32 hash,
        uint256 timestamp,
        uint256 version
    );

    function storeHash(
        string memory patientId,
        bytes32 hash
    ) public {
        require(bytes(patientId).length > 0, "Invalid patient ID");
        require(hash != bytes32(0), "Invalid hash");

        records[patientId].push(
            RecordVersion({
                hash: hash,
                timestamp: block.timestamp
            })
        );

        emit RecordHashStored(
            patientId,
            hash,
            block.timestamp,
            records[patientId].length
        );
    }

    function getLatestHash(
        string memory patientId
    ) public view returns (bytes32) {

        require(
            records[patientId].length > 0,
            "No record found"
        );

        return records[patientId][records[patientId].length - 1].hash;
    }

    function verifyHash(
        string memory patientId,
        bytes32 hash
    ) public view returns (bool) {

        if (records[patientId].length == 0) {
            return false;
        }

        return getLatestHash(patientId) == hash;
    }

    function getVersionCount(
        string memory patientId
    ) public view returns (uint256) {

        return records[patientId].length;
    }

    function getVersion(
        string memory patientId,
        uint256 version
    ) public view returns (
        bytes32 hash,
        uint256 timestamp
    ) {

        require(
            version > 0 && version <= records[patientId].length,
            "Invalid version"
        );

        RecordVersion memory record =
            records[patientId][version - 1];

        return (
            record.hash,
            record.timestamp
        );
    }
}