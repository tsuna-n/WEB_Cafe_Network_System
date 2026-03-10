import express from "express";
import cors from "cors";
import printerRoutes from "./routes/printer";
import menuRoutes from "./routes/menu";
import orderRoutes from "./routes/orders";
import healthRoutes from "./routes/health";
import authRoutes from "./routes/auth";
import paymentRoutes from "./routes/payments";
import { initDB } from "./service/db";
import path from "path";
import fs from "fs";

const app = express();
const port = Number(process.env.PORT) || 3003;

app.use(cors());
app.use(express.json());

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "../uploads/receipts");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.get("/", (req, res) => {
  res.json({
    message: `POS Cafe API Running`,
  });
});

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
app.use("/printer", printerRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/payments", paymentRoutes);

async function startServer() {
  try {
    await initDB();

    app.listen(port, "0.0.0.0", () => {
      console.log(`Server running on http://0.0.0.0:${port}`);
    });

  } catch (err) {
    console.error("DB init failed:", err);
    process.exit(1);
  }
}

startServer();