export function parseMaxFailuresOption(value: unknown, fallback = 500): number {
  const raw = value ?? fallback;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) {
    throw new Error(`Invalid --maxFailures value "${String(value)}". Provide a positive integer.`);
  }
  return n;
}
