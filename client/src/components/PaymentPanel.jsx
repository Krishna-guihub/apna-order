import { useState } from 'react';
import {
  Check,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  MessageCircle,
  Printer,
  RefreshCw,
  ShieldCheck,
  TestTube2,
  TriangleAlert,
} from 'lucide-react';
import { api } from '../api/client.js';
import { useToast } from '../context/ToastContext.jsx';
import { loadRazorpayCheckout } from '../utils/razorpay.js';
import {
  formatDateTime,
  formatMoney,
  parseApiError,
  paymentMeta,
} from '../utils/format.js';
import { InlineAlert, ManualSendNotice, Spinner, StatusBadge } from './ui.jsx';

export default function PaymentPanel({ order, config, onRefresh }) {
  const { addToast } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [whatsappOpened, setWhatsappOpened] = useState(false);
  const [whatsappConfirmed, setWhatsappConfirmed] = useState(false);

  const token = new URLSearchParams(window.location.search).get('token');
  const isSimulated = config?.paymentMode === 'simulated';
  const isPaid = order.paymentStatus === 'PAID';
  const canPay = ['UNPAID', 'PAYMENT_PENDING'].includes(order.paymentStatus) && order.status !== 'CANCELLED';

  const startSimulatedPayment = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.post(`/payments/orders/${order.publicId}`, { tableToken: token });
      await api.post(`/payments/orders/${order.publicId}/simulate`, { tableToken: token });
      addToast('Simulated payment recorded. No real money moved.', 'success');
      onRefresh();
    } catch (paymentError) {
      setError(parseApiError(paymentError));
    } finally {
      setBusy(false);
    }
  };

  const startRazorpayPayment = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const RazorpayCheckout = await loadRazorpayCheckout();
      const { payment } = await api.post(`/payments/orders/${order.publicId}`, {
        tableToken: token,
      });

      if (payment.mode !== 'razorpay') {
        setError('The server did not return a Razorpay order. Payment cannot start.');
        setBusy(false);
        return;
      }

      const checkout = new RazorpayCheckout({
        key: payment.keyId,
        amount: payment.amountPaise,
        currency: payment.currency,
        name: payment.checkoutName,
        description: `Table ${order.table.tableNumber} · ${order.publicId}`,
        order_id: payment.providerOrderId,
        prefill: {
          name: order.customerName,
          contact: order.customerPhone || '',
        },
        notes: {
          order_public_id: order.publicId,
          table_number: String(order.table.tableNumber),
        },
        theme: { color: '#153e2d' },
        handler: async (response) => {
          setBusy(true);
          try {
            await api.post('/payments/verify', response);
            addToast('Payment verified with the gateway.', 'success');
            setNotice('Payment captured and verified by the server.');
            onRefresh();
          } catch (verificationError) {
            setError(parseApiError(verificationError));
            onRefresh();
          } finally {
            setBusy(false);
          }
        },
        modal: {
          ondismiss: () => {
            setBusy(false);
            setNotice('Checkout was closed. If money was captured, the payment will appear after verification or reconciliation.');
            onRefresh();
          },
        },
      });

      checkout.on('payment.failed', (response) => {
        setError(
          response?.error?.description ||
            'The payment attempt failed. No payment has been marked as paid.',
        );
        onRefresh();
      });
      checkout.open();
      setBusy(false);
    } catch (paymentError) {
      setError(parseApiError(paymentError));
      setBusy(false);
    }
  };

  const handlePay = () => {
    if (isSimulated) startSimulatedPayment();
    else startRazorpayPayment();
  };

  const openWhatsAppReceipt = async () => {
    setBusy(true);
    setError('');
    try {
      const result = await api.get(
        `/public/orders/${order.publicId}/whatsapp-receipt?tableToken=${encodeURIComponent(token)}`,
      );
      window.open(result.url, '_blank', 'noopener,noreferrer');
      setWhatsappOpened(true);
      setWhatsappConfirmed(false);
      addToast('WhatsApp opened. Press Send there manually.', 'info');
    } catch (receiptError) {
      setError(parseApiError(receiptError));
    } finally {
      setBusy(false);
    }
  };

  const paymentTone = isPaid ? 'success' : order.paymentStatus === 'REFUNDED' ? 'info' : 'warning';

  return (
    <section className="payment-panel" aria-label="Payment">
      <div className="payment-panel-head">
        <div>
          <span className="eyebrow">Settlement</span>
          <h2>Payment</h2>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {isPaid || ['PARTIALLY_REFUNDED', 'REFUNDED'].includes(order.paymentStatus) ? (
        <div className="payment-verified">
          <div className="verified-seal">
            <CheckCircle2 size={27} />
          </div>
          <div>
            <h3>
              {order.paymentStatus === 'REFUNDED'
                ? 'Payment refunded'
                : order.paymentStatus === 'PARTIALLY_REFUNDED'
                  ? 'Payment partly refunded'
                  : order.payment?.isSimulated
                    ? 'Simulated payment complete'
                    : 'Payment verified'}
            </h3>
            <p>
              {order.payment?.isSimulated
                ? 'Development mode only. This record proves the local flow works; it does not represent a real payment.'
                : `Verified ${order.payment?.verifiedVia?.replaceAll('_', ' ') || 'by the payment gateway'}. The browser's redirect or a screenshot alone can never mark an order paid.`}
            </p>
          </div>
        </div>
      ) : (
        <InlineAlert
          tone={isSimulated ? 'warning' : 'info'}
          title={isSimulated ? 'Local payment simulation' : 'Razorpay test checkout'}
          icon={isSimulated ? TestTube2 : CreditCard}
        >
          {isSimulated ? (
            <p>
              No money moves and no gateway verification occurs. This mode is automatically disabled
              in production. Switch <code>PAYMENT_MODE=razorpay</code> to test real signature and
              webhook verification.
            </p>
          ) : (
            <p>
              The payment order is created on the server for the exact database total. Checkout uses
              Razorpay test mode.
            </p>
          )}
        </InlineAlert>
      )}

      {error && (
        <div className="form-error" role="alert">
          <TriangleAlert size={16} /> {error}
        </div>
      )}
      {notice && <div className="form-notice">{notice}</div>}

      <div className="payment-total">
        <span>Amount due</span>
        <strong>{formatMoney(order.totalPaise)}</strong>
      </div>

      {canPay && (
        <>
          <button
            type="button"
            className={isSimulated ? 'btn btn-warning btn-block btn-lg' : 'btn btn-primary btn-block btn-lg'}
            onClick={handlePay}
            disabled={busy || !config}
          >
            {busy ? <Spinner size={18} /> : isSimulated ? <TestTube2 size={18} /> : <CreditCard size={18} />}
            {busy
              ? 'Working…'
              : isSimulated
                ? 'Run simulated payment (dev)'
                : `Pay ${formatMoney(order.totalPaise)} securely`}
          </button>
          {isSimulated && (
            <p className="simulation-caption">
              This button completes a fake local payment so you can test the receipt and WhatsApp
              gating. It is never available in production.
            </p>
          )}
        </>
      )}

      {order.paymentStatus === 'PAYMENT_PENDING' && (
        <InlineAlert tone="info" title="Payment pending">
          <p>
            A payment attempt exists but has not been verified as captured. It will be checked again
            when the gateway notifies us or an admin reconciles it.
          </p>
        </InlineAlert>
      )}

      {isPaid && (
        <div className="payment-actions">
          <button type="button" className="btn btn-primary btn-block" onClick={openWhatsAppReceipt} disabled={busy}>
            {busy ? <Spinner size={17} /> : <MessageCircle size={17} />}
            Share receipt on WhatsApp
          </button>
          <button type="button" className="btn btn-outline btn-block" onClick={() => window.print()}>
            <Printer size={17} /> Print itemised bill
          </button>
          <ManualSendNotice />
          {whatsappOpened && (
            <div className="send-confirmation">
              <p>
                WhatsApp should now be open with the prefilled receipt. Nothing has been sent yet.
                Press <strong>Send</strong> in WhatsApp, then confirm below.
              </p>
              {whatsappConfirmed ? (
                <span className="confirmed-send">
                  <Check size={15} /> You confirmed manually pressing Send.
                </span>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setWhatsappConfirmed(true);
                    addToast('Manual WhatsApp send confirmed.', 'success');
                  }}
                >
                  <Check size={15} /> I pressed Send in WhatsApp
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {order.payment && (
        <dl className="payment-details">
          <div>
            <dt>Provider</dt>
            <dd>{order.payment.isSimulated ? 'Simulated (development)' : 'Razorpay'}</dd>
          </div>
          <div>
            <dt>Payment status</dt>
            <dd>{paymentMeta(order.paymentStatus).label}</dd>
          </div>
          <div>
            <dt>Verification</dt>
            <dd>{order.payment.verifiedVia?.replaceAll('_', ' ') || 'Not verified'}</dd>
          </div>
          {order.payment.providerPaymentId && (
            <div>
              <dt>Gateway payment ID</dt>
              <dd className="mono">{order.payment.providerPaymentId}</dd>
            </div>
          )}
          {order.payment.paidAt && (
            <div>
              <dt>Paid at</dt>
              <dd>{formatDateTime(order.payment.paidAt)}</dd>
            </div>
          )}
          {order.payment.refundedPaise > 0 && (
            <div>
              <dt>Refunded</dt>
              <dd>{formatMoney(order.payment.refundedPaise)}</dd>
            </div>
          )}
        </dl>
      )}

      <div className="security-note">
        <ShieldCheck size={16} />
        <span>
          Payments are confirmed only by server-side signature verification, webhook verification or
          authenticated gateway reconciliation. Screenshots, client-side state and QR scans alone
          never mark a bill paid.
        </span>
      </div>

      {!canPay && !isPaid && order.paymentStatus === 'UNPAID' && order.status === 'CANCELLED' && (
        <div className="form-notice">This order was cancelled, so no payment is due.</div>
      )}

      {order.status === 'SERVED' && isPaid && (
        <button type="button" className="btn btn-ghost btn-block" onClick={onRefresh}>
          <RefreshCw size={15} /> Refresh payment status
        </button>
      )}
    </section>
  );
}
