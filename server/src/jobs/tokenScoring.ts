import cron from 'node-cron';
import { db } from '../db';

let isScoringRunning = false;

interface Token {
    address: string;
    volume_24h: number;
    market_cap: number;
    buys_24h: number;
    sells_24h: number;
    price_change_24h: number;
}

function normalizeLog(value: number, minValue: number = 1): number {
    if (value <= 0) return 0;
    const logValue = Math.log(Math.max(value, minValue));
    return logValue / Math.log(1e9); // Normalize against a billion (reasonable max)
}

function calculateTokenScore(token: Token): number {
    // Volume Score (35%)
    const volumeScore = normalizeLog(token.volume_24h);

    // Liquidity Score (25%)
    const liquidityScore = normalizeLog(token.market_cap);

    // Buy Ratio Score (20%)
    const totalTrades = token.buys_24h + token.sells_24h;
    const buyRatio = totalTrades > 0 ? token.buys_24h / totalTrades : 0.5;

    // Price Action Score (20%)
    const priceMultiplier = token.price_change_24h > 0 ? 1 : 0.5;
    const volatilityFactor = 1 - Math.min(Math.abs(token.price_change_24h) / 100, 1);
    const priceActionScore = priceMultiplier * volatilityFactor;

    // Calculate weighted score
    const score = (
        (0.35 * volumeScore) +
        (0.25 * liquidityScore) +
        (0.20 * buyRatio) +
        (0.20 * priceActionScore)
    );

    // Normalize to 0-100 range
    return Math.min(Math.max(score * 100, 0), 100);
}

export async function scoreRecentTokens() {
    if (isScoringRunning) {
        console.log('Token scoring job already running, skipping...');
        return { success: false, message: 'Scoring already running' };
    }

    isScoringRunning = true;
    const startTime = new Date();
    console.log(`[${startTime.toISOString()}] Starting token scoring job...`);

    try {
        // Get tokens from the last 15 minutes that haven't been scored
        const result = await db.query(`
            SELECT 
                address,
                volume_24h,
                market_cap,
                COALESCE(buys_24h, 0) as buys_24h,
                COALESCE(sells_24h, 0) as sells_24h,
                price_change_24h
            FROM token
            WHERE 
                mint_date > NOW() - INTERVAL '15 minutes'
                AND last_analysis IS NOT NULL
                AND last_score IS NULL
        `);

        const tokens = result.rows;
        console.log(`Found ${tokens.length} tokens to score`);

        let scoredCount = 0;

        for (const token of tokens) {
            try {
                const score = calculateTokenScore(token);

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
                // Continue with next token even if one fails
            }
        }

        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();
        
        console.log(`[${endTime.toISOString()}] Scoring completed in ${duration}ms`);
        console.log(`Successfully scored ${scoredCount} tokens`);

        return { 
            success: true, 
            message: `Scored ${scoredCount} tokens`,
            details: {
                tokensFound: tokens.length,
                tokensScored: scoredCount,
                duration: `${duration}ms`
            }
        };
    } catch (error) {
        const endTime = new Date();
        console.error(`[${endTime.toISOString()}] Token scoring job failed:`, error);
        return { 
            success: false, 
            message: 'Job failed: ' + (error instanceof Error ? error.message : 'Unknown error'),
            details: {
                error: error instanceof Error ? error.stack : 'Unknown error',
                duration: `${endTime.getTime() - startTime.getTime()}ms`
            }
        };
    } finally {
        isScoringRunning = false;
    }
}

export function startTokenScoringJob() {
    // Run every minute
    cron.schedule('*/1 * * * *', async () => {
        console.log('Running scheduled token scoring...');
        const result = await scoreRecentTokens();
        console.log('Scoring result:', result);
    });
} 