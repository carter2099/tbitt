import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { AppError } from './types/errors';
import dotenv from 'dotenv';
import { startTokenImportJob, importTokens } from './jobs/tokenImport';
import { db } from './db';


dotenv.config();

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());

// Start background jobs
startTokenImportJob();

// Add manual trigger endpoint
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
                    t.market_cap,
                    t.fdv,
                    t.liquidity,
                    t.holder_count,
                    t.total_score,
                    CASE 
                        WHEN t.mint_date > r.latest_mint - INTERVAL '15 minutes' THEN 'last_15m'
                        WHEN t.mint_date > r.latest_mint - INTERVAL '1 hour' AND t.mint_date <= r.latest_mint - INTERVAL '15 minutes' THEN 'last_1h'
                        WHEN t.mint_date > r.latest_mint - INTERVAL '6 hours' AND t.mint_date <= r.latest_mint - INTERVAL '1 hour' THEN 'last_6h'
                        WHEN t.mint_date > r.latest_mint - INTERVAL '12 hours' AND t.mint_date <= r.latest_mint - INTERVAL '6 hours' THEN 'last_12h'
                    END as time_group
                FROM token t
                CROSS JOIN TokenRanges r
                WHERE t.mint_date > (SELECT latest_mint - INTERVAL '12 hours' FROM TokenRanges)
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
            )
            SELECT 
                time_group,
                json_agg(
                    json_build_object(
                        'address', address,
                        'name', name,
                        'symbol', symbol,
                        'mintDate', mint_date AT TIME ZONE 'UTC',
                        'currentPrice', COALESCE(current_price, 0),
                        'priceChange24h', COALESCE(price_change_24h, 0),
                        'volume24h', COALESCE(volume_24h, 0),
                        'marketCap', COALESCE(market_cap, 0),
                        'fdv', COALESCE(fdv, 0),
                        'liquidity', COALESCE(liquidity, 0),
                        'holderCount', COALESCE(holder_count, 0),
                        'totalScore', COALESCE(total_score, 0),
                        'volume', COALESCE(volume_24h, 0)
                    )
                    ORDER BY mint_date DESC
                ) as tokens
            FROM LimitedGroups
            GROUP BY time_group
        `);

        const tokensByTimeGroup = result.rows.reduce((acc, row) => {
            acc[row.time_group] = row.tokens;
            return acc;
        }, {
            last_15m: [],
            last_1h: [],
            last_6h: [],
            last_12h: []
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