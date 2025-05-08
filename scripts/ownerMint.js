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
  const logsDir = path.join(__dirname, "../logs/ownerMint");
  const tokensDir = path.join(__dirname, "../mintedTokens/ownerMint");

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
  logger.log("📍 Minter address:", owner.address);
  
  const collectionAddress = "0x0000000000000000000000000000000000000000"; 
  const Collection = await ethers.getContractAt( "ERC721ACollection", collectionAddress);

  logger.log("🔗 Connected to collection:", Collection.target);
  logger.log("👤 Minter (owner):", owner.address);

  // === Your hardcoded metadata URIs from Pinata
  const uris = [
    "https://tan-informal-minnow-205.mypinata.cloud/ipfs/bafkreicerhdkhej67nvxo2nzy7rn5rj3awn7smibw2x33mfrwpwdrkaecu", // Add your actual URIs here
    "https://tan-informal-minnow-205.mypinata.cloud/ipfs/bafkreibek34lpugsck64ihcvtetinh6r5vctugcpzusf3bem2qw4sqhyoe",
    "https://tan-informal-minnow-205.mypinata.cloud/ipfs/bafkreiehvm4ppipmm3uiaprk3y2j3dzmbcw7azhohuhtz5mdwcslt3tire",
    "https://tan-informal-minnow-205.mypinata.cloud/ipfs/bafkreihcq5sx4rtu662ewfxmwui4zjaww6zdb2wulpqfbuu42khfawa5ju" // Add additional URIs as needed
  ];

  logger.log("🧾 Minting", uris.length, "NFTs...");

  // Execute the ownerMint transaction
  const tx = await Collection.ownerMint(owner.address, uris.length, uris);
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

  // Get the starting token ID for the newly minted tokens
  const totalSupply = await Collection.totalSupply();
  const startId = totalSupply - BigInt(uris.length);

  // Create comprehensive summary for minted tokens
  const timestamp = new Date().toISOString();
  let mintedTable = `# 🧾 Owner Mint Summary\n\n`;
  mintedTable += `## General Information\n\n`;
  mintedTable += `- **Collection Address:** \`${Collection.target}\`\n`;
  mintedTable += `- **Transaction Hash:** \`${receipt.hash}\`\n`;
  mintedTable += `- **Block Number:** ${receipt.blockNumber}\n`;
  mintedTable += `- **Block Timestamp:** ${timestamp}\n`;
  mintedTable += `- **Minter Address (Owner):** \`${owner.address}\`\n`;
  mintedTable += `- **Total Tokens Minted:** ${uris.length}\n`;
  
  
  mintedTable += `\n## Minted Tokens\n\n`;
  mintedTable += `| Token ID | Owner | URI | Metadata Type |\n`;
  mintedTable += `|----------|-------|-----|---------------|\n`;

  // Add each token to the table with detailed information
  for (let i = 0n; i < BigInt(uris.length); i++) {
    const tokenId = startId + i;
    const uri = await Collection.tokenURI(tokenId);
    let metadataType = "Unknown";
    
    // Determine metadata type based on URI
    if (uri.startsWith("ipfs://")) {
      metadataType = "IPFS";
    } else if (uri.startsWith("http")) {
      metadataType = "HTTP";
    } else if (uri.startsWith("ar://")) {
      metadataType = "Arweave";
    } else if (uri.startsWith("data:")) {
      metadataType = "Data URI";
    }
    
    logger.log(`🏷️ Token ${tokenId} URI:`, uri);
    mintedTable += `| ${tokenId} | \`${owner.address}\` | \`${uri}\` | ${metadataType} |\n`;
  }

  // Additional contract information if available
  try {
    const name = await Collection.name();
    const symbol = await Collection.symbol();
    const maxSupply = await Collection.maxSupply();
    
    mintedTable += `\n## **Collection Information**\n\n`;
    mintedTable += `- **Name:** ${name}\n`;
    mintedTable += `- **Symbol:** ${symbol}\n`;
    mintedTable += `- **Max Supply:** ${maxSupply.toString()}\n`;
    mintedTable += `- **Current Supply:** ${totalSupply.toString()}\n`;
  } catch (err) {
    logger.log("⚠️ Could not fetch additional collection information:", err.message);
  }

  fs.writeFileSync(tokenPath, mintedTable);

  logger.log("📄 **Mint report saved to:**", tokenPath);
  
  // Log transaction cost details at the end
  logger.log("💹 **Transaction Cost Summary:**");
  logger.log("⛽ Gas used:", receipt.gasUsed.toString(), "units");
  logger.log("💰 Gas price:", formatEther(receipt.gasPrice || receipt.effectiveGasPrice), "NATIVE");
  logger.log("💸 Total transaction cost:", formatEther(receipt.gasUsed * (receipt.gasPrice || receipt.effectiveGasPrice)), "NATIVE");
  
  logger.log("✅ **ownerMint completed successfully!**");
  logger.close();
}

main().catch((err) => {
  console.error("❌ Owner mint failed:", err);
  process.exit(1);
});