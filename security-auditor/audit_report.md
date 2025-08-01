Staking
01-Medium-Combination of State Update  Leads to Permanent Loss of Funds
Description:
The protocol has a critical design flaw: the core stake_tokens function lacks address validation for the Vault account, while the update_defai_mint function allows an administrator to change the official token recorded in the program's state. This combination creates a scenario where funds can be permanently locked.
Technical Risk Analysis
During a routine operation intended to upgrade the protocol to support a new token, this vulnerability leads to a catastrophic outcome:
1. Staking Succeeds: A project owner can create a new vault associated with a new token and guide users to stake into it via the frontend. Because the stake_tokens function does not validate the vault address and the transfer is authorized by the user, this transaction is completed successfully.
  - Code Analysis : The StakeTokens context lacks a PDA check on stake_vault, and the transfer authority is the user, allowing tokens to be sent to any account.
#[derive(Accounts)]
pub struct StakeTokens<'info> {
    // ...
    #[account(mut)] // Missing PDA validation allows any vault address
    pub stake_vault: InterfaceAccount<'info, TokenAccount>,
    // ...
}

// ... in stake_tokens function
let transfer_ctx = CpiContext::new(
    ctx.accounts.token_program.to_account_info(),
    TransferChecked {
        to: ctx.accounts.stake_vault.to_account_info(), // Can point to the new_vault
        authority: ctx.accounts.user.to_account_info(), // Authority is the user
        // ...
    },
);
2. Withdrawal Fails: When a user attempts to withdraw their assets, the unstake_tokens function will fail. This is because the program's withdrawal signing logic is hardcoded to generate a signature only for the original, official vault. The signature is derived from program_state.key(), which is immutable after creation, making it impossible for the program to sign for the new vault.
  - Code Analysis: The unstake_tokens function's signing logic is hardcoded. Its seeds depend on program_state.key(), which is a constant address, so it can only sign for the original vault.
// ... in unstake_tokens function
let program_state_key = ctx.accounts.program_state.key(); // This key is constant
let seeds = &[
    b"stake-vault",
    program_state_key.as_ref(), // This part of the seed is constant
    &[ctx.accounts.program_state.vault_bump],
];
let signer = &[&seeds[..]]; // The signer always represents the original vault

let transfer_ctx = CpiContext::new_with_signer(
    // ...
    signer, // This signature cannot authorize operations on the new_vault
);
Impact:
All funds deposited into the new vault will be permanently locked and unrecoverable.

Recommendation:
Enforce Account Validation: In all functions that interact with funds , a PDA constraint must be added to strictly validate the vault address.
Remove Risky Function: Completely remove the update_defai_mint function. A token migration should be handled through a comprehensive solution that includes a fund migration strategy, not a simple state update.


02-Medium-Penalty logic in unstake_tokens can be bypassed
Description:
The calculate_unstake_penalty function determines the penalty based on the stake_timestamp (the time of the initial stake). If a user adds more funds via stake_tokens after their initial stake, the new funds are considered as "old" as the first deposit because the stake_timestamp is only set once and not updated on subsequent stakes.
The calculate_unstake_penalty function relies solely on the initial stake_timestamp:

fn calculate_unstake_penalty(
    stake_timestamp: i64,
    current_timestamp: i64,
    amount: u64,
) -> Result<u64> {
    let days_staked = (current_timestamp - stake_timestamp) / 86400;
    
    let penalty_bps = if days_staked < 30 {
        200  // 2%
    } else if days_staked < 90 {
        100  // 1%
    } else {
        0    // No penalty
    };
    
    Ok((amount as u128 * penalty_bps as u128 / BASIS_POINTS as u128) as u64)
}

fn calculate_rewards(
    staked_amount: u64,
    tier_apy_bps: u16,
    last_claim_timestamp: i64,
    current_timestamp: i64,
) -> Result<u64> {
    let time_elapsed = (current_timestamp - last_claim_timestamp) as u64;
    
    // Calculate rewards: amount * apy * time / (year * basis_points)
    let rewards = (staked_amount as u128)
        .checked_mul(tier_apy_bps as u128).unwrap()
        .checked_mul(time_elapsed as u128).unwrap()
        .checked_div(SECONDS_PER_YEAR as u128).unwrap()
        .checked_div(BASIS_POINTS as u128).unwrap() as u64;
    
    Ok(rewards)
}

