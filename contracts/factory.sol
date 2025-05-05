// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "./ERC721A.sol";

/**
 * @title ERC721AFactory
 * @dev Deploys ERC721A collections with pricing, supply cap, and access code support.
 */
contract ERC721AFactory {
    address[] public allCollections;

    event CollectionCreated(address indexed creator, address indexed collection);

    function createCollection(
        string calldata name,
        string calldata symbol,
        string calldata baseURI,
        uint256 maxSupply,
        uint256 pricePerToken,
        string calldata accessCode
    ) external returns (address) {
        bytes32 codeHash = bytes(accessCode).length > 0 ? keccak256(abi.encodePacked(accessCode)) : bytes32(0);

        ERC721ACollection collection = new ERC721ACollection(
            name,
            symbol,
            baseURI,
            maxSupply,
            pricePerToken,
            codeHash,
            msg.sender
        );

        allCollections.push(address(collection));
        emit CollectionCreated(msg.sender, address(collection));
        return address(collection);
    }

    function getCollectionsCount() external view returns (uint256) {
        return allCollections.length;
    }
}
