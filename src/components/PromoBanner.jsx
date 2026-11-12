
import { useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';

/**
 * Floating Technowin promotional banner.
 *
 * Behaviour:
 * - First appearance: 1 second after mount.
 * - Repeats every 20 seconds.
 * - Each animation lasts 16 seconds.
 * - Banner is removed after animation ends.
 * - All timers are cleaned up on unmount.
 * - Social icons open their respective links.
 */

const TRAVEL_MS = 16000;
const FIRST_DELAY_MS = 1000;
const INTERVAL_MS = 10 * 60 * 1000;

const BRAND_ICONS = [
  {
    id: 1,
    name: 'Instagram',
    url: 'https://www.instagram.com/technowin01/',
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
    url: 'https://www.instagram.com/technowin01/',
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
    url: 'https://www.instagram.com/technowin01/',
    chip: 'bg-[#229ed9]',
    glyph: (
      <>
        <circle cx="12" cy="12" r="9.2" fill="none" stroke="currentColor" strokeWidth="1.9" />
        <path d="M15.6 8.4l-2.1 7.2-2.3-3-3.15-2.65 7.55-1.55Z" fill="currentColor" />
      </>
    ),
  },
];

export default function PromoBanner() {
  const [runId, setRunId] = useState(null);

  useEffect(() => {
    let interval = null;

    // First appearance after 1 second
    const first = window.setTimeout(() => {
      setRunId(Date.now());

      // Repeat every 20 seconds after the first appearance
      interval = window.setInterval(() => {
        setRunId(Date.now());
      }, INTERVAL_MS);
    }, FIRST_DELAY_MS);

    return () => {
      window.clearTimeout(first);

      if (interval !== null) {
        window.clearInterval(interval);
      }
    };
  }, []);

  // Hide the banner when it is not active
  if (runId === null) return null;

  return (
    <div className="promo-banner">
      <div
        key={runId}
        className="promo-banner__track"
        onAnimationEnd={() => setRunId(null)}
      >
        <div className="promo-banner__card">

          {/* Animated shine effect */}
          <span
            className="promo-banner__shine"
            aria-hidden="true"
          />

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
                <Sparkles size={9} />
                Official
              </span>

            </span>

            <span className="mt-0.5 text-[11.5px] font-bold leading-5 text-slate-100">
              TechnoWin رو توی شبکه‌های اجتماعی دنبال کن
            </span>
          </span>

          <span className="mx-1 h-8 w-px bg-gradient-to-b from-transparent via-[rgba(148,197,255,0.45)] to-transparent" />

          <span className="flex items-center gap-1.5">
         {BRAND_ICONS.map(({ id, name, chip, glyph }) => (
            <div
              key={id}
               onClick={() => {
                window.nativeBridge.openExternal(
                  'https://www.instagram.com/technowin01/'
                );
              }}
              title={name}
              role="link"
              tabIndex={0}
              className={`grid h-8 w-8 cursor-pointer place-items-center rounded-lg transition-all duration-200 hover:scale-110 hover:brightness-125 ${chip}`}
            >
              <svg viewBox="0 0 24 24" width="17" height="17" fill="none">
                {glyph}
              </svg>
            </div>
          ))}
          </span>

        </div>
      </div>
    </div>
  );
}
