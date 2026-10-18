import { useContext, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { LogOut, UserRound, Coins, Languages, Home, Wallet, Users, MessageCircleQuestion, AlertCircle, RotateCw, ShieldCheck, PanelRightClose, PanelRightOpen } from 'lucide-react';
import {
  useLogout, getGetSessionQueryKey, getGetClubStateQueryKey, useGetClubState, type Session, type ClubState,
} from '@workspace/api-client-react';
import { useLang } from '@/lib/i18n';
import { useCurrency, DISPLAY_CURRENCIES, KwdOnly, type DisplayCode } from '@/lib/currency';
import { kwd } from '@/lib/saqfi';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuRadioGroup, DropdownMenuRadioItem } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { AdvisorDialog } from '@/components/advisor';
import { PayProvider } from '@/components/pay';

/** The Saqfi mark: a gold cap line with three budget bars under it, none crossing it (Gemini concept, redrawn as vector). */
export function Mark({ size = 34, tile = true, onDark = false }: { size?: number; tile?: boolean; onDark?: boolean }) {
  const bar = tile || onDark ? '#FFFFFF' : '#0B6B4C';
  return (
    <svg width={size} height={size} viewBox="0 0 1024 1024" aria-hidden>
      {tile && !onDark && <rect width="1024" height="1024" rx="232" fill="#0B6B4C" />}
      {onDark && <rect width="1024" height="1024" rx="232" fill="#FFFFFF" fillOpacity="0.08" />}
      <rect x="256" y="256" width="512" height="54" rx="10" fill="#C9A24A" />
      <rect x="299" y="488" width="113" height="280" rx="10" fill={bar} />
      <rect x="455" y="350" width="113" height="418" rx="10" fill={bar} />
      <rect x="612" y="442" width="113" height="326" rx="10" fill={bar} />
    </svg>
  );
}

export function LangToggle({ className }: { className?: string }) {
  const { lang, setLang } = useLang();
  return (
    <button
      data-testid="button-lang"
      onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
      className={cn('inline-flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-foreground/80 hover:bg-muted transition-colors', className)}
    >
      <Languages className="h-4 w-4" />
      {lang === 'ar' ? 'English' : 'العربية'}
    </button>
  );
}

import crestUrl from '@assets/crest_1792268676116.webp';
import kitUrl from '@assets/kit_1792268676116.webp';
/* Fictional demo club identity (Gemini): Al-Suqoor FC crest + home kit */
export const clubCrest = () => crestUrl;
export const clubKit = () => kitUrl;
const seasonLabel = (s?: ClubState) => (s ? `${s.seasonStart.slice(0, 4)}/${s.seasonEnd.slice(2, 4)}` : '');

export function useClub() {
  return useGetClubState({ query: { queryKey: getGetClubStateQueryKey(), refetchInterval: 30000, refetchOnWindowFocus: true } });
}

/**
 * Four sections instead of eight pages. Every old route still exists and is reached
 * through its section's sub-tabs, so deep links (/transactions?new=1, /audit…) keep working.
 */
type Sub = { href: string; ar: string; en: string };
type Section = { id: string; ar: string; en: string; icon: typeof Home; subs: Sub[] };
export const SECTIONS: Section[] = [
  { id: 'home', ar: 'الرئيسية', en: 'Overview', icon: Home, subs: [{ href: '/dashboard', ar: 'الرئيسية', en: 'Overview' }] },
  { id: 'money', ar: 'الميزانية', en: 'Budget', icon: Wallet, subs: [
    { href: '/budget', ar: 'البنود', en: 'Categories' },
    { href: '/transactions', ar: 'المصاريف', en: 'Expenses' },
    { href: '/payments', ar: 'المدفوعات', en: 'Payments' },
  ] },
  { id: 'team', ar: 'الفريق', en: 'Squad', icon: Users, subs: [
    { href: '/contracts', ar: 'العقود', en: 'Contracts' },
    { href: '/payroll', ar: 'الرواتب', en: 'Payroll' },
    { href: '/bonuses', ar: 'المكافآت والغرامات', en: 'Bonuses & fines' },
    { href: '/market', ar: 'سوق الانتقالات', en: 'Transfer market' },
  ] },
  { id: 'approvals', ar: 'الموافقات', en: 'Approvals', icon: ShieldCheck, subs: [
    { href: '/approvals', ar: 'الطلبات', en: 'Requests' },
    { href: '/audit', ar: 'سجل العمليات', en: 'Activity log' },
  ] },
];
const pathOf = (loc: string) => (loc === '/' ? '/dashboard' : loc.split('?')[0]);
export const sectionOf = (loc: string) => SECTIONS.find((s) => s.subs.some((x) => x.href === pathOf(loc)));

