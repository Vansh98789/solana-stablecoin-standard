import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { loadConfig, loadIDL, getProvider } from "../config";

export function auditLogCommand(): Command {
  return new Command("audit-log")
    .description("Fetch recent on-chain events for this stablecoin")
    .option("--mint <address>", "Mint address (overrides config)")
    .option("--limit <n>", "Number of signatures to fetch", "20")
    .action(async (opts) => {
      const config = loadConfig();
      const mintAddress = opts.mint || config.mintAddress;
      if (!mintAddress) { console.error("No mint address."); process.exit(1); }
      const { provider } = getProvider(config);
      try {
        const mintPk = new PublicKey(mintAddress);
        const sigs = await provider.connection.getSignaturesForAddress(mintPk, { limit: parseInt(opts.limit) });
        console.log(`\nAudit Log — last ${sigs.length} transactions`);
        console.log("─────────────────────────────────────────────────────────");
        for (const sig of sigs) {
          const time = sig.blockTime ? new Date(sig.blockTime * 1000).toISOString() : "unknown";
          const status = sig.err ? "FAILED" : "OK";
          console.log(`  [${status}] ${time}  ${sig.signature}`);
          if (sig.memo) console.log(`         memo: ${sig.memo}`);
        }
      } catch (err: any) { console.error(`Error: ${err.message}`); process.exit(1); }
    });
}