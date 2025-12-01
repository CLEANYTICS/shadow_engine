'use client';

import dynamic from 'next/dynamic';
import React, { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import { GhostVaultApp } from '@/components/GhostVaultApp'; // Named import matches export

// 1. Create a Wallet Context Wrapper Component
const WalletContextWrapper = ({ children }: { children: React.ReactNode }) => {
    const network = WalletAdapterNetwork.Devnet;
    const endpoint = useMemo(() => clusterApiUrl(network), [network]);
    const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter()], [network]);

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>
                    {children}
                </WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};

// 2. The Page Component
const Home = () => {
    return (
        <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
             {/* Wrap the App inside the Context */}
             <WalletContextWrapper>
                <GhostVaultApp />
             </WalletContextWrapper>
        </main>
    );
};

// 3. EXPORT DYNAMICALLY to fix "window is undefined" errors
export default dynamic(() => Promise.resolve(Home), { 
    ssr: false 
});