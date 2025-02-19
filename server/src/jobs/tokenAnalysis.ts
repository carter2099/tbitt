import cron from 'node-cron';
import { TokenService } from '../services/TokenService';
import { db } from '../db';
import { sleep } from '../utils';

let isAnalysisRunning = false;

interface TokenAnalysis {
    price: number;
    priceChange24h: number;
    volume24h: number;
    marketCap: number;
    fdv: number;
    liquidity: number;
    holderCount: number;
    totalScore: number;
    buys24h: number;
    sells24h: number;
}

export async function analyzeRecentTokens() {
    if (isAnalysisRunning) {
        console.log('Token analysis job already running, skipping...');
        return { success: false, message: 'Analysis already running' };
    }

    isAnalysisRunning = true;
    const startTime = new Date();
    console.log(`[${startTime.toISOString()}] Starting token analysis job...`);

    try {
        // Get tokens from the last 15 minutes that haven't been analyzed
        const result = await db.query(`
            SELECT *
            FROM token
            WHERE mint_date > NOW() - INTERVAL '15 minutes'
            AND last_analysis IS NULL
        `);

        const tokens = result.rows;
        console.log(`Found ${tokens.length} tokens to analyze`);

        const tokenService = new TokenService();
        let analyzedCount = 0;

        for (const token of tokens) {
            try {
                const analysis = await tokenService.analyzeToken(token);

                if (analysis) {
                    await db.query(`
                        UPDATE token
                        SET 
                            current_price = $1,
                            price_change_24h = $2,
                            volume_24h = $3,
                            market_cap = $4,
                            fdv = $5,
                            liquidity = $6,
                            holder_count = $7,
                            total_score = $8,
                            buys_24h = $9,
                            sells_24h = $10,
                            last_analysis = NOW()
                        WHERE address = $11
                    `, [
                        analysis.price,
                        analysis.priceChange24h,
                        analysis.volume24h,
                        analysis.marketCap,
                        analysis.fdv,
                        analysis.liquidity,
                        analysis.holderCount,
                        analysis.totalScore,
                        analysis.buys24h,
                        analysis.sells24h,
                        token.address
                    ]);
                    analyzedCount++;
                }

                // Add a small delay to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 200));
            } catch (error) {
                console.error(`Failed to analyze token ${token.address}:`, error);
                // Continue with next token even if one fails
            }
        }

        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();
        
        console.log(`[${endTime.toISOString()}] Analysis completed in ${duration}ms`);
        console.log(`Successfully analyzed ${analyzedCount} tokens`);

        return { 
            success: true, 
            message: `Analyzed ${analyzedCount} tokens`,
            details: {
                tokensFound: tokens.length,
                tokensAnalyzed: analyzedCount,
                duration: `${duration}ms`
            }
        };
    } catch (error) {
        const endTime = new Date();
        console.error(`[${endTime.toISOString()}] Token analysis job failed:`, error);
        return { 
            success: false, 
            message: 'Job failed: ' + (error instanceof Error ? error.message : 'Unknown error'),
            details: {
                error: error instanceof Error ? error.stack : 'Unknown error',
                duration: `${endTime.getTime() - startTime.getTime()}ms`
            }
        };
    } finally {
        isAnalysisRunning = false;
    }
}

export function startTokenAnalysisJob() {
    // Run every 20s, offset by 10s
    cron.schedule('*/20 * * * * *', async () => {
        await sleep(10000);
        console.log('Running scheduled token analysis...');
        const result = await analyzeRecentTokens();
        console.log('Analysis result:', result);
    });
} 