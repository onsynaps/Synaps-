"use client";
import { useEffect, useState } from "react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: BIPEvent | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((f) => f());

/** Registers the service worker and catches the browser's install prompt as early as possible. Mounted once in the root layout. */
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && location.protocol === "https:") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
    const onPrompt = (e: Event) => { e.preventDefault(); deferred = e as BIPEvent; emit(); };
    const onInstalled = () => { deferred = null; emit(); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  return null;
}

function useInstallState() {
  const [, force] = useState(0);
  const [env, setEnv] = useState<{ standalone: boolean; ios: boolean; iosSafari: boolean }>({ standalone: true, ios: false, iosSafari: false });
  useEffect(() => {
    const f = () => force((n) => n + 1);
    listeners.add(f);
    const ua = navigator.userAgent;
    const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    // in-app browsers (wallets, X, Telegram) can't install; only real Safari can on iOS
    const iosSafari = ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA|Instagram|FBAN|FBAV|Line|Twitter|Telegram|MetaMask|Trust|Coinbase|Rabby|Rainbow/i.test(ua);
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
    setEnv({ standalone, ios, iosSafari });
    return () => { listeners.delete(f); };
  }, []);
  return { canPrompt: Boolean(deferred), ...env };
}

/** "Install app" button: native prompt on Android/desktop Chrome, instructions on iOS Safari. Hidden when not possible or already installed. */
export function InstallButton({ className = "btn btn-ghost btn-sm" }: { className?: string }) {
  const { canPrompt, standalone, iosSafari } = useInstallState();
  const [help, setHelp] = useState(false);
  if (standalone || (!canPrompt && !iosSafari)) return null;

  return (
    <>
      <button
        type="button"
        className={className}
        onClick={async () => {
          if (deferred) {
            const d = deferred;
            await d.prompt();
            await d.userChoice.catch(() => null);
            deferred = null;
            emit();
          } else {
            setHelp(true);
          }
        }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true"><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>
        <span className="pwa-label">Install app</span>
      </button>
      {help && (
        <div className="pwa-sheet" role="dialog" aria-modal="true" aria-label="Install Synaps" onClick={() => setHelp(false)}>
          <div className="pwa-card panel" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icons/icon-192.png" alt="" width={56} height={56} style={{ borderRadius: 14 }} />
            <h2>Install Synaps</h2>
            <ol>
              <li>Tap the <strong>Share</strong> button <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ verticalAlign: -3 }}><path d="M12 3v13M7 8l5-5 5 5M5 12v8h14v-8" /></svg> in Safari.</li>
              <li>Choose <strong>Add to Home Screen</strong>.</li>
              <li>Tap <strong>Add</strong>. Synaps opens full screen like an app.</li>
            </ol>
            <button className="btn btn-violet" onClick={() => setHelp(false)}>Got it</button>
          </div>
        </div>
      )}
    </>
  );
}
