import { Request } from "express";

export type AuthIdentity = {
  authProvider: "legacy" | "clerk";
  legacyUserId?: string;
  clerkUserId?: string;
  role?: string;
};

export type AuthRequest = Request & {
  user?: {
    id: string;
    role: string;
    authProvider: "legacy" | "clerk";
    clerkUserId?: string;
  };
  authIdentity?: AuthIdentity;
};
