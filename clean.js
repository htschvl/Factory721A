const fs = require("fs");
const path = require("path");

function clearDirectory(targetPath) {
  if (!fs.existsSync(targetPath)) {
    console.warn(`⚠️  Directory not found: ${targetPath}`);
    return;
  }

  const entries = fs.readdirSync(targetPath);
  for (const entry of entries) {
    const fullPath = path.join(targetPath, entry);
    const stat = fs.lstatSync(fullPath);

    if (stat.isDirectory()) {
      clearDirectory(fullPath);
      fs.rmdirSync(fullPath);
    } else {
      fs.unlinkSync(fullPath);
    }
  }

  console.log(`🧹 Cleared: ${path.relative(process.cwd(), targetPath)}`);
}

// Diretórios no mesmo nível do script
const targetDirs = ["addresses", "logs", "mintedTokens"];

for (const relativeDir of targetDirs) {
  const absolutePath = path.resolve(process.cwd(), relativeDir);
  clearDirectory(absolutePath);
}

console.log("✅ Workspace cleanup complete.");
