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
  { q: "Do you store my chats?", a: <>Only if you want them synced. When you are signed in with sync on (the default), the text of your chats is saved to your wallet so it appears on your other devices; only you can read it. Turn sync off in the chat&apos;s Instructions &amp; settings to keep chats in your browser only. API requests are never stored. See <a href="/docs/privacy">Privacy lanes</a>.</> },
  { q: "Can the chat search the web?", a: <>Yes. Turn on <strong>Web</strong> next to the message box. The model reads current web results and lists its sources under the reply. Web search works with paid models and adds about $0.02 per message.</> },
  { q: "Can I set default instructions?", a: <>Yes. Open <strong>Instructions &amp; settings</strong> in the chat header and write how you want every reply, like your language or tone. They follow your wallet across devices.</> },
  { q: "How do I share a chat?", a: <>Press the Share button in the chat header to get a read-only link. Anyone with it can read the conversation as it was when you shared it. Press <strong>Stop sharing</strong> to remove it.</> },
  { q: "Can I send photos, PDFs and documents?", a: <>Yes. In the chat, press <strong>Attach</strong>, paste, or drag files in: up to 4 per message. PDFs and text or code files work with every model. Photos need a model that can see images; if the one you picked can&apos;t, Synaps warns you when you send and offers a model that can.</> },
  { q: "Can Synaps create images?", a: <>Yes. Switch on <strong>Image</strong> next to the message box and describe what you want. Image models are listed under <em>Image generation</em>. Generated images aren&apos;t kept in your chat history, so download the ones you want to keep.</> },
  { q: "Is there a referral program?", a: <>Yes. Open the Wallet page to find your invite link. When a friend tops up for the first time, you get 10% of it as credit and they get 5% extra. See <a href="/docs/top-ups">Top-ups</a>.</> },
  { q: "Why did I run out of free messages early?", a: <>The daily free allowance is shared by your browser and your network, so other people on the same Wi-Fi count too. There is also a daily total for all free traffic. Connect a wallet to keep going with paid models.</> },
  { q: "Why did a model reply differently from its official app?", a: <>Official apps add their own system prompts, tools and settings. Through the API you get the raw model, shaped only by the messages and parameters you send.</> },
  { q: "A model disappeared from the list.", a: <>Providers retire and rename models. The list updates automatically every few minutes; switch to the newest version of that model.</> },
  { q: "Is there an Anthropic-format endpoint?", a: <>Not yet. Synaps currently speaks the OpenAI Chat Completions format, which covers Claude models too.</> },
  { q: "What is $SYNAPS?", a: <>A utility token on Pons that will give bonus credit when you top up with it. It will be launched from the Synaps treasury wallet, and the contract appears on the homepage (and at <code>/api/token</code>) automatically as soon as that happens, so anyone can verify it on-chain. Any address posted anywhere else is not ours. Updates on <a href="https://x.com/onsynaps" target="_blank" rel="noreferrer">@onsynaps</a>.</> },
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
