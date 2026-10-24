import { DocTitle, Pager, MARKUP_PCT, FREE_DAILY } from "@/components/docs/kit";

export const metadata = { title: "FAQ" };

const QA: { q: string; a: React.ReactNode }[] = [
  { q: "Do I need a subscription?", a: <>No. You top up once and pay per request. There is no monthly fee and no minimum spend.</> },
  { q: "How much does Synaps charge on top of the model price?", a: <>A flat {MARKUP_PCT}% of the provider&apos;s cost for each request. Prices shown in the app already include it. See <a href="/docs/billing">Billing</a>.</> },
  { q: "Can I try it without paying?", a: <>Yes. Free models work in the chat without a wallet, up to {FREE_DAILY} messages a day, and through the API with a key.</> },
  { q: "Which wallets work?", a: <>MetaMask, Rabby, Coinbase Wallet, Rainbow and other browser wallets, plus any mobile wallet through WalletConnect. On a phone you can stay in Safari or Chrome and approve in your wallet app.</> },
  { q: "Which networks can I top up on?", a: <>ETH on Robinhood Chain, ETH on Base, and USDC on Base. See <a href="/docs/top-ups">Top-ups</a>.</> },
  { q: "My top-up is not showing.", a: <>Wait for the transaction to confirm, then press <strong>Check again</strong> on the Wallet page. Make sure it was sent from the wallet you are signed in with, to the Synaps treasury, on a supported network. If it still does not appear, message us with the transaction hash.</> },
  { q: "Can I withdraw my balance?", a: <>No. The balance is prepaid credit for using Synaps and cannot be withdrawn or transferred.</> },
  { q: "Do you store my chats?", a: <>No. Prompts and replies are not saved on our servers, and chat history is kept only in your browser. We store usage records (model, tokens, cost) for billing. See <a href="/docs/privacy">Privacy lanes</a>.</> },
  { q: "Why did a model reply differently from its official app?", a: <>Official apps add their own system prompts, tools and settings. Through the API you get the raw model, shaped only by the messages and parameters you send.</> },
  { q: "A model disappeared from the list.", a: <>Providers retire and rename models. The list updates automatically every few minutes; switch to the newest version of that model.</> },
  { q: "Is there an Anthropic-format endpoint?", a: <>Not yet. Synaps currently speaks the OpenAI Chat Completions format, which covers Claude models too.</> },
  { q: "What is $SYNAPS?", a: <>A planned utility token on Pons that will give bonus credit when you top up with it. It is not live yet; the contract will be announced on the site and on <a href="https://x.com/onsynaps" target="_blank" rel="noreferrer">@onsynaps</a>.</> },
  { q: "How do I get help?", a: <>Message <a href="https://x.com/onsynaps" target="_blank" rel="noreferrer">@onsynaps</a> on X. For payment issues, include the transaction hash and network.</> },
];

export default function Faq() {
  return (
    <article>
      <DocTitle eyebrow="Guides" title={<>Frequently <span className="serif">asked.</span></>} />
      {QA.map(({ q, a }) => (
        <section key={q}>
          <h3>{q}</h3>
          <p>{a}</p>
        </section>
      ))}
      <Pager prev={{ href: "/docs/integrations", label: "Integrations" }} />
    </article>
  );
}
