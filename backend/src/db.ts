const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'pos_cafe',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function initDB() {
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
        cashier_id TEXT REFERENCES users(id),
        cashier_name TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
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

    // Seed default data if empty
    const { rows: cats } = await client.query('SELECT id FROM categories LIMIT 1');
    if (cats.length === 0) {
      await client.query(`
        INSERT INTO categories (id, name, icon, sort_order) VALUES
          ('coffee', 'กาแฟ', '☕', 1),
          ('tea', 'ชา', '🍵', 2),
          ('bakery', 'เบเกอรี่', '🥐', 3),
          ('other', 'เครื่องดื่มอื่นๆ', '🥤', 4)
        ON CONFLICT DO NOTHING;
      `);

      await client.query(`
        INSERT INTO menu_items (name, name_en, price, category_id, description) VALUES
          ('เอสเปรสโซ่', 'Espresso', 60, 'coffee', 'เข้มข้น กลมกล่อม'),
          ('อเมริกาโน่', 'Americano', 65, 'coffee', 'ร้อน / เย็น'),
          ('ลาเต้', 'Latte', 75, 'coffee', 'นมสดเข้มข้น'),
          ('คาปูชิโน่', 'Cappuccino', 75, 'coffee', 'ฟองนมนุ่ม'),
          ('มอคค่า', 'Mocha', 85, 'coffee', 'ช็อกโกแลตผสม'),
          ('คาราเมล มัคคิอาโต้', 'Caramel Macchiato', 90, 'coffee', 'คาราเมลหวาน'),
          ('กรีนที ลาเต้', 'Green Tea Latte', 75, 'tea', 'มัทฉะแท้'),
          ('ชาไทย', 'Thai Milk Tea', 65, 'tea', 'ชาไทยต้นตำรับ'),
          ('เอิร์ล เกรย์', 'Earl Grey', 60, 'tea', 'กลิ่นเบอร์กามอต'),
          ('ครัวซองต์', 'Croissant', 55, 'bakery', 'เนยสดนำเข้า'),
          ('มัฟฟิน', 'Muffin', 45, 'bakery', 'บลูเบอร์รี่ / ช็อก'),
          ('ช็อกโกแลต เค้ก', 'Chocolate Cake', 85, 'bakery', 'ช็อกโกแลตเข้มข้น'),
          ('สมูทตี้', 'Smoothie', 80, 'other', 'ผลไม้สด'),
          ('เลมอนเนด', 'Lemonade', 55, 'other', 'เปรี้ยวสดชื่น')
        ON CONFLICT DO NOTHING;
      `);
    }

    console.log('Database initialized successfully');
  } finally {
    client.release();
  }
}

module.exports = { pool, initDB };
