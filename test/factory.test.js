const { expect } = require("chai");
const { ethers } = require("hardhat");
const { formatEther, parseEther } = require("ethers");

describe("ERC721AFactory + Collection Integration", function () {
  let factory;
  let owner, user1, user2;

  beforeEach(async () => {
    [owner, user1, user2] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("ERC721AFactory");
    factory = await Factory.deploy();
    await factory.waitForDeployment();

    const balance = await owner.provider.getBalance(owner.address);
    console.log("Deployer ETH balance:", formatEther(balance));
  });

  async function createCollection(name, symbol, baseURI, maxSupply, priceEth, accessCode) {
    const tx = await factory.createCollection(
      name,
      symbol,
      baseURI,
      maxSupply,
      parseEther(priceEth),
      accessCode
    );
  
    const receipt = await tx.wait();
  
    // Decode CollectionCreated event manually
    const event = receipt.logs
      .map(log => {
        try {
          return factory.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find(parsed => parsed && parsed.name === "CollectionCreated");
  
    if (!event) throw new Error("CollectionCreated event not found");
  
    const collectionAddress = event.args.collection;
    return await ethers.getContractAt("ERC721ACollection", collectionAddress);
  }
  

  it("deploys a collection with correct metadata", async () => {
    const collection = await createCollection("TestNFT", "TST", "ipfs://base/", 1000, "0", "");

    expect(await collection.name()).to.equal("TestNFT");
    expect(await collection.symbol()).to.equal("TST");
    expect(await collection.maxSupply()).to.equal(1000n);
    expect(await collection.pricePerToken()).to.equal(0n);
  });

  it("allows free public minting", async () => {
    const collection = await createCollection("FreeMint", "FREE", "https://free/", 10, "0", "");

    await collection.connect(user1).publicMint(2, "");
    expect(await collection.totalSupply()).to.equal(2n);
    expect(await collection.ownerOf(0)).to.equal(user1.address);
    expect(await collection.ownerOf(1)).to.equal(user1.address);
  });

  it("handles paid minting correctly", async () => {
    const collection = await createCollection("PaidMint", "PMT", "https://paid/", 100, "0.1", "");

    const tx = await collection.connect(user2).publicMint(2, "", {
      value: parseEther("0.2"),
    });
    await tx.wait();

    expect(await collection.totalSupply()).to.equal(2n);
    expect(await collection.ownerOf(0)).to.equal(user2.address);
  });

  it("reverts mint if underpaid", async () => {
    const collection = await createCollection("Underpay", "UP", "https://up/", 100, "0.1", "");

    await expect(
      collection.connect(user1).publicMint(1, "", {
        value: parseEther("0.05"),
      })
    ).to.be.revertedWith("Insufficient ETH sent"); // ✅ Correct string
    
  });

  it("enforces max supply", async () => {
    const collection = await createCollection("Capped", "CAP", "https://cap/", 3, "0", "");

    await collection.connect(user1).publicMint(3, "");
    await expect(collection.connect(user1).publicMint(1, "")).to.be.revertedWith("Max supply exceeded");
  });

  it("enforces access code if set", async () => {
    const code = "SECRET123";
    const collection = await createCollection("Secure", "SCR", "https://scr/", 100, "0", code);

    // correct code
    await collection.connect(user1).publicMint(1, code);

    // wrong code
    await expect(collection.connect(user2).publicMint(1, "wrong")).to.be.revertedWith("Invalid access code");
  });

  it("allows owner to mint with custom URIs", async () => {
    const collection = await createCollection("CustomURI", "CURI", "https://meta/", 0, "0", "");

    const uris = ["ipfs://uri1", "ipfs://uri2"];
    await collection.ownerMint(user1.address, 2, uris);

    expect(await collection.tokenURI(0)).to.equal("ipfs://uri1");
    expect(await collection.tokenURI(1)).to.equal("ipfs://uri2");
  });

  it("uses baseURI if no token URI set", async () => {
    const collection = await createCollection("Fallback", "FBK", "https://base/", 0, "0", "");

    await collection.ownerMint(user1.address, 1, []);
    expect(await collection.tokenURI(0)).to.equal("https://base/0");
  });

  it("allows updating price, supply, and base URI", async () => {
    const collection = await createCollection("Mutable", "MUT", "https://old/", 1, "0", "");

    await collection.setBaseURI("https://new/");
    await collection.setPrice(parseEther("0.05"));
    await collection.setMaxSupply(10);

    expect(await collection.baseURI()).to.equal("https://new/");
    expect(await collection.pricePerToken()).to.equal(parseEther("0.05"));
    expect(await collection.maxSupply()).to.equal(10n);
  });

  it("allows owner to withdraw funds", async () => {
    const collection = await createCollection("Withdraw", "WD", "https://w/", 100, "0.1", "");

    const tx = await collection.connect(user1).publicMint(2, "", {
      value: parseEther("0.2"),
    });
    await tx.wait();

    const before = await owner.provider.getBalance(owner.address);
    const withdrawTx = await collection.withdraw(owner.address);
    const receipt = await withdrawTx.wait();
    const gasUsed = receipt.gasUsed * receipt.gasPrice;
    const after = await owner.provider.getBalance(owner.address);

    expect(after > before - gasUsed).to.be.true;
  });
});
