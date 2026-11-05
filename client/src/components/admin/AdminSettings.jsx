import { useCallback, useEffect, useState } from 'react';
import {
  CreditCard,
  MessageCircle,
  Percent,
  Save,
  ShieldCheck,
  Store,
  TestTube2,
} from 'lucide-react';
import { AdminLoading, AdminPanel, AdminSectionHeader } from './shared.jsx';
import { Badge, ErrorState, InlineAlert, Spinner } from '../ui.jsx';
import { api } from '../../api/client.js';
import { useToast } from '../../context/ToastContext.jsx';
import { parseApiError } from '../../utils/format.js';

const EMPTY = {
  restaurantName: '',
  taxRatePercent: '',
  whatsappRestaurant: '',
  whatsappKitchen: '',
};

export default function AdminSettings() {
  const { addToast } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [dirty, setDirty] = useState(false);

  const loadSettings = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const [settingsData, configData] = await Promise.all([
        api.get('/admin/settings'),
        api.get('/public/config'),
      ]);
      setForm({
        restaurantName: settingsData.settings.restaurantName,
        taxRatePercent: String(settingsData.settings.taxRatePercent),
        whatsappRestaurant: settingsData.settings.whatsappRestaurant,
        whatsappKitchen: settingsData.settings.whatsappKitchen,
      });
      setConfig(configData);
      setDirty(false);
      setError('');
    } catch (loadError) {
      setError(parseApiError(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setFormError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const taxRatePercent = Number(form.taxRatePercent);
    if (form.restaurantName.trim().length < 2) {
      setFormError('Restaurant name must be at least two characters.');
      return;
    }
    if (!Number.isFinite(taxRatePercent) || taxRatePercent < 0 || taxRatePercent > 28) {
      setFormError('Tax rate must be between 0 and 28 percent.');
      return;
    }
    if (!/^\d{10,15}$/.test(form.whatsappRestaurant)) {
      setFormError('Restaurant WhatsApp must contain 10–15 digits, including country code, with no spaces.');
      return;
    }
    if (!/^\d{10,15}$/.test(form.whatsappKitchen)) {
      setFormError('Kitchen WhatsApp must contain 10–15 digits, including country code, with no spaces.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      const data = await api.patch('/admin/settings', {
        restaurantName: form.restaurantName.trim(),
        taxRatePercent,
        whatsappRestaurant: form.whatsappRestaurant.trim(),
        whatsappKitchen: form.whatsappKitchen.trim(),
      });
      setForm({
        restaurantName: data.settings.restaurantName,
        taxRatePercent: String(data.settings.taxRatePercent),
        whatsappRestaurant: data.settings.whatsappRestaurant,
        whatsappKitchen: data.settings.whatsappKitchen,
      });
      setDirty(false);
      addToast('Restaurant settings saved and audited.', 'success');
      await loadSettings(true);
    } catch (saveError) {
      setFormError(parseApiError(saveError));
    } finally {
      setSaving(false);
    }
  };

  const mode = config?.paymentMode || 'simulated';
  const simulated = mode === 'simulated';

  return (
    <div className="admin-section">
      <AdminSectionHeader
        eyebrow="Restaurant settings"
        title="Identity, tax and message routing."
        description="These values affect new orders and prefilled WhatsApp messages. Variables read from the environment remain the source of truth for payment credentials."
        busy={refreshing}
        onRefresh={() => loadSettings()}
      />

      {error && (
        <ErrorState title="Settings could not load" message={error} onRetry={() => loadSettings()} />
      )}

      {loading ? (
        <AdminLoading label="Reading restaurant settings…" rows={4} />
      ) : (
        <div className="admin-settings-grid">
          <form className="admin-panel admin-settings-form" onSubmit={handleSubmit}>
            <div className="admin-panel-head">
              <div>
                <h2>Guest-facing configuration</h2>
                <p>Applied immediately across the menu, bills and table links.</p>
              </div>
              {dirty && <Badge tone="amber" dot>Unsaved changes</Badge>}
            </div>
            <div className="admin-panel-body">
              {formError && (
                <div className="form-error" role="alert">
                  {formError}
                </div>
              )}

              <div className="field">
                <label htmlFor="settings-restaurant">
                  <Store size={15} /> Restaurant name
                </label>
                <input
                  id="settings-restaurant"
                  type="text"
                  minLength={2}
                  maxLength={100}
                  value={form.restaurantName}
                  onChange={(event) => updateForm('restaurantName', event.target.value)}
                  required
                />
                <small className="field-hint">Shown on the menu, receipt and WhatsApp messages.</small>
              </div>

              <div className="form-grid-two">
                <div className="field">
                  <label htmlFor="settings-tax">
                    <Percent size={15} /> Tax rate (%)
                  </label>
                  <input
                    id="settings-tax"
                    type="number"
                    min="0"
                    max="28"
                    step="0.01"
                    value={form.taxRatePercent}
                    onChange={(event) => updateForm('taxRatePercent', event.target.value)}
                    required
                  />
                  <small className="field-hint">
                    Stored as {Math.round(Number(form.taxRatePercent || 0) * 100)} basis points.
                  </small>
                </div>
                <div className="admin-settings-preview">
                  <span>Example tax on ₹500</span>
                  <strong>
                    ₹
                    {(
                      (500 * Number(form.taxRatePercent || 0)) /
                      100
                    ).toFixed(2)}
                  </strong>
                  <small>Existing orders keep their original tax snapshot.</small>
                </div>
              </div>

              <div className="form-grid-two">
                <div className="field">
                  <label htmlFor="settings-whatsapp-restaurant">
                    <MessageCircle size={15} /> Restaurant WhatsApp
                  </label>
                  <input
                    id="settings-whatsapp-restaurant"
                    type="text"
                    inputMode="numeric"
                    pattern="\d{10,15}"
                    value={form.whatsappRestaurant}
                    onChange={(event) => updateForm('whatsappRestaurant', event.target.value)}
                    placeholder="919876543210"
                    required
                  />
                  <small className="field-hint">Country code + number, digits only. Used for receipts.</small>
                </div>
                <div className="field">
                  <label htmlFor="settings-whatsapp-kitchen">
                    <MessageCircle size={15} /> Kitchen WhatsApp
                  </label>
                  <input
                    id="settings-whatsapp-kitchen"
                    type="text"
                    inputMode="numeric"
                    pattern="\d{10,15}"
                    value={form.whatsappKitchen}
                    onChange={(event) => updateForm('whatsappKitchen', event.target.value)}
                    placeholder="919876543211"
                    required
                  />
                  <small className="field-hint">Used when staff open a kitchen order message.</small>
                </div>
              </div>

              <InlineAlert tone="warning" title="WhatsApp is manual by design">
                <p>
                  The system only builds a <code>wa.me</code> link with a prefilled message. No API
                  token is stored and nothing is sent until a person presses Send inside WhatsApp.
                </p>
              </InlineAlert>

              <div className="admin-settings-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => loadSettings()}
                  disabled={saving || !dirty}
                >
                  Discard changes
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <Spinner size={16} /> : <Save size={16} />} Save settings
                </button>
              </div>
            </div>
          </form>

          <div className="admin-settings-side">
            <AdminPanel title="Payment mode" subtitle="Read-only, controlled by environment variables">
              <div className={`admin-mode-card ${simulated ? 'is-simulated' : 'is-gateway'}`}>
                <span className="admin-mode-card-icon">
                  {simulated ? <TestTube2 size={20} /> : <CreditCard size={20} />}
                </span>
                <div>
                  <strong>{simulated ? 'Local simulation' : 'Razorpay test gateway'}</strong>
                  <span>
                    {simulated
                      ? 'No money moves. Simulation is rejected in production.'
                      : 'Signature, captured-status and webhook checks are required.'}
                  </span>
                </div>
              </div>
              <div className="admin-fact-list">
                <div>
                  <span>Environment</span>
                  <strong>{config?.environment || 'unknown'}</strong>
                </div>
                <div>
                  <span>Razorpay enabled</span>
                  <strong>{config?.razorpayEnabled ? 'Yes' : 'No'}</strong>
                </div>
                <div>
                  <span>Dev tools</span>
                  <strong>{config?.devToolsEnabled ? 'Enabled' : 'Disabled'}</strong>
                </div>
                <div>
                  <span>Tax from config default</span>
                  <strong>{config?.taxRatePercent ?? '—'}%</strong>
                </div>
              </div>
              <p className="admin-side-note">
                API keys, the webhook secret and the JWT secret live only in <code>.env</code>. Never
                commit them or paste them into this dashboard.
              </p>
            </AdminPanel>

            <AdminPanel title="Security reminders" subtitle="The parts that keep the records honest">
              <ul className="admin-check-list">
                <li>
                  <ShieldCheck size={15} /> Prices and tax are recalculated by the server on every
                  order and every discount.
                </li>
                <li>
                  <ShieldCheck size={15} /> Paid status comes only from a verified payment path.
                </li>
                <li>
                  <ShieldCheck size={15} /> Refunds use an idempotency key so a retry cannot charge
                  twice.
                </li>
                <li>
                  <ShieldCheck size={15} /> Rotating a table token invalidates the old printed code.
                </li>
                <li>
                  <ShieldCheck size={15} /> Login attempts are rate-limited and sessions are httpOnly.
                </li>
              </ul>
            </AdminPanel>

            <InlineAlert tone="info" title="Restart not required">
              <p>
                Restaurant name, tax and WhatsApp numbers are stored in SQLite. Payment credentials and
                CORS origins come from the environment and require a server restart if changed.
              </p>
            </InlineAlert>
          </div>
        </div>
      )}
    </div>
  );
}
