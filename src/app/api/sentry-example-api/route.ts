import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { areDebugEndpointsEnabled } from "@/lib/security/debug-flags";
export const dynamic = "force-dynamic";

class SentryExampleAPIError extends Error {
  constructor(message: string | undefined) {
    super(message);
    this.name = "SentryExampleAPIError";
  }
}

// A faulty API route to test Sentry's error monitoring
export function GET() {
  if (!areDebugEndpointsEnabled()) {
    return new NextResponse("Not found", { status: 404 });
  }

  Sentry.logger.info("Sentry example API called");
  throw new SentryExampleAPIError(
    "This error is raised on the backend called by the example page.",
  );
}
