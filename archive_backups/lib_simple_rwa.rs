use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, MintTo};
use anchor_spl::associated_token::AssociatedToken;
use mpl_token_metadata::{
    instruction::{create_metadata_accounts_v3, create_master_edition_v3, verify_collection},
    state::{Creator, DataV2, Collection},
    ID as TOKEN_METADATA_ID,
};

declare_id!("EstateProgram1111111111111111111111111111111");

pub const ESTATE_SEED: &[u8] = b"estate";
pub const RWA_SEED: &[u8] = b"rwa";
pub const CLAIM_SEED: &[u8] = b"claim";
pub const MARKET_SEED: &[u8] = b"market";
pub const COUNTER_SEED: &[u8] = b"counter";

pub const MIN_INACTIVITY_PERIOD: i64 = 30 * 24 * 60 * 60; // 30 days in seconds
pub const MAX_INACTIVITY_PERIOD: i64 = 3650 * 24 * 60 * 60; // 10 years in seconds
pub const MIN_GRACE_PERIOD: i64 = 7 * 24 * 60 * 60; // 7 days in seconds
pub const MAX_GRACE_PERIOD: i64 = 90 * 24 * 60 * 60; // 90 days in seconds
pub const MAX_BENEFICIARIES: u8 = 10;
pub const ESTATE_FEE: u64 = 100_000_000; // 0.1 SOL
pub const RWA_FEE: u64 = 10_000_000; // 0.01 SOL
pub const UPDATE_FEE: u64 = 5_000_000; // 0.005 SOL
pub const EMERGENCY_FEE: u64 = 500_000_000; // 0.5 SOL
pub const TRANSFER_FEE_BPS: u16 = 250; // 2.5%

#[program]
pub mod defai_estate {
    use super::*;
    use anchor_lang::solana_program::program::invoke_signed;

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
        owner_email_hash: [u8; 32], // Encrypted email hash
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
        estate.rwa_collection = ctx.accounts.rwa_collection.key();
        estate.total_rwas = 0;
        estate.estate_number = ctx.accounts.global_counter.count;

        // Update global counter
        ctx.accounts.global_counter.count += 1;

        // Create the estate NFT metadata
        let estate_name = format!("DEFAI Estate #{}", estate.estate_number);
        let estate_symbol = "ESTATE".to_string();
        let estate_uri = format!("https://api.DEFAI.ai/estate/{}", estate.estate_id);

        msg!("Creating estate NFT metadata: {}", estate_name);

        // Get estate PDA bump
        let estate_bump = ctx.bumps.estate;
        let estate_seeds = &[
            ESTATE_SEED,
            ctx.accounts.owner.key().as_ref(),
            (estate.estate_number - 1).to_le_bytes().as_ref(),
            &[estate_bump],
        ];

        // Create metadata for estate NFT
        let metadata_accounts = vec![
            ctx.accounts.estate_metadata.to_account_info(),
            ctx.accounts.estate_mint.to_account_info(),
            ctx.accounts.estate.to_account_info(), // mint authority
            ctx.accounts.owner.to_account_info(),
            ctx.accounts.estate.to_account_info(), // update authority
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.rent.to_account_info(),
        ];

        let creators = vec![Creator {
            address: ctx.accounts.owner.key(),
            verified: false,
            share: 100,
        }];

        let estate_metadata = DataV2 {
            name: estate_name,
            symbol: estate_symbol,
            uri: estate_uri,
            seller_fee_basis_points: TRANSFER_FEE_BPS,
            creators: Some(creators),
            collection: None, // Will be set after collection is created
            uses: None,
        };

        invoke_signed(
            &create_metadata_accounts_v3(
                ctx.accounts.metadata_program.key(),
                ctx.accounts.estate_metadata.key(),
                ctx.accounts.estate_mint.key(),
                ctx.accounts.estate.key(), // mint authority
                ctx.accounts.owner.key(),
                ctx.accounts.estate.key(), // update authority
                estate_metadata,
                true, // is_mutable
                true, // update_authority_is_signer
                None, // collection_details
            ),
            &metadata_accounts,
            &[estate_seeds],
        )?;

        msg!("Estate NFT metadata created");

