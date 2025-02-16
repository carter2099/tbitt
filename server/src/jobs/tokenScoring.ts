import cron from 'node-cron';
import { db } from '../db';
import { Token } from '../types/token';

let isScoringRunning = false;

interface DexScreenerPair {
    volume: { h24: number };
    txns: { h24: { buys: number; sells: number } };
    priceChange: { h24: number; m5: number };
}

async function calculateTokenScore(token: Token): Promise<number> {
    // hard rules
    if (token.marketCap > 30000000) {
        console.log('Token rejected: Market cap too high');
        return 0;
    }
    if (token.priceChangeM5 < -20) {
        console.log('Token rejected: Price dropped too much in 5m');
        return 0;
    }
    if (token.priceChange24h < -30) {
        console.log('Token rejected: Price dropped too much in 24h');
        return 0;
    }
    
    const volumeWeight = 0.20;
    const liquidityWeight = 0.35;
    const holderWeight = 0.15;
    const txCountWeight = 0.15;
    const priceActionWeight = 0.05;

    // Volume score - Compare 24h volume to liquidity
    const volumeToLiquidityRatio = token.liquidity > 0 ? token.volume24h / token.liquidity : 0;
    const volumeScore = Math.min(Math.max(volumeToLiquidityRatio / 3, 0), 1);

    // Liquidity score
    const liquidityScore = token.liquidity > 0 ? 
        Math.min(Math.log10(token.liquidity) / Math.log10(1000000), 1) : 0;

    // Holder score
    const holderScore = token.holderCount > 0 ? 
        Math.min(Math.log10(token.holderCount) / Math.log10(1000), 1) : 0;

    // Transaction count score
    const txCount = (token.txns24h.buys || 0) + (token.txns24h.sells || 0);
    const txScore = txCount > 0 ? 
        Math.min(Math.log10(txCount) / Math.log10(1000), 1) : 0;

    // Price action scoring
    const priceChange = token.priceChange24h || 0;
    let priceActionScore = 0;

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

        if (buys <= 7 || buyToSellRatio <= 5) {
            ratioPenalty = 0;
        }
        else if (sells === 0) {
            ratioPenalty = Math.min(0.9, (buys - 7) / 50);
        } else {
            ratioPenalty = Math.min(0.7, (buyToSellRatio - 5) / 20);
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
                COALESCE(t.txns_24h_buys, 0) as txns_24h_buys,
                COALESCE(t.txns_24h_sells, 0) as txns_24h_sells,
                COALESCE(t.market_cap, 0) as "marketCap",
                COALESCE(t.volume_24h, 0) as "volume24h",
                COALESCE(t.liquidity, 0) as liquidity,
                COALESCE(t.holder_count, 0) as "holderCount",
                COALESCE(t.price_change_24h, 0) as "priceChange24h",
                COALESCE(t.price_change_m5, 0) as "priceChangeM5"
            FROM token t
            WHERE t.mint_date > NOW() - INTERVAL '24 hours'
        `);

        console.log(`Found ${tokens.rows.length} tokens to score`);
        
        let scoredCount = 0;
        for (const token of tokens.rows) {
            try {
                const score = await calculateTokenScore({
                    ...token,
                    txns24h: {
                        buys: token.txns_24h_buys || 0,
                        sells: token.txns_24h_sells || 0
                    }
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
    // Run every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
        try {
            await scoreRecentTokens();
        } catch (error) {
            console.error('Token scoring job failed:', error);
        }
    });
} 