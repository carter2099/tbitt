import { Pool } from 'pg';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

export interface ScanRecord {
    id: number;
    scan_date: Date;
    scan_type: 'daily' | 'test';
    status: 'completed' | 'failed';
}

export class Database {
    public readonly pool: Pool;

    constructor() {
        this.pool = pool;
    }

    async query(text: string, params?: any[]) {
        return this.pool.query(text, params);
    }
}

export const db = new Database(); 