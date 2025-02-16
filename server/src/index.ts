import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { AppError } from './types/errors';
import dotenv from 'dotenv';


dotenv.config();

const app = express();
const port = 3001;

app.use(cors());
app.use(express.json());


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