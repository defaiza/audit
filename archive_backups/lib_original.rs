use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("5uSkqdymvdisnz5542buDEoriDsvopAwym9WpccuTpjg");

pub const ESTATE_SEED: &[u8] = b"estate";
pub const RWA_SEED: &[u8] = b"rwa";
pub const COUNTER_SEED: &[u8] = b"counter";
pub const CLAIM_SEED: &[u8] = b"claim";
pub const ASSET_SUMMARY_SEED: &[u8] = b"asset_summary";
pub const RECOVERY_SEED: &[u8] = b"recovery";

pub const MIN_INACTIVITY_PERIOD: i64 = 24 * 60 * 60; // 24 hours in seconds
pub const MAX_INACTIVITY_PERIOD: i64 = 300 * 365 * 24 * 60 * 60; // 300 years in seconds
pub const MIN_GRACE_PERIOD: i64 = 24 * 60 * 60; // 24 hours in seconds
pub const MAX_GRACE_PERIOD: i64 = 90 * 24 * 60 * 60; // 90 days in seconds
pub const MAX_BENEFICIARIES: u8 = 10;
pub const ESTATE_FEE: u64 = 100_000_000; // 0.1 SOL
pub const RWA_FEE: u64 = 10_000_000; // 0.01 SOL
pub const MIN_RENT_BALANCE: u64 = 890880; // Minimum rent-exempt balance for a basic account

#[program]
pub mod defai_estate {
    use super::*;

    pub fn initialize_global_counter(ctx: Context<InitializeGlobalCounter>) -> Result<()> {
        let global_counter = &mut ctx.accounts.global_counter;
        global_counter.count = 0;
        
        msg!("Global counter initialized");
        Ok(())
    }

    pub fn create_estate(
        ctx: Context<CreateEstate>,
        inactivity_period: i64,
        grace_period: i64,
        owner_email_hash: [u8; 32],
    ) -> Result<()> {
        require!(
            inactivity_period >= MIN_INACTIVITY_PERIOD && inactivity_period <= MAX_INACTIVITY_PERIOD,
            EstateError::InvalidInactivityPeriod
        );
        require!(
            grace_period >= MIN_GRACE_PERIOD && grace_period <= MAX_GRACE_PERIOD,
            EstateError::InvalidGracePeriod
        );

        let estate = &mut ctx.accounts.estate;
        let clock = Clock::get()?;
        
        estate.estate_id = ctx.accounts.estate_mint.key();
        estate.owner = ctx.accounts.owner.key();
        estate.owner_email_hash = owner_email_hash;
        estate.last_active = clock.unix_timestamp;
        estate.inactivity_period = inactivity_period;
        estate.grace_period = grace_period;
        estate.beneficiaries = Vec::new();
        estate.total_beneficiaries = 0;
        estate.creation_time = clock.unix_timestamp;
        estate.estate_value = 0;
        estate.is_locked = false;
        estate.is_claimable = false;
        estate.total_rwas = 0;
        estate.estate_number = ctx.accounts.global_counter.count;
        estate.total_claims = 0;

        // Update global counter
        ctx.accounts.global_counter.count += 1;

        msg!("Estate #{} created", estate.estate_number);

        Ok(())
    }

    pub fn check_in(ctx: Context<CheckIn>) -> Result<()> {
        let estate = &mut ctx.accounts.estate;
        let clock = Clock::get()?;

        require!(!estate.is_locked, EstateError::EstateLocked);
        require!(
            ctx.accounts.owner.key() == estate.owner,
            EstateError::UnauthorizedAccess
        );

        estate.last_active = clock.unix_timestamp;
        estate.is_claimable = false;

        msg!("Estate check-in successful. Timer reset.");

        Ok(())
    }