In the stake_tokens function, this stake_timestamp is not updated when a user adds to their position:
pub fn stake_tokens(/* ... */) -> Result<()> {
    // ...
    if user_stake.owner == Pubkey::default() {
        // New user stake
        //...
        
        user_stake.stake_timestamp = clock.unix_timestamp; 
        
        //...
    } else {
        // Existing user adds to stake
        //...
        
        user_stake.staked_amount = user_stake.staked_amount.checked_add(amount).unwrap();
        
        //...
    }
    // ...
    Ok(())
}

Impact:
This vulnerability allows an attacker to bypass the early unstake penalty by first staking a small amount to "age" their account. After waiting 90 days to gain penalty-free status, they can then deposit a much larger sum, earn short-term rewards on this large capital, and immediately withdraw everything—including the new principal and its rewards—with zero penalty, completely nullifying the economic model designed to encourage long-term holding.
Recommendation:
Given the implementation complexity of such a system, a simpler improvement is to add a last_stake_timestamp field to the UserStake struct. This timestamp will be updated every time a user adds to their stake, and the penalty calculation should use this most recent timestamp.This would at least ensure that any newly added funds must also wait for the required duration to become penalty-free.

03-High-Unvalidated Accounts in fund_escrow Lead to State Pollution and Protocol Insolvency
Description
The fund_escrow function, which allows anyone to add funds to the reward pool, fails to apply strict constraints to the escrow_token_account and defai_mint accounts passed into its context, FundEscrow.
An attacker can exploit this by passing in a malicious token (evil_mint) they created, along with its corresponding token account (ATA). Although the genuine reward_escrow PDA cannot be forged, the program will erroneously add the amount of the malicious tokens to the total_balance state of the genuine reward_escrow account. This leads to a pollution of the protocol's state.
Relevant Code Snippets ：
1. Vulnerable Context Struct: escrow_token_account and defai_mint have no constraint attributes.

#[derive(Accounts)]
pub struct FundEscrow<'info> {
    #[account(mut)]
    pub reward_escrow: Account<'info, RewardEscrow>,

    #[account(mut)]
    pub escrow_token_account: InterfaceAccount<'info, TokenAccount>, // Attacker controlled

    #[account(mut)]
    pub funder_token_account: InterfaceAccount<'info, TokenAccount>, // Attacker controlled

    #[account(mut)]
    pub funder: Signer<'info>,

    pub defai_mint: InterfaceAccount<'info, Mint>, // Attacker controlled
    pub token_program: Interface<'info, TokenInterface>,
}
2. State Pollution Logic: The function adds the transfer amount directly to the real reward_escrow.total_balance.
pub fn fund_escrow(ctx: Context<FundEscrow>, amount: u64) -> Result<()> {
    // ...
    // The transfer succeeds because all mints match the attacker's evil_mint
    transfer_checked(transfer_ctx, amount, ctx.accounts.defai_mint.decimals)?;

    // Critical vulnerability: The amount of malicious tokens is added to the state of the genuine escrow account
    let escrow = &mut ctx.accounts.reward_escrow;
    escrow.total_balance = escrow.total_balance.checked_add(amount).unwrap();
    // ...
    Ok(())
}
Impact
This is a critical vulnerability that allows an attacker to destroy the protocol's economic model through state pollution, ultimately enabling the theft of all users' stake funds.
The maliciously inflated reward_escrow.total_balance invalidates all functions that rely on this value for security checks. The most devastating attack vector is through the compound_rewards function:
1. State Pollution: Attacker creates a fake token and uses fund_escrow to artificially inflate the reward_escrow.total_balance by injecting worthless tokens while updating the real escrow's balance record.
2. By draining the actual reward pool, the attacker uses the falsified balance to cause legitimate user claims to fail, creating a Denial of Service that blocks them from their rightful earnings.
Recommendation
It is imperative to add strict account constraints to the FundEscrow context to ensure that all incoming accounts match the authoritative addresses stored in the program's state.
#[derive(Accounts)]pub struct FundEscrow<'info> {
    // 1. Bring in ProgramState to access authoritative addressespub program_state: Account<'info, ProgramState>,

    #[account(
        mut,
        // 2. Ensure reward_escrow is the correct PDA
        seeds = [b"reward-escrow", program_state.key().as_ref()],
        bump
    )]
    pub reward_escrow: Account<'info, RewardEscrow>,

    #[account(
        mut,
        // 3. Ensure escrow_token_account is the correct ATA and is owned by reward_escrow
        seeds = [b"escrow-vault", program_state.key().as_ref()],
        bump,
        token::authority = reward_escrow,
        token::mint = defai_mint, // 4. Ensure the ATA's mint matches the provided mint
    )]
    pub escrow_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]pub funder_token_account: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]pub funder: Signer<'info>,

    #[account(
        // 5. Ensure the provided mint is the official one from ProgramState
        constraint = defai_mint.key() == program_state.defai_mint @ StakingError::InvalidMint
    )]pub defai_mint: InterfaceAccount<'info, Mint>,
    
    pub token_program: Interface<'info, TokenInterface>,
}
04-High-Unvalidated Accounts in unstake_tokens Allow Penalty Interception
Description
The unstake_tokens function, when processing penalties (penalty) generated from early withdrawals, fails to validate whether the receiving account for the penalty (escrow_token_account) is the official reward pool address. The function trusts the account address provided by the user, which allows any user performing an early unstake to supply an account they control, thereby intercepting the penalty fee that should have gone to the protocol.
1. Vulnerable Context Struct: escrow_token_account and reward_escrow lack strict seed or owner constraints.

