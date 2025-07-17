use anchor_lang::prelude::*;

mod purchase_app;
use purchase_app::*;

declare_id!("FyDBGJFfviW1mqKYWueLQCW4YUm9RmUgQeEYw1izszDA");

// ============================================================================
// Constants
// ============================================================================

const APP_REGISTRATION_SEED: &[u8] = b"app_registration";
const MAX_METADATA_URI_LEN: usize = 100;

// ============================================================================
// Program
// ============================================================================

#[program]
pub mod defai_app_factory {
    use super::*;

    pub fn initialize_app_factory(
        ctx: Context<InitializeAppFactory>,
        platform_fee_bps: u16,
    ) -> Result<()> {
        require!(platform_fee_bps <= 10000, AppFactoryError::InvalidPlatformFee);

        let app_factory = &mut ctx.accounts.app_factory;
        app_factory.authority = ctx.accounts.authority.key();
        app_factory.defai_mint = ctx.accounts.defai_mint.key();
        app_factory.treasury = ctx.accounts.treasury.key();
        app_factory.master_collection = ctx.accounts.master_collection.key();
        app_factory.platform_fee_bps = platform_fee_bps;
        app_factory.total_apps = 0;
        app_factory.bump = ctx.bumps.app_factory;

        msg!("AppFactory initialized with {}% platform fee", platform_fee_bps as f64 / 100.0);
        Ok(())
    }

