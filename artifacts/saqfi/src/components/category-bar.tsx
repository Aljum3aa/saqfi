import type { Category } from '@workspace/api-client-react';
import { useLang } from '@/lib/i18n';
import { Money } from '@/components/shell';
import { cn } from '@/lib/utils';

export function StackBar({ cap, spent, committed, className }: { cap: number; spent: number; committed: number; className?: string }) {
  const p = (v: number) => (cap > 0 ? Math.min(100, (v / cap) * 100) : 0);
  const used = cap > 0 ? (spent + committed) / cap : 0;
  return (
    <div className={cn('h-2 rounded-full bg-muted overflow-hidden flex', className)}>
      <div className={cn('h-full transition-all duration-700', used >= 1 ? 'bg-destructive' : 'bg-primary')} style={{ width: `${p(spent)}%` }} />
      <div className="h-full stripes transition-all duration-700" style={{ width: `${Math.min(p(committed), 100 - p(spent))}%` }} />
    </div>
  );
}

export function Legend() {
  const { t } = useLang();
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-primary" />{t('مصروف فعلي', 'Spent')}</span>
      <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm stripes" />{t('محجوز لرواتب غير مدفوعة', 'Reserved, unpaid salaries')}</span>
      <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-sm bg-muted border border-border" />{t('متاح فعلاً', 'Truly available')}</span>
    </div>
  );
}

export function CategoryRow({ c }: { c: Category }) {
  const { t } = useLang();
  const pct = c.cap > 0 ? ((c.spent + c.committed) / c.cap) * 100 : 0;
  return (
    <div className="py-3" data-testid={`row-category-${c.id}`}>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <span className="font-medium text-sm">{t(c.name, c.nameEn)}</span>
        <span className={cn('num text-xs', pct >= 80 ? 'text-destructive' : 'text-muted-foreground')}>{pct.toFixed(1)}%</span>
      </div>
      <StackBar cap={c.cap} spent={c.spent} committed={c.committed} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 mt-2 text-[11px] text-muted-foreground">
        <span>{t('السقف', 'Cap')} <Money v={c.cap} unit={false} className="text-foreground" /></span>
        <span>{t('مصروف', 'Spent')} <Money v={c.spent} unit={false} className="text-foreground" /></span>
        <span>{t('محجوز', 'Reserved')} <Money v={c.committed} unit={false} className="text-foreground" /></span>
        <span>{t('متاح', 'Available')} <Money v={c.remaining} unit={false} className={c.remaining <= 0 ? 'text-destructive' : 'text-primary'} /></span>
      </div>
    </div>
  );
}
