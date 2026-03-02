import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider } from "@coral-xyz/anchor";
import { PublicKey, Keypair, Connection, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddress,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

export const Presets = {
  SSS_1: {
    enablePermanentDelegate: false,
    enableTransferHook: false,
  },
  SSS_2: {
    enablePermanentDelegate: true,
    enableTransferHook: true,
  },
};

export interface StableCoinConfig {
  name: string;
  symbol: string;
  preset?: keyof typeof Presets;
  enablePermanentDelegate?: boolean;
  enableTransferHook?: boolean;
}

export class StableCoinSDK {
  program: Program;
  provider: AnchorProvider;
  mintKeypair: Keypair;
  mintAddress: PublicKey;
  coinPda: PublicKey;

  constructor(
    program: Program,
    provider: AnchorProvider,
    mintKeypair: Keypair,
    coinPda: PublicKey
  ) {
    this.program = program;
    this.provider = provider;
    this.mintKeypair = mintKeypair;
    this.mintAddress = mintKeypair.publicKey;
    this.coinPda = coinPda;
  }

  private get programAccounts() {
    return this.program.account as any;
  }

  static async create(
    connection: Connection,
    wallet: anchor.Wallet,
    idl: any,
    programId: PublicKey,
    config: StableCoinConfig
  ): Promise<StableCoinSDK> {
    const provider = new AnchorProvider(connection, wallet, {});
    const program = new Program(idl, provider);
    const mintKeypair = Keypair.generate();

    const preset = config.preset ? Presets[config.preset] : null;
    const enablePermanentDelegate =
      preset?.enablePermanentDelegate ?? config.enablePermanentDelegate ?? false;
    const enableTransferHook =
      preset?.enableTransferHook ?? config.enableTransferHook ?? false;

    const [coinPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("stableCoin"), mintKeypair.publicKey.toBuffer()],
      programId
    );

    await program.methods
      .initialize(
        config.name,
        config.symbol,
        false,
        enablePermanentDelegate,
        enableTransferHook
      )
      .accounts({
        mint: mintKeypair.publicKey,
        coinPda,
        authority: wallet.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([mintKeypair])
      .rpc();

    console.log(`Stablecoin created: ${mintKeypair.publicKey.toString()}`);
    return new StableCoinSDK(program, provider, mintKeypair, coinPda);
  }

  async mint(recipient: PublicKey, amount: number): Promise<void> {
    const receiverAta = await getAssociatedTokenAddress(
      this.mintAddress,
      recipient,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    await this.program.methods
      .mint(new anchor.BN(amount))
      .accounts({
        coinPda: this.coinPda,
        mint: this.mintAddress,
        receiverAta,
        authority: this.provider.wallet.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .rpc();

    console.log(`Minted ${amount} tokens to ${recipient.toString()}`);
  }

  async burn(from: PublicKey, amount: number): Promise<void> {
    const burnAta = await getAssociatedTokenAddress(
      this.mintAddress,
      from,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    await this.program.methods
      .burnToken(new anchor.BN(amount))
      .accounts({
        coinPda: this.coinPda,
        mint: this.mintAddress,
        burnAta,
        authority: this.provider.wallet.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .rpc();

    console.log(`Burned ${amount} tokens`);
  }

  async freeze(target: PublicKey): Promise<void> {
    const targetAta = await getAssociatedTokenAddress(
      this.mintAddress,
      target,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    await this.program.methods
      .freezeAccount()
      .accounts({
        coinPda: this.coinPda,
        mint: this.mintAddress,
        targetAcc: targetAta,
        authority: this.provider.wallet.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .rpc();

    console.log(`Frozen: ${target.toString()}`);
  }

  async thaw(target: PublicKey): Promise<void> {
    const targetAta = await getAssociatedTokenAddress(
      this.mintAddress,
      target,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    await this.program.methods
      .thrawAccount()
      .accounts({
        coinPda: this.coinPda,
        mint: this.mintAddress,
        targetAcc: targetAta,
        authority: this.provider.wallet.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .rpc();

    console.log(`Thawed: ${target.toString()}`);
  }

  async pause(): Promise<void> {
    await this.program.methods
      .pause()
      .accounts({
        coinPda: this.coinPda,
        authority: this.provider.wallet.publicKey,
      })
      .rpc();

    console.log("Paused");
  }

  async unpause(): Promise<void> {
    await this.program.methods
      .unpause()
      .accounts({
        coinPda: this.coinPda,
        authority: this.provider.wallet.publicKey,
      })
      .rpc();

    console.log("Unpaused");
  }

  async blacklistAdd(wallet: PublicKey, reason: string): Promise<void> {
    const config = await this.programAccounts.stableCoin.fetch(this.coinPda);

    const [blacklistPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("blacklist"),
        (config as any).mint.toBuffer(),
        wallet.toBuffer(),
      ],
      this.program.programId
    );

    await this.program.methods
      .addToBlacklist(reason)
      .accounts({
        coinPda: this.coinPda,
        blacklistAcc: blacklistPda,
        wallet,
        authority: this.provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log(`Blacklisted: ${wallet.toString()}`);
  }

  async blacklistRemove(wallet: PublicKey): Promise<void> {
    const config = await this.programAccounts.stableCoin.fetch(this.coinPda);

    const [blacklistPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("blacklist"),
        (config as any).mint.toBuffer(),
        wallet.toBuffer(),
      ],
      this.program.programId
    );

    await this.program.methods
      .removeFromBlacklist()
      .accounts({
        coinPda: this.coinPda,
        blacklistEntry: blacklistPda,
        wallet,
        authority: this.provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log(`Removed from blacklist: ${wallet.toString()}`);
  }

  async seize(from: PublicKey, treasury: PublicKey): Promise<void> {
    const seizeFrom = await getAssociatedTokenAddress(
      this.mintAddress,
      from,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    const treasuryAta = await getAssociatedTokenAddress(
      this.mintAddress,
      treasury,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    await this.program.methods
      .seize()
      .accounts({
        coinPda: this.coinPda,
        mint: this.mintAddress,
        seizeFrom,
        treasury: treasuryAta,
        authority: this.provider.wallet.publicKey,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
      })
      .rpc();

    console.log(`Seized tokens from ${from.toString()}`);
  }

  async getTotalSupply(): Promise<number> {
    const mintInfo = await this.provider.connection.getTokenSupply(
      this.mintAddress
    );
    return Number(mintInfo.value.amount);
  }

  async getConfig(): Promise<any> {
    return await this.programAccounts.stableCoin.fetch(this.coinPda);
  }
}