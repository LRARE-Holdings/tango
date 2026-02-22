import { redirect } from "next/navigation";

export default async function LegacyAppCheckoutPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const qs = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") {
      qs.set(key, value);
      continue;
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string") qs.append(key, item);
      }
    }
  }

  redirect(`/checkout${qs.toString() ? `?${qs.toString()}` : ""}`);
}
