import { BASE, Callout, Code, DocTitle, Pager } from "@/components/docs/kit";

export const metadata = { title: "Authentication" };

export default function Auth() {
  return (
    <article>
      <DocTitle eyebrow="Getting started" title={<>Authentication</>} lede="The API uses secret keys. The app uses your wallet. Both spend the same balance." />

      <h2>API keys</h2>
      <p>Send your key on every request, in either header:</p>
      <Code lang="http" code={`Authorization: Bearer syn_your_key_here`} />
      <Code lang="http" code={`x-api-key: syn_your_key_here`} />
      <p>Requests without a valid, active key get <code>401</code>:</p>
      <Code lang="json" code={`{ "error": { "message": "Missing or invalid API key. Send it as: Authorization: Bearer syn_..." } }`} />

      <h2>Creating and managing keys</h2>
      <ul>
        <li>Create keys on <a href="/app/keys">API keys</a> after connecting your wallet. You can hold up to <strong>10 active keys</strong>.</li>
        <li>The full key is shown <strong>once</strong>. Synaps stores only a one-way hash and the first characters, so a lost key cannot be recovered; create a new one.</li>
        <li><strong>Daily limit (optional):</strong> a USD cap per key per UTC day. When the key&apos;s spending for the day reaches it, further paid requests return <code>429</code> until midnight UTC.</li>
        <li><strong>Revoke</strong> a key at any time. It stops working on the next request.</li>
      </ul>

      <Callout kind="warn" title="Keep keys server-side">Anyone with your key can spend your balance. Never put it in browser code, mobile apps, or public repositories. Store it in an environment variable and call Synaps from your server.</Callout>

      <h2>Wallet sign-in (app)</h2>
      <p>The web app signs you in with a message signature, not a password:</p>
      <ol>
        <li>Your wallet shares its address.</li>
        <li>Synaps creates a one-time nonce that expires after 10 minutes.</li>
        <li>You sign a readable message containing your address and that nonce. No gas, no transaction, no approvals.</li>
        <li>Synaps verifies the signature and sets a secure, HTTP-only session cookie valid for 7 days.</li>
      </ol>
      <p>Sign-in currently supports standard wallets (EOAs) through an injected provider such as MetaMask, Rabby or Coinbase Wallet, including their in-app browsers on mobile.</p>

      <h2>Checking a key</h2>
      <p>Send a one-token request. A <code>200</code> means the key is valid; <code>401</code> means it is wrong or revoked; <code>402</code> means the key works but the balance is too low for a paid model.</p>
      <Code lang="bash" code={`curl ${BASE}/chat/completions \\
  -H "Authorization: Bearer $SYNAPS_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"deepseek/deepseek-chat","max_tokens":1,"messages":[{"role":"user","content":"hi"}]}'`} />
      <p><code>GET /models</code> is public and does not check the key.</p>

      <Pager prev={{ href: "/docs/quickstart", label: "Quickstart" }} next={{ href: "/docs/chat-completions", label: "Chat completions" }} />
    </article>
  );
}