        // Create master edition
        let master_edition_accounts = vec![
            ctx.accounts.estate_master_edition.to_account_info(),
            ctx.accounts.estate_mint.to_account_info(),
            ctx.accounts.estate.to_account_info(), // update authority
            ctx.accounts.estate.to_account_info(), // mint authority
            ctx.accounts.owner.to_account_info(),
            ctx.accounts.estate_metadata.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.rent.to_account_info(),
        ];

        invoke_signed(
            &create_master_edition_v3(
                ctx.accounts.metadata_program.key(),
                ctx.accounts.estate_master_edition.key(),
                ctx.accounts.estate_mint.key(),
                ctx.accounts.estate.key(), // update authority
                ctx.accounts.estate.key(), // mint authority
                ctx.accounts.estate_metadata.key(),
                ctx.accounts.owner.key(),
                Some(0), // max_supply = 0 for unlimited print editions (pNFT)
            ),
            &master_edition_accounts,
            &[estate_seeds],
        )?;

        msg!("Estate master edition created");

        // Mint the estate NFT to the owner
        let cpi_accounts = MintTo {
            mint: ctx.accounts.estate_mint.to_account_info(),
            to: ctx.accounts.owner_estate_token_account.to_account_info(),
            authority: ctx.accounts.estate.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, &[estate_seeds]);
        
        token::mint_to(cpi_ctx, 1)?;

        msg!("Estate NFT minted to owner");

        // Create collection metadata
        let collection_name = format!("DEFAI Estate #{} RWAs", estate.estate_number);
        let collection_symbol = "DEFAI-RWA".to_string();
        let collection_uri = format!("https://api.DEFAI.ai/collection/{}", ctx.accounts.rwa_collection.key());

        let collection_metadata_accounts = vec![
            ctx.accounts.collection_metadata.to_account_info(),
            ctx.accounts.rwa_collection.to_account_info(),
            ctx.accounts.estate.to_account_info(), // mint authority
            ctx.accounts.owner.to_account_info(),
            ctx.accounts.estate.to_account_info(), // update authority
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.rent.to_account_info(),
        ];

        let collection_metadata_data = DataV2 {
            name: collection_name,
            symbol: collection_symbol,
            uri: collection_uri,
            seller_fee_basis_points: TRANSFER_FEE_BPS,
            creators: Some(vec![Creator {
                address: ctx.accounts.owner.key(),
                verified: false,
                share: 100,
            }]),
            collection: None,
            uses: None,
        };

        invoke_signed(
            &create_metadata_accounts_v3(
                ctx.accounts.metadata_program.key(),
                ctx.accounts.collection_metadata.key(),
                ctx.accounts.rwa_collection.key(),
                ctx.accounts.estate.key(), // mint authority
                ctx.accounts.owner.key(),
                ctx.accounts.estate.key(), // update authority
                collection_metadata_data,
                true, // is_mutable
                true, // update_authority_is_signer
                None, // collection_details
            ),
            &collection_metadata_accounts,
            &[estate_seeds],
        )?;

        msg!("Collection metadata created");

        // Create collection master edition
        let collection_master_edition_accounts = vec![
            ctx.accounts.collection_master_edition.to_account_info(),
            ctx.accounts.rwa_collection.to_account_info(),
            ctx.accounts.estate.to_account_info(), // update authority
            ctx.accounts.estate.to_account_info(), // mint authority
            ctx.accounts.owner.to_account_info(),
            ctx.accounts.collection_metadata.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.rent.to_account_info(),
        ];

        invoke_signed(
            &create_master_edition_v3(
                ctx.accounts.metadata_program.key(),
                ctx.accounts.collection_master_edition.key(),
                ctx.accounts.rwa_collection.key(),
                ctx.accounts.estate.key(), // update authority
                ctx.accounts.estate.key(), // mint authority
                ctx.accounts.collection_metadata.key(),
                ctx.accounts.owner.key(),
                Some(0), // max_supply = 0 for collection
            ),
            &collection_master_edition_accounts,
            &[estate_seeds],
        )?;

        msg!("Collection master edition created");

