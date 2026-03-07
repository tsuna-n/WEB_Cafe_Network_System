import { Router, Request, Response } from "express";
import { pool } from "../service/db";
import crypto from "crypto";

const router = Router();

// ─── POST / — สร้าง order ใหม่ ──────────────────
router.post("/", async (req: Request, res: Response) => {
    const client = await pool.connect();

    try {
        const { items, payment_method } = req.body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: "No items provided" });
        }

        if (!payment_method) {
            return res.status(400).json({ error: "No payment method provided" });
        }

        await client.query("BEGIN");

        // หาเลข order ถัดไปของวันนี้
        const { rows: countRows } = await client.query(
            "SELECT COUNT(*)::int AS cnt FROM orders WHERE created_at::date = CURRENT_DATE"
        );
        const orderNumber = (countRows[0]?.cnt ?? 0) + 1;

        // คำนวณยอดรวม
        const total = items.reduce(
            (sum: number, it: { qty: number; price: number }) => sum + it.price * it.qty,
            0
        );

        const orderId = crypto.randomUUID();

        await client.query(
            `INSERT INTO orders (id, order_number, total, payment_method, status, cashier_name)
       VALUES ($1, $2, $3, $4, 'pending', $5)`,
            [orderId, orderNumber, total, payment_method, "Admin"]
        );

        // เพิ่มรายการสินค้า
        for (const item of items) {
            await client.query(
                `INSERT INTO order_items (order_id, item_id, item_name, qty, price)
         VALUES ($1, $2, $3, $4, $5)`,
                [orderId, item.item_id, item.item_name, item.qty, item.price]
            );
        }

        await client.query("COMMIT");

        const { rows: orderRows } = await client.query(
            "SELECT id AS order_id, order_number, total, payment_method, status, cashier_name, created_at FROM orders WHERE id = $1",
            [orderId]
        );

        const { rows: orderItems } = await client.query(
            "SELECT item_id, item_name, qty, price FROM order_items WHERE order_id = $1",
            [orderId]
        );

        res.json({ ...orderRows[0], items: orderItems });
    } catch (err) {
        await client.query("ROLLBACK");
        console.error("Error creating order:", err);
        res.status(500).json({ error: "Internal server error" });
    } finally {
        client.release();
    }
});

// ─── GET /?date=YYYY-MM-DD — ดึง orders ──────────
router.get("/", async (req: Request, res: Response) => {
    try {
        const { date, status } = req.query;

        let query = `
      SELECT id AS order_id, order_number, total, payment_method, status, cashier_name, created_at
      FROM orders
    `;
        const params: string[] = [];
        const conditions: string[] = [];

        if (date && typeof date === "string") {
            params.push(date);
            conditions.push(`created_at::date = $${params.length}`);
        }
        if (status && typeof status === "string") {
            params.push(status);
            conditions.push(`status = $${params.length}`);
        }

        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }

        query += " ORDER BY created_at DESC LIMIT 50";

        const { rows: orders } = await pool.query(query, params);

        // ดึง items ของแต่ละ order
        const result = await Promise.all(
            orders.map(async (order: { order_id: string }) => {
                const { rows: items } = await pool.query(
                    "SELECT item_id, item_name, qty, price FROM order_items WHERE order_id = $1",
                    [order.order_id]
                );
                return { ...order, items };
            })
        );

        res.json(result);
    } catch (err) {
        console.error("Error fetching orders:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ─── GET /summary/daily?date=YYYY-MM-DD ──────────
router.get("/summary/daily", async (req: Request, res: Response) => {
    try {
        const date = (req.query.date as string) || new Date().toISOString().slice(0, 10);

        const { rows } = await pool.query(
            `SELECT
        COUNT(*)                                                   AS total_orders,
        COALESCE(SUM(total), 0)                                    AS total_revenue,
        COUNT(*)   FILTER (WHERE payment_method = 'cash')          AS cash_orders,
        COALESCE(SUM(total) FILTER (WHERE payment_method = 'cash'), 0)       AS cash_revenue,
        COUNT(*)   FILTER (WHERE payment_method = 'promptpay')     AS promptpay_orders,
        COALESCE(SUM(total) FILTER (WHERE payment_method = 'promptpay'), 0)  AS promptpay_revenue,
        COUNT(*)   FILTER (WHERE payment_method = 'card')          AS card_orders,
        COALESCE(SUM(total) FILTER (WHERE payment_method = 'card'), 0)       AS card_revenue
      FROM orders
      WHERE created_at::date = $1`,
            [date]
        );

        res.json(rows[0]);
    } catch (err) {
        console.error("Error fetching daily summary:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ─── PATCH /:id/status — อัพเดทสถานะ order ───────
router.patch("/:id/status", async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status || !['pending', 'completed'].includes(status)) {
            return res.status(400).json({ error: "Invalid status. Use 'pending' or 'completed'." });
        }

        const { rowCount } = await pool.query(
            "UPDATE orders SET status = $1 WHERE id = $2",
            [status, id]
        );

        if (rowCount === 0) {
            return res.status(404).json({ error: "Order not found" });
        }

        res.json({ success: true, order_id: id, status });
    } catch (err) {
        console.error("Error updating order status:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
