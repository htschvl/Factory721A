const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const { formatEther, parseEther } = require("ethers");


function createLogger(filename) {
  const logPath = path.join(__dirname, filename);
  const stream = fs.createWriteStream(logPath, { flags: "a" });

  function log(...args) {
    const msg = `[${new Date().toISOString()}] ${args.join(" ")}`;
    console.log(msg);
    stream.write(msg + "\n");
  }

  return {
    log,
    close: () => stream.end()
  };
}

async function main() {
  const logger = createLogger("owner-mint-log.txt");

  logger.log("🎯 Starting ownerMint with custom URIs");

  const [owner] = await ethers.getSigners();
  const Collection = await ethers.getContractAt(
    "ERC721ACollection",
    "" // your deployed collection
  );

  logger.log("🔗 Connected to collection:", Collection.target);
  logger.log("👤 Minter (owner):", owner.address);

  // === Your hardcoded metadata URIs from Pinata
  const uris = [
    ""
  ];

  logger.log("🧾 Minting", uris.length, "NFTs with hardcoded URIs...");

  const tx = await Collection.ownerMint(owner.address, uris.length, uris);
  const receipt = await tx.wait();

  logger.log("✅ Minted!");
  logger.log("🔗 TX hash:", receipt.hash);

  for (let i = 0; i < uris.length; i++) {
    const tokenId = i;
    const uri = await Collection.tokenURI(tokenId);
    logger.log(`🏷️ Token ${tokenId} URI:`, uri);
  }

  logger.close();
}

main().catch((err) => {
  console.error("❌ Owner mint failed:", err);
  process.exit(1);
});
