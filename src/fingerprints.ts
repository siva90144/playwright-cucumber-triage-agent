import crypto from "node:crypto";

export function fingerprintFailure(parts: string[]): string {
  const h = crypto.createHash("sha256");
  for (const p of parts) h.update(p ?? "").update("\n");
  return h.digest("hex").slice(0, 16);
}