    pub fn update_beneficiaries(
        ctx: Context<UpdateBeneficiaries>,
        beneficiaries: Vec<Beneficiary>,
    ) -> Result<()> {
        let estate = &mut ctx.accounts.estate;

        require!(!estate.is_locked, EstateError::EstateLocked);
        require!(!estate.is_claimable, EstateError::EstateClaimable);
        require!(
            ctx.accounts.owner.key() == estate.owner,
            EstateError::UnauthorizedAccess
        );
        require!(
            beneficiaries.len() <= MAX_BENEFICIARIES as usize,
            EstateError::TooManyBeneficiaries
        );

        // Validate percentages sum to 100
        let total_percentage: u8 = beneficiaries.iter().map(|b| b.share_percentage).sum();
        require!(
            total_percentage == 100,
            EstateError::InvalidBeneficiaryShares
        );

        estate.beneficiaries = beneficiaries;
        estate.total_beneficiaries = estate.beneficiaries.len() as u8;

        msg!("Updated {} beneficiaries", estate.total_beneficiaries);

        Ok(())
    }

    pub fn create_rwa(
        ctx: Context<CreateRWA>,
        rwa_type: String,
        name: String,
        description: String,
        value: String,
        metadata_uri: String,
    ) -> Result<()> {
        let estate = &mut ctx.accounts.estate;
        let rwa = &mut ctx.accounts.rwa;
        
        require!(!estate.is_locked, EstateError::EstateLocked);
        require!(!estate.is_claimable, EstateError::EstateClaimable);
        require!(
            ctx.accounts.owner.key() == estate.owner,
            EstateError::UnauthorizedAccess
        );

        // Initialize RWA account
        rwa.estate = estate.key();
        rwa.rwa_type = rwa_type;
        rwa.name = name;
        rwa.description = description;
        rwa.value = value;
        rwa.metadata_uri = metadata_uri;
        rwa.created_at = Clock::get()?.unix_timestamp;
        rwa.is_active = true;
        rwa.rwa_number = estate.total_rwas;
        rwa.current_owner = estate.owner;

        estate.total_rwas += 1;

        msg!("RWA #{} created for Estate #{}", rwa.rwa_number, estate.estate_number);

        Ok(())
    }

    pub fn delete_rwa(ctx: Context<DeleteRWA>) -> Result<()> {
        let estate = &ctx.accounts.estate;
        let rwa = &mut ctx.accounts.rwa;
        
        require!(!estate.is_locked, EstateError::EstateLocked);
        require!(!estate.is_claimable, EstateError::EstateClaimable);
        require!(
            ctx.accounts.owner.key() == estate.owner,
            EstateError::UnauthorizedAccess
        );
        require!(
            rwa.estate == estate.key(),
            EstateError::UnauthorizedAccess
        );
        require!(rwa.is_active, EstateError::RWAAlreadyDeleted);

        // Mark RWA as inactive (soft delete)
        rwa.is_active = false;

        msg!("RWA #{} deleted from Estate #{}", rwa.rwa_number, estate.estate_number);

        Ok(())
    }

    pub fn scan_estate_assets(ctx: Context<ScanEstateAssets>) -> Result<()> {
        let estate = &ctx.accounts.estate;
        let asset_summary = &mut ctx.accounts.asset_summary;
        
        // Initialize asset summary
        asset_summary.estate = estate.key();
        asset_summary.scan_time = Clock::get()?.unix_timestamp;
        asset_summary.sol_balance = ctx.accounts.estate.to_account_info().lamports();
        asset_summary.total_rwas = estate.total_rwas;
        asset_summary.active_rwas = 0;
        
        // Count active RWAs (in a real implementation, we'd iterate through them)
        // For now, we'll set this in the frontend by fetching RWAs
        
        msg!(
            "Asset scan complete. SOL: {}, Total RWAs: {}",
            asset_summary.sol_balance,
            asset_summary.total_rwas
        );

        Ok(())
    }

    pub fn trigger_inheritance(ctx: Context<TriggerInheritance>) -> Result<()> {
        let estate = &mut ctx.accounts.estate;
        let clock = Clock::get()?;

        require!(!estate.is_locked, EstateError::EstateLocked);
        require!(!estate.is_claimable, EstateError::AlreadyClaimable);

        let inactive_since = estate.last_active + estate.inactivity_period;
        let grace_ends = inactive_since + estate.grace_period;

        require!(
            clock.unix_timestamp > grace_ends,
            EstateError::NotYetClaimable
        );

        estate.is_claimable = true;

        msg!("Estate is now claimable by beneficiaries");

        Ok(())
    }

