import { Router, Request, Response } from "express";
import generatePayload = require("promptpay-qr");
import qrcode from "qrcode";
import dotenv from "dotenv";
import multer from "multer";
import axios from "axios";
import jsQR from "jsqr";
import { createCanvas, loadImage } from "canvas";
import { pool } from "../service/db";
import path from "path";
import fs from "fs";

dotenv.config();

const router = Router();

const storage = multer.diskStorage({
    destination: function (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) {
        const dir = path.join(__dirname, "../../uploads/receipts");
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'receipt-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// ─── Helper: Decode QR จากรูปสลิป ─────────────────────────────────────────────
async function decodeQRFromImage(filePath: string): Promise<string | null> {
    try {
        const img = await loadImage(filePath);
        const canvas = createCanvas(img.width, img.height);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const { data, width, height } = ctx.getImageData(0, 0, img.width, img.height);
        const code = jsQR(new Uint8ClampedArray(data.buffer), width, height);
        return code?.data ?? null;
    } catch (err) {
        console.error("Decode QR Error:", err);
        return null;
    }
}

// ─── 1. สร้าง PromptPay QR (ใช้ lib ท้องถิ่น ฟรี) ─────────────────────────────
router.get("/promptpay-qr", async (req: Request, res: Response) => {
    try {
        const amount = parseFloat(req.query.amount as string);
        const orderId = req.query.orderId as string;
        const promptPayId = process.env.PROMPTPAY_ID;

        if (!promptPayId) return res.status(500).json({ error: "PROMPTPAY_ID not configured" });
        if (isNaN(amount) || !orderId) return res.status(400).json({ error: "Invalid parameters" });

        const payload = generatePayload(promptPayId, { amount });
        const qrBase64 = await qrcode.toDataURL(payload, {
            color: { dark: "#004677", light: "#ffffff" },
            width: 500,
            margin: 2,
        });

        res.json({ qr_image: qrBase64, order_id: orderId, amount });
    } catch (err) {
        console.error("QR Error:", err);
        res.status(500).json({ error: "Internal error" });
    }
});

// ─── 2. ตรวจสอบสลิปด้วย OpenVerifySlip (ฟรี 500 ครั้ง/วัน) ──────────────────
// Flow: รูปสลิป → decode QR payload → ส่ง OpenVerifySlip → ยืนยันกับธนาคาร
router.post("/verify-slip", upload.single("slip"), async (req: Request, res: Response) => {
    try {
        const { orderId } = req.body;
        const file = req.file as Express.Multer.File;

        if (!file || !orderId) {
            return res.status(400).json({ error: "กรุณาแนบสลิปและระบุ orderId" });
        }

        // ดึงข้อมูล order
        const { rows: orders } = await pool.query(
            "SELECT total, payment_status FROM orders WHERE id = $1",
            [orderId]
        );
        if (orders.length === 0) return res.status(404).json({ error: "ไม่พบออเดอร์" });
        if (orders[0].payment_status === "paid") return res.json({ success: true, alreadyPaid: true });

        const expectedAmount = parseFloat(orders[0].total);

        // Decode QR จากรูปสลิป
        const qrPayload = await decodeQRFromImage(file.path);
        if (!qrPayload) {
            return res.status(400).json({
                error: "ไม่พบ QR Code ในสลิป กรุณาถ่ายให้ชัดและให้เห็น QR ทั้งดวง",
            });
        }

        const token = process.env.OPENSLIPVERIFY_TOKEN;
        if (!token) {
            console.warn("OPENSLIPVERIFY_TOKEN is not set. Saving receipt without bank verification.");
            
            const receiptUrl = `/uploads/receipts/${file.filename}`;
            await pool.query(
                "UPDATE orders SET payment_status = 'paid', transaction_id = $1, receipt_url = $2 WHERE id = $3",
                [qrPayload, receiptUrl, orderId]
            );
            return res.json({ success: true, verified: false, receipt_url: receiptUrl });
        }

        // เรียก OpenVerifySlip API — ยืนยันกับธนาคารจริง
        const verifyRes = await axios.post(
            "https://api.openslipverify.com",
            {
                refNbr: qrPayload,
                amount: expectedAmount.toString(),
                token,
            },
            { headers: { "Content-Type": "application/json" } }
        );

        const result = verifyRes.data;

        if (!result?.success) {
            return res.status(400).json({
                error: result?.message || "สลิปไม่ผ่านการตรวจสอบ หรือยอดเงินไม่ตรง",
            });
        }

        const { rows: dupCheck } = await pool.query(
            "SELECT id FROM orders WHERE transaction_id = $1 AND id != $2",
            [qrPayload, orderId]
        );
        if (dupCheck.length > 0) {
            return res.status(400).json({ error: "สลิปนี้ถูกใช้ไปแล้ว" });
        }

        const receiptUrl = `/uploads/receipts/${file.filename}`;

        await pool.query(
            "UPDATE orders SET payment_status = 'paid', transaction_id = $1, receipt_url = $2 WHERE id = $3",
            [qrPayload, receiptUrl, orderId]
        );

        res.json({ success: true, receipt_url: receiptUrl });
    } catch (err: any) {
        console.error("Slip verify error:", err?.response?.data || err?.message);
        if (err?.response?.status === 400) {
            return res.status(400).json({ error: "สลิปไม่ถูกต้องหรือโอนไม่สำเร็จ" });
        }
        res.status(500).json({ error: "เกิดข้อผิดพลาดในการตรวจสอบ" });
    }
});

// ─── 3. Polling: ตรวจสอบสถานะการจ่ายเงิน ─────────────────────────────────────
router.get("/status/:orderId", async (req: Request, res: Response) => {
    try {
        const { orderId } = req.params;
        const { rows } = await pool.query(
            "SELECT status, payment_status, receipt_url FROM orders WHERE id = $1",
            [orderId]
        );
        if (rows.length === 0) return res.status(404).json({ error: "Order not found" });

        const isPaid = rows[0].payment_status === "paid" || rows[0].status === "completed";
        res.json({ 
            paid: isPaid, 
            status: rows[0].status, 
            payment_status: rows[0].payment_status,
            receipt_url: rows[0].receipt_url
        });
    } catch (err) {
        res.status(500).json({ error: "Status check failed" });
    }
});

// ─── 4. อัพเดทสถานะการจ่ายเงินแบบ Manual (เจ้าหน้าที่) ────────────────────────
router.patch("/status/:orderId", async (req: Request, res: Response) => {
    try {
        const { orderId } = req.params;
        const { payment_status } = req.body;

        if (!payment_status || !["pending", "paid"].includes(payment_status)) {
            return res.status(400).json({ error: "Invalid payment status" });
        }

        const { rowCount } = await pool.query(
            "UPDATE orders SET payment_status = $1 WHERE id = $2",
            [payment_status, orderId]
        );
        if (rowCount === 0) return res.status(404).json({ error: "Order not found" });

        res.json({ success: true, order_id: orderId, payment_status });
    } catch (err) {
        console.error("Update Payment Error:", err);
        res.status(500).json({ error: "Internal error" });
    }
});

export default router;
