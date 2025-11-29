import "dotenv/config";
import express from "express";
import cors from "cors";
import { config } from "./config/app.config.js";
import { errorHandler } from "./middlewares/errorHandler.middleware.js";
import { HTTPSTATUS } from "./config/http.config.js";
import { asyncHandler } from "./middlewares/asyncHandler.middleware.js";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import productRoutes from "./routes/product.route.js";

const app = express();
const BASE_PATH = config.BASE_PATH;

// Body
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
app.use(
  cors({
    origin: config.FRONTEND_ORIGIN,
    credentials: true,
  })
);

// Health
app.get(
  `/`,
  asyncHandler(async (req, res) => {
    return res.status(HTTPSTATUS.OK).json({
      message: "Welcome to the backend API",
      version: "1.0.0",
    });
  })
);

// routes
app.use(`${BASE_PATH}/auth`, authRoutes);
app.use(`${BASE_PATH}/user`, userRoutes);
app.use(`${BASE_PATH}/admin`, adminRoutes);
app.use( `${BASE_PATH}/products`, productRoutes);

// error handler (last)
app.use(errorHandler);

export default app;