    pub fn claim_inheritance(
        ctx: Context<ClaimInheritance>,
        beneficiary_index: u8,
    ) -> Result<()> {
        let estate = &mut ctx.accounts.estate;
        
        require!(estate.is_claimable, EstateError::NotClaimable);
        require!(
            beneficiary_index < estate.total_beneficiaries,
            EstateError::InvalidBeneficiaryIndex
        );

        let beneficiary = &mut estate.beneficiaries[beneficiary_index as usize];
        
        require!(
            beneficiary.address == ctx.accounts.beneficiary.key(),
            EstateError::UnauthorizedBeneficiary
        );
        require!(!beneficiary.claimed, EstateError::AlreadyClaimed);

        beneficiary.claimed = true;

        msg!(
            "Beneficiary {} claimed {}% of estate",
            beneficiary.address,
            beneficiary.share_percentage
        );

        Ok(())
    }

    pub fn claim_inheritance_v2(
        ctx: Context<ClaimInheritanceV2>,
        beneficiary_index: u8,
    ) -> Result<()> {
        // First, validate the estate state and get needed values
        let estate_key = ctx.accounts.estate.key();
        let beneficiary_key = ctx.accounts.beneficiary.key();
        
        {
            let estate = &ctx.accounts.estate;
            require!(estate.is_claimable, EstateError::NotClaimable);
            require!(
                beneficiary_index < estate.total_beneficiaries,
                EstateError::InvalidBeneficiaryIndex
            );
            
            let beneficiary = &estate.beneficiaries[beneficiary_index as usize];
            require!(
                beneficiary.address == beneficiary_key,
                EstateError::UnauthorizedBeneficiary
            );
            require!(!beneficiary.claimed, EstateError::AlreadyClaimed);
        }

        // Get share percentage before mutable borrow
        let share_percentage = ctx.accounts.estate.beneficiaries[beneficiary_index as usize].share_percentage;

        // Calculate SOL to transfer
        let estate_balance = ctx.accounts.estate.to_account_info().lamports();
        let transferable_balance = estate_balance.saturating_sub(MIN_RENT_BALANCE);
        let sol_share = (transferable_balance as u128)
            .checked_mul(share_percentage as u128)
            .unwrap()
            .checked_div(100)
            .unwrap() as u64;

        // Transfer SOL to beneficiary
        if sol_share > 0 {
            **ctx.accounts.estate.to_account_info().try_borrow_mut_lamports()? -= sol_share;
            **ctx.accounts.beneficiary.to_account_info().try_borrow_mut_lamports()? += sol_share;
        }

        // Initialize claim record
        let claim_record = &mut ctx.accounts.claim_record;
        claim_record.estate = estate_key;
        claim_record.beneficiary = beneficiary_key;
        claim_record.claim_time = Clock::get()?.unix_timestamp;
        claim_record.sol_amount = sol_share;
        claim_record.share_percentage = share_percentage;
        claim_record.tokens_claimed = Vec::new();
        claim_record.nfts_claimed = Vec::new();

        // Mark as claimed
        let estate = &mut ctx.accounts.estate;
        estate.beneficiaries[beneficiary_index as usize].claimed = true;
        estate.total_claims += 1;

        msg!(
            "Beneficiary {} claimed {}% of estate. SOL transferred: {}",
            beneficiary_key,
            share_percentage,
            sol_share
        );

        Ok(())
    }

