import type { Money } from '@app-types/domain';

const intlCache = new Map<string, Intl.NumberFormat>();

const moneyFormatter = (currency: string, locale = 'en-IN') => {
  const key = `${locale}|${currency}`;
  let f = intlCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    });
    intlCache.set(key, f);
  }
  return f;
};

export const formatMoney = (m: Money | undefined, locale = 'en-IN'): string => {
  if (!m) return '';
  return moneyFormatter(m.currency, locale).format(m.amount);
};

export const formatRelative = (iso: string, now = Date.now()): string => {
  const t = new Date(iso).getTime();
  const diffSec = Math.round((t - now) / 1000);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const abs = Math.abs(diffSec);
  if (abs < 60)        return rtf.format(diffSec, 'second');
  if (abs < 3_600)     return rtf.format(Math.round(diffSec / 60), 'minute');
  if (abs < 86_400)    return rtf.format(Math.round(diffSec / 3_600), 'hour');
  if (abs < 2_592_000) return rtf.format(Math.round(diffSec / 86_400), 'day');
  if (abs < 31_536_000)return rtf.format(Math.round(diffSec / 2_592_000), 'month');
  return rtf.format(Math.round(diffSec / 31_536_000), 'year');
};

export const truncate = (s: string, max = 80): string =>
  s.length <= max ? s : `${s.slice(0, max - 1)}â€¦`;
