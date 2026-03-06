import express, { Express, Request, Response, } from "express";

const cors = require('cors');
const { initDB } = require('./db');
const app: Express = express();
app.use(cors());
const port: number = 3003;

app.get("/", (req: Request, res: Response) => {
  res.json({
    message: "Hello Express + TypeScript!!",
  });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Application is running on port ${port}`);
});

initDB()
  .then(() => {
    app.listen(port, '0.0.0.0', () => {
      console.log(`POS Cafe API Server running on http://0.0.0.0:${port}`);
    });
  })
  .catch((err: any) => {
    console.error('Failed to initialize database:', err);
    process.exit(1);
  });