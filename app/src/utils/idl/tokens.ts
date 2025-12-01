import { PublicKey } from '@solana/web3.js';

export interface TokenConfig {
  id: string;
  name: string;
  ticker: string;
  mint: PublicKey;
  logoUrl: string; 
  color: string;
}

export const TOKENS: TokenConfig[] = [
  {
    id: 'usdc',
    name: 'USD Coin',
    ticker: 'USDC',
    mint: new PublicKey('4JcMCowfWqjHvEHsB25ByFFzKST3jsgXkpjqPcZGkCAt'), // Your USDC
    logoUrl: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
    color: '#2775CA'
  },
  {
    id: 'wzec',
    name: 'Wrapped Zcash',
    ticker: 'wZEC',
    mint: new PublicKey('DvGFCwiB5HciP5CyNVKKtafXCnxy1jrdzhrinw62kuaq'), // Your wZEC
    logoUrl: 'https://cryptologos.cc/logos/zcash-zec-logo.png?v=029',
    color: '#F4B728'
  },
  {
    id: 'mon',
    name: 'Monad',
    ticker: 'MON',
    mint: new PublicKey('7cDQuvdawLaRh1nNUcdm1RrtDnzmWuUkebhvipKSF3Aa'), // Your MON
    logoUrl: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/HWXuTxdTKGiUF9fq3CnELPCM7tmE9eJ2f7Yk82Z9pump/logo.png', // Borrowing a random purple logo
    color: '#836EF9'
  },
  {
    id: 'wbtc',
    name: 'Wrapped Bitcoin',
    ticker: 'wBTC',
    mint: new PublicKey('CK1qFNKDFg46fTwuBbjoR5JW6c4H8Fq6f3X5vhAv1NB'), // Your wBTC
    logoUrl: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/3NZ9JMVBmGAqocyBIC2c7LQCJScmgsAZ6vQqTDzcqmJh/logo.png',
    color: '#F7931A'
  },
  {
    id: 'wsol',
    name: 'Solana',
    ticker: 'SOL',
    mint: new PublicKey('62s5nasFshvmVNL9pQ6SHhSVvf6jvUhm4RKHJUN1XCe1'), // Your wSOL
    logoUrl: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
    color: '#14F195'
  },
    {
    id: 'maapl',
    name: 'Tokenized Apple',
    ticker: 'mAAPL',
    mint: new PublicKey('95ictzWhksp54RW3e2gqsrVNRC2Qp1VD15ZZcQoqMAka'),
    logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/fa/Apple_logo_black.svg', 
    color: '#A2AAAD' // Apple Silver
  },
  {
    id: 'paxg',
    name: 'Pax Gold',
    ticker: 'PAXG',
    mint: new PublicKey('8KTF5rcWQXGeKQx6Cx45YVq3PxFRpxnBCPmrtSejNSDf'),
    logoUrl: 'https://s2.coinmarketcap.com/static/img/coins/64x64/4705.png',
    color: '#D4AF37' // Gold Color
  }
];