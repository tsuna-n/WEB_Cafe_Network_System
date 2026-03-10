"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const printerService_1 = require("../service/printerService");
const router = (0, express_1.Router)();
router.post("/print", async (req, res) => {
    const { items } = req.body;
    // ดักจับ Error กรณีที่หน้าบ้านไม่ได้ส่งข้อมูล items มา หรือส่งมาผิดรูปแบบ
    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
            success: false,
            message: "Bad Request: No items provided",
        });
    }
    const success = await (0, printerService_1.printReceipt)(items);
    if (!success) {
        return res.status(500).json({
            success: false,
            message: "Printer error",
        });
    }
    res.json({
        success: true,
        message: "Printed successfully",
    });
});
exports.default = router;
