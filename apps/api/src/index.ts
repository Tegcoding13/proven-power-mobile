import "dotenv/config";
import express from "express";
import cors from "cors";
import { staffRouter } from "./routes/staff.js";

const app = express();
const port = process.env.PORT ?? 4000;

const allowedOrigins = [process.env.WEB_APP_ORIGIN, process.env.ADMIN_APP_ORIGIN].filter(
  (origin): origin is string => Boolean(origin)
);

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/staff", staffRouter);

app.listen(port, () => {
  console.log(`Proven Power API listening on port ${port}`);
});
