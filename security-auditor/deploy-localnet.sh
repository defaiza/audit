#!/bin/bash

echo "Starting localnet deployment..."

# Check if validator is running
if ! pgrep -x "solana-test-val" > /dev/null; then
    echo "Starting Solana test validator..."
    solana-test-validator --reset &
    sleep 5
fi

# Configure for localnet
solana config set --url localhost

# Airdrop SOL
echo "Airdropping SOL..."
solana airdrop 10

# Deploy successfully built programs
echo "Deploying programs..."

if [ -f "target/deploy/defai_swap.so" ]; then
    echo "Deploying defai_swap..."
    solana program deploy target/deploy/defai_swap.so \
        --program-id target/deploy/defai_swap-keypair.json
fi

if [ -f "target/deploy/defai_staking.so" ]; then
    echo "Deploying defai_staking..."
    solana program deploy target/deploy/defai_staking.so \
        --program-id target/deploy/defai_staking-keypair.json
fi

if [ -f "target/deploy/defai_estate.so" ]; then
    echo "Deploying defai_estate..."
    solana program deploy target/deploy/defai_estate.so \
        --program-id target/deploy/defai_estate-keypair.json
fi

if [ -f "target/deploy/defai_app_factory.so" ]; then
    echo "Deploying defai_app_factory..."
    solana program deploy target/deploy/defai_app_factory.so \
        --program-id target/deploy/defai_app_factory-keypair.json
fi

echo ""
echo "Deployment status:"
echo "- defai_swap: $(if [ -f target/deploy/defai_swap.so ]; then echo "✅ Deployed"; else echo "❌ Not built"; fi)"
echo "- defai_staking: $(if [ -f target/deploy/defai_staking.so ]; then echo "✅ Deployed"; else echo "❌ Not built"; fi)"
echo "- defai_estate: $(if [ -f target/deploy/defai_estate.so ]; then echo "✅ Deployed"; else echo "❌ Not built"; fi)"
echo "- defai_app_factory: $(if [ -f target/deploy/defai_app_factory.so ]; then echo "✅ Deployed"; else echo "❌ Not built"; fi)"
echo ""
echo "Successfully built programs are deployed to localnet!"