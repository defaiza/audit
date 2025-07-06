use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use anchor_spl::associated_token::AssociatedToken;

declare_id!("5uSkqdymvdisnz5542buDEoriDsvopAwym9WpccuTpjg");

// Estate Seeds
pub const ESTATE_SEED: &[u8] = b"estate";
pub const RWA_SEED: &[u8] = b"rwa";
pub const COUNTER_SEED: &[u8] = b"counter";
pub const CLAIM_SEED: &[u8] = b"claim";
pub const ASSET_SUMMARY_SEED: &[u8] = b"asset_summary";
pub const RECOVERY_SEED: &[u8] = b"recovery";

// Joint Account Seeds
pub const JOINT_ACCOUNT_SEED: &[u8] = b"joint_account";
pub const AI_AGENT_SEED: &[u8] = b"ai_agent";

// Estate Constants
pub const MIN_INACTIVITY_PERIOD: i64 = 24 * 60 * 60; // 24 hours in seconds
pub const MAX_INACTIVITY_PERIOD: i64 = 300 * 365 * 24 * 60 * 60; // 300 years in seconds
pub const MIN_GRACE_PERIOD: i64 = 24 * 60 * 60; // 24 hours in seconds
pub const MAX_GRACE_PERIOD: i64 = 90 * 24 * 60 * 60; // 90 days in seconds
pub const MAX_BENEFICIARIES: u8 = 10;
pub const ESTATE_FEE: u64 = 100_000_000; // 0.1 SOL
pub const RWA_FEE: u64 = 10_000_000; // 0.01 SOL
pub const MIN_RENT_BALANCE: u64 = 890880; // Minimum rent-exempt balance for a basic account

// Joint Account Constants
pub const MAX_PROFIT_SHARE: u8 = 50; // Maximum AI agent profit share (50%)
pub const MIN_EMERGENCY_DELAY: u32 = 24; // 24 hours minimum
pub const MAX_EMERGENCY_DELAY: u32 = 168; // 7 days maximum

#[program]
pub mod defai_estate {
    use super::*;

    // ===== Estate Functions =====
    
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
        
        // Initialize joint account fields
        estate.has_joint_account = false;
        estate.joint_account_config = None;

        // Update global counter
        ctx.accounts.global_counter.count += 1;

        msg!("Estate #{} created", estate.estate_number);

