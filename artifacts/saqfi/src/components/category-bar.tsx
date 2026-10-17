import type { Category } from '@workspace/api-client-react';
import { useLang } from '@/lib/i18n';
import { Money } from '@/components/shell';
import { cn } from '@/lib/utils';

/** Tone by spent ÷ cap: navy normal, amber ≥80%, red >100%. */
export const toneOf = (pct: number) => (pct > 100 ? 'bad' : pct >= 80 ? 'warn' : 'ok');

/**
 * Saqfi's signature: every bar ends at a gold "cap" line (the same line as the logo).
 * The fill grows toward it and never draws past it. Over the cap = red fill + red cap.
 * `reserved` draws a lighter segment after the spent part (committed salaries).
 * `onDark` = the version used inside the navy balance card.
 */
export function SpendBar({ cap, spent, reserved = 0, onDark = false, className }:
  { cap: number; spent: number; reserved?: number; onDark?: boolean; className?: string }) {
  const pct = cap > 0 ? (spent / cap) * 100 : spent > 0 ? 101 : 0;
  const rpct = cap > 0 ? Math.max(0, Math.min(100 - Math.min(100, pct), (reserved / cap) * 100)) : 0;
  const tone = toneOf(pct);
  const fill = tone === 'bad' ? 'bg-destructive' : tone === 'warn' ? 'bg-warning' : onDark ? 'bg-white' : 'bg-primary';
  return (
    <div className={cn('relative h-2.5', className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('absolute inset-0 rounded-full overflow-hidden flex', onDark ? 'bg-white/15' : 'bg-[hsl(var(--track))]')}>
        <div className={cn('h-full rounded-full transition-[width] duration-700 ease-out', fill)} style={{ width: `${Math.min(100, pct)}%` }} />
        {rpct > 0 && <div className={cn('h-full', onDark ? 'bg-white/35' : 'bg-primary/25')} style={{ width: `${rpct}%` }} />}
      </div>
      <span aria-hidden className={cn('absolute -top-1.5 -bottom-1.5 end-0 w-[3px] rounded-full', tone === 'bad' ? 'bg-destructive' : 'bg-cap')} />
    </div>
  );
}

export function CategoryRow({ c }: { c: Category }) {
  const { t } = useLang();
  const pct = c.cap > 0 ? (c.spent / c.cap) * 100 : 0;
  const tone = toneOf(pct);
  return (
    <div className="py-4" data-testid={`row-category-${c.id}`}>
      <div className="flex items-baseline justify-between gap-3 mb-2.5">
        <span className="font-semibold">{t(c.name, c.nameEn)}</span>
        <span className="text-[14px] text-muted-foreground whitespace-nowrap">
          <Money v={c.spent} unit={false} className={cn('font-display font-semibold text-[15px]', tone === 'bad' ? 'text-destructive' : tone === 'warn' ? 'text-warning' : 'text-foreground')} />
          {' '}{t('من', 'of')} <Money v={c.cap} />
        </span>
      </div>
      <SpendBar cap={c.cap} spent={c.spent} />
      <div className="mt-1.5 text-[13px] text-muted-foreground"><span className="num">{Math.round(pct)}%</span> {t('من سقف البند', 'of the category cap')}</div>
    </div>
  );
}
