// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract StorageMetadata {
    struct FileMetadata {
        string cid;
        string filename;
        uint256 size;
        address uploader;
        uint256 timestamp;
    }

    // Mapping from CID to FileMetadata
    mapping(string => FileMetadata) public files;

    // Event emitted when a file is stored
    event FileStored(address indexed uploader, string cid, string filename, uint256 size, uint256 timestamp);

    function storeMetadata(string memory _cid, string memory _filename, uint256 _size) public {
        require(bytes(_cid).length > 0, "CID cannot be empty");
        require(bytes(files[_cid].cid).length == 0, "File already exists");

        files[_cid] = FileMetadata({
            cid: _cid,
            filename: _filename,
            size: _size,
            uploader: msg.sender,
            timestamp: block.timestamp
        });

        emit FileStored(msg.sender, _cid, _filename, _size, block.timestamp);
    }

    function getMetadata(string memory _cid) public view returns (FileMetadata memory) {
        return files[_cid];
    }
}
