import cron from 'node-cron';
import { db } from '../db';
import { TokenService } from '../services/TokenService';
import { sleep } from '../utils';

let isRefreshRunning = false;
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
        // Get top 500 tokens by score
        const tokens = await db.query(`
            SELECT 
                address,
                name,
                symbol
            FROM token 
            WHERE total_score > 0
            ORDER BY total_score DESC
            LIMIT 500
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
                    const score = await tokenService.calculateTokenScore({
                        address: token.address,
                        name: token.name,
                        symbol: token.symbol,
                        volume_24h: analysis.volume24h,
                        market_cap: analysis.marketCap,
                        buys_24h: analysis.buys24h,
                        sells_24h: analysis.sells24h,
                        price_change_24h: analysis.priceChange24h
                    });

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

export function startTokenRefreshJob() {
    // Run every minute
    cron.schedule('* * * * *', async () => {
        try {
            await refreshTopTokens();
        } catch (error) {
            console.error('Token refresh job failed:', error);
        }
    });
} 