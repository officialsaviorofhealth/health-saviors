// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IH2EToken {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function burnWithReason(uint256 amount, string calldata reason) external;
}

/// @title DataMarketplace — Research dataset trading with auto revenue split
/// @notice 60% users / 25% platform / 10% hospitals / 5% treasury
contract DataMarketplace is Ownable, ReentrancyGuard {

    IH2EToken public immutable h2eToken;

    // Revenue split (basis points / 10000)
    uint256 public constant USER_SHARE = 6000;      // 60%
    uint256 public constant PLATFORM_SHARE = 2500;   // 25%
    uint256 public constant HOSPITAL_SHARE = 1000;   // 10%
    uint256 public constant TREASURY_SHARE = 500;    // 5%
    uint256 public constant BURN_RATE = 200;         // 2% of platform share burned

    address public platformWallet;
    address public hospitalWallet;
    address public treasuryWallet;

    struct Dataset {
        bytes32 id;
        uint256 priceH2E;
        address[] contributors;
        uint256[] weights;       // Contribution weights
        bool active;
    }

    mapping(bytes32 => Dataset) public datasets;
    mapping(bytes32 => uint256) public datasetPurchaseCount;

    event DatasetListed(bytes32 indexed datasetId, uint256 priceH2E, uint256 contributorCount);
    event DatasetPurchased(bytes32 indexed datasetId, address indexed buyer, uint256 amount);
    event RevenueDistributed(bytes32 indexed datasetId, uint256 userTotal, uint256 platform, uint256 hospital, uint256 treasury);

    constructor(
        address _token,
        address _platform,
        address _hospital,
        address _treasury,
        address _admin
    ) Ownable() {
        h2eToken = IH2EToken(_token);
        platformWallet = _platform;
        hospitalWallet = _hospital;
        treasuryWallet = _treasury;
        transferOwnership(_admin);
    }

    /// @notice List a research dataset
    function listDataset(
        bytes32 datasetId,
        uint256 priceH2E,
        address[] calldata contributors,
        uint256[] calldata weights
    ) external onlyOwner {
        require(contributors.length == weights.length, "Market: length mismatch");
        require(!datasets[datasetId].active, "Market: already listed");

        datasets[datasetId] = Dataset({
            id: datasetId,
            priceH2E: priceH2E,
            contributors: contributors,
            weights: weights,
            active: true
        });

        emit DatasetListed(datasetId, priceH2E, contributors.length);
    }

    /// @notice Purchase dataset — auto-distributes revenue
    function purchaseDataset(bytes32 datasetId) external nonReentrant {
        Dataset storage ds = datasets[datasetId];
        require(ds.active, "Market: not available");

        uint256 price = ds.priceH2E;

        // Transfer H2E from buyer
        require(h2eToken.transferFrom(msg.sender, address(this), price), "Market: transfer failed");

        // Calculate splits
        uint256 userTotal = (price * USER_SHARE) / 10000;
        uint256 platformAmount = (price * PLATFORM_SHARE) / 10000;
        uint256 hospitalAmount = (price * HOSPITAL_SHARE) / 10000;
        uint256 treasuryAmount = price - userTotal - platformAmount - hospitalAmount;

        // Distribute to contributors (weighted)
        uint256 totalWeight = 0;
        for (uint256 i = 0; i < ds.weights.length; i++) {
            totalWeight += ds.weights[i];
        }
        for (uint256 i = 0; i < ds.contributors.length; i++) {
            uint256 share = (userTotal * ds.weights[i]) / totalWeight;
            h2eToken.transferFrom(address(this), ds.contributors[i], share);
        }

        // Platform, hospital, treasury
        h2eToken.transferFrom(address(this), platformWallet, platformAmount);
        h2eToken.transferFrom(address(this), hospitalWallet, hospitalAmount);
        h2eToken.transferFrom(address(this), treasuryWallet, treasuryAmount);

        datasetPurchaseCount[datasetId]++;
        emit DatasetPurchased(datasetId, msg.sender, price);
        emit RevenueDistributed(datasetId, userTotal, platformAmount, hospitalAmount, treasuryAmount);
    }

    /// @notice Deactivate dataset
    function deactivateDataset(bytes32 datasetId) external onlyOwner {
        datasets[datasetId].active = false;
    }

    /// @notice Update wallets
    function updateWallets(address _platform, address _hospital, address _treasury) external onlyOwner {
        platformWallet = _platform;
        hospitalWallet = _hospital;
        treasuryWallet = _treasury;
    }
}
