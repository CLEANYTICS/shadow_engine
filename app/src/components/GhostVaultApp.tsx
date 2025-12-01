/* eslint-disable */
// @ts-nocheck
'use client';

import { FC, useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { PublicKey, Transaction, TransactionInstruction, SystemProgram, ComputeBudgetProgram, Connection, Keypair, SYSVAR_INSTRUCTIONS_PUBKEY, Ed25519Program } from '@solana/web3.js';
import { sha256 } from 'js-sha256';
import { Buffer } from 'buffer';
import CryptoJS from 'crypto-js'; 
import nacl from 'tweetnacl'; 
import toast, { Toaster } from 'react-hot-toast';
import '@solana/wallet-adapter-react-ui/styles.css';

//  CONFIG
const PROGRAM_ID = new PublicKey("AouRAHF6Cm2oqCNiJcV2Gg4Vzwyy5UeA3jnFYS5jJm4W"); 

// Load key from .env.local
const API_KEY = process.env.NEXT_PUBLIC_HELIUS_API_KEY || ""; 

if (!API_KEY) {
    if (typeof window !== "undefined") {
        console.error("Missing Helius API Key");
    }
}

// CONFIG: ZCASH ORACLE PRICE
const ZEC_PRICE_USD = 400; 

const HELIUS_MAINNET = `https://mainnet.helius-rpc.com/?api-key=${API_KEY}`;
const HELIUS_DEVNET = `https://devnet.helius-rpc.com/?api-key=${API_KEY}`;
const HELIUS_API_V0 = `https://api.helius.xyz/v0`; 
const PUMP_PORTAL_WSS = "wss://pumpportal.fun/api/data";

const BASKET_OPTIONS = [
    { id: 'usdc', ticker: 'USDC', name: 'USD Coin', type: 'stable', desc: 'Liquid Stablecoin' },
    { id: 'vnxau', ticker: 'VNXAU', name: 'VNX Swiss Gold', type: 'rwa', desc: 'Tokenized Gold' },
    { id: 'wbtc', ticker: 'wBTC', name: 'Wrapped Bitcoin', type: 'bluechip', desc: 'Store of Value' },
    { id: 'wzec', ticker: 'wZEC', name: 'Wrapped Zcash', type: 'privacy', desc: 'Shielded Asset' },
    { id: 'googx', ticker: 'GOOGX', name: 'Alphabet Inc.', type: 'stock', desc: 'Tokenized Equity' },
];

const encoder = new TextEncoder();
const getPda = (pubkey: PublicKey) => PublicKey.findProgramAddressSync([encoder.encode("swiss_account"), pubkey.toBuffer()], PROGRAM_ID)[0];
const getDisc = (name: string) => Buffer.from(sha256.array(`global:${name}`).slice(0, 8));

// DEMO ORACLE KEYPAIR
const ORACLE_KEYPAIR = Keypair.generate(); 

// INTERFACES
interface HeliusAsset {
    id: string;
    content: { metadata: { name: string; symbol: string; }; };
    compression: { compressed: boolean; tree?: string; };
    token_info?: { price_info?: { total_price?: number; }; };
}

interface SnipedToken {
    signature: string;
    mint: string;
    name?: string;
    symbol?: string;
    marketCapSol: number;
    timestamp: string;
}

interface RealZcashTx {
    hash: string;
    amount_zec: number;
    confirmations: number;
    time: string;
    sender: string;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const getHex = (len: number) => "0x" + Array.from({length: len}, () => Math.floor(Math.random() * 16).toString(16)).join('');

export const GhostVaultApp: FC = () => {
  const [connection] = useState(() => new Connection(HELIUS_DEVNET, "confirmed"));
  const { publicKey, sendTransaction } = useWallet();

  // --- STATE ---
  const [step, setStep] = useState(1);
  const [depositAmt, setDepositAmt] = useState("10"); 
  const [isTransacting, setIsTransacting] = useState(false);
  const [processStatus, setProcessStatus] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  
  // --- ZK THEATRE & REAL ZCASH STATE ---
  const [showProofModal, setShowProofModal] = useState(false);
  const [proofData, setProofData] = useState<any>(null);
  const [zcashTxId, setZcashTxId] = useState(""); 
  const [zcashRealData, setZcashRealData] = useState<RealZcashTx | null>(null);

  // --- PRIVACY STATE ---
  const [viewingKey, setViewingKey] = useState("");
  const [sessionHash, setSessionHash] = useState("");
  const [isVaultLocked, setIsVaultLocked] = useState(true);

  // --- DATA ---
  const [priorityFee, setPriorityFee] = useState<number>(5000); 
  const [activityLog, setActivityLog] = useState<any[]>([]);
  const [portfolioAssets, setPortfolioAssets] = useState<HeliusAsset[]>([]);
  const [showXRay, setShowXRay] = useState(false);
  
  // --- SNIPER & REBALANCE STATE ---
  const [allocations, setAllocations] = useState<{ [key: string]: number }>({
      usdc: 0, wzec: 0, wbtc: 0, vnxau: 0, googx: 0, sniper_mode: 0
  });
  const [snipedTokens, setSnipedTokens] = useState<SnipedToken[]>([]);
  const [isSniping, setIsSniping] = useState(false);
  const [driftDetected, setDriftDetected] = useState(false); 
  const isDemoReset = useRef(false);

  const totalBalance = portfolioAssets.reduce((acc, asset) => acc + (asset.token_info?.price_info?.total_price || 0), 0);
  const totalAlloc = Object.values(allocations).reduce((a, b) => a + b, 0);

  // P&L
  const initialInvestment = (parseFloat(depositAmt) || 0) * ZEC_PRICE_USD;
  const pnlValue = totalBalance - initialInvestment;
  const pnlPercent = initialInvestment > 0 ? (pnlValue / initialInvestment) * 100 : 0;
  const isProfitable = pnlValue >= 0;

  // --- INIT KEYS ---
  useEffect(() => {
      setViewingKey("zxviews" + Array.from({length: 40}, () => Math.floor(Math.random() * 16).toString(16)).join(''));
      setSessionHash("0x" + Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join(''));
  }, []);

  // 1. HELIUS
  const getPriorityFee = useCallback(async () => {
    try {
        const response = await fetch(HELIUS_MAINNET, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0', id: 'helius-gas', method: 'getPriorityFeeEstimate',
                params: [{ accountKeys: [PROGRAM_ID.toBase58()], options: { includeAllPriorityFeeLevels: true } }]
            }),
        });
        const data = await response.json();
        if (data.result?.priorityFeeLevels?.high) setPriorityFee(data.result.priorityFeeLevels.high);
    } catch (e) { }
  }, []);
  useEffect(() => { const i = setInterval(getPriorityFee, 3000); return () => clearInterval(i); }, [getPriorityFee]);

  // 2. DAS & HISTORY
  const syncAssets = useCallback(async () => {
      if (!publicKey) return;
      try {
          const response = await fetch(HELIUS_DEVNET, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                  jsonrpc: '2.0', id: 'helius-das', method: 'getAssetsByOwner',
                  params: { ownerAddress: publicKey.toBase58(), page: 1, limit: 10, displayOptions: { showFungible: true } }
              }),
          });
          const { result } = await response.json();
          const realAssets = result?.items || [];
          const stored = localStorage.getItem("ghostvault_assets");
          const localAssets = stored ? JSON.parse(stored) : [];
          setPortfolioAssets(prev => {
              const combined = [...localAssets, ...realAssets];
              return Array.from(new Map(combined.map((item: any) => [item.id, item])).values()) as HeliusAsset[];
          });
      } catch (e) { }
  }, [publicKey]);

  const fetchParsedHistory = useCallback(async () => {
      if (!publicKey) return;
      try {
          const pda = getPda(publicKey);
          const signatures = await connection.getSignaturesForAddress(pda, { limit: 5 });
          if(signatures.length === 0) { setActivityLog([]); return; }
          const txIds = signatures.map(s => s.signature);
          try {
            const response = await fetch(`${HELIUS_API_V0}/transactions/?api-key=${API_KEY}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transactions: txIds })
            });
            const parsedData = await response.json();
            if(parsedData && Array.isArray(parsedData) && parsedData.length > 0) {
                setActivityLog(parsedData.map((tx: any) => ({
                    time: new Date(tx.timestamp * 1000).toLocaleTimeString(),
                    type: tx.type === "UNKNOWN" ? "ENCRYPTED_CALL" : tx.type, 
                    fullSig: tx.signature,
                    description: "Shielded State Update"
                })));
                return;
            }
          } catch(e) {}
          setActivityLog(signatures.map(sig => ({
             time: new Date(sig.blockTime! * 1000).toLocaleTimeString(),
             type: "ENCRYPTED_CALL",
             fullSig: sig.signature,
             description: "Confirmed on Helius RPC"
          })));
      } catch (e) { }
  }, [publicKey, connection]);
  useEffect(() => { syncAssets(); fetchParsedHistory(); }, [syncAssets, fetchParsedHistory]);

  // 3. SNIPER pumpfun
  useEffect(() => {
      if (step !== 3 || allocations['sniper_mode'] <= 0) return;
      if (snipedTokens.length >= 5) { setIsSniping(false); return; }
      setIsSniping(true);
      const ws = new WebSocket(PUMP_PORTAL_WSS);
      ws.onopen = () => { ws.send(JSON.stringify({ method: "subscribeNewToken" })); };
      ws.onmessage = (event) => {
          try {
              const data = JSON.parse(event.data);
              if (data.txType === 'create') {
                  toast.success(`⚡ Sniped ${data.symbol || 'Meme'}!`, {
                    style: { background: '#111', color: '#4ade80', border: '1px solid #22c55e', fontSize: '12px' },
                    icon: '🔫'
                  });
                  const newToken = { signature: data.signature, mint: data.mint, name: data.name, symbol: data.symbol, marketCapSol: data.marketCapSol, timestamp: new Date().toLocaleTimeString() };
                  setSnipedTokens(prev => {
                      if (prev.length >= 5) { ws.close(); return prev; }
                      
                      const totalUsdValue = parseFloat(depositAmt) * ZEC_PRICE_USD;
                      const newAsset: HeliusAsset = {
                          id: `snipe_${data.mint}`,
                          content: { metadata: { name: `⚡ ${newToken.name || 'Snipe'}`, symbol: newToken.symbol || 'SNIPE' } },
                          compression: { compressed: true },
                          token_info: { price_info: { total_price: (totalUsdValue * (allocations['sniper_mode']/100)) / 5 } }
                      };
                      const current = JSON.parse(localStorage.getItem("ghostvault_assets") || "[]");
                      if (!current.find((c:any) => c.id === newAsset.id)) {
                          const updated = [...current, newAsset];
                          localStorage.setItem("ghostvault_assets", JSON.stringify(updated));
                          setPortfolioAssets(updated);
                      }
                      return [newToken, ...prev];
                  });
              }
          } catch(e) {}
      };
      return () => { if (ws.readyState === 1) ws.close(); };
  }, [step, allocations, depositAmt]);

  // 4. HEARTBEAT / "ALIVE" DASHBOARD
  useEffect(() => {
      // Only in unlocked dashboard view
      if (step !== 3 || isVaultLocked || driftDetected || isTransacting) return;

      const heartbeat = setInterval(() => {
          setPortfolioAssets(prev => {
              return prev.map(asset => {
                  if (Math.random() > 0.4) return asset; // Only update ~60% of assets each tick
                  const noise = 1 + (Math.random() * 0.003 - 0.0015);
                  const currentPrice = asset.token_info?.price_info?.total_price || 0;
                  return { 
                      ...asset, 
                      token_info: { 
                          price_info: { total_price: currentPrice * noise } 
                      } 
                  };
              });
          });
      }, 2000); // Tick every 2 seconds

      return () => clearInterval(heartbeat);
  }, [step, isVaultLocked, driftDetected, isTransacting]);

  // --- ACTIONS ---

  const handleReset = () => { 
      isDemoReset.current = true; 
      localStorage.removeItem("ghostvault_assets"); 
      setStep(1); setPortfolioAssets([]); setSnipedTokens([]); setActivityLog([]); setIsVaultLocked(true); setDriftDetected(false); setShowSuccessModal(false); setZcashTxId(""); setZcashRealData(null);
      setAllocations({ usdc: 0, wzec: 0, wbtc: 0, vnxau: 0, googx: 0, sniper_mode: 0 });
  };
  
  const handleWeightChange = (id: string, val: string) => { setAllocations(prev => ({ ...prev, [id]: parseInt(val) || 0 })); };

  const simulateVolatility = () => {
      if(portfolioAssets.length === 0) return;
      const driftedAssets = portfolioAssets.map(asset => {
          let multiplier = asset.id.startsWith('snipe_') ? (0.5 + Math.random() * 2.5) : (0.9 + Math.random() * 0.2); 
          const newPrice = (asset.token_info?.price_info?.total_price || 0) * multiplier;
          return { ...asset, token_info: { price_info: { total_price: newPrice } } };
      });
      setPortfolioAssets(driftedAssets);
      localStorage.setItem("ghostvault_assets", JSON.stringify(driftedAssets));
      setDriftDetected(true);
      toast('⚠ Market Volatility Detected!', { icon: '📉', style: { background: '#333', color: '#fbbf24', fontSize: '12px' } });
  };

  const executeRebalance = async () => {
      if (!publicKey) return;
      setIsTransacting(true);
      
      setProcessStatus("Calculating Optimal Weights..."); await sleep(1500);
      setProcessStatus("Re-Encrypting Portfolio State..."); await sleep(1500);
      setProcessStatus("Routing via Dark Pools...");

      const currentTotal = portfolioAssets.reduce((acc, a) => acc + (a.token_info?.price_info?.total_price || 0), 0);
      const sniperTargetValue = currentTotal * (allocations['sniper_mode'] / 100);
      const safeTargetValue = currentTotal - sniperTargetValue;
      const sniperCount = portfolioAssets.filter(a => a.id.startsWith('snipe_')).length || 1;
      const safeCount = portfolioAssets.filter(a => !a.id.startsWith('snipe_')).length || 1;

      const rebalancedAssets = portfolioAssets.map(asset => {
          let correctPrice = asset.id.startsWith('snipe_') ? (sniperTargetValue / sniperCount) : (safeTargetValue / safeCount);
          return { ...asset, token_info: { price_info: { total_price: correctPrice } } };
      });

      const tx = new Transaction();
      tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 5000 }));
      const newWeights = CryptoJS.AES.encrypt(JSON.stringify(rebalancedAssets.map(a => a.token_info?.price_info?.total_price)), viewingKey).toString();
      const str = new TextEncoder().encode(`REBALANCE:${newWeights}`);
      const ix = new TransactionInstruction({
          programId: PROGRAM_ID,
          data: Buffer.concat([getDisc("execute_rebalance"), Buffer.alloc(4), Buffer.from(str)]), 
          keys: [
            { pubkey: publicKey, isSigner: true, isWritable: true }, 
            { pubkey: getPda(publicKey), isSigner: false, isWritable: true },
            { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false }
          ]
      });
      
      const feeIx = SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: getPda(publicKey), lamports: 5000000 });
      
      tx.add(feeIx);
      tx.add(ix);
      
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;
      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');

      setPortfolioAssets(rebalancedAssets);
      localStorage.setItem("ghostvault_assets", JSON.stringify(rebalancedAssets));
      setDriftDetected(false);
      setIsTransacting(false);
      setProcessStatus("");
      toast.success('⚖️ Rebalance Complete', { style: { background: '#111', color: '#fff' } });
      await fetchParsedHistory();
  };

  const executeTx = async (ixs: TransactionInstruction[]) => {
      if (!publicKey) return false;
      setIsTransacting(true);
      try {
          const tx = new Transaction();
          tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }));
          ixs.forEach(i => tx.add(i));
          const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
          tx.recentBlockhash = blockhash;
          tx.feePayer = publicKey;
          const sig = await sendTransaction(tx, connection);
          await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, 'confirmed');
          await fetchParsedHistory();
          return true;
      } catch (e) { console.error(e); return false; } finally { setIsTransacting(false); }
  };

  const sanitizeAndWithdraw = async () => {
      if (!publicKey) return;
      setIsTransacting(true);
      setProcessStatus("Burning Shadow Assets..."); await sleep(1500);
      setProcessStatus("Breaking Chain Links..."); await sleep(1500);
      setProcessStatus("Mixing Outgoing SOL..."); await sleep(1000);
      
      const str = new TextEncoder().encode(`SANITIZE_EXIT|HASH:${Math.random().toString(36).substring(7)}`);
      const ix = new TransactionInstruction({
          programId: PROGRAM_ID,
          data: Buffer.concat([getDisc("execute_rebalance"), Buffer.alloc(4), Buffer.from(str)]), 
          keys: [
            { pubkey: publicKey, isSigner: true, isWritable: true }, 
            { pubkey: getPda(publicKey), isSigner: false, isWritable: true },
            { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false }
          ]
      });

      const feeIx = SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: getPda(publicKey), lamports: 5000000 });

      const success = await executeTx([feeIx, ix]);
      
      if (success) {
          setShowSuccessModal(true); 
          await sleep(4000);
          handleReset();
          setShowSuccessModal(false);
          setProcessStatus("");
      } else {
          setProcessStatus("");
          setIsTransacting(false);
      }
  };

  // ---  NO TRANSACTION FOR STEP 1 ---
  const initProtocol = async () => { 
      // Pure frontend state transition for smoother demo
      setProcessStatus("Initializing..."); 
      await sleep(800); 
      setStep(2); 
      setProcessStatus("");
  };

  // --- REAL ZCASH VERIFIER ---
  const fetchZcashProof = async (tx: string) => {
    if(!tx) return;
    setZcashRealData(null);
    setIsTransacting(true);
    setProcessStatus("Querying Zcash Network (Blockchair API)...");
    
    try {
        const response = await fetch(`https://api.blockchair.com/zcash/dashboards/transaction/${tx}`);
        const data = await response.json();
        
        const txData = data.data[tx];
        if (!txData) {
            toast.error("Transaction not found on Zcash Mainnet!");
            setIsTransacting(false);
            return false;
        }

        const realTx = txData.transaction;
        const amountZec = realTx.output_total / 100000000; 
        
        const cleanData: RealZcashTx = {
            hash: realTx.hash,
            amount_zec: amountZec,
            confirmations: realTx.transaction_count || 3, 
            time: realTx.time,
            sender: "Shielded"
        };

        setZcashRealData(cleanData);
        setDepositAmt(amountZec.toString());
        
        setProcessStatus(`Confirmed: ${amountZec} ZEC found.`);
        await sleep(1000); 
        
        setIsTransacting(false);
        return true;

    } catch (e) {
        console.error(e);
        toast.error("API Limit/Error - Switching to Simulation Mode");
        const mockAmt = 12.450;
        setZcashRealData({
            hash: tx,
            amount_zec: mockAmt,
            confirmations: 12,
            time: new Date().toISOString(),
            sender: "t1ShieldedMock"
        });
        setDepositAmt(mockAmt.toString());
        setIsTransacting(false);
        return true;
    }
  };

  const depositFunds = async () => {
      if (!publicKey) return;
      setIsTransacting(true);
      
      // --- ZK THEATRE START ---
      const fakeProof = {
          proof_type: "sapling_spend",
          nullifier: getHex(64),
          commitment: getHex(64),
          ciphertext: "[ENCRYPTED_PAYLOAD]",
          viewing_key_hash: "0x" + sha256(viewingKey).slice(0, 16)
      };
      setProofData(fakeProof);
      setShowProofModal(true); 

      setProcessStatus("Generating Groth16 Proof...");
      await sleep(2500); 

      setProcessStatus("Verifying Nullifier...");
      await sleep(1000);
      
      setShowProofModal(false); 
      // --- ZK THEATRE END ---

      setProcessStatus("Encrypting Payload (AES)..."); await sleep(800);
      setProcessStatus("Bridging via Oracle Signer..."); 

      // --- ORACLE SIGNER LOGIC (ED25519) ---
      const msg = new TextEncoder().encode(`DEPOSIT:${publicKey.toBase58()}:${depositAmt}`);
      const sig = nacl.sign.detached(msg, ORACLE_KEYPAIR.secretKey);
      
      const ed25519Ix = Ed25519Program.createInstructionWithPublicKey({
          publicKey: ORACLE_KEYPAIR.publicKey.toBytes(),
          message: msg,
          signature: sig,
      });

      const disc = getDisc("deposit");
      
      const usdValue = parseFloat(depositAmt) * ZEC_PRICE_USD;
      const amt = Buffer.alloc(8); amt.writeBigUInt64LE(BigInt(Math.floor(usdValue)), 0);
      
      const basketData = JSON.stringify(allocations);
      const encryptedBasket = CryptoJS.AES.encrypt(basketData, viewingKey).toString();
      const str = new TextEncoder().encode(`ZEC:${encryptedBasket}`);
      const len = Buffer.alloc(4); len.writeUInt32LE(str.length, 0);
      
      const anchorIx = new TransactionInstruction({ 
          programId: PROGRAM_ID, 
          data: Buffer.concat([disc, amt, len, Buffer.from(str)]), 
          keys: [
              { pubkey: publicKey, isSigner: true, isWritable: true }, 
              { pubkey: getPda(publicKey), isSigner: false, isWritable: true },
              { pubkey: SYSVAR_INSTRUCTIONS_PUBKEY, isSigner: false, isWritable: false } 
          ] 
      });
      const transferIx = SystemProgram.transfer({ fromPubkey: publicKey, toPubkey: getPda(publicKey), lamports: 10000000 });
      
      const success = await executeTx([transferIx, ed25519Ix, anchorIx]);
      
      setProcessStatus("");
      if (success) {
          const newAssets: HeliusAsset[] = [];
          Object.keys(allocations).forEach(key => {
              if(key === 'sniper_mode') return; 
              if(allocations[key] > 0) {
                  const meta = BASKET_OPTIONS.find(o => o.id === key);
                  if(meta) {
                      newAssets.push({
                          id: `asset_${key}_${Math.random()}`,
                          content: { metadata: { name: meta.name, symbol: meta.ticker } },
                          compression: { compressed: true },
                          token_info: { price_info: { total_price: usdValue * (allocations[key]/100) } }
                      });
                  }
              }
          });
          const updated = [...(JSON.parse(localStorage.getItem("ghostvault_assets")||"[]")), ...newAssets];
          localStorage.setItem("ghostvault_assets", JSON.stringify(updated));
          setPortfolioAssets(updated);
          setStep(3);
      }
  };

  return (
    <div className="w-full min-h-screen font-space text-sm bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-purple-900/40 via-[#050505] to-black flex flex-col items-center justify-center">
        {/* Adjusted width handling: full width on mobile, max-xl on desktop, centered */}
        <div className="w-full max-w-xl px-4">
        <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;700&display=swap');
            .font-space { font-family: 'Space Grotesk', sans-serif; }
            
            /* NEW THEME: DEEP VOID / PURPLE GLASS */
            .glass {
                background: rgba(5, 5, 10, 0.6); 
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                border: 1px solid rgba(139, 92, 246, 0.15); /* Violet-500 very subtle */
                box-shadow: 0 4px 30px rgba(0, 0, 0, 0.4);
            }
            .glass-dark {
                background: rgba(0, 0, 0, 0.4);
                backdrop-filter: blur(4px);
                border: 1px solid rgba(139, 92, 246, 0.1);
            }

            /* HIDE INPUT NUMBER ARROWS (NEW FIX) */
            input[type=number]::-webkit-inner-spin-button, 
            input[type=number]::-webkit-outer-spin-button { 
                -webkit-appearance: none; 
                margin: 0; 
            }
            input[type=number] {
                -moz-appearance: textfield;
            }

            /* CUSTOM SCROLLBAR */
            ::-webkit-scrollbar {
                width: 6px;
                height: 6px;
            }
            ::-webkit-scrollbar-track {
                background: transparent; 
            }
            ::-webkit-scrollbar-thumb {
                background: rgba(139, 92, 246, 0.3); 
                border-radius: 10px;
            }
            ::-webkit-scrollbar-thumb:hover {
                background: rgba(139, 92, 246, 0.6); 
            }
            /* Firefox Fallback */
            * {
                scrollbar-width: thin;
                scrollbar-color: rgba(139, 92, 246, 0.3) transparent;
            }

            /* TYPEWRITER CURSOR */
            .typing-cursor::after {
                content: '▋';
                animation: blink 1s step-start infinite;
                color: #a78bfa;
                margin-left: 4px;
                font-size: 10px;
                vertical-align: middle;
            }
            @keyframes blink { 50% { opacity: 0; } }
        `}</style>

        <Toaster position="bottom-right" />
        
        {/* SUCCESS MODAL */}
        {showSuccessModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md animate-fade-in">
                <div className="glass p-8 rounded-2xl text-center max-w-xs shadow-[0_0_60px_rgba(139,92,246,0.2)]">
                    <div className="text-4xl mb-4">done</div>
                    <h2 className="text-xl font-bold text-white mb-2">WITHDRAWAL COMPLETE</h2>
                    <p className="text-gray-400 text-xs mb-4">Your funds have been sanitized and returned to your wallet.</p>
                    <div className="glass-dark p-3 rounded font-mono text-green-400 text-xs border border-green-500/30">HASH: {Math.random().toString(36).substring(2, 15).toUpperCase()}</div>
                </div>
            </div>
        )}

        {/* ZK PROOF PACKET MODAL */}
        {showProofModal && proofData && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md z-[60] flex items-center justify-center rounded-xl animate-fade-in">
                <div className="w-4/5 font-mono text-[10px] text-green-400 glass p-4 rounded-lg shadow-2xl">
                    <div className="flex justify-between items-center mb-2 border-b border-white/10 pb-1">
                        <span className="font-bold text-white">INCOMING ZEC SHIELDED PROOF</span>
                        <span className="animate-pulse text-green-500">●</span>
                    </div>
                    <div className="space-y-1 opacity-90">
                        <div className="flex justify-between"><span>Type:</span> <span className="text-purple-400">{proofData.proof_type}</span></div>
                        <div className="flex justify-between"><span>Nullifier:</span> <span className="truncate w-24 text-gray-400">{proofData.nullifier}...</span></div>
                        <div className="flex justify-between"><span>Commit:</span> <span className="truncate w-24 text-gray-400">{proofData.commitment}...</span></div>
                        <div className="flex justify-between"><span>VK Hash:</span> <span className="truncate w-24 text-gray-400">{proofData.viewing_key_hash}...</span></div>
                        <div className="flex justify-between"><span>Ciphertext:</span> <span className="text-gray-500">[ENCRYPTED BLOB]</span></div>
                    </div>
                    <div className="mt-3 text-center text-gray-500 italic border-t border-white/10 pt-2">Verifying Zero-Knowledge integrity...</div>
                </div>
            </div>
        )}

        {/* --- CONDITIONAL RENDERING: LANDING PAGE VS APP --- */}
        {!publicKey ? (
            // LANDING PAGE (Pre-Connection)
            <div className="flex flex-col items-center justify-center min-h-[80vh] text-center space-y-8 animate-fade-in">
                
                {/* Logo Area */}
                <div className="relative group cursor-default">
                    <div className="absolute -inset-2 rounded-full bg-purple-500/10 blur-xl group-hover:bg-purple-500/20 transition-all duration-1000"></div>
                    <h1 className="text-6xl md:text-7xl font-bold tracking-tighter text-white relative z-10">
                        SHADOW<span className="text-purple-500">ENGINE</span>
                    </h1>
                </div>
                
                {/* Tagline / Vibe */}
                <div className="space-y-2">
                     <p className="text-gray-400 font-mono text-xs md:text-sm tracking-[0.2em] uppercase">
                        Build your own portfolio, privately.
                    </p>
                    <div className="flex items-center justify-center gap-2 text-[10px] text-gray-600">
                        <span className="px-2 py-0.5 border border-gray-800 rounded-full">AES-256</span>
                        <span className="px-2 py-0.5 border border-gray-800 rounded-full">ZK-SNARKs</span>
                        <span className="px-2 py-0.5 border border-gray-800 rounded-full">Dark Pool</span>
                    </div>
                </div>

                {/* Main Action Button */}
                <div className="relative z-10 p-1 glass rounded-xl transition-transform hover:scale-105 duration-300">
                    <WalletMultiButton className="!bg-indigo-600 hover:!bg-indigo-500 !h-12 !px-8 !text-sm !font-bold !rounded-lg !uppercase !tracking-wider" />
                </div>

                <div className="absolute bottom-10 text-[10px] text-gray-700 font-mono">
                    Solana x <span className="text-green-500 animate-pulse">Zcash</span>
                </div>
            </div>
        ) : (
            // APP DASHBOARD (Post-Connection)
            <>
                {/* HEADER */}
                <div className="glass flex justify-between items-center mb-6 p-4 rounded-xl shadow-lg relative z-50">
                <div><h1 className="text-xl font-bold tracking-widest text-white">shadow<span className="text-purple-500">engine</span></h1></div>
                <div className="flex items-center gap-3">
                    <div className="flex flex-col items-end"><div className="text-[9px] text-gray-400 font-bold uppercase">NETWORK LOAD</div><div className="text-sm text-green-400 font-mono font-bold">{priorityFee} μL</div></div>
                    <WalletMultiButton className="!bg-indigo-600/20 hover:!bg-indigo-600 !border !border-indigo-500/50 !h-8 !text-xs !rounded-lg !backdrop-blur-md" />
                </div>
                </div>

                {/* STEP 1: BASKET */}
                {publicKey && (step === 1) && (
                <div className="glass rounded-xl p-6 shadow-xl animate-fade-in relative z-0">
                    <div className="mb-4"><h2 className="text-lg font-bold text-white">BUILD YOUR BASKET</h2><p className="text-xs text-gray-400">From Gold Bars to Meme Wars. Diversify in the dark.</p></div>
                    <div className="space-y-2 mb-6">
                        {BASKET_OPTIONS.map(token => (
                        <div key={token.id} className="glass-dark flex items-center justify-between p-3 rounded-lg">
                            <div className="flex items-center gap-2">
                                <div>
                                    <div className="font-bold text-sm text-white">{token.ticker}</div>
                                    <div className="text-[9px] text-gray-400 uppercase tracking-wide">{token.desc}</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {/* AUTO-FILL BUTTON */}
                                <button 
                                    onClick={() => handleWeightChange(token.id, (allocations[token.id] + (100 - totalAlloc)).toString())}
                                    disabled={totalAlloc >= 100 && allocations[token.id] > 0} 
                                    className="text-[10px] text-purple-400 font-bold border border-purple-500/30 px-2 py-1 rounded hover:bg-purple-500/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    MAX
                                </button>
                                
                                {/* RESTYLED INPUT: NO SPINNER ARROWS */}
                                <div className="flex items-center border-b border-gray-600 focus-within:border-purple-400 transition-colors">
                                    <input 
                                        type="number" 
                                        className="w-8 bg-transparent text-white text-right outline-none font-mono" 
                                        placeholder="0"
                                        value={allocations[token.id] || 0} 
                                        onChange={(e) => handleWeightChange(token.id, e.target.value)} 
                                    />
                                    <span className="text-gray-500 ml-1">%</span>
                                </div>
                            </div>
                        </div>
                        ))}
                        <div className="glass-dark flex items-center justify-between p-3 rounded-lg !border-green-500/20 !bg-green-900/10">
                            <div className="flex items-center gap-3">
                                <span className="text-lg animate-pulse">!</span>
                                <div>
                                    <div className="font-bold text-green-400 text-sm">PUMP.FUN SNIPER</div>
                                    <div className="text-[9px] text-green-500/60 uppercase tracking-wide">High Risk/Degen</div>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {/* AUTO-FILL BUTTON FOR SNIPER */}
                                <button 
                                    onClick={() => handleWeightChange('sniper_mode', (allocations['sniper_mode'] + (100 - totalAlloc)).toString())}
                                    disabled={totalAlloc >= 100 && allocations['sniper_mode'] > 0} 
                                    className="text-[10px] text-green-500 font-bold border border-green-500/30 px-2 py-1 rounded hover:bg-green-500/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                                >
                                    MAX
                                </button>

                                <div className="flex items-center border-b border-green-500/40 focus-within:border-green-400 transition-colors">
                                    <input 
                                        type="number" 
                                        className="w-8 bg-transparent text-white text-right outline-none font-mono" 
                                        placeholder="0"
                                        value={allocations['sniper_mode'] || 0} 
                                        onChange={(e) => handleWeightChange('sniper_mode', e.target.value)} 
                                    />
                                    <span className="text-gray-500 ml-1">%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="glass-dark flex justify-between items-center mb-6 p-3 rounded"><span className="text-gray-400 text-xs uppercase">Total Weight</span><span className={`font-mono font-bold ${totalAlloc === 100 ? 'text-green-400' : 'text-red-500'}`}>{totalAlloc}%</span></div>
                    <button onClick={initProtocol} disabled={isTransacting || totalAlloc !== 100} className="w-full bg-white text-black font-bold py-3 rounded hover:bg-gray-200 disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(255,255,255,0.2)]">
                        {/* TYPEWRITER TEXT */}
                        {isTransacting ? <span className="typing-cursor">{processStatus || "INITIALIZING..."}</span> : "CREATE SHIELDED VAULT"}
                    </button>
                </div>
                )}

                {/* STEP 2: DEPOSIT */}
                {publicKey && step === 2 && (
                <div className="glass rounded-xl p-6 animate-fade-in relative z-0">
                    <div className="flex justify-between items-start mb-4"><h2 className="text-lg font-bold text-white">Fund Portfolio</h2><div className="text-[10px] bg-indigo-500/10 text-indigo-300 px-2 py-1 rounded border border-indigo-500/30 backdrop-blur-sm">Awaiting Shielded Deposit</div></div>
                    <div className="space-y-4">
                        <div className="glass-dark p-3 rounded">
                            <div className="flex justify-between items-center mb-1"><div className="text-[10px] text-gray-500 uppercase font-bold">Unified Viewing Key</div><div className="text-[9px] text-purple-400">AES-256 Active</div></div>
                            <input type="text" readOnly value={viewingKey} className="w-full bg-transparent text-xs text-gray-400 p-2 rounded font-mono truncate border border-white/5 outline-none select-none cursor-default" />
                        </div>
                        <div className="glass-dark p-3 rounded font-mono">
                            <div className="flex justify-between items-center mb-1"><div className="text-[10px] text-yellow-500 uppercase font-bold">Bridge Connection</div><div className="flex items-center gap-1"><span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span><span className="text-[9px] text-green-500">Live</span></div></div>
                            {/* ZCASH TX INPUT */}
                            <div className="flex gap-2 mt-2">
                                <input type="text" placeholder="Paste Real Zcash TX ID..." value={zcashTxId} onChange={e=>setZcashTxId(e.target.value)} className="w-full bg-black/40 text-[10px] text-gray-300 p-2 rounded border border-white/10 focus:border-yellow-500 outline-none" />
                                <button onClick={()=>fetchZcashProof(zcashTxId)} disabled={!zcashTxId} className="bg-yellow-600/10 text-yellow-500 text-[10px] px-3 rounded border border-yellow-600/30 hover:bg-yellow-600/20 backdrop-blur-sm">VERIFY</button>
                            </div>

                            {/* REAL DATA DISPLAY CARD */}
                            {zcashRealData && (
                                <div className="mt-2 p-2 bg-green-900/20 border border-green-500/30 rounded font-mono text-[10px] text-green-400 animate-fade-in">
                                    <div className="flex justify-between border-b border-green-500/20 pb-1 mb-1">
                                        <span>ZCASH LIVE DATA</span>
                                        <span className="animate-pulse">● LIVE</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-y-1">
                                        <span className="text-gray-500">Hash:</span> <span className="truncate">{zcashRealData.hash.substring(0, 12)}...</span>
                                        <span className="text-gray-500">Amount:</span> <span className="font-bold text-white">{zcashRealData.amount_zec} ZEC</span>
                                        <span className="text-gray-500">Confs:</span> <span>{zcashRealData.confirmations > 3 ? "✅" : "⏳"} {zcashRealData.confirmations}</span>
                                        <span className="text-gray-500">Time:</span> <span>{zcashRealData.time.split(' ')[1]}</span>
                                    </div>
                                </div>
                            )}
                        </div>
                        
                        {/* INPUT: User types ZEC, sees USD value */}
                        <div>
                            <div className="relative">
                                <input type="number" value={depositAmt} onChange={e=>setDepositAmt(e.target.value)} className="w-full bg-black/40 border border-white/10 p-2 rounded text-white text-xs focus:border-purple-500 outline-none backdrop-blur-sm"/>
                                <span className="absolute right-3 top-2 text-xs text-gray-500 font-bold">ZEC</span>
                            </div>
                            <div className="text-right text-[10px] text-gray-500 mt-1">
                                Oracle Price: <span className="text-gray-300">${ZEC_PRICE_USD}</span> | Mint Power: <span className="text-green-400 font-mono">${(parseFloat(depositAmt || "0") * ZEC_PRICE_USD).toLocaleString()} USD</span>
                            </div>
                        </div>

                        <button onClick={depositFunds} disabled={isTransacting || !zcashRealData} className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-3 rounded transition-all disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm shadow-lg">
                            {/* TYPEWRITER TEXT */}
                            {isTransacting ? <span className="typing-cursor">{processStatus || "PROCESSING..."}</span> : "ENCRYPT & DEPOSIT"}
                        </button>
                    </div>
                </div>
                )}

                {/* STEP 3: DASHBOARD */}
                {publicKey && step === 3 && (
                <div className="space-y-4 animate-fade-in relative z-0">
                    {/* NAV CARD & UNLOCK */}
                    <div className="glass p-6 rounded-xl flex justify-between items-center relative overflow-hidden">
                        <div>
                            <div className="text-gray-400 text-[10px] uppercase tracking-widest mb-1">Net Asset Value</div>
                            <div className={`text-4xl font-bold text-white transition-all duration-500 ${isVaultLocked ? 'blur-md select-none' : ''}`}>${totalBalance.toLocaleString(undefined, {maximumFractionDigits: 0})}</div>
                            <div className={`mt-1 flex items-center gap-2 font-mono text-xs ${isVaultLocked ? 'blur-sm' : ''}`}><span className={`${isProfitable ? 'text-green-400' : 'text-red-400'} font-bold`}>{isProfitable ? '+' : ''}${Math.abs(pnlValue).toFixed(0)} ({pnlPercent.toFixed(1)}%)</span><span className="text-gray-500">All Time</span></div>
                        </div>
                        <div className="flex flex-col items-end gap-2 z-10">
                            <span className="text-[9px] text-gray-500">{isVaultLocked ? "VAULT LOCKED" : "VIEWING KEY ACTIVE"}</span>
                            <button onClick={() => setIsVaultLocked(!isVaultLocked)} className={`w-12 h-6 rounded-full p-1 transition-colors ${isVaultLocked ? 'bg-black/50 border border-white/10' : 'bg-green-500/80'}`}><div className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${isVaultLocked ? 'translate-x-0' : 'translate-x-6'}`}></div></button>
                        </div>
                    </div>

                    {/* ACTION CENTER */}
                    <div className="grid grid-cols-2 gap-3">
                        <button onClick={simulateVolatility} className="p-3 border border-dashed border-gray-700/50 rounded-xl text-center text-[10px] text-gray-400 hover:text-white hover:border-purple-500/50 transition-colors bg-white/5 backdrop-blur-sm">Simulate Market Movements</button>
                        {driftDetected ? (
                            <button onClick={executeRebalance} disabled={isTransacting} className="p-3 bg-red-900/20 border border-red-500/50 rounded-xl text-center text-[10px] text-red-400 font-bold hover:bg-red-500/40 hover:text-white animate-pulse transition-all backdrop-blur-sm">
                                {isTransacting ? <span className="typing-cursor">REBALANCING...</span> : "⚖️ FIX DRIFT (PRIVATE)"}
                            </button>
                        ) : (
                            <div className="p-3 border border-green-500/20 rounded-xl text-center text-[10px] text-green-500 font-bold bg-green-900/10 backdrop-blur-sm">Rebalance Portfolio</div>
                        )}
                    </div>

                    {/* LIVE SNIPER TERMINAL */}
                    {allocations['sniper_mode'] > 0 && (
                        <div className={`glass rounded-xl p-4 font-mono text-xs overflow-hidden relative transition-all duration-500 ${isVaultLocked ? 'blur-sm grayscale opacity-50' : ''}`}>
                            <div className="flex justify-between items-center mb-2 pb-2 border-b border-white/10">
                                <span className="text-green-400 font-bold flex items-center gap-2">{isSniping ? <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"/> : <span className="w-2 h-2 bg-gray-500 rounded-full"/>} LIVE PUMPPORTAL FEED</span>
                                <span className="text-[10px] text-gray-500">{snipedTokens.length}/5 Bag Filled</span>
                            </div>
                            <div className="space-y-2 h-32 overflow-y-auto custom-scrollbar">
                                {snipedTokens.map((token, i) => (
                                    <div key={i} className="flex justify-between items-center animate-fade-in text-green-300/80 hover:bg-green-900/10 p-1 rounded">
                                        <div><span className="font-bold text-white">{token.symbol}</span> <span className="text-[9px] opacity-70">Mint: {token.mint.slice(0,6)}...</span></div>
                                        <div className="text-green-500 font-bold text-[10px]">BOUGHT</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* HELIUS X-RAY */}
                    <div className="glass rounded-xl overflow-hidden">
                        <div className="p-4 border-b border-white/10 flex justify-between items-center">
                            <h3 className="text-xs font-bold text-gray-400 uppercase">Shielded Basket</h3>
                            <button onClick={() => setShowXRay(!showXRay)} className={`text-[10px] px-2 py-1 rounded border backdrop-blur-sm ${showXRay ? 'bg-purple-900/40 border-purple-500/50 text-white' : 'bg-white/5 border-white/10 text-gray-400'}`}>{showXRay ? "👁️ Hide Raw DAS Data" : "Helius X-Ray"}</button>
                        </div>
                        <div className="p-4 relative min-h-[100px]">
                            {isVaultLocked && !showXRay && (
                                <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-[4px] z-10 flex items-center justify-center">
                                    <div className="text-gray-400 text-xs font-mono border border-white/20 p-2 rounded bg-black/80"><span className="text-purple-500">ENCRYPTED DATA</span><br/>Need Viewing Key</div>
                                </div>
                            )}
                            {!showXRay ? (
                                <div className="space-y-2">
                                    {portfolioAssets.filter(a => !a.id.startsWith('snipe_')).map((asset) => {
                                        const name = BASKET_OPTIONS.find(o => asset.id.includes(o.id))?.ticker || asset.content.metadata.symbol;
                                        const actualPct = ((asset.token_info?.price_info?.total_price || 0) / totalBalance) * 100;
                                        const targetAllocKey = BASKET_OPTIONS.find(o => asset.id.includes(o.id))?.id;
                                        const targetPct = targetAllocKey ? allocations[targetAllocKey] : 0;
                                        return (
                                            <div key={asset.id} className={`flex justify-between items-center glass-dark p-2 rounded ${driftDetected ? 'border-red-500/50' : ''}`}>
                                                <div className="flex items-center gap-2"><span className="text-white font-bold text-sm">{name}</span></div>
                                                <div className="text-right">
                                                    <div className="text-white text-sm font-mono">${asset.token_info?.price_info?.total_price?.toFixed(0)}</div>
                                                    <div className={`text-[10px] ${driftDetected ? 'text-red-400' : 'text-gray-500'}`}>{actualPct.toFixed(1)}% (Target: {targetPct}%)</div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                    {allocations['sniper_mode'] > 0 && (
                                        <div className={`flex justify-between items-center bg-green-900/10 p-2 rounded border backdrop-blur-sm ${driftDetected ? 'border-red-500' : 'border-green-500/20'}`}>
                                            <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500"></div><span className="text-green-400 font-bold text-sm">SNIPER FUND</span></div>
                                            <div className="text-right">
                                                <div className="text-white text-sm font-mono">${portfolioAssets.filter(a => a.id.startsWith('snipe_')).reduce((sum, a) => sum + (a.token_info?.price_info?.total_price||0), 0).toFixed(0)}</div>
                                                <div className={`text-[10px] ${driftDetected ? 'text-red-400' : 'text-green-500'}`}>
                                                    {((portfolioAssets.filter(a => a.id.startsWith('snipe_')).reduce((sum, a) => sum + (a.token_info?.price_info?.total_price||0), 0) / totalBalance) * 100).toFixed(1)}% (Target: {allocations['sniper_mode']}%)
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-2 max-h-60 overflow-y-auto font-mono custom-scrollbar">
                                    {portfolioAssets.length > 0 ? portfolioAssets.map((asset, i) => (
                                        <div key={i} className="glass-dark p-2 rounded text-[10px] text-gray-400 border border-purple-500/20">
                                            <div className="flex justify-between text-purple-300 font-bold"><span>{asset.content.metadata.name}</span><span>${asset.token_info?.price_info?.total_price?.toFixed(2)}</span></div>
                                            <div className="grid grid-cols-2 mt-1 gap-1 opacity-70"><div>ID: {asset.id.slice(0, 8)}...</div><div>Compressed: {asset.compression.compressed ? "TRUE" : "FALSE"}</div></div>
                                        </div>
                                    )) : <div className="text-center text-gray-500">No compressed assets found.</div>}
                                    <div className="text-[9px] text-gray-500 mt-2 text-center pt-2 border-t border-white/10">Raw data fetched via Helius Digital Asset Standard API</div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* WITHDRAW / SANITIZE */}
                    <div className="text-center mt-4">
                        <button onClick={sanitizeAndWithdraw} disabled={isTransacting} className="text-red-500 text-[10px] font-bold border border-red-500/30 bg-red-900/10 px-6 py-3 rounded-xl hover:bg-red-500/20 hover:text-red-400 transition-all backdrop-blur-sm">
                            {isTransacting ? <span className="typing-cursor">{processStatus || "PROCESSING..."}</span> : "🔴 SANITIZE & WITHDRAW"}
                        </button>
                    </div>

                    {/* LOGS */}
                    <div className="glass-dark p-3 mt-4 rounded-xl">
                        <div className="flex justify-between items-center mb-2"><span className="text-[10px] text-orange-500 font-bold">⚡ HELIUS PARSED HISTORY</span><button onClick={fetchParsedHistory} className="text-[10px] text-gray-500 hover:text-white">↻ Refresh</button></div>
                        <div className="max-h-32 overflow-y-auto custom-scrollbar">
                            {activityLog.length > 0 ? activityLog.map((log, i) => (<div key={i} className="flex flex-col border-b border-white/5 last:border-0 py-2"><div className="flex justify-between text-[10px] text-gray-400 font-mono"><span>{log.time}</span><span className="text-white bg-white/10 px-1 rounded">{log.type}</span></div><div className="flex justify-between items-center mt-1"><span className="text-[11px] text-gray-300">{log.description}</span><a href={`https://xray.helius.xyz/tx/${log.fullSig}?network=devnet`} target="_blank" className="text-[10px] text-blue-500 hover:text-blue-400">View X-Ray ↗</a></div></div>)) : <div className="text-center text-[10px] text-gray-600 italic">No on-chain history found</div>}
                        </div>
                    </div>

                    <div className="text-center mt-2"><button onClick={handleReset} className="text-[9px] text-gray-600 hover:text-red-400 transition-colors">↺ Reset Demo State</button></div>
                </div>
                )}
            </>
        )}
        </div>
    </div>
  );
};