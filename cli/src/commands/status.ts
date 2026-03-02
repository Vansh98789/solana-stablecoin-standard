import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { loadConfig, loadIDL, getProvider } from "../config";

export function statusCommand(): Command {
  return new Command("status")
    .description("Show stablecoin configuration and status")
    .option("--mint <address>", "Mint address (overrides config)")
    .action(async (opts) => {
      const config = loadConfig();
      const mintAddress = opts.mint || config.mintAddress;
      if (!mintAddress) { console.error("No mint address."); process.exit(1); }
      const { provider } = getProvider(config);
      const program = new anchor.Program(loadIDL(), provider);
      const mintPk = new PublicKey(mintAddress);
      const [coinPda] = PublicKey.findProgramAddressSync([Buffer.from("stableCoin"), mintPk.toBuffer()], program.programId);
      try {
        const state = await (program.account as any).stableCoin.fetch(coinPda);
        console.log("\nStablecoin Status");
        console.log("─────────────────────────────────");
        console.log(`  Name:               ${state.name}`);
        console.log(`  Symbol:             ${state.symbol}`);
        console.log(`  Mint:               ${mintAddress}`);
        console.log(`  Authority:          ${state.authority.toString()}`);
        console.log(`  Paused:             ${state.isPause}`);
        console.log(`  Permanent Delegate: ${state.enablePermanentDelegate}`);
        console.log(`  Transfer Hook:      ${state.enableTransferHook}`);
        const supply = await provider.connection.getTokenSupply(mintPk);
        console.log(`  Total Supply:       ${supply.value.uiAmountString}`);
      } catch (err: any) { console.error(`Error: ${err.message}`); process.exit(1); }
    });
}

export function supplyCommand(): Command {
  return new Command("supply")
    .description("Show current token supply")
    .option("--mint <address>", "Mint address (overrides config)")
    .action(async (opts) => {
      const config = loadConfig();
      const mintAddress = opts.mint || config.mintAddress;
      if (!mintAddress) { console.error("No mint address."); process.exit(1); }
      const { provider } = getProvider(config);
      try {
        const supply = await provider.connection.getTokenSupply(new PublicKey(mintAddress));
        console.log(`Total Supply: ${supply.value.uiAmountString} (${supply.value.amount} raw)`);
      } catch (err: any) { console.error(`Error: ${err.message}`); process.exit(1); }
    });
}