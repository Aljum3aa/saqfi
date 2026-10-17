import { type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { LogOut, Languages } from 'lucide-react';
import {
  useLogout, getGetSessionQueryKey, getGetClubStateQueryKey, useGetClubState, type Session, type ClubState,
} from '@workspace/api-client-react';
import { useLang } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

export function Mark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
      <rect x="1" y="1" width="38" height="38" rx="9" fill="hsl(222 50% 10%)" stroke="hsl(42 72% 56%)" strokeWidth="1.5" />
      <path d="M8 14 H32" stroke="hsl(42 72% 56%)" strokeWidth="2.5" strokeLinecap="round" />
      <rect x="10" y="22" width="4" height="10" rx="1" fill="hsl(42 40% 70%)" />
      <rect x="18" y="18" width="4" height="14" rx="1" fill="hsl(42 60% 64%)" />
      <rect x="26" y="25" width="4" height="7" rx="1" fill="hsl(42 40% 70%)" />
    </svg>
  );
}

export function LangToggle({ className }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <button
      data-testid="button-lang"
      onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
      className={cn('inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs hover:border-primary/60 hover:text-primary transition-colors', className)}
    >
      <Languages className="h-3.5 w-3.5" />
      {lang === 'ar' ? 'English' : 'العربية'}
    </button>
  );
}

export function useClub() {
  return useGetClubState({ query: { queryKey: getGetClubStateQueryKey(), refetchInterval: 30000, refetchOnWindowFocus: true } });
}

const NAV = [
  { href: '/dashboard', ar: 'النظرة العامة', en: 'Overview' },
  { href: '/budget', ar: 'الميزانية', en: 'Budget' },
  { href: '/contracts', ar: 'العقود', en: 'Contracts' },
  { href: '/payroll', ar: 'الرواتب', en: 'Payroll' },
  { href: '/transactions', ar: 'السجل المالي', en: 'Ledger' },
];

const roleLabel = (r: string, t: (a: string, e: string) => string) =>
  r === 'manager' ? t('المدير المالي', 'Finance manager') : r === 'president' ? t('رئيس النادي', 'Club president') : t('لاعب', 'Player');

export function Shell({ session, children }: { session: Session; children: ReactNode }) {
  const { t } = useLang();
  const { toast } = useToast();
  const [loc, setLoc] = useLocation();
  const qc = useQueryClient();
  const club = useClub();
  const logout = useLogout({
    mutation: {
      onSuccess: () => {
        qc.removeQueries({ queryKey: getGetClubStateQueryKey() });
        qc.setQueryData(getGetSessionQueryKey(), { authenticated: false, role: '', name: '', demo: false });
        qc.invalidateQueries({ queryKey: getGetSessionQueryKey() });
        setLoc('/');
      },
      onError: () => toast({ variant: 'destructive', title: t('تعذر تسجيل الخروج؛ أعد المحاولة', 'Sign-out failed. Please retry.') }),
    },
  });
  const isPlayer = session.role === 'player';
  const s = club.data as ClubState | undefined;
  const active = (h: string) => loc === h || (h === '/dashboard' && loc === '/');

  return (
    <div className="min-h-[100dvh] flex flex-col">
      <header className="sticky top-0 z-40 border-b border-border bg-[hsl(var(--sidebar)/.85)] backdrop-blur">
        <div className="mx-auto max-w-[1400px] px-4 md:px-6 h-14 flex items-center gap-4">
          <Link href="/dashboard" className="flex items-center gap-2.5 shrink-0" data-testid="link-home">
            <Mark size={30} />
            <div className="leading-tight">
              <div className="font-bold text-[15px]">{t('سقفي', 'Saqfi')}</div>
              <div className="text-[10px] text-muted-foreground hidden sm:block">{s ? t(s.club, s.clubEn) : t('ولا دينار فوق السقف', 'Not one dinar over the cap')}</div>
            </div>
          </Link>
          {!isPlayer && (
            <nav className="hidden md:flex items-center gap-1 mx-auto">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} data-testid={`link-nav-${n.href.slice(1)}`}
                  className={cn('relative px-3 py-1.5 text-sm rounded-md transition-colors', active(n.href) ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}>
                  {t(n.ar, n.en)}
                  {active(n.href) && <span className="absolute inset-x-3 -bottom-[13px] h-[2px] bg-primary" />}
                </Link>
              ))}
            </nav>
          )}
          <div className={cn('flex items-center gap-2', isPlayer ? 'ms-auto' : 'ms-auto md:ms-0')}>
            <div className="hidden lg:flex flex-col items-end leading-tight me-1">
              <span className="text-xs">{session.name}</span>
              <span className="text-[10px] text-primary">{roleLabel(session.role, t)}{session.role === 'president' ? t(' · قراءة فقط', ' · read only') : ''}</span>
            </div>
            <LangToggle />
            <Button size="sm" variant="ghost" data-testid="button-logout" disabled={logout.isPending} onClick={() => logout.mutate()} className="gap-1.5 text-xs">
              <LogOut className="h-3.5 w-3.5 rtl:rotate-180" />
              <span className="hidden sm:inline">{t('خروج', 'Sign out')}</span>
            </Button>
          </div>
        </div>
        {!isPlayer && (
          <nav className="md:hidden flex overflow-x-auto border-t border-border px-2">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={cn('px-3 py-2.5 text-xs whitespace-nowrap border-b-2', active(n.href) ? 'border-primary text-primary' : 'border-transparent text-muted-foreground')}>
                {t(n.ar, n.en)}
              </Link>
            ))}
          </nav>
        )}
      </header>
      {s?.mode === 'demo' && (
        <div className="border-b border-primary/20 bg-primary/[.06] text-[11px] text-primary/90" data-testid="status-mode">
          <div className="mx-auto max-w-[1400px] px-4 md:px-6 py-1.5 flex flex-wrap gap-x-3">
            <span className="font-semibold">{t('وضع العرض التجريبي', 'Demo data mode')}</span>
            <span className="text-muted-foreground">{t('البيانات محفوظة في الذاكرة وقد تُعاد إلى حالتها الأولى عند إعادة تشغيل الخادم.', 'Data lives in server memory and may reset when the server restarts.')}</span>
          </div>
        </div>
      )}
      {s?.mode === 'database' && !isPlayer && (
        <div className="border-b border-border text-[11px] text-muted-foreground">
          <div className="mx-auto max-w-[1400px] px-4 md:px-6 py-1.5">{t('وضع البيانات: قاعدة بيانات دائمة', 'Data mode: persistent database')}</div>
        </div>
      )}
      <main className="flex-1 mx-auto w-full max-w-[1400px] px-4 md:px-6 py-6 md:py-8">{children}</main>
      <footer className="border-t border-border py-4 text-center text-[11px] text-muted-foreground">
        {t('سقفي · ولا دينار فوق السقف · جميع المبالغ بالدينار الكويتي', 'Saqfi · Not one dinar over the cap · All amounts in KWD')}
      </footer>
    </div>
  );
}