#[derive(Accounts)]
pub struct UnstakeTokens<'info> {
    // ...
    #[account(mut)]
    pub reward_escrow: Account<'info, RewardEscrow>, //  Not validated as the official PDA

    #[account(mut)]
    pub escrow_token_account: InterfaceAccount<'info, TokenAccount>, //  Attacker-controlled
    // ...
}
2. Penalty Transfer Logic: The function transfers the penalty to the user-provided, unvalidated escrow_token_account.

if penalty > 0 {
    let transfer_penalty_ctx = CpiContext::new_with_signer(
        // ...
        TransferChecked {
            from: ctx.accounts.stake_vault.to_account_info(),      // Source: The real public vault
            to: ctx.accounts.escrow_token_account.to_account_info(), // Destination: Attacker's personal account
            authority: ctx.accounts.stake_vault.to_account_info(),  // Authority: The real public vault
            mint: ctx.accounts.defai_mint.to_account_info(),
        },
        signer, // Signature: The real vault's PDA signature
    );
    transfer_checked(transfer_penalty_ctx, penalty, ctx.accounts.defai_mint.decimals)?;
    // ...
}
Impact
This vulnerability allows users to directly steal penalty fees that are intended as protocol revenue. Any user executing an early unstake can exploit this method to intercept their own penalty payment. This breaks the economic model designed to discourage short-term speculation and replenish the reward pool. While the amount of a single attack is limited (only to the user's own generated penalty), it represents a direct and persistent theft of protocol revenue.
Recommendation
It is essential to add strict account constraints to the UnstakeTokens context to ensure that the provided reward_escrow and escrow_token_account are the official, unique PDA accounts of the protocol.

05-Low-Initialization Functions Lack Authority Validation
Description
In defai_staking/src/lib.rs, the critical initialization functions initialize_program and initialize_escrow lack validation for the caller's identity. They accept any signer as the authority without verifying if the signer is the intended protocol administrator.
While the program's PDA (Program Derived Address) mechanism ensures that these functions can only be successfully called once, this is still a lapse in access control and a deviation from security best practices.
1. initialize_program: Any signer (authority) can call this function to create the ProgramState.
#[derive(Accounts)]
pub struct InitializeProgram<'info> {
    #[account(
        init,
        payer = authority, // payer can be anyone
        // ...
    )]
    pub program_state: Account<'info, ProgramState>,

    // ...

    #[account(mut)]
    pub authority: Signer<'info>, // Lacks validation for the authority's identity
}
2. initialize_escrow: After program_state is initialized, any signer can call this function to create the reward_escrow, again without verifying if the caller is the program_state.authority.
#[derive(Accounts)]
pub struct InitializeEscrow<'info> {
    #[account(
        mut,
        seeds = [b"program-state"],
        bump
    )]
    pub program_state: Account<'info, ProgramState>,
    // ...
    #[account(mut)]
    pub authority: Signer<'info>, // Lacks validation for the authority's identity
}

Impact
The direct impact of this vulnerability is low, as these functions are intended to be called only once. However, it does introduce potential risks:
- Initialization Front-running: A malicious or random user could front-run the actual project administrator and call the initialize_program function first. This would cause the protocol to be initialized with an incorrect admin address, potentially forcing the project team to redeploy the entire contract, causing unnecessary complications and costs.
Recommendation
It is recommended to add proper authority validation to these functions to ensure only the legitimate protocol administrator can perform these critical initializations.

