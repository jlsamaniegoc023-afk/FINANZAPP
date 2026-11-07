import type { CurrencyCode } from '../shared/types';

const CURRENCY_CONFIG: Record<
  CurrencyCode,
  { locale: string; currency: string; maxFraction: number }
> = {
  COP: { locale: 'es-CO', currency: 'COP', maxFraction: 0 },
  USD: { locale: 'en-US', currency: 'USD', maxFraction: 2 },
  MXN: { locale: 'es-MX', currency: 'MXN', maxFraction: 2 },
  EUR: { locale: 'es-ES', currency: 'EUR', maxFraction: 2 },
};

export function formatCurrency(amount: number, currency: CurrencyCode = 'COP'): string {
  const cfg = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.COP;
  return new Intl.NumberFormat(cfg.locale, {
    style: 'currency',
    currency: cfg.currency,
    minimumFractionDigits: cfg.maxFraction,
    maximumFractionDigits: cfg.maxFraction,
  }).format(amount);
}

export function formatCompactCurrency(amount: number, currency: CurrencyCode = 'COP'): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? '-' : '';
  const prefix = currency === 'EUR' ? '€' : '$';
  if (abs >= 1_000_000) {
    return `${sign}${prefix}${(abs / 1_000_000).toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}${prefix}${Math.round(abs / 1_000)}k`;
  }
  return `${sign}${prefix}${Math.round(abs)}`;
}

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const SHORT_MONTHS = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

export function formatMonthLabel(yyyyMm: string): string {
  const [year, month] = yyyyMm.split('-').map(Number);
  if (!year || !month || month < 1 || month > 12) return yyyyMm;
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

export function formatShortMonth(yyyyMm: string): string {
  const [year, month] = yyyyMm.split('-').map(Number);
  if (!year || !month || month < 1 || month > 12) return yyyyMm;
  return `${SHORT_MONTHS[month - 1]} ${String(year).slice(2)}`;
}

export function formatDateDisplay(yyyyMmDd: string): string {
  const [year, month, day] = yyyyMmDd.split('-').map(Number);
  if (!year || !month || !day) return yyyyMmDd;
  return `${String(day).padStart(2, '0')} ${SHORT_MONTHS[month - 1]} ${year}`;
}

export function getDaysUntil(yyyyMmDd: string, referenceDate = '2026-11-03'): number {
  const target = new Date(`${yyyyMmDd}T00:00:00Z`).getTime();
  const base = new Date(`${referenceDate}T00:00:00Z`).getTime();
  return Math.round((target - base) / (1000 * 60 * 60 * 24));
}

export function getPreviousMonth(yyyyMm: string): string {
  const [year, month] = yyyyMm.split('-').map(Number);
  if (!year || !month) return yyyyMm;
  if (month === 1) return `${year - 1}-12`;
  return `${year}-${String(month - 1).padStart(2, '0')}`;
}

export function getLastSixMonths(anchorMonth: string): string[] {
  const result: string[] = [];
  let cursor = anchorMonth;
  for (let i = 0; i < 6; i += 1) {
    result.unshift(cursor);
    cursor = getPreviousMonth(cursor);
  }
  return result;
}

export function getAccountTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    banco: 'Cuenta Bancaria',
    ahorros: 'Cuenta de Ahorros',
    efectivo: 'Efectivo Disponible',
    inversion: 'Fondo de Inversión',
    billetera_digital: 'Billetera Digital',
  };
  return labels[type] || type;
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const escapeCell = (val: string | number) => {
    const text = String(val ?? '');
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  const csvLines = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => row.map(escapeCell).join(',')),
  ];
  const blob = new Blob([`\uFEFF${csvLines.join('\n')}`], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
