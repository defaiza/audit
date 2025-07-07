use anchor_lang::prelude::*;
use anchor_spl::token::{Token, Mint, TokenAccount, mint_to, MintTo, transfer, Transfer};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("4cxwMECNtqo5CEFYEU5aArZDL5CUs64H1imobByYA261");

#[program]
pub mod defai_app_factory {
    use super::*;

    /// Initialize the app factory program
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

        msg!("App Factory initialized with {}% platform fee", platform_fee_bps as f64 / 100.0);
        Ok(())
    }

    /// Register a new app and create its SFT mint
    pub fn register_app(
        ctx: Context<RegisterApp>,
        price: u64,
        max_supply: u64,
        metadata_uri: String,
    ) -> Result<()> {
        require!(price > 0, AppFactoryError::InvalidPrice);
        require!(max_supply > 0, AppFactoryError::InvalidMaxSupply);
        require!(metadata_uri.len() <= 200, AppFactoryError::MetadataUriTooLong);

        let app_factory = &mut ctx.accounts.app_factory;
        let app_registration = &mut ctx.accounts.app_registration;
        
        // Increment app counter
        app_factory.total_apps = app_factory.total_apps.checked_add(1)
            .ok_or(AppFactoryError::MathOverflow)?;
        
        let app_id = app_factory.total_apps;

        // Initialize app registration
        app_registration.app_id = app_id;
        app_registration.creator = ctx.accounts.creator.key();
        app_registration.sft_mint = ctx.accounts.sft_mint.key();
        app_registration.price = price;
        app_registration.max_supply = max_supply;
        app_registration.current_supply = 0;
        app_registration.is_active = true;
        app_registration.metadata_uri = metadata_uri;
        app_registration.created_at = Clock::get()?.unix_timestamp;
        app_registration.bump = ctx.bumps.app_registration;

        msg!("App {} registered by creator {}", app_id, ctx.accounts.creator.key());
        Ok(())
    }

    /// Purchase app access (mint SFT to user)
    pub fn purchase_app_access(
        ctx: Context<PurchaseAppAccess>,
        app_id: u64,
    ) -> Result<()> {
        // First, do all the reads and validations without mutable borrow
        require!(ctx.accounts.app_registration.is_active, AppFactoryError::AppNotActive);
        require!(
            ctx.accounts.app_registration.current_supply < ctx.accounts.app_registration.max_supply,
            AppFactoryError::MaxSupplyReached
        );

        // Validate that the provided accounts match the registration
        require!(
            ctx.accounts.creator.key() == ctx.accounts.app_registration.creator,
            AppFactoryError::InvalidCreator
        );
        require!(
            ctx.accounts.treasury.key() == ctx.accounts.app_factory.treasury,
            AppFactoryError::InvalidTreasury
        );
        require!(
            ctx.accounts.defai_mint.key() == ctx.accounts.app_factory.defai_mint,
            AppFactoryError::InvalidDefaiMint
        );

        let total_price = ctx.accounts.app_registration.price;
        let app_factory = &ctx.accounts.app_factory;
        
        // Calculate revenue split (80% creator, 20% platform)
        let creator_amount = total_price
            .checked_mul(10000 - app_factory.platform_fee_bps as u64)
            .ok_or(AppFactoryError::MathOverflow)?
            .checked_div(10000)
            .ok_or(AppFactoryError::MathOverflow)?;
        
        let platform_amount = total_price
            .checked_sub(creator_amount)
            .ok_or(AppFactoryError::MathOverflow)?;

        // Transfer DEFAI tokens to creator
        if creator_amount > 0 {
            transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.user_defai_ata.to_account_info(),
                        to: ctx.accounts.creator_defai_ata.to_account_info(),
                        authority: ctx.accounts.user.to_account_info(),
                    },
                ),
                creator_amount,
            )?;
        }

        // Transfer DEFAI tokens to treasury
        if platform_amount > 0 {
            transfer(
                CpiContext::new(
                    ctx.accounts.token_program.to_account_info(),
                    Transfer {
                        from: ctx.accounts.user_defai_ata.to_account_info(),
                        to: ctx.accounts.treasury_defai_ata.to_account_info(),
                        authority: ctx.accounts.user.to_account_info(),
                    },
                ),
                platform_amount,
            )?;
        }

        // Get the bump before borrowing mutably
        let app_reg_bump = ctx.accounts.app_registration.bump;
        
        // Mint SFT to user
        let app_registration_seeds = &[
            b"app_registration".as_ref(),
            &app_id.to_le_bytes(),
            &[app_reg_bump],
        ];
        
        mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.sft_mint.to_account_info(),
                    to: ctx.accounts.user_sft_ata.to_account_info(),
                    authority: ctx.accounts.app_registration.to_account_info(),
                },
                &[app_registration_seeds],
            ),
            1, // Mint 1 SFT for app access
        )?;

        // Now do mutable operations
        let app_registration = &mut ctx.accounts.app_registration;
        app_registration.current_supply = app_registration.current_supply
            .checked_add(1)
            .ok_or(AppFactoryError::MathOverflow)?;

        // Initialize user app access record
        let user_app_access = &mut ctx.accounts.user_app_access;
        user_app_access.user = ctx.accounts.user.key();
        user_app_access.app_id = app_id;
        user_app_access.sft_token_account = ctx.accounts.user_sft_ata.key();
        user_app_access.purchased_at = Clock::get()?.unix_timestamp;
        user_app_access.bump = ctx.bumps.user_app_access;

        msg!("User {} purchased access to app {} for {} DEFAI", 
            ctx.accounts.user.key(), app_id, total_price);
        
        Ok(())
    }

    /// Update app status (enable/disable)
    pub fn toggle_app_status(
        ctx: Context<ToggleAppStatus>,
        app_id: u64,
    ) -> Result<()> {
        let app_registration = &mut ctx.accounts.app_registration;
        app_registration.is_active = !app_registration.is_active;
        
        msg!("App {} status changed to: {}", app_id, app_registration.is_active);
        Ok(())
    }

    /// Update platform settings (admin only)
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
    pub const LEN: usize = 8 + 8 + 32 + 32 + 8 + 8 + 8 + 1 + (4 + 200) + 8 + 1; // ~300 bytes
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
        seeds = [b"app_registration".as_ref(), &(app_factory.total_apps + 1).to_le_bytes()],
        bump
    )]
    pub app_registration: Account<'info, AppRegistration>,
    
    #[account(
        init,
        payer = creator,
        mint::decimals = 0,
        mint::authority = app_registration,
        mint::freeze_authority = app_registration,
    )]
    pub sft_mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub creator: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(app_id: u64)]
