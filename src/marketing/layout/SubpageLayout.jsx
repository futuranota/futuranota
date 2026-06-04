import { Link } from 'react-router-dom';
import { PATHS } from '../lib/paths.js';

export function SubpageLayout({ children }) {
  return (
    <>
      <div className="container subpage__top">
        <Link className="back-link" to={PATHS.home}>
          <span className="back-link__arrow">←</span> Volver al inicio
        </Link>
      </div>
      {children}
    </>
  );
}