        // Mint collection NFT to collection token account
        let cpi_accounts_collection = MintTo {
            mint: ctx.accounts.rwa_collection.to_account_info(),
            to: ctx.accounts.collection_token_account.to_account_info(),
            authority: ctx.accounts.estate.to_account_info(),
        };
        let cpi_ctx_collection = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(), 
            cpi_accounts_collection, 
            &[estate_seeds]
        );
        
        token::mint_to(cpi_ctx_collection, 1)?;

        msg!("Collection NFT minted");

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

        // TODO: Transfer estate NFT percentage or assets
        // In a full implementation, this would handle:
        // - Fractional NFT transfer
        // - Token transfers based on share percentage
        // - RWA transfers

        msg!(
            "Beneficiary {} claimed {}% of estate",
            beneficiary.address,
            beneficiary.share_percentage
        );

        Ok(())
    }

    pub fn create_rwa(
        ctx: Context<CreateRWA>,
        template: RWATemplate,
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
        rwa.template = template;
        rwa.metadata_uri = metadata_uri.clone();
        rwa.mint = ctx.accounts.rwa_mint.key();
        rwa.created_at = Clock::get()?.unix_timestamp;
        rwa.is_frozen = false;

        estate.total_rwas += 1;

        // Get estate PDA bump for signing
        let (_, estate_bump) = Pubkey::find_program_address(
            &[
                ESTATE_SEED,
                estate.owner.as_ref(),
                estate.estate_number.to_le_bytes().as_ref(),
            ],
            ctx.program_id,
        );
        let estate_seeds = &[
            ESTATE_SEED,
            estate.owner.as_ref(),
            estate.estate_number.to_le_bytes().as_ref(),
            &[estate_bump],
        ];

        // Create RWA NFT metadata
        let rwa_name = format!("RWA #{} - Estate #{}", estate.total_rwas, estate.estate_number);
        let rwa_symbol = "DEFAI-RWA".to_string();

        let rwa_metadata_accounts = vec![
            ctx.accounts.rwa_metadata.to_account_info(),
            ctx.accounts.rwa_mint.to_account_info(),
            ctx.accounts.estate.to_account_info(), // mint authority
            ctx.accounts.owner.to_account_info(),
            ctx.accounts.estate.to_account_info(), // update authority
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.rent.to_account_info(),
        ];

        let rwa_metadata_data = DataV2 {
            name: rwa_name,
            symbol: rwa_symbol,
            uri: metadata_uri,
            seller_fee_basis_points: TRANSFER_FEE_BPS,
            creators: Some(vec![Creator {
                address: ctx.accounts.owner.key(),
                verified: false,
                share: 100,
            }]),
            collection: Some(Collection {
                verified: false,
                key: estate.rwa_collection,
            }),
            uses: None,
        };

        invoke_signed(
            &create_metadata_accounts_v3(
                ctx.accounts.metadata_program.key(),
                ctx.accounts.rwa_metadata.key(),
                ctx.accounts.rwa_mint.key(),
                ctx.accounts.estate.key(), // mint authority
                ctx.accounts.owner.key(),
                ctx.accounts.estate.key(), // update authority
                rwa_metadata_data,
                true, // is_mutable
                true, // update_authority_is_signer
                None, // collection_details
            ),
            &rwa_metadata_accounts,
            &[estate_seeds],
        )?;

        // Create master edition for RWA
        let rwa_master_edition_accounts = vec![
            ctx.accounts.rwa_master_edition.to_account_info(),
            ctx.accounts.rwa_mint.to_account_info(),
            ctx.accounts.estate.to_account_info(), // update authority
            ctx.accounts.estate.to_account_info(), // mint authority
            ctx.accounts.owner.to_account_info(),
            ctx.accounts.rwa_metadata.to_account_info(),
            ctx.accounts.token_program.to_account_info(),
            ctx.accounts.system_program.to_account_info(),
            ctx.accounts.rent.to_account_info(),
        ];

        invoke_signed(
            &create_master_edition_v3(
                ctx.accounts.metadata_program.key(),
                ctx.accounts.rwa_master_edition.key(),
                ctx.accounts.rwa_mint.key(),
                ctx.accounts.estate.key(), // update authority
                ctx.accounts.estate.key(), // mint authority
                ctx.accounts.rwa_metadata.key(),
                ctx.accounts.owner.key(),
                Some(0), // max_supply = 0
            ),
            &rwa_master_edition_accounts,
            &[estate_seeds],
        )?;

        // Mint RWA NFT to owner
        let cpi_accounts = MintTo {
            mint: ctx.accounts.rwa_mint.to_account_info(),
            to: ctx.accounts.owner_rwa_token_account.to_account_info(),
            authority: ctx.accounts.estate.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, &[estate_seeds]);
        
        token::mint_to(cpi_ctx, 1)?;

        // Verify collection
        let verify_collection_accounts = vec![
            ctx.accounts.metadata_program.to_account_info(),
            ctx.accounts.rwa_metadata.to_account_info(),
            ctx.accounts.estate.to_account_info(), // collection authority
            ctx.accounts.owner.to_account_info(),
            ctx.accounts.collection_mint.to_account_info(),
            ctx.accounts.collection_metadata.to_account_info(),
            ctx.accounts.collection_master_edition.to_account_info(),
        ];

        invoke_signed(
            &verify_collection(
                ctx.accounts.metadata_program.key(),
                ctx.accounts.rwa_metadata.key(),
                ctx.accounts.estate.key(), // collection authority
                ctx.accounts.owner.key(),
                ctx.accounts.collection_mint.key(),
                ctx.accounts.collection_metadata.key(),
                ctx.accounts.collection_master_edition.key(),
                None, // collection_authority_record
            ),
            &verify_collection_accounts,
            &[estate_seeds],
        )?;

        msg!("Created RWA #{} for estate", estate.total_rwas);

        Ok(())
    }

    pub fn emergency_lock(ctx: Context<EmergencyLock>) -> Result<()> {
        let estate = &mut ctx.accounts.estate;
        
        require!(
            ctx.accounts.owner.key() == estate.owner,
            EstateError::UnauthorizedAccess
        );
        require!(!estate.is_locked, EstateError::AlreadyLocked);

        estate.is_locked = true;

        msg!("Estate emergency locked");

        Ok(())
    }

    pub fn emergency_unlock(
        ctx: Context<EmergencyUnlock>,
        verification_code: [u8; 32],
    ) -> Result<()> {
        let estate = &mut ctx.accounts.estate;
        
        require!(
            ctx.accounts.owner.key() == estate.owner,
            EstateError::UnauthorizedAccess
        );
        require!(estate.is_locked, EstateError::NotLocked);

        // TODO: Verify the code through multi-sig or time-lock

        estate.is_locked = false;

        msg!("Estate emergency unlocked");

        Ok(())
    }
}

