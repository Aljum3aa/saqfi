import type { Category } from '@workspace/api-client-react';
import { useLang } from '@/lib/i18n';
import { Money } from '@/components/shell';
import { cn } from '@/lib/utils';

/** Tone by spent ÷ cap: navy normal, amber ≥80%, red >100%. */
export const toneOf = (pct: number) => (pct > 100 ? 'bad' : pct >= 80 ? 'warn' : 'ok');

export function SpendBar({ cap, spent, className }: { cap: number; spent: number; className?: string }) {
  const pct = cap > 0 ? (spent / cap) * 100 : spent > 0 ? 101 : 0;
  const tone = toneOf(pct);
  return (
    <div className={cn('h-2 rounded-full bg-muted overflow-hidden', className)} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn('h-full rounded-full transition-[width] duration-500', tone === 'bad' ? 'bg-destructive' : tone === 'warn' ? 'bg-warning' : 'bg-primary')}
        style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

export function CategoryRow({ c }: { c: Category }) {
  const { t } = useLang();
  const pct = c.cap > 0 ? (c.spent / c.cap) * 100 : 0;
  const tone = toneOf(pct);
  return (
    <div className="py-4" data-testid={`row-category-${c.id}`}>
      <div className="flex items-baseline justify-between gap-3 mb-2">
        <span className="font-semibold">{t(c.name, c.nameEn)}</span>
        <span className={cn('text-[15px]', tone === 'bad' ? 'text-destructive' : tone === 'warn' ? 'text-warning' : 'text-muted-foreground')}>
          <Money v={c.spent} unit={false} className="text-foreground" /> {t('من', 'of')} <Money v={c.cap} />
        </span>
      </div>
      <SpendBar cap={c.cap} spent={c.spent} />
    </div>
  );
}