    pub fn transfer_rwa_ownership(
        ctx: Context<TransferRWAOwnership>,
        rwa_number: u32,
    ) -> Result<()> {
        let estate = &ctx.accounts.estate;
        let rwa = &mut ctx.accounts.rwa;
        let claim_record = &ctx.accounts.claim_record;
        
        require!(estate.is_claimable, EstateError::NotClaimable);
        require!(
            claim_record.estate == estate.key(),
            EstateError::InvalidClaimRecord
        );
        require!(
            claim_record.beneficiary == ctx.accounts.beneficiary.key(),
            EstateError::UnauthorizedBeneficiary
        );
        require!(
            rwa.estate == estate.key(),
            EstateError::InvalidRWA
        );
        require!(
            rwa.rwa_number == rwa_number,
            EstateError::InvalidRWA
        );
        require!(rwa.is_active, EstateError::RWAAlreadyDeleted);

        // Transfer ownership
        rwa.current_owner = ctx.accounts.beneficiary.key();

        msg!(
            "RWA #{} ownership transferred to {}",
            rwa_number,
            ctx.accounts.beneficiary.key()
        );

        Ok(())
    }

    pub fn claim_token(
        ctx: Context<ClaimToken>,
        beneficiary_index: u8,
    ) -> Result<()> {
        let estate = &ctx.accounts.estate;
        let claim_record = &mut ctx.accounts.claim_record;
        
        require!(estate.is_claimable, EstateError::NotClaimable);
        require!(
            beneficiary_index < estate.total_beneficiaries,
            EstateError::InvalidBeneficiaryIndex
        );
        
        let beneficiary = &estate.beneficiaries[beneficiary_index as usize];
        require!(
            beneficiary.address == ctx.accounts.beneficiary.key(),
            EstateError::UnauthorizedBeneficiary
        );
        require!(beneficiary.claimed, EstateError::MustClaimInheritanceFirst);
        
        // Check if this token was already claimed
        let token_mint = ctx.accounts.token_mint.key();
        for token_claim in &claim_record.tokens_claimed {
            require!(
                token_claim.mint != token_mint,
                EstateError::TokenAlreadyClaimed
            );
        }
        
        // Calculate share
        let estate_token_balance = ctx.accounts.estate_token_account.amount;
        let token_share = (estate_token_balance as u128)
            .checked_mul(beneficiary.share_percentage as u128)
            .unwrap()
            .checked_div(100)
            .unwrap() as u64;
        
        if token_share > 0 {
            // Transfer tokens
            let estate_number_bytes = estate.estate_number.to_le_bytes();
            let seeds = &[
                ESTATE_SEED,
                estate.owner.as_ref(),
                estate_number_bytes.as_ref(),
                &[ctx.bumps.estate]
            ];
            let signer = &[&seeds[..]];
            
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.estate_token_account.to_account_info(),
                    to: ctx.accounts.beneficiary_token_account.to_account_info(),
                    authority: ctx.accounts.estate.to_account_info(),
                },
                signer,
            );
            
            token::transfer(cpi_ctx, token_share)?;
            
