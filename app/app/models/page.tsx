import { getModels, type Model } from "@/lib/models";
import { perMillion } from "@/lib/money";

export const revalidate = 600;
export const metadata = { title: "Models" };

const LANE = { free: "Free", private: "No training", provider: "Provider can read" } as const;

function ctx(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 ? 1 : 0) + "M";
  if (n >= 1000) return Math.round(n / 1000) + "K";
  return String(n || "—");
}

export default async function ModelsPage() {
  let models: Model[] = [];
  let failed = false;
  try { models = await getModels(); } catch { failed = true; }

  return (
    <div className="pg">
      <div className="pg-head">
        <div><p className="mono">Models</p><h1>Every model, <span className="serif">priced.</span></h1></div>
        <a className="btn btn-glow btn-sm" href="/app">Open chat</a>
      </div>
      <p style={{ margin: 0, color: "var(--muted)", maxWidth: "62ch" }}>
        Prices are per million tokens and already include the Synaps fee. The list price is what the provider charges.
      </p>
      {failed && <div className="notice err">Could not load the model list right now. Refresh in a minute.</div>}
      <section className="panel card-pad">
        <div className="table-wrap">
          <table className="table" style={{ minWidth: 820 }}>
            <thead>
              <tr><th>Model</th><th>Privacy</th><th className="r">Context</th><th className="r">Input / 1M</th><th className="r">Output / 1M</th><th className="r">List output</th></tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr key={m.id}>
                  <td><a href={"/models/" + m.id} style={{ fontWeight: 600, color: "var(--fg)", textDecoration: "none" }}>{m.name}</a><div className="num" style={{ fontSize: 12, color: "var(--dim)" }}>{m.id}</div></td>
                  <td><span className={"chip lane-" + m.lane}>{LANE[m.lane]}</span></td>
                  <td className="r num">{ctx(m.context)}</td>
                  <td className="r num">{perMillion(m.promptPrice)}</td>
                  <td className="r num">{perMillion(m.completionPrice)}</td>
                  <td className="r num" style={{ color: "var(--dim)" }}>{perMillion(m.listCompletionPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
