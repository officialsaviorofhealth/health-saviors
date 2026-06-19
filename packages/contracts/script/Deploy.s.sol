// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/H2EToken.sol";
import "../src/HealthReward.sol";
import "../src/HealthBadge.sol";
import "../src/DataConsent.sol";
import "../src/DataMarketplace.sol";
import "../src/H2EVesting.sol";

contract DeployAll is Script {
    function run() external {
        uint256 deployerPk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address admin = vm.addr(deployerPk);
        address backendSigner = vm.envAddress("BACKEND_SIGNER_ADDRESS");
        address platformWallet = vm.envAddress("PLATFORM_WALLET");
        address hospitalWallet = vm.envAddress("HOSPITAL_WALLET");
        address treasuryWallet = vm.envAddress("TREASURY_WALLET");

        vm.startBroadcast(deployerPk);

        // 1. H2E Token
        H2EToken token = new H2EToken(admin);
        console.log("H2EToken:", address(token));

        // 2. Health Reward
        HealthReward reward = new HealthReward(address(token), backendSigner, admin);
        token.grantRole(token.MINTER_ROLE(), address(reward));
        console.log("HealthReward:", address(reward));

        // 3. Health Badge (SBT)
        HealthBadge badge = new HealthBadge(admin);
        badge.grantRole(badge.MINTER_ROLE(), address(reward));
        console.log("HealthBadge:", address(badge));

        // 4. Data Consent
        DataConsent consent = new DataConsent();
        console.log("DataConsent:", address(consent));

        // 5. Data Marketplace
        DataMarketplace marketplace = new DataMarketplace(
            address(token), platformWallet, hospitalWallet, treasuryWallet, admin
        );
        console.log("DataMarketplace:", address(marketplace));

        // 6. H2E Vesting
        H2EVesting vesting = new H2EVesting(address(token), admin);
        console.log("H2EVesting:", address(vesting));

        vm.stopBroadcast();

        // Output JSON for frontend/backend consumption
        string memory json = string(abi.encodePacked(
            '{"h2eToken":"', vm.toString(address(token)),
            '","healthReward":"', vm.toString(address(reward)),
            '","healthBadge":"', vm.toString(address(badge)),
            '","dataConsent":"', vm.toString(address(consent)),
            '","dataMarketplace":"', vm.toString(address(marketplace)),
            '","h2eVesting":"', vm.toString(address(vesting)), '"}'
        ));
        vm.writeFile("deployments/addresses.json", json);
    }
}
