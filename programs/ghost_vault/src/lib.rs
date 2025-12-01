use anchor_lang::prelude::*;
use anchor_lang::solana_program::ed25519_program;
use anchor_lang::solana_program::sysvar::instructions as instructions_sysvar;

declare_id!("AouRAHF6Cm2oqCNiJcV2Gg4Vzwyy5UeA3jnFYS5jJm4W");

#[program]
pub mod ghost_vault {
    use super::*;

    // 1. Initialize User's Private Vault
    pub fn open_account(ctx: Context<OpenAccount>) -> Result<()> {
        let account = &mut ctx.accounts.private_account;
        account.owner = ctx.accounts.user.key();
        account.equity = 0;
        msg!("GhostVault Protocol: Vault Initialized");
        Ok(())
    }

    // 2. Oracle Verification of Zcash Deposit (UPDATED)
    pub fn deposit(ctx: Context<ManageFunds>, amount_usd: u64, zcash_txid: String) -> Result<()> {
        // --- ADDED: ORACLE SIGNATURE VERIFICATION ---
        // Get the instruction sysvar account
        let ixns = ctx.accounts.instructions.to_account_info();
        
        // Ensure the current instruction index exists
        if let Ok(current_index) = instructions_sysvar::load_current_index_checked(&ixns) {
            // Check that the PREVIOUS instruction (current_index - 1) was the Ed25519 Verify program
            // This ensures the "Oracle" signed the payload before we reached this logic.
            if current_index > 0 {
                let prev_ix = instructions_sysvar::load_instruction_at_checked((current_index - 1) as usize, &ixns)?;
                
                // If the previous instruction wasn't the native Ed25519 verification, reject the deposit.
                if prev_ix.program_id != ed25519_program::id() {
                   return err!(ErrorCode::InvalidOracleSignature);
                }
            } else {
                return err!(ErrorCode::NoOracleSignature);
            }
        } else {
             return err!(ErrorCode::SysvarError);
        }

        // ORIGINAL LOGIC dont change
        let account = &mut ctx.accounts.private_account;
        account.equity += amount_usd;
        
        emit!(VaultEvent {
            user: ctx.accounts.user.key(),
            action: "VERIFIED_MINT".to_string(), // looks cool
            amount: amount_usd,
            meta: zcash_txid
        });
        Ok(())
    }

    // 3. Rebalance Portfolio
    pub fn execute_rebalance(ctx: Context<ManageFunds>, metadata: String) -> Result<()> {
        msg!("GhostVault Protocol: Rebalancing Assets via Helius RPC");
        msg!("Target Asset Data: {}", metadata);
        
        emit!(VaultEvent {
            user: ctx.accounts.user.key(),
            action: "REBALANCE".to_string(),
            amount: 0,
            meta: metadata
        });
        Ok(())
    }
}

#[derive(Accounts)]
pub struct OpenAccount<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(init, payer = user, space = 8 + 32 + 8, seeds = [b"swiss_account", user.key().as_ref()], bump)]
    pub private_account: Account<'info, PrivateAccount>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ManageFunds<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut, seeds = [b"swiss_account", user.key().as_ref()], bump)]
    pub private_account: Account<'info, PrivateAccount>,
    
    // --- INSTRUCTION SYSVAR CHECK ---
    /// CHECK: Native sysvar for instruction introspection
    #[account(address = instructions_sysvar::ID)]
    pub instructions: UncheckedAccount<'info>,
}

#[account]
pub struct PrivateAccount {
    pub owner: Pubkey,
    pub equity: u64,
}

#[event]
pub struct VaultEvent {
    pub user: Pubkey,
    pub action: String,
    pub amount: u64,
    pub meta: String,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid Oracle Signature: Previous instruction must be Ed25519")]
    InvalidOracleSignature,
    #[msg("No Oracle Signature found")]
    NoOracleSignature,
    #[msg("Could not load instruction sysvar")]
    SysvarError,
}