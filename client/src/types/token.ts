export interface Token {
    address: string;
    name: string;
    symbol: string;
    mintDate: string;
    currentPrice: number;
    priceChange24h: number;
    volume24h: number;
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
} 