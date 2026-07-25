// AC-2, AC-3 (issue #17): upload helpers.
// saveUpload() validates + resizes via sharp, then writes to data/uploads/.
// getUploadPath() resolves a filename to its on-disk path for the GET route.

import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { resolve, join } from "node:path";

/** Root directory for uploaded files. Lives under data/ (gitignored, volume-mounted). */
export const UPLOADS_DIR = resolve(process.env.UPLOADS_DIR ?? "data/uploads");

/** AC-1: accepted MIME types → { file extension, sharp format ID } map.
 *  The extension is what's written to disk (.jpg, what browsers expect);
 *  the format is what's passed to sharp.toFormat() (which wants "jpeg"). */
type Accepted = { ext: string; format: "png" | "jpeg" | "webp" };
const ACCEPTED: Record<string, Accepted> = {
  "image/png": { ext: "png", format: "png" },
  "image/jpeg": { ext: "jpg", format: "jpeg" },
  "image/webp": { ext: "webp", format: "webp" },
};

/** AC-1: 2 MB max upload size. */
export const MAX_BYTES = 2 * 1024 * 1024;

export class UploadValidationError extends Error {}

/**
 * AC-1, AC-2, AC-3: validate the upload, resize it to fit a 1000×1000 box
 * (preserving aspect ratio, never upscaling), write to data/uploads/<uuid>.<ext>,
 * and return the public URL path (`/api/uploads/<uuid>.<ext>`).
 */
export async function saveUpload(file: File): Promise<string> {
  // AC-1: validate size.
  if (file.size > MAX_BYTES) {
    throw new UploadValidationError(
      `File is ${(file.size / 1024 / 1024).toFixed(1)} MB; limit is 2 MB.`,
    );
  }
  // AC-1: validate type. Trust the declared MIME; sharp will re-derive on decode.
  const accepted = ACCEPTED[file.type];
  if (!accepted) {
    throw new UploadValidationError(
      "File must be a PNG, JPEG, or WebP image.",
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());

  // AC-2: resize to fit within 1000×1000 without upscaling (fit: 'inside' +
  // withoutEnlargement preserves aspect ratio and never upsells small images).
  const resized = await sharp(buf)
    .resize(1000, 1000, { fit: "inside", withoutEnlargement: true })
    .toFormat(accepted.format)
    .toBuffer();

  // AC-3: write to data/uploads/<uuid>.<ext>.
  mkdirSync(UPLOADS_DIR, { recursive: true });
  const name = `${randomUUID()}.${accepted.ext}`;
  writeFileSync(join(UPLOADS_DIR, name), resized);

  return `/api/uploads/${name}`;
}

/** AC-4: resolve a filename to its on-disk path for serving. */
export function getUploadPath(filename: string): string {
  // Defend against path traversal — only allow simple filenames.
  const safe = filename.replace(/[^a-zA-Z0-9.-]/g, "");
  return join(UPLOADS_DIR, safe);
}

/** AC-4: map a stored filename back to its MIME type (from extension). */
export function mimeFor(filename: string): string {
  if (filename.endsWith(".png")) return "image/png";
  if (filename.endsWith(".jpg")) return "image/jpeg";
  if (filename.endsWith(".webp")) return "image/webp";
  return "application/octet-stream";
}
