import { Command } from "commander";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import { loadConfig, loadIDL, getProvider } from "../config";

async function action(mode: "freeze" | "thaw", target: string, opts: any) {
  const config = loadConfig();
  const mintAddress = opts.mint || config.mintAddress;
  if (!mintAddress) { console.error("No mint address."); process.exit(1); }
  const { wallet, provider } = getProvider(config);
  const program = new anchor.Program(loadIDL(), provider);
  const mintPk = new PublicKey(mintAddress);
  const [coinPda] = PublicKey.findProgramAddressSync([Buffer.from("stableCoin"), mintPk.toBuffer()], program.programId);
  const targetAta = await getAssociatedTokenAddress(mintPk, new PublicKey(target), false, TOKEN_2022_PROGRAM_ID);
  try {
    const method = mode === "freeze" ? program.methods.freezeAccount() : program.methods.thrawAccount();
    const tx = await method.accounts({ coinPda, mint: mintPk, targetAcc: targetAta, authority: wallet.publicKey, tokenProgram: TOKEN_2022_PROGRAM_ID }).rpc();
    console.log(`${mode === "freeze" ? "Frozen" : "Thawed"}: ${target}\nTX: ${tx}`);
  } catch (err: any) { console.error(`Error: ${err.message}`); process.exit(1); }
}

export function freezeCommand(): Command {
  return new Command("freeze").description("Freeze a token account")
    .argument("<address>", "Account to freeze").option("--mint <address>", "Mint address")
    .action((addr, opts) => action("freeze", addr, opts));
}
export function thawCommand(): Command {
  return new Command("thaw").description("Thaw a frozen token account")
    .argument("<address>", "Account to thaw").option("--mint <address>", "Mint address")
    .action((addr, opts) => action("thaw", addr, opts));
}