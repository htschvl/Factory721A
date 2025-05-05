const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const { parseEther, formatEther, keccak256, toUtf8Bytes } = require("ethers");

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
  const logger = createLogger("create-collection-log.txt");
  logger.log("🎯 Starting collection creation");

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  logger.log("📡 Creator address:", deployer.address);
  logger.log("💰 ETH balance:", formatEther(balance), "ETH");

  // === Factory address (already deployed) ===
  const factoryAddress = "0x6C487784150BBd6a1E7Cc145a998A20D42ADCe5D";
  const Factory = await ethers.getContractFactory("ERC721AFactory");
  const factory = await Factory.attach(factoryAddress);
  logger.log("🏭 Connected to factory at:", factoryAddress);

  // === Collection params ===
  const name = "";
  const symbol = "";
  const baseURI = "";
  const maxSupply = 0;
  const pricePerToken = 0
  const accessCode = ""; // Optional: leave "" for public
  const accessCodeHash = keccak256(toUtf8Bytes(accessCode));

  logger.log("📝 Collection Config:");
  logger.log("   Name:", name);
  logger.log("   Symbol:", symbol);
  logger.log("   Base URI:", baseURI);
  logger.log("   Max Supply:", maxSupply);
  logger.log("   Price:", formatEther(pricePerToken), "ETH");
  logger.log("   Access code hash:", accessCodeHash);

  // === Send the tx ===
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

  // === Parse emitted CollectionCreated event ===
  const parsed = receipt.logs
    .map(log => {
      try {
        return factory.interface.parseLog(log);
      } catch {
        return null;
      }
    })
    .find(e => e && e.name === "CollectionCreated");

  if (!parsed) {
    throw new Error("❌ Event not found: CollectionCreated");
  }

  const collectionAddress = parsed.args.collection;
  logger.log("✅ Collection deployed at:", collectionAddress);

  // === Verify metadata on-chain ===
  const Collection = await ethers.getContractAt("ERC721ACollection", collectionAddress);
  const actualName = await Collection.name();
  const actualSymbol = await Collection.symbol();
  const actualPrice = await Collection.pricePerToken();
  const actualSupply = await Collection.maxSupply();
  const actualBaseURI = await Collection.baseURI();
  const actualHash = await Collection.accessCodeHash();

  logger.log("🔍 On-Chain Verification:");
  logger.log("   Name:", actualName);
  logger.log("   Symbol:", actualSymbol);
  logger.log("   Price per token:", formatEther(actualPrice), "ETH");
  logger.log("   Max supply:", actualSupply.toString());
  logger.log("   Base URI:", actualBaseURI);
  logger.log("   Access hash:", actualHash);

  // === Save deployed address
  fs.writeFileSync(path.join(__dirname, "last-collection-address.txt"), collectionAddress + "\n");

  logger.log("📦 Saved to last-collection-address.txt");
  logger.log("✅ Collection creation complete.");
  logger.close();
}

main().catch((err) => {
  console.error("❌ Error during collection creation:", err);
  process.exit(1);
});
