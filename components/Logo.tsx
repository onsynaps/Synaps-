"use client";
import { useEffect, useId, useRef } from "react";

const E = "M7 32 a25 9.5 0 1 0 50 0 a25 9.5 0 1 0 -50 0";

/** Animated Orbit mark. Tilts with scroll speed when the page dispatches `synaps:velocity`. */
export function OrbitMark({ size = 34 }: { size?: number }) {
  const id = useId().replace(/:/g, "");
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const svg = ref.current;
    if (!svg) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      (svg as any).pauseAnimations?.();
      return;
    }
    const groups = Array.from(svg.querySelectorAll<SVGGElement>(".orb-tilt"));
    let t: ReturnType<typeof setTimeout> | undefined;
    const onVel = (e: Event) => {
      const v = Math.max(-60, Math.min(60, ((e as CustomEvent).detail as number) * 2.2));
      groups.forEach((g) => (g.style.transform = `rotate(${v}deg)`));
      clearTimeout(t);
      t = setTimeout(() => groups.forEach((g) => (g.style.transform = "rotate(0deg)")), 140);
    };
    window.addEventListener("synaps:velocity", onVel);
    return () => {
      window.removeEventListener("synaps:velocity", onVel);
      clearTimeout(t);
    };
  }, []);

  return (
    <svg ref={ref} className="orb" width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <defs>
        <radialGradient id={`h${id}`}>
          <stop offset="0" stopColor="#FFFFFF" stopOpacity=".9" />
          <stop offset=".35" stopColor="#A594FF" stopOpacity=".55" />
          <stop offset="1" stopColor="#A594FF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle className="orb-halo" cx="32" cy="32" r="15" fill={`url(#h${id})`} />
      <g className="orb-tilt">
        <g transform="rotate(32 32 32)">
          <path className="orb-ring2" pathLength={1} d={E} stroke="#A594FF" strokeOpacity=".38" strokeWidth="2" />
          <circle r="2.4" fill="#C9C0FF">
            <animateMotion dur="9s" repeatCount="indefinite" keyPoints="1;0" keyTimes="0;1" calcMode="linear" path={E} />
          </circle>
        </g>
        <g transform="rotate(-28 32 32)">
          <path className="orb-ring" pathLength={1} d={E} stroke="#A594FF" strokeWidth="2.8" />
        </g>
      </g>
      <circle className="orb-core" cx="32" cy="32" r="6" fill="#FFFFFF" />
      <g className="orb-tilt">
        <g transform="rotate(-28 32 32)">
          <circle r="3.8" fill="#6FE3F0">
            <animateMotion dur="5s" repeatCount="indefinite" path={E} />
          </circle>
        </g>
      </g>
    </svg>
  );
}

export function Brand({ size = 34, href = "/" }: { size?: number; href?: string }) {
  return (
    <a className="brand" href={href} aria-label="Synaps home">
      <OrbitMark size={size} />
      <span className="brand-word">synaps</span>
    </a>
  );
}