        Ok(())
    }

    // ===== Joint Account Functions =====
    
    pub fn create_joint_account(
        ctx: Context<CreateJointAccount>,
        ai_agent: Pubkey,
        human_share: u8,
        strategy: TradingStrategy,
        stop_loss: Option<u8>,
        emergency_delay_hours: u32,
    ) -> Result<()> {
        let estate = &mut ctx.accounts.estate;
        let joint_account = &mut ctx.accounts.joint_account;
        
        require!(!estate.is_locked, EstateError::EstateLocked);
        require!(!estate.is_claimable, EstateError::EstateClaimable);
        require!(
            ctx.accounts.owner.key() == estate.owner,
            EstateError::UnauthorizedAccess
        );
        require!(!estate.has_joint_account, EstateError::JointAccountAlreadyExists);
        require!(
            human_share >= 50 && human_share <= 100,
            EstateError::InvalidProfitShare
        );
        require!(
            emergency_delay_hours >= MIN_EMERGENCY_DELAY && emergency_delay_hours <= MAX_EMERGENCY_DELAY,
            EstateError::InvalidEmergencyDelay
        );
        
        let clock = Clock::get()?;
        
        // Initialize joint account
        joint_account.estate = estate.key();
        joint_account.human_owner = ctx.accounts.owner.key();
        joint_account.ai_owner = ai_agent;
        joint_account.human_contribution = 0;
        joint_account.ai_contribution = 0;
        joint_account.total_value = 0;
        joint_account.profit = 0;
        joint_account.high_water_mark = 0;
        joint_account.human_share = human_share;
        joint_account.ai_share = 100 - human_share;
        joint_account.strategy = strategy;
        joint_account.stop_loss = stop_loss;
        joint_account.emergency_delay_hours = emergency_delay_hours;
        joint_account.emergency_withdrawal_initiated = false;
        joint_account.emergency_withdrawal_time = 0;
        joint_account.last_update_time = clock.unix_timestamp;
        joint_account.is_active = true;
        joint_account.created_at = clock.unix_timestamp;
        
        // Update estate
        estate.has_joint_account = true;
        estate.joint_account_config = Some(JointAccountConfig {
            joint_account_pubkey: ctx.accounts.joint_account.key(),
            ai_agent,
            human_share,
            strategy: strategy.clone(),
        });
        
        msg!(
            "Joint account created for Estate #{} with {}% human share",
            estate.estate_number,
            human_share
        );
        
        Ok(())
    }
    
    pub fn contribute_to_joint_account(
        ctx: Context<ContributeToJointAccount>,
        amount: u64,
    ) -> Result<()> {
        let joint_account = &mut ctx.accounts.joint_account;
        let estate = &ctx.accounts.estate;
        
        require!(joint_account.is_active, EstateError::JointAccountInactive);
        require!(!estate.is_locked, EstateError::EstateLocked);
        require!(!estate.is_claimable, EstateError::EstateClaimable);
        
        // Determine if contributor is human or AI
        let is_human = ctx.accounts.contributor.key() == joint_account.human_owner;
        let is_ai = ctx.accounts.contributor.key() == joint_account.ai_owner;
        
        require!(is_human || is_ai, EstateError::UnauthorizedContributor);
        
        // Transfer tokens
        let cpi_accounts = Transfer {
            from: ctx.accounts.contributor_token_account.to_account_info(),
            to: ctx.accounts.joint_account_vault.to_account_info(),
            authority: ctx.accounts.contributor.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount)?;
        
        // Update contributions
        if is_human {
            joint_account.human_contribution += amount;
        } else {
            joint_account.ai_contribution += amount;
        }
        
        joint_account.total_value += amount;
        joint_account.last_update_time = Clock::get()?.unix_timestamp;
        
        // Update estate if this is first contribution
        let estate = &mut ctx.accounts.estate;
        estate.check_in()?;
        
        msg!(
            "Contributed {} to joint account. Total value: {}",
            amount,
            joint_account.total_value
        );
        
        Ok(())
    }
    
    pub fn update_joint_account_value(
        ctx: Context<UpdateJointAccountValue>,
        new_total_value: u64,
    ) -> Result<()> {
        let joint_account = &mut ctx.accounts.joint_account;
        
        require!(
            ctx.accounts.ai_agent.key() == joint_account.ai_owner,
            EstateError::UnauthorizedAccess
        );
        require!(joint_account.is_active, EstateError::JointAccountInactive);
        
        let old_value = joint_account.total_value;
        joint_account.total_value = new_total_value;
        
        // Calculate profit
        let total_contributions = joint_account.human_contribution + joint_account.ai_contribution;
        if new_total_value > total_contributions {
            joint_account.profit = (new_total_value - total_contributions) as i64;
        } else {
            joint_account.profit = -((total_contributions - new_total_value) as i64);
        }
        
        // Update high water mark
        if new_total_value > joint_account.high_water_mark {
            joint_account.high_water_mark = new_total_value;
        }
        
        joint_account.last_update_time = Clock::get()?.unix_timestamp;
        
        msg!(
            "Joint account value updated from {} to {}. Profit: {}",
            old_value,
            new_total_value,
            joint_account.profit
        );
        
        Ok(())
    }
    
    pub fn distribute_joint_account_profits(
        ctx: Context<DistributeJointAccountProfits>,
    ) -> Result<()> {
        let joint_account = &mut ctx.accounts.joint_account;
        
        require!(joint_account.is_active, EstateError::JointAccountInactive);
        require!(joint_account.profit > 0, EstateError::NoProfitsToDistribute);
        
        // Calculate distributable profit (above high water mark)
        let distributable_profit = if joint_account.total_value > joint_account.high_water_mark {
            joint_account.total_value - joint_account.high_water_mark
        } else {
            0
        };
        
        require!(distributable_profit > 0, EstateError::NoProfitsToDistribute);
        
        // Calculate shares
        let human_profit_share = (distributable_profit as u128)
            .checked_mul(joint_account.human_share as u128)
            .unwrap()
            .checked_div(100)
            .unwrap() as u64;
        let ai_profit_share = distributable_profit - human_profit_share;
        
        // Transfer profits
        // Human share
        if human_profit_share > 0 {
            let transfer_to_human = Transfer {
                from: ctx.accounts.joint_account_vault.to_account_info(),
                to: ctx.accounts.human_token_account.to_account_info(),
                authority: ctx.accounts.joint_account.to_account_info(),
            };
            let seeds = &[
                JOINT_ACCOUNT_SEED,
                joint_account.estate.as_ref(),
                joint_account.human_owner.as_ref(),
                joint_account.ai_owner.as_ref(),
                &[ctx.bumps.joint_account],
            ];
            let signer = &[&seeds[..]];
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                transfer_to_human,
                signer,
            );
            token::transfer(cpi_ctx, human_profit_share)?;
        }
        
        // AI share
        if ai_profit_share > 0 {
            let transfer_to_ai = Transfer {
                from: ctx.accounts.joint_account_vault.to_account_info(),
                to: ctx.accounts.ai_token_account.to_account_info(),
                authority: ctx.accounts.joint_account.to_account_info(),
            };
            let seeds = &[
                JOINT_ACCOUNT_SEED,
                joint_account.estate.as_ref(),
                joint_account.human_owner.as_ref(),
                joint_account.ai_owner.as_ref(),
                &[ctx.bumps.joint_account],
            ];
            let signer = &[&seeds[..]];
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                transfer_to_ai,
                signer,
            );
            token::transfer(cpi_ctx, ai_profit_share)?;
        }
        
        // Update joint account
        joint_account.high_water_mark = joint_account.total_value;
        joint_account.total_value -= distributable_profit;
        joint_account.last_update_time = Clock::get()?.unix_timestamp;
        
        msg!(
            "Distributed profits - Human: {}, AI: {}",
            human_profit_share,
            ai_profit_share
        );
        
        Ok(())
    }
    
    pub fn initiate_emergency_withdrawal(
        ctx: Context<InitiateEmergencyWithdrawal>,
    ) -> Result<()> {
        let joint_account = &mut ctx.accounts.joint_account;
        let clock = Clock::get()?;
        
        require!(
            ctx.accounts.human_owner.key() == joint_account.human_owner,
            EstateError::UnauthorizedAccess
        );
        require!(joint_account.is_active, EstateError::JointAccountInactive);
        require!(
            !joint_account.emergency_withdrawal_initiated,
            EstateError::EmergencyWithdrawalAlreadyInitiated
        );
        
        joint_account.emergency_withdrawal_initiated = true;
        joint_account.emergency_withdrawal_time = clock.unix_timestamp + 
            (joint_account.emergency_delay_hours as i64 * 60 * 60);
        
        msg!(
            "Emergency withdrawal initiated. Can execute after {}",
            joint_account.emergency_withdrawal_time
        );
        
        Ok(())
    }
    
    pub fn execute_emergency_withdrawal(
        ctx: Context<ExecuteEmergencyWithdrawal>,
    ) -> Result<()> {
        let joint_account = &mut ctx.accounts.joint_account;
        let clock = Clock::get()?;
        
        require!(
            ctx.accounts.human_owner.key() == joint_account.human_owner,
            EstateError::UnauthorizedAccess
        );
        require!(
            joint_account.emergency_withdrawal_initiated,
            EstateError::EmergencyWithdrawalNotInitiated
        );
        require!(
            clock.unix_timestamp >= joint_account.emergency_withdrawal_time,
            EstateError::EmergencyWithdrawalNotReady
        );
        
        // Calculate human's proportional share
        let total_contributions = joint_account.human_contribution + joint_account.ai_contribution;
        let human_proportion = if total_contributions > 0 {
            (joint_account.human_contribution as u128)
                .checked_mul(joint_account.total_value as u128)
                .unwrap()
                .checked_div(total_contributions as u128)
                .unwrap() as u64
        } else {
            0
        };
        
        // Transfer funds
        if human_proportion > 0 {
            let transfer_ix = Transfer {
                from: ctx.accounts.joint_account_vault.to_account_info(),
                to: ctx.accounts.human_token_account.to_account_info(),
                authority: ctx.accounts.joint_account.to_account_info(),
            };
            let seeds = &[
                JOINT_ACCOUNT_SEED,
                joint_account.estate.as_ref(),
                joint_account.human_owner.as_ref(),
                joint_account.ai_owner.as_ref(),
                &[ctx.bumps.joint_account],
            ];
            let signer = &[&seeds[..]];
            let cpi_ctx = CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                transfer_ix,
                signer,
            );
            token::transfer(cpi_ctx, human_proportion)?;
        }
        
        // Deactivate joint account
        joint_account.is_active = false;
        joint_account.total_value = 0;
        
        // Update estate
        let estate = &mut ctx.accounts.estate;
        estate.has_joint_account = false;
        estate.joint_account_config = None;
        
        msg!("Emergency withdrawal executed. Withdrawn: {}", human_proportion);
        
        Ok(())
    }

    // ===== Existing Estate Functions Continue =====
    
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

    // Additional estate functions would continue here...
}