export const roleLabel = (r: string, t: (a: string, e: string) => string) =>
  r === 'manager' ? t('المدير المالي', 'Finance manager') : r === 'president' ? t('رئيس النادي', 'Club president') : t('لاعب', 'Player');

function ClubId({ s, dark = false, compact = false }: { s?: ClubState; dark?: boolean; compact?: boolean }) {
  const { t } = useLang();
  return (
    <Link href="/dashboard" className="flex items-center gap-3 min-h-11 min-w-0 rounded-xl" data-testid="link-home" aria-label={s ? t(s.club, s.clubEn) : undefined}>
      <span className={cn('grid place-items-center shrink-0 rounded-xl', dark ? 'h-10 w-10 bg-white' : 'h-9 w-9')}>
        <img src={clubCrest()} alt="" className={cn('object-contain', dark ? 'h-8 w-8' : 'h-9 w-9')} />
      </span>
      {!compact && (
        <span className="leading-tight min-w-0">
          <span className="block font-display font-semibold text-[16px] truncate">{s ? t(s.club, s.clubEn) : ''}</span>
          <span className={cn('block text-[12px] truncate', dark ? 'text-white/55' : 'text-muted-foreground')}>{s ? <>{t('موسم ', 'Season ')}<span className="num">{seasonLabel(s)}</span></> : ''}</span>
        </span>
      )}
    </Link>
  );
}

/** Desktop rail item: full label when open, icon + tooltip when collapsed. */
function RailItem({ href, label, icon: Icon, on, collapsed, badge = 0, onClick, testid }:
  { href?: string; label: string; icon: typeof Home; on?: boolean; collapsed: boolean; badge?: number; onClick?: () => void; testid: string }) {
  const { lang } = useLang();
  const cls = cn('group relative flex items-center gap-3 h-11 rounded-xl text-[14.5px] transition-colors outline-none',
    collapsed ? 'justify-center px-0' : 'px-3',
    on ? 'bg-white/[.09] text-white font-semibold' : 'text-white/65 hover:text-white hover:bg-white/[.05] focus-visible:bg-white/[.07] focus-visible:text-white');
  const inner = (
    <>
      {on && <span aria-hidden className="absolute inset-y-2.5 start-0 w-[3px] rounded-full bg-cap" />}
      <Icon className="h-[19px] w-[19px] shrink-0" strokeWidth={on ? 2.2 : 1.8} />
      {!collapsed && <span className="truncate">{label}</span>}
      {badge > 0 && (collapsed
        ? <span className="absolute top-1.5 end-1.5 h-2 w-2 rounded-full bg-cap" aria-label={String(badge)} />
        : <span className="ms-auto min-w-6 h-6 px-1.5 rounded-full bg-cap text-[#0A2B20] text-[12px] font-bold grid place-items-center num" data-testid="badge-approvals">{badge}</span>)}
    </>
  );
  const el = href
    ? <Link href={href} className={cls} data-testid={testid} aria-current={on ? 'page' : undefined} aria-label={collapsed ? label : undefined}>{inner}</Link>
    : <button type="button" onClick={onClick} className={cn(cls, 'w-full')} data-testid={testid} aria-label={collapsed ? label : undefined}>{inner}</button>;
  if (!collapsed) return el;
  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>{el}</TooltipTrigger>
      <TooltipContent side={lang === 'ar' ? 'left' : 'right'} className="bg-[#0A2B20] text-white">{label}</TooltipContent>
    </Tooltip>
  );
}

