# QR-cafe (POS Cafe) — ระบบสั่งออเดอร์/ชำระเงินด้วย QR

โปรเจกต์นี้เป็นระบบ POS/สั่งออเดอร์สำหรับร้านกาแฟ แยกเป็น

- **Frontend**: Next.js (โฟลเดอร์ `frontend/`)
- **Backend**: Express + TypeScript (โฟลเดอร์ `backend/`)
- **Database**: PostgreSQL

## ฟีเจอร์หลัก

- **สั่งออเดอร์จากหน้าลูกค้า** (รองรับระบุ “โต๊ะ” ผ่านลิงก์ `position/[id]`)
- **ชำระเงิน 2 แบบ**
  - **PromptPay**: แสดง **QR ให้สแกน** และแนบสลิปเพื่อตรวจสอบ
  - **เงินสด**: แสดง **บัตรคิว/โต๊ะ** และแจ้งให้ไปจ่ายที่เคาน์เตอร์
- **หน้าจัดการออเดอร์ (`/orders`)**
  - เงินสด: ต้องกด **“จ่ายเงินแล้ว”** → ถึงจะกด **“เสร็จแล้ว”**
  - PromptPay: ถ้า `payment_status` ยังไม่เป็น `paid` จะ **ยังไม่ให้กด “เสร็จแล้ว”**
  - ปุ่ม **“ย้อนกลับ”** ต้อง **ยืนยันรหัส Admin/Staff** ก่อน
- **Dashboard (`/dashboard`)**
  - ยอดขายและสรุปยอดจะรวมจากออเดอร์ที่ **จ่ายเงินแล้ว (`payment_status='paid'`)**

---

## โครงสร้างโปรเจกต์

```
QR-cafe/
  backend/                 # Express API + DB init
  frontend/                # Next.js UI
```

---

## การติดตั้ง (Prerequisites)

- Node.js (แนะนำ LTS)
- PostgreSQL (หรือ Docker ก็ได้)

---

## ตั้งค่า Database (PostgreSQL)

ค่าเริ่มต้นที่ backend ใช้ (ดู `backend/src/service/db.ts`)

- **host**: `localhost`
- **port**: `5433`
- **db**: `pos_cafe`
- **user**: `postgres`
- **password**: `password`

> คุณสามารถเปลี่ยนได้ด้วย ENV ด้านล่าง

### ตัวอย่างรันด้วย Docker

```bash
docker run --name pos_cafe_db -e POSTGRES_PASSWORD=password -e POSTGRES_DB=pos_cafe -p 5433:5432 -d postgres:16
```

---

## ตั้งค่า ENV (Backend)

สร้างไฟล์ `.env` ที่ `backend/.env` (หรือกำหนด env ในระบบ) ตัวอย่าง:

```bash
# Database
DB_HOST=localhost
DB_PORT=5433
DB_NAME=pos_cafe
DB_USER=postgres
DB_PASSWORD=password

# PromptPay QR
PROMPTPAY_ID=xxxxxxxxxxxxx

# (Optional) ตรวจสลิปกับ OpenSlipVerify
OPENSLIPVERIFY_TOKEN=your_token_here
```

หมายเหตุ:

- ถ้า **ไม่ตั้ง** `OPENSLIPVERIFY_TOKEN` ระบบจะยัง “รับสลิป” และอัปเดต `payment_status='paid'` ได้ แต่จะ **ไม่ยืนยันกับธนาคารจริง**

---

## วิธีรันโปรเจกต์

### 1) รัน Backend

```bash
cd backend
npm install
npm run dev
```

Backend จะรันที่ `http://0.0.0.0:3003` และจะทำ `initDB()` สร้างตาราง/seed ข้อมูลเริ่มต้นอัตโนมัติ

### 2) รัน Frontend

```bash
cd frontend
npm install
npm run dev
```

จากนั้นเข้าใช้งาน:

- `http://localhost:3000/login` (เข้าแอดมิน/พนักงาน)
- `http://localhost:3000/dashboard`
- `http://localhost:3000/orders`

> URL อาจต่างกันตามเครื่อง/การรันจริง

---

## การตั้งค่า Server URL (Frontend)

Frontend เรียก backend ผ่านค่า `serverUrl` ที่เก็บใน LocalStorage (ดู `frontend/service/config.ts`)

- ค่า default: `http://<hostname>:3003`

