import { Pool } from "pg";

export const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 5433,
  database: process.env.DB_NAME || "pos_cafe",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "password",
});

export async function initDB() {
  const client = await pool.connect();

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
        cashier_name TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // migration: เพิ่ม status column ถ้ายังไม่มี
    await client.query(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
    `);

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

    const { rows: cats } = await client.query(
      "SELECT id FROM categories LIMIT 1"
    );

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

    console.log("Database initialized successfully");

  } finally {
    client.release();
  }
}