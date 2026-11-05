import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import LandingPage from './pages/LandingPage.jsx';
import CustomerMenuPage from './pages/CustomerMenuPage.jsx';
import OrderPage from './pages/OrderPage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import KitchenPage from './pages/KitchenPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';

function FullPageLoader() {
  return (
    <div className="full-page-loader">
      <div className="loader-mark">AO</div>
      <div className="spinner" aria-label="Loading" />
    </div>
  );
}

function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageLoader />;
  if (!user) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/kitchen" replace />;
  }
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/t/:token" element={<CustomerMenuPage />} />
      <Route path="/order/:publicId" element={<OrderPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/kitchen"
        element={
          <ProtectedRoute roles={['admin', 'staff']}>
            <KitchenPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={['admin']}>
            <AdminPage />
          </ProtectedRoute>
        }
      />
      <Route path="/staff" element={<Navigate to="/kitchen" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ToastProvider>
  );
}
