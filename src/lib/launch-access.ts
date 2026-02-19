export const RECEIPT_LAUNCH_AT = new Date("2026-02-23T00:00:00-05:00");
export const RECEIPT_LAUNCH_PASSWORD = "16807366";
export const RECEIPT_LAUNCH_UNLOCK_COOKIE = "receipt_launch_access";

export function isReceiptLaunchLive(now = new Date()) {
  return now.getTime() >= RECEIPT_LAUNCH_AT.getTime();
}

export function isValidReceiptLaunchPassword(password: string) {
  return password.trim() === RECEIPT_LAUNCH_PASSWORD;
}