            // Record the claim
            claim_record.tokens_claimed.push(TokenClaim {
                mint: token_mint,
                amount: token_share,
            });
        }
        
        msg!(
            "Beneficiary {} claimed {} tokens of mint {}",
            beneficiary.address,
            token_share,
            token_mint
        );
        
        Ok(())
    }

    pub fn claim_nft(
        ctx: Context<ClaimNFT>,
        beneficiary_index: u8,
    ) -> Result<()> {
        let estate = &ctx.accounts.estate;
        let claim_record = &mut ctx.accounts.claim_record;
        
        require!(estate.is_claimable, EstateError::NotClaimable);
        require!(
            beneficiary_index < estate.total_beneficiaries,
            EstateError::InvalidBeneficiaryIndex
        );
        
        let beneficiary = &estate.beneficiaries[beneficiary_index as usize];
        require!(
            beneficiary.address == ctx.accounts.beneficiary.key(),
            EstateError::UnauthorizedBeneficiary
        );
        require!(beneficiary.claimed, EstateError::MustClaimInheritanceFirst);
        
        // Check if this NFT was already claimed
        let nft_mint = ctx.accounts.nft_mint.key();
        for nft_claimed in &claim_record.nfts_claimed {
            require!(
                *nft_claimed != nft_mint,
                EstateError::NFTAlreadyClaimed
            );
        }
        
        // Verify estate owns exactly 1 of this NFT
        require!(
            ctx.accounts.estate_nft_account.amount == 1,
            EstateError::InvalidNFTAmount
        );
        
        // Transfer NFT
        let estate_number_bytes = estate.estate_number.to_le_bytes();
        let seeds = &[
            ESTATE_SEED,
            estate.owner.as_ref(),
            estate_number_bytes.as_ref(),
            &[ctx.bumps.estate]
        ];
        let signer = &[&seeds[..]];
        
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.estate_nft_account.to_account_info(),
                to: ctx.accounts.beneficiary_nft_account.to_account_info(),
                authority: ctx.accounts.estate.to_account_info(),
            },
            signer,
        );
        
        token::transfer(cpi_ctx, 1)?;
        
        // Record the claim
        claim_record.nfts_claimed.push(nft_mint);
        
        msg!(
            "Beneficiary {} claimed NFT {}",
            beneficiary.address,
            nft_mint
        );
        
        Ok(())
    }

    pub fn close_estate(ctx: Context<CloseEstate>) -> Result<()> {
        let estate = &ctx.accounts.estate;
        
        require!(estate.is_claimable, EstateError::NotClaimable);
        require!(
            estate.total_claims == estate.total_beneficiaries,
            EstateError::NotAllClaimed
        );

        msg!("Estate #{} closed", estate.estate_number);

        Ok(())
    }

    pub fn emergency_lock(ctx: Context<EmergencyLock>) -> Result<()> {
        let estate = &mut ctx.accounts.estate;
        
        require!(!estate.is_locked, EstateError::AlreadyLocked);
        require!(
            ctx.accounts.owner.key() == estate.owner,
            EstateError::UnauthorizedAccess
        );

        estate.is_locked = true;

        msg!("Estate emergency locked");

        Ok(())
    }

    pub fn emergency_unlock(
        ctx: Context<EmergencyUnlock>,
        _verification_code: [u8; 32],
    ) -> Result<()> {
        let estate = &mut ctx.accounts.estate;
        
        require!(estate.is_locked, EstateError::NotLocked);
        require!(
            ctx.accounts.owner.key() == estate.owner,
            EstateError::UnauthorizedAccess
        );

        // In production, verify the code
        estate.is_locked = false;

        msg!("Estate emergency unlocked");

        Ok(())
    }

    pub fn initiate_recovery(
        ctx: Context<InitiateRecovery>,
        reason: String,
    ) -> Result<()> {
        let estate = &ctx.accounts.estate;
        let recovery = &mut ctx.accounts.recovery;
        let clock = Clock::get()?;
        
        require!(estate.is_claimable, EstateError::NotClaimable);
        
        // Require estate to be claimable for at least 30 days
        let claimable_duration = clock.unix_timestamp - estate.last_active - estate.inactivity_period - estate.grace_period;
        require!(
            claimable_duration >= 30 * 24 * 60 * 60,
            EstateError::RecoveryTooEarly
        );
        
        // Initialize recovery
        recovery.estate = estate.key();
        recovery.initiator = ctx.accounts.admin.key();
        recovery.initiation_time = clock.unix_timestamp;
        recovery.reason = reason;
        recovery.is_executed = false;
        recovery.execution_time = clock.unix_timestamp + (7 * 24 * 60 * 60); // 7 day delay
        
        msg!("Recovery initiated for Estate #{}", estate.estate_number);
        
        Ok(())
    }

    pub fn execute_recovery(
        ctx: Context<ExecuteRecovery>,
    ) -> Result<()> {
        let recovery = &mut ctx.accounts.recovery;
        let estate = &mut ctx.accounts.estate;
        let clock = Clock::get()?;
        
        require!(!recovery.is_executed, EstateError::RecoveryAlreadyExecuted);
        require!(
            clock.unix_timestamp >= recovery.execution_time,
            EstateError::RecoveryNotReady
        );
        
        // Mark recovery as executed
        recovery.is_executed = true;
        
        // Transfer ownership to recovery address
        estate.owner = ctx.accounts.recovery_address.key();
        estate.is_claimable = false;
        estate.is_locked = false;
        
        // Reset beneficiaries
        estate.beneficiaries.clear();
        estate.total_beneficiaries = 0;
        
        msg!("Estate #{} recovered to {}", estate.estate_number, ctx.accounts.recovery_address.key());
        
        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Beneficiary {
    pub address: Pubkey,
    pub email_hash: [u8; 32],
    pub share_percentage: u8,
    pub claimed: bool,
    pub notification_sent: bool,
}

#[account]
pub struct Estate {
    pub estate_id: Pubkey,
    pub owner: Pubkey,
    pub owner_email_hash: [u8; 32],
    pub last_active: i64,
    pub inactivity_period: i64,
    pub grace_period: i64,
    pub beneficiaries: Vec<Beneficiary>,
    pub total_beneficiaries: u8,
    pub creation_time: i64,
    pub estate_value: u64,
    pub is_locked: bool,
    pub is_claimable: bool,
    pub total_rwas: u32,
    pub estate_number: u64,
    pub total_claims: u8,
}

#[account]
pub struct RWA {
    pub estate: Pubkey,
    pub rwa_type: String,    // e.g. "realEstate", "vehicle", "jewelry"
    pub name: String,
    pub description: String,
    pub value: String,
    pub metadata_uri: String,
    pub created_at: i64,
    pub is_active: bool,
    pub rwa_number: u32,
    pub current_owner: Pubkey,
}

#[account]
pub struct ClaimRecord {
    pub estate: Pubkey,
    pub beneficiary: Pubkey,
    pub claim_time: i64,
    pub sol_amount: u64,
    pub share_percentage: u8,
    pub tokens_claimed: Vec<TokenClaim>,
    pub nfts_claimed: Vec<Pubkey>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct TokenClaim {
    pub mint: Pubkey,
    pub amount: u64,
}

#[account]
pub struct AssetSummary {
    pub estate: Pubkey,
    pub scan_time: i64,
    pub sol_balance: u64,
    pub total_rwas: u32,
    pub active_rwas: u32,
    // In a full implementation, we'd add:
    // pub token_accounts: Vec<TokenInfo>,
    // pub nft_mints: Vec<Pubkey>,
}

#[account]
pub struct GlobalCounter {
    pub count: u64,
}

#[account]
pub struct Recovery {
    pub estate: Pubkey,
    pub initiator: Pubkey,
    pub initiation_time: i64,
    pub execution_time: i64,
    pub reason: String,
    pub is_executed: bool,
}

#[derive(Accounts)]
pub struct InitializeGlobalCounter<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        init,
        payer = authority,
        space = 8 + 8,
        seeds = [COUNTER_SEED],
        bump
    )]
    pub global_counter: Account<'info, GlobalCounter>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateEstate<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    
    #[account(
        init,
        payer = owner,
        space = 8 + 32 + 32 + 32 + 8 + 8 + 8 + (4 + (MAX_BENEFICIARIES as usize * 97)) + 1 + 8 + 8 + 1 + 1 + 4 + 8 + 1,
        seeds = [ESTATE_SEED, owner.key().as_ref(), global_counter.count.to_le_bytes().as_ref()],
        bump
    )]
    pub estate: Account<'info, Estate>,
    
    #[account(
        init,
        payer = owner,
        mint::decimals = 0,
        mint::authority = estate,
        mint::freeze_authority = estate,
    )]
    pub estate_mint: Account<'info, Mint>,
    
    #[account(
        init,
        payer = owner,
        associated_token::mint = estate_mint,
        associated_token::authority = owner
    )]
    pub owner_estate_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [COUNTER_SEED],
        bump
    )]
    pub global_counter: Account<'info, GlobalCounter>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct CreateRWA<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    
    #[account(
        mut,
        has_one = owner,
    )]
    pub estate: Account<'info, Estate>,
    
    #[account(
        init,
        payer = owner,
        space = 8 + 32 + (4 + 32) + (4 + 64) + (4 + 256) + (4 + 32) + (4 + 256) + 8 + 1 + 4 + 32,
        seeds = [RWA_SEED, estate.key().as_ref(), estate.total_rwas.to_le_bytes().as_ref()],
        bump
    )]
    pub rwa: Account<'info, RWA>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DeleteRWA<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    
    #[account(
        has_one = owner,
    )]
    pub estate: Account<'info, Estate>,
    
    #[account(mut)]
    pub rwa: Account<'info, RWA>,
}

