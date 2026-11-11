import { Link } from 'react-router-dom';
import { BrandCursor } from './BrandCursor.jsx';
import { PATHS } from '../lib/paths.js';

export function Wordmark({ to = PATHS.home, className = '' }) {
  return (
    <Link
      to={to}
      className={['brand', className].filter(Boolean).join(' ')}
      aria-label="Futura Nota home"
    >
      <span className="brand__mark">
        <BrandCursor size={28} />
      </span>
      <span className="brand__type">Futura Nota</span>
    </Link>
  );
}