export function Shell({ session, children }: { session: Session; children: ReactNode }) {
  const { t, lang, setLang } = useLang();
  const { toast } = useToast();
  const [loc, setLoc] = useLocation();
  const qc = useQueryClient();
  const club = useClub();
  const [advisor, setAdvisor] = useState(false);
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('saqfi-rail') === '1'; } catch { return false; } });
  const toggleRail = () => setCollapsed((c) => { try { localStorage.setItem('saqfi-rail', c ? '0' : '1'); } catch { /* private mode */ } return !c; });
  const logout = useLogout({
    mutation: {
      onSuccess: () => {
        qc.removeQueries({ queryKey: getGetClubStateQueryKey() });
        qc.setQueryData(getGetSessionQueryKey(), { authenticated: false, role: '', name: '', demo: false });
        qc.invalidateQueries({ queryKey: getGetSessionQueryKey() });
        setLoc('/');
      },
      onError: () => toast({ variant: 'destructive', title: t('ما قدرنا نسجّل خروجك. حاول مرة ثانية.', 'Sign-out failed. Please try again.') }),
    },
  });
  const isPlayer = session.role === 'player';
  const s = club.data as ClubState | undefined;
  const current = sectionOf(loc);
  const waiting = s?.requests?.filter((r) => r.status === 'pending').length ?? 0;
  const badge = (id: string) => (id === 'approvals' ? waiting : 0);
  const modeText = s?.mode === 'demo' ? t('بيانات تجريبية', 'Demo data') : s?.mode === 'database' ? t('قاعدة البيانات', 'Database') : '';
  const Collapse = (lang === 'ar') !== collapsed ? PanelRightClose : PanelRightOpen;

  return (
    <PayProvider>
    <div className="min-h-[100dvh] lg:flex">
      {!isPlayer && (
        <aside className={cn('hidden lg:flex lg:flex-col shrink-0 sticky top-0 h-[100dvh] bg-[#0A2B20] text-white py-5 transition-[width] duration-200 ease-out',
          collapsed ? 'w-[76px] px-3' : 'w-[248px] px-4')} aria-label={t('القائمة', 'Menu')}>
          <div className={cn('flex items-center', collapsed ? 'justify-center' : 'px-1')}><ClubId s={s} dark compact={collapsed} /></div>

          <nav className="mt-8 flex flex-col gap-1" aria-label={t('الأقسام', 'Sections')}>
            {SECTIONS.map((x) => (
              <RailItem key={x.id} href={x.subs[0].href} label={t(x.ar, x.en)} icon={x.icon} on={current?.id === x.id}
                collapsed={collapsed} badge={badge(x.id)} testid={`link-nav-${x.id}`} />
            ))}
          </nav>

          <div className="my-5 h-px bg-white/10" />
          <RailItem label={t('اسأل المستشار', 'Ask the advisor')} icon={MessageCircleQuestion} collapsed={collapsed} onClick={() => setAdvisor(true)} testid="button-advisor" />

          <div className="mt-auto space-y-1">
            <CurrencyPicker align="start" trigger={(c) => (
              <button type="button" data-testid="button-currency" aria-label={t('العملة', 'Currency')}
                className={cn('relative flex w-full items-center gap-3 h-11 rounded-xl text-[14.5px] text-white/65 hover:text-white hover:bg-white/[.05] outline-none focus-visible:bg-white/[.07]', collapsed ? 'justify-center' : 'px-3')}>
                <Coins className="h-[19px] w-[19px] shrink-0" strokeWidth={1.8} />
                {!collapsed && <><span className="truncate">{t('العملة', 'Currency')}</span><span className="ms-auto num text-[12px] rounded-md bg-white/10 px-1.5 py-0.5">{c}</span></>}
              </button>
            )} />
            <RailItem label={lang === 'ar' ? 'English' : 'العربية'} icon={Languages} collapsed={collapsed} onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')} testid="button-lang" />
            <RailItem label={collapsed ? t('توسيع القائمة', 'Expand menu') : t('تصغير القائمة', 'Collapse menu')} icon={Collapse} collapsed={collapsed} onClick={toggleRail} testid="button-rail" />
            <div className={cn('mt-3 pt-4 border-t border-white/10 flex items-center gap-3', collapsed && 'flex-col')}>
              <span className="h-9 w-9 rounded-full bg-white/10 grid place-items-center shrink-0 text-[13px] font-semibold" aria-hidden><UserRound className="h-4 w-4" /></span>
              {!collapsed && (
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block text-[14px] font-semibold truncate" data-testid="text-session-role">{roleLabel(session.role, t)}</span>
                  {modeText && <span className="block text-[12px] text-white/50 truncate" data-testid="status-mode">{modeText}</span>}
                </span>
              )}
              <button type="button" onClick={() => logout.mutate()} disabled={logout.isPending} data-testid="button-logout"
                aria-label={t('تسجيل الخروج', 'Sign out')} title={t('تسجيل الخروج', 'Sign out')}
                className="h-9 w-9 grid place-items-center rounded-lg text-white/60 hover:text-white hover:bg-white/[.07] shrink-0">
                <LogOut className="h-4 w-4 rtl:rotate-180" />
              </button>
            </div>
          </div>
        </aside>
      )}

      <div className="flex-1 min-w-0 flex flex-col min-h-[100dvh]">
        {/* Mobile (and player on desktop): one quiet bar with the club, advisor and account */}
        <header className={cn('sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-md', !isPlayer && 'lg:hidden')}>
          <div className="mx-auto max-w-[1200px] px-4 md:px-6 h-16 flex items-center gap-2">
            <ClubId s={s} />
            <div className="ms-auto flex items-center gap-1">
              <CurrencyPicker trigger={(c) => (
                <button className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[13px] font-semibold num hover:bg-muted" aria-label={t('العملة', 'Currency')} data-testid="button-currency-mobile">
                  <Coins className="h-4 w-4 text-muted-foreground" />{c}
                </button>
              )} />
              {!isPlayer && (
                <button onClick={() => setAdvisor(true)} data-testid="button-advisor-mobile" aria-label={t('اسأل المستشار', 'Ask the advisor')}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl hover:bg-muted">
                  <MessageCircleQuestion className="h-5 w-5" />
                </button>
              )}
              <DropdownMenu dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                <DropdownMenuTrigger asChild>
                  <button className="inline-flex h-11 w-11 items-center justify-center rounded-xl hover:bg-muted" aria-label={t('الحساب', 'Account')} data-testid="button-account">
                    <span className="h-8 w-8 rounded-full bg-accent text-primary grid place-items-center text-[13px] font-semibold"><UserRound className="h-4 w-4" /></span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="font-normal">
                    <span className="block font-semibold">{roleLabel(session.role, t)}</span>
                    {modeText && <span className="block text-[12px] text-muted-foreground">{modeText}</span>}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setLang(lang === 'ar' ? 'en' : 'ar')} data-testid="button-lang-mobile"><Languages className="h-4 w-4" />{lang === 'ar' ? 'English' : 'العربية'}</DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => logout.mutate()} data-testid="button-logout-mobile"><LogOut className="h-4 w-4 rtl:rotate-180" />{t('تسجيل الخروج', 'Sign out')}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        <main key={current?.id ?? loc} className={cn('page-in flex-1 mx-auto w-full max-w-[1200px] px-4 md:px-8 xl:px-10 py-6 md:py-9', !isPlayer && 'pb-28 lg:pb-12')}>
          {children}
        </main>
      </div>

      {!isPlayer && (
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-card/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]" data-testid="nav-mobile" aria-label={t('الأقسام', 'Sections')}>
          <div className="grid grid-cols-4 max-w-lg mx-auto">
            {SECTIONS.map((x) => {
              const on = current?.id === x.id;
              const Icon = x.icon;
              return (
                <Link key={x.id} href={x.subs[0].href} data-testid={`link-tab-${x.id}`} aria-current={on ? 'page' : undefined}
                  className={cn('relative flex flex-col items-center justify-center gap-1 h-[62px] text-[12px]', on ? 'text-primary font-semibold' : 'text-muted-foreground')}>
                  <span className={cn('relative inline-flex h-7 w-14 items-center justify-center rounded-full transition-colors', on && 'bg-accent')}>
                    <Icon className="h-5 w-5" strokeWidth={on ? 2.2 : 1.8} />
                    {badge(x.id) > 0 && <span className="absolute -top-1 end-2 h-4 min-w-4 px-1 rounded-full bg-destructive text-white text-[10px] font-bold grid place-items-center num">{badge(x.id)}</span>}
                  </span>
                  {t(x.ar, x.en)}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
      <AdvisorDialog open={advisor} onOpenChange={setAdvisor} />
    </div>
    </PayProvider>
  );
}

/** Display-currency picker. The ledger stays in KWD; amounts are shown converted at today's rate. */
export function CurrencyPicker({ trigger, align = 'end' }: { trigger: (label: string) => ReactNode; align?: 'start' | 'end' }) {
  const { t, lang } = useLang();
  const cur = useCurrency();
  return (
    <DropdownMenu dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <DropdownMenuTrigger asChild>{trigger(cur.code)}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-60 max-h-[60vh] overflow-y-auto">
        <DropdownMenuLabel className="text-[12px] font-normal text-muted-foreground">{t('عرض المبالغ بـ', 'Show amounts in')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={cur.code} onValueChange={(v) => cur.setCode(v as DisplayCode)}>
          {DISPLAY_CURRENCIES.map((c) => (
            <DropdownMenuRadioItem key={c.code} value={c.code} data-testid={`currency-${c.code}`}>
              <span className="flex-1">{t(c.nameAr, c.nameEn)}</span><span className="num text-muted-foreground text-[12px]">{c.code}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {cur.code !== 'KWD' && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5 text-[12px] text-muted-foreground leading-relaxed">
              {cur.failed ? t('سعر الصرف مو متوفر الحين، نعرض بالدينار.', 'Rate unavailable right now, showing KWD.')
                : t('السجلات محفوظة بالدينار، والعرض بسعر اليوم.', 'Records stay in KWD; shown at today\'s rate.')}
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Sub-navigation inside a section: a quiet underline tab row, scrollable on small screens. */
export function SectionTabs() {
  const { t } = useLang();
  const [loc] = useLocation();
  const sec = sectionOf(loc);
  if (!sec || sec.subs.length < 2) return null;
  const here = pathOf(loc);
  return (
    <nav className="-mx-4 px-4 md:mx-0 md:px-0 overflow-x-auto" aria-label={t(sec.ar, sec.en)}>
      <div className="flex gap-6 border-b border-border min-w-max">
        {sec.subs.map((x) => {
          const on = x.href === here;
          return (
            <Link key={x.href} href={x.href} aria-current={on ? 'page' : undefined} data-testid={`link-sub-${x.href.slice(1)}`}
              className={cn('relative -mb-px h-11 inline-flex items-center text-[15px] border-b-2 transition-colors',
                on ? 'border-primary text-foreground font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground')}>
              {t(x.ar, x.en)}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Page header. Inside a grouped section the section name is the title and the page becomes a sub-tab. */
export function PageHead({ title, action }: { title: string; sub?: string; action?: ReactNode }) {
  const { t } = useLang();
  const [loc] = useLocation();
  const sec = sectionOf(loc);
  const grouped = !!sec && sec.subs.length > 1;
  return (
    <div className={cn('grid gap-x-4 gap-y-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center', grouped ? 'mb-7' : 'mb-7')}>
      <h1 className="order-1 font-display text-[26px] md:text-[32px] font-semibold leading-tight tracking-tight">{grouped ? t(sec!.ar, sec!.en) : title}</h1>
      {action && <div className="order-3 sm:order-2 flex flex-wrap gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">{action}</div>}
      {grouped && <div className="order-2 sm:order-3 sm:col-span-2"><SectionTabs /></div>}
    </div>
  );
}

/** exact: show 3 decimals only when the value carries fils. Default: whole dinars. */
export function Money({ v, className, unit = true, exact = false, raw = false }: { v: number; className?: string; unit?: boolean; exact?: boolean; raw?: boolean }) {
  const { lang } = useLang();
  const cur = useCurrency();
  const kwOnly = useContext(KwdOnly);
  const kw = raw || kwOnly || cur.shown === 'KWD';   /* raw: an amount being entered or booked, always KWD */
  const val = kw ? v : cur.conv(v);
  return (
    <span className={cn('whitespace-nowrap', className)}>
      <span className="num font-display">{val < 0 ? '-' : ''}{kwd(Math.abs(val), kw ? exact : false)}</span>
      {unit && <span className="text-[0.62em] font-medium text-muted-foreground ms-1.5">{kw ? (lang === 'ar' ? 'د.ك' : 'KWD') : cur.unit(lang)}</span>}
    </span>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-10 w-56 bg-muted" />
      <Skeleton className="h-5 w-80 max-w-full bg-muted" />
      <Skeleton className="h-52 bg-muted" />
      <Skeleton className="h-64 bg-muted" />
    </div>
  );
}

export function ErrorPanel({ onRetry, msg }: { onRetry: () => void; msg?: string }) {
  const { t } = useLang();
  return (
    <div className="panel p-8 text-center max-w-lg mx-auto">
      <AlertCircle className="h-6 w-6 mx-auto mb-3 text-muted-foreground" />
      <div className="text-lg font-semibold mb-2">{t('ما قدرنا نحمّل بيانات النادي', 'Could not load club data')}</div>
      <p className="text-muted-foreground mb-5">{msg ?? t('الخادم ما يرد الحين. جرّب مرة ثانية.', 'The server is not responding right now. Please try again.')}</p>
      <Button onClick={onRetry} data-testid="button-retry"><RotateCw className="h-4 w-4" />{t('حاول مرة ثانية', 'Try again')}</Button>
    </div>
  );
}

export function ReadOnlyNote() {
  const { t } = useLang();
  return (
    <span className="inline-flex min-h-11 items-center rounded-lg bg-muted px-4 text-sm text-muted-foreground" data-testid="status-readonly">
      {t('عرض فقط، التعديل للمدير المالي', 'View only. Edits are for the finance manager')}
    </span>
  );
}

/** Server rejection. If `exceeded` is present it's a cap rejection: show operation, amount over and advice. */
export function ErrorBox({ msg, exceeded, op }: { msg: string; exceeded?: number; op?: string }) {
  const { t } = useLang();
  if (exceeded === undefined) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive/[.05] p-4" data-testid="text-api-error" role="alert">
        <div className="font-semibold text-destructive mb-1">{t('ما تم الحفظ', 'Not saved')}</div>
        <div>{msg}</div>
      </div>
    );
  }
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/[.05] p-4 space-y-2" data-testid="text-api-error" role="alert">
      <div className="font-semibold text-destructive">{op ? t(`انرفض ${op} لأنه يتجاوز السقف`, `${op} rejected: over the cap`) : t('انرفض لأنه يتجاوز السقف', 'Rejected: over the cap')}</div>
      <div>{t('تكلفة هالعملية أكبر من المتاح في البند.', 'This would cost more than the available category budget.')}</div>
      <div>{t('الزيادة فوق السقف: ', 'Over the cap by: ')}<Money v={exceeded} exact className="font-semibold text-destructive" /></div>
      <div className="text-muted-foreground text-[15px]">{t('قلّل المبلغ أو الراتب، أو عدّل سقف البند من صفحة الميزانية، وبعدين حاول مرة ثانية.',
        'Reduce the amount or salary, or adjust the category cap on the Budget page, then try again.')}</div>
    </div>
  );
}

/** Mobile stacked card row */
export function KV({ k, v, strong }: { k: string; v: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-muted-foreground text-[15px]">{k}</span>
      <span className={cn('text-end', strong && 'font-semibold')}>{v}</span>
    </div>
  );
}
