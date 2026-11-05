import { Link } from 'react-router-dom';
import { ArrowLeft, SearchX } from 'lucide-react';
import { Brand } from '../components/ui.jsx';

export default function NotFoundPage() {
  return (
    <div className="not-found-page">
      <div className="not-found-card">
        <Brand />
        <span className="eyebrow">404 · Off the menu</span>
        <SearchX size={44} />
        <h1>We couldn’t find that page.</h1>
        <p>The link may be old, mistyped, or the table QR may have been rotated.</p>
        <div className="not-found-actions">
          <Link to="/" className="btn btn-primary">
            <ArrowLeft size={16} /> Back home
          </Link>
          <Link to="/login" className="btn btn-outline">
            Staff sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
