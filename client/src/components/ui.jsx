import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  Check,
  ChefHat,
  LoaderCircle,
  MessageCircle,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react';
import {
  classNames,
  formatMoney,
  ORDER_STATUS_META,
  PAYMENT_STATUS_META,
  paymentMeta,
  statusMeta,
} from '../utils/format.js';

export function Spinner({ size = 18, className = '' }) {
  return <LoaderCircle size={size} className={classNames('spin', className)} aria-hidden="true" />;
}

export function Brand({ to = '/', light = false, compact = false }) {
  const content = (
    <>
      <span className={classNames('brand-mark', light && 'brand-mark-light')} aria-hidden="true">
        <span>AO</span>
      </span>
      {!compact && (
        <span className={classNames('brand-wordmark', light && 'brand-wordmark-light')}>
          <strong>Apna Order</strong>
          <small>Dine-in, beautifully simple</small>
        </span>
      )}
    </>
  );

  if (!to) return <div className="brand">{content}</div>;
  return (
    <Link to={to} className="brand" aria-label="Apna Order home">
      {content}
    </Link>
  );
}

export function Badge({ children, tone = 'neutral', dot = false, className = '' }) {
  return (
    <span className={classNames('badge', `badge-${tone}`, className)}>
      {dot && <span className="badge-dot" aria-hidden="true" />}
      {children}
    </span>
  );
}

export function StatusBadge({ status, detailed = false }) {
  const meta = statusMeta(status);
  return (
    <Badge tone={meta.tone} dot>
      {detailed ? meta.label : meta.short}
    </Badge>
  );
}

export function PaymentBadge({ status, detailed = false }) {
  const meta = paymentMeta(status);
  return (
    <Badge tone={meta.tone} dot>
      {detailed ? meta.label : status === 'PAYMENT_PENDING' ? 'Pending' : meta.label}
    </Badge>
  );
}

export function VegMark({ isVeg = true, withLabel = false }) {
  return (
    <span
      className={classNames('veg-mark-wrap', isVeg ? 'is-veg' : 'is-nonveg')}
      title={isVeg ? 'Vegetarian' : 'Non-vegetarian'}
    >
      <span className="veg-mark" aria-hidden="true">
        <span />
      </span>
      {withLabel && <span>{isVeg ? 'Veg' : 'Non-veg'}</span>}
      {!withLabel && <span className="sr-only">{isVeg ? 'Vegetarian' : 'Non-vegetarian'}</span>}
    </span>
  );
}

export function EmptyState({ icon: Icon = Sparkles, title, message, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={28} aria-hidden="true" />
      </div>
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', message, onRetry, retryLabel = 'Try again' }) {
  return (
    <div className="error-state" role="alert">
      <AlertTriangle size={26} aria-hidden="true" />
      <div>
        <h3>{title}</h3>
        {message && <p>{message}</p>}
      </div>
      {onRetry && (
        <button type="button" className="btn btn-outline btn-sm" onClick={onRetry}>
          <RefreshCw size={15} /> {retryLabel}
        </button>
      )}
    </div>
  );
}

export function InlineAlert({ tone = 'info', title, children, icon: Icon }) {
  const defaultIcon = tone === 'warning' ? AlertTriangle : tone === 'success' ? Check : Sparkles;
  const ChosenIcon = Icon || defaultIcon;
  return (
    <div className={classNames('inline-alert', `inline-alert-${tone}`)} role={tone === 'danger' ? 'alert' : undefined}>
      <ChosenIcon size={18} aria-hidden="true" />
      <div>
        {title && <strong>{title}</strong>}
        {children}
      </div>
    </div>
  );
}

export function FoodImage({ src, alt, className = '' }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={classNames('food-image', className)}>
      {!failed && src ? (
        <img src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <div className="food-image-fallback" aria-hidden="true">
          <ChefHat size={34} />
        </div>
      )}
    </div>
  );
}

export function Modal({ open, onClose, title, eyebrow, children, footer, size = 'md', className = '' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose?.()}>
      <div
        className={classNames('modal-panel', `modal-${size}`, className)}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-head">
          <div>
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            <h2>{title}</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close dialog">
            <X size={19} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  busy = false,
}) {
  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      title={title}
      size="sm"
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={classNames('btn', danger ? 'btn-danger' : 'btn-primary')}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? <Spinner size={16} /> : null}
            {confirmLabel}
          </button>
        </>
      }
    >
      <p className="modal-copy">{message}</p>
    </Modal>
  );
}

export function ManualSendNotice({ children, compact = false }) {
  return (
    <div className={classNames('manual-send-note', compact && 'manual-send-note-compact')}>
      <MessageCircle size={16} aria-hidden="true" />
      <span>
        {children ||
          'WhatsApp opens with a prefilled message. Nothing is sent automatically — you must press Send inside WhatsApp.'}
      </span>
    </div>
  );
}

export function Skeleton({ className = '', lines = 1 }) {
  if (lines > 1) {
    return (
      <div className="skeleton-stack" aria-hidden="true">
        {Array.from({ length: lines }).map((_, index) => (
          <div key={index} className={classNames('skeleton-line', className)} />
        ))}
      </div>
    );
  }
  return <div className={classNames('skeleton-line', className)} aria-hidden="true" />;
}

export function StatCard({ label, value, hint, icon: Icon, tone = 'default' }) {
  return (
    <article className={classNames('stat-card', `stat-${tone}`)}>
      <div className="stat-top">
        <span>{label}</span>
        {Icon && (
          <span className="stat-icon">
            <Icon size={18} />
          </span>
        )}
      </div>
      <strong>{value}</strong>
      {hint && <small>{hint}</small>}
    </article>
  );
}

export { ORDER_STATUS_META, PAYMENT_STATUS_META };
