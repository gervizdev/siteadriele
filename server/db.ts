import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from "../shared/schema.js";

const databaseUrl = process.env.DATABASE_URL ?? process.env.SUPABASE_DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL or SUPABASE_DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const isSupabaseConnection = databaseUrl.includes("supabase.co") || databaseUrl.includes("supabase.com");

const ssl = isSupabaseConnection
  ? { rejectUnauthorized: false }
  : undefined;

export const pool = new Pool({ connectionString: databaseUrl, ssl });
export const db = drizzle({ client: pool, schema });