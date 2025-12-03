# Hi!! :)
ShadowEngine is a tool that lets people privately build and manage their own fully self-custodied, highly diversified portfolio.
A cross-chain private portfolio engine that brings Zcash-level privacy to Solana-native assets.
Check it out! https://shadow-engine-dun.vercel.app/

## Hackathon Tracks & Bounties

This project is submitted for the following tracks:

### Helius
ShadowEngine uses three key Helius features to make the private ZEC↔Solana vault intuitive:
1.  **Helius DAS:** Used to fetch assets, providing an "X-Ray" view into the user's vault. This displays complex, compressed portfolio data instantly.
2.  **Parsed Transaction History:** Turns low-level program calls into a readable activity feed. This is vital because privacy features often make raw on-chain data hard to interpret.
3.  **Priority Fee API:** Displays live network load to ensure the UI feels responsive and transactions land during volatility.

### Pump.fun
*   **Sniper Mode:** the live `pumpportal` WebSocket feed was directly integrated into the private vault. Users can auto-snipe new launches into their shielded portfolio without revealing their identity or strategy.

### Cross-Chain Privacy (Axelar & Osmosis), 
*   **The Bridge:** ShadowEngine implements a novel cross-chain privacy solution that bridges Zcash liquidity directly into Solana. Users prove a ZEC deposit off-chain, and an Oracle verifies it via **Solana Instruction Introspection** before allowing minting.

---
### TL;DR
Private Zcash deposits → encrypted Solana vault.

Client-side viewing key = user-owned privacy.

Ed25519 oracle + introspection = enforced privacy rules.

Helius + pump.fun live data inside a shielded portfolio.



## Quick Start

### 1. Install Dependencies

```bash
npm install
```
### 2. Configure Environment and run it
You need a Helius API Key to run the indexer and history parser. https://dashboard.helius.dev/signup?redirectTo=onboarding
Create a .env.local file in the root directory:
```
NEXT_PUBLIC_HELIUS_API_KEY=your_api_key_here
```
```
npm run dev
```
### Project Structure
/app/src/components/GhostVaultApp.tsx -> The ShadowEngine UI (Wallet, AES Encryption, Zcash Bridge, Helius Hooks).
/programs/ghost_vault/src/lib.rs -> The Solana Contract (Introspection logic, Deposit handling, State management).

### Deployed Program ID
AouRAHF6Cm2oqCNiJcV2Gg4Vzwyy5UeA3jnFYS5jJm4W (Devnet)

### Usage Guide
1.  The app requires a Real Zcash Transaction ID (not block). Can be found here https://blockexplorer.one/zcash/mainnet/transactions or https://mainnet.zcashexplorer.app/
    - for example 678af44adf0df5c0a0de724261ee0e16244133e9af52f56d041d74950a2e0922
2. You will need a tiny amount of SOL DEV in your Phantom Wallet for gas fee https://faucet.solana.com/

### Architecture & Privacy Mechanics
ShadowEngine uses a hybrid architecture to achieve privacy on a public chain:

**1. The "Introspection" Bridge (Rust/Anchor)**
I do not verify ZK-SNARKs directly on Solana. Instead, I use Instruction Introspection.
The offchain Oracle verifies the Zcash transaction.
The Oracle signs a message using Ed25519.
The Solana program checks sysvar::instructions to ensure the Ed25519 Verify program was called successfully in the previous instruction before allowing a deposit.

**2. Encrypted State (Frontend)**
The specific asset breakdown (e.g., "50% BTC, 50% Memes") is never stored in plaintext on the blockchain.
Onchain: Stores only Total Equity and an Encrypted Blob (string).
Offchain: The frontend uses AES-256 with a client-side viewing key to decrypt and display the user's specific allocations.

### Real vs. Simulated Components
ShadowEngine is a robust architectural prototype. Here is the breakdown of what is live onchain vs. what is simulated for the hackathon:

Solana Program: **REAL**	Deployed on Devnet. Enforces privacy rules and state.

Oracle Logic: **REAL** The Ed25519 signature verification is enforced onchain.

Zcash Data: **REAL** We query live Zcash mainnet RPCs to validate deposits.

Helius Feeds: **REAL** Live DAS, RPC, and Fee data streaming.

Pump.fun Feed: **REAL**	Live WebSocket connection to PumpPortal.

Standard Assets: **Hardcoded** Devnet lacks real liquidity for these specific RWAs.

ZK Proofs: **Simulated**	The "Proof Generation" loading state is a UI simulation.

Rebalancing: **Simulated**	Volatility is simulated locally to demonstrate rebalance mechanics.

While this hackathon demo simulates the zero-knowledge proofs and market volatility to focus on the UX/Architecture, a Mainnet version would implement the following:

### FUTURE: Transitioning to Production
*   **Client-Side ZK Proving:** Instead of the current UI simulation, we would implement **Halo2 or Groth16 (via WASM)** directly in the browser. The user would generate a valid proof of Zcash ownership locally, ensuring their keys never touch the internet.
*   **On-Chain Verification:** The Solana program would be upgraded to verify these proofs onchain (or via a decentralized Oracle network if Compute Unit limits are exceeded), replacing the current Ed25519 signature check.
*   **Live Rebalancing:** Instead of simulated volatility, we would integrate **Pyth Oracles** for real-time price feeds and use **Jupiter CPI (Cross-Program Invocation)** to perform the actual asset swaps inside the vault when a rebalance is triggered.
*    **Universal Asset Sourcing (Jupiter):** To buy public assets like Gold or BTC without revealing an individual user's strategy, the production version will use an **Omnibus (Communal) Vault** structure.
  
     **How it works:** When User A wants Gold, the **ShadowEngine Program** executes the swap via Jupiter. The SOL leaves the program, and the Gold enters the program's shared main account.
    
     **The Privacy:** Onchain, observers only see that "ShadowEngine" bought Gold. They cannot see *which* user initiated the trade or who owns that specific chunk of Gold. User ownership is tracked solely via the client-side encrypted state blobs.
     
### Potential Features
*   **Strategy Backtesting:** Allow users to simulate how their "Dark Pool" allocation (e.g., 50% Gold / 50% SOL) would have performed over the last year using historical Helius data.
*   **Multi-Vault Support:** Enabling users to create distinct portfolios for different risk profiles (e.g., a "Safe Vault" for RWA/Stablecoins and a "Degen Vault" for Pump.fun assets).

if you read all of this wow thank you & have a great day

my first hackathon submission yaay

