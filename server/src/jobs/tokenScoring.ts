import cron from 'node-cron';
import { db } from '../db';
import { ScoringToken, TokenService } from '../services/TokenService';

let isScoringRunning = false;

interface DexScreenerPair {
    volume: { h24: number };
    txns: { h24: { buys: number; sells: number } };
    priceChange: { h24: number; m5: number };
}

async function calculateTokenScore(token: ScoringToken): Promise<number | null> {
    const tokenService = new TokenService();
    return tokenService.calculateTokenScore(token);
}

export async function scoreRecentTokens() {
    if (isScoringRunning) {
        console.log('Scoring already in progress');
        return;
    }

    isScoringRunning = true;
    const startTime = new Date();
    console.log(`[${startTime.toISOString()}] Starting token scoring...`);

    try {
        const tokens = await db.query(`
            SELECT 
                t.*,
                t.txns_24h_buys,
                t.txns_24h_sells,
                t.market_cap,
                t.volume_24h,
                t.liquidity,
                t.holder_count,
                t.price_change_24h,
                t.price_change_m5
            FROM token t
            WHERE t.mint_date > NOW() - INTERVAL '24 hours'
        `);

        console.log(`Found ${tokens.rows.length} tokens to score`);
        
        let scoredCount = 0;
        for (const token of tokens.rows) {
            try {
                const score = await calculateTokenScore({
                    address: token.address,
                    name: token.name,
                    symbol: token.symbol,
                    volume24h: token.volume_24h,
                    marketCap: token.market_cap,
                    txns24h: {
                        buys: token.txns_24h_buys,
                        sells: token.txns_24h_sells
                    },
                    priceChange24h: token.price_change_24h,
                    priceChangeM5: token.price_change_m5,
                    liquidity: token.liquidity
                });

                await db.query(`
                    UPDATE token 
                    SET 
                        total_score = $1,
                        last_score = NOW()
                    WHERE address = $2
                `, [score, token.address]);
                
                scoredCount++;
            } catch (error) {
                console.error(`Failed to score token ${token.address}:`, error);
            }
        }

        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();
        
        console.log(`[${endTime.toISOString()}] Scoring completed in ${duration}ms`);
        console.log(`Successfully scored ${scoredCount} tokens`);

        return {
            success: true,
            message: `Scored ${scoredCount} tokens`
        };
    } catch (error) {
        console.error('Failed to score tokens:', error);
        throw error;
    } finally {
        isScoringRunning = false;
    }
}

export function startTokenScoringJob() {
    // Run every 20 seconds
    cron.schedule('*/20 * * * * *', async () => {
        try {
            await scoreRecentTokens();
        } catch (error) {
            console.error('Token scoring job failed:', error);
        }
    });
} 