06-High-Unvalidated Escrow Account in compound_rewards Leads to State Pollution
Description
The compound_rewards function has a flaw where it fails to validate the address of the incoming reward_escrow account. It only checks if the account is mutable (#[account(mut)]) but does not use a PDA constraint to verify that it is the official, program-controlled escrow account.
This allows a caller to pass in a self-created, fake reward_escrow account containing false data to execute the compound instruction.
Relevant Code Snippets:
- Vulnerable Context Struct: In the CompoundRewards context, reward_escrow lacks seeds or constraint attributes.
#[derive(Accounts)]
pub struct CompoundRewards<'info> {
    // ...
    #[account(mut)] // Address of reward_escrow is not validated here
    pub reward_escrow: Account<'info, RewardEscrow>,
    // ...
}

The core risk of this vulnerability is state pollution using an external account's data.
1. Preparation: An attacker creates a fake RewardEscrow account and sets its total_balance to an arbitrarily large value.
2. State Pollution: The attacker calls the compound_rewards function, passing in the fake reward_escrow account.
  - The function first correctly calculates the total_unclaimed rewards owed to the attacker.
  - Next, the require! check reads the inflated total_balance from the fake account and successfully passes.
  - The function then incorrectly adds the legitimately calculated "reward" amount to the attacker's own user_stake.staked_amount and the global program_state.total_staked.
  - The Critical Flaw: The data of the real reward_escrow account is never modified. The program's accounting (increasing the user's stake) becomes decoupled from the actual state of the funds (the reward pool was not debited), causing state pollution.
// lib.rs -> compound_rewards
// The check passes because it uses the balance from the fake account
require!(
    ctx.accounts.reward_escrow.total_balance >= total_unclaimed,
    StakingError::InsufficientEscrowBalance
);

// The attacker's stake and the global stake are incorrectly increased
user_stake.staked_amount = user_stake.staked_amount
    .checked_add(total_unclaimed).unwrap();

program_state.total_staked = program_state.total_staked
    .checked_add(total_unclaimed).unwrap();

// The balance deduction is applied to the fake account; the real escrow is untouched
let escrow = &mut ctx.accounts.reward_escrow;
escrow.total_balance = escrow.total_balance.checked_sub(total_unclaimed).unwrap();
Impact
This vulnerability pollutes the protocol's core state.
Recommendation
It is recommended to add a strict PDA constraint to the reward_escrow account within the CompoundRewards context. This ensures the function always interacts with the one, true escrow account controlled by the program, eliminating the risk of state pollution.
#[derive(Accounts)]
pub struct CompoundRewards<'info> {
    #[account(mut)]pub program_state: Account<'info, ProgramState>,

    // ...#[account(
        mut,
        // Add this constraint to ensure it's the official PDA
        seeds = [b"reward-escrow", program_state.key().as_ref()],
        bump = program_state.escrow_bump
    )]
    pub reward_escrow: Account<'info, RewardEscrow>,

    // ...
}


Swap
07-Low-Missing admin authorization validation in whitelist initialization
Description
In security-auditor/defai_swap/src/lib.rs, the initialize_whitelist function lacks admin authorization validation. The function accepts any signer as admin without verifying if they are the actual protocol administrator.
// security-auditor/defai_swap/src/lib.rs
pub fn initialize_whitelist(ctx: Context<InitializeWhitelist>) -> Result<()> {
    let whitelist = &mut ctx.accounts.whitelist;
    whitelist.root = WHITELIST_ROOT;
    whitelist.claimed_count = 0;
    Ok(())  
}
Impact
Any user can initialize the whitelist by providing a signature and paying account creation fees.
Recommend
Add config account to InitializeWhitelist context and implement proper authorization validation:
pub struct InitializeWhitelist<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
+   #[account(
+       seeds = [b"config"],
+       bump
+   )]
+   pub config: Account<'info, Config>,
    #[account(
        init,
        payer = admin,
        space = 8 + Whitelist::LEN,
        seeds = [b"whitelist"],
        bump,
    )]
    pub whitelist: Account<'info, Whitelist>,
    pub system_program: Program<'info, System>,
}
pub fn initialize_whitelist(ctx: Context<InitializeWhitelist>) -> Result<()> {
+   require_keys_eq!(ctx.accounts.admin.key(), ctx.accounts.config.admin, ErrorCode::Unauthorized);
    
    let whitelist = &mut ctx.accounts.whitelist;
    whitelist.root = WHITELIST_ROOT;
    whitelist.claimed_count = 0;
    Ok(())
}

