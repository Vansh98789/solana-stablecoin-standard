import * as anchor from "@anchor-lang/core";
import { Program } from "@anchor-lang/core";
import { StableCoin } from "../target/types/stable_coin";
import {
  PublicKey,
  Keypair,
  SystemProgram,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { assert } from "chai";



describe("stable_coin", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.StableCoin as Program<StableCoin>;
  const authority = provider.wallet as anchor.Wallet;

  let mintKeypair: Keypair;
  let coinPda: PublicKey;
  let coinPdaBump: number;
  let receiverAta: PublicKey;
  let receiver: Keypair;

 
  const findCoinPda = async (mint: PublicKey) => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("stableCoin"), mint.toBuffer()],
      program.programId
    );
  };

  const createAta = async (mint: PublicKey, owner: PublicKey) => {
    const ata = await getAssociatedTokenAddress(
      mint,
      owner,
      false,
      TOKEN_2022_PROGRAM_ID
    );

    const tx = new anchor.web3.Transaction().add(
      createAssociatedTokenAccountInstruction(
        authority.publicKey,
        ata,
        owner,
        mint,
        TOKEN_2022_PROGRAM_ID
      )
    );

    await provider.sendAndConfirm(tx);
    return ata;
  };


  before(async () => {
    mintKeypair = Keypair.generate();
    receiver = Keypair.generate();

    // Airdrop to receiver
  

    const [pda, bump] = await findCoinPda(mintKeypair.publicKey);
    coinPda = pda;
    coinPdaBump = bump;
  });

  it("Initialize SSS-1 stablecoin", async () => {
    await program.methods
      .initialize(
        "My Dollar",   
        "MYUSD",       
        false,         
        false,         
        false         
      )
      .accounts({
        mint: mintKeypair.publicKey,
        authority: authority.publicKey,
      })
      .signers([mintKeypair])
      .rpc();

    const config = await program.account.stableCoin.fetch(coinPda);
    assert.equal(config.name, "My Dollar");
    assert.equal(config.symbol, "MYUSD");
    assert.equal(config.isPause, false);
    assert.equal(config.enablePermanentDelegate, false);
    assert.equal(config.enableTransferHook, false);
    assert.ok(config.authority.equals(authority.publicKey));

    console.log("SSS-1 initialized:", mintKeypair.publicKey.toString());
  });

  it("Mint tokens to receiver", async () => {
    receiverAta = await createAta(mintKeypair.publicKey, receiver.publicKey);

    await program.methods
      .mint(new anchor.BN(1_000_000)) 
      .accounts({
        mint: mintKeypair.publicKey,
        receiverAta: receiverAta,
        authority: authority.publicKey,
      })
      .rpc();

    const balance = await provider.connection.getTokenAccountBalance(receiverAta);
    assert.equal(balance.value.amount, "1000000");

    console.log(" Minted 1 MYUSD to receiver");
  });

  it("Burn tokens from receiver", async () => {
    await program.methods
      .burnToken(new anchor.BN(500_000)) // burn 0.5 MYUSD
      .accounts({
        mint: mintKeypair.publicKey,
        burnAta: receiverAta,
        authority: authority.publicKey,
      })
      .rpc();

    const balance = await provider.connection.getTokenAccountBalance(receiverAta);
    assert.equal(balance.value.amount, "500000");

    console.log(" Burned 0.5 MYUSD");
  });

  it("Freeze receiver account", async () => {
    await program.methods
      .freezeAccount()
      .accounts({
        mint: mintKeypair.publicKey,
        targetAcc: receiverAta,
        authority: authority.publicKey,
      })
      .rpc();

    const account = await provider.connection.getAccountInfo(receiverAta);
    console.log(" Account frozen");
  });

  it("Thaw receiver account", async () => {
    await program.methods
      .thrawAccount()
      .accounts({
        mint: mintKeypair.publicKey,
        targetAcc: receiverAta,
        authority: authority.publicKey,
      })
      .rpc();

    console.log(" Account thawed");
  });

  it("Pause stablecoin", async () => {
    await program.methods
      .pause()
      .accounts({
        authority: authority.publicKey,
      })
      .rpc();

    const config = await program.account.stableCoin.fetch(coinPda);
    assert.equal(config.isPause, true);

    console.log("Stablecoin paused");
  });
  it("Mint fails when paused", async () => {
    try {
      await program.methods
        .mint(new anchor.BN(1_000_000))
        .accounts({
          mint: mintKeypair.publicKey,
          receiverAta: receiverAta,
          authority: authority.publicKey,
        })
        .rpc();

      assert.fail("Should have thrown error");
    } catch (err) {
      assert.include(err.message, "AccountPaused");
      console.log(" Mint correctly rejected when paused");
    }
  });

  it("Unpause stablecoin", async () => {
    await program.methods
      .unpause()
      .accounts({
        authority: authority.publicKey,
      })
      .rpc();

    const config = await program.account.stableCoin.fetch(coinPda);
    assert.equal(config.isPause, false);

    console.log("Stablecoin unpaused");
  });

  it("Initialize SSS-2 stablecoin", async () => {
    const sss2Mint = Keypair.generate();
    const [sss2Pda] = await findCoinPda(sss2Mint.publicKey);

    await program.methods
      .initialize(
        "Regulated Dollar",
        "RUSD",
        false,
        true,   
        true    
      )
      .accounts({
        mint: sss2Mint.publicKey,
        authority: authority.publicKey,
      })
      .signers([sss2Mint])
      .rpc();

    const config = await program.account.stableCoin.fetch(sss2Pda);
    assert.equal(config.enablePermanentDelegate, true);
    assert.equal(config.enableTransferHook, true);

    console.log("SSS-2 initialized:", sss2Mint.publicKey.toString());
  });

  it("Blacklist fails on SSS-1", async () => {
    const [blacklistPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("blacklist"),
        coinPda.toBuffer(),
        receiver.publicKey.toBuffer(),
      ],
      program.programId
    );

    try {
      await program.methods
        .addToBlacklist("test")
        .accounts({
          wallet: receiver.publicKey,
          authority: authority.publicKey,
        })
        .rpc();

      assert.fail("Should have thrown error");
    } catch (err) {
      assert.include(err.message, "NotTransferable");
      console.log(" Blacklist correctly rejected on SSS-1");
    }
  });
});