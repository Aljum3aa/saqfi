import { Link } from 'wouter';
import { useLang } from '@/lib/i18n';

export default function NotFound() {
  const { t } = useLang();
  return (
    <div className="panel max-w-md mx-auto p-8 text-center">
      <h1 className="text-2xl font-semibold mb-2">{t('الصفحة مو موجودة', 'Page not found')}</h1>
      <p className="text-muted-foreground mb-5">{t('الرابط غلط أو الصفحة انشالت.', 'The link is wrong or the page was removed.')}</p>
      <Link href="/dashboard" data-testid="link-back-home" className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 font-semibold text-primary-foreground">{t('رجوع للرئيسية', 'Back to home')}</Link>
    </div>
  );
}
