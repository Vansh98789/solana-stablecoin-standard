import { Command } from "commander";
import { loadConfig, saveConfig } from "../config";
import path from "path";
import os from "os";

export function configCommand(): Command {
  const cmd = new Command("config").description("Manage CLI configuration");

  cmd.command("init")
    .option("--rpc <url>", "RPC URL", "https://api.devnet.solana.com")
    .option("--wallet <path>", "Path to keypair", path.join(os.homedir(), ".config/solana/id.json"))
    .option("--program <id>", "Program ID", "ELWfh8ZqRJ62nAQcjGKimAJXNjPrv41gf5tY7D4YH2bs")
    .action((opts) => {
      saveConfig({ rpcUrl: opts.rpc, walletPath: opts.wallet, programId: opts.program });
      console.log("Config saved!");
      console.log(`  RPC:     ${opts.rpc}`);
      console.log(`  Wallet:  ${opts.wallet}`);
      console.log(`  Program: ${opts.program}`);
    });

  cmd.command("show").action(() => console.log(JSON.stringify(loadConfig(), null, 2)));

  cmd.command("set-mint <address>").action((address) => {
    const config = loadConfig();
    config.mintAddress = address;
    saveConfig(config);
    console.log(`Active mint set to: ${address}`);
  });

  return cmd;
}