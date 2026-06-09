import { Link } from 'react-router-dom';
import { Mark } from './Mark.jsx';
import { PATHS } from '../lib/paths.js';

export function Wordmark() {
  return (
    <Link to={PATHS.home} className="brand" aria-label="Futura Nota home">
      <span className="brand__mark"><Mark /></span>
      <span className="brand__type">
        FUTURA<span className="brand__type-thin"> NOTA</span>
      </span>
    </Link>
  );
}
