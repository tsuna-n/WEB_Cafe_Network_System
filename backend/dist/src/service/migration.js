"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.migratePayments = migratePayments;
const db_1 = require("./db");
async function migratePayments() {
    const client = await db_1.pool.connect();
    try {
        await client.query(`
      ALTER TABLE orders 
      ADD COLUMN IF NOT EXISTS transaction_id TEXT,
      ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS receipt_url TEXT;
    `);
        console.log("Migration: Added payment columns to orders table");
    }
    catch (err) {
        console.error("Migration failed:", err);
    }
    finally {
        client.release();
    }
}
