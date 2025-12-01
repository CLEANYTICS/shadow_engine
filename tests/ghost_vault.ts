import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { GhostVault } from "../target/types/ghost_vault";
import { PublicKey } from "@solana/web3.js";

describe("ghost_vault", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.GhostVault as Program<GhostVault>;

  // --- YOUR NEW USDC MINT ---
  const USDC_MINT = new PublicKey("4JcMCowfWqjHvEHsB25ByFFzKST3jsgXkpjqPcZGkCAt");

  it("Is initialized (v5)!", async () => {
    // 1. Derive Addresses (Using "v5" seeds)
    const [poolState] = PublicKey.findProgramAddressSync([Buffer.from("state_v5")], program.programId);
    const [shareMint] = PublicKey.findProgramAddressSync([Buffer.from("share-mint-v5")], program.programId);
    const [vaultUsdc] = PublicKey.findProgramAddressSync([Buffer.from("vault-usdc-v5")], program.programId);

    console.log("Step 1: Initializing Pool...");
    try {
        await program.methods
        .initializePool()
        .accounts({
            admin: provider.wallet.publicKey,
            poolState: poolState,
            shareMint: shareMint,
            systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .rpc();
        console.log("✅ Pool Initialized!");
    } catch (e) {
        console.log("Pool might already be initialized (that's okay):", e);
    }

    console.log("Step 2: Initializing USDC Vault...");
    try {
        await program.methods
        .initializeUsdc()
        .accounts({
            admin: provider.wallet.publicKey,
            poolState: poolState,
            vaultUsdc: vaultUsdc,
            usdcMint: USDC_MINT,
            systemProgram: anchor.web3.SystemProgram.programId,
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .rpc();
        console.log("✅ USDC Vault Initialized!");
    } catch (e) {
        console.log("USDC Vault might already be initialized:", e);
    }
  });
}); 
// ^^^ THIS WAS MISSING!