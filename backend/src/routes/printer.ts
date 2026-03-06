import { Router, Request, Response } from "express";
import { printReceipt } from "../service/printerService"; 

const router = Router();

router.post("/print", async (req: Request, res: Response) => {

  const { items } = req.body;

  // ดักจับ Error กรณีที่หน้าบ้านไม่ได้ส่งข้อมูล items มา หรือส่งมาผิดรูปแบบ
  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: "Bad Request: No items provided",
    });
  }

  const success = await printReceipt(items);

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

export default router;