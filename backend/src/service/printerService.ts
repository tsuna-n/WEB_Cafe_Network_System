import fs from "fs";
import { createCanvas, CanvasRenderingContext2D } from "canvas";

export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
}

const PRINTER_DEVICE = "/dev/usb/lp0";

/**
 * แปลง Canvas เป็น TSPL BITMAP data (1-bit MSB)
 * สำหรับรุ่นที่ 0 = ดำ, 1 = ขาว (Inverted Logic)
 */
function canvasToTsplBitmap(ctx: CanvasRenderingContext2D, width: number, height: number): Buffer {
  const imageData = ctx.getImageData(0, 0, width, height).data;
  const widthBytes = Math.ceil(width / 8);
  // เริ่มต้น Buffer ด้วย 0xFF (บิตเป็น 1 ทั้งหมด = พื้นขาว)
  const buffer = Buffer.alloc(widthBytes * height, 0xFF);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const r = imageData[idx];
      const g = imageData[idx + 1];
      const b = imageData[idx + 2];
      const avg = (r + g + b) / 3;

      // ถ้าเป็นสีเข้ม (ตัวหนังสือ) ให้ตั้งบิตเป็น 0 (พ่นหมึกสีดำ)
      if (avg < 128) {
        const byteIdx = y * widthBytes + Math.floor(x / 8);
        const bitIdx = 7 - (x % 8);
        buffer[byteIdx] &= ~(1 << bitIdx); // สลับบิตจาก 1 เป็น 0
      }
    }
  }
  return buffer;
}

export async function printReceipt(items: OrderItem[]): Promise<boolean> {
  let fd: number | null = null;
  try {
    // ตรวจสอบการเชื่อมต่อเบื้องต้น
    if (!fs.existsSync(PRINTER_DEVICE)) {
      console.log("Printer device not found:", PRINTER_DEVICE);
      return false;
    }

    // --- คำนวณความสูงของใบเสร็จ (Dynamic Height) ---
    const canvasWidth = 448; // 56mm
    const headerHeight = 130;
    const rowHeight = 50;
    const footerHeight = 150;

    const canvasHeight = headerHeight + (items.length * rowHeight) + footerHeight;

    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext("2d");

    // พื้นหลังขาวสนิท
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // ตัวหนังสือดำสนิท
    ctx.fillStyle = "#000000";
    ctx.textBaseline = "top";

    // --- ส่วนหัว ---
    ctx.textAlign = "center";
    ctx.font = 'bold 36px "Sarabun", "Tahoma", sans-serif';
    ctx.fillText("LEBOIS CAFE", canvasWidth / 2, 20);

    ctx.font = 'bold 26px "Sarabun", "Tahoma", sans-serif';
    ctx.fillText("ขอบคุณที่ใช้บริการ", canvasWidth / 2, 70);
    ctx.fillRect(20, 110, canvasWidth - 40, 3);

    // --- รายการสินค้า ---
    let currentY = headerHeight + 10;
    let totalPrice = 0;

    for (const item of items) {
      const itemTotal = item.price * item.quantity;
      totalPrice += itemTotal;

      ctx.textAlign = "left";
      ctx.font = 'bold 28px "Sarabun", "Tahoma", sans-serif';
      ctx.fillText(`${item.name}`, 20, currentY);

      ctx.textAlign = "right";
      ctx.fillText(`x${item.quantity}`, canvasWidth - 110, currentY);
      ctx.fillText(`${itemTotal}`, canvasWidth - 20, currentY);

      currentY += rowHeight;
    }

    // --- ส่วนท้าย ---
    ctx.fillRect(20, currentY + 15, canvasWidth - 40, 3);
    ctx.textAlign = "right";
    ctx.font = 'bold 38px "Sarabun", "Tahoma", sans-serif';
    ctx.fillText(`รวม: ${totalPrice.toLocaleString()} ฿`, canvasWidth - 20, currentY + 40);

    // --- เตรียมคำสั่ง TSPL ---
    const widthBytes = Math.ceil(canvasWidth / 8);
    const bitmapData = canvasToTsplBitmap(ctx, canvasWidth, canvasHeight);
    const heightMm = Math.ceil(canvasHeight / 8) + 5;

    const commands = [
      `SIZE 56 mm, ${heightMm} mm\r\n`,
      `DENSITY 8\r\n`,       // ปรับความเข้มกลับมาระดับปกติ
      `GAP 0,0\r\n`,
      `DIRECTION 1\r\n`,
      `CLS\r\n`,
      `BITMAP 0,0,${widthBytes},${canvasHeight},0,`
    ];

    fd = fs.openSync(PRINTER_DEVICE, "w");

    // ส่งคำสั่งหัว
    for (const cmd of commands) {
      fs.writeSync(fd, cmd);
    }

    // ส่งข้อมูล Bitmap
    fs.writeSync(fd, bitmapData);

    // ส่งคำสั่งท้าย
    fs.writeSync(fd, "\r\nPRINT 1\r\nSTRIP\r\n");

    console.log("พิมพ์ใบเสร็จ (TSPL2) สำเร็จ! ยอดรวม:", totalPrice);
    return true;

  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการพิมพ์ (TSPL2):", error);
    return false;
  } finally {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch (e) { }
    }
  }
}