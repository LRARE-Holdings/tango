import sharp from "sharp";

export const AVATAR_MAX_BYTES = 2_000_000;
export const AVATAR_SIZE_PX = 256;

const ACCEPTED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export function isAcceptedAvatarMimeType(mimeType: string | null | undefined) {
  const normalized = String(mimeType ?? "").trim().toLowerCase();
  return ACCEPTED_MIME_TYPES.has(normalized);
}

export async function normalizeAvatarImage(input: Uint8Array) {
  return sharp(input, { failOn: "none" })
    .rotate()
    .resize(AVATAR_SIZE_PX, AVATAR_SIZE_PX, {
      fit: "cover",
      position: "attention",
      withoutEnlargement: false,
    })
    .webp({ quality: 88 })
    .toBuffer();
}
