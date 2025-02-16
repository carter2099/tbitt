export interface Token {
    address: string;
    name: string;
    symbol: string;
    mintDate: string;
    currentPrice: number;
    priceChange24h: number;
    volume24h: number;
    volumeH1: number;
    volumeM5: number;
    marketCap: number;
    fdv: number;
    liquidity: number;
    holderCount: number;
    totalScore: number;
    volume: number;
    socialScore?: number;
    socials?: {
        type: string;
        url: string;
    }[];
    txns24h?: {
        buys: number;
        sells: number;
    };
} 