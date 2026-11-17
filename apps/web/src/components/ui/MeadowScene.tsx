import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Lightweight illustrated meadow backdrop for non-3D screens (login,
 * teacher/parent empty states). It is deliberately NOT the farm world: the
 * student farm is a real WebGL scene (src/three). This keeps the login screen
 * fast on slow school connections (no three.js download before sign-in).
 */
export function MeadowScene({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <div className={cn("relative isolate min-h-dvh overflow-hidden bg-gradient-to-b from-[#bfe8fb] via-sky-soft to-[#eaf8d8]", className)}>
      <svg aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[46vh] w-full" viewBox="0 0 1440 420" preserveAspectRatio="xMidYMax slice">
        <path d="M0 210 C 240 120 420 150 620 200 S 1040 120 1440 190 V420 H0Z" fill="#9BDB6F" />
        <path d="M0 270 C 300 200 560 250 820 270 S 1240 220 1440 260 V420 H0Z" fill="#6CC24A" />
        <path d="M0 340 C 360 300 700 340 1000 330 S 1300 310 1440 330 V420 H0Z" fill="#4FA83A" />
        {[180, 520, 980, 1290].map((x, i) => (
          <g key={x} transform={`translate(${x} ${235 + (i % 2) * 30})`}>
            <rect x="-5" y="0" width="10" height="34" rx="3" fill="#8B5A2B" />
            <circle cx="0" cy="-8" r="26" fill="#3E9A2A" />
            <circle cx="-10" cy="-16" r="10" fill="#58B83A" />
          </g>
        ))}
        {Array.from({ length: 14 }, (_, i) => (
          <g key={i} transform={`translate(${60 + i * 100} 372)`}>
            <rect x="-3" y="-26" width="6" height="30" rx="2" fill="#C08A55" />
            <rect x="-50" y="-20" width="100" height="5" rx="2" fill="#C08A55" />
            <rect x="-50" y="-9" width="100" height="5" rx="2" fill="#C08A55" />
          </g>
        ))}
      </svg>
      {children}
    </div>
  );
}
