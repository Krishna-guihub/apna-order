import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

let toastSeed = 0;
function nextId() {
  toastSeed += 1;
  return `toast-${Date.now()}-${toastSeed}`;
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback(
    (message, type = 'success', duration = 4200) => {
      const id = nextId();
      setToasts((current) => [...current.slice(-3), { id, message, type }]);
      if (duration > 0) {
        window.setTimeout(() => removeToast(id), duration);
      }
      return id;
    },
    [removeToast],
  );

  const value = useMemo(() => ({ addToast, removeToast }), [addToast, removeToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-viewport" aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => {
          const Icon =
            toast.type === 'error'
              ? AlertCircle
              : toast.type === 'info'
                ? Info
                : CheckCircle2;
          return (
            <div className={`toast toast-${toast.type}`} key={toast.id} role="status">
              <Icon size={18} aria-hidden="true" />
              <span>{toast.message}</span>
              <button
                type="button"
                className="toast-close"
                onClick={() => removeToast(toast.id)}
                aria-label="Dismiss notification"
              >
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast must be used inside ToastProvider.');
  return context;
}