08-High-Missing treasury account validation allows tax funds to be redirected to arbitrary accounts
Description
The swap_defai_for_pnft_v6 function accepts user-provided treasury and escrow accounts without validation, allowing malicious users to redirect tax funds to arbitrary accounts they control.
// security-auditor/defai_swap/src/lib.rs
#[derive(Accounts)]
pub struct SwapDefaiForPnftV6<'info> {
    #[account(mut)]
    pub treasury_defai_ata: Box<InterfaceAccount<'info, TokenAccount2022>>, 
    #[account(mut)]
    pub escrow_defai_ata: Box<InterfaceAccount<'info, TokenAccount2022>>,    
    /// CHECK: DEFAI mint
    pub defai_mint: AccountInfo<'info>,
    pub config: Account<'info, Config>,
    #[account(mut)]
    pub collection_config: Box<Account<'info, CollectionConfig>>,
    // ...
    #[account(
        seeds = [b"escrow"],
        bump
    )]
    pub escrow: Account<'info, Escrow>,
}

#[account]
pub struct CollectionConfig {
    pub authority: Pubkey,
    pub collection_mint: Pubkey,    
    pub treasury: Pubkey,    // Real treasury
    pub defai_mint: Pubkey,  
    pub old_defai_mint: Pubkey,
    pub tier_names: [String; 5],
    pub tier_symbols: [String; 5],
    pub tier_prices: [u64; 5],
    pub tier_supplies: [u16; 5],
    pub tier_minted: [u16; 5],
    pub tier_uri_prefixes: [String; 5],
    // MAY20DEFAIHolders.csv: OG Tier 0 holders who can mint NFT + get 1:1 vesting from Quantity column
    pub og_tier_0_merkle_root: [u8; 32],
    // 10_1AIR-Sheet1.csv: Airdrop recipients who get vesting only (NO NFT) from AIRDROP column
    pub airdrop_merkle_root: [u8; 32],
}

pub fn swap_defai_for_pnft_v6(ctx: Context<SwapDefaiForPnftV6>, tier: u8, ...) -> Result<()> {
    let tax_amount = (price as u128)
        .checked_mul(user_tax.tax_rate_bps as u128)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(10000)
        .ok_or(ErrorCode::MathOverflow)? as u64;
    
    let cpi_ctx_tax = CpiContext::new(
        ctx.accounts.token_program_2022.to_account_info(),
        TransferChecked {
            from: ctx.accounts.user_defai_ata.to_account_info(),
            to: ctx.accounts.treasury_defai_ata.to_account_info(),  // No validation
            authority: ctx.accounts.user.to_account_info(),
            mint: ctx.accounts.defai_mint.to_account_info(),
        },
    );
    token22::transfer_checked(cpi_ctx_tax, tax_amount, 6)?;
}
Impact
- Tax funds can be redirected to attacker-controlled accounts instead of the legitimate treasury
- Protocol loses revenue while attackers gain additional funds
Recommend
Add validation to ensure treasury and escrow accounts match the configured addresses.

09-Medium-OG Tier 0 and paid Tier 0 share supply pool allowing paid users to exhaust OG allocation
Description
The swap_og_tier0_for_pnft_v6 and swap_defai_for_pnft_v6 functions both use the same tier_minted[0] counter and tier_supplies[0] limit, allowing paid users to exhaust the supply before OG Tier 0 holders can claim their reserved allocation.
// security-auditor/defai_swap/src/lib.rs
pub fn swap_og_tier0_for_pnft_v6(ctx: Context<SwapOgTier0ForPnftV6>, ...) -> Result<()> {
    require!(
        config.tier_minted[0] < config.tier_supplies[0],    
        ErrorCode::NoLiquidity  
    );
    
    config.tier_minted[0] += 1;  
}

pub fn swap_defai_for_pnft_v6(ctx: Context<SwapDefaiForPnftV6>, tier: u8, ...) -> Result<()> {
    require!(tier < 5, ErrorCode::InvalidTier);   
    
    require!(
        config.tier_minted[tier as usize] < config.tier_supplies[tier as usize],  
        ErrorCode::NoLiquidity
    );
    
    config.tier_minted[tier as usize] += 1;  
}
Impact
- Paid users can exhaust the Tier 0 supply before OG Tier 0 holders claim their reserved allocation
- OG Tier 0 holders may be unable to claim their free NFTs due to supply exhaustion
- Unfair distribution where paid users have priority over reserved OG allocations
Recommend
Separate the supply pools for OG Tier 0 and paid Tier 0 users:
#[account]
pub struct CollectionConfig {
    // ...
    pub tier_supplies: [u16; 5],
    pub tier_minted: [u16; 5],
    pub og_tier_0_supply: u16,      // Reserved supply for OG holders
    pub og_tier_0_minted: u16,      // Counter for OG claims
    // ...
}

