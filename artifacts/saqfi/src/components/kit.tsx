import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Shared visual kit for Saqfi pages: avatars, stat strip, chips, list rows. Presentation only. */

const AV_TONES = [
  'bg-[#E7ECF5] text-[#14284B]',
  'bg-[#F4ECD8] text-[#7A5A12]',
  'bg-[#E2F1EA] text-[#1F6B4F]',
  'bg-[#ECE8F6] text-[#4B3A8C]',
  'bg-[#F6E6E4] text-[#8C3A2E]',
];

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (/[؀-ۿ]/.test(parts[0])) {   /* Arabic: one letter reads cleaner than two isolated forms */
    const w = parts.find((p) => !/^(عبد|أبو|ابو|ال)$/.test(p)) ?? parts[0];
    return w.replace(/^ال/, '')[0] ?? '?';
  }
  const a = parts[0][0] ?? '';
  const b = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
  return (a + b).toUpperCase();
}

export function Avatar({ name, size = 40, className }: { name: string; size?: number; className?: string }) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span aria-hidden
      className={cn('inline-grid place-items-center rounded-full font-semibold shrink-0 select-none', AV_TONES[h % AV_TONES.length], className)}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}>
      {initials(name)}
    </span>
  );
}

/** A row of key figures in one card. Items stack on mobile, split with dividers on desktop. */
export function StatStrip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('panel grid grid-cols-2 md:flex md:divide-x md:rtl:divide-x-reverse divide-border overflow-hidden', className)}>
      {children}
    </div>
  );
}

export function Stat({ label, children, sub, tone }: { label: string; children: ReactNode; sub?: ReactNode; tone?: 'bad' | 'good' }) {
  return (
    <div className="flex-1 p-4 md:p-5 min-w-0">
      <div className="text-[13px] text-muted-foreground">{label}</div>
      <div className={cn('mt-1 font-display text-[20px] md:text-[24px] font-semibold tracking-tight truncate',
        tone === 'bad' && 'text-destructive', tone === 'good' && 'text-success')}>{children}</div>
      {sub && <div className="text-[12px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

export function Chip({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'navy' | 'gold' | 'good' | 'warn' | 'bad'; className?: string }) {
  const tones = {
    neutral: 'bg-muted text-muted-foreground',
    navy: 'bg-accent text-primary',
    gold: 'bg-cap/15 text-[hsl(42_60%_30%)]',
    good: 'bg-success/10 text-success',
    warn: 'bg-warning/12 text-warning',
    bad: 'bg-destructive/10 text-destructive',
  } as const;
  return <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-[12.5px] font-semibold whitespace-nowrap', tones[tone], className)}>{children}</span>;
}

/** Section title used inside pages. */
export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 mb-4">
      <h2 className="text-[19px] font-semibold">{children}</h2>
      {aside && <div className="text-[13px] text-muted-foreground">{aside}</div>}
    </div>
  );
}

/** Toolbar wrapper for search + filter, consistent across list pages. */
export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-col sm:flex-row gap-3 mb-4 [&_input]:rounded-full [&_input]:h-11 [&_button[role=combobox]]:rounded-full [&_button[role=combobox]]:h-11">{children}</div>;
}
