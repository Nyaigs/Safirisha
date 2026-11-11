import { Request, Response, NextFunction } from "express";
import { ZodError, ZodTypeAny } from "zod";

export const validate = (schema: ZodTypeAny) =>
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        // Zod v4 uses .issues instead of .errors
        const messages = error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ");
        return res.status(400).json({ message: messages });
      }
      return next(error);
    }
  };
