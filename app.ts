import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import hpp from "hpp";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import { config } from "./config/app.config.js";
import { errorHandler } from "./middlewares/errorHandler.middleware.js";
import { HTTPSTATUS } from "./config/http.config.js";
import { asyncHandler } from "./middlewares/asyncHandler.middleware.js";
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import productRoutes from "./routes/product.route.js";
import categoryRoutes from "./routes/categories.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import addressRoutes from "./routes/address.routes.js";
import orderRoutes from "./routes/order.routes.js";
import wishlistRoutes from "./routes/whishlist.routes.js";
import razorpayRoutes from "./routes/razorpay.routes.js";
import driverRoutes from "./routes/driver.routes.js";
import invoiceRoutes from "./routes/invoice.routes.js";
import reviewRoutes from "./routes/review.routes.js"
import zoneRoutes from "./routes/zone.route.js"
import settingRoutes from "./routes/setting.route.js"
import bannerRoutes from "./routes/banner.routes.js"
import issueRoutes from "./routes/issue.routes.js"
import refundRoutes from "./routes/refund.routes.js"

const app = express();
const BASE_PATH = config.BASE_PATH;

// 🟢 Razorpay Webhook (MUST be before express.json() for raw body verification)
app.use(`${BASE_PATH}/razorpay`, razorpayRoutes);

// Security Middlewares
app.use(helmet());
// app.use(mongoSanitize()); // Removed because it crashes on Express 4.19+ when setting req.query

// Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: "Too many requests from this IP, please try again after 15 minutes",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(globalLimiter);

// Body
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

// HTTP Parameter Pollution
app.use(hpp());

// CORS
const allowedOrigins = [
  config.FRONTEND_ORIGIN,
  "https://admin-vegbox.onrender.com",
  "http://localhost:3000",
  "http://localhost:5173",
];
app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.indexOf(origin) === -1) {
        var msg = 'The CORS policy for this site does not allow access from the specified Origin.';
        return callback(new Error(msg), false);
      }
      return callback(null, true);
    },
    credentials: true,
  })
);

// Health & Readiness Probes
app.get(
  "/healthz",
  asyncHandler(async (req, res) => {
    return res.status(HTTPSTATUS.OK).json({ status: "ok" });
  })
);

app.get(
  "/readyz",
  asyncHandler(async (req, res) => {
    // Check database connection status
    const isDbReady = mongoose.connection.readyState === 1;
    if (isDbReady) {
      return res.status(HTTPSTATUS.OK).json({ status: "ready" });
    } else {
      return res.status(503).json({ status: "not_ready" });
    }
  })
);

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
app.use(`${BASE_PATH}/products`, productRoutes);
app.use(`${BASE_PATH}/categories`, categoryRoutes);
app.use(`${BASE_PATH}/cart`, cartRoutes);
app.use(`${BASE_PATH}/addresses`, addressRoutes);
app.use(`${BASE_PATH}/orders`, orderRoutes);
app.use(`${BASE_PATH}/wishlist`, wishlistRoutes);
app.use(`${BASE_PATH}/drivers`, driverRoutes);
app.use(`${BASE_PATH}/invoices`, invoiceRoutes);
app.use(`${BASE_PATH}/reviews`, reviewRoutes);
app.use(`${BASE_PATH}/zones`, zoneRoutes);
app.use(`${BASE_PATH}/settings`, settingRoutes);
app.use(`${BASE_PATH}/banners`, bannerRoutes);
app.use(`${BASE_PATH}/issues`, issueRoutes);
app.use(`${BASE_PATH}/refunds`, refundRoutes);

// app.use(`${BASE_PATH}/razorpay`, razorpayRoutes); // Moved up

// error handler (last)
app.use(errorHandler);

export default app;
