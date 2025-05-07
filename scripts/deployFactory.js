const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");

function getNextIndexedFilePair(logsDir, addrDir, prefix, logSuffix, addrSuffix) {
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  if (!fs.existsSync(addrDir)) fs.mkdirSync(addrDir, { recursive: true });

  const files = fs.readdirSync(logsDir);
  const indexes = files
    .map(f => f.match(new RegExp(`^${prefix}(\\d+)${logSuffix.replace('.', '\\.')}$`)))
    .filter(Boolean)
    .map(match => parseInt(match[1], 10));

  const nextIndex = indexes.length > 0 ? Math.max(...indexes) + 1 : 0;

  return {
    index: nextIndex,
    logPath: path.join(logsDir, `${prefix}${nextIndex}${logSuffix}`),
    addrPath: path.join(addrDir, `${prefix}${nextIndex}${addrSuffix}`)
  };
}

function createLogger(filePath) {
  const stream = fs.createWriteStream(filePath, { flags: "a" });

  function log(...args) {
    const message = args.join(" ");
    const timestamp = `**[${new Date().toISOString()}]**`;
    console.log(message);
    stream.write(`${timestamp} ${message}\n\n`);
  }

  return {
    log,
    close: () => stream.end()
  };
}

async function main() {
  const logsDir = path.join(process.cwd(), "logs");
  const addrDir = path.join(process.cwd(), "addresses");

  const { index, logPath, addrPath } = getNextIndexedFilePair(
    logsDir,
    addrDir,
    "createCollection",
    "Logs.md",
    "Address.md"
  );

  const logger = createLogger(logPath);
  logger.log("🚀 Starting factory deployment");

  const [deployer] = await ethers.getSigners();
  const deployerBalance = await ethers.provider.getBalance(deployer.address);

  logger.log("📡 Deployer address:", deployer.address);
  logger.log("💰 Deployer balance:", ethers.formatEther(deployerBalance), "ETH");

  logger.log("⏳ Deploying ERC721AFactory...");

  const Factory = await ethers.getContractFactory("ERC721AFactory");
  const factory = await Factory.deploy();

  const txResponse = factory.deploymentTransaction();
  const receipt = await txResponse.wait();

  const deployedAddress = factory.target;

  logger.log("✅ Factory deployed!");
  logger.log("🔗 TX hash:", receipt.hash);
  logger.log("📍 Contract address:", deployedAddress);

  const content = `🏗️ Collection Address (Instance ${index})\n\n` +
                  `Contract Address: \`${deployedAddress}\`\n\n` +
                  `Transaction Hash: \`${receipt.hash}\`\n`;

  fs.writeFileSync(addrPath, content);
  logger.log("📦 Saved address to:", addrPath);
  logger.log("✅ Collection creation complete");

  logger.close();
}

main().catch((err) => {
  console.error("❌ Error during collection creation:", err);
  process.exit(1);
});
