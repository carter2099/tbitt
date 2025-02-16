import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { AppError } from './types/errors';
import dotenv from 'dotenv';
import { startTokenImportJob, importTokens } from './jobs/tokenImport';


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