import cron from 'node-cron';
import { db } from '../db';
import { TokenService, ScoringToken } from '../services/TokenService';
import { sleep } from '../utils';
import { Token } from '../types/token';

let isRefreshRunning = false;
let isMediumTermRefreshRunning = false;
const tokenService = new TokenService();

export async function refreshTopTokens() {
    if (isRefreshRunning) {
        console.log('Token refresh already in progress');
        return;
    }

    isRefreshRunning = true;
    const startTime = new Date();
    console.log(`[${startTime.toISOString()}] Starting top tokens refresh...`);

    try {
        // Get top 300 tokens by score
        const tokens = await db.query(`
            SELECT 
                address,
                name,
                symbol
            FROM token 
            WHERE total_score > 0
            ORDER BY total_score DESC
            LIMIT 300
        `);

        let refreshedCount = 0;
        let errorCount = 0;

        for (const token of tokens.rows) {
            try {
                // Get fresh DEX Screener data
                const analysis = await tokenService.analyzeToken(token);

                if (analysis) {
                    // Update token data with all price changes
                    await db.query(`
                        UPDATE token
                        SET 
                            current_price = $1,
                            price_change_24h = $2,
                            price_change_h6 = $3,
                            price_change_h1 = $4,
                            price_change_m5 = $5,
                            volume_24h = $6,
                            volume_h6 = $7,
                            volume_h1 = $8,
                            volume_m5 = $9,
                            market_cap = $10,
                            fdv = $11,
                            liquidity = $12,
                            holder_count = $13,
                            txns_24h_buys = $14,
                            txns_24h_sells = $15,
                            last_analysis = NOW()
                        WHERE address = $16
                    `, [
                        analysis.price,
                        analysis.priceChange24h,
                        analysis.priceChangeH6,
                        analysis.priceChangeH1,
                        analysis.priceChangeM5,
                        analysis.volume24h,
                        analysis.volumeH6,
                        analysis.volumeH1,
                        analysis.volumeM5,
                        analysis.marketCap,
                        analysis.fdv,
                        analysis.liquidity,
                        analysis.holderCount,
                        analysis.buys24h,
                        analysis.sells24h,
                        token.address
                    ]);

                    // Recalculate score
                    const tokenForScoring: ScoringToken = {
                        address: token.address,
                        name: token.name,
                        symbol: token.symbol,
                        volume24h: analysis.volume24h,
                        marketCap: analysis.marketCap,
                        txns24h: {
                            buys: analysis.buys24h,
                            sells: analysis.sells24h
                        },
                        priceChange24h: analysis.priceChange24h,
                        priceChangeM5: analysis.priceChangeM5,
                        liquidity: analysis.liquidity
                    };

                    const score = await tokenService.calculateTokenScore(tokenForScoring);

                    await db.query(`
                        UPDATE token 
                        SET 
                            total_score = $1,
                            last_score = NOW()
                        WHERE address = $2
                    `, [score, token.address]);

                    refreshedCount++;
                }

                // Add a small delay to avoid rate limiting
                await sleep(200);
            } catch (error) {
                console.error(`Failed to refresh token ${token.address}:`, error);
                errorCount++;
            }
        }

        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();
        
        console.log(`[${endTime.toISOString()}] Refresh completed in ${duration}ms`);
        console.log(`Successfully refreshed ${refreshedCount} tokens, ${errorCount} errors`);

        return {
            success: true,
            message: `Refreshed ${refreshedCount} tokens, ${errorCount} errors`
        };
    } catch (error) {
        console.error('Failed to refresh top tokens:', error);
        throw error;
    } finally {
        isRefreshRunning = false;
    }
}

export async function refreshMediumTermTokens() {
    if (isMediumTermRefreshRunning) {
        console.log('Medium-term token refresh already in progress');
        return;
    }

    isMediumTermRefreshRunning = true;
    const startTime = new Date();
    console.log(`[${startTime.toISOString()}] Starting medium-term tokens refresh...`);

    try {
        const tokens = await db.query(`
            SELECT 
                address,
                name,
                symbol
            FROM token 
            WHERE mint_date BETWEEN NOW() - INTERVAL '15 minutes' AND NOW() - INTERVAL '5 minutes'
            AND total_score > 0
            ORDER BY total_score DESC
        `);

        let refreshedCount = 0;
        let errorCount = 0;

        for (const token of tokens.rows) {
            try {
                const analysis = await tokenService.analyzeToken(token);

                if (analysis) {
                    // Update token data with all price changes
                    await db.query(`
                        UPDATE token
                        SET 
                            current_price = $1,
                            price_change_24h = $2,
                            price_change_h6 = $3,
                            price_change_h1 = $4,
                            price_change_m5 = $5,
                            volume_24h = $6,
                            volume_h6 = $7,
                            volume_h1 = $8,
                            volume_m5 = $9,
                            market_cap = $10,
                            fdv = $11,
                            liquidity = $12,
                            holder_count = $13,
                            txns_24h_buys = $14,
                            txns_24h_sells = $15,
                            last_analysis = NOW()
                        WHERE address = $16
                    `, [
                        analysis.price,
                        analysis.priceChange24h,
                        analysis.priceChangeH6,
                        analysis.priceChangeH1,
                        analysis.priceChangeM5,
                        analysis.volume24h,
                        analysis.volumeH6,
                        analysis.volumeH1,
                        analysis.volumeM5,
                        analysis.marketCap,
                        analysis.fdv,
                        analysis.liquidity,
                        analysis.holderCount,
                        analysis.buys24h,
                        analysis.sells24h,
                        token.address
                    ]);

                    // Recalculate score
                    const tokenForScoring: ScoringToken = {
                        address: token.address,
                        name: token.name,
                        symbol: token.symbol,
                        volume24h: analysis.volume24h,
                        marketCap: analysis.marketCap,
                        txns24h: {
                            buys: analysis.buys24h,
                            sells: analysis.sells24h
                        },
                        priceChange24h: analysis.priceChange24h,
                        priceChangeM5: analysis.priceChangeM5,
                        liquidity: analysis.liquidity
                    };

                    const score = await tokenService.calculateTokenScore(tokenForScoring);

                    await db.query(`
                        UPDATE token 
                        SET 
                            total_score = $1,
                            last_score = NOW()
                        WHERE address = $2
                    `, [score, token.address]);

                    refreshedCount++;
                }

                // Add a small delay to avoid rate limiting
                await sleep(200);
            } catch (error) {
                console.error(`Failed to refresh token ${token.address}:`, error);
                errorCount++;
            }
        }

        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();
        
        console.log(`[${endTime.toISOString()}] Medium-term refresh completed in ${duration}ms`);
        console.log(`Successfully refreshed ${refreshedCount} tokens, ${errorCount} errors`);

        return {
            success: true,
            message: `Refreshed ${refreshedCount} tokens, ${errorCount} errors`
        };
    } catch (error) {
        console.error('Failed to refresh medium-term tokens:', error);
        throw error;
    } finally {
        isMediumTermRefreshRunning = false;
    }
}

export function startTokenRefreshJob() {
    // Run recent tokens refresh every minute
    cron.schedule('* * * * *', async () => {
        try {
            await refreshTopTokens();
        } catch (error) {
            console.error('Recent token refresh job failed:', error);
        }
    });

    // Run medium-term tokens refresh every minute, offset by 30 seconds
    cron.schedule('* * * * *', async () => {
        try {
            // Add a 30-second delay before running this job
            await sleep(30000);
            await refreshMediumTermTokens();
        } catch (error) {
            console.error('Medium-term token refresh job failed:', error);
        }
    });
} 