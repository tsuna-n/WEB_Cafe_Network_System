"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const printer_1 = __importDefault(require("./routes/printer"));
const menu_1 = __importDefault(require("./routes/menu"));
const orders_1 = __importDefault(require("./routes/orders"));
const health_1 = __importDefault(require("./routes/health"));
const auth_1 = __importDefault(require("./routes/auth"));
const payments_1 = __importDefault(require("./routes/payments"));
const db_1 = require("./service/db");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const app = (0, express_1.default)();
const port = Number(process.env.PORT) || 3003;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Ensure uploads directory exists
const uploadsDir = path_1.default.join(__dirname, "../uploads/receipts");
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
}
app.get("/", (req, res) => {
    res.json({
        message: `POS Cafe API Running`,
    });
});
app.use("/uploads", express_1.default.static(path_1.default.join(__dirname, "../uploads")));
app.use("/printer", printer_1.default);
app.use("/api/menu", menu_1.default);
app.use("/api/orders", orders_1.default);
app.use("/api/health", health_1.default);
app.use("/api/auth", auth_1.default);
app.use("/api/payments", payments_1.default);
async function startServer() {
    try {
        await (0, db_1.initDB)();
        app.listen(port, "0.0.0.0", () => {
            console.log(`Server running on http://0.0.0.0:${port}`);
        });
    }
    catch (err) {
        console.error("DB init failed:", err);
        process.exit(1);
    }
}
startServer();
