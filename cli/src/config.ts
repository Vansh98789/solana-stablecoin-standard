import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair } from "@solana/web3.js";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

export interface CLIConfig {
  rpcUrl: string;
  walletPath: string;
  programId: string;
  mintAddress?: string;
}

const CONFIG_PATH = path.join(process.env.HOME || "~", ".sss-token", "config.json");

export function loadConfig(): CLIConfig {
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error("No config found. Run: sss-token config init");
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
}

export function saveConfig(config: CLIConfig): void {
  const dir = path.dirname(CONFIG_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
}

export function loadWallet(walletPath: string): Keypair {
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf-8"))));
}

export function getProvider(config: CLIConfig) {
  const connection = new Connection(config.rpcUrl, "confirmed");
  const keypair = loadWallet(config.walletPath);
  const wallet = new anchor.Wallet(keypair);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);
  return { connection, wallet, provider };
}

export function loadIDL(): any {
  const idlPath = path.join(process.env.HOME || "~", ".sss-token", "idl.json");
  if (!fs.existsSync(idlPath)) {
    console.error("IDL not found at ~/.sss-token/idl.json");
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(idlPath, "utf-8"));
}