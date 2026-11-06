export default function Footer({ info }) {
  return (
    <footer className="relative z-10 flex h-8 shrink-0 items-center justify-center gap-2 border-t border-tint-line bg-ink-850 text-[10.5px] text-slate-400">
      <span>TechnoBrowse نسخهٔ {info?.version ?? '۱.۰.۰'}</span>
      <span className="text-slate-600">•</span>
      <span>تمام داده‌ها روی همین رایانه ذخیره می‌شود</span>
      <span className="text-slate-600">•</span>
      <span>ورود به سایت‌ها داخل Chrome خودتان انجام می‌شود</span>
    </footer>
  );
}
