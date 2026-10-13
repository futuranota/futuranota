import { getHorizon } from '../lib/content.js';
import { usePageTina, pageTinaProps } from '../context/TinaVisualEditing.jsx';

const KIT_LABELS = {
  'website-plugin': 'Website + plugin',
  instructions: 'Instructions only',
};

function normalizeItem(raw = {}, index = 0) {
  const org = Array.isArray(raw.org) ? raw.org.filter(Boolean) : [];
  const includes = Array.isArray(raw.includes) ? raw.includes.filter(Boolean) : [];
  const kitType = raw.kitType === 'website-plugin' ? 'website-plugin' : 'instructions';
  const previewUrl = typeof raw.previewUrl === 'string' ? raw.previewUrl.trim() : '';
  const downloadUrl = raw.downloadUrl || '#';
  const free = Boolean(raw.free) || raw.price === 'Free';

  return {
    key: raw.id || raw.title || `horizon-item-${index}`,
    tag: raw.tag || 'HORIZON',
    title: raw.title || '',
    desc: raw.desc || '',
    org,
    includes,
    free,
    price: raw.price || (free ? 'Free' : ''),
    kitType,
    kitLabel: KIT_LABELS[kitType],
    rating: raw.rating || '',
    reviews: raw.reviews ?? null,
    downloads: raw.downloads || '',
    trend: Boolean(raw.trend),
    hot: Boolean(raw.hot),
    downloadUrl,
    previewUrl,
    image: typeof raw.image === 'string' ? raw.image.trim() : '',
  };
}

function HorizonCard({ item }) {
  const showPreview = Boolean(item.previewUrl);
  const stat = item.free
    ? (item.downloads ? `★ ${item.downloads} downloads` : '')
    : [
        item.rating ? `★ ${item.rating}` : '',
        item.reviews != null ? `${item.reviews} reviews` : '',
      ].filter(Boolean).join(' · ');

  return (
    <article className="horizon-card card" data-screen-label={`horizon-${item.title}`}>
      <div
        className={`horizon-card__preview${item.image ? ' has-image' : ' ph'}`}
        style={{ aspectRatio: '16 / 10' }}
      >
        {item.image ? (
          <img className="horizon-card__preview-img" src={item.image} alt="" />
        ) : (
          <span className="ph__tag">kit preview · {item.tag.toLowerCase()}</span>
        )}
        {item.free && <span className="chip chip--signal horizon-card__badge">Free</span>}
        {item.hot && !item.free && (
          <span className="chip chip--accent horizon-card__badge">
            <span className="pulse" style={{ background: 'var(--accent)' }} />Best seller
          </span>
        )}
        {item.trend && !item.hot && (
          <span className="chip chip--signal horizon-card__badge"><span className="pulse" />Trending</span>
        )}
      </div>
      <div className="horizon-card__body">
        <div className="eyebrow-row">
          <span className="chip chip--accent">{item.tag}</span>
          <span className="chip">{item.kitLabel}</span>
        </div>
        <h3 className="h3 horizon-card__title">{item.title}</h3>
        <p className="muted horizon-card__desc">{item.desc}</p>

        {item.org.length > 0 && (
          <div className="opp__org">
            <div className="opp__org-head mono-sm faint">// how it organizes in futura</div>
            <div className="opp__nodes">
              {item.org.map((n, i) => {
                const [hash, ...rest] = n.split('  ');
                return (
                  <div className="node" key={i}>
                    <span className="node__hash">{hash}</span>
                    {rest.join('  ')}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {item.includes.length > 0 && (
          <div className="horizon-card__includes">
            {item.includes.map((label) => (
              <span className="chip" key={label}>{label}</span>
            ))}
          </div>
        )}

        <div className="horizon-card__foot">
          <div className="horizon-card__meta">
            <span className="horizon-card__price">{item.price}</span>
            {stat ? <span className="mono-sm faint">{stat}</span> : null}
          </div>
          <div className="horizon-card__cta">
            <a
              href={item.downloadUrl}
              className="btn btn-sm btn-primary"
              {...(item.downloadUrl.endsWith('.zip') ? { download: true } : {})}
            >
              Download &amp; import
            </a>
            {showPreview ? (
              <a
                href={item.previewUrl}
                className="btn btn-ghost btn-sm"
                target="_blank"
                rel="noopener noreferrer"
              >
                Preview
              </a>
            ) : (
              <span className="btn btn-ghost btn-sm is-disabled" aria-disabled="true" title="Preview available on website + plugin kits">
                Preview
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export function Horizon() {
  const pageTina = usePageTina();
  const raw = pageTina?.document ?? getHorizon();
  const fallback = getHorizon();
  const header = { ...fallback.header, ...raw.header };
  const items = (raw.opportunities ?? fallback.opportunities ?? []).map(normalizeItem);

  return (
    <section className="section horizon" id="horizon" data-screen-label="horizon">
      <div className="container">
        <div className="block-head">
          <div className="section-head">
            <span className="eyebrow" {...pageTinaProps('header.eyebrow')}><span className="tick" />{header.eyebrow}</span>
            <h2 className="h2" {...pageTinaProps('header.title')}>{header.title}</h2>
            <p className="lead" {...pageTinaProps('header.lead')}>{header.lead}</p>
          </div>
          <a href="#horizon-grid" className="link-arrow block-head__link">
            {header.linkLabel} <span className="arrow">→</span>
          </a>
        </div>
        <div className="horizon-grid grid" id="horizon-grid">
          {items.map((item) => (
            <HorizonCard key={item.key} item={item} />
          ))}
        </div>
      </div>
    </section>
  );
}
