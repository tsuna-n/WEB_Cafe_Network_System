"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../service/db");
const crypto_1 = __importDefault(require("crypto"));
const router = (0, express_1.Router)();
// ─── POST / — สร้าง order ใหม่ ──────────────────
router.post("/", async (req, res) => {
    const client = await db_1.pool.connect();
    try {
        const { items, payment_method, position_id } = req.body;
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: "No items provided" });
        }
        if (!payment_method) {
            return res.status(400).json({ error: "No payment method provided" });
        }
        await client.query("BEGIN");
        // หาเลข order ถัดไปของวันนี้
        const { rows: countRows } = await client.query("SELECT COUNT(*)::int AS cnt FROM orders WHERE created_at::date = CURRENT_DATE");
        const orderNumber = (countRows[0]?.cnt ?? 0) + 1;
        // คำนวณยอดรวม
        const total = items.reduce((sum, it) => sum + it.price * it.qty, 0);
        const orderId = crypto_1.default.randomUUID();
        await client.query(`INSERT INTO orders (id, order_number, total, payment_method, status, position_id, cashier_name)
       VALUES ($1, $2, $3, $4, 'pending', $5, $6)`, [orderId, orderNumber, total, payment_method, position_id || null, "Admin"]);
        // เพิ่มรายการสินค้า
        for (const item of items) {
            await client.query(`INSERT INTO order_items (order_id, item_id, item_name, qty, price)
         VALUES ($1, $2, $3, $4, $5)`, [orderId, item.item_id, item.item_name, item.qty, item.price]);
        }
        await client.query("COMMIT");
        const { rows: orderRows } = await client.query("SELECT id AS order_id, order_number, total, payment_method, status, payment_status, position_id, cashier_name, receipt_url, created_at FROM orders WHERE id = $1", [orderId]);
        const { rows: orderItems } = await client.query("SELECT item_id, item_name, qty, price FROM order_items WHERE order_id = $1", [orderId]);
        res.json({ ...orderRows[0], items: orderItems });
    }
    catch (err) {
        await client.query("ROLLBACK");
        console.error("Error creating order:", err);
        res.status(500).json({ error: "Internal server error" });
    }
    finally {
        client.release();
    }
});
// ─── GET /?date=YYYY-MM-DD — ดึง orders ──────────
router.get("/", async (req, res) => {
    try {
        const { date, status, payment_status } = req.query;
        let query = `
            SELECT 
                o.id AS order_id, 
                o.order_number, 
                o.total, 
                o.payment_method, 
                o.status, 
                o.payment_status,
                o.position_id, 
                o.cashier_name, 
                o.receipt_url,
                o.created_at,
                COALESCE(
                    json_agg(
                        json_build_object(
                            'item_id', oi.item_id,
                            'item_name', oi.item_name,
                            'qty', oi.qty,
                            'price', oi.price
                        )
                    ) FILTER (WHERE oi.id IS NOT NULL), '[]'
                ) AS items
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
        `;
        const params = [];
        const conditions = [];
        if (date && typeof date === "string") {
            params.push(date);
            conditions.push(`o.created_at::date = $${params.length}`);
        }
        if (status && typeof status === "string") {
            params.push(status);
            conditions.push(`o.status = $${params.length}`);
        }
        if (payment_status && typeof payment_status === "string") {
            params.push(payment_status);
            conditions.push(`o.payment_status = $${params.length}`);
        }
        if (conditions.length > 0) {
            query += " WHERE " + conditions.join(" AND ");
        }
        query += " GROUP BY o.id ORDER BY o.created_at DESC LIMIT 50";
        const { rows: orders } = await db_1.pool.query(query, params);
        res.json(orders);
    }
    catch (err) {
        console.error("Error fetching orders:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});
// ─── GET /summary/daily?date=YYYY-MM-DD ──────────
router.get("/summary/daily", async (req, res) => {
    try {
        const date = req.query.date || new Date().toISOString().slice(0, 10);
        const { rows } = await db_1.pool.query(`SELECT
        COUNT(*)                                                   AS total_orders,
        COALESCE(SUM(total), 0)                                    AS total_revenue,
        COUNT(*)   FILTER (WHERE payment_method = 'cash')          AS cash_orders,
        COALESCE(SUM(total) FILTER (WHERE payment_method = 'cash'), 0)       AS cash_revenue,
        COUNT(*)   FILTER (WHERE payment_method = 'promptpay')     AS promptpay_orders,
        COALESCE(SUM(total) FILTER (WHERE payment_method = 'promptpay'), 0)  AS promptpay_revenue,
        COUNT(*)   FILTER (WHERE payment_method = 'card')          AS card_orders,
        COALESCE(SUM(total) FILTER (WHERE payment_method = 'card'), 0)       AS card_revenue
      FROM orders
      WHERE created_at::date = $1 AND payment_status = 'paid'
    `, [date]);
        res.json(rows[0]);
    }
    catch (err) {
        console.error("Error fetching daily summary:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});
// ─── PATCH /:id/status — อัพเดทสถานะ order ───────
router.patch("/:id/status", async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!status || !['pending', 'completed'].includes(status)) {
            return res.status(400).json({ error: "Invalid status. Use 'pending' or 'completed'." });
        }
        const { rowCount } = await db_1.pool.query("UPDATE orders SET status = $1 WHERE id = $2", [status, id]);
        if (rowCount === 0) {
            return res.status(404).json({ error: "Order not found" });
        }
        res.json({ success: true, order_id: id, status });
    }
    catch (err) {
        console.error("Error updating order status:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});
exports.default = router;
