use anchor_lang::prelude::*;
use anchor_spl::token_2022::Token2022;
use anchor_spl::token_interface::{
    Mint, TokenAccount,
    MintTo, mint_to,
    Burn as SplBurn, burn as spl_burn,
    FreezeAccount, freeze_account as spl_freeze,
    ThawAccount, thaw_account as spl_thaw,
    TransferChecked, transfer_checked,
};

declare_id!("ELWfh8ZqRJ62nAQcjGKimAJXNjPrv41gf5tY7D4YH2bs");

#[program]
pub mod stable_coin {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        name: String,
        symbol: String,
        is_pause: bool,
        enable_permanent_delegate: bool,
        enable_transfer_hook: bool,
    ) -> Result<()> {
        require!(name.len() <= 100, StableCoinError::NameTooLong);
        require!(symbol.len() <= 50, StableCoinError::SymbolTooLong);

        let coin_pda = &mut ctx.accounts.coin_pda;
        coin_pda.authority = ctx.accounts.authority.key();
        coin_pda.name = name;
        coin_pda.symbol = symbol;
        coin_pda.mint = ctx.accounts.mint.key();
        coin_pda.is_pause = is_pause;
        coin_pda.enable_permanent_delegate = enable_permanent_delegate;
        coin_pda.enable_transfer_hook = enable_transfer_hook;
        coin_pda.bump = ctx.bumps.coin_pda;

        Ok(())
    }

    pub fn mint(ctx: Context<MintToken>, amount: u64) -> Result<()> {
        let coin_pda = &ctx.accounts.coin_pda;
        require!(!coin_pda.is_pause, StableCoinError::AccountPaused);
        require!(coin_pda.authority == ctx.accounts.authority.key(), StableCoinError::NotAuthorized);

        let cpi = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            MintTo {
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.receiver_ata.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        );
        mint_to(cpi, amount)?;
        Ok(())
    }

    pub fn burn_token(ctx: Context<BurnToken>, amount: u64) -> Result<()> {
        let coin_pda = &ctx.accounts.coin_pda;
        require!(!coin_pda.is_pause, StableCoinError::AccountPaused);
        require!(coin_pda.authority == ctx.accounts.authority.key(), StableCoinError::NotAuthorized);

        let cpi = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            SplBurn {
                mint: ctx.accounts.mint.to_account_info(),
                from: ctx.accounts.burn_ata.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        );
        spl_burn(cpi, amount)?;
        Ok(())
    }

    pub fn freeze_account(ctx: Context<FreezeAcc>) -> Result<()> {
        let coin_pda = &ctx.accounts.coin_pda;
        require!(!coin_pda.is_pause, StableCoinError::AccountPaused);
        require!(coin_pda.authority == ctx.accounts.authority.key(), StableCoinError::NotAuthorized);

        let cpi = CpiContext::new(
            ctx.accounts.token_program.to_account_info(), // ← fixed: was token_account
            FreezeAccount {
                account: ctx.accounts.target_acc.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            }
        );
        spl_freeze(cpi)?;
        Ok(())
    }

    pub fn thraw_account(ctx: Context<ThrawAcc>) -> Result<()> {
        let coin_pda = &ctx.accounts.coin_pda;
        require!(!coin_pda.is_pause, StableCoinError::AccountPaused);
        require!(coin_pda.authority == ctx.accounts.authority.key(), StableCoinError::NotAuthorized);

        let cpi = CpiContext::new(
            ctx.accounts.token_program.to_account_info(), // ← fixed: was token_account
            ThawAccount {
                account: ctx.accounts.target_acc.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            }
        );
        spl_thaw(cpi)?;
        Ok(())
    }

    pub fn pause(ctx: Context<PauseCtx>) -> Result<()> {
        let coin_pda = &mut ctx.accounts.coin_pda;
        require!(
            coin_pda.authority == ctx.accounts.authority.key(),
            StableCoinError::NotAuthorized
        );
        require!(!coin_pda.is_pause, StableCoinError::AccountPaused);

        coin_pda.is_pause = true;
        msg!("Stablecoin paused");
        Ok(())
    }

    pub fn unpause(ctx: Context<UnpauseCtx>) -> Result<()> {
        let coin_pda = &mut ctx.accounts.coin_pda;
        require!(
            coin_pda.authority == ctx.accounts.authority.key(),
            StableCoinError::NotAuthorized
        );

        coin_pda.is_pause = false;
        msg!("Stablecoin unpaused");
        Ok(())
    }

    pub fn add_to_blacklist(ctx: Context<AddToBlacklist>, reason: String) -> Result<()> {
        let coin_pda = &ctx.accounts.coin_pda;
        require!(coin_pda.enable_transfer_hook, StableCoinError::NotTransferable);
        require!(
            coin_pda.authority == ctx.accounts.authority.key(),
            StableCoinError::NotAuthorized
        );
        require!(!coin_pda.is_pause, StableCoinError::AccountPaused);

        let entry = &mut ctx.accounts.blacklist_acc;
        entry.wallet = ctx.accounts.wallet.key();
        entry.reason = reason;
        entry.blacklist_at = Clock::get()?.unix_timestamp;
        entry.bump = ctx.bumps.blacklist_acc;

        msg!("Blacklisted: {}", ctx.accounts.wallet.key());
        Ok(())
    }

    pub fn remove_from_blacklist(ctx: Context<RemoveFromBlacklist>) -> Result<()> {
        let coin_pda = &ctx.accounts.coin_pda;
        require!(coin_pda.enable_transfer_hook, StableCoinError::NotTransferable);
        require!(
            coin_pda.authority == ctx.accounts.authority.key(),
            StableCoinError::NotAuthorized
        );

        msg!("Removed from blacklist: {}", ctx.accounts.wallet.key());
        Ok(())
    }

    pub fn seize(ctx: Context<Seize>) -> Result<()> {
        let coin_pda = &ctx.accounts.coin_pda;
        require!(coin_pda.enable_permanent_delegate, StableCoinError::NotDeligate);
        require!(
            coin_pda.authority == ctx.accounts.authority.key(),
            StableCoinError::NotAuthorized
        );
        require!(!coin_pda.is_pause, StableCoinError::AccountPaused);

        let amount = ctx.accounts.seize_from.amount;

        let cpi = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.seize_from.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.treasury.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        );
        transfer_checked(cpi, amount, coin_pda.decimals)?;

        msg!("Seized {} tokens", amount);
        Ok(())
    }
}