#[derive(Accounts)]
pub struct ScanEstateAssets<'info> {
    #[account(mut)]
    pub scanner: Signer<'info>,
    
    pub estate: Account<'info, Estate>,
    
    #[account(
        init,
        payer = scanner,
        space = 8 + 32 + 8 + 8 + 4 + 4,
        seeds = [ASSET_SUMMARY_SEED, estate.key().as_ref()],
        bump
    )]
    pub asset_summary: Account<'info, AssetSummary>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CheckIn<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    
    #[account(
        mut,
        has_one = owner,
    )]
    pub estate: Account<'info, Estate>,
}

#[derive(Accounts)]
pub struct UpdateBeneficiaries<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    
    #[account(
        mut,
        has_one = owner,
    )]
    pub estate: Account<'info, Estate>,
}

#[derive(Accounts)]
pub struct TriggerInheritance<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,
    
    #[account(mut)]
    pub estate: Account<'info, Estate>,
}

#[derive(Accounts)]
pub struct ClaimInheritance<'info> {
    #[account(mut)]
    pub beneficiary: Signer<'info>,
    
    #[account(mut)]
    pub estate: Account<'info, Estate>,
}

#[derive(Accounts)]
pub struct ClaimInheritanceV2<'info> {
    #[account(mut)]
    pub beneficiary: Signer<'info>,
    
    #[account(mut)]
    pub estate: Account<'info, Estate>,
    
    #[account(
        init,
        payer = beneficiary,
        space = 8 + 32 + 32 + 8 + 8 + 1 + (4 + 10 * 40) + (4 + 10 * 32),
        seeds = [CLAIM_SEED, estate.key().as_ref(), beneficiary.key().as_ref()],
        bump
    )]
    pub claim_record: Account<'info, ClaimRecord>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct TransferRWAOwnership<'info> {
    #[account(mut)]
    pub beneficiary: Signer<'info>,
    
    #[account(
        has_one = beneficiary @ EstateError::UnauthorizedBeneficiary,
    )]
    pub claim_record: Account<'info, ClaimRecord>,
    
    pub estate: Account<'info, Estate>,
    
    #[account(mut)]
    pub rwa: Account<'info, RWA>,
}

