import { useId } from 'react';
import { ArrowRight, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { EmptyState, Spinner, VegMark } from './ui.jsx';
import { formatMoney } from '../utils/format.js';

export default function CartPanel({
  items,
  totals,
  taxRatePercent,
  form,
  setForm,
  onPlaceOrder,
  onQuantityChange,
  onRemove,
  placing,
  onClose,
  compact = false,
}) {
  const fieldId = useId();
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const submit = (event) => {
    event.preventDefault();
    onPlaceOrder();
  };

  return (
    <form className={`cart-panel ${compact ? 'cart-panel-compact' : ''}`} onSubmit={submit}>
      <div className="cart-head">
        <div>
          <span className="eyebrow">Your table order</span>
          <h2>
            Cart <span className="cart-count-inline">{itemCount}</span>
          </h2>
        </div>
        {onClose && (
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close cart">
            <X size={19} />
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={ShoppingBag}
          title="Your cart is waiting"
          message="Add something delicious from the menu to begin."
        />
      ) : (
        <>
          <div className="cart-items">
            {items.map((item) => (
              <div className="cart-item" key={item.id}>
                <VegMark isVeg={item.isVeg} />
                <div className="cart-item-copy">
                  <div className="cart-item-title">
                    <strong>{item.name}</strong>
                    <span>{formatMoney(item.pricePaise * item.quantity)}</span>
                  </div>
                  <small>{formatMoney(item.pricePaise)} each</small>
                  <div className="cart-item-actions">
                    <div className="qty-stepper qty-stepper-sm" aria-label={`Quantity for ${item.name}`}>
                      <button
                        type="button"
                        onClick={() => onQuantityChange(item.id, -1)}
                        aria-label={`Reduce ${item.name} quantity`}
                      >
                        <Minus size={14} />
                      </button>
                      <span aria-live="polite">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => onQuantityChange(item.id, 1)}
                        aria-label={`Increase ${item.name} quantity`}
                        disabled={item.quantity >= 20}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <button
                      type="button"
                      className="text-button text-button-danger"
                      onClick={() => onRemove(item.id)}
                      aria-label={`Remove ${item.name}`}
                    >
                      <Trash2 size={14} /> Remove
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="order-summary">
            <div>
              <span>Subtotal</span>
              <strong>{formatMoney(totals.subtotalPaise)}</strong>
            </div>
            <div>
              <span>Tax ({taxRatePercent}%)</span>
              <strong>{formatMoney(totals.taxPaise)}</strong>
            </div>
            <div className="summary-total">
              <span>Estimated total</span>
              <strong>{formatMoney(totals.totalPaise)}</strong>
            </div>
            <small className="summary-note">The server recalculates tax and total when you place the order.</small>
          </div>

          <div className="checkout-fields">
            <div className="field">
              <label htmlFor={`${fieldId}-name`}>Your name</label>
              <input
                id={`${fieldId}-name`}
                type="text"
                autoComplete="name"
                placeholder="e.g. Riya Sharma"
                value={form.customerName}
                onChange={(event) => setForm({ ...form, customerName: event.target.value })}
                maxLength={80}
                required
              />
            </div>
            <div className="field">
              <label htmlFor={`${fieldId}-phone`}>
                Phone <span className="optional">(optional)</span>
              </label>
              <input
                id={`${fieldId}-phone`}
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                placeholder="For the restaurant only"
                value={form.customerPhone}
                onChange={(event) => setForm({ ...form, customerPhone: event.target.value })}
                maxLength={20}
              />
            </div>
            <div className="field">
              <label htmlFor={`${fieldId}-notes`}>
                Notes for the kitchen <span className="optional">(optional)</span>
              </label>
              <textarea
                id={`${fieldId}-notes`}
                rows={2}
                placeholder="Allergies, spice level, no onion…"
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                maxLength={300}
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={placing}>
            {placing ? <Spinner size={18} /> : <ShoppingBag size={18} />}
            {placing ? 'Sending to kitchen…' : 'Place order'}
            {!placing && <ArrowRight size={17} />}
          </button>
          <p className="cart-legal">
            By placing the order you confirm the items and table. Payment happens after your order is
            accepted.
          </p>
        </>
      )}
    </form>
  );
}
