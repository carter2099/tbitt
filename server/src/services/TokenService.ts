import axios from 'axios';
import { DexScreenerPair, JupiterToken } from '../types/api';
import { TokenAnalysis } from '../types/token';
import { APIError } from '../types/errors';
import { db } from '../db';

// Update the Token interface at the top of the file
export interface ScoringToken {
    address: string;
    name: string;
    symbol: string;
    volume24h: number | null;
    marketCap: number | null;
    txns24h: {
        buys: number | null;
        sells: number | null;
    };
    priceChange24h: number | null;
    priceChangeM5?: number | null;
    liquidity?: number | null;
}

interface SocialMedia {
    type: string;
    url: string;
}

export class TokenService {
    private readonly JUPITER_NEW_TOKENS_URL = 'https://api.jup.ag/tokens/v1/new';
    private readonly DEX_SCREENER_BASE_URL = 'https://api.dexscreener.com/token-pairs/v1/solana';

    constructor() {
    }

    async getNewTokens(): Promise<JupiterToken[]> {
        try {
            console.log(`Calling ${this.JUPITER_NEW_TOKENS_URL}`);
            const response = await axios.get<JupiterToken[]>(this.JUPITER_NEW_TOKENS_URL);
            console.log(`Received ${response.data.length} tokens from Jupiter API`);
            return response.data;
        } catch (error) {
            throw new APIError(
                `Failed to fetch new tokens from Jupiter: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    async analyzeToken(token: ScoringToken): Promise<TokenAnalysis> {
        try {
            console.log(`Getting token data for ${token.name}...`);
            
            // Get DEX Screener data first
            const pairData = await this.getDexScreenerData(token);

            if (!pairData || pairData.length === 0) {
                console.log(`No pair data found for ${token.name}`);
                return {
                    price: null,
                    volume24h: null,
                    volumeH6: null,
                    volumeH1: null,
                    volumeM5: null,
                    marketCap: null,
                    liquidity: null,
                    holderCount: null,
                    totalScore: null,
                    priceChange24h: null,
                    priceChangeH6: null,
                    priceChangeH1: null,
                    priceChangeM5: null,
                    fdv: null,
                    buys24h: null,
                    sells24h: null
                };
            }

            // Save social media information
            await this.saveSocialMedia(token, pairData);

            // Find pair with highest volume for some metrics
            const highestVolumePair = pairData.reduce((max, pair) => 
                (pair.volume.h24 > max.volume.h24) ? pair : max, pairData[0]);

            // Calculate aggregated metrics
            const avgPrice = pairData.length > 0 
                ? pairData.reduce((sum, pair) => sum + parseFloat(pair.priceUsd), 0) / pairData.length 
                : null;
            
            const totalVolumeM5 = this.sumValidValues(pairData, pair => pair.volume.m5);
            const totalVolumeH1 = this.sumValidValues(pairData, pair => pair.volume.h1);
            const totalVolumeH6 = this.sumValidValues(pairData, pair => pair.volume.h6);
            const totalVolume24h = this.sumValidValues(pairData, pair => pair.volume.h24);
            const totalLiquidity = this.sumValidValues(pairData, pair => pair.liquidity?.usd);

            // Sum up buys and sells across all pairs for 24h period
            const totalBuys24h = this.sumValidValues(pairData, pair => pair.txns.h24?.buys);
            const totalSells24h = this.sumValidValues(pairData, pair => pair.txns.h24?.sells);

            // Calculate score with the metrics we have
            const score = await this.calculateTokenScore({
                ...token,
                volume24h: totalVolume24h,
                marketCap: highestVolumePair.marketCap || null,
                txns24h: {
                    buys: totalBuys24h,
                    sells: totalSells24h
                },
                priceChange24h: highestVolumePair.priceChange.h24 || null,
                priceChangeM5: highestVolumePair.priceChange.m5 || null,
                liquidity: totalLiquidity || null
            });
            
            console.log(`${token.name}: ${avgPrice}, ${totalVolume24h}, ${highestVolumePair.marketCap}, ${totalLiquidity}, ${this.getHolderData(token)}, ${score}, ${highestVolumePair.priceChange.h24}, ${highestVolumePair.fdv}`);
            
            return {
                price: avgPrice,
                volume24h: totalVolume24h,
                volumeH6: totalVolumeH6 || null,
                volumeH1: totalVolumeH1 || null,
                volumeM5: totalVolumeM5 || null,
                marketCap: highestVolumePair.marketCap || null,
                liquidity: totalLiquidity || null,
                holderCount: this.getHolderData(token) || null,
                totalScore: score || null,
                priceChange24h: highestVolumePair.priceChange.h24 || null,
                priceChangeH6: highestVolumePair.priceChange.h6 || null,
                priceChangeH1: highestVolumePair.priceChange.h1 || null,
                priceChangeM5: highestVolumePair.priceChange.m5 || null,
                fdv: highestVolumePair.fdv || null,
                buys24h: totalBuys24h || null,
                sells24h: totalSells24h || null
            };
        } catch (error) {
            console.error(`Error analyzing token ${token.name} (${token.address}):`, error instanceof Error ? error.message : 'Unknown error');
            throw error;
        }
    }

    private async getDexScreenerData(token: ScoringToken, callCount: number = 0): Promise<DexScreenerPair[] | null> {
        try {
            const response = await axios.get<DexScreenerPair[]>(
                `${this.DEX_SCREENER_BASE_URL}/${token.address}`
            );
            
            if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
                console.log(`No pairs found for ${token.name}`);
                return null;
            }

            return response.data;
        } catch (error) {
            if (axios.isAxiosError(error) && error.response?.status === 429) {
                if (callCount > 3) {
                    return null;
                }
                console.log('Rate limit hit, waiting 30 seconds...');
                await new Promise(resolve => setTimeout(resolve, 30000));
                // Retry the request after waiting
                return this.getDexScreenerData(token, callCount + 1);
            } else if (axios.isAxiosError(error)) {
                console.error(`DexScreener API error for ${token.name}:`, {
                    status: error.response?.status,
                    data: error.response?.data
                });
            } else {
                console.error(`Failed to fetch DEX Screener data for ${token.name}:`, error);
            }
            return null;
        }
    }

    private getHolderData(token: ScoringToken): number {
        return 0;
    }

    public async calculateTokenScore(token: ScoringToken): Promise<number | null> {
        const txCount = (token.txns24h.buys || 0) + (token.txns24h.sells || 0);
    
        // hard rules
        if (token.marketCap && token.marketCap > 30000000) {
            return 1;
        }
        if (token.priceChangeM5 && token.priceChangeM5 < -20) {
            return 1;
        }
        if (token.priceChange24h && token.priceChange24h < -30) {
            return 1;
        }
        if (token.marketCap && token.marketCap < 100000) {
            return 1;
        }
        if (token.liquidity !== null && token.liquidity !== undefined && token.liquidity < 5000) {
            return 1;
        }
        
        const volumeWeight = 0.20;
        const liquidityWeight = 0.35;
        const holderWeight = 0.15;
        const txCountWeight = 0.25;
        const priceActionWeight = 0.05;
    
        // Volume score - Compare 24h volume to liquidity
        const liquidity = token.liquidity ?? 0;
        const volumeToLiquidityRatio = (token.volume24h && liquidity > 0) ? token.volume24h / liquidity : 0;
        const volumeScore = volumeToLiquidityRatio ? Math.min(Math.max(volumeToLiquidityRatio / 3, 0), 1) : 0;
    
        // Liquidity score
        const liquidityScore = (liquidity > 0) ? 
            Math.min(Math.log10(liquidity) / Math.log10(1000000), 1) : 0;
    
        // Holder score
        // const holderScore = token.holder_count > 0 ? 
        //     Math.min(Math.log10(token.holder_count) / Math.log10(1000), 1) : 0;
        const holderScore = 0;
    
        // Transaction count score
        const txScore = txCount > 0 ? 
            Math.min(Math.log10(txCount) / Math.log10(1000), 1) : 0;
    
        // Price action scoring
        let priceActionScore = 0;
        let priceChange = 0;
        if(token.priceChange24h) {
            priceChange = token.priceChange24h;
            if (priceChange > 0) {
                if (priceChange <= 50) {
                    priceActionScore = Math.min(priceChange / 50, 1);
                } else {
                    priceActionScore = Math.max(0.5, 1 - ((priceChange - 50) / 150));
                }
            } else {
                const normalizedDrop = Math.abs(priceChange);
                if (normalizedDrop <= 10) {
                    priceActionScore = Math.max(0, 1 - (normalizedDrop / 10));
                } else {
                    priceActionScore = Math.max(0, Math.exp(-0.15 * (normalizedDrop - 10)) * 0.5);
                }
            }
        }
    
        // Calculate initial score
        let totalScore = (
            volumeScore * volumeWeight +
            liquidityScore * liquidityWeight +
            holderScore * holderWeight +
            txScore * txCountWeight +
            priceActionScore * priceActionWeight
        );
    
        // Add buy/sell ratio penalty
        const buys = token.txns24h.buys || 0;
        const sells = token.txns24h.sells || 0;
        
        if (buys > 0) {
            const buyToSellRatio = sells > 0 ? buys / sells : buys;
            let ratioPenalty = 0;
    
            if (buys <= 7 || buyToSellRatio <= 4) {
                ratioPenalty = 0;
            }
            else if (sells === 0) {
                ratioPenalty = Math.min(0.9, (buys - 7) / 50);
            } else {
                ratioPenalty = Math.min(0.7, (buyToSellRatio - 4) / 20);
            }
    
            totalScore *= (1 - ratioPenalty);
        }
    
        // Apply penalties for price drops
        if (priceChange < 0) {
            const dropPenaltyFactor = Math.abs(priceChange) / 100;
            const penaltyMultiplier = Math.exp(-dropPenaltyFactor * 2);
            totalScore *= penaltyMultiplier;
    
            if (priceChange < -10) totalScore *= 0.7;
            if (priceChange < -20) totalScore *= 0.5;
            if (priceChange < -30) totalScore *= 0.3;
            if (priceChange < -50) totalScore *= 0.1;
            if (priceChange < -70) totalScore *= 0.01;
        }
    
        return totalScore * 100;
    }

    private async saveSocialMedia(token: ScoringToken, pairData: DexScreenerPair[]): Promise<void> {
        // Find first pair with social info
        const pairWithInfo = pairData.find(pair => {
            const socials = pair.info?.socials;
            return socials && socials.length > 0;
        });

        if(pairWithInfo?.info?.socials) {
            console.log(`${token.name} has socials: ${pairWithInfo?.info?.socials?.reduce((acc, social) => acc + social.type + ', ', '')}`)
        } else {
            console.log(`${token.name} has no socials`)
        }
        
        if (!pairWithInfo?.info?.socials) {
            return;
        }

        try {
            // First delete existing social media entries for this token
            await db.query(
                'DELETE FROM token_social_media WHERE token_address = $1',
                [token.address]
            );

            // Insert new social media entries
            const values = pairWithInfo.info.socials.map(social => ({
                token_address: token.address,
                social_type: social.type,
                url: social.url
            }));

            if (values.length > 0) {
                await db.query(`
                    INSERT INTO token_social_media (token_address, social_type, url)
                    SELECT v.token_address, v.social_type, v.url
                    FROM jsonb_to_recordset($1::jsonb) AS v(
                        token_address VARCHAR(255),
                        social_type VARCHAR(50),
                        url VARCHAR(512)
                    )
                `, [JSON.stringify(values)]);
            }
        } catch (error) {
            console.error(`Failed to save social media for token ${token.address}:`, error);
            // Don't throw error to avoid breaking the main analysis flow
        }
    }

    // Helper function to sum up values, returning null if no valid values exist
    private sumValidValues<T>(arr: T[], getValue: (item: T) => number | null | undefined): number | null {
        const validItems = arr.filter(item => getValue(item) !== null && getValue(item) !== undefined);
        return validItems.length > 0 ? validItems.reduce((sum, item) => sum + getValue(item)!, 0) : null;
    }
} 