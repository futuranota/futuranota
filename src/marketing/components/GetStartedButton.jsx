import { Link } from 'react-router-dom';

export function GetStartedButton({ to }) {
  return (
    <Link to={to} className="get-started">
      <span className="get-started__label">Get Started</span>
      <i className="get-started__icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9 6l6 6-6 6" />
        </svg>
      </i>
    </Link>
  );
}
