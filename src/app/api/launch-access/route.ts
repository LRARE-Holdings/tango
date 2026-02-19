import { NextResponse } from "next/server";
import {
  RECEIPT_LAUNCH_UNLOCK_COOKIE,
  isReceiptLaunchLive,
  isValidReceiptLaunchPassword,
} from "@/lib/launch-access";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { password?: string } | null;
  const password = typeof body?.password === "string" ? body.password : "";

  if (!isReceiptLaunchLive() && !isValidReceiptLaunchPassword(password)) {
    return NextResponse.json({ error: "Incorrect access password." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: RECEIPT_LAUNCH_UNLOCK_COOKIE,
    value: "1",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
