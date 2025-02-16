export interface JupiterToken {
    mint: string;
    created_at: string;
    metadata_updated_at: number;
    name: string;
    symbol: string;
    decimals: number;
    logo_uri: string;
    known_markets: string[];
    mint_authority: string | null;
    freeze_authority: string | null;
}

export interface DexScreenerPair {
    chainId: string;
    dexId: string;
    url: string;
    pairAddress: string;
    baseToken: {
        address: string;
        name: string;
        symbol: string;
    };
    quoteToken: {
        address: string;
        name: string;
        symbol: string;
    };
    priceNative: string;
    priceUsd: string;
    txns: {
        m5: { buys: number; sells: number; };
        h1: { buys: number; sells: number; };
        h6: { buys: number; sells: number; };
        h24: { buys: number; sells: number; };
    };
    volume: {
        h24: number;
        h6: number;
        h1: number;
        m5: number;
    };
    priceChange: {
        h1: number;
        h6: number;
        h24: number;
    };
    liquidity?: {
        usd: number;
        base: number;
        quote: number;
    };
    fdv: number;
    marketCap: number;
    pairCreatedAt: number;
    info?: {
        imageUrl?: string;
        header?: string;
        openGraph?: string;
        websites?: {
            label: string;
            url: string;
        }[];
        socials?: {
            type: string;
            url: string;
        }[];
    };
}
