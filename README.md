# NFT Infrastructure

This project implements an **ERC721A-based NFT factory system** deployed on the **Avalanche Fuji testnet**. It allows for the **on-chain creation of NFT collections**, followed by **minting NFTs into those collections**, with rich logging and per-token metadata support via IPFS (e.g. Pinata).

---

## 🏗️ Architecture Overview

- **Factory (`ERC721AFactory`)**  
  A smart contract that **creates and deploys new ERC721A NFT collections**, not individual NFTs.
  
- **Collection (`ERC721ACollection`)**  
  Each deployed collection is a fully independent ERC721A smart contract with:
  - Public and/or gated minting
  - Optional price and max supply
  - Per-token metadata URIs (e.g. Pinata IPFS links)

> 🧠 The factory does **not mint NFTs** — it only deploys new collection contracts.

Deployed factory address: ``0x6C487784150BBd6a1E7Cc145a998A20D42ADCe5D`` at Avalanche Fuji.

---

## 🔧 Requirements

- [Node.js](https://nodejs.org) v16+
- [Hardhat](https://hardhat.org/)
- Deployed `ERC721AFactory` contract on Fuji (already deployed)
- Pinata/IPFS-hosted metadata for NFT tokens

Install dependencies:
```bash
npm install ethers
```
---

## 🛠️ Scripts

### 1. 🚀 Create a New NFT Collection
This uses the factory to deploy a new ERC721A collection.

```bash
npx hardhat run scripts/createCollection.js --network fuji
```

✏️ Collection settings (name, symbol, supply, etc.) are hardcoded in the script for consistency. You can modify them in ```createCollection.js.```

🧾 Output:

- Logs are saved to scripts/create-collection-log.txt

- Contract address is written to scripts/last-collection-address.txt

---

### 2. 🎨 Mint NFTs to Yourself with Custom Metadata URIs

This script uses the ```ownerMint()``` function to mint NFTs with hardcoded full metadata URLs (e.g., IPFS links from Pinata).

```bash
npx hardhat run scripts/ownerMintWithURIs.js --network fuji
```

🧾 Output:

- Logs are saved to scripts/owner-mint-log.txt

- Each token URI and ownership is printed

---