// Account structures
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
    pub rwa_collection: Pubkey,
    pub total_rwas: u32,
    pub estate_number: u64,
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
pub struct GlobalCounter {
    pub count: u64,
}

#[account]
pub struct RWA {
    pub estate: Pubkey,
    pub template: RWATemplate,
    pub metadata_uri: String,
    pub mint: Pubkey,
    pub created_at: i64,
    pub is_frozen: bool,
}

// RWA Templates
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub enum RWATemplate {
    Jewelry {
        name: String,
        description: String,
        appraisal_value: u64,
        certification: Option<String>,
    },
    RealEstate {
        address: String,
        property_type: String,
        square_footage: u32,
        valuation: u64,
        deed_reference: String,
    },
    Vehicle {
        make: String,
        model: String,
        year: u16,
        vin: String,
        estimated_value: u64,
    },
    Artwork {
        artist: String,
        title: String,
        medium: String,
        dimensions: String,
        provenance: String,
        appraisal: u64,
    },
    FamilyHeirloom {
        name: String,
        description: String,
        sentimental_value: String,
        history: String,
    },
    FinancialAsset {
        asset_type: String,
        institution: String,
        account_reference: String,
        estimated_value: u64,
    },
}

// Context structs
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
        space = 8 + 32 + 32 + 32 + 8 + 8 + 8 + (4 + (MAX_BENEFICIARIES as usize * 97)) + 1 + 8 + 8 + 1 + 1 + 32 + 4 + 8,
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
    
    /// CHECK: Metadata account for estate NFT
    #[account(
        mut,
        seeds = [
            b"metadata",
            metadata_program.key().as_ref(),
            estate_mint.key().as_ref()
        ],
        bump,
        seeds::program = metadata_program.key()
    )]
    pub estate_metadata: UncheckedAccount<'info>,
    
    /// CHECK: Master edition account
    #[account(
        mut,
        seeds = [
            b"metadata",
            metadata_program.key().as_ref(),
            estate_mint.key().as_ref(),
            b"edition"
        ],
        bump,
        seeds::program = metadata_program.key()
    )]
    pub estate_master_edition: UncheckedAccount<'info>,
    
    #[account(
        init,
        payer = owner,
        associated_token::mint = estate_mint,
        associated_token::authority = owner
    )]
    pub owner_estate_token_account: Account<'info, TokenAccount>,
    
    #[account(
        init,
        payer = owner,
        mint::decimals = 0,
        mint::authority = estate,
        mint::freeze_authority = estate,
    )]
    pub rwa_collection: Account<'info, Mint>,
    
    /// CHECK: Collection metadata
    #[account(
        mut,
        seeds = [
            b"metadata",
            metadata_program.key().as_ref(),
            rwa_collection.key().as_ref()
        ],
        bump,
        seeds::program = metadata_program.key()
    )]
    pub collection_metadata: UncheckedAccount<'info>,
    
    /// CHECK: Collection master edition
    #[account(
        mut,
        seeds = [
            b"metadata",
            metadata_program.key().as_ref(),
            rwa_collection.key().as_ref(),
            b"edition"
        ],
        bump,
        seeds::program = metadata_program.key()
    )]
    pub collection_master_edition: UncheckedAccount<'info>,
    
    #[account(
        init,
        payer = owner,
        associated_token::mint = rwa_collection,
        associated_token::authority = estate
    )]
    pub collection_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        seeds = [COUNTER_SEED],
        bump
    )]
    pub global_counter: Account<'info, GlobalCounter>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    /// CHECK: Metaplex metadata program
    #[account(constraint = metadata_program.key() == TOKEN_METADATA_ID)]
    pub metadata_program: UncheckedAccount<'info>,
    pub rent: Sysvar<'info, Rent>,
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
pub struct CreateRWA<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    
    #[account(
        mut,
        has_one = owner,
        has_one = rwa_collection,
    )]
    pub estate: Account<'info, Estate>,
    
    #[account(
        init,
        payer = owner,
        space = 8 + 32 + 200 + 200 + 32 + 8 + 1, // Adjust based on RWATemplate size
        seeds = [RWA_SEED, estate.key().as_ref(), estate.total_rwas.to_le_bytes().as_ref()],
        bump
    )]
    pub rwa: Account<'info, RWA>,
    
    #[account(
        init,
        payer = owner,
        mint::decimals = 0,
        mint::authority = estate,
        mint::freeze_authority = estate,
    )]
    pub rwa_mint: Account<'info, Mint>,
    
    /// CHECK: RWA metadata account
    #[account(
        mut,
        seeds = [
            b"metadata",
            metadata_program.key().as_ref(),
            rwa_mint.key().as_ref()
        ],
        bump,
        seeds::program = metadata_program.key()
    )]
    pub rwa_metadata: UncheckedAccount<'info>,
    
    /// CHECK: RWA master edition
    #[account(
        mut,
        seeds = [
            b"metadata",
            metadata_program.key().as_ref(),
            rwa_mint.key().as_ref(),
            b"edition"
        ],
        bump,
        seeds::program = metadata_program.key()
    )]
    pub rwa_master_edition: UncheckedAccount<'info>,
    
    #[account(
        init,
        payer = owner,
        associated_token::mint = rwa_mint,
        associated_token::authority = owner
    )]
    pub owner_rwa_token_account: Account<'info, TokenAccount>,
    
    pub rwa_collection: Account<'info, Mint>,
    
    #[account(
        constraint = collection_mint.key() == estate.rwa_collection
    )]
    pub collection_mint: Account<'info, Mint>,
    
    /// CHECK: Collection metadata for verification
    pub collection_metadata: UncheckedAccount<'info>,
    
    /// CHECK: Collection master edition for verification
    pub collection_master_edition: UncheckedAccount<'info>,
    
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    /// CHECK: Metaplex metadata program
    #[account(constraint = metadata_program.key() == TOKEN_METADATA_ID)]
    pub metadata_program: UncheckedAccount<'info>,
    pub rent: Sysvar<'info, Rent>,
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

// Error codes
#[error_code]
pub enum EstateError {
    #[msg("Invalid inactivity period. Must be between 30 days and 10 years")]
    InvalidInactivityPeriod,
    #[msg("Invalid grace period. Must be between 7 and 90 days")]
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
} 