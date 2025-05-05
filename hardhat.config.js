require("@nomicfoundation/hardhat-toolbox");

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  defaultNetwork: "fuji",
  networks: {
    fuji: {
      url: "",
      accounts: [""],
      chainId: 43113
    },
    hardhat: {}
  },
  etherscan: {
    apiKey: "JH7MF9F1IRWFVQKA7BQI5NDCK8KD93AUIC"
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
