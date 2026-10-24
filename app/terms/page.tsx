import { LegalPage } from "@/components/LegalPage";

export const metadata = { title: "Terms" };

export default function Terms() {
  return (
    <LegalPage title="Terms of Service" updated="October 2026">
      <p>These terms cover your use of Synaps: the website, the chat app and the API. By connecting a wallet, topping up, or calling the API, you agree to them.</p>

      <h2>What Synaps is</h2>
      <p>Synaps gives you access to AI models made by other companies (for example Anthropic, OpenAI, Google and DeepSeek) through one account tied to your wallet. Models are reached through third-party routing providers. Synaps does not make the models and cannot guarantee that any model stays available, keeps its price, or gives correct answers.</p>

      <h2>Your account</h2>
      <ul>
        <li>Your wallet is your account. Whoever controls the wallet controls the balance and the API keys.</li>
        <li>You must be at least 18 years old, or the age of majority where you live.</li>
        <li>Keep your API keys secret. Usage on a key is billed to your balance, even if someone else used it.</li>
      </ul>

      <h2>Balance and payments</h2>
      <ul>
        <li>Top-ups are sent on-chain to the Synaps treasury and credited as a USD balance at the price at the time of verification.</li>
        <li>Your balance is prepaid credit for using Synaps. It is not a deposit, it earns nothing, and it cannot be withdrawn or transferred.</li>
        <li>Each request is billed at the provider&apos;s cost plus the Synaps fee shown on the Models page. Prices can change; the price shown when you send applies.</li>
        <li>On-chain payments cannot be reversed. Sending to the wrong address or network cannot be recovered by us.</li>
        <li>Unused balance is not refunded, except where the law requires it or at our discretion for clear errors on our side.</li>
      </ul>

      <h2>The $SYNAPS token</h2>
      <p>$SYNAPS, once launched, is a utility token for use within Synaps. It is not an investment, carries no ownership or profit rights, and nothing on this site is financial advice. Token prices can go to zero.</p>

      <h2>Acceptable use</h2>
      <p>Do not use Synaps to break the law, to harm others, to create malware or weapons, to sexualize minors, to harass people, or to get around the usage policies of the model providers. We may suspend wallets or keys that do, and the providers&apos; own policies also apply to your requests.</p>

      <h2>Outputs</h2>
      <p>AI output can be wrong, outdated or offensive. Check anything important before you rely on it. You are responsible for how you use what the models produce.</p>

      <h2>Availability and changes</h2>
      <p>Synaps is provided as-is, without warranties. We can change features, prices or these terms; the date at the top shows the latest version. To the extent the law allows, our total liability is limited to the balance you topped up in the 30 days before a claim.</p>

      <h2>Contact</h2>
      <p>Questions or problems with a top-up: message <a href="https://x.com/onsynaps" target="_blank" rel="noreferrer">@onsynaps</a> on X and include your transaction hash.</p>
    </LegalPage>
  );
}
