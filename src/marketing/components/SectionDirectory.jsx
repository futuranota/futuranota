import { Link } from 'react-router-dom';
import { sectionPath } from '../lib/paths.js';

const DIRECTORY = [
  {
    slug: 'horizon', num: '01', eyebrow: 'HORIZON OPPORTUNITIES',
    title: 'Ideas, already shaped into business models.',
    blurb: 'Real opportunities, shown with how they organize inside Futura. Download the prototype and start building before the window closes.',
    tags: ['The Companion Cup', 'Drop-Day Packaging', 'Launch Merch'],
    cta: 'Browse opportunities', span: 7,
  },
  {
    slug: 'how', num: '02', eyebrow: 'HOW FUTURA WORKS',
    title: 'Think in objects. Move in windows.',
    blurb: 'A ninety-second walk through the whole loop — from spotting a campaign to shipping the thing you make by hand.',
    tags: ['5 steps', '90-sec walkthrough'],
    cta: 'See how it works', span: 5,
  },
  {
    slug: 'marketplace', num: '03', eyebrow: 'HORIZON MARKETPLACE',
    title: 'Ready-made kits. One-click into Futura.',
    blurb: 'Start from a proven model — the downloadable, the domain, the email, even the course. Customize for your window, then ship.',
    tags: ['SaaS Launchpad', 'Ecommerce Setup', '6 kits'],
    cta: 'Open marketplace', span: 5,
  },
  {
    slug: 'blogs', num: '04', eyebrow: 'BLOGS',
    title: 'Shark Tank & the commerce world, as inspiration.',
    blurb: 'Trends, validation, and the AI-powered winners worth copying — read the signal before it lands.',
    tags: ['Shark Tank', 'Ecommerce', 'AI', 'Trends'],
    cta: 'Read the blog', span: 7,
  },
  {
    slug: 'ensenanzas', num: '05', eyebrow: 'ENSEÑANZAS',
    title: 'Learn to think like an entrepreneur.',
    blurb: 'The strategies and frameworks behind the people who turn a launch into a living. Short, practical, and built for makers.',
    tags: ['Marketing 101', 'Product validation', '6 courses'],
    cta: 'Explore courses', span: 12,
  },
];

function DirCard({ d }) {
  return (
    <Link
      className="dir card"
      to={sectionPath(d.slug)}
      style={{ gridColumn: `span ${d.span}` }}
      data-screen-label={`dir-${d.slug}`}
    >
      <div className="dir__head">
        <span className="eyebrow"><span className="tick" />{d.eyebrow}</span>
        <span className="dir__num mono-sm">{d.num}</span>
      </div>
      <h3 className="h2 dir__title">{d.title}</h3>
      <p className="muted dir__blurb">{d.blurb}</p>
      <div className="dir__tags">
        {d.tags.map((t) => <span className="chip" key={t}>{t}</span>)}
      </div>
      <span className="dir__cta link-arrow">{d.cta} <span className="arrow">→</span></span>
    </Link>
  );
}

export function SectionDirectory() {
  return (
    <section className="section directory" id="explore" data-screen-label="directory">
      <div className="container">
        <div className="section-head" style={{ marginBottom: 'clamp(28px,4vw,48px)' }}>
          <span className="eyebrow"><span className="tick" />EXPLORE FUTURA NOTA</span>
          <h2 className="h2">Five windows. Step through any one.</h2>
          <p className="lead">Every part of Futura Nota now lives on its own page. Pick a window below and dive in.</p>
        </div>
        <div className="dir-grid">
          {DIRECTORY.map((d) => <DirCard key={d.slug} d={d} />)}
        </div>
      </div>
    </section>
  );
}