// ─────────────────────────────────────────
// STATE
// ─────────────────────────────────────────

#[account]
pub struct StableCoin {
    pub authority: Pubkey,
    pub name: String,
    pub symbol: String,
    pub mint: Pubkey,
    pub is_pause: bool,
    pub enable_permanent_delegate: bool,
    pub enable_transfer_hook: bool,
    pub decimals: u8,
    pub bump: u8,
}

#[account]
pub struct BlackList {
    pub wallet: Pubkey,
    pub reason: String,
    pub blacklist_at: i64,
    pub bump: u8,
}

// ─────────────────────────────────────────
// ACCOUNT CONTEXTS
// ─────────────────────────────────────────

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        mint::decimals = 6,
        mint::authority = authority,
        mint::freeze_authority = authority,
        mint::token_program = token_program
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(
        init,
        payer = authority,
        space = 8+32+4+100+4+50+32+1+1+1+1+1,
        seeds = [b"stableCoin", mint.key().as_ref()],
        bump
    )]
    pub coin_pda: Account<'info, StableCoin>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MintToken<'info> {
    #[account(
        mut,
        seeds = [b"stableCoin", mint.key().as_ref()],
        bump = coin_pda.bump,
    )]
    pub coin_pda: Account<'info, StableCoin>,

    #[account(
        mut,
        constraint = coin_pda.mint == mint.key()
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub receiver_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token2022>,
}

