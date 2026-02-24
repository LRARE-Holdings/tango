import fs from "node:fs/promises";
import path from "node:path";

export async function readReceiptLogoPngBytes() {
  try {
    const receiptLogoPath = path.join(process.cwd(), "public", "receipt-logo.png");
    const file = await fs.readFile(receiptLogoPath);
    return new Uint8Array(file);
  } catch {
    return null;
  }
}
