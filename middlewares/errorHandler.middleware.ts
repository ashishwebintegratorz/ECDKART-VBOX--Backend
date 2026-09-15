import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import multer from "multer";
import { HTTPSTATUS } from "../config/http.config.js";
import { AppError } from "../utils/appError.js";

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  console.error("Error on path", req.path, err);

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res
        .status(HTTPSTATUS.BAD_REQUEST)
        .json({ message: "File is too large. Maximum size allowed is 5MB." });
    }
    return res
      .status(HTTPSTATUS.BAD_REQUEST)
      .json({ message: `Upload error: ${err.message}` });
  }

  if (err instanceof ZodError) {
    const errors = err.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
    }));
    return res
      .status(HTTPSTATUS.BAD_REQUEST)
      .json({ message: "Validation failed", errors });
  }

  if (err instanceof AppError) {
    return res
      .status(err.statusCode)
      .json({ message: err.message, errorCode: err.errorCode });
  }

  return res
    .status(HTTPSTATUS.INTERNAL_SERVER_ERROR)
    .json({ message: "Internal Server Error", error: (err as any)?.message });
};
