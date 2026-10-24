import { LegalPage } from "@/components/LegalPage";

export const metadata = { title: "Privacy" };

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy" updated="October 2026">
      <p>Synaps is built to know as little about you as it can while still billing you correctly. This page says what we keep and what we do not.</p>

      <h2>What we store</h2>
      <ul>
        <li><strong>Your wallet address</strong> and your USD balance.</li>
        <li><strong>Top-ups:</strong> transaction hash, network, asset and credited amount.</li>
        <li><strong>Usage records:</strong> time, model, token counts and the amount charged for each request. Not the content.</li>
        <li><strong>API keys:</strong> a one-way hash, a short prefix, the name you gave it and its limit. We cannot see the full key after you create it.</li>
        <li><strong>Rate-limit counters</strong> keyed by wallet, key, IP address or a random browser id, kept only to stop abuse.</li>
        <li><strong>Synced chat history</strong>, if you are signed in and sync is on (it is on by default; turn it off in the chat&apos;s Instructions &amp; settings). We keep the text of your chats, model names and attachment file names so they appear on your other devices. File contents and generated images are never stored. Only your wallet can read them.</li>
        <li><strong>Custom instructions</strong> you save, so they apply on every device.</li>
        <li><strong>Shared chats:</strong> when you press Share, a read-only copy of that chat is stored and anyone with the link can read it, until you choose Stop sharing.</li>
        <li><strong>Referrals:</strong> which wallet invited yours and the bonus paid.</li>
      </ul>

      <h2>What we do not store</h2>
      <ul>
        <li>Prompts and replies from signed-out use, or with sync turned off. They pass through our server to the model and are not saved by Synaps.</li>
        <li>The contents of files you attach, and images you generate.</li>
        <li>Email, name or phone number. We never ask for them.</li>
      </ul>

      <h2>Who else sees your prompts</h2>
      <p>To answer you, a prompt is sent to a routing provider and then to the company that runs the model. Every model in Synaps carries a label:</p>
      <ul>
        <li><strong>Free:</strong> the provider may log prompts to offer the model at no cost.</li>
        <li><strong>No training:</strong> routed only to providers that do not store or train on prompts.</li>
        <li><strong>Provider:</strong> the model&apos;s maker (for example Anthropic, OpenAI or Google) handles it under their own policy.</li>
      </ul>
      <p>Do not send passwords, private keys, seed phrases or other secrets to any model.</p>

      <h2>Public by design</h2>
      <p>Top-ups are blockchain transactions. Anyone can see them on a block explorer, including the link between your wallet and the Synaps treasury.</p>

      <h2>Cookies and tracking</h2>
      <p>We set one cookie to keep you signed in. We use Vercel Web Analytics to count page views and see which pages are popular. It sets no cookies, does not track you across sites, and only collects anonymous, aggregated data such as page path, referrer, country and device type. It never sees your chats or prompts. There are no ads and no third-party pixels.</p>

      <h2>Your choices</h2>
      <p>Delete a chat in the app to remove it from this browser and from sync. Turn sync off to keep new chats only in your browser. Stop sharing removes a shared link. To have your wallet&apos;s usage records deleted, message <a href="https://x.com/onsynaps" target="_blank" rel="noreferrer">@onsynaps</a> on X from a context where you can prove the wallet is yours.</p>
    </LegalPage>
  );
}
