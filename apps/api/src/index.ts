import "dotenv/config";

import cors from "cors";
import express from "express";
import helmet from "helmet";

const app = express();

const port = Number(process.env.PORT ?? 4000);
const webOrigin = process.env.WEB_ORIGIN ?? "http://localhost:3000";

app.use(helmet());
app.use(
  cors({
    origin: webOrigin,
  }),
);
app.use(express.json());

app.get("/api/v1/health", (_request, response) => {
  response.status(200).json({
    status: "ok",
    service: "voxreels-api",
  });
});

app.listen(port, () => {
  console.log(`VoxReels API running at http://localhost:${port}`);
});