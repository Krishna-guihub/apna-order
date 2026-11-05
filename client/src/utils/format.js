export const ORDER_STATUS_META = {
  PLACED: { label: 'Order placed', short: 'Placed', tone: 'amber' },
  PREPARING: { label: 'In the kitchen', short: 'Preparing', tone: 'orange' },
  READY: { label: 'Ready to serve', short: 'Ready', tone: 'blue' },
  SERVED: { label: 'Served', short: 'Served', tone: 'green' },
  CANCELLED: { label: 'Cancelled', short: 'Cancelled', tone: 'red' },
};

export const PAYMENT_STATUS_META = {
  UNPAID: { label: 'Unpaid', tone: 'neutral' },
  PAYMENT_PENDING: { label: 'Payment pending', tone: 'amber' },
  PAID: { label: 'Paid', tone: 'green' },
  PARTIALLY_REFUNDED: { label: 'Partly refunded', tone: 'orange' },
  REFUNDED: { label: 'Refunded', tone: 'blue' },
};

export const PAYMENT_RECORD_STATUS = {
  CREATED: { label: 'Created', tone: 'neutral' },
  PENDING: { label: 'Pending', tone: 'amber' },
  PAID: { label: 'Paid', tone: 'green' },
  FAILED: { label: 'Failed', tone: 'red' },
  REFUNDED: { label: 'Refunded', tone: 'blue' },
  PARTIALLY_REFUNDED: { label: 'Partly refunded', tone: 'orange' },
};

const moneyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const compactMoneyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 1,
});

export function formatMoney(paise) {
  return moneyFormatter.format(Number(paise || 0) / 100);
}

export function formatMoneyCompact(paise) {
  return compactMoneyFormatter.format(Number(paise || 0) / 100);
}

export function formatDateTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatTime(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

export function formatDay(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('en-IN', { weekday: 'short' }).format(new Date(`${value}T12:00:00`));
}

export function elapsedLabel(startValue, now = Date.now()) {
  const diff = Math.max(0, now - new Date(startValue).getTime());
  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  return `${seconds}s`;
}

export function formatPhoneForDisplay(phone) {
  return phone || '—';
}

export function estimateCart(items, taxRatePercent = 5) {
  const subtotalPaise = items.reduce(
    (sum, item) => sum + Number(item.pricePaise) * Number(item.quantity),
    0,
  );
  const taxPaise = Math.round((subtotalPaise * Number(taxRatePercent || 0)) / 100);
  return { subtotalPaise, taxPaise, totalPaise: subtotalPaise + taxPaise };
}

export function rupeesToPaise(value) {
  if (value === '' || value === null || value === undefined) return 0;
  return Math.round(Number(value) * 100);
}

export function paiseToRupees(value) {
  return (Number(value || 0) / 100).toFixed(2);
}

export function parseApiError(error) {
  if (error?.details && typeof error.details === 'object') {
    const first = Object.values(error.details).flat().filter(Boolean)[0];
    if (first) return `${error.message} ${first}`;
  }
  return error?.message || 'Something went wrong. Please try again.';
}

export function statusMeta(status) {
  return ORDER_STATUS_META[status] || { label: status, short: status, tone: 'neutral' };
}

export function paymentMeta(status) {
  return PAYMENT_STATUS_META[status] || { label: status, tone: 'neutral' };
}

export function paymentRecordMeta(status) {
  return PAYMENT_RECORD_STATUS[status] || { label: status, tone: 'neutral' };
}

export function classNames(...values) {
  return values.filter(Boolean).join(' ');
}

export function initials(name) {
  return String(name || 'AO')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}