export function PageHead({ eyebrow, title, sub, action }: { eyebrow: string; title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 rise">
      <div>
        <div className="eyebrow mb-1.5 text-primary/80">{eyebrow}</div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{title}</h1>
        {sub && <p className="text-sm text-muted-foreground mt-1.5 max-w-2xl">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Money({ v, className, unit = true }: { v: number; className?: string; unit?: boolean }) {
  const { t } = useLang();
  return (
    <span className={cn('whitespace-nowrap', className)}>
      <span className="num">{v < 0 ? '-' : ''}{kwdAbs(v)}</span>
      {unit && <span className="text-[0.7em] text-muted-foreground ms-1">{t('د.ك', 'KWD')}</span>}
    </span>
  );
}
const kwdAbs = (v: number) => Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export function PageSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-64 bg-muted" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 bg-muted" />)}</div>
      <Skeleton className="h-72 bg-muted" />
    </div>
  );
}

export function ErrorPanel({ onRetry, msg }: { onRetry: () => void; msg?: string }) {
  const { t } = useLang();
  return (
    <div className="panel p-10 text-center max-w-lg mx-auto">
      <div className="text-lg font-semibold mb-2">{t('تعذر تحميل بيانات النادي', 'Could not load club data')}</div>
      <p className="text-sm text-muted-foreground mb-5">{msg ?? t('الخادم لا يستجيب حالياً.', 'The server is not responding right now.')}</p>
      <Button onClick={onRetry} data-testid="button-retry">{t('إعادة المحاولة', 'Retry')}</Button>
    </div>
  );
}

export function ReadOnlyNote() {
  const { t } = useLang();
  return (
    <span className="text-[11px] rounded-md border border-border px-2.5 py-1.5 text-muted-foreground" data-testid="status-readonly">
      {t('عرض فقط — التعديل للمدير المالي', 'View only — edits are for the finance manager')}
    </span>
  );
}

export function ErrorBox({ msg, exceeded }: { msg: string; exceeded?: number }) {
  const { t } = useLang();
  return (
    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm" data-testid="text-api-error">
      <div className="font-semibold text-destructive mb-0.5">{t('مرفوض', 'Rejected')}</div>
      <div>{msg}</div>
      {exceeded !== undefined && (
        <div className="mt-1.5 text-xs">
          {t('التجاوز فوق السقف: ', 'Over the cap by: ')}
          <Money v={exceeded} className="text-destructive font-semibold" />
        </div>
      )}
    </div>
  );
}