pub fn swap_og_tier0_for_pnft_v6(ctx: Context<SwapOgTier0ForPnftV6>, ...) -> Result<()> {
    require!(config.og_tier_0_minted < config.og_tier_0_supply, ErrorCode::NoLiquidity);
    
    config.og_tier_0_minted += 1;
}

pub fn swap_defai_for_pnft_v6(ctx: Context<SwapDefaiForPnftV6>, tier: u8, ...) -> Result<()> {
    require!(tier < 5, ErrorCode::InvalidTier);
    
    // For tier 0, check remaining supply after reserving for OG holders
    if tier == 0 {
        let remaining_supply = config.tier_supplies[0].saturating_sub(config.og_tier_0_supply);
        require!(config.tier_minted[0] < remaining_supply, ErrorCode::NoLiquidity);
    } else {
        require!(config.tier_minted[tier as usize] < config.tier_supplies[tier as usize], ErrorCode::NoLiquidity);
    }
    
    config.tier_minted[tier as usize] += 1;
}

10-Medium-Tax reset time comparison inconsistency creates unfair economic advantage
Description
The reset_user_tax and swap_defai_for_pnft_v6 functions use inconsistent time comparison logic for tax reset, allowing users who call reset_user_tax first to pay significantly lower taxes than users who directly call swap_defai_for_pnft_v6 at the same timestamp.
// security-auditor/defai_swap/src/lib.rs
pub fn reset_user_tax(ctx: Context<ResetUserTax>) -> Result<()> {
    let user_tax_state = &mut ctx.accounts.user_tax_state;
    let now = Clock::get()?.unix_timestamp;
    
    require!(
        now >= user_tax_state.last_swap_timestamp + TAX_RESET_DURATION,  // Uses >=
        ErrorCode::TaxResetTooEarly
    );
    
    user_tax_state.tax_rate_bps = INITIAL_TAX_BPS;  // Reset to 5%
    user_tax_state.swap_count = 0;
}

