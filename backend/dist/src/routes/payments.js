"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const generatePayload = require("promptpay-qr");
const qrcode_1 = __importDefault(require("qrcode"));
const dotenv_1 = __importDefault(require("dotenv"));
const multer_1 = __importDefault(require("multer"));
const axios_1 = __importDefault(require("axios"));
const jsqr_1 = __importDefault(require("jsqr"));
const canvas_1 = require("canvas");
const db_1 = require("../service/db");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
dotenv_1.default.config();
const router = (0, express_1.Router)();
const storage = multer_1.default.diskStorage({
    destination: function (req, file, cb) {
        const dir = path_1.default.join(__dirname, "../../uploads/receipts");
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'receipt-' + uniqueSuffix + path_1.default.extname(file.originalname));
    }
});
const upload = (0, multer_1.default)({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});
// ─── Helper: Decode QR จากรูปสลิป ─────────────────────────────────────────────
async function decodeQRFromImage(filePath) {
    try {
        const img = await (0, canvas_1.loadImage)(filePath);
        const canvas = (0, canvas_1.createCanvas)(img.width, img.height);
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const { data, width, height } = ctx.getImageData(0, 0, img.width, img.height);
        const code = (0, jsqr_1.default)(new Uint8ClampedArray(data.buffer), width, height);
        return code?.data ?? null;
    }
    catch (err) {
        console.error("Decode QR Error:", err);
        return null;
    }
}
// ─── 1. สร้าง PromptPay QR (ใช้ lib ท้องถิ่น ฟรี) ─────────────────────────────
router.get("/promptpay-qr", async (req, res) => {
    try {
        const amount = parseFloat(req.query.amount);
        const orderId = req.query.orderId;
        const promptPayId = process.env.PROMPTPAY_ID;
        if (!promptPayId)
            return res.status(500).json({ error: "PROMPTPAY_ID not configured" });
        if (isNaN(amount) || !orderId)
            return res.status(400).json({ error: "Invalid parameters" });
        const payload = generatePayload(promptPayId, { amount });
        const qrBase64 = await qrcode_1.default.toDataURL(payload, {
            color: { dark: "#004677", light: "#ffffff" },
            width: 500,
            margin: 2,
        });
        res.json({ qr_image: qrBase64, order_id: orderId, amount });
    }
    catch (err) {
        console.error("QR Error:", err);
        res.status(500).json({ error: "Internal error" });
    }
});
// ─── 2. ตรวจสอบสลิปด้วย OpenVerifySlip (ฟรี 500 ครั้ง/วัน) ──────────────────
// Flow: รูปสลิป → decode QR payload → ส่ง OpenVerifySlip → ยืนยันกับธนาคาร
router.post("/verify-slip", upload.single("slip"), async (req, res) => {
    try {
        const { orderId } = req.body;
        const file = req.file;
        if (!file || !orderId) {
            return res.status(400).json({ error: "กรุณาแนบสลิปและระบุ orderId" });
        }
        // ดึงข้อมูล order
        const { rows: orders } = await db_1.pool.query("SELECT total, payment_status FROM orders WHERE id = $1", [orderId]);
        if (orders.length === 0)
            return res.status(404).json({ error: "ไม่พบออเดอร์" });
        if (orders[0].payment_status === "paid")
            return res.json({ success: true, alreadyPaid: true });
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
            await db_1.pool.query("UPDATE orders SET payment_status = 'paid', transaction_id = $1, receipt_url = $2 WHERE id = $3", [qrPayload, receiptUrl, orderId]);
            return res.json({ success: true, verified: false, receipt_url: receiptUrl });
        }
        // เรียก OpenVerifySlip API — ยืนยันกับธนาคารจริง
        const verifyRes = await axios_1.default.post("https://api.openslipverify.com", {
            refNbr: qrPayload,
            amount: expectedAmount.toString(),
            token,
        }, { headers: { "Content-Type": "application/json" } });
        const result = verifyRes.data;
        if (!result?.success) {
            return res.status(400).json({
                error: result?.message || "สลิปไม่ผ่านการตรวจสอบ หรือยอดเงินไม่ตรง",
            });
        }
        const { rows: dupCheck } = await db_1.pool.query("SELECT id FROM orders WHERE transaction_id = $1 AND id != $2", [qrPayload, orderId]);
        if (dupCheck.length > 0) {
            return res.status(400).json({ error: "สลิปนี้ถูกใช้ไปแล้ว" });
        }
        const receiptUrl = `/uploads/receipts/${file.filename}`;
        await db_1.pool.query("UPDATE orders SET payment_status = 'paid', transaction_id = $1, receipt_url = $2 WHERE id = $3", [qrPayload, receiptUrl, orderId]);
        res.json({ success: true, receipt_url: receiptUrl });
    }
    catch (err) {
        console.error("Slip verify error:", err?.response?.data || err?.message);
        if (err?.response?.status === 400) {
            return res.status(400).json({ error: "สลิปไม่ถูกต้องหรือโอนไม่สำเร็จ" });
        }
        res.status(500).json({ error: "เกิดข้อผิดพลาดในการตรวจสอบ" });
    }
});
// ─── 3. Polling: ตรวจสอบสถานะการจ่ายเงิน ─────────────────────────────────────
router.get("/status/:orderId", async (req, res) => {
    try {
        const { orderId } = req.params;
        const { rows } = await db_1.pool.query("SELECT status, payment_status, receipt_url FROM orders WHERE id = $1", [orderId]);
        if (rows.length === 0)
            return res.status(404).json({ error: "Order not found" });
        const isPaid = rows[0].payment_status === "paid" || rows[0].status === "completed";
        res.json({
            paid: isPaid,
            status: rows[0].status,
            payment_status: rows[0].payment_status,
            receipt_url: rows[0].receipt_url
        });
    }
    catch (err) {
        res.status(500).json({ error: "Status check failed" });
    }
});
// ─── 4. อัพเดทสถานะการจ่ายเงินแบบ Manual (เจ้าหน้าที่) ────────────────────────
router.patch("/status/:orderId", async (req, res) => {
    try {
        const { orderId } = req.params;
        const { payment_status } = req.body;
        if (!payment_status || !["pending", "paid"].includes(payment_status)) {
            return res.status(400).json({ error: "Invalid payment status" });
        }
        const { rowCount } = await db_1.pool.query("UPDATE orders SET payment_status = $1 WHERE id = $2", [payment_status, orderId]);
        if (rowCount === 0)
            return res.status(404).json({ error: "Order not found" });
        res.json({ success: true, order_id: orderId, payment_status });
    }
    catch (err) {
        console.error("Update Payment Error:", err);
        res.status(500).json({ error: "Internal error" });
    }
});
exports.default = router;
