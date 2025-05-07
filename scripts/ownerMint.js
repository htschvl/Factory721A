const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const { formatEther, parseEther } = require("ethers");
require("dotenv").config();


function getNextIndexedFilePair(logsDir, tokensDir, prefix, logSuffix, tokenSuffix) {
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  if (!fs.existsSync(tokensDir)) fs.mkdirSync(tokensDir, { recursive: true });

  const files = fs.readdirSync(logsDir);
  const indexes = files
    .map(f => f.match(new RegExp(`^${prefix}(\\d+)${logSuffix.replace('.', '\\.')}$`)))
    .filter(Boolean)
    .map(match => parseInt(match[1], 10));

  const nextIndex = indexes.length > 0 ? Math.max(...indexes) + 1 : 0;

  return {
    index: nextIndex,
    logPath: path.join(logsDir, `${prefix}${nextIndex}${logSuffix}`),
    tokenPath: path.join(tokensDir, `${prefix}${nextIndex}${tokenSuffix}`)
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
  const logsDir = path.join(__dirname, "../logs");
  const tokensDir = path.join(__dirname, "../tokens");

  const { index, logPath, tokenPath } = getNextIndexedFilePair(
    logsDir,
    tokensDir,
    "ownerMint",
    "Log.md",
    "Minted.md"
  );

  const logger = createLogger(logPath);
  logger.log(`# 🎯 Starting ownerMint (Index ${index})`);



  const [owner] = await ethers.getSigners();
  logger.log("📍 Minter address:", owner);
  const Collection = await ethers.getContractAt( "ERC721ACollection", string(process.env.COLLECTION_ADDRESS) // your deployed collection address
  );

  logger.log("🔗 Connected to collection:", Collection.target);
  logger.log("👤 Minter (owner):", owner.address);
  

  // === Your hardcoded metadata URIs from Pinata
  const uris = [
    ""
  ];

  logger.log("🧾 Minting", uris.length, "NFTs...");

  const quantity = 0; // Set to the number of NFTs you want to mint
  const accessCode = ""; // Only set if required
  const pricePerToken = await Collection.pricePerToken();
  const totalCost = pricePerToken * BigInt(quantity);

  logger.log("🧾 Minting", quantity, "NFTs...");
  logger.log("💸 Price per token:", formatEther(pricePerToken), "ETH");
  logger.log("💸 Total cost:", formatEther(totalCost), "ETH");
  logger.log("🔐 Access code:", `"${accessCode}"`);

  const tx = await Collection.ownerMint(owner.address, uris.length, uris);
  const receipt = await tx.wait();

  logger.log("✅ Minted!");
  logger.log("🔗 TX hash:", receipt.hash);

  for (let i = 0; i < uris.length; i++) {
    const tokenId = i;
    const uri = await Collection.tokenURI(tokenId);
    logger.log(`🏷️ Token ${tokenId} URI:`, uri);
  }

  let mintedTable = `# 🧾 Minted NFT Summary\n\n`;
  mintedTable += `**Collection Address:** \`${Collection.target}\`\n\n`;
  mintedTable += `| Token ID | URI | Receiver |\n`;
  mintedTable += `|----------|-----|----------|\n`;

  const totalSupply = await Collection.totalSupply();
  const startId = totalSupply - BigInt(uris.length);

  for (let i = 0n; i < BigInt(uris.length); i++) {
    const tokenId = startId + i;
    const uri = await Collection.tokenURI(tokenId);
    logger.log(`🏷️ Token ${tokenId} URI:`, uri);

    mintedTable += `| ${tokenId} | \`${uri}\` | \`${owner.address}\` |\n`;
  }

  fs.writeFileSync(tokenPath, mintedTable);

  logger.log("📄 **Mint report saved to:**", tokenPath);
  logger.log("✅ **ownerMint complete**");
  logger.close();
}

main().catch((err) => {
  console.error("❌ Owner mint failed:", err);
  process.exit(1);
});