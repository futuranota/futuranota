import { Link } from 'react-router-dom';
import { PATHS } from '../lib/paths.js';

const OPPS = [
  {
    tag: 'CERAMICS',
    title: 'The Companion Cup',
    desc: 'A roaster launches a single-origin. You ship hand-thrown stoneware mugs tuned to that exact cup profile — on shelves the day the beans drop.',
    org: ['#object  NovaBrew launch', '#problem  generic mugs, ship cold', '#make  matte stoneware, 6-batch', '#window  day 0 → day 9'],
    downloads: '2.3k', trend: true,
  },
  {
    tag: 'WOOD',
    title: 'Drop-Day Packaging',
    desc: 'A sneaker silhouette drops. You laser-cut walnut display plinths and slip-cases that collectors buy to stage the unboxing.',
    org: ['#object  silhouette drop', '#problem  flat, forgettable box', '#make  walnut plinth + case', '#window  day 0 → day 5'],
    downloads: '1.7k', trend: false,
  },
  {
    tag: 'PRINT / DESIGN',
    title: 'Launch Merch, Hand-Pressed',
    desc: 'A creator launches a course. You screen-print a small-batch poster series that turns their announcement into something fans frame.',
    org: ['#object  course launch', '#problem  no physical artifact', '#make  3-color riso, 50 ea', '#window  day 0 → day 14'],
    downloads: '980', trend: true,
  },
  {
    tag: 'TECH / COMMERCE',
    title: 'AI Product-Photo Studio',
    desc: 'A DTC brand opens pre-orders. You spin up a styled AI photography service so their grid is full before the first ship.',
    org: ['#object  pre-order brand', '#problem  empty product grid', '#make  AI + styled set, 40 shots', '#window  day -3 → day 7'],
    downloads: '4.1k', trend: true,
  },
];

function OppCard({ o }) {
  return (
    <article className="opp card" data-screen-label={`opp-${o.title}`}>
      <div className="opp__illu ph" style={{ aspectRatio: '16 / 9' }}>
        <span className="ph__tag">illustration · {o.tag.toLowerCase()}</span>
      </div>
      <div className="opp__body">
        <div className="eyebrow-row">
          <span className="chip chip--accent">{o.tag}</span>
          {o.trend && <span className="chip chip--signal"><span className="pulse" />Trending</span>}
        </div>
        <h3 className="h3 opp__title">{o.title}</h3>
        <p className="muted opp__desc">{o.desc}</p>
        <div className="opp__org" style={{ fontFamily: 'Helvetica' }}>
          <div className="opp__org-head mono-sm faint">// how it organizes in futura</div>
          <div className="opp__nodes">
            {o.org.map((n, i) => {
              const [hash, ...rest] = n.split('  ');
              return <div className="node" key={i}><span className="node__hash">{hash}</span>{rest.join('  ')}</div>;
            })}
          </div>
        </div>
        <div className="opp__foot">
          <div className="opp__cta">
            <a href="#" className="btn btn-primary btn-sm">Download prototype</a>
            <Link to={PATHS.app} className="btn btn-ghost btn-sm">Open in Futura</Link>
          </div>
          <span className="opp__stat mono-sm faint">★ {o.downloads} downloads</span>
        </div>
      </div>
    </article>
  );
}

export function Horizon() {
  return (
    <section className="section" id="horizon" data-screen-label="horizon">
      <div className="container">
        <div className="block-head">
          <div className="section-head">
            <span className="eyebrow"><span className="tick" />HORIZON OPPORTUNITIES</span>
            <h2 className="h2">Ideas, already shaped into business models.</h2>
            <p className="lead">See a real opportunity, watch how it organizes inside Futura, download the prototype, and start building before the window closes.</p>
          </div>
          <Link to={PATHS.marketplace} className="link-arrow block-head__link">Browse all <span className="arrow">→</span></Link>
        </div>
        <div className="opp-grid grid">
          {OPPS.map((o) => <OppCard key={o.title} o={o} />)}
        </div>
      </div>
    </section>
  );
}
