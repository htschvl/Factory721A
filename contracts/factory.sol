// SPDX-License-Identifier: MIT
pragma solidity ^0.8.25;

import "./ERC721ACollection.sol";

/**
 * @title ERC721AFactory - Refactored
 * @notice Factory contract for deploying ERC721A collections with comprehensive configuration
 */
contract ERC721AFactory {

    // ============================= CONSTANTS ============================= \\

    uint256 private constant MAX_COLLECTIONS_PER_CREATOR = 100;
    uint256 private constant MAX_BATCH_DEPLOY = 10;

    // ============================= STRUCTS ============================= \\

    struct DeploymentConfig {
        string name;
        string symbol;
        string baseURI;
        string contractURI;
        address owner;
        address trustedRelayer;
    }

    struct MintSettings {
        uint256 maxSupply;
        uint256 pricePerToken;
        uint256 maxPerWallet;
        uint256 maxPerTransaction;
        uint256 startTime;
        uint256 endTime;
    }

    struct AccessSettings {
        string accessCode;
        address[] authorizedRelayers;
    }

    struct CollectionInfo {
        address collection;
        address creator;
        string name;
        string symbol;
        uint256 deployedAt;
        bool isActive;
    }

    // ============================= STATE VARIABLES ============================= \\

    address public factoryOwner;
    address public defaultTrustedRelayer;
    bool public deploymentPaused;
    uint256 public deploymentFee;
    uint256 public totalCollections;

    mapping(address => address[]) public creatorCollections;
    mapping(address => CollectionInfo) public collectionInfo;
    mapping(address => bool) public authorizedDeployers;
    mapping(address => uint256) public creatorCollectionCount;

    address[] public allCollections;

    // ============================= EVENTS ============================= \\

    event CollectionDeployed(
        address indexed creator,
        address indexed collection,
        string name,
        string symbol,
        uint256 maxSupply,
        uint256 timestamp
    );

    event BatchCollectionDeployed(
        address indexed creator,
        address[] collections,
        uint256 count,
        uint256 timestamp
    );

    event CollectionStatusChanged(
        address indexed collection,
        bool isActive,
        address indexed updater
    );

    event DeploymentFeeUpdated(
        uint256 oldFee,
        uint256 newFee,
        address indexed updater
    );

    event DefaultRelayerUpdated(
        address oldRelayer,
        address newRelayer,
        address indexed updater
    );

    event DeploymentPausedToggled(
        bool paused,
        address indexed updater
    );

    event DeployerAuthorizationChanged(
        address indexed deployer,
        bool authorized,
        address indexed updater
    );

    // ============================= CONSTRUCTOR ============================= \\

    constructor(address _defaultTrustedRelayer, uint256 _deploymentFee) {
        factoryOwner = msg.sender;
        defaultTrustedRelayer = _defaultTrustedRelayer;
        deploymentFee = _deploymentFee;
        deploymentPaused = false;
    }

    // ============================= MODIFIERS ============================= \\

    modifier onlyFactoryOwner() {
        require(msg.sender == factoryOwner, "Not factory owner");
        _;
    }

    modifier whenNotPaused() {
        require(!deploymentPaused, "Deployment paused");
        _;
    }

    modifier validDeployer() {
        require(
            msg.sender == factoryOwner || authorizedDeployers[msg.sender],
            "Not authorized deployer"
        );
        _;
    }

    // ============================= CORE DEPLOYMENT FUNCTIONS ============================= \\

    /**
     * @notice Deploy a new ERC721A collection with basic configuration
     * @param config Basic deployment configuration
     * @param mintSettings Minting parameters and limits
     * @return collection Address of the deployed collection
     */
    function deployCollection(
        DeploymentConfig calldata config,
        MintSettings calldata mintSettings
    ) external payable whenNotPaused returns (address collection) {
        _validateDeploymentFee();
        _validateDeploymentConfig(config);
        _validateMintSettings(mintSettings);

        collection = _deployCollection(config, mintSettings, AccessSettings("", new address[](0)));

        emit CollectionDeployed(
            config.owner,
            collection,
            config.name,
            config.symbol,
            mintSettings.maxSupply,
            block.timestamp
        );

        return collection;
    }

    /**
     * @notice Deploy a collection with advanced access control settings
     * @param config Basic deployment configuration
     * @param mintSettings Minting parameters and limits
     * @param accessSettings Access control configuration
     * @return collection Address of the deployed collection
     */
    function deployAdvancedCollection(
        DeploymentConfig calldata config,
        MintSettings calldata mintSettings,
        AccessSettings calldata accessSettings
    ) external payable whenNotPaused returns (address collection) {
        _validateDeploymentFee();
        _validateDeploymentConfig(config);
        _validateMintSettings(mintSettings);

        collection = _deployCollection(config, mintSettings, accessSettings);

        _configureAdvancedAccess(collection, accessSettings);

        emit CollectionDeployed(
            config.owner,
            collection,
            config.name,
            config.symbol,
            mintSettings.maxSupply,
            block.timestamp
        );

        return collection;
    }

    /**
     * @notice Deploy multiple collections in a single transaction
     * @param configs Array of deployment configurations
     * @param mintSettings Array of mint settings
     * @return collections Array of deployed collection addresses
     */
    function deployBatchCollections(
        DeploymentConfig[] calldata configs,
        MintSettings[] calldata mintSettings
    ) external payable whenNotPaused validDeployer returns (address[] memory collections) {
        require(configs.length == mintSettings.length, "Array length mismatch");
        require(configs.length > 0 && configs.length <= MAX_BATCH_DEPLOY, "Invalid batch size");
        require(msg.value >= deploymentFee * configs.length, "Insufficient batch fee");

        collections = new address[](configs.length);

        for (uint256 i = 0; i < configs.length; i++) {
            _validateDeploymentConfig(configs[i]);
            _validateMintSettings(mintSettings[i]);

            collections[i] = _deployCollection(
                configs[i],
                mintSettings[i],
                AccessSettings("", new address[](0))
            );
        }

        emit BatchCollectionDeployed(msg.sender, collections, configs.length, block.timestamp);

        return collections;
    }

    // ============================= INTERNAL DEPLOYMENT LOGIC ============================= \\

    function _deployCollection(
        DeploymentConfig memory config,
        MintSettings memory mintSettings,
        AccessSettings memory accessSettings
    ) internal returns (address collection) {
        require(creatorCollectionCount[config.owner] < MAX_COLLECTIONS_PER_CREATOR, "Max collections reached");

        address trustedRelayer = config.trustedRelayer != address(0)
            ? config.trustedRelayer
            : defaultTrustedRelayer;

        ERC721ACollection newCollection = new ERC721ACollection(
            config.name,
            config.symbol,
            config.baseURI,
            config.contractURI,
            config.owner,
            address(this),
            trustedRelayer
        );

        collection = address(newCollection);

        // Configure mint settings
        ERC721ACollection.MintConfig memory mintConfig = ERC721ACollection.MintConfig({
            maxSupply: mintSettings.maxSupply,
            pricePerToken: mintSettings.pricePerToken,
            maxPerWallet: mintSettings.maxPerWallet,
            maxPerTransaction: mintSettings.maxPerTransaction,
            startTime: mintSettings.startTime > 0 ? mintSettings.startTime : block.timestamp,
            endTime: mintSettings.endTime
        });

        newCollection.setMintConfig(mintConfig);

        // Set access code if provided
        if (bytes(accessSettings.accessCode).length > 0) {
            newCollection.setAccessCode(accessSettings.accessCode);
        }

        // Store collection info
        _storeCollectionInfo(collection, config.owner, config.name, config.symbol);

        return collection;
    }

    function _configureAdvancedAccess(address collection, AccessSettings memory accessSettings) internal {
        ERC721ACollection collectionContract = ERC721ACollection(collection);

        // Set authorized relayers
        for (uint256 i = 0; i < accessSettings.authorizedRelayers.length; i++) {
            if (accessSettings.authorizedRelayers[i] != address(0)) {
                collectionContract.setRelayerAuthorization(accessSettings.authorizedRelayers[i], true);
            }
        }
    }

    function _storeCollectionInfo(
        address collection,
        address creator,
        string memory name,
        string memory symbol
    ) internal {
        allCollections.push(collection);
        creatorCollections[creator].push(collection);
        creatorCollectionCount[creator]++;
        totalCollections++;

        collectionInfo[collection] = CollectionInfo({
            collection: collection,
            creator: creator,
            name: name,
            symbol: symbol,
            deployedAt: block.timestamp,
            isActive: true
        });
    }

    // ============================= VALIDATION FUNCTIONS ============================= \\

    function _validateDeploymentFee() internal view {
        require(msg.value >= deploymentFee, "Insufficient deployment fee");
    }

    function _validateDeploymentConfig(DeploymentConfig calldata config) internal pure {
        require(bytes(config.name).length > 0, "Empty name");
        require(bytes(config.symbol).length > 0, "Empty symbol");
        require(config.owner != address(0), "Zero owner address");
    }

    function _validateMintSettings(MintSettings calldata settings) internal pure {
        require(settings.maxPerWallet > 0, "Invalid max per wallet");
        require(settings.maxPerTransaction > 0, "Invalid max per transaction");
        require(settings.maxPerTransaction <= settings.maxPerWallet, "Transaction limit exceeds wallet limit");
        if (settings.endTime > 0) {
            require(settings.endTime > settings.startTime, "Invalid time range");
        }
    }



    // ============================= FACTORY MANAGEMENT ============================= \\

    function setDeploymentFee(uint256 newFee) external onlyFactoryOwner {
        uint256 oldFee = deploymentFee;
        deploymentFee = newFee;
        emit DeploymentFeeUpdated(oldFee, newFee, msg.sender);
    }

    function setDefaultTrustedRelayer(address newRelayer) external onlyFactoryOwner {
        require(newRelayer != address(0), "Zero address");
        address oldRelayer = defaultTrustedRelayer;
        defaultTrustedRelayer = newRelayer;
        emit DefaultRelayerUpdated(oldRelayer, newRelayer, msg.sender);
    }

    function toggleDeploymentPause() external onlyFactoryOwner {
        deploymentPaused = !deploymentPaused;
        emit DeploymentPausedToggled(deploymentPaused, msg.sender);
    }

    function setDeployerAuthorization(address deployer, bool authorized) external onlyFactoryOwner {
        require(deployer != address(0), "Zero address");
        authorizedDeployers[deployer] = authorized;
        emit DeployerAuthorizationChanged(deployer, authorized, msg.sender);
    }

    function setCollectionStatus(address collection, bool isActive) external onlyFactoryOwner {
        require(collectionInfo[collection].collection != address(0), "Collection not found");
        collectionInfo[collection].isActive = isActive;
        emit CollectionStatusChanged(collection, isActive, msg.sender);
    }

    function transferFactoryOwnership(address newOwner) external onlyFactoryOwner {
        require(newOwner != address(0), "Zero address");
        factoryOwner = newOwner;
    }

    function withdrawFees() external onlyFactoryOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");

        (bool success, ) = payable(factoryOwner).call{value: balance}("");
        require(success, "Withdrawal failed");
    }

    // ============================= VIEW FUNCTIONS ============================= \\

    function getCollectionsCount() external view returns (uint256) {
        return allCollections.length;
    }

    function getCreatorCollections(address creator) external view returns (address[] memory) {
        return creatorCollections[creator];
    }

    function getCreatorCollectionCount(address creator) external view returns (uint256) {
        return creatorCollectionCount[creator];
    }

    function getCollectionDetails(address collection) external view returns (CollectionInfo memory) {
        return collectionInfo[collection];
    }

    function getAllCollections() external view returns (address[] memory) {
        return allCollections;
    }

    function getActiveCollections() external view returns (address[] memory) {
        uint256 activeCount = 0;

        // Count active collections
        for (uint256 i = 0; i < allCollections.length; i++) {
            if (collectionInfo[allCollections[i]].isActive) {
                activeCount++;
            }
        }

        // Create array of active collections
        address[] memory activeCollections = new address[](activeCount);
        uint256 currentIndex = 0;

        for (uint256 i = 0; i < allCollections.length; i++) {
            if (collectionInfo[allCollections[i]].isActive) {
                activeCollections[currentIndex] = allCollections[i];
                currentIndex++;
            }
        }

        return activeCollections;
    }

    function getFactoryStats() external view returns (
        uint256 totalDeployed,
        uint256 totalCreators,
        uint256 currentFee,
        bool isPaused,
        address owner
    ) {
        uint256 uniqueCreators = 0;

        // This is a simplified count - in production you might want to track this more efficiently
        for (uint256 i = 0; i < allCollections.length; i++) {
            address creator = collectionInfo[allCollections[i]].creator;
            bool isNewCreator = true;

            for (uint256 j = 0; j < i; j++) {
                if (collectionInfo[allCollections[j]].creator == creator) {
                    isNewCreator = false;
                    break;
                }
            }

            if (isNewCreator) {
                uniqueCreators++;
            }
        }

        return (
            totalCollections,
            uniqueCreators,
            deploymentFee,
            deploymentPaused,
            factoryOwner
        );
    }

    function isCollectionFromFactory(address collection) external view returns (bool) {
        return collectionInfo[collection].collection != address(0);
    }

    function canDeploy(address deployer) external view returns (bool canDeployNow, string memory reason) {
        if (deploymentPaused) {
            return (false, "Deployment paused");
        }

        if (deployer != factoryOwner && !authorizedDeployers[deployer]) {
            return (false, "Not authorized deployer");
        }

        if (creatorCollectionCount[deployer] >= MAX_COLLECTIONS_PER_CREATOR) {
            return (false, "Max collections reached");
        }

        return (true, "Can deploy");
    }

    // ============================= RECEIVE FUNCTION ============================= \\

    receive() external payable {
        // Accept direct payments as deployment fees
    }
}