#[derive(Accounts)]
pub struct ClaimToken<'info> {
    #[account(mut)]
    pub beneficiary: Signer<'info>,
    
    #[account(
        seeds = [ESTATE_SEED, estate.owner.as_ref(), estate.estate_number.to_le_bytes().as_ref()],
        bump
    )]
    pub estate: Account<'info, Estate>,
    
    #[account(
        mut,
        has_one = beneficiary @ EstateError::UnauthorizedBeneficiary,
        has_one = estate @ EstateError::InvalidClaimRecord,
    )]
    pub claim_record: Account<'info, ClaimRecord>,
    
    pub token_mint: Account<'info, Mint>,
    
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = estate,
    )]
    pub estate_token_account: Account<'info, TokenAccount>,
    
    #[account(
        init_if_needed,
        payer = beneficiary,
        associated_token::mint = token_mint,
        associated_token::authority = beneficiary,
    )]
    pub beneficiary_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimNFT<'info> {
    #[account(mut)]
    pub beneficiary: Signer<'info>,
    
    #[account(
        seeds = [ESTATE_SEED, estate.owner.as_ref(), estate.estate_number.to_le_bytes().as_ref()],
        bump
    )]
    pub estate: Account<'info, Estate>,
    
    #[account(
        mut,
        has_one = beneficiary @ EstateError::UnauthorizedBeneficiary,
        has_one = estate @ EstateError::InvalidClaimRecord,
    )]
    pub claim_record: Account<'info, ClaimRecord>,
    
    pub nft_mint: Account<'info, Mint>,
    
    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = estate,
    )]
    pub estate_nft_account: Account<'info, TokenAccount>,
    
    #[account(
        init_if_needed,
        payer = beneficiary,
        associated_token::mint = nft_mint,
        associated_token::authority = beneficiary,
    )]
    pub beneficiary_nft_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseEstate<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        mut,
        close = authority,
    )]
    pub estate: Account<'info, Estate>,
}

