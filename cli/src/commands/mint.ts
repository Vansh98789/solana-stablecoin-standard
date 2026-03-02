import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import { loadConfig, loadIDL, getProvider } from "../config";

export function mintCommand(): Command {
  return new Command("mint")
    .description("Mint tokens to a recipient")
    .argument("<recipient>", "Recipient public key")
    .argument("<amount>", "Amount to mint")
    .option("--mint <address>", "Mint address (overrides config)")
    .action(async (recipient, amount, opts) => {
      const config = loadConfig();
      const mintAddress = opts.mint || config.mintAddress;
      if (!mintAddress) { console.error("No mint address."); process.exit(1); }
      const { wallet, provider } = getProvider(config);
      const program = new anchor.Program(loadIDL(), provider);
      const mintPk = new PublicKey(mintAddress);
      const [coinPda] = PublicKey.findProgramAddressSync([Buffer.from("stableCoin"), mintPk.toBuffer()], program.programId);
      const receiverAta = await getAssociatedTokenAddress(mintPk, new PublicKey(recipient), false, TOKEN_2022_PROGRAM_ID);
      try {
        const tx = await program.methods.mint(new anchor.BN(amount))
          .accounts({ coinPda, mint: mintPk, receiverAta, authority: wallet.publicKey, tokenProgram: TOKEN_2022_PROGRAM_ID })
          .rpc();
        console.log(`Minted ${amount} tokens to ${recipient}`);
        console.log(`TX: ${tx}`);
      } catch (err: any) { console.error(`Error: ${err.message}`); process.exit(1); }
    });
}