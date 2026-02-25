import { NextResponse } from "next/server";

export type AuthErrorLike = {
  message?: string;
  code?: string;
} | null | undefined;

export function isUnauthorizedAuthError(error: AuthErrorLike) {
  if (!error) return false;
  if (error.code === "PGRST301") return true;
  const message = String(error.message ?? "").toLowerCase();
  return message.includes("auth session missing") || message.includes("invalid jwt") || message.includes("jwt");
}

export function authErrorResponse(error: AuthErrorLike) {
  if (isUnauthorizedAuthError(error)) {
    return NextResponse.json({ error: "Unauthorized", code: "UNAUTHORIZED" }, { status: 401 });
  }
  return NextResponse.json({ error: "Authentication failed.", code: "AUTH_PROVIDER_ERROR" }, { status: 500 });
}

export function unauthorizedResponse(message = "Unauthorized") {
  return NextResponse.json({ error: message, code: "UNAUTHORIZED" }, { status: 401 });
}