#[derive(Accounts)]
pub struct EmergencyLock<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    
    #[account(
        mut,
        has_one = owner,
    )]
    pub estate: Account<'info, Estate>,
}

#[derive(Accounts)]
pub struct EmergencyUnlock<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    
    #[account(
        mut,
        has_one = owner,
    )]
    pub estate: Account<'info, Estate>,
}

#[derive(Accounts)]
pub struct InitiateRecovery<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    pub estate: Account<'info, Estate>,
    
    #[account(
        init,
        payer = admin,
        space = 8 + 32 + 32 + 8 + 8 + (4 + 256) + 1,
        seeds = [RECOVERY_SEED, estate.key().as_ref()],
        bump
    )]
    pub recovery: Account<'info, Recovery>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExecuteRecovery<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(mut)]
    pub estate: Account<'info, Estate>,
    
    #[account(
        mut,
        has_one = estate,
        seeds = [RECOVERY_SEED, estate.key().as_ref()],
        bump
    )]
    pub recovery: Account<'info, Recovery>,
    
    /// CHECK: The new owner address for the recovered estate
    pub recovery_address: AccountInfo<'info>,
}

#[error_code]
pub enum EstateError {
    #[msg("Invalid inactivity period. Must be between 24 hours and 300 years")]
    InvalidInactivityPeriod,
    #[msg("Invalid grace period. Must be between 24 hours and 90 days")]
    InvalidGracePeriod,
    #[msg("Estate is locked")]
    EstateLocked,
    #[msg("Unauthorized access")]
    UnauthorizedAccess,
    #[msg("Estate is already claimable")]
    EstateClaimable,
    #[msg("Too many beneficiaries. Maximum is 10")]
    TooManyBeneficiaries,
    #[msg("Beneficiary shares must sum to 100%")]
    InvalidBeneficiaryShares,
    #[msg("Estate is already claimable")]
    AlreadyClaimable,
    #[msg("Estate is not yet claimable")]
    NotYetClaimable,
    #[msg("Estate is not claimable")]
    NotClaimable,
    #[msg("Invalid beneficiary index")]
    InvalidBeneficiaryIndex,
    #[msg("Unauthorized beneficiary")]
    UnauthorizedBeneficiary,
    #[msg("Inheritance already claimed")]
    AlreadyClaimed,
    #[msg("Estate is already locked")]
    AlreadyLocked,
    #[msg("Estate is not locked")]
    NotLocked,
    #[msg("RWA already deleted")]
    RWAAlreadyDeleted,
    #[msg("Invalid claim record")]
    InvalidClaimRecord,
    #[msg("Invalid RWA")]
    InvalidRWA,
    #[msg("Not all beneficiaries have claimed")]
    NotAllClaimed,
    #[msg("Must claim inheritance first before claiming tokens")]
    MustClaimInheritanceFirst,
    #[msg("Token already claimed")]
    TokenAlreadyClaimed,
    #[msg("NFT already claimed")]
    NFTAlreadyClaimed,
    #[msg("Invalid NFT amount - must be exactly 1")]
    InvalidNFTAmount,
    #[msg("Recovery can only be initiated after 30 days of being claimable")]
    RecoveryTooEarly,
    #[msg("Recovery already executed")]
    RecoveryAlreadyExecuted,
    #[msg("Recovery time lock not yet expired")]
    RecoveryNotReady,
} 