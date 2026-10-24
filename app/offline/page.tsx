export const metadata = { title: "Offline", robots: { index: false } };

export default function Offline() {
  return (
    <main style={{ minHeight: "100svh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "center", maxWidth: 360 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon-192.png" alt="" width={72} height={72} style={{ borderRadius: 18 }} />
        <h1 style={{ margin: 0, fontWeight: 500, fontSize: 30, letterSpacing: "-.03em" }}>You&apos;re offline</h1>
        <p style={{ margin: 0, color: "var(--muted)" }}>Synaps needs a connection to reach the models. Your chats are saved on this device and will be here when you&apos;re back.</p>
        <a className="btn btn-glow" href="/app">Try again</a>
      </div>
    </main>
  );
}