pub struct PurchaseAppAccess<'info> {
    #[account(
        seeds = [b"app_factory"],
        bump = app_factory.bump
    )]
    pub app_factory: Account<'info, AppFactory>,
    
    #[account(
        mut,
        seeds = [b"app_registration".as_ref(), &app_id.to_le_bytes()],
        bump = app_registration.bump
    )]
    pub app_registration: Account<'info, AppRegistration>,
    
    #[account(
        init,
        payer = user,
        space = UserAppAccess::LEN,
        seeds = [b"user_app_access".as_ref(), user.key().as_ref(), &app_id.to_le_bytes()],
        bump
    )]
    pub user_app_access: Account<'info, UserAppAccess>,
    
    #[account(
        mut,
        address = app_registration.sft_mint
    )]
    pub sft_mint: Account<'info, Mint>,
    
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = sft_mint,
        associated_token::authority = user,
    )]
    pub user_sft_ata: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        associated_token::mint = defai_mint,
        associated_token::authority = user,
    )]
    pub user_defai_ata: Account<'info, TokenAccount>,
    
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = defai_mint,
        associated_token::authority = creator,
    )]
    pub creator_defai_ata: Account<'info, TokenAccount>,
    
    #[account(
        init_if_needed,
        payer = user,
        associated_token::mint = defai_mint,
        associated_token::authority = treasury,
    )]
    pub treasury_defai_ata: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    /// CHECK: DEFAI mint for associated token accounts
    pub defai_mint: AccountInfo<'info>,
    
    /// CHECK: Creator for associated token account
    pub creator: AccountInfo<'info>,
    
    /// CHECK: Treasury for associated token account  
    pub treasury: AccountInfo<'info>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

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
    #[msg("Metadata URI too long (max 200 characters)")]
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