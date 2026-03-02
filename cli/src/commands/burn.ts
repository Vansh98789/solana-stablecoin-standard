import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import { loadConfig, loadIDL, getProvider } from "../config";

export function burnCommand(): Command {
  return new Command("burn")
    .description("Burn tokens from an account")
    .argument("<from>", "Account to burn from")
    .argument("<amount>", "Amount to burn")
    .option("--mint <address>", "Mint address (overrides config)")
    .action(async (from, amount, opts) => {
      const config = loadConfig();
      const mintAddress = opts.mint || config.mintAddress;
      if (!mintAddress) { console.error("No mint address."); process.exit(1); }
      const { wallet, provider } = getProvider(config);
      const program = new anchor.Program(loadIDL(), provider);
      const mintPk = new PublicKey(mintAddress);
      const [coinPda] = PublicKey.findProgramAddressSync([Buffer.from("stableCoin"), mintPk.toBuffer()], program.programId);
      const burnAta = await getAssociatedTokenAddress(mintPk, new PublicKey(from), false, TOKEN_2022_PROGRAM_ID);
      try {
        const tx = await program.methods.burnToken(new anchor.BN(amount))
          .accounts({ coinPda, mint: mintPk, burnAta, authority: wallet.publicKey, tokenProgram: TOKEN_2022_PROGRAM_ID })
          .rpc();
        console.log(`Burned ${amount} tokens from ${from}\nTX: ${tx}`);
      } catch (err: any) { console.error(`Error: ${err.message}`); process.exit(1); }
    });
}