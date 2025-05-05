const { ethers } = require("hardhat");

async function main() {
  const Collection = await ethers.getContractAt(
    "ERC721ACollection",
    "0x180a3dc6CE1E951Fb627749CA71B816f4a81f8F9"
  );

  const total = await Collection.totalSupply();
  console.log("🔢 Total tokens minted:", total.toString());

  for (let i = 0; i < total; i++) {
    const owner = await Collection.ownerOf(i);
    const uri = await Collection.tokenURI(i);
    console.log(`📦 Token #${i}`);
    console.log(`   👤 Owner: ${owner}`);
    console.log(`   🌐 URI: ${uri}`);
  }
}

main().catch(console.error);
