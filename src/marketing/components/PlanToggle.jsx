/** Segmented Free / Pro control — same pattern as LanguageToggle. */
export function PlanToggle({ value, onChange, className = '' }) {
  return (
    <div
      className={`lang-toggle plan-toggle notranslate${className ? ` ${className}` : ''}`}
      role="group"
      aria-label="Plan"
      data-i18n-skip
    >
      <button
        type="button"
        className={`lang-toggle__btn${value === 'free' ? ' is-active' : ''}`}
        aria-pressed={value === 'free'}
        onClick={() => onChange('free')}
      >
        free
      </button>
      <button
        type="button"
        className={`lang-toggle__btn${value === 'pro' ? ' is-active' : ''}`}
        aria-pressed={value === 'pro'}
        onClick={() => onChange('pro')}
      >
        pro
      </button>
    </div>
  );
}
