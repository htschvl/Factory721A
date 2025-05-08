const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");
const { formatEther, keccak256, toUtf8Bytes } = require("ethers");
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

async function main() {
  const logsDir = path.join(__dirname, "../logs/createCollection");
  const addrDir = path.join(__dirname, "../addresses/createCollection");

  const { index, logPath, addrPath } = getNextIndexedFilePair(
    logsDir,
    addrDir,
    "createCollection",
    "Log.md",
    "Address.md"
  );

  const logger = createLogger(logPath);
  logger.log(box(`🎯 Iniciando Deploy (Index ${index})`).top);

  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);
  logger.log(section("📡 Contexto do Deploy"));
  logger.log("  Criador:       ", deployer.address);
  logger.log("  Saldo (ETH):   ", formatEther(balance));

  const factoryAddress = "0x0000000000000000000000000000000000000000";
  const Factory = await ethers.getContractFactory("ERC721AFactory");
  const factory = Factory.attach(factoryAddress);

  const code = await ethers.provider.getCode(factoryAddress);
  if (code === "0x") throw new Error("❌ No contract found at factoryAddress");

  logger.log(section("🏗️  Factory"));
  logger.log("  Endereço:      ", factoryAddress);
  logger.log("  Bytecode OK:   ", code !== "0x" ? "✅" : "❌");

  const name = "Test";
  const symbol = "TST";
  const baseURI = "";
  const maxSupply = 100;
  const pricePerToken = 100;
  const accessCode = "";
  const accessCodeHash = keccak256(toUtf8Bytes(accessCode));

  logger.log(section("📝 Configuração da Collection"));
  logger.log("  Nome:          ", name);
  logger.log("  Símbolo:       ", symbol);
  logger.log("  Base URI:      ", baseURI || "(vazio)");
  logger.log("  Max Supply:    ", maxSupply);
  logger.log("  Preço:         ", formatEther(pricePerToken), "ETH");
  logger.log("  Access Hash:   ", accessCodeHash);

  const tx = await factory.createCollection(
    name,
    symbol,
    baseURI,
    maxSupply,
    pricePerToken,
    accessCode
  );

  const receipt = await tx.wait();
  logger.log(section("📤 Transação"));
  logger.log("  TX hash:       ", receipt.hash);

  let collectionAddress;

  logger.log(section("📦 Eventos Emitidos"));
  for (const log of receipt.logs) {
    try {
      const parsed = factory.interface.parseLog(log);
      if (parsed.name === "CollectionCreated") {
        collectionAddress = parsed.args[1];
        logger.log("  ✅ CollectionCreated:", collectionAddress);
        break;
      }
    } catch {
      continue;
    }
  }

  if (!collectionAddress) {
    throw new Error("❌ Event not found: CollectionCreated");
  }

  const Collection = await ethers.getContractAt("ERC721ACollection", collectionAddress);
  logger.log(section("🔍 On-chain Verification"));
  logger.log("  name():         ", await Collection.name());
  logger.log("  symbol():       ", await Collection.symbol());
  logger.log("  pricePerToken():", formatEther(await Collection.pricePerToken()), "ETH");
  logger.log("  maxSupply():    ", (await Collection.maxSupply()).toString());
  logger.log("  baseURI():      ", await Collection.baseURI());
  logger.log("  accessHash():   ", await Collection.accessCodeHash());

  const gasPrice = receipt.effectiveGasPrice ?? receipt.gasPrice;
  logger.log(section("💹 Custo da Transação"));
  logger.log("  Gás usado:      ", receipt.gasUsed.toString(), "units");
  logger.log("  Gás price:      ", formatEther(gasPrice), "NATIVE");
  logger.log("  Custo total:    ", formatEther(gasPrice * receipt.gasUsed), "NATIVE");

  const content = `Collection Address (Instance ${index})\n\n` +
                  `Contract Address: \`${collectionAddress}\`\n\n` +
                  `Transaction Hash: \`${receipt.hash}\`\n`;

  fs.writeFileSync(addrPath, content);

  logger.log(section("📦 Output"));
  logger.log("  Endereço salvo:", addrPath);
  logger.log("✅ Collection criada com sucesso");
  logger.close();
}

main().catch((err) => {
  console.error("❌ Error during collection creation:", err);
  process.exit(1);
});
