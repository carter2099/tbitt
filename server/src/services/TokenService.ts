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
            
            console.log(`${token.name}: ${avgPrice}, ${totalVolume}, ${highestVolumePair.marketCap}, ${totalLiquidity}, ${this.getHolderData(token)}, ${this.calculateTokenScore(token)}, ${highestVolumePair.priceChange.h24}, ${highestVolumePair.fdv}`);
            return {
                price: avgPrice,
                volume24h: totalVolume,
                marketCap: highestVolumePair.marketCap || 0,
                liquidity: totalLiquidity,
                holderCount: this.getHolderData(token),
                totalScore: this.calculateTokenScore(token),
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

    private calculateTokenScore(token: Token): number {
        return 0;
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