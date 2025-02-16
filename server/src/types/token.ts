export interface TokenData {
    address: string;
    name: string;
    symbol: string;
    currentPrice: number;
    priceChange24h: number;
    volume24h: number;
    marketCap: number;
    fdv: number;
    liquidity: number;
    holderCount: number;
    totalScore: number;
    volume: number;
    socialScore: number;
}

export interface TokenAnalysis {
    price: number | null;
    volume24h: number | null;
    volumeH6: number | null;
    volumeH1: number | null;
    volumeM5: number | null;
    marketCap: number | null;
    liquidity: number | null;
    holderCount: number | null;
    totalScore: number | null;
    priceChange24h: number | null;
    priceChangeH6: number | null;
    priceChangeH1: number | null;
    priceChangeM5: number | null;
    fdv: number | null;
    buys24h: number | null;
    sells24h: number | null;
}

export interface Token {
    address: string | null;
    name: string | null;
    symbol: string | null;
    mintDate: string | null;
    currentPrice: number | null;
    priceChange24h: number | null;
    volume24h: number | null;
    marketCap: number | null;
    fdv: number | null;
    liquidity: number | null;
    holderCount: number | null;
    totalScore: number | null;
    priceChangeM5: number | null;
    txns24h: {
        buys: number | null;
        sells: number | null;
    } | null;
}