หาก backend ไม่ได้รันที่เครื่องเดียวกัน/พอร์ตอื่น ต้องตั้ง `serverUrl` ให้ถูกต้อง (ผ่านหน้าตั้งค่าใน UI หรือแก้ค่าที่ localStorage key: `pos_cafe_config`)

---

## การต่อเครื่องพิมพ์ (เช่น Xprinter)

โปรเจกต์รองรับการสั่งพิมพ์ผ่าน backend (ใช้แพ็กเกจ `node-thermal-printer`) สามารถต่อได้ทั้ง

- **USB** (เช่น Xprinter ต่อผ่าน USB แล้วขึ้นเป็น device เช่น `/dev/usb/lp0`)
- **Network** (บางรุ่นรองรับพิมพ์ผ่าน IP:PORT เช่น `9100`)

การตั้งค่าฝั่ง Frontend ถูกเก็บใน LocalStorage ที่ key: `pos_cafe_config` (ดู `frontend/service/config.ts`)

- **printerConnection**: `usb` หรือ `network`
- **printerProtocol**: `escpos` หรือ `tspl2` (ขึ้นกับรุ่น/โหมดของเครื่องพิมพ์)
- **printerUsbPath**: path ของ USB printer เช่น `/dev/usb/lp0`
- **printerIp / printerPort**: กรณี network เช่น `192.168.1.50` และ `9100`

> ถ้าใช้ Xprinter แล้วพิมพ์ไม่ออก ให้ลองสลับ `printerProtocol` ระหว่าง `escpos`/`tspl2` และตรวจสอบสิทธิ์การเข้าถึง device (`/dev/usb/lp0`) บนเครื่องที่รัน backend

---

## บัญชีเริ่มต้น (Seed Users)

ระบบจะ seed user เริ่มต้นตอน `initDB()`:

- **admin / 1234** (role: `admin`)
- **cashier / 0000** (role: `cashier`)

---

## Database Schema (สรุปตารางสำคัญ)

ตารางถูกสร้างโดย `backend/src/service/db.ts`

### `categories`

- `id` (TEXT, PK)
- `name` (TEXT)
- `icon` (TEXT)
- `sort_order` (INTEGER)

### `menu_items`

- `id` (SERIAL, PK)
- `name`, `name_en`
- `price` (DOUBLE)
- `category_id` (TEXT, FK → `categories.id`)
- `image`, `description`
- `is_available` (BOOLEAN)

### `orders`

- `id` (TEXT, PK)
- `order_number` (INTEGER) — running number ของวันนั้น
- `total` (DOUBLE)
- `payment_method` (TEXT) — `cash` | `promptpay` | (อื่น ๆ ถ้ามี)
- `status` (TEXT) — `pending` | `completed`
- `payment_status` (TEXT) — `pending` | `paid`
- `transaction_id` (TEXT) — ใช้เก็บ ref/ข้อมูลจาก QR บนสลิป (กันสลิปซ้ำ)
- `position_id` (TEXT) — โต๊ะ
- `cashier_name` (TEXT)
- `receipt_url` (TEXT) — path ของไฟล์สลิป
- `created_at` (TIMESTAMPTZ)

### `order_items`

- `id` (SERIAL, PK)
- `order_id` (TEXT, FK → `orders.id`)
- `item_id` (INTEGER)
- `item_name` (TEXT)
- `qty` (INTEGER)
- `price` (DOUBLE)

### `users`

- `id` (TEXT, PK)
- `name` (TEXT)
- `password` (TEXT) — PIN
- `role` (TEXT) — `admin` | `cashier`

---

## API ที่เกี่ยวกับการชำระเงิน (ย่อ)

Base URL: `http://<server>:3003`

- `GET /api/payments/promptpay-qr?amount=<number>&orderId=<id>`: สร้าง QR PromptPay (base64 image)
- `POST /api/payments/verify-slip` (multipart: `slip`, `orderId`): ตรวจ/รับสลิป แล้วอัปเดต `payment_status='paid'`
- `GET /api/payments/status/:orderId`: เช็คสถานะจ่ายเงิน
- `PATCH /api/payments/status/:orderId` body `{ payment_status: 'pending'|'paid' }`: อัปเดตสถานะจ่ายเงิน (manual)

---

## หมายเหตุการใช้งาน

- ลูกค้ากดยกเลิกก่อน “ยืนยัน” ในหน้าชำระเงิน จะ **ไม่สร้างออเดอร์ใน DB**
- หากต้องการให้ “ย้อนกลับสถานะ” ใน `/orders` จะต้องกรอก PIN ของ **admin หรือ staff** เพื่อยืนยันก่อน

