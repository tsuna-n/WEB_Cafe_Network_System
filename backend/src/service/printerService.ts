import { ThermalPrinter, PrinterTypes } from "node-thermal-printer";
import { createCanvas } from "canvas";

export interface OrderItem {
  name: string;
  quantity: number;
  price: number; 
}

const printer = new ThermalPrinter({
  type: PrinterTypes.EPSON,
  interface: "/dev/usb/lp0",
  removeSpecialCharacters: false,
});

export async function printReceipt(items: OrderItem[]): Promise<boolean> {
  try {
    const isConnected = await printer.isPrinterConnected();
    if (!isConnected) {
      console.log("Printer not connected");
      return false;
    }

    // --- คำนวณความสูงของใบเสร็จ (Dynamic Height) ---
    const canvasWidth = 576; 
    const headerHeight = 80;  // พื้นที่ส่วนหัว (ชื่อร้าน)
    const rowHeight = 35;     // ความสูงต่อ 1 รายการสินค้า
    const footerHeight = 100; // พื้นที่ส่วนท้าย (ราคารวม)
    
    // ความสูงรวม = หัว + (จำนวนของ * ความสูงต่อแถว) + ท้าย
    const canvasHeight = headerHeight + (items.length * rowHeight) + footerHeight;

    const canvas = createCanvas(canvasWidth, canvasHeight);
    const ctx = canvas.getContext("2d");

    // เทพื้นหลังสีขาว
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // ตั้งค่าฟอนต์
    ctx.fillStyle = "#000000";
    ctx.textBaseline = "top";
    ctx.font = '24px "Tahoma", "Sarabun", sans-serif'; 

    // --- ส่วนหัวใบเสร็จ ---
    ctx.textAlign = "center";
    ctx.fillText("ร้านกาแฟ POS", canvasWidth / 2, 20);
    ctx.fillRect(20, 60, canvasWidth - 40, 2); // เส้นคั่น
    
    // --- ส่วนรายการสินค้า ---
    let currentY = headerHeight;
    let totalPrice = 0;

    // วนลูปวาดแต่ละรายการ
    for (const item of items) {
      const itemTotal = item.price * item.quantity;
      totalPrice += itemTotal; // บวกราคาสะสม

      // ชื่อสินค้า และ จำนวน
      ctx.textAlign = "left";
      ctx.fillText(`${item.name}  x${item.quantity}`, 20, currentY);
      
      // ราคารวมของแถวนั้น
      ctx.textAlign = "right";
      ctx.fillText(`${itemTotal}`, canvasWidth - 20, currentY);

      currentY += rowHeight; // ขยับบรรทัดลงสำหรับรายการถัดไป
    }
    
    // --- ส่วนท้ายใบเสร็จ ---
    ctx.fillRect(20, currentY, canvasWidth - 40, 2);
    
    ctx.textAlign = "right";
    ctx.fillText(`รวม ${totalPrice} บาท`, canvasWidth - 20, currentY + 20);

    // --- แปลงเป็นรูปและปริ้น ---
    const buffer = canvas.toBuffer("image/png");

    await printer.printImageBuffer(buffer);
    printer.cut();
    await printer.execute();
    
    console.log("พิมพ์ใบเสร็จสำเร็จ! ยอดรวม:", totalPrice);
    return true;

  } catch (error) {
    console.error("เกิดข้อผิดพลาดในการพิมพ์:", error);
    return false;
  }
}