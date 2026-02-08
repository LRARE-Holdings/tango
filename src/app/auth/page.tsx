import { Suspense } from "react";
import AuthClient from "./auth-client";

export const dynamic = "force-dynamic";

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthClient />
    </Suspense>
  );
}