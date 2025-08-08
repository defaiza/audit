use anchor_lang::prelude::*;
use crate::Config;

// VRF State to store randomness results
#[account]
pub struct VrfState {
    pub bump: u8,
    pub result_buffer: [u8; 32],
    pub last_timestamp: i64,
    pub vrf_account: Pubkey,
    pub oracle_queue: Pubkey,
    pub queue_authority: Pubkey,
    pub data_buffer: Pubkey,
    pub permission: Pubkey,
    pub escrow: Pubkey,
    pub payer_wallet: Pubkey,
}

impl VrfState {
    // Does not include the 8-byte discriminator
    pub const LEN: usize = 1 + 32 + 8 + 32 + (32 * 6);
}

#[derive(Accounts)]
pub struct InitializeVrf<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    
    #[account(
        init,
        payer = authority,
        space = VrfState::LEN,
        seeds = [b"vrf_state"],
        bump
    )]
    pub vrf_state: Account<'info, VrfState>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RequestRandomness<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, Config>,
    
    #[account(
        mut,
        seeds = [b"vrf_state"],
        bump = vrf_state.bump
    )]
    pub vrf_state: Account<'info, VrfState>,
    
    /// CHECK: Switchboard VRF account
    pub vrf: AccountInfo<'info>,
    
    /// CHECK: Oracle queue account
    pub oracle_queue: AccountInfo<'info>,
    
    /// CHECK: Queue authority
    pub queue_authority: AccountInfo<'info>,
    
    /// CHECK: Data buffer
    pub data_buffer: AccountInfo<'info>,
    
    /// CHECK: Permission account
    pub permission: AccountInfo<'info>,
    
    /// CHECK: Escrow account
    pub escrow: AccountInfo<'info>,
    
    /// CHECK: Payer token wallet
    pub payer_wallet: AccountInfo<'info>,
    
    /// CHECK: Recent blockhashes
    pub recent_blockhashes: AccountInfo<'info>,
    
    /// CHECK: Switchboard program
    pub switchboard_program: AccountInfo<'info>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct ConsumeRandomness<'info> {
    #[account(
        mut,
        seeds = [b"vrf_state"],
        bump = vrf_state.bump
    )]
    pub vrf_state: Account<'info, VrfState>,
    
    /// CHECK: VRF account that must match stored account
    #[account(constraint = vrf.key() == vrf_state.vrf_account)]
    pub vrf: AccountInfo<'info>,
}

use anchor_spl::token::Token;

pub fn initialize_vrf(ctx: Context<InitializeVrf>, vrf_account: Pubkey) -> Result<()> {
    let vrf_state = &mut ctx.accounts.vrf_state;
    vrf_state.bump = ctx.bumps.vrf_state;
    vrf_state.result_buffer = [0u8; 32];
    vrf_state.last_timestamp = 0;
    vrf_state.vrf_account = vrf_account;
    vrf_state.oracle_queue = Pubkey::default();
    vrf_state.queue_authority = Pubkey::default();
    vrf_state.data_buffer = Pubkey::default();
    vrf_state.permission = Pubkey::default();
    vrf_state.escrow = Pubkey::default();
    vrf_state.payer_wallet = Pubkey::default();
    
    msg!("VRF state initialized with account: {}", vrf_account);
    Ok(())
}

pub fn request_randomness(ctx: Context<RequestRandomness>) -> Result<()> {
    // Admin-gated configuration on first request, and strict validation thereafter
    require_keys_eq!(ctx.accounts.authority.key(), ctx.accounts.config.admin, crate::ErrorCode::Unauthorized);
    
    let vrf_state = &mut ctx.accounts.vrf_state;
    // Bootstrap config if not set; otherwise enforce exact match
    if vrf_state.oracle_queue == Pubkey::default() {
        vrf_state.oracle_queue = ctx.accounts.oracle_queue.key();
        vrf_state.queue_authority = ctx.accounts.queue_authority.key();
        vrf_state.data_buffer = ctx.accounts.data_buffer.key();
        vrf_state.permission = ctx.accounts.permission.key();
        vrf_state.escrow = ctx.accounts.escrow.key();
        vrf_state.payer_wallet = ctx.accounts.payer_wallet.key();
    } else {
        require_keys_eq!(ctx.accounts.oracle_queue.key(), vrf_state.oracle_queue, VrfError::InvalidVrfAccount);
        require_keys_eq!(ctx.accounts.queue_authority.key(), vrf_state.queue_authority, VrfError::InvalidVrfAccount);
        require_keys_eq!(ctx.accounts.data_buffer.key(), vrf_state.data_buffer, VrfError::InvalidVrfAccount);
        require_keys_eq!(ctx.accounts.permission.key(), vrf_state.permission, VrfError::InvalidVrfAccount);
        require_keys_eq!(ctx.accounts.escrow.key(), vrf_state.escrow, VrfError::InvalidVrfAccount);
        require_keys_eq!(ctx.accounts.payer_wallet.key(), vrf_state.payer_wallet, VrfError::InvalidVrfAccount);
    }

    // In production: make a CPI to Switchboard VRF program using the provided accounts
    msg!("Randomness requested from VRF account: {}", ctx.accounts.vrf.key());
    
    // Update the timestamp to track when request was made
    vrf_state.last_timestamp = Clock::get()?.unix_timestamp;
    
    Ok(())
}

pub fn consume_randomness(ctx: Context<ConsumeRandomness>) -> Result<()> {
    let vrf_state = &mut ctx.accounts.vrf_state;
    let clock = Clock::get()?;
    
    // In production, this would read the result from the VRF account
    // For demonstration, we'll simulate receiving a random value
    // Real implementation would parse the VRF account data
    
    // Check if enough time has passed (simulate VRF processing time)
    require!(
        clock.unix_timestamp > vrf_state.last_timestamp + 2,
        VrfError::ResultNotReady
    );
    
    // In production: Parse VRF account data to get the random result
    // let vrf_data = ctx.accounts.vrf.try_borrow_data()?;
    // vrf_state.result_buffer = parse_vrf_result(&vrf_data);
    
    msg!("VRF randomness consumed and stored");
    Ok(())
}

#[error_code]
pub enum VrfError {
    #[msg("VRF result not ready")]
    ResultNotReady,
    #[msg("Invalid VRF account")]
    InvalidVrfAccount,
}