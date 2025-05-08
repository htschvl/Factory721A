require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  defaultNetwork: "hardhat",
  networks: {
    hardhat: {
      // No need to define `accounts` — Hardhat auto-generates them
    },
    localhost: {
      // Optional for connecting to `npx hardhat node`
      url: "http://127.0.0.1:8545"
    }
  },
  solidity: {
    version: "0.8.25",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  }
};
