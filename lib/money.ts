export const MICROS = 1_000_000;

export function fmtUsd(micros: number | null | undefined, digits = 2): string {
  const v = (micros ?? 0) / MICROS;
  if (v > 0 && v < 0.01) return "$" + v.toFixed(4);
  return "$" + v.toFixed(digits);
}

/** price per token (USD) -> USD per 1M tokens */
export function perMillion(pricePerToken: number): string {
  const v = pricePerToken * 1_000_000;
  if (v === 0) return "Free";
  if (v < 1) return "$" + v.toFixed(3);
  return "$" + v.toFixed(2);
}
