import { Callout, DocTitle, Pager, TREASURY } from "@/components/docs/kit";
import { USDC_BASE } from "@/lib/chains";

export const metadata = { title: "Top-ups" };

export default function TopUps() {
  return (
    <article>
      <DocTitle eyebrow="Account" title={<>Top-ups</>} lede="Add balance by sending crypto from your connected wallet. Synaps checks the transaction on-chain and credits USD." />

      <h2>Supported assets</h2>
      <div className="dc-table">
        <table>
          <thead><tr><th>Asset</th><th>Network</th><th>Chain ID</th><th>Credited as</th></tr></thead>
          <tbody>
            <tr><td>ETH</td><td>Robinhood Chain</td><td><code>4663</code></td><td>USD at the ETH spot price when verified</td></tr>
            <tr><td>ETH</td><td>Base</td><td><code>8453</code></td><td>USD at the ETH spot price when verified</td></tr>
            <tr><td>USDC</td><td>Base</td><td><code>8453</code></td><td>1 USDC = $1.00</td></tr>
          </tbody>
        </table>
      </div>
      <p>USDC on Base is the native contract <code style={{ wordBreak: "break-all" }}>{USDC_BASE}</code>. Bridged or other USDC tokens are not recognised.</p>

      <h2>Step by step</h2>
      <ol>
        <li>Open <a href="/app/wallet">Wallet</a> and connect the wallet you want to fund.</li>
        <li>Choose the asset and amount. The app shows the USD credit you will receive.</li>
        <li>Press <strong>Pay in wallet</strong>. Your wallet switches to the right network (adding Robinhood Chain if needed) and asks you to confirm the payment to the Synaps treasury.</li>
        <li>Synaps waits for one confirmation, verifies the transaction, and credits your balance. This usually takes a few seconds.</li>
        <li>If the network is slow, press <strong>Check again</strong>. Your payment is safe in the meantime.</li>
      </ol>

      <h2>Rules that protect your funds</h2>
      <ul>
        <li>The payment must come <strong>from the same wallet</strong> you are signed in with. Transfers from another address are not credited to you.</li>
        <li>It must go <strong>to the Synaps treasury</strong>{TREASURY ? <> (<code style={{ wordBreak: "break-all" }}>{TREASURY}</code>)</> : null} on a supported network.</li>
        <li>Each transaction is credited <strong>exactly once</strong>. Submitting the same hash again does nothing.</li>
        <li>The smallest credit is <strong>$0.50</strong>; the app starts at $1.</li>
        <li>Failed or reverted transactions are never credited.</li>
      </ul>

      <h2>How ETH is converted</h2>
      <p>ETH is converted to USD using the ETH/USD spot price at the moment Synaps verifies your transaction, so the credit can differ slightly from the estimate you saw if the price moves. USDC is credited one-to-one with no conversion.</p>

      <Callout kind="warn" title="Double-check the network">On-chain payments cannot be reversed. Sending a token Synaps does not support, or sending on the wrong network, cannot be recovered. Always top up from the Wallet page rather than sending by hand.</Callout>

      <h2>Paying with $SYNAPS</h2>
      <p>
        Once $SYNAPS is live, a <strong>$SYNAPS</strong> option appears on the Wallet page. Topping up with it gives you bonus credit on top of the value of the tokens you send. The current bonus is shown next to the option.
      </p>
      <ul>
        <li><strong>Network:</strong> Robinhood Chain. The token is launched on Pons from the Synaps treasury wallet, and its contract is shown on the homepage and at <code>/api/token</code>.</li>
        <li><strong>Price:</strong> taken from the token&apos;s Pons pool when your top-up is verified. Synaps uses the lower of the current price and the 5-minute average, so short price spikes don&apos;t change what you get.</li>
        <li><strong>Bonus:</strong> a percentage of the top-up value, applied up to a cap per top-up. Both are shown on the Wallet page before you pay.</li>
      </ul>
      <Callout kind="note" title="Only the official contract counts">Tokens sent from any other contract, even one called SYNAPS, are not credited and cannot be returned.</Callout>

      <Pager prev={{ href: "/docs/billing", label: "Billing & pricing" }} next={{ href: "/docs/rate-limits", label: "Rate limits" }} />
    </article>
  );
}
