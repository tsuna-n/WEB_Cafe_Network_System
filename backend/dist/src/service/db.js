"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
exports.initDB = initDB;
const pg_1 = require("pg");
exports.pool = new pg_1.Pool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT) || 5433,
    database: process.env.DB_NAME || "pos_cafe",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "password",
});
async function initDB() {
    const client = await exports.pool.connect();
    try {
        await client.query(`
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        icon TEXT,
        sort_order INTEGER DEFAULT 0
      );
    `);
        await client.query(`
      CREATE TABLE IF NOT EXISTS menu_items (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        name_en TEXT,
        price DOUBLE PRECISION NOT NULL,
        category_id TEXT REFERENCES categories(id),
        image TEXT,
        description TEXT,
        is_available BOOLEAN DEFAULT TRUE
      );
    `);
        await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id TEXT PRIMARY KEY,
        order_number INTEGER NOT NULL,
        total DOUBLE PRECISION NOT NULL,
        payment_method TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        payment_status TEXT DEFAULT 'pending',
        transaction_id TEXT,
        position_id TEXT,
        cashier_name TEXT,
        receipt_url TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);
        // migration: เพิ่ม column ถ้ายังไม่มี
        await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';`);
        await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS position_id TEXT;`);
        await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS receipt_url TEXT;`);
        await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending';`);
        await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS transaction_id TEXT;`);
        await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id TEXT REFERENCES orders(id),
        item_id INTEGER,
        item_name TEXT NOT NULL,
        qty INTEGER NOT NULL,
        price DOUBLE PRECISION NOT NULL
      );
    `);
        await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'cashier'
      );
    `);
        const { rows: cats } = await client.query("SELECT id FROM categories LIMIT 1");
        if (cats.length === 0) {
            await client.query(`
        INSERT INTO categories (id, name, icon, sort_order) VALUES
        ('coffee','กาแฟ','☕',1),
        ('tea','ชา','🍵',2),
        ('bakery','เบเกอรี่','🥐',3),
        ('other','เครื่องดื่มอื่นๆ','🥤',4)
        ON CONFLICT DO NOTHING;
      `);
        }
        const { rows: users } = await client.query("SELECT id FROM users LIMIT 1");
        if (users.length === 0) {
            await client.query(`
        INSERT INTO users (id, name, password, role) VALUES
        ('admin', 'ผู้ดูแลระบบ', '1234', 'admin'),
        ('cashier', 'แคชเชียร์', '0000', 'cashier')
        ON CONFLICT DO NOTHING;
      `);
        }
        console.log("Database initialized successfully");
    }
    finally {
        client.release();
    }
}