// ===== Structs and Accounts =====

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct Beneficiary {
    pub address: Pubkey,
    pub email_hash: [u8; 32],
    pub share_percentage: u8,
    pub claimed: bool,
    pub notification_sent: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum TradingStrategy {
    Conservative,
    Balanced,
    Aggressive,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct JointAccountConfig {
    pub joint_account_pubkey: Pubkey,
    pub ai_agent: Pubkey,
    pub human_share: u8,
    pub strategy: TradingStrategy,
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
    // Joint account fields
    pub has_joint_account: bool,
    pub joint_account_config: Option<JointAccountConfig>,
}

impl Estate {
    pub fn check_in(&mut self) -> Result<()> {
        self.last_active = Clock::get()?.unix_timestamp;
        self.is_claimable = false;
        Ok(())
    }
}

#[account]
pub struct JointAccount {
    pub estate: Pubkey,
    pub human_owner: Pubkey,
    pub ai_owner: Pubkey,
    pub human_contribution: u64,
    pub ai_contribution: u64,
    pub total_value: u64,
    pub profit: i64,
    pub high_water_mark: u64,
    pub human_share: u8,
    pub ai_share: u8,
    pub strategy: TradingStrategy,
    pub stop_loss: Option<u8>,
    pub emergency_delay_hours: u32,
    pub emergency_withdrawal_initiated: bool,
    pub emergency_withdrawal_time: i64,
    pub last_update_time: i64,
    pub is_active: bool,
    pub created_at: i64,
}

#[account]
pub struct GlobalCounter {
    pub count: u64,
}

// ===== Contexts =====

#[derive(Accounts)]
pub struct InitializeGlobalCounter<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    
    #[account(
        init,
        payer = admin,
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
        space = 8 + 32 + 32 + 32 + 8 + 8 + 8 + (4 + 10 * (32 + 32 + 1 + 1 + 1)) + 1 + 8 + 8 + 1 + 1 + 4 + 8 + 1 + 1 + 100,
        seeds = [ESTATE_SEED, owner.key().as_ref(), global_counter.count.to_le_bytes().as_ref()],
        bump
    )]
    pub estate: Account<'info, Estate>,
    
    #[account(mut)]
    pub global_counter: Account<'info, GlobalCounter>,
    
    /// CHECK: Estate mint for unique identification
    pub estate_mint: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CreateJointAccount<'info> {
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
        space = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 8 + 8 + 1 + 1 + 32 + 1 + 4 + 1 + 8 + 8 + 1 + 8,
        seeds = [
            JOINT_ACCOUNT_SEED,
            estate.key().as_ref(),
            owner.key().as_ref(),
            // AI agent will be passed as parameter
        ],
        bump
    )]
    pub joint_account: Account<'info, JointAccount>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ContributeToJointAccount<'info> {
    #[account(mut)]
    pub contributor: Signer<'info>,
    
    pub estate: Account<'info, Estate>,
    
    #[account(
        mut,
        has_one = estate,
    )]
    pub joint_account: Account<'info, JointAccount>,
    
    #[account(
        mut,
        token::mint = token_mint,
        token::authority = contributor,
    )]
    pub contributor_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        token::mint = token_mint,
        token::authority = joint_account,
    )]
    pub joint_account_vault: Account<'info, TokenAccount>,
    
    pub token_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct UpdateJointAccountValue<'info> {
    pub ai_agent: Signer<'info>,
    
    #[account(
        mut,
        constraint = joint_account.ai_owner == ai_agent.key(),
    )]
    pub joint_account: Account<'info, JointAccount>,
}

