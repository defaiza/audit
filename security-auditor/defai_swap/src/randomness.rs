use anchor_lang::prelude::*;
use anchor_lang::solana_program::keccak;

/// Improved randomness using multiple sources of entropy
/// This is a practical improvement over the current implementation
/// For production, consider integrating Switchboard VRF
pub fn generate_secure_random(
    user: &Pubkey,
    nft_mint: &Pubkey,
    clock: &Clock,
    recent_blockhash: &[u8; 32],
) -> u64 {
    // Combine multiple sources of entropy
    let mut data = Vec::new();
    
    // User's public key (32 bytes)
    data.extend_from_slice(&user.to_bytes());
    
    // NFT mint public key (32 bytes)
    data.extend_from_slice(&nft_mint.to_bytes());
    
    // Current timestamp (8 bytes)
    data.extend_from_slice(&clock.unix_timestamp.to_le_bytes());
    
    // Current slot (8 bytes)
    data.extend_from_slice(&clock.slot.to_le_bytes());
    
    // Recent blockhash (32 bytes)
    data.extend_from_slice(recent_blockhash);
    
    // Additional entropy from clock epoch
    data.extend_from_slice(&clock.epoch.to_le_bytes());
    
    // Hash all the data together
    let hash = keccak::hash(&data);
    
    // Convert first 8 bytes to u64
    let mut bytes = [0u8; 8];
    bytes.copy_from_slice(&hash.to_bytes()[0..8]);
    u64::from_le_bytes(bytes)
}

/// Generate random number using VRF result
pub fn generate_vrf_random(
    vrf_result: &[u8; 32],
    user: &Pubkey,
    nft_mint: &Pubkey,
) -> u64 {
    // Combine VRF result with user/mint for uniqueness
    let mut data = Vec::new();
    
    // VRF result (32 bytes) - cryptographically secure randomness
    data.extend_from_slice(vrf_result);
    
    // User's public key (32 bytes) - ensures different values per user
    data.extend_from_slice(&user.to_bytes());
    
    // NFT mint public key (32 bytes) - ensures different values per NFT
    data.extend_from_slice(&nft_mint.to_bytes());
    
    // Hash all the data together
    let hash = keccak::hash(&data);
    
    // Convert first 8 bytes to u64
    let mut bytes = [0u8; 8];
    bytes.copy_from_slice(&hash.to_bytes()[0..8]);
    u64::from_le_bytes(bytes)
}

/// Calculate bonus using improved randomness
pub fn calculate_random_bonus(
    random_value: u64,
    min_bonus: u16,
    max_bonus: u16,
) -> u16 {
    let bonus_range = max_bonus - min_bonus;
    if bonus_range == 0 {
        min_bonus
    } else {
        min_bonus + (random_value % (bonus_range as u64 + 1)) as u16
    }
}