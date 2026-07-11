import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function notFound(_req: Request, _res: Response, next: NextFunction) {
  next(new AppError(404, "Route not found"));
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      message: err.message,
      code: err.code,
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return res.status(409).json({
        message: "A record with this value already exists",
        code: "UNIQUE_CONSTRAINT",
      });
    }
    if (err.code === "P2025") {
      return res.status(404).json({
        message: "Record not found",
        code: "NOT_FOUND",
      });
    }
    return res.status(400).json({
      message: "Database error",
      code: err.code,
    });
  }

  if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    return res.status(401).json({
      message: "Invalid or expired token",
      code: "AUTH_ERROR",
    });
  }

  console.error("[ERROR]", err);

  return res.status(500).json({
    message: "Internal server error",
  });
}
