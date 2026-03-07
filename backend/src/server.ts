import express from "express";
import cors from "cors";
import printerRoutes from "./routes/printer";
import menuRoutes from "./routes/menu";
import orderRoutes from "./routes/orders";
import healthRoutes from "./routes/health";
import { initDB } from "./service/db";

const app = express();
const port = 3003;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "POS Cafe API Running",
  });
});

app.use("/printer", printerRoutes);
app.use("/api/menu", menuRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/health", healthRoutes);

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