    pub fn register_app(
        ctx: Context<RegisterApp>,
        price: u64,
        max_supply: u64,
        metadata_uri: String,
    ) -> Result<()> {
        require!(price > 0, AppFactoryError::InvalidPrice);
        require!(max_supply > 0, AppFactoryError::InvalidMaxSupply);
        require!(metadata_uri.len() <= MAX_METADATA_URI_LEN, AppFactoryError::MetadataUriTooLong);

        let app_factory = &mut ctx.accounts.app_factory;
        let app_id = app_factory.total_apps;
        app_factory.total_apps = app_factory.total_apps.checked_add(1)
            .ok_or(AppFactoryError::MathOverflow)?;

        let app_registration = &mut ctx.accounts.app_registration;
        app_registration.app_id = app_id;
        app_registration.creator = ctx.accounts.creator.key();
        app_registration.sft_mint = ctx.accounts.sft_mint.key();
        app_registration.price = price;
        app_registration.max_supply = max_supply;
        app_registration.current_supply = 0;
        app_registration.is_active = true;
        app_registration.metadata_uri = metadata_uri.clone();
        app_registration.created_at = Clock::get()?.unix_timestamp;
        app_registration.bump = ctx.bumps.app_registration;

        // Emit event
        emit!(AppRegistered {
            app_id,
            creator: ctx.accounts.creator.key(),
            sft_mint: ctx.accounts.sft_mint.key(),
            price,
            max_supply,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!(
            "App {} registered by {} with price {} and max supply {}",
            app_id,
            ctx.accounts.creator.key(),
            price,
            max_supply
        );
        Ok(())
    }

    /*
    // Commented out due to stack overflow - use purchase_app_access_v2 instead
    pub fn purchase_app_access(ctx: Context<PurchaseAppAccess>, app_id: u64) -> Result<()> {
        // First, validate and get all needed values
        {
            let app_registration = &ctx.accounts.app_registration;
            require!(app_registration.is_active, AppFactoryError::AppNotActive);
            require!(
                app_registration.current_supply < app_registration.max_supply,
                AppFactoryError::MaxSupplyReached
            );
        }

        let price = ctx.accounts.app_registration.price;
        let bump = ctx.accounts.app_registration.bump;
        let platform_fee_bps = ctx.accounts.app_factory.platform_fee_bps;
        
        // Calculate splits
        let platform_fee = price
            .checked_mul(platform_fee_bps as u64)
            .ok_or(AppFactoryError::MathOverflow)?
            .checked_div(10000)
            .ok_or(AppFactoryError::MathOverflow)?;
        
        let creator_amount = price
            .checked_sub(platform_fee)
            .ok_or(AppFactoryError::MathOverflow)?;

        // Transfer platform fee
        let platform_transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_defai_ata.to_account_info(),
                to: ctx.accounts.treasury_defai_ata.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );
        token::transfer(platform_transfer_ctx, platform_fee)?;

        // Transfer creator amount
        let creator_transfer_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_defai_ata.to_account_info(),
                to: ctx.accounts.creator_defai_ata.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        );
        token::transfer(creator_transfer_ctx, creator_amount)?;

        // Mint SFT to user
        let mint_seeds = &[
            APP_REGISTRATION_SEED,
            &app_id.to_le_bytes(),
            &[bump],
        ];
        let signer_seeds = &[&mint_seeds[..]];

        let mint_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.sft_mint.to_account_info(),
                to: ctx.accounts.user_sft_ata.to_account_info(),
                authority: ctx.accounts.app_registration.to_account_info(),
            },
            signer_seeds,
        );
        token::mint_to(mint_ctx, 1)?;

        // Update supply
        ctx.accounts.app_registration.current_supply = ctx.accounts.app_registration.current_supply
            .checked_add(1)
            .ok_or(AppFactoryError::MathOverflow)?;

        // Record access
        let user_app_access = &mut ctx.accounts.user_app_access;
        user_app_access.user = ctx.accounts.user.key();
        user_app_access.app_id = app_id;
        user_app_access.sft_token_account = ctx.accounts.user_sft_ata.key();
        user_app_access.purchased_at = Clock::get()?.unix_timestamp;
        user_app_access.bump = ctx.bumps.user_app_access;

        // Emit event
        emit!(AppPurchased {
            app_id,
            user: ctx.accounts.user.key(),
            price,
            platform_fee,
            creator_amount,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!(
            "User {} purchased access to app {} for {} DEFAI (platform: {}, creator: {})",
            ctx.accounts.user.key(),
            app_id,
            price,
            platform_fee,
            creator_amount
        );
        Ok(())
    }
    */

    // Optimized purchase function with reduced stack usage
    pub fn purchase_app_access_v2(ctx: Context<PurchaseAppAccessOptimized>, app_id: u64) -> Result<()> {
        let mut price = 0u64;
        let mut platform_fee = 0u64;
        let mut creator_amount = 0u64;

        // Pre-validation
        purchase_app_pre_validation(
            &ctx.accounts.app_registration,
            &ctx.accounts.app_factory,
            &mut price,
            &mut platform_fee,
            &mut creator_amount,
        )?;

        // Execute transfers
        execute_token_transfers(
            &ctx.accounts.user,
            &ctx.accounts.user_defai_ata,
            &ctx.accounts.creator_defai_ata,
            &ctx.accounts.treasury_defai_ata,
            &ctx.accounts.token_program,
            platform_fee,
            creator_amount,
        )?;

        // Mint SFT
        let bump = ctx.accounts.app_registration.bump;
        mint_app_sft(
            &ctx.accounts.app_registration,
            &ctx.accounts.sft_mint,
            &ctx.accounts.user_sft_ata,
            &ctx.accounts.token_program,
            app_id,
            bump,
        )?;

        // Update supply
        ctx.accounts.app_registration.current_supply = ctx.accounts.app_registration.current_supply
            .checked_add(1)
            .ok_or(AppFactoryError::MathOverflow)?;

        // Record access
        let user_app_access = &mut ctx.accounts.user_app_access;
        user_app_access.user = ctx.accounts.user.key();
        user_app_access.app_id = app_id;
        user_app_access.sft_token_account = ctx.accounts.user_sft_ata.key();
        user_app_access.purchased_at = Clock::get()?.unix_timestamp;
        user_app_access.bump = ctx.bumps.user_app_access;

        // Emit event
        emit!(AppPurchased {
            app_id,
            user: ctx.accounts.user.key(),
            price,
            platform_fee,
            creator_amount,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!("User purchased app {} access", app_id);
        Ok(())
    }

    pub fn toggle_app_status(ctx: Context<ToggleAppStatus>, _app_id: u64) -> Result<()> {
        let app_registration = &mut ctx.accounts.app_registration;
        app_registration.is_active = !app_registration.is_active;
        
        // Emit event
        emit!(AppStatusChanged {
            app_id: app_registration.app_id,
            is_active: app_registration.is_active,
            timestamp: Clock::get()?.unix_timestamp,
        });

        msg!(
            "App {} is now {}",
            app_registration.app_id,
            if app_registration.is_active { "active" } else { "inactive" }
        );
        Ok(())
    }

    pub fn update_platform_settings(
        ctx: Context<UpdatePlatformSettings>,
        new_platform_fee_bps: Option<u16>,
        new_treasury: Option<Pubkey>,
    ) -> Result<()> {
        let app_factory = &mut ctx.accounts.app_factory;
        
        if let Some(fee) = new_platform_fee_bps {
            require!(fee <= 10000, AppFactoryError::InvalidPlatformFee);
            app_factory.platform_fee_bps = fee;
            msg!("Platform fee updated to {}%", fee as f64 / 100.0);
        }
        
        if let Some(treasury) = new_treasury {
            app_factory.treasury = treasury;
            msg!("Treasury updated to {}", treasury);
        }
        
        // Emit event
        emit!(PlatformSettingsUpdated {
            platform_fee_bps: new_platform_fee_bps,
            treasury: new_treasury,
            timestamp: Clock::get()?.unix_timestamp,
        });
        
        Ok(())
    }
}

// ============================================================================
// Account Structures
// ============================================================================

#[account]
pub struct AppFactory {
    pub authority: Pubkey,              // Platform authority
    pub defai_mint: Pubkey,             // DEFAI token mint
    pub treasury: Pubkey,               // Platform treasury (receives platform fee)
    pub master_collection: Pubkey,      // "DEFAI APPs" collection mint
    pub platform_fee_bps: u16,         // Platform fee in basis points (2000 = 20%)
    pub total_apps: u64,                // Total number of registered apps
    pub bump: u8,                       // PDA bump seed
}

impl AppFactory {
    pub const LEN: usize = 8 + 32 + 32 + 32 + 32 + 2 + 8 + 1;
}

#[account]
pub struct AppRegistration {
    pub app_id: u64,                    // Unique app identifier
    pub creator: Pubkey,                // App creator (receives creator fee)
    pub sft_mint: Pubkey,               // SFT mint address for this app
    pub price: u64,                     // Price in DEFAI tokens (with decimals)
    pub max_supply: u64,                // Maximum number of SFTs that can be minted
    pub current_supply: u64,            // Current number of SFTs minted
    pub is_active: bool,                // Whether app purchases are enabled
    pub metadata_uri: String,           // IPFS URI for app metadata
    pub created_at: i64,                // Creation timestamp
    pub bump: u8,                       // PDA bump seed
}

impl AppRegistration {
    pub const LEN: usize = 8 + 8 + 32 + 32 + 8 + 8 + 8 + 1 + (4 + 100) + 8 + 1; // ~200 bytes
}

#[account]
pub struct UserAppAccess {
    pub user: Pubkey,                   // User wallet
    pub app_id: u64,                    // App they purchased
    pub sft_token_account: Pubkey,      // Their SFT token account
    pub purchased_at: i64,              // Purchase timestamp
    pub bump: u8,                       // PDA bump seed
}

impl UserAppAccess {
    pub const LEN: usize = 8 + 32 + 8 + 32 + 8 + 1;
}

// ============================================================================
// Context Structures
// ============================================================================

#[derive(Accounts)]
pub struct InitializeAppFactory<'info> {
    #[account(
        init,
        payer = authority,
        space = AppFactory::LEN,
        seeds = [b"app_factory"],
        bump
    )]
    pub app_factory: Account<'info, AppFactory>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    /// CHECK: DEFAI token mint
    pub defai_mint: AccountInfo<'info>,
    
    /// CHECK: Platform treasury wallet
    pub treasury: AccountInfo<'info>,
    
    /// CHECK: Master collection mint for "DEFAI APPs"
    pub master_collection: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(price: u64, max_supply: u64, metadata_uri: String)]
pub struct RegisterApp<'info> {
    #[account(
        mut,
        seeds = [b"app_factory"],
        bump = app_factory.bump
    )]
    pub app_factory: Account<'info, AppFactory>,
    
    #[account(
        init,
        payer = creator,
        space = AppRegistration::LEN,
        seeds = [b"app_registration".as_ref(), &app_factory.total_apps.to_le_bytes()],
        bump
    )]
    pub app_registration: Account<'info, AppRegistration>,
    
    /// CHECK: SFT mint will be created separately and passed in
    pub sft_mint: AccountInfo<'info>,
    
    #[account(mut)]
    pub creator: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

