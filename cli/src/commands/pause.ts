import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { loadConfig, loadIDL, getProvider } from "../config";

async function action(mode: "pause" | "unpause") {
  const config = loadConfig();
  if (!config.mintAddress) { console.error("No mint address."); process.exit(1); }
  const { wallet, provider } = getProvider(config);
  const program = new anchor.Program(loadIDL(), provider);
  const mintPk = new PublicKey(config.mintAddress);
  const [coinPda] = PublicKey.findProgramAddressSync([Buffer.from("stableCoin"), mintPk.toBuffer()], program.programId);
  try {
    const method = mode === "pause" ? program.methods.pause() : program.methods.unpause();
    const tx = await method.accounts({ coinPda, authority: wallet.publicKey }).rpc();
    console.log(`Stablecoin ${mode}d. TX: ${tx}`);
  } catch (err: any) { console.error(`Error: ${err.message}`); process.exit(1); }
}

export function pauseCommand(): Command {
  return new Command("pause").description("Pause the stablecoin").action(() => action("pause"));
}
export function unpauseCommand(): Command {
  return new Command("unpause").description("Unpause the stablecoin").action(() => action("unpause"));
}