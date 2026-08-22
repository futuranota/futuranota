import { useEffect, useState } from 'react';

/** @typedef {{ id: string; title: string; children?: NavItemData[] }} NavItemData */

export const MANAGEMENT_SECTIONS = {
  api: 'api-integrations',
  users: 'users',
  calls: 'recent-calls',
  gastos: 'gastos',
  storage: 'storage',
};

export const MANAGEMENT_NAV_IDS = {
  [MANAGEMENT_SECTIONS.api]: 'mgmt-api',
  [MANAGEMENT_SECTIONS.users]: 'mgmt-users',
  [MANAGEMENT_SECTIONS.calls]: 'mgmt-calls',
  [MANAGEMENT_SECTIONS.gastos]: 'mgmt-gastos',
  [MANAGEMENT_SECTIONS.storage]: 'mgmt-storage',
};

const SECTION_BY_NAV_ID = Object.fromEntries(
  Object.entries(MANAGEMENT_NAV_IDS).map(([section, navId]) => [navId, section]),
);

/** @type {{ items: NavItemData[] }[]} */
const NAV_GROUPS = [
  {
    items: [
      {
        id: 'management',
        title: 'Management',
        children: [
          { id: 'mgmt-api', title: 'API Integrations' },
          { id: 'mgmt-users', title: 'Users' },
          { id: 'mgmt-calls', title: 'Recent Calls' },
          { id: 'mgmt-gastos', title: 'Gastos' },
          { id: 'mgmt-storage', title: 'Storage & Quotas' },
        ],
      },
      { id: 'step-shares', title: 'Step Shares' },
      { id: 'signals', title: 'Signals' },
      { id: 'campaigns', title: 'Campaign Detector' },
      { id: 'horizon-kits', title: 'Horizon kits' },
      { id: 'horizon', title: 'Horizon Scan' },
      { id: 'sources', title: 'Scan Sources' },
    ],
  },
];

function Chevron({ open }) {
  return (
    <svg
      className={`admin-nav__chevron${open ? ' is-open' : ''}`}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HashDot() {
  return (
    <svg
      className="admin-nav__icon"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="2.5" fill="currentColor" opacity="0.55" />
    </svg>
  );
}

/**
 * @param {{
 *   item: NavItemData;
 *   activeId: string;
 *   onSelect: (id: string) => void;
 *   level?: number;
 *   forceOpen?: boolean;
 * }} props
 */
function NavItem({ item, activeId, onSelect, level = 0, forceOpen = false }) {
  const hasChildren = Boolean(item.children?.length);
  const childActive = hasChildren && item.children.some((c) => c.id === activeId);
  const isActive = activeId === item.id || childActive;
  const [isOpen, setIsOpen] = useState(forceOpen || childActive);

  useEffect(() => {
    if (forceOpen || childActive) setIsOpen(true);
  }, [forceOpen, childActive]);

  function handleClick() {
    if (hasChildren) {
      setIsOpen((v) => !v);
      return;
    }
    onSelect(item.id);
  }

  return (
    <div className="admin-nav__item-wrap">
      <button
        type="button"
        className={`admin-nav__row${isActive && !hasChildren ? ' is-active' : ''}${hasChildren && childActive ? ' is-parent-active' : ''}`}
        style={{ paddingLeft: `${level * 12 + 10}px` }}
        onClick={handleClick}
        aria-expanded={hasChildren ? isOpen : undefined}
      >
        <span className="admin-nav__row-main">
          {level > 0 ? <HashDot /> : null}
          <span className="admin-nav__title">{item.title}</span>
        </span>
        {hasChildren ? <Chevron open={isOpen} /> : null}
      </button>

      {hasChildren ? (
        <div className={`admin-nav__children${isOpen ? ' is-open' : ''}`}>
          <div className="admin-nav__children-inner">
            <div
              className="admin-nav__rail"
              style={{ left: `${level * 12 + 16}px` }}
              aria-hidden="true"
            />
            {item.children.map((child) => (
              <NavItem
                key={child.id}
                item={child}
                activeId={activeId}
                onSelect={onSelect}
                level={level + 1}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Resolve sidebar active id from page tab + management section.
 * @param {string} tab
 * @param {string} managementSection
 */
export function resolveAdminNavActiveId(tab, managementSection) {
  if (tab === 'management') {
    return MANAGEMENT_NAV_IDS[managementSection] || MANAGEMENT_NAV_IDS[MANAGEMENT_SECTIONS.api];
  }
  return tab;
}

/**
 * @param {string} navId
 * @returns {{ tab: string; managementSection?: string } | null}
 */
export function parseAdminNavSelection(navId) {
  if (SECTION_BY_NAV_ID[navId]) {
    return { tab: 'management', managementSection: SECTION_BY_NAV_ID[navId] };
  }
  if (['signals', 'campaigns', 'horizon', 'horizon-kits', 'sources', 'step-shares'].includes(navId)) {
    return { tab: navId };
  }
  if (navId === 'management') {
    return { tab: 'management', managementSection: MANAGEMENT_SECTIONS.api };
  }
  return null;
}

/**
 * @param {{
 *   activeId: string;
 *   onSelect: (id: string) => void;
 *   className?: string;
 * }} props
 */
export function AdminSidebarNav({ activeId, onSelect, className = '' }) {
  return (
    <nav className={`admin-nav ${className}`.trim()} aria-label="Admin sections">
      {NAV_GROUPS.map((group, idx) => (
        <div key={idx} className="admin-nav__group">
          {group.items.map((item) => (
            <NavItem
              key={item.id}
              item={item}
              activeId={activeId}
              onSelect={onSelect}
              forceOpen={item.id === 'management' && activeId.startsWith('mgmt-')}
            />
          ))}
        </div>
      ))}
    </nav>
  );
}
