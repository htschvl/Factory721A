const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const { formatEther, parseEther } = require("ethers");


function createLogger(filename) {
  const logPath = path.join(__dirname, filename);
  const stream = fs.createWriteStream(logPath, { flags: "a" });

  function log(...args) {
    const message = args.join(" ");
    const timestamp = `[${new Date().toISOString()}]`;
    console.log(message);
    stream.write(`${timestamp} ${message}\n`);
  }

  return {
    log,
    close: () => stream.end()
  };
}

async function main() {
  const logger = createLogger("deployment-log.txt");
  logger.log("🚀 Starting factory deployment");

  const [deployer] = await ethers.getSigners();
  const deployerBalance = await ethers.provider.getBalance(deployer.address);

  logger.log("📡 Deployer address:", deployer.address);
  logger.log("💰 Deployer balance:", ethers.formatEther(deployerBalance), "ETH");

  const Factory = await ethers.getContractFactory("ERC721AFactory");

  logger.log("⏳ Sending deployment transaction...");

  logger.log("⏳ Deploying ERC721AFactory...");

const factory = await Factory.deploy();
await factory.waitForDeployment();

const txHash = factory.deploymentTransaction().hash;
const deployedAddress = factory.target;

logger.log("✅ Factory deployed!");
logger.log("📍 Contract address:", deployedAddress);
logger.log("🔗 TX hash:", txHash);


  logger.log("✅ Factory deployed!");
  logger.log("📍 Contract address:", deployedAddress);
  logger.log("🔗 TX hash:", factory.deploymentTransaction().hash); // ✅ correct way in Ethers v6


  // Write the contract address to a standalone file
  fs.writeFileSync(
    path.join(__dirname, "factory-address.txt"),
    deployedAddress + "\n"
  );

  logger.log("📝 Address saved to factory-address.txt");
  logger.log("✅ Deployment complete");
  logger.close();
}

main().catch((error) => {
  console.error("❌ Deployment failed:", error);
  process.exit(1);
});