#[derive(Accounts)]
pub struct BurnToken<'info> {
    #[account(
        mut,
        seeds = [b"stableCoin", mint.key().as_ref()],
        bump = coin_pda.bump,
    )]
    pub coin_pda: Account<'info, StableCoin>,

    #[account(
        mut,
        constraint = coin_pda.mint == mint.key()
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub burn_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token2022>,
}

#[derive(Accounts)]
pub struct FreezeAcc<'info> {
    #[account(
        mut,
        seeds = [b"stableCoin", mint.key().as_ref()],
        bump = coin_pda.bump,
    )]
    pub coin_pda: Account<'info, StableCoin>,

    #[account(
        mut,
        constraint = coin_pda.mint == mint.key()
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub target_acc: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token2022>, // ← fixed: was token_account
}

#[derive(Accounts)]
pub struct ThrawAcc<'info> {
    #[account(
        mut,
        seeds = [b"stableCoin", mint.key().as_ref()],
        bump = coin_pda.bump
    )]
    pub coin_pda: Account<'info, StableCoin>,

    #[account(
        mut,
        constraint = coin_pda.mint == mint.key(),
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub target_acc: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token2022>, // ← fixed: was token_account
}

#[derive(Accounts)]
pub struct PauseCtx<'info> {
    #[account(
        mut,
        seeds = [b"stableCoin", coin_pda.mint.as_ref()],
        bump = coin_pda.bump,
    )]
    pub coin_pda: Account<'info, StableCoin>,

    #[account(mut)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct UnpauseCtx<'info> {
    #[account(
        mut,
        seeds = [b"stableCoin", coin_pda.mint.as_ref()],
        bump = coin_pda.bump,
    )]
    pub coin_pda: Account<'info, StableCoin>,

    #[account(mut)]
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct AddToBlacklist<'info> {
    #[account(
        mut,
        seeds = [b"stableCoin", coin_pda.mint.as_ref()],
        bump = coin_pda.bump,
    )]
    pub coin_pda: Account<'info, StableCoin>,

    #[account(
        init,
        payer = authority,
        space = 8+32+4+100+8+1,
        seeds = [b"blacklist", coin_pda.mint.as_ref(), wallet.key().as_ref()], // ← fixed: added mint seed
        bump
    )]
    pub blacklist_acc: Account<'info, BlackList>,

    /// CHECK: wallet to blacklist, no ownership checks needed
    pub wallet: AccountInfo<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RemoveFromBlacklist<'info> {
    #[account(
        seeds = [b"stableCoin", coin_pda.mint.as_ref()],
        bump = coin_pda.bump,
    )]
    pub coin_pda: Account<'info, StableCoin>,

    #[account(
        mut,
        close = authority,
        seeds = [b"blacklist", coin_pda.mint.as_ref(), wallet.key().as_ref()],
        bump = blacklist_entry.bump
    )]
    pub blacklist_entry: Account<'info, BlackList>,

    /// CHECK: wallet to remove from blacklist
    pub wallet: AccountInfo<'info>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Seize<'info> {
    #[account(
        seeds = [b"stableCoin", mint.key().as_ref()],
        bump = coin_pda.bump,
    )]
    pub coin_pda: Account<'info, StableCoin>,

    #[account(
        mut,
        constraint = coin_pda.mint == mint.key()
    )]
    pub mint: InterfaceAccount<'info, Mint>,

    #[account(mut)]
    pub seize_from: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub treasury: InterfaceAccount<'info, TokenAccount>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub token_program: Program<'info, Token2022>,
}

// ─────────────────────────────────────────
// ERRORS
// ─────────────────────────────────────────

#[error_code]
pub enum StableCoinError {
    #[msg("length of the name is too long")]
    NameTooLong,
    #[msg("length of the symbol is too long")]
    SymbolTooLong,
    #[msg("your account is paused")]
    AccountPaused,
    #[msg("authority is not authorized")]
    NotAuthorized,
    #[msg("not transferable")]
    NotTransferable,
    #[msg("not permanent delegate")]
    NotDeligate,
}