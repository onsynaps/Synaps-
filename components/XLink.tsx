import { X_URL, X_HANDLE } from "@/lib/site";

export function XIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.75 3h3.07l-6.71 7.67L22 21h-6.18l-4.84-6.33L5.44 21H2.37l7.18-8.2L2 3h6.33l4.38 5.79L17.75 3Zm-1.08 16.2h1.7L7.4 4.72H5.58l11.09 14.48Z" />
    </svg>
  );
}

/** Round icon button linking to the Synaps X account. */
export function XButton({ className = "" }: { className?: string }) {
  return (
    <a className={"x-btn " + className} href={X_URL} target="_blank" rel="noreferrer" aria-label={`Synaps on X (${X_HANDLE})`} title={X_HANDLE}>
      <XIcon />
    </a>
  );
}
