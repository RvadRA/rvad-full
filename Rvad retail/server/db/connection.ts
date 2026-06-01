import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import dotenv from 'dotenv';
import * as schema from './schema';

dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://rvad:postgres@localhost:5432/rvad_retailos';

export const pool = new pg.Pool({
  connectionString,
});

export const db = drizzle(pool, { schema });
export type DbType = typeof db;
export * as schema from './schema';
