import { Command } from "commander";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { loadConfig, loadIDL, getProvider } from "../config";

export function blacklistCommand(): Command {
  const cmd = new Command("blacklist").description("Manage blacklist (SSS-2 only)");

  cmd.command("add <address>")
    .description("Add address to blacklist")
    .option("--reason <reason>", "Reason for blacklisting", "Manual blacklist")
    .option("--mint <address>", "Mint address (overrides config)")
    .action(async (address, opts) => {
      const config = loadConfig();
      const mintAddress = opts.mint || config.mintAddress;
      if (!mintAddress) { console.error("No mint address."); process.exit(1); }
      const { wallet, provider } = getProvider(config);
      const program = new anchor.Program(loadIDL(), provider);
      const mintPk = new PublicKey(mintAddress);
      const walletPk = new PublicKey(address);
      const [coinPda] = PublicKey.findProgramAddressSync([Buffer.from("stableCoin"), mintPk.toBuffer()], program.programId);
      const [blacklistPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("blacklist"), mintPk.toBuffer(), walletPk.toBuffer()],
        program.programId
      );
      try {
        const tx = await program.methods.addToBlacklist(opts.reason)
          .accounts({ coinPda, blacklistAcc: blacklistPda, wallet: walletPk, authority: wallet.publicKey, systemProgram: SystemProgram.programId })
          .rpc();
        console.log(`Blacklisted: ${address}\nReason: ${opts.reason}\nTX: ${tx}`);
      } catch (err: any) { console.error(`Error: ${err.message}`); process.exit(1); }
    });

  cmd.command("remove <address>")
    .description("Remove address from blacklist")
    .option("--mint <address>", "Mint address (overrides config)")
    .action(async (address, opts) => {
      const config = loadConfig();
      const mintAddress = opts.mint || config.mintAddress;
      if (!mintAddress) { console.error("No mint address."); process.exit(1); }
      const { wallet, provider } = getProvider(config);
      const program = new anchor.Program(loadIDL(), provider);
      const mintPk = new PublicKey(mintAddress);
      const walletPk = new PublicKey(address);
      const [coinPda] = PublicKey.findProgramAddressSync([Buffer.from("stableCoin"), mintPk.toBuffer()], program.programId);
      const [blacklistPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("blacklist"), mintPk.toBuffer(), walletPk.toBuffer()],
        program.programId
      );
      try {
        const tx = await program.methods.removeFromBlacklist()
          .accounts({ coinPda, blacklistEntry: blacklistPda, wallet: walletPk, authority: wallet.publicKey, systemProgram: SystemProgram.programId })
          .rpc();
        console.log(`Removed from blacklist: ${address}\nTX: ${tx}`);
      } catch (err: any) { console.error(`Error: ${err.message}`); process.exit(1); }
    });

  return cmd;
}