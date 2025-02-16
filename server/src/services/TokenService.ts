import axios from 'axios';
import { DexScreenerPair, JupiterToken } from '../types/api';
import { TokenAnalysis } from '../types/token';
import { APIError } from '../types/errors';
import { db } from '../db';

// Add Token interface if not already defined
interface Token {
    address: string;
    name: string;
    symbol: string;
    volume_24h: number;
    market_cap: number;
    buys_24h: number;
    sells_24h: number;
    price_change_24h: number;
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

    async analyzeToken(token: Token): Promise<TokenAnalysis> {
        try {
            console.log(`Getting token data for ${token.name}...`);
            
            // Get DEX Screener data first
            const pairData = await this.getDexScreenerData(token);

            if (!pairData || pairData.length === 0) {
                console.log(`No pair data found for ${token.name}`);
                return {
                    price: 0,
                    volume24h: 0,
                    marketCap: 0,
                    liquidity: 0,
                    holderCount: 0,
                    totalScore: 0,
                    priceChange24h: 0,
                    fdv: 0,
                    buys24h: 0,
                    sells24h: 0
                };
            }

            // Save social media information
            await this.saveSocialMedia(token, pairData);

            // Find pair with highest volume for some metrics
            const highestVolumePair = pairData.reduce((max, pair) => 
                (pair.volume.h24 > max.volume.h24) ? pair : max, pairData[0]);

            // Calculate aggregated metrics
            const avgPrice = pairData.reduce((sum, pair) => 
                sum + parseFloat(pair.priceUsd), 0) / pairData.length;
            
            const totalVolume = pairData.reduce((sum, pair) => 
                sum + pair.volume.h24, 0);

            const totalLiquidity = pairData.reduce((sum, pair) => 
                sum + (pair.liquidity?.usd || 0), 0);

            // Sum up buys and sells across all pairs for 24h period
            const totalBuys24h = pairData.reduce((sum, pair) => 
                sum + (pair.txns.h24?.buys || 0), 0);
                
            const totalSells24h = pairData.reduce((sum, pair) => 
                sum + (pair.txns.h24?.sells || 0), 0);

            // Calculate score with the metrics we have
            const score = await this.calculateTokenScore({
                address: token.address,
                name: token.name,
                symbol: token.symbol,
                volume_24h: totalVolume,
                market_cap: highestVolumePair.marketCap || 0,
                buys_24h: totalBuys24h,
                sells_24h: totalSells24h,
                price_change_24h: highestVolumePair.priceChange.h24 || 0
            });
            
            console.log(`${token.name}: ${avgPrice}, ${totalVolume}, ${highestVolumePair.marketCap}, ${totalLiquidity}, ${this.getHolderData(token)}, ${score}, ${highestVolumePair.priceChange.h24}, ${highestVolumePair.fdv}`);
            
            return {
                price: avgPrice,
                volume24h: totalVolume,
                marketCap: highestVolumePair.marketCap || 0,
                liquidity: totalLiquidity,
                holderCount: this.getHolderData(token),
                totalScore: score,
                priceChange24h: highestVolumePair.priceChange.h24 || 0,
                fdv: highestVolumePair.fdv || 0,
                buys24h: totalBuys24h,
                sells24h: totalSells24h
            };
        } catch (error) {
            console.error(`Error analyzing token ${token.name} (${token.address}):`, error instanceof Error ? error.message : 'Unknown error');
            throw error;
        }
    }

    private async getDexScreenerData(token: Token, overflow: boolean = false): Promise<DexScreenerPair[] | null> {
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
                if (overflow) {
                    return null;
                }
                console.log('Rate limit hit, waiting 60 seconds...');
                await new Promise(resolve => setTimeout(resolve, 60000));
                // Retry the request after waiting
                return this.getDexScreenerData(token, true);
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

    private getHolderData(token: Token): number {
        return 0;
    }

    public async calculateTokenScore(token: Token): Promise<number> {
        try {
            // Get social media count for this token
            const socialResult = await db.query(
                'SELECT COUNT(*) as social_count FROM token_social_media WHERE token_address = $1',
                [token.address]
            );
            const socialCount = parseInt(socialResult.rows[0]?.social_count || '0');

            // Base metrics scoring
            const volumeScore = Math.min(token.volume_24h / 1000, 100); // Max 100 points for volume
            const marketCapScore = Math.min(token.market_cap / 10000, 50); // Max 50 points for market cap
            
            // Transaction activity scoring
            const totalTx = token.buys_24h + token.sells_24h;
            const txScore = Math.min(totalTx / 10, 30); // Max 30 points for transactions
            
            // Buy/Sell ratio scoring (positive ratio gets more points)
            const txRatio = token.buys_24h / (token.sells_24h || 1);
            const txRatioScore = Math.min(txRatio * 10, 20); // Max 20 points for buy/sell ratio
            
            // Price change scoring (moderate positive change is good)
            let priceChangeScore = 0;
            if (token.price_change_24h > 0 && token.price_change_24h < 100) {
                priceChangeScore = Math.min(token.price_change_24h, 50); // Max 50 points for price change
            }

            // Social media presence scoring
            const socialScore = Math.min(socialCount * 10, 30); // 10 points per social media, max 30 points

            // Calculate total score
            const totalScore = volumeScore + marketCapScore + txScore + txRatioScore + priceChangeScore + socialScore;

            // Normalize to 0-100 range
            return Math.min(Math.max(totalScore / 2.8, 0), 100);
        } catch (error) {
            console.error(`Error calculating score for token ${token.address}:`, error);
            return 0;
        }
    }

    private async saveSocialMedia(token: Token, pairData: DexScreenerPair[]): Promise<void> {
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
} 