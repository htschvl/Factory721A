// SPDX-License-Identifier: AGPL-3.0
pragma solidity 0.8.25;

import "erc721a/contracts/ERC721A.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/metatx/ERC2771Context.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title ERC721ACollection - Refactored
 * @notice Streamlined ERC721A collection with unified minting system
 */
contract ERC721ACollection is ERC721A, Ownable, ReentrancyGuard, Pausable, ERC2771Context {
    using Strings for uint256;

    // ============================= CONSTANTS ============================= \\
    uint256 private constant MAX_TOKENS_PER_TX = 10;
    uint256 private constant MAX_BATCH_SIZE = 100;

    // ============================= ENUMS ============================= \\
    enum MintPhase { CLOSED, PRIVATE, PUBLIC, OWNER_ONLY }
    enum AuthType { NONE, ACCESS_CODE, SIGNATURE, OWNER_ONLY }

    // ============================= STRUCTS ============================= \\
    struct MintConfig {
        uint256 maxSupply;
        uint256 pricePerToken;
        uint256 maxPerWallet;
        uint256 maxPerTransaction;
        uint256 startTime;
        uint256 endTime;
    }

    struct MintParams {
        address to;
        uint256 quantity;
        AuthType authType;
        bytes authData;
        string[] metadataURIs;
        uint256 nonce;
    }

    // ============================= STATE VARIABLES ============================= \\
    MintPhase public currentPhase;
    MintConfig public mintConfig;
    string private _baseTokenURI;
    string public contractURI;
    bytes32 public accessCodeHash;
    bool public surpriseMintEnabled;
    address public factory;
    address public trustedRelayer;

    mapping(uint256 => string) private _tokenURIs;
    mapping(address => uint256) public walletMintCount;
    mapping(uint256 => string) private _surpriseURIs;
    mapping(uint256 => bool) private _surpriseURIUsed;
    uint256 private _surpriseURICount;
    mapping(address => bool) public authorizedRelayers;
    mapping(uint256 => bool) public usedNonces;

    // ============================= CONSTRUCTOR ============================= \\
    constructor(
        string memory name_,
        string memory symbol_,
        string memory baseURI_,
        string memory contractURI_,
        address owner_,
        address factory_,
        address trustedRelayer_
    ) ERC721A(name_, symbol_) Ownable(owner_) ERC2771Context(trustedRelayer_) {
        _baseTokenURI = baseURI_;
        contractURI = contractURI_;
        factory = factory_;
        trustedRelayer = trustedRelayer_;

        mintConfig = MintConfig({
            maxSupply: 0,
            pricePerToken: 0,
            maxPerWallet: 10,
            maxPerTransaction: 5,
            startTime: block.timestamp,
            endTime: 0
        });

        currentPhase = MintPhase.CLOSED;
    }

    // ============================= RELAYER SUPPORT ============================= \\
    function setTrustedRelayer(address newRelayer) external onlyOwner {
        trustedRelayer = newRelayer;
    }

    function setRelayerAuthorization(address relayer, bool authorized) external onlyOwner {
        require(relayer != address(0), "Invalid relayer");
        authorizedRelayers[relayer] = authorized;
    }

    function isTrustedForwarder(address forwarder) public view override returns (bool) {
        return forwarder == trustedRelayer || authorizedRelayers[forwarder];
    }

    function _msgSender() internal view override(Context, ERC2771Context) returns (address) {
        return ERC2771Context._msgSender();
    }

    function _msgData() internal view override(Context, ERC2771Context) returns (bytes calldata) {
        return ERC2771Context._msgData();
    }
    function _contextSuffixLength() internal view override(Context, ERC2771Context) returns (uint256) {
    return ERC2771Context._contextSuffixLength();
}

    // ============================= UNIFIED MINTING ============================= \\
    function _unifiedMint(MintParams memory params) internal returns (uint256 startTokenId) {
        // Validate basics
        require(params.quantity > 0 && params.quantity <= mintConfig.maxPerTransaction, "Invalid quantity");
        require(params.quantity <= MAX_TOKENS_PER_TX, "Exceeds max per tx");
        require(params.to != address(0), "Zero address");

        // Validate timing
        require(block.timestamp >= mintConfig.startTime, "Not started");
        require(mintConfig.endTime == 0 || block.timestamp <= mintConfig.endTime, "Ended");

        // Validate supply and wallet limits
        if (mintConfig.maxSupply > 0) {
            require(_totalMinted() + params.quantity <= mintConfig.maxSupply, "Max supply exceeded");
        }
        require(walletMintCount[params.to] + params.quantity <= mintConfig.maxPerWallet, "Wallet limit exceeded");

        // Handle payment
        uint256 totalCost = mintConfig.pricePerToken * params.quantity;
        require(msg.value >= totalCost, "Insufficient payment");

        // Execute mint
        startTokenId = _nextTokenId();
        walletMintCount[params.to] += params.quantity;
        _mint(params.to, params.quantity);

    }

    function _injectMetadata(uint256 startTokenId, uint256 quantity, string[] memory metadataURIs) internal {
        require(metadataURIs.length == quantity, "Array mismatch");
        for (uint256 i = 0; i < quantity; ++i) {
            if (bytes(metadataURIs[i]).length > 0) {
                _tokenURIs[startTokenId + i] = metadataURIs[i];
            }
        }
    }


    // ============================= PUBLIC MINT FUNCTIONS ============================= \\
    function mint(uint256 quantity) external payable nonReentrant whenNotPaused returns (uint256) {
        return _unifiedMint(MintParams(_msgSender(), quantity, AuthType.NONE, "", new string[](0), 0));
    }

    function mintTo(address to, uint256 quantity) external payable nonReentrant whenNotPaused returns (uint256) {
        return _unifiedMint(MintParams(to, quantity, AuthType.NONE, "", new string[](0), 0));
    }

    function privateMint(uint256 quantity, string calldata accessCode) external payable nonReentrant whenNotPaused returns (uint256) {
        return _unifiedMint(MintParams(_msgSender(), quantity, AuthType.ACCESS_CODE, abi.encode(accessCode), new string[](0), 0));
    }

    function ownerMint(address to, uint256 quantity, string[] calldata customURIs) external onlyOwner nonReentrant returns (uint256) {
        return _unifiedMint(MintParams(to, quantity, AuthType.OWNER_ONLY, "", customURIs, 0));
    }

    function batchMint(address[] calldata recipients, uint256[] calldata quantities)
    external
    payable
    nonReentrant
    whenNotPaused
    onlyOwner
{
    require(recipients.length == quantities.length && recipients.length <= MAX_BATCH_SIZE, "Invalid batch");

    for (uint256 i = 0; i < recipients.length; ++i) {
        _unifiedMint(MintParams(recipients[i], quantities[i], AuthType.OWNER_ONLY, "", new string[](0), 0));
    }
}

function mintWithMetadata(uint256 quantity, string[] calldata metadataURIs)
    external
    payable
    nonReentrant
    whenNotPaused
    onlyOwner
    returns (uint256){
    return _unifiedMint(MintParams(_msgSender(), quantity, AuthType.OWNER_ONLY, "", metadataURIs, 0));
}

    // ============================= METADATA FUNCTIONS ============================= \\
    function injectMetadata(uint256 tokenId, string calldata metadataURI)
    external
    onlyOwner
    nonReentrant
{
    require(_exists(tokenId) && bytes(metadataURI).length > 0, "Invalid params");
    _tokenURIs[tokenId] = metadataURI;
}

    function batchInjectMetadata(uint256[] calldata tokenIds, string[] calldata metadataURIs)
    external
    onlyOwner
    nonReentrant
{
    require(tokenIds.length == metadataURIs.length && tokenIds.length <= MAX_BATCH_SIZE, "Invalid batch");

    for (uint256 i = 0; i < tokenIds.length; ++i) {
        require(_exists(tokenIds[i]) && bytes(metadataURIs[i]).length > 0, "Invalid token/URI");
        _tokenURIs[tokenIds[i]] = metadataURIs[i];
    }
}

    // ============================= CONFIGURATION ============================= \\
    function setMintPhase(MintPhase newPhase) external onlyOwner {
        currentPhase = newPhase;
    }

    function setMintConfig(MintConfig calldata newConfig) external onlyOwner {
        require(newConfig.maxSupply == 0 || newConfig.maxSupply >= _totalMinted(), "Invalid max supply");
        require(newConfig.maxPerTransaction > 0 && newConfig.maxPerWallet > 0, "Invalid limits");
        require(newConfig.maxPerTransaction <= MAX_TOKENS_PER_TX, "Exceeds max per tx");
        mintConfig = newConfig;
    }

    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        _baseTokenURI = newBaseURI;
    }

    function setContractURI(string calldata newContractURI) external onlyOwner {
        contractURI = newContractURI;
    }

    function setAccessCode(string calldata accessCode) external onlyOwner {
        require(bytes(accessCode).length > 0, "Empty code");
        accessCodeHash = keccak256(abi.encodePacked(accessCode));
    }

    function removeAccessCode() external onlyOwner {
        accessCodeHash = bytes32(0);
    }


    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // ============================= VIEW FUNCTIONS ============================= \\
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        if (!_exists(tokenId)) revert URIQueryForNonexistentToken();

        string memory tokenSpecificURI = _tokenURIs[tokenId];
        if (bytes(tokenSpecificURI).length > 0) return tokenSpecificURI;

        string memory baseURI = _baseURI();
        return bytes(baseURI).length > 0 ? string(abi.encodePacked(baseURI, tokenId.toString())) : "";
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function _startTokenId() internal pure override returns (uint256) {
        return 1;
    }

    function totalMinted() external view returns (uint256) {
        return _totalMinted();
    }

    function numberMinted(address owner) external view returns (uint256) {
        return _numberMinted(owner);
    }

    function hasCustomURI(uint256 tokenId) external view returns (bool) {
        return bytes(_tokenURIs[tokenId]).length > 0;
    }

    function getMintStats(address addr) external view returns (uint256 mintCount, uint256 remainingAllowance, bool canMintInCurrentPhase) {
        mintCount = walletMintCount[addr];
        remainingAllowance = mintConfig.maxPerWallet > mintCount ? mintConfig.maxPerWallet - mintCount : 0;
        canMintInCurrentPhase = currentPhase == MintPhase.PUBLIC ||
            (currentPhase == MintPhase.PRIVATE && accessCodeHash != bytes32(0)) ||
            (currentPhase == MintPhase.OWNER_ONLY && addr == owner());
    }



    function getCollectionInfo(uint256 nonce) external view returns (
    string memory collectionName,
    string memory collectionSymbol,
    uint256 mintedSupply,
    uint256 maxSupply,
    MintPhase phase,
    uint256 price,
    bool isNonceUsed
) {
        return (
        name(),
        symbol(),
        totalSupply(),
        mintConfig.maxSupply,
        currentPhase,
        mintConfig.pricePerToken,
        usedNonces[nonce]
    );
}

    // ============================= EVENTS =============================

      event PublicMint(
        address indexed minter,
        uint256 quantity,
        uint256 startTokenId,
        uint256 totalCost,
        MintPhase phase
    );

    event PrivateMint(
        address indexed minter,
        uint256 quantity,
        uint256 startTokenId,
        uint256 totalCost,
        bool usedAccessCode
    );

    event OwnerMint(
        address indexed recipient,
        uint256 quantity,
        uint256 startTokenId,
        bool hasCustomURIs
    );

    event PublicMintWithMetadata(
        address indexed minter,
        uint256 quantity,
        uint256 startTokenId,
        uint256 totalCost,
        MintPhase phase
    );


    event MetadataInjected(
        uint256 indexed tokenId,
        string metadataURI,
        address indexed injector
    );


    event MintPhaseChanged(
        MintPhase indexed oldPhase,
        MintPhase indexed newPhase,
        address indexed updater
    );

    event MintConfigUpdated(
        MintConfig oldConfig,
        MintConfig newConfig,
        address indexed updater
    );

    event BaseURIUpdated(
        string oldBaseURI,
        string newBaseURI,
        address indexed updater
    );



    event SurpriseMintToggled(bool enabled, address indexed updater);

    event SurpriseURIsAdded(
        string[] uris,
        uint256 startIndex,
        address indexed updater
    );

    event SurpriseURIAssigned(
        uint256 indexed tokenId,
        string uri,
        uint256 surpriseIndex
    );

    event CollectionDeployed(
    address indexed collectionAddress,
    string name,
    string symbol,
    string baseURI,
    string contractURI,
    address indexed owner,
    address indexed factory,
    address trustedRelayer,
    uint256 timestamp
);
}

