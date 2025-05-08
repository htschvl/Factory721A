const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const { formatEther, parseEther } = require("ethers");
require("dotenv").config();

function getNextIndexedFilePair(logsDir, addressesDir, prefix, logSuffix, addressSuffix) {
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  if (!fs.existsSync(addressesDir)) fs.mkdirSync(addressesDir, { recursive: true });

  const files = fs.readdirSync(logsDir);
  const indexes = files
    .map(f => f.match(new RegExp(`^${prefix}(\\d+)${logSuffix.replace('.', '\\.')}$`)))
    .filter(Boolean)
    .map(match => parseInt(match[1], 10));

  const nextIndex = indexes.length > 0 ? Math.max(...indexes) + 1 : 0;

  return {
    index: nextIndex,
    logPath: path.join(logsDir, `${prefix}${nextIndex}${logSuffix}`),
    addressPath: path.join(addressesDir, `${prefix}${nextIndex}${addressSuffix}`)
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
  const logsDir = path.join(__dirname, "../logs/publicMint");
  const addressesDir = path.join(__dirname, "../mintedTokens/publicMint");

  const { index, logPath, addressPath } = getNextIndexedFilePair(
    logsDir,
    addressesDir,
    "publicMint",
    "Log.md",
    "Address.md"
  );

  const logger = createLogger(logPath);
  logger.log(`# 🎯 Starting publicMint (Index ${index})`);

  const [minter] = await ethers.getSigners();
  logger.log("📍 Minter address:", minter.address);
  
  const collectionAddress = "0x0000000000000000000000000000000000000000"; /// Your deployed collection addresx
  const Collection = await ethers.getContractAt( "ERC721ACollection", collectionAddress);

  logger.log("🔗 Connected to collection:", Collection.target);

  // Configuration for the public mint
  const quantity = 1; // Set to the number of NFTs you want to mint
  const accessCode = ""; // Access code if required, otherwise leave empty
  const pricePerToken = await Collection.pricePerToken();
  const totalCost = pricePerToken * BigInt(quantity);

  logger.log("🧾 Minting", quantity, "NFTs...");
  logger.log("👤 Minter:", minter.address);
  logger.log("💸 Price per token:", formatEther(pricePerToken), "ETH");
  logger.log("💸 Total cost:", formatEther(totalCost), "ETH");
  logger.log("🔐 Access code:", `"${accessCode}"`);

  // Execute the public mint transaction
  const tx = await Collection.publicMint(quantity, accessCode, { value: totalCost });
  const receipt = await tx.wait();

  logger.log("✅ Minted!");
  logger.log("🔗 TX hash:", receipt.hash);
  
  // Calculate transaction cost
  const gasUsed = receipt.gasUsed;
  const gasPrice = receipt.gasPrice || receipt.effectiveGasPrice;
  const txCost = gasUsed * gasPrice;
  
  logger.log("⛽ Gas used:", gasUsed.toString());
  logger.log("💰 Gas price:", formatEther(gasPrice), "ETH");
  logger.log("💸 Transaction cost:", formatEther(txCost), "ETH");
  logger.log("💵 Total cost (mint + gas):", formatEther(BigInt(txCost) + totalCost), "ETH");

  // Get the starting token ID for the newly minted tokens
  const totalSupply = await Collection.totalSupply();
  const startId = totalSupply - BigInt(quantity);

  // Create summary table for minted tokens
  let mintedTable = `# 🧾 Public Mint Summary\n\n`;
  mintedTable += `**Collection Address:** \`${Collection.target}\`\n\n`;
  mintedTable += `**Transaction:** \`${receipt.hash}\`\n\n`;
  mintedTable += `| Token ID | Owner | Block Number |\n`;
  mintedTable += `|----------|-------|-------------|\n`;

  // Add each token to the table
  for (let i = 0n; i < BigInt(quantity); i++) {
    const tokenId = startId + i;
    const owner = await Collection.ownerOf(tokenId);
    mintedTable += `| ${tokenId} | \`${owner}\` | ${receipt.blockNumber} |\n`;
    
    logger.log(`🏷️ Token ${tokenId} minted to:`, owner);
  }

  fs.writeFileSync(addressPath, mintedTable);

  logger.log("📄 **Mint report saved to:**", addressPath);
  
  // Log transaction cost details at the end
  logger.log("💹 **Transaction Cost Summary:**");
  logger.log("⛽ Gas used:", receipt.gasUsed.toString(), "units");
  logger.log("💰 Gas price:", formatEther(receipt.gasPrice || receipt.effectiveGasPrice), "ETH");
  logger.log("💸 Gas cost:", formatEther(receipt.gasUsed * (receipt.gasPrice || receipt.effectiveGasPrice)), "ETH");
  logger.log("💰 NFT cost:", formatEther(totalCost), "ETH");
  logger.log("💵 Total cost (NFT + gas):", formatEther(BigInt(receipt.gasUsed * (receipt.gasPrice || receipt.effectiveGasPrice)) + totalCost), "ETH");
  
  logger.log("✅ **publicMint complete**");
  logger.close();
}

main().catch((err) => {
  console.error("❌ Public mint failed:", err);
  process.exit(1);
});