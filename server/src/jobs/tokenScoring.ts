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

async function calculateTokenScore(token: Token): Promise<number> {
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
                address,
                volume_24h,
                market_cap,
                buys_24h,
                sells_24h,
                price_change_24h
            FROM token 
            WHERE mint_date > NOW() - INTERVAL '24 hours'
        `);

        let scoredCount = 0;
        for (const token of tokens.rows) {
            try {
                const score = await calculateTokenScore(token);
                
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