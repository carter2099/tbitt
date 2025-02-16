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
    price: number;
    volume24h: number;
    volumeH6: number;
    volumeH1: number;
    volumeM5: number;
    marketCap: number;
    liquidity: number;
    holderCount: number;
    totalScore: number;
    priceChange24h: number;
    priceChangeH6: number;
    priceChangeH1: number;
    priceChangeM5: number;
    fdv: number;
    buys24h: number;
    sells24h: number;
}

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
    priceChangeM5: number;
    txns24h: {
        buys: number;
        sells: number;
    };
}