/*
// Fixed PurchaseAppAccess with boxing to reduce stack usage - Still has stack overflow
#[derive(Accounts)]
#[instruction(app_id: u64)]
pub struct PurchaseAppAccess<'info> {
    #[account(
        seeds = [b"app_factory"],
        bump = app_factory.bump
    )]
    pub app_factory: Box<Account<'info, AppFactory>>,
    
    #[account(
        mut,
        seeds = [b"app_registration".as_ref(), &app_id.to_le_bytes()],
        bump = app_registration.bump
    )]
    pub app_registration: Box<Account<'info, AppRegistration>>,
    
    #[account(
        init,
        payer = user,
        space = UserAppAccess::LEN,
        seeds = [b"user_app_access".as_ref(), user.key().as_ref(), &app_id.to_le_bytes()],
        bump
    )]
    pub user_app_access: Box<Account<'info, UserAppAccess>>,
    
    #[account(
        mut,
        address = app_registration.sft_mint
    )]
    pub sft_mint: Box<Account<'info, Mint>>,
    
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = sft_mint,
        associated_token::authority = user,
    )]
    pub user_sft_ata: Box<Account<'info, TokenAccount>>,
    
    #[account(
        mut,
        associated_token::mint = defai_mint,
        associated_token::authority = user,
    )]
    pub user_defai_ata: Box<Account<'info, TokenAccount>>,
    
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = defai_mint,
        associated_token::authority = creator,
    )]
    pub creator_defai_ata: Box<Account<'info, TokenAccount>>,
    
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = defai_mint,
        associated_token::authority = treasury,
    )]
    pub treasury_defai_ata: Box<Account<'info, TokenAccount>>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    /// CHECK: DEFAI mint for associated token accounts
    pub defai_mint: AccountInfo<'info>,
    
    /// CHECK: Creator for associated token account
    #[account(address = app_registration.creator)]
    pub creator: AccountInfo<'info>,
    
    /// CHECK: Treasury for associated token account  
    #[account(address = app_factory.treasury)]
    pub treasury: AccountInfo<'info>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}
*/

