const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const { formatEther, parseEther } = require("ethers");
require("dotenv").config();


function getNextIndexedFilePair(logsDir, mintedDir, prefix, logSuffix, mintedSuffix) {
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  if (!fs.existsSync(mintedDir)) fs.mkdirSync(mintedDir, { recursive: true });

  const indexes = fs.readdirSync(logsDir)
    .map(f => f.match(new RegExp(`^${prefix}(\\d+)${logSuffix.replace('.', '\\.')}$`)))
    .filter(Boolean)
    .map(match => parseInt(match[1], 10));

  const nextIndex = indexes.length > 0 ? Math.max(...indexes) + 1 : 0;

  return {
    index: nextIndex,
    logPath: path.join(logsDir, `${prefix}${nextIndex}${logSuffix}`),
    mintedPath: path.join(mintedDir, `${prefix}${nextIndex}${mintedSuffix}`)
  };
}

function createLogger(filePath) {
  const stream = fs.createWriteStream(filePath, { flags: "a" });

  function log(...args) {
    const timestamp = `**[${new Date().toISOString()}]**`;
    const message = args.join(" ");
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
  const mintedDir = path.join(__dirname, "../minted");

  const { index, logPath, mintedPath } = getNextIndexedFilePair(
    logsDir,
    mintedDir,
    "foundMintedTokenInfo",
    "Log.md",
    ".md"
  );

  const logger = createLogger(logPath);

  logger.log(`# 📦 Token Inspection Log (Run ${index})`);

  const Collection = await ethers.getContractAt( "ERC721ACollection", string(process.env.CONTRACT_ADDRESS));

  logger.log("🔗 **Connected to Collection:**", process.env.CONTRACT_ADDRESS);


  const total = await Collection.totalSupply();
  console.log("🔢 Total tokens minted:", total.toString());

  let md = `# 🧾 Minted Tokens Summary\n\n`;
  md += `**Collection Address:** \`${collectionAddress}\`\n\n`;
  md += `| Token ID | Owner | URI |\n`;
  md += `|----------|--------|-----|\n`;

  for (let i = 0; i < total; i++) {
    const owner = await Collection.ownerOf(i);
    const uri = await Collection.tokenURI(i);

    logger.log(`📦 Token #${i}`);
    logger.log(`   👤 Owner: ${owner}`);
    logger.log(`   🌐 URI: ${uri}`);

    md += `| ${i} | \`${owner}\` | \`${uri}\` |\n`;
  }

  fs.writeFileSync(mintedPath, md);
  logger.log("📄 **Report saved to:**", mintedPath);
  logger.log("✅ **Token inspection complete**");

  logger.close();
}

main().catch(err => {
  console.error("❌ Failed to fetch token info:", err);
  process.exit(1);
});