const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const { parseEther, formatEther, keccak256, toUtf8Bytes } = require("ethers");
require("dotenv").config();

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

async function main() {
  const logsDir = path.join(__dirname, "../logs");
  const addrDir = path.join(__dirname, "../addresses");

  const { index, logPath, addrPath } = getNextIndexedFilePair(
    logsDir,
    addrDir,
    "createCollection",
    "Log.md",
    "Address.md"
  );

  const logger = createLogger(logPath);
  logger.log(`# 🎯 Starting collection creation (Index ${index})`);

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  logger.log("📡 Creator address:", deployer.address);
  logger.log("💰 ETH balance:", formatEther(balance), "ETH");

  const factoryAddress = process.env.FACTORY_ADDRESS;
  const Factory = await ethers.getContractFactory("ERC721AFactory");
  const factory = await Factory.attach(factoryAddress);
  logger.log("🏭 Connected to factory at:", factoryAddress);

  const name = "Test";
  const symbol = "TST";
  const baseURI = "";
  const maxSupply = 100;
  const pricePerToken = 100;
  const accessCode = "optional";
  const accessCodeHash = keccak256(toUtf8Bytes(accessCode));

  logger.log("📝 Collection Config:");
  logger.log("   Name:", name);
  logger.log("   Symbol:", symbol);
  logger.log("   Base URI:", baseURI);
  logger.log("   Max Supply:", maxSupply);
  logger.log("   Price:", formatEther(pricePerToken), "ETH");
  logger.log("   Access code hash:", accessCodeHash);

  logger.log("📨 Sending createCollection transaction...");
  const tx = await factory.createCollection(
    name,
    symbol,
    baseURI,
    maxSupply,
    pricePerToken,
    accessCode
  );

  const receipt = await tx.wait();
  logger.log("🔗 TX hash:", receipt.hash);

  const parsed = receipt.logs
    .map(log => {
      try {
        return factory.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find(e => e && e.name === "CollectionCreated");

  if (!parsed) throw new Error("❌ Event not found: CollectionCreated");

  const collectionAddress = parsed.args.collection;
  logger.log("✅ Collection deployed at:", collectionAddress);

  const Collection = await ethers.getContractAt("ERC721ACollection", collectionAddress);
  logger.log("🔍 On-Chain Verification:");
  logger.log("- Name:", await Collection.name());
  logger.log("- Symbol:", await Collection.symbol());
  logger.log("- Price per token:", formatEther(await Collection.pricePerToken()), "ETH");
  logger.log("- Max supply:", (await Collection.maxSupply()).toString());
  logger.log("- Base URI:", await Collection.baseURI());
  logger.log("- Access hash:", await Collection.accessCodeHash());

  const content = `Collection Address (Instance ${index})\n\n` +
                  `Contract Address: \`${collectionAddress}\`\n\n` +
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
