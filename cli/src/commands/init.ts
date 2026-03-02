import { Command } from "commander";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import { loadConfig, loadIDL, getProvider, saveConfig } from "../config";

const PRESETS: any = {
  "sss-1": { enablePermanentDelegate: false, enableTransferHook: false, label: "SSS-1 Minimal" },
  "sss-2": { enablePermanentDelegate: true, enableTransferHook: true, label: "SSS-2 Compliant" },
};

export function initCommand(): Command {
  return new Command("init")
    .description("Initialize a new stablecoin")
    .option("--preset <preset>", "Preset: sss-1 or sss-2", "sss-1")
    .option("--name <n>", "Token name", "My Stablecoin")
    .option("--symbol <symbol>", "Token symbol", "MUSD")
    .option("--permanent-delegate", "Enable permanent delegate")
    .option("--transfer-hook", "Enable transfer hook")
    .action(async (opts) => {
      const config = loadConfig();
      const { wallet, provider } = getProvider(config);
      const idl = loadIDL();
      const preset = PRESETS[opts.preset];
      const enablePermanentDelegate = preset?.enablePermanentDelegate ?? !!opts.permanentDelegate;
      const enableTransferHook = preset?.enableTransferHook ?? !!opts.transferHook;

      console.log(`\nInitializing ${preset?.label ?? "Custom Stablecoin"}...`);
      const program = new anchor.Program(idl, provider);
      const mintKeypair = anchor.web3.Keypair.generate();
      const [coinPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("stableCoin"), mintKeypair.publicKey.toBuffer()],
        program.programId
      );
      try {
        const tx = await program.methods
          .initialize(opts.name, opts.symbol, false, enablePermanentDelegate, enableTransferHook)
          .accounts({
            mint: mintKeypair.publicKey, coinPda,
            authority: wallet.publicKey,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([mintKeypair])
          .rpc();

        config.mintAddress = mintKeypair.publicKey.toString();
        saveConfig(config);
        console.log(`\nStablecoin initialized!`);
        console.log(`  Mint: ${mintKeypair.publicKey.toString()}`);
        console.log(`  PDA:  ${coinPda.toString()}`);
        console.log(`  TX:   ${tx}`);
      } catch (err: any) {
        console.error(`Error: ${err.message}`);
        process.exit(1);
      }
    });
}