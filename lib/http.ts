export function bad(message: string, status = 400) {
  return Response.json({ error: { message } }, { status });
}

export function clientIp(req: Request): string {
  const f = req.headers.get("x-forwarded-for");
  if (f) return f.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}
