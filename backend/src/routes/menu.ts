import { Router, Request, Response } from "express";
import { pool } from "../service/db";

const router = Router();

// ─── GET /categories ─────────────────────────────
router.get("/categories", async (_req: Request, res: Response) => {
    try {
        const { rows } = await pool.query(
            "SELECT id, name, icon, sort_order FROM categories ORDER BY sort_order"
        );
        res.json(rows);
    } catch (err) {
        console.error("Error fetching categories:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ─── GET /items?category=xxx ─────────────────────
router.get("/items", async (req: Request, res: Response) => {
    try {
        const { category } = req.query;

        let query = "SELECT id, name, name_en, price, category_id, description, image, is_available FROM menu_items";
        const params: string[] = [];

        if (category && typeof category === "string") {
            query += " WHERE category_id = $1";
            params.push(category);
        }

        query += " ORDER BY id";

        const { rows } = await pool.query(query, params);
        res.json(rows);
    } catch (err) {
        console.error("Error fetching menu items:", err);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;
