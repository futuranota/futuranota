import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getBlogNavSections } from '../lib/content.js';
import { PATHS } from '../lib/paths.js';

function MegaCard({ card }) {
  const inner = (
    <>
      <div className="blog-nav-card__body">
        <h4 className="blog-nav-card__title">{card.title}</h4>
        {card.description ? (
          <p className="blog-nav-card__desc muted">{card.description}</p>
        ) : null}
      </div>
      <span className="blog-nav-card__arrow" aria-hidden>→</span>
    </>
  );

  if (card.href?.startsWith('/')) {
    return (
      <Link to={card.href} className="blog-nav-card card" onClick={(e) => e.stopPropagation()}>
        {inner}
      </Link>
    );
  }

  return (
    <a href={card.href || '#'} className="blog-nav-card card">
      {inner}
    </a>
  );
}

export function BlogNavMegaMenu({ open, onClose }) {
  const menuId = useId();
  const rootRef = useRef(null);
  const [activeSection, setActiveSection] = useState('blogs');

  const sections = getBlogNavSections();
  const section = sections.find((s) => s.id === activeSection) || sections[0];

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    const onPointer = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={rootRef}
      id={menuId}
      className="blog-nav-mega"
      role="region"
      aria-label="Blogs menu"
    >
      <div className="blog-nav-mega__inner container">
        <div className="blog-nav-mega__tabs" role="tablist" aria-label="Blog sections">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={activeSection === s.id}
              className={`blog-nav-mega__tab${activeSection === s.id ? ' is-active' : ''}`}
              onClick={() => setActiveSection(s.id)}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="blog-nav-mega__cards">
          {section.cards.map((card) => (
            <MegaCard key={card.title} card={card} />
          ))}
        </div>
        <Link to={PATHS.blogs} className="blog-nav-mega__all link-arrow" onClick={onClose}>
          View all articles <span className="arrow">→</span>
        </Link>
      </div>
    </div>
  );
}
