#!/bin/bash

# Script de limpeza para projeto Hardhat com Yarn Berry
# Uso:
#   ./limpar.sh        -> Apenas remove arquivos temporários
#   ./limpar.sh reinstal -> Remove e reinstala dependências

echo "🔄 Iniciando limpeza do projeto..."

yarn hardhat clean
yarn clean

# Remover diretórios e arquivos temporários
rm -rf \
  node_modules \
  yarn.lock \
  .pnp.cjs \
  .pnp.loader.mjs \
  .yarn/cache \
  .yarn/install-state.gz \
  .yarn/unplugged \
  .yarn/build-state.yml \
  .yarn/sdks \
  .yarn/patches \
  .yarn/releases \
  .yarn/plugins \
  .yarn/versions \
  .hardhat \
  cache \
  artifacts \
  typechain-types \
  coverage \
  coverage.json \
  dist \
  build \
  node_modules \

echo "✅ Limpeza concluída."

# Reinstalar dependências se o argumento 'reinstall' for fornecido
if [ "$1" == "reinstall" ]; then
  echo "📦 Reinstalando dependências..."
  yarn install
  echo "✅ Reinstalação concluída."
fi
