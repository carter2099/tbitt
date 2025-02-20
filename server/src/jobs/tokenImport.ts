import cron from 'node-cron';
import { TokenService } from '../services/TokenService';
import { db } from '../db';

interface TokenRow {
    address: string;
}

let isJobRunning = false;

export async function importTokens() {
    if (isJobRunning) {
        console.log('Token import job already running, skipping...');
        return { success: false, message: 'Job already running' };
    }

    isJobRunning = true;
    const startTime = new Date();
    console.log(`[${startTime.toISOString()}] Starting token import job...`);

    try {
        const tokenService = new TokenService();
        console.log('Importing new tokens from Jupiter...');
        const newTokens = await tokenService.getNewTokens();
        
        const cutoffTime = new Date(Date.now() - 35 * 60 * 1000); // 35 minutes ago
        
        const values = newTokens.map(token => {
            const mintDate = new Date(parseInt(token.created_at) * 1000);
            return {
                address: token.mint,
                name: token.name,
                symbol: token.symbol,
                import_date: new Date(),
                mint_date: mintDate.toISOString()
            };
        }).filter(token => new Date(token.mint_date) > cutoffTime);

        if (values.length > 0) {
            console.log('Attempting to insert new tokens...');
            console.log('Sample token mint_date:', values[0].mint_date);

            const result = await db.query(`
                INSERT INTO token (address, name, symbol, import_date, mint_date)
                SELECT v.address, v.name, v.symbol, v.import_date, v.mint_date
                FROM jsonb_to_recordset($1::jsonb) AS v(
                    address VARCHAR(255),
                    name VARCHAR(255),
                    symbol VARCHAR(255),
                    import_date TIMESTAMP,
                    mint_date TIMESTAMP
                )
                WHERE NOT EXISTS (
                    SELECT 1 FROM token WHERE address = v.address
                )
                RETURNING address
            `, [JSON.stringify(values)]);

            const endTime = new Date();
            const duration = endTime.getTime() - startTime.getTime();
            
            console.log(`[${endTime.toISOString()}] Import completed in ${duration}ms`);
            console.log(`Successfully imported ${result.rowCount} new tokens`);

            return { 
                success: true, 
                message: `Imported ${result.rowCount} new tokens`,
                details: {
                    tokensFound: newTokens.length,
                    tokensImported: result.rowCount,
                    duration: `${duration}ms`,
                    importedAddresses: result.rows.map((r: TokenRow) => r.address)
                }
            };
        }
        
        const endTime = new Date();
        console.log(`[${endTime.toISOString()}] No new tokens to import`);
        return { 
            success: true, 
            message: 'No new tokens to import',
            details: {
                tokensFound: newTokens.length,
                duration: `${endTime.getTime() - startTime.getTime()}ms`
            }
        };
    } catch (error) {
        const endTime = new Date();
        console.error(`[${endTime.toISOString()}] Token import job failed:`, error);
        return { 
            success: false, 
            message: 'Job failed: ' + (error instanceof Error ? error.message : 'Unknown error'),
            details: {
                error: error instanceof Error ? error.stack : 'Unknown error',
                duration: `${endTime.getTime() - startTime.getTime()}ms`
            }
        };
    } finally {
        isJobRunning = false;
    }
}

export function startTokenImportJob() {
    // Run every 20s
    cron.schedule('*/20 * * * * *', async () => {
        console.log('Running scheduled token import...');
        const result = await importTokens();
    });
} 