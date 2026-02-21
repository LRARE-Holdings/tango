function parseBoolean(value: string | undefined | null) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}

export function areDebugEndpointsEnabled() {
  return parseBoolean(process.env.ENABLE_DEBUG_ENDPOINTS);
}

