import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { applyTheme, currentTheme } from '../lib/theme';

/**
 * Dark / light mode switch. Rendered in the dashboard header and in the
 * browser toolbar — both entry points apply the theme via the shared CSS
 * variables, so the choice is consistent across the whole app.
 */
export default function ThemeToggle({ className = '' }) {
  const [theme, setTheme] = useState(currentTheme);

  useEffect(() => {
    const handler = (event) => setTheme(event.detail === 'light' ? 'light' : 'dark');
    window.addEventListener('tb:theme', handler);
    return () => window.removeEventListener('tb:theme', handler);
  }, []);

  const isLight = theme === 'light';
  const label = isLight ? 'تغییر به حالت تیره' : 'تغییر به حالت روشن';

  return (
    <button
      type="button"
      onClick={() => applyTheme(isLight ? 'dark' : 'light')}
      aria-label={label}
      aria-pressed={isLight}
      title={label}
      className={`flex items-center justify-center border border-tint-line bg-tint-fill text-slate-400
        transition hover:bg-tint-fill-2 hover:text-slate-100 active:scale-95 ${className}`}
    >
      {isLight ? <Moon size={17} strokeWidth={2} /> : <Sun size={17} strokeWidth={2} />}
    </button>
  );
}
