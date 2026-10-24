"use client";
import { useEffect, useState } from "react";
import { fmtUsd } from "@/lib/money";
import { XIcon } from "@/components/XLink";

type Ref = {
  code: string;
  link: string;
  invited: number;
  converted: number;
  earned_micros: number;
  you_were_invited: boolean;
  your_bonus_used: boolean;
  terms: { referrer_pct: number; referee_pct: number; cap_usd: number; min_usd: number };
};

/** "Invite friends" card on the Wallet page. */
export function InvitePanel() {
  const [r, setR] = useState<Ref | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/referral", { cache: "no-store" }).then((x) => (x.ok ? x.json() : null)).then(setR).catch(() => {});
  }, []);
  if (!r) return null;

  const you = Math.round(r.terms.referrer_pct * 100);
  const them = Math.round(r.terms.referee_pct * 100);
  const tweet = `I'm using Synaps — Claude, GPT, Gemini and more, pay per message with crypto. Get +${them}% extra credit on your first top-up: ${r.link}`;

  return (
    <section className="panel card-pad inv">
      <div className="inv-head">
        <div>
          <h2 className="h3" style={{ fontSize: 24, margin: 0 }}>Invite friends</h2>
          <p className="inv-sub">
            When a friend tops up for the first time, you get <strong>{you}%</strong> of it as credit and they get <strong>+{them}%</strong> extra.
            Up to ${r.terms.cap_usd} each, on top-ups of ${r.terms.min_usd}+.
          </p>
        </div>
      </div>

      <div className="inv-link">
        <code className="num">{r.link.replace(/^https?:\/\//, "")}</code>
        <button
          type="button"
          className="btn btn-violet btn-sm"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(r.link);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            } catch {}
          }}
        >
          {copied ? "Copied" : "Copy link"}
        </button>
        <a className="btn btn-ghost btn-sm" href={`https://x.com/intent/post?text=${encodeURIComponent(tweet)}`} target="_blank" rel="noreferrer">
          <XIcon size={13} /> Share
        </a>
      </div>

      <dl className="inv-stats">
        <div><dt className="label">Joined with your link</dt><dd className="num">{r.invited}</dd></div>
        <div><dt className="label">Topped up</dt><dd className="num">{r.converted}</dd></div>
        <div><dt className="label">You earned</dt><dd className="num">{fmtUsd(r.earned_micros)}</dd></div>
      </dl>
      {r.you_were_invited && !r.your_bonus_used && (
        <p className="inv-note">You were invited by a friend: your first top-up of ${r.terms.min_usd}+ gets +{them}% extra credit.</p>
      )}
    </section>
  );
}
