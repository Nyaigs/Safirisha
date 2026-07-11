import { NextFunction, Response } from "express";
import { AppError } from "./error.middleware";
import { AuthRequest } from "./auth.middleware";

export type ValidationRule = {
  field: string;
  type: "string" | "number" | "boolean";
  required?: boolean;
  min?: number;
  max?: number;
};

export function validate(rules: ValidationRule[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    const missing: string[] = [];
    const invalid: string[] = [];

    for (const rule of rules) {
      const value = req.body[rule.field];

      if (rule.required && (value === undefined || value === null || value === "")) {
        missing.push(rule.field);
        continue;
      }

      if (value === undefined || value === null) continue;

      if (rule.type === "number") {
        const num = Number(value);
        if (!Number.isFinite(num)) {
          invalid.push(rule.field);
          continue;
        }
        if (rule.min !== undefined && num < rule.min) invalid.push(rule.field);
        if (rule.max !== undefined && num > rule.max) invalid.push(rule.field);
      }

      if (rule.type === "string" && typeof value !== "string") {
        invalid.push(rule.field);
      }
    }

    if (missing.length > 0) {
      next(new AppError(400, `Missing required fields: ${missing.join(", ")}`));
      return;
    }

    if (invalid.length > 0) {
      next(new AppError(400, `Invalid fields: ${invalid.join(", ")}`));
      return;
    }

    next();
  };
}
