import { Request } from "express";

export function getParam(req: Request, key: string): string | null {
  const value = req.params[key];

  if (!value) return null;
  if (Array.isArray(value)) return value[0];

  return value;
}
