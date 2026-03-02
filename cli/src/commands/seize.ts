import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import { loadConfig, loadIDL, getProvider } from "../config";

export function seizeCommand(): Command {
  return new Command("seize")
    .description("Seize tokens from an account (SSS-2 only)")
    .argument("<from>", "Account to seize from")
    .option("--to <treasury>", "Treasury account to receive seized tokens")
    .option("--mint <address>", "Mint address (overrides config)")
    .action(async (from, opts) => {
      const config = loadConfig();
      const mintAddress = opts.mint || config.mintAddress;
      if (!mintAddress) { console.error("No mint address."); process.exit(1); }
      if (!opts.to) { console.error("Must specify --to <treasury>"); process.exit(1); }
      const { wallet, provider } = getProvider(config);
      const program = new anchor.Program(loadIDL(), provider);
      const mintPk = new PublicKey(mintAddress);
      const fromPk = new PublicKey(from);
      const treasuryPk = new PublicKey(opts.to);
      const [coinPda] = PublicKey.findProgramAddressSync([Buffer.from("stableCoin"), mintPk.toBuffer()], program.programId);
      const seizeFrom = await getAssociatedTokenAddress(mintPk, fromPk, false, TOKEN_2022_PROGRAM_ID);
      const treasury = await getAssociatedTokenAddress(mintPk, treasuryPk, false, TOKEN_2022_PROGRAM_ID);
      try {
        const tx = await program.methods.seize()
          .accounts({ coinPda, mint: mintPk, seizeFrom, treasury, authority: wallet.publicKey, tokenProgram: TOKEN_2022_PROGRAM_ID })
          .rpc();
        console.log(`Seized tokens from ${from} → ${opts.to}\nTX: ${tx}`);
      } catch (err: any) { console.error(`Error: ${err.message}`); process.exit(1); }
    });
}