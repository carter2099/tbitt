import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { AppError } from './types/errors';
import dotenv from 'dotenv';
import { startTokenImportJob, importTokens } from './jobs/tokenImport';
import { startTokenAnalysisJob, analyzeRecentTokens } from './jobs/tokenAnalysis';
import { startTokenScoringJob, scoreRecentTokens } from './jobs/tokenScoring';
import { startTokenRefreshJob } from './jobs/tokenRefresh';
import { db } from './db';


dotenv.config();

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// Start background jobs
startTokenImportJob();
startTokenAnalysisJob();
startTokenScoringJob();
startTokenRefreshJob();

// Add manual trigger endpoints
app.post('/api/import-tokens', async (_req: Request, res: Response) => {
    try {
        const result = await importTokens();
        res.json(result);
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Failed to trigger import' 
        });
    }
});

app.post('/api/analyze-tokens', async (_req: Request, res: Response) => {
    try {
        const result = await analyzeRecentTokens();
        res.json(result);
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Failed to trigger analysis' 
        });
    }
});

app.post('/api/score-tokens', async (_req: Request, res: Response) => {
    try {
        const result = await scoreRecentTokens();
        res.json(result);
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'Failed to trigger scoring' 
        });
    }
});

// Add token fetch endpoint
app.get('/api/tokens', async (_req: Request, res: Response) => {
    try {
        // First, let's check our date ranges
        const dateCheck = await db.query(`
            SELECT 
                MIN(mint_date) as earliest_mint,
                MAX(mint_date) as latest_mint,
                NOW() as current_time
            FROM token
        `);
        console.log('Date ranges:', dateCheck.rows[0]);

        const result = await db.query(`
            WITH TokenRanges AS (
                SELECT 
                    MAX(mint_date) as latest_mint
                FROM token
            ),
            TimeGroups AS (
                SELECT 
                    t.address,
                    t.name,
                    t.symbol,
                    t.mint_date,
                    t.current_price,
                    t.price_change_24h,
                    t.volume_24h,
                    t.volume_h1,
                    t.volume_h6,
                    t.volume_m5,
                    t.market_cap,
                    t.fdv,
                    t.liquidity,
                    t.holder_count,
                    t.total_score,
                    t.txns_24h_buys,
                    t.txns_24h_sells,
                    CASE 
                        WHEN t.mint_date > r.latest_mint - INTERVAL '5 minutes' THEN 'last_5m'
                        WHEN t.mint_date > r.latest_mint - INTERVAL '10 minutes' AND t.mint_date <= r.latest_mint - INTERVAL '5 minutes' THEN 'last_10m'
                        WHEN t.mint_date > r.latest_mint - INTERVAL '15 minutes' AND t.mint_date <= r.latest_mint - INTERVAL '10 minutes' THEN 'last_15m'
                        WHEN t.mint_date > r.latest_mint - INTERVAL '30 minutes' AND t.mint_date <= r.latest_mint - INTERVAL '15 minutes' THEN 'last_30m'
                    END as time_group
                FROM token t
                CROSS JOIN TokenRanges r
                WHERE t.mint_date > (SELECT latest_mint - INTERVAL '1 hours' FROM TokenRanges)
                    AND t.total_score > 1
                    AND t.total_score IS NOT NULL
            ),
            LimitedGroups AS (
                SELECT *
                FROM (
                    SELECT *,
                           ROW_NUMBER() OVER (PARTITION BY time_group ORDER BY mint_date DESC) as rn
                    FROM TimeGroups
                    WHERE time_group IS NOT NULL
                ) ranked
                WHERE rn <= 20
            ),
            TokensWithSocials AS (
                SELECT 
                    lg.*,
                    json_agg(
                        json_build_object(
                            'type', tsm.social_type,
                            'url', tsm.url
                        )
                    ) FILTER (WHERE tsm.social_type IS NOT NULL) as socials
                FROM LimitedGroups lg
                LEFT JOIN token_social_media tsm ON lg.address = tsm.token_address
                GROUP BY 
                    lg.address, lg.name, lg.symbol, lg.mint_date, lg.current_price, 
                    lg.price_change_24h, lg.volume_24h, lg.volume_h1, lg.volume_h6, lg.volume_m5,
                    lg.market_cap, lg.fdv, lg.liquidity, lg.holder_count, lg.total_score, 
                    lg.time_group, lg.rn, lg.txns_24h_buys, lg.txns_24h_sells
            )
            SELECT 
                time_group,
                json_agg(
                    json_build_object(
                        'address', address,
                        'name', name,
                        'symbol', symbol,
                        'mintDate', mint_date AT TIME ZONE 'UTC',
                        'currentPrice', current_price,
                        'priceChange24h', price_change_24h,
                        'volume24h', volume_24h,
                        'volumeH1', volume_h1,
                        'volumeM5', volume_m5,
                        'marketCap', market_cap,
                        'fdv', fdv,
                        'liquidity', liquidity,
                        'holderCount', holder_count,
                        'totalScore', total_score,
                        'volume', volume_24h,
                        'socials', COALESCE(socials, '[]'::json),
                        'txns24h', json_build_object(
                            'buys', txns_24h_buys,
                            'sells', txns_24h_sells
                        )
                    )
                    ORDER BY total_score DESC nulls last, volume_24h DESC
                ) as tokens
            FROM TokensWithSocials
            GROUP BY time_group
        `);

        const tokensByTimeGroup = result.rows.reduce((acc, row) => {
            acc[row.time_group] = row.tokens;
            return acc;
        }, {
            last_5m: [],
            last_10m: [],
            last_15m: [],
            last_30m: []
        });

        res.json(tokensByTimeGroup);
    } catch (error) {
        console.error('Failed to fetch tokens:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch tokens' 
        });
    }
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Error handling middleware
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            message: err.message
        });
    } else {
        res.status(500).json({
            message: 'An unexpected error occurred'
        });
    }
});

process.on('SIGTERM', () => {
    console.log('SIGTERM received. Cleaning up...');
    process.exit(0);
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});