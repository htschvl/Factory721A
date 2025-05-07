const fs = require("fs");
const path = require("path");
const { execSync, spawnSync } = require("child_process");
const { ethers } = require("hardhat");
const { expect } = require("chai");

function getLastFileMatching(dir, prefix, suffix) {
  const files = fs.readdirSync(dir)
    .filter(f => f.startsWith(prefix) && f.endsWith(suffix))
    .map(f => ({
      file: f,
      mtime: fs.statSync(path.join(dir, f)).mtime
    }))
    .sort((a, b) => b.mtime - a.mtime);
  return files.length ? path.join(dir, files[0].file) : null;
}

describe("🔍 Script execution and log validation (mocked)", function () {
  this.timeout(40000);

  let factory, collectionAddress;

before(async () => {
    const [deployer] = await ethers.getSigners();
  
    const Factory = await ethers.getContractFactory("ERC721AFactory");
    factory = await Factory.deploy();
    await factory.waitForDeployment();
  
    const tx = await factory.createCollection(
      "TestMock",                             // name
      "TST",                                  // symbol
      "https://mockbase/",                    // baseURI
      10,                                     // maxSupply
      ethers.parseEther("0.01"),              // pricePerToken
      "access"                                // accessCode (will be hashed internally)
    );
  
    const receipt = await tx.wait();
  
    const parsed = receipt.logs
      .map(log => {
        try {
          return factory.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find(e => e && e.name === "CollectionCreated");
  
    expect(parsed, "CollectionCreated event not found").to.not.be.null;
  
    collectionAddress = parsed.args.collection;
    expect(collectionAddress).to.properAddress;
  });
  

  function runScriptMocked(filePath, logsDir, outputDir, logPrefix, logSuffix, outSuffix) {
    const env = {
      ...process.env,
      COLLECTION_ADDRESS: collectionAddress
    };

    const result = spawnSync("npx", ["hardhat", "run", filePath, "--network", "hardhat"], {
      env,
      encoding: "utf-8"
    });

    console.log(result.stdout);
    console.error(result.stderr);

    const logFile = getLastFileMatching(logsDir, logPrefix, logSuffix);
    const outFile = getLastFileMatching(outputDir, logPrefix, outSuffix);

    expect(logFile, `Missing log: ${logPrefix}`).to.be.a("string");
    expect(fs.existsSync(logFile)).to.be.true;

    expect(outFile, `Missing output: ${logPrefix}`).to.be.a("string");
    expect(fs.existsSync(outFile)).to.be.true;

    const content = fs.readFileSync(outFile, "utf8");
    if (logPrefix.includes("Mint")) {
        expect(content).to.match(/Token|URI/i);
      } else if (logPrefix.includes("foundMinted")) {
        expect(content).to.match(/Owner:|URI:/i);
      }
      
  }

  it("runs ownerMint.js mocked", () => {
    runScriptMocked("scripts/ownerMint.js", "logs", "minted", "ownerMint", "Log.md", "Minted.md");
  });

  it("runs publicMint.js mocked", () => {
    runScriptMocked("scripts/publicMint.js", "logs", "minted", "publicMint", "Log.md", "Minted.md");
  });

  it("runs findMintedTokenInfo.js mocked", () => {
    runScriptMocked("scripts/findMintedTokenInfo.js", "logs", "addresses", "foundMintedTokenInfo", "Log.md", ".md");
  });
  it("runs createCollection.js mocked", () => {
    runScriptMocked("scripts/createCollection.js", "logs", "addresses", "createCollection", "Log.md", "Address.md");
  });  
});
