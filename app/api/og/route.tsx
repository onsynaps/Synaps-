import { ImageResponse } from "next/og";

export const runtime = "edge";

/** Social card (1200×630) with the Synaps logo, used for model pages and shared chats. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const clip = (v: string | null, n: number) => (v || "").replace(/\s+/g, " ").trim().slice(0, n);
  const kicker = clip(q.get("k"), 40) || "Synaps";
  const title = clip(q.get("t"), 90) || "Every frontier model. One balance.";
  const sub = clip(q.get("s"), 140);
  const big = title.length < 34;

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 72px", background: "#06050a", color: "#f1eff8", position: "relative" }}>
        <div style={{ position: "absolute", left: -180, top: -260, width: 820, height: 820, borderRadius: 9999, background: "radial-gradient(circle, rgba(120,98,255,0.5), rgba(120,98,255,0) 65%)", display: "flex" }} />
        <div style={{ position: "absolute", right: -220, bottom: -300, width: 760, height: 760, borderRadius: 9999, background: "radial-gradient(circle, rgba(111,227,240,0.25), rgba(111,227,240,0) 65%)", display: "flex" }} />

        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="64" height="64" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="14" fill="rgba(165,148,255,0.35)" />
            <ellipse cx="32" cy="32" rx="25" ry="9.5" transform="rotate(32 32 32)" fill="none" stroke="#A594FF" strokeOpacity="0.4" strokeWidth="2" />
            <ellipse cx="32" cy="32" rx="25" ry="9.5" transform="rotate(-28 32 32)" fill="none" stroke="#A594FF" strokeWidth="2.8" />
            <circle cx="32" cy="32" r="6" fill="#ffffff" />
            <circle cx="53.5" cy="20.5" r="3.8" fill="#6FE3F0" />
          </svg>
          <div style={{ fontSize: 44, fontWeight: 600, letterSpacing: -2 }}>synaps</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 1040 }}>
          <div style={{ fontSize: 22, letterSpacing: 6, textTransform: "uppercase", color: "#a594ff" }}>{kicker}</div>
          <div style={{ fontSize: big ? 84 : 62, fontWeight: 600, lineHeight: 1.04, letterSpacing: big ? -3 : -2 }}>{title}</div>
          {sub ? <div style={{ fontSize: 30, color: "#a29eb8", lineHeight: 1.35 }}>{sub}</div> : null}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 24, color: "#6f6b86" }}>
          <div style={{ display: "flex", color: "#c9c0ff" }}>synaps.chat</div>
          <div style={{ display: "flex" }}>Every frontier model · One balance · Pay with crypto</div>
        </div>
      </div>
    ),
    { width: 1200, height: 630, headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800, immutable" } }
  );
}
