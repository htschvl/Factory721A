// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "erc721a/contracts/ERC721A.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title ERC721ACollection
 * @dev A feature-rich ERC721A collection with public minting, optional pricing, supply cap, and access code gating.
 */
contract ERC721ACollection is ERC721A, Ownable {
    using Strings for uint256;

    /// @notice Optional max supply; 0 means unlimited
    uint256 public maxSupply;

    /// @notice Public mint price in wei; 0 means free
    uint256 public pricePerToken;

    /// @notice Optional base URI
    string private _baseTokenURI;

    /// @notice Optional access code hash (keccak256); if set, required for minting
    bytes32 public accessCodeHash;

    /// @notice Token-specific URIs (optional)
    mapping(uint256 => string) private _tokenURIs;

    constructor(
        string memory _name,
        string memory _symbol,
        string memory _baseURI,
        uint256 _maxSupply,
        uint256 _pricePerToken,
        bytes32 _accessCodeHash,
        address _owner
    ) ERC721A(_name, _symbol) {
        _baseTokenURI = _baseURI;
        maxSupply = _maxSupply;
        pricePerToken = _pricePerToken;
        accessCodeHash = _accessCodeHash;
        _transferOwnership(_owner);
    }

    /**
     * @notice Public minting function, optionally access-gated.
     * @param quantity Number of tokens to mint
     * @param code Optional string code, required if accessCodeHash is set
     */
    function publicMint(uint256 quantity, string calldata code) external payable {
        // Enforce supply cap
        if (maxSupply > 0) {
            require(_totalMinted() + quantity <= maxSupply, "Max supply exceeded");
        }

        // Enforce pricing
        uint256 totalCost = pricePerToken * quantity;
        require(msg.value >= totalCost, "Insufficient ETH sent");

        // Enforce access code if set
        if (accessCodeHash != bytes32(0)) {
            require(keccak256(abi.encodePacked(code)) == accessCodeHash, "Invalid access code");
        }

        _mint(msg.sender, quantity);

        // Refund overpayment
        if (msg.value > totalCost) {
            payable(msg.sender).transfer(msg.value - totalCost);
        }
    }

    /**
     * @notice Owner-only mint with optional custom URIs.
     */
    function ownerMint(address to, uint256 quantity, string[] calldata uris) external onlyOwner {
        require(uris.length == 0 || uris.length == quantity, "URI length mismatch");
        uint256 startId = _nextTokenId();
        _mint(to, quantity);
        for (uint256 i = 0; i < uris.length; ++i) {
            _tokenURIs[startId + i] = uris[i];
        }
    }

    /**
     * @notice Returns token URI, checking mapping first then baseURI fallback.
     */
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (!_exists(tokenId)) revert URIQueryForNonexistentToken();
        string memory uri = _tokenURIs[tokenId];
        return bytes(uri).length > 0 ? uri : string(abi.encodePacked(_baseTokenURI, tokenId.toString()));
    }

    // --- Admin functions ---

    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        _baseTokenURI = newBaseURI;
    }

    function setPrice(uint256 newPrice) external onlyOwner {
        pricePerToken = newPrice;
    }

    function setMaxSupply(uint256 newMaxSupply) external onlyOwner {
        maxSupply = newMaxSupply;
    }

    function setAccessCode(string calldata code) external onlyOwner {
        accessCodeHash = keccak256(abi.encodePacked(code));
    }

    function withdraw(address payable recipient) external onlyOwner {
        recipient.transfer(address(this).balance);
    }

    function baseURI() external view returns (string memory) {
        return _baseTokenURI;
    }
}