pub fn swap_defai_for_pnft_v6(ctx: Context<SwapDefaiForPnftV6>, tier: u8, ...) -> Result<()> {
    // Check and reset tax if 24 hours passed
    if clock.unix_timestamp - user_tax.last_swap_timestamp > TAX_RESET_DURATION {  // Use >
        user_tax.tax_rate_bps = INITIAL_TAX_BPS;
        user_tax.swap_count = 0;
    }
    
    let tax_amount = (price as u128)
        .checked_mul(user_tax.tax_rate_bps as u128)
        .ok_or(ErrorCode::MathOverflow)?
        .checked_div(10000)
        .ok_or(ErrorCode::MathOverflow)? as u64;
}
Impact
- At exactly 24 hours after the last swap, users who call reset_user_tax first pay 5% tax
- Users who directly call swap_defai_for_pnft_v6 at the same timestamp pay up to 30% tax
- Creates unfair 25% tax difference for identical timing conditions
Recommend
Standardize time comparison logic to use >= in both functions:
pub fn swap_defai_for_pnft_v6(ctx: Context<SwapDefaiForPnftV6>, tier: u8, ...) -> Result<()> {
-   if clock.unix_timestamp - user_tax.last_swap_timestamp > TAX_RESET_DURATION {
+   if clock.unix_timestamp - user_tax.last_swap_timestamp >= TAX_RESET_DURATION {
        user_tax.tax_rate_bps = INITIAL_TAX_BPS;
        user_tax.swap_count = 0;
    }
}

11-Info-Enable VRF function lacks state validation allowing redundant calls
Description
The enable_vrf function does not check the current state of vrf_enabled before setting it to true, allowing redundant calls even when VRF is already enabled. This creates inconsistent behavior compared to other state management functions like pause and unpause.
// security-auditor/defai_swap/src/lib.rs
pub fn enable_vrf(ctx: Context<UpdateConfig>) -> Result<()> {
    require_keys_eq!(ctx.accounts.admin.key(), ctx.accounts.config.admin, ErrorCode::Unauthorized);
    
    let cfg = &mut ctx.accounts.config;
    cfg.vrf_enabled = true;  
    
    msg!("VRF enabled for swap program");
    
    emit!(AdminAction {
        admin: ctx.accounts.admin.key(),
        action: "Enable VRF".to_string(),
        timestamp: Clock::get()?.unix_timestamp,
    });
    
    Ok(())
}

pub fn pause(ctx: Context<UpdateConfig>) -> Result<()> {
    require_keys_eq!(ctx.accounts.admin.key(), ctx.accounts.config.admin, ErrorCode::Unauthorized);
    require!(!ctx.accounts.config.paused, ErrorCode::AlreadyPaused);  
    
    ctx.accounts.config.paused = true;
}
Impact
- Redundant calls to enable_vrf succeed unnecessarily
- Inconsistent behavior with other state management functions
Recommend
Add state validation to prevent redundant calls:
pub fn enable_vrf(ctx: Context<UpdateConfig>) -> Result<()> {
    require_keys_eq!(ctx.accounts.admin.key(), ctx.accounts.config.admin, ErrorCode::Unauthorized);
+   require!(!ctx.accounts.config.vrf_enabled, ErrorCode::VrfAlreadyEnabled);
    
    let cfg = &mut ctx.accounts.config;
    cfg.vrf_enabled = true;
    
}

12-Low-OLD DEFAI swap breaks tax reset mechanism causing unfair tax burden
Description
The swap_old_defai_for_pnft_v6 function claims "No tax for old DEFAI swaps" but still updates user_tax.last_swap_timestamp, which breaks the 24-hour tax reset mechanism. This creates an unfair situation where users who use OLD DEFAI tokens are penalized with higher tax rates when they later use DEFAI tokens, because the timestamp update prevents the tax rate from resetting to the initial 5% rate.
// security-auditor/defai_swap/src/lib.rs
    pub fn swap_old_defai_for_pnft_v6(
        ctx: Context<SwapOldDefaiForPnftV6>,
        tier: u8,
        _metadata_uri: String,
        _name: String,
        _symbol: String,
    ) -> Result<()> {
        // ...

        // Update user tax state
        user_tax.swap_count += 1;
        user_tax.last_swap_timestamp = clock.unix_timestamp;  
    }
The swap_old_defai_for_pnft_v6 function updates the user's tax state timestamp without implementing the same tax reset logic that exists in swap_defai_for_pnft_v6:
// swap_defai_for_pnft_v6 has tax reset logic
if clock.unix_timestamp - user_tax.last_swap_timestamp > TAX_RESET_DURATION {
    user_tax.tax_rate_bps = INITIAL_TAX_BPS;
    user_tax.swap_count = 0;
}

// swap_old_defai_for_pnft_v6 lacks this check
// Only updates timestamp, breaking the reset mechanism
Scenario
1. User performs 25 DEFAI swaps, reaching 30% tax rate
2. Waits 24 hours for tax reset
3. Calls swap_old_defai_for_pnft_v6 (no tax charged)
4. last_swap_timestamp gets updated, breaking the reset window
5. Calls swap_defai_for_pnft_v6 again
6. Tax rate remains at 30% instead of resetting to 5%
Impact
- Unfair tax burden: Users using OLD DEFAI are penalized with higher taxes
- Logic contradiction: "No tax" but "affects tax state"
Recommendation
Add tax reset logic to swap_old_defai_for_pnft_v6 or remove the timestamp update entirely since OLD DEFAI swaps should not affect the tax state.


13-High-Missing NFT mint validation allows unauthorized vesting claims
Description
The claim_vested_v6 and reroll_bonus_v6 functions only verify NFT ownership and amount, but fail to validate that the provided NFT ATA corresponds to the correct NFT mint, allowing attackers to use any NFT to claim vesting rewards for a different NFT.
// security-auditor/defai_swap/src/lib.rs
#[derive(Accounts)]
pub struct ClaimVestedV6<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    /// CHECK: NFT mint
    pub nft_mint: AccountInfo<'info>,
    #[account()]
    pub user_nft_ata: InterfaceAccount<'info, TokenAccount2022>,
    #[account(mut)]
    pub user_defai_ata: InterfaceAccount<'info, TokenAccount2022>,
    #[account(mut)]
    pub escrow_defai_ata: InterfaceAccount<'info, TokenAccount2022>,
    /// CHECK: DEFAI mint
    pub defai_mint: AccountInfo<'info>,
    pub config: Account<'info, Config>,
    #[account(
        seeds = [b"escrow"],
        bump
    )]
    pub escrow: Account<'info, Escrow>,
    #[account(
        mut,
        seeds = [b"vesting_v6", nft_mint.key().as_ref()],
        bump
    )]
    pub vesting_state: Account<'info, VestingStateV6>,
    pub token_program_2022: Program<'info, Token2022>,
}

pub fn claim_vested_v6(ctx: Context<ClaimVestedV6>) -> Result<()> {
    require!(
        ctx.accounts.user_nft_ata.owner == ctx.accounts.user.key() &&
        ctx.accounts.user_nft_ata.amount == 1,
        ErrorCode::NoNft
    );
    
    // Process vesting without verifying NFT mint
    let vesting_state = &mut ctx.accounts.vesting_state;
}

