"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../service/db");
const router = (0, express_1.Router)();
// ─── GET /categories ─────────────────────────────
router.get("/categories", async (_req, res) => {
    try {
        const { rows } = await db_1.pool.query("SELECT id, name, icon, sort_order FROM categories ORDER BY sort_order");
        res.json(rows);
    }
    catch (err) {
        console.error("Error fetching categories:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});
// ─── GET /items?category=xxx ─────────────────────
router.get("/items", async (req, res) => {
    try {
        const { category } = req.query;
        let query = "SELECT id, name, name_en, price, category_id, description, image, is_available FROM menu_items";
        const params = [];
        if (category && typeof category === "string") {
            query += " WHERE category_id = $1";
            params.push(category);
        }
        query += " ORDER BY id";
        const { rows } = await db_1.pool.query(query, params);
        res.json(rows);
    }
    catch (err) {
        console.error("Error fetching menu items:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});
exports.default = router;
