import { RefreshCw } from 'lucide-react';
import { classNames } from '../../utils/format.js';
import { Spinner } from '../ui.jsx';

export function AdminSectionHeader({ eyebrow, title, description, actions, busy = false, onRefresh }) {
  return (
    <header className="admin-section-head">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {(actions || onRefresh) && (
        <div className="admin-section-actions">
          {actions}
          {onRefresh && (
            <button type="button" className="btn btn-outline btn-sm" onClick={onRefresh} disabled={busy}>
              <RefreshCw size={15} className={busy ? 'spin' : ''} /> Refresh
            </button>
          )}
        </div>
      )}
    </header>
  );
}

export function AdminPanel({ title, subtitle, actions, children, className = '', bodyClassName = '' }) {
  return (
    <section className={classNames('admin-panel', className)}>
      {(title || actions) && (
        <div className="admin-panel-head">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <p>{subtitle}</p>}
          </div>
          {actions && <div className="admin-panel-actions">{actions}</div>}
        </div>
      )}
      <div className={classNames('admin-panel-body', bodyClassName)}>{children}</div>
    </section>
  );
}

export function AdminLoading({ label = 'Loading the latest data…', rows = 4 }) {
  return (
    <div className="admin-loading" role="status">
      <div className="admin-loading-head">
        <Spinner size={18} /> {label}
      </div>
      <div className="admin-loading-rows">
        {Array.from({ length: rows }).map((_, index) => (
          <div className="admin-loading-row" key={index} />
        ))}
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange, label, disabled = false, busy = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={label}
      className={classNames('toggle', checked && 'toggle-on', busy && 'toggle-busy')}
      onClick={() => onChange?.(!checked)}
      disabled={disabled || busy}
    >
      <span className="toggle-track">
        <span className="toggle-thumb" />
      </span>
      <span className="toggle-copy">
        {busy ? <Spinner size={13} /> : null}
        {label}
      </span>
    </button>
  );
}

export function FilterSelect({ label, value, onChange, options, id }) {
  return (
    <label className="compact-field" htmlFor={id}>
      <span>{label}</span>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function TableEmpty({ colSpan, children }) {
  return (
    <tr>
      <td colSpan={colSpan} className="table-empty-cell">
        {children}
      </td>
    </tr>
  );
}
