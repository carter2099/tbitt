import cron from 'node-cron';
import { db } from '../db';

let isCleanupRunning = false;

export async function cleanupOldTokens() {
    if (isCleanupRunning) {
        console.log('Token cleanup already in progress');
        return { success: false, message: 'Cleanup already running' };
    }

    isCleanupRunning = true;
    const startTime = new Date();
    console.log(`[${startTime.toISOString()}] Starting token cleanup...`);

    try {
        // Delete tokens older than 6 hours
        const result = await db.query(`
            DELETE FROM token 
            WHERE mint_date < NOW() - INTERVAL '6 hours'
            RETURNING address
        `);

        const endTime = new Date();
        const duration = endTime.getTime() - startTime.getTime();
        
        console.log(`[${endTime.toISOString()}] Cleanup completed in ${duration}ms`);
        console.log(`Deleted ${result.rowCount} old tokens`);

        return { 
            success: true, 
            message: `Deleted ${result.rowCount} old tokens`,
            details: {
                tokensDeleted: result.rowCount,
                duration: `${duration}ms`
            }
        };
    } catch (error) {
        const endTime = new Date();
        console.error(`[${endTime.toISOString()}] Token cleanup job failed:`, error);
        return { 
            success: false, 
            message: 'Job failed: ' + (error instanceof Error ? error.message : 'Unknown error'),
            details: {
                error: error instanceof Error ? error.stack : 'Unknown error',
                duration: `${endTime.getTime() - startTime.getTime()}ms`
            }
        };
    } finally {
        isCleanupRunning = false;
    }
}

export function startTokenCleanupJob() {
    // Run every hour
    cron.schedule('0 * * * *', async () => {
        console.log('Running scheduled token cleanup...');
        const result = await cleanupOldTokens();
        console.log('Cleanup result:', result);
    });
} 