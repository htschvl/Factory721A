const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");
const { formatEther } = require("ethers");

function box(title) {
  const bar = "═".repeat(title.length + 2);
  return {
    top: `╔${bar}╗\n║ ${title} ║\n╚${bar}╝`
  };
}

function section(title) {
  const totalWidth = 60;
  const label = `═ ${title.toUpperCase()} `;
  const line = label + "═".repeat(Math.max(0, totalWidth - label.length));
  return `\n${line}`;
}

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
  const logsDir = path.join(__dirname, "../logs/deployFactory");
  const addrDir = path.join(__dirname, "../addresses/deployFactory");

  const { index, logPath, addrPath } = getNextIndexedFilePair(
    logsDir,
    addrDir,
    "deployFactory",
    "Logs.md",
    "Address.md"
  );

  const logger = createLogger(logPath);
  logger.log(box(`🚀 Deploying Factory (Index ${index})`).top);

  const [deployer] = await ethers.getSigners();
  const deployerBalance = await ethers.provider.getBalance(deployer.address);

  logger.log(section("📡 Deployer Info"));
  logger.log("  Address:      ", deployer.address);
  logger.log("  Balance:      ", formatEther(deployerBalance), "ETH");

  logger.log(section("⏳ Deployment"));
  const Factory = await ethers.getContractFactory("ERC721AFactory");
  const factory = await Factory.deploy();

  const txResponse = factory.deploymentTransaction();
  const receipt = await txResponse.wait();

  const deployedAddress = factory.target;

  logger.log("  ✅ Factory deployed!");
  logger.log("  📍 Contract address:", deployedAddress);
  logger.log("  🔗 TX hash:", receipt.hash);

  logger.log(section("💹 Deployment Cost Summary"));
  const gasPrice = receipt.effectiveGasPrice ?? receipt.gasPrice;
  logger.log("  Gas used:     ", receipt.gasUsed.toString());
  logger.log("  Gas price:    ", formatEther(gasPrice), "ETH");
  logger.log("  Total cost:   ", formatEther(gasPrice * receipt.gasUsed), "ETH");

  const content = `🏗️ Factory Deployment (Instance ${index})\n\n` +
                  `Contract Address: \`${deployedAddress}\`\n\n` +
                  `Transaction Hash: \`${receipt.hash}\`\n`;

  fs.writeFileSync(addrPath, content);

  logger.log(section("📦 Output"));
  logger.log("  Address saved to:", addrPath);
  logger.log("✅ Factory deployment complete.");
  logger.close();
}

main().catch((err) => {
  console.error("❌ Error during factory deployment:", err);
  process.exit(1);
});
