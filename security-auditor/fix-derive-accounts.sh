#!/bin/bash

echo "Adding missing #[derive(Accounts)] to Context structs..."

# Fix defai_staking
echo "Fixing defai_staking..."
sed -i '' 's/pub struct StakeTokens/#[derive(Accounts)]\npub struct StakeTokens/' defai_staking/src/lib.rs
sed -i '' 's/pub struct UnstakeTokens/#[derive(Accounts)]\npub struct UnstakeTokens/' defai_staking/src/lib.rs
sed -i '' 's/pub struct ClaimRewards/#[derive(Accounts)]\npub struct ClaimRewards/' defai_staking/src/lib.rs

# Fix defai_estate
echo "Fixing defai_estate..."
sed -i '' 's/pub struct ClaimToken/#[derive(Accounts)]\npub struct ClaimToken/' defai_estate/src/lib.rs
sed -i '' 's/pub struct ClaimNFT/#[derive(Accounts)]\npub struct ClaimNFT/' defai_estate/src/lib.rs

# Fix any other missing derives (generic pattern)
for file in defai_*/src/lib.rs; do
    echo "Checking $file for Context structs..."
    # Add derive to any pub struct that has Context fields but no derive
    perl -i -pe 's/^(pub struct \w+<.*?>\s*\{[^}]*Context)/#[derive(Accounts)]\n$1/gm' "$file"
done

echo "Done! Now try building again."