#[derive(Accounts)]
pub struct DistributeJointAccountProfits<'info> {
    pub authority: Signer<'info>,
    
    #[account(
        mut,
        seeds = [
            JOINT_ACCOUNT_SEED,
            joint_account.estate.as_ref(),
            joint_account.human_owner.as_ref(),
            joint_account.ai_owner.as_ref(),
        ],
        bump,
    )]
    pub joint_account: Account<'info, JointAccount>,
    
    #[account(
        mut,
        token::mint = token_mint,
        token::authority = joint_account,
    )]
    pub joint_account_vault: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        token::mint = token_mint,
        token::authority = joint_account.human_owner,
    )]
    pub human_token_account: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        token::mint = token_mint,
        token::authority = joint_account.ai_owner,
    )]
    pub ai_token_account: Account<'info, TokenAccount>,
    
    pub token_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct InitiateEmergencyWithdrawal<'info> {
    pub human_owner: Signer<'info>,
    
    #[account(
        mut,
        constraint = joint_account.human_owner == human_owner.key(),
    )]
    pub joint_account: Account<'info, JointAccount>,
}

#[derive(Accounts)]
pub struct ExecuteEmergencyWithdrawal<'info> {
    pub human_owner: Signer<'info>,
    
    #[account(
        mut,
        has_one = human_owner,
    )]
    pub estate: Account<'info, Estate>,
    
    #[account(
        mut,
        has_one = human_owner,
        has_one = estate,
        seeds = [
            JOINT_ACCOUNT_SEED,
            joint_account.estate.as_ref(),
            joint_account.human_owner.as_ref(),
            joint_account.ai_owner.as_ref(),
        ],
        bump,
    )]
    pub joint_account: Account<'info, JointAccount>,
    
    #[account(
        mut,
        token::mint = token_mint,
        token::authority = joint_account,
    )]
    pub joint_account_vault: Account<'info, TokenAccount>,
    
    #[account(
        mut,
        token::mint = token_mint,
        token::authority = human_owner,
    )]
    pub human_token_account: Account<'info, TokenAccount>,
    
    pub token_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
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

// ===== Errors =====

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
    // Joint Account Errors
    #[msg("Joint account already exists for this estate")]
    JointAccountAlreadyExists,
    #[msg("Invalid profit share. Human share must be between 50-100%")]
    InvalidProfitShare,
    #[msg("Invalid emergency delay. Must be between 24 hours and 7 days")]
    InvalidEmergencyDelay,
    #[msg("Joint account is inactive")]
    JointAccountInactive,
    #[msg("Unauthorized contributor")]
    UnauthorizedContributor,
    #[msg("No profits to distribute")]
    NoProfitsToDistribute,
    #[msg("Emergency withdrawal already initiated")]
    EmergencyWithdrawalAlreadyInitiated,
    #[msg("Emergency withdrawal not initiated")]
    EmergencyWithdrawalNotInitiated,
    #[msg("Emergency withdrawal delay not yet expired")]
    EmergencyWithdrawalNotReady,
}