pub fn reroll_bonus_v6(ctx: Context<RerollBonusV6>) -> Result<()> {
    // Same vulnerability
    require!(
        ctx.accounts.user_nft_ata.owner == ctx.accounts.user.key() &&
        ctx.accounts.user_nft_ata.amount == 1,
        ErrorCode::NoNft
    );
}
Impact
- Attackers can use any NFT they own to claim vesting rewards for a different NFT
- Complete bypass of NFT ownership verification for vesting and reroll functions
Recommend
Add mint validation to ensure the NFT ATA corresponds to the correct NFT:
pub fn claim_vested_v6(ctx: Context<ClaimVestedV6>) -> Result<()> {
    require!(
        ctx.accounts.user_nft_ata.owner == ctx.accounts.user.key() &&
        ctx.accounts.user_nft_ata.amount == 1 &&
+       ctx.accounts.user_nft_ata.mint == ctx.accounts.nft_mint.key(),
        ErrorCode::NoNft
    );
}


14-High-Token-2022 Funds Permanently Locked Due to AdminWithdraw Token Standard Mismatch
Description
The admin_withdraw function only supports standard SPL Token program and cannot operate Token-2022 accounts, causing DEFAI fee funds deposited via swap_defai_for_pnft_v6 to be permanently locked.
Token Standard Inconsistency
1. SwapOldDefaiForPnftV6 (OLD DEFAI)
// security-auditor/defai_swap/src/lib.rs
#[derive(Accounts)]
pub struct SwapOldDefaiForPnftV6<'info> {
    pub token_program: Program<'info, Token>,  // Standard SPL Token
    #[account(mut)]
    pub user_old: Box<Account<'info, TokenAccount>>,  
    #[account(mut)]
    pub burn_old: Box<Account<'info, TokenAccount>>,  
}

// Uses standard SPL Token transfer
let cpi_ctx_old = CpiContext::new(
    ctx.accounts.token_program.to_account_info(),
    Transfer {
        from: ctx.accounts.user_old.to_account_info(),
        to: ctx.accounts.burn_old.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
    },
);
token::transfer(cpi_ctx_old, price)?;  // Standard SPL Token
2. SwapDefaiForPnftV6 (DEFAI)
#[derive(Accounts)]
pub struct SwapDefaiForPnftV6<'info> {
    pub token_program_2022: Program<'info, Token2022>,  // Token-2022
    #[account(mut)]
    pub escrow_defai_ata: Box<InterfaceAccount<'info, TokenAccount2022>>,  
    #[account(mut)]
    pub user_defai_ata: Box<InterfaceAccount<'info, TokenAccount2022>>,     
}

// Uses Token-2022 transfer
let cpi_ctx_tax = CpiContext::new_with_signer(
    ctx.accounts.token_program_2022.to_account_info(),
    TransferChecked {
        from: ctx.accounts.user_defai_ata.to_account_info(),
        to: ctx.accounts.escrow_defai_ata.to_account_info(),
        authority: ctx.accounts.user.to_account_info(),
        mint: ctx.accounts.defai_mint.to_account_info(),
    },
    &[&user_seeds[..]],
);
token22::transfer_checked(cpi_ctx_tax, tax_amount, 6)?;  
3. AdminWithdraw
#[derive(Accounts)]
pub struct AdminWithdraw<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(mut)]
    pub source_vault: Account<'info, TokenAccount>,  
    #[account(mut)]
    pub dest: Account<'info, TokenAccount>,          
    pub token_program: Program<'info, Token>,        // Cannot operate Token-2022
}

pub fn admin_withdraw(ctx: Context<AdminWithdraw>, amount: u64) -> Result<()> {
    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.token_program.to_account_info(),  // Standard SPL Token
        Transfer {                                     
            from: ctx.accounts.source_vault.to_account_info(),
            to: ctx.accounts.dest.to_account_info(),
            authority: ctx.accounts.escrow.to_account_info(),
        },
        &[&escrow_seeds[..]],
    );
    token::transfer(cpi_ctx, amount)?;  
}
Impact
All DEFAI fees from swap_defai_for_pnft_v6 permanently locked and cannot be withdrawn by admin
Recommend
Add Token-2022 Withdrawal Function:
pub fn admin_withdraw(ctx: Context<AdminWithdraw>,
+   is_token2022: bool,
    amount: u64,
) -> Result<()> {
    if is_token2022 {
        // Token-2022 logic
        // ...
    } else {
        // Standard SPL Token logic
        // ...
    }
}


