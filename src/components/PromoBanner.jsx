import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

/**
 * Floating Technowin promotional banner.
 *
 * Behaviour contract:
 *  - appears automatically, every 5 minutes, for TRAVEL_MS per sweep;
 *  - crosses the entire window horizontally (right → left), then unmounts
 *    completely until the next interval;
 *  - position: fixed + pointer-events: none → zero impact on layout,
 *    scrolling or any interaction underneath;
 *  - pure CSS animation (compositor-only transform) — no JS animation frames;
 *  - all timers are cleaned up on unmount; the hide is driven by
 *    `animationend`, so the node is removed exactly when the sweep ends.
 */

const TRAVEL_MS = 16000; // one full crossing
const FIRST_DELAY_MS = 100; // short delay after launch, then the 5-minute cadence
const INTERVAL_MS = 10;

const BRAND_ICONS = [
  {
    id: 1,
    name: 'Instagram',
    chip: 'bg-gradient-to-br from-[#feda77] via-[#d62976] to-[#962fbf]',
    glyph: (
      <>
        <rect x="3" y="3" width="18" height="18" rx="5.25" fill="none" stroke="currentColor" strokeWidth="1.9" />
        <circle cx="12" cy="12" r="4.1" fill="none" stroke="currentColor" strokeWidth="1.9" />
        <circle cx="17.4" cy="6.6" r="1.35" fill="currentColor" />
      </>
    ),
  },
  {
    id: 2,
    name: 'YouTube',
    chip: 'bg-[#ff0033]',
    glyph: (
      <>
        <rect x="2.5" y="6.25" width="19" height="11.5" rx="3.3" fill="none" stroke="currentColor" strokeWidth="1.9" />
        <path d="M10.4 9.9v4.2c0 .5.55.8.97.52l3.4-2.1a.62.62 0 0 0 0-1.04l-3.4-2.1a.62.62 0 0 0-.97.52Z" fill="currentColor" />
      </>
    ),
  },
  {
    id: 3,
    name: 'Telegram',
    chip: 'bg-[#229ed9]',
    glyph: (
      <>
        <circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" strokeWidth="1.9" />
        <path d="M15.6 8.4l-2.1 7.2-2.3-3-3.15-2.65 7.55-1.55Z" fill="currentColor" />
      </>
    ),
  },
  {
    id: 4,
    name: 'X',
    chip: 'bg-slate-950',
    glyph: <path d="M4.5 4.5h4.35l4.9 6.75L19.6 4.5h2.4l-7.1 8.35 7.35 6.65h-4.35l-5.1-7-8.2 7H2.65l7.45-8.75L4.5 4.5Z" fill="currentColor" />,
  },
];

export default function PromoBanner() {
  const [runId, setRunId] = useState(null);

  useEffect(() => {
    const first = window.setTimeout(() => setRunId(Date.now()), FIRST_DELAY_MS);
    const interval = window.setInterval(() => setRunId(Date.now()), INTERVAL_MS);

    return () => {
      window.clearTimeout(first);
      window.clearInterval(interval);
    };
  }, []);

  if (runId === null) return null;

  return (
    <div className="promo-banner" aria-hidden="true">
      <div key={runId} className="promo-banner__track" onAnimationEnd={() => setRunId(null)}>
        <div className="promo-banner__card">
          {/* شیمر متحرک روی کارت */}
          <span className="promo-banner__shine" aria-hidden="true" />

          <img
            src="./technowin.png"
            alt=""
            draggable={false}
            className="h-10 w-10 select-none rounded-xl shadow-[0_4px_14px_rgba(37,99,235,0.45)]"
          />

          <span className="flex min-w-0 flex-col leading-tight">
            <span className="flex items-center gap-1.5">
              <span className="bg-gradient-to-l from-accent-400 via-sky-300 to-accent-500 bg-clip-text text-[15px] font-black tracking-wide text-transparent">
                Technowin
              </span>
              <span className="flex items-center gap-1 rounded-full border border-[rgba(125,211,252,0.35)] bg-[rgba(56,189,248,0.12)] px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-[0.14em] text-sky-300">
                <Sparkles size={9} /> Official
              </span>
            </span>

            <span className="mt-0.5 text-[11.5px] font-bold leading-5 text-slate-100">
              TechnoWin رو توی شبکه‌های اجتماعی دنبال کن
            </span>
          </span>

          <span className="mx-1 h-8 w-px bg-gradient-to-b from-transparent via-[rgba(148,197,255,0.45)] to-transparent" />

          <span className="flex items-center gap-1.5">
            {BRAND_ICONS.map(({ id, name, chip, glyph }) => (
              <span
                key={id}
                title={name}
                className={`grid h-8 w-8 place-items-center rounded-lg border border-white/15 text-white shadow-[0_2px_10px_rgba(0,0,0,0.35)] ring-1 ring-inset ring-white/10 ${chip}`}
              >
                <svg viewBox="0 0 24 24" width="17" height="17" role="img" aria-label={name} fill="none">
                  {glyph}
                </svg>
              </span>
            ))}
          </span>
        </div>
      </div>
    </div>
  );
}