#[derive(Accounts)]
#[instruction(app_id: u64)]
pub struct ToggleAppStatus<'info> {
    #[account(
        mut,
        seeds = [b"app_registration".as_ref(), &app_id.to_le_bytes()],
        bump = app_registration.bump,
        has_one = creator @ AppFactoryError::UnauthorizedCreator
    )]
    pub app_registration: Account<'info, AppRegistration>,
    
    pub creator: Signer<'info>,
}

#[derive(Accounts)]
pub struct UpdatePlatformSettings<'info> {
    #[account(
        mut,
        seeds = [b"app_factory"],
        bump = app_factory.bump,
        has_one = authority @ AppFactoryError::UnauthorizedAuthority
    )]
    pub app_factory: Account<'info, AppFactory>,
    
    pub authority: Signer<'info>,
}

// ============================================================================
// Error Definitions
// ============================================================================

#[error_code]
pub enum AppFactoryError {
    #[msg("Invalid platform fee (must be <= 10000 basis points)")]
    InvalidPlatformFee,
    #[msg("Invalid price (must be > 0)")]
    InvalidPrice,
    #[msg("Invalid max supply (must be > 0)")]
    InvalidMaxSupply,
    #[msg("Metadata URI too long (max 100 characters)")]
    MetadataUriTooLong,
    #[msg("App is not active")]
    AppNotActive,
    #[msg("Maximum supply reached")]
    MaxSupplyReached,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Unauthorized creator")]
    UnauthorizedCreator,
    #[msg("Unauthorized authority")]
    UnauthorizedAuthority,
    #[msg("Invalid creator provided")]
    InvalidCreator,
    #[msg("Invalid treasury provided")]
    InvalidTreasury,
    #[msg("Invalid DEFAI mint provided")]
    InvalidDefaiMint,
}

// ============================================================================
// Events (New for 10/10)
// ============================================================================

#[event]
pub struct AppRegistered {
    pub app_id: u64,
    pub creator: Pubkey,
    pub sft_mint: Pubkey,
    pub price: u64,
    pub max_supply: u64,
    pub timestamp: i64,
}

#[event]
pub struct AppPurchased {
    pub app_id: u64,
    pub user: Pubkey,
    pub price: u64,
    pub platform_fee: u64,
    pub creator_amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct AppStatusChanged {
    pub app_id: u64,
    pub is_active: bool,
    pub timestamp: i64,
}

#[event]
pub struct PlatformSettingsUpdated {
    pub platform_fee_bps: Option<u16>,
    pub treasury: Option<Pubkey>,
    pub timestamp: i64,
}