import { useEffect, useId, useMemo, useRef, useState } from 'react';
import './storage-district.css';

function Icon({ name, size = 16, strokeWidth = 1.7, ...rest }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {name === 'hardDrive' ? (
        <>
          <path d="M22 12H2" />
          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
          <path d="M6 16h.01M10 16h.01" />
        </>
      ) : null}
      {name === 'box' ? (
        <>
          <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
          <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
        </>
      ) : null}
      {name === 'list' ? (
        <>
          <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
        </>
      ) : null}
      {name === 'chevronDown' ? <path d="m6 9 6 6 6-6" /> : null}
      {name === 'chevronRight' ? <path d="m9 18 6-6-6-6" /> : null}
      {name === 'arrowLeft' ? <path d="m12 19-7-7 7-7M19 12H5" /> : null}
      {name === 'arrowUpRight' ? <path d="M7 7h10v10M7 17 17 7" /> : null}
      {name === 'folder' ? (
        <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
      ) : null}
      {name === 'file' ? (
        <>
          <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
          <path d="M14 2v6h6" />
        </>
      ) : null}
      {name === 'calendar' ? (
        <>
          <path d="M8 2v4M16 2v4" />
          <rect width="18" height="18" x="3" y="4" rx="2" />
          <path d="M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
        </>
      ) : null}
    </svg>
  );
}

export function sizeOf(node) {
  if (node.kind === 'folder' && node.children) {
    return node.children.reduce((total, child) => total + sizeOf(child), 0);
  }
  return Math.max(0, Number.isFinite(node.bytes) ? node.bytes : 0);
}

function filesOf(node) {
  if (node.kind === 'file') return 1;
  return node.children?.reduce((total, child) => total + filesOf(child), 0) ?? 0;
}

function sizeLabel(bytes) {
  if (bytes < 1000) return `${Math.round(bytes)} B`;
  const index = Math.min(4, Math.floor(Math.log10(bytes) / 3));
  const digits = index >= 3 ? 1 : 0;
  const value = (bytes / 1000 ** index).toLocaleString('en-US', { maximumFractionDigits: digits });
  return `${value} ${['B', 'KB', 'MB', 'GB', 'TB'][index]}`;
}

function points(vertices) {
  return vertices.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
}

function modifiedLabel(date) {
  if (!date || Number.isNaN(new Date(date).getTime())) return 'Not specified';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(date));
}

function district(items, width, height) {
  const columns = Math.min(4, Math.ceil(Math.sqrt(Math.max(1, items.length))));
  const rows = Math.ceil(Math.max(1, items.length) / columns);
  const maximum = Math.max(1, ...items.map(sizeOf));
  const project = (x, y, z = 0) => [(x - y) * 0.86, (x + y) * 0.43 - z];
  const raw = items.map((node, index) => {
    const x = (index % columns) * 1.3;
    const y = Math.floor(index / columns) * 1.3;
    const side = 0.87;
    const z = sizeOf(node) / maximum * 1.35;
    return {
      node,
      bytes: sizeOf(node),
      depth: x + y,
      base: [project(x, y), project(x + side, y), project(x + side, y + side), project(x, y + side)],
      roof: [project(x, y, z), project(x + side, y, z), project(x + side, y + side, z), project(x, y + side, z)],
    };
  });
  const ground = [
    project(-0.3, -0.3),
    project(columns * 1.3 - 0.14, -0.3),
    project(columns * 1.3 - 0.14, rows * 1.3 - 0.14),
    project(-0.3, rows * 1.3 - 0.14),
  ];
  const vertices = [...ground, ...raw.flatMap((block) => [...block.roof, ...block.base])];
  const minX = Math.min(...vertices.map((p) => p[0]));
  const maxX = Math.max(...vertices.map((p) => p[0]));
  const minY = Math.min(...vertices.map((p) => p[1]));
  const maxY = Math.max(...vertices.map((p) => p[1]));
  const scale = Math.min((width - 32) / (maxX - minX), (height - 24) / (maxY - minY));
  const fit = ([x, y]) => [
    (x - minX) * scale + (width - (maxX - minX) * scale) / 2,
    (y - minY) * scale + (height - (maxY - minY) * scale) / 2,
  ];
  return {
    ground: ground.map(fit),
    blocks: raw
      .map((block) => ({
        ...block,
        base: block.base.map(fit),
        roof: block.roof.map(fit),
        level: block.bytes === 0 ? 0 : Math.min(4, Math.ceil(block.bytes / maximum * 4)),
      }))
      .sort((a, b) => a.depth - b.depth),
  };
}

const file = (id, name, bytes) => ({ id, name, bytes, kind: 'file', modifiedAt: '2026-10-05T10:00:00Z' });
const folder = (id, name, children) => ({ id, name, children, kind: 'folder', modifiedAt: '2026-10-06T09:30:00Z' });

/** Placeholder tree until live storage usage is measured. */
export const storageDemoRoot = folder('workspace', 'Workspace', [
  folder('design', 'Product Design', [
    folder('screens', 'Screens', [file('dashboard', 'Dashboard.fig', 820_000_000), file('mobile', 'Mobile flows.fig', 610_000_000)]),
    folder('components', 'Components', [file('system', 'Design system.fig', 470_000_000), file('tokens', 'Tokens.json', 48_000)]),
    file('prototype', 'Prototype.mp4', 1_220_000_000),
  ]),
  folder('engineering', 'Engineering', [
    folder('artifacts', 'Build artifacts', [file('build-main', 'Production.tar.gz', 1_750_000_000), file('build-preview', 'Preview.tar.gz', 640_000_000)]),
    file('source', 'Source.zip', 220_000_000),
    file('coverage', 'Coverage.html', 17_000_000),
  ]),
  folder('media', 'Media', [
    folder('recordings', 'Recordings', [file('launch', 'Launch edit.mov', 4_450_000_000), file('demo', 'Product demo.mp4', 2_180_000_000)]),
    file('stills', 'Product stills.zip', 940_000_000),
  ]),
  folder('brand', 'Brand', [
    file('identity', 'Brand identity.pdf', 148_000_000),
    file('fonts', 'Font family.zip', 36_000_000),
    file('logos', 'Logos.svg', 520_000),
  ]),
  folder('research', 'Research', [
    folder('interviews', 'Interviews', [file('interview-a', 'Interview 01.mp4', 1_280_000_000), file('interview-b', 'Interview 02.mp4', 920_000_000)]),
    file('findings', 'Findings.pdf', 11_000_000),
    folder('empty-notes', 'New studies', []),
  ]),
  folder('documents', 'Documents', [
    file('roadmap', 'Roadmap.pdf', 9_200_000),
    file('brief', 'Product brief.docx', 4_600_000),
    file('budget', 'Budget.xlsx', 780_000),
  ]),
  folder('archive', 'Archive', [
    folder('last-year', '2025', [file('project-2025', 'Project archive.zip', 3_280_000_000), file('assets-2025', 'Assets.zip', 1_640_000_000)]),
    file('handover', 'Handover.pdf', 12_000_000),
  ]),
  folder('exports', 'Exports', [
    file('videos', 'Component videos.zip', 2_920_000_000),
    file('thumbnails', 'Thumbnails.zip', 480_000_000),
    file('exports-readme', 'Readme.md', 3200),
  ]),
]);

export default function StorageDistrict({
  root,
  capacityBytes = 64_000_000_000,
  title = 'Storage',
  defaultView = 'district',
  theme = 'light',
  className = '',
  onNodeSelect,
  onNavigate,
}) {
  const [view, setView] = useState(defaultView);
  const [path, setPath] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [sort, setSort] = useState('size');
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState(null);
  const plotRef = useRef(null);
  const id = useId();
  const trail = useMemo(() => {
    const folders = [root];
    for (const nodeId of path) {
      const next = folders.at(-1)?.children?.find((node) => node.id === nodeId && node.kind === 'folder');
      if (!next) break;
      folders.push(next);
    }
    return folders;
  }, [root, path]);
  const current = trail.at(-1);
  const items = useMemo(() => [...(current.children ?? [])].sort((a, b) => (
    sort === 'size' ? sizeOf(b) - sizeOf(a) || a.name.localeCompare(b.name) : a.name.localeCompare(b.name)
  )), [current, sort]);
  const selected = items.find((node) => node.id === selectedId) ?? items[0];
  const total = sizeOf(root);
  const capacity = Math.max(1, capacityBytes);
  const usedPercent = Math.round(total / capacity * 100);
  const sceneHeight = width < 440 ? 210 : 230;
  const scene = useMemo(() => district(items, width, sceneHeight), [items, width, sceneHeight]);

  useEffect(() => {
    const element = plotRef.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(() => setWidth(Math.max(240, element.getBoundingClientRect().width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, [view, current.id, items.length]);

  function select(node) {
    setSelectedId(node.id);
    setHover(null);
    onNodeSelect?.(node);
  }

  function navigate(index) {
    setPath(trail.slice(1, index + 1).map((entry) => entry.id));
    setSelectedId(null);
    setHover(null);
    onNavigate?.(trail[index]);
  }

  function open(node) {
    if (node.kind !== 'folder') return;
    setPath([...trail.slice(1).map((entry) => entry.id), node.id]);
    setSelectedId(null);
    setHover(null);
    onNavigate?.(node);
  }

  function showHover(event, node) {
    if (event.pointerType === 'touch' || !plotRef.current) return;
    const rect = plotRef.current.getBoundingClientRect();
    setHover({
      node,
      x: Math.max(8, Math.min(width - 192, event.clientX - rect.left + 12)),
      y: Math.max(4, Math.min(sceneHeight - 64, event.clientY - rect.top - 58)),
    });
  }

  return (
    <section className={`storage-district ${className}`.trim()} data-theme={theme} aria-label={title}>
      <header className="sd-header">
        <div className="sd-heading">
          <span className="sd-emblem"><Icon name="hardDrive" size={17} /></span>
          <div>
            <h2>{title}</h2>
            <p>A clearer view of your workspace.</p>
          </div>
        </div>
        <div className="sd-switch" role="group" aria-label="Storage view">
          <button type="button" aria-pressed={view === 'district'} onClick={() => { setView('district'); setHover(null); }}>
            <Icon name="box" size={14} />3D
          </button>
          <button type="button" aria-pressed={view === 'list'} onClick={() => { setView('list'); setHover(null); }}>
            <Icon name="list" size={14} />List
          </button>
        </div>
      </header>
      <div className="sd-stats">
        <div><span>Used storage</span><strong>{sizeLabel(total)}</strong><small>of {sizeLabel(capacity)}</small></div>
        <div>
          <span>Available</span>
          <strong>{sizeLabel(Math.max(0, capacity - total))}</strong>
          <small>{usedPercent > 100 ? 'Capacity exceeded' : `${Math.max(0, 100 - usedPercent)}% free`}</small>
        </div>
        <div><span>Total files</span><strong>{filesOf(root).toLocaleString('en-US')}</strong><small>in this workspace</small></div>
      </div>
      <div className="sd-capacity">
        <div
          className="sd-meter"
          role="meter"
          aria-label="Storage capacity used"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.min(100, usedPercent)}
          aria-valuetext={`${sizeLabel(total)} used of ${sizeLabel(capacity)}`}
        >
          <span style={{ width: `${Math.min(100, usedPercent)}%` }} data-over={usedPercent > 100} />
        </div>
        <span>{usedPercent}% used</span>
      </div>
      <div className="sd-browser-bar">
        <nav className="sd-breadcrumb" aria-label="Folder path">
          {trail.map((entry, index) => (
            <span key={entry.id} className="sd-crumb">
              {index > 0 ? <Icon name="chevronRight" size={12} /> : null}
              <button type="button" onClick={() => navigate(index)} aria-current={index === trail.length - 1 ? 'location' : undefined}>
                {index === 0 ? <Icon name="folder" size={12} /> : null}
                <span>{entry.name}</span>
              </button>
            </span>
          ))}
        </nav>
        <label className="sd-sort">
          <span className="sd-sr-only">Sort storage items</span>
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="size">By size</option>
            <option value="name">By name</option>
          </select>
          <Icon name="chevronDown" size={12} />
        </label>
      </div>
      {!items.length ? (
        <div className="sd-empty">
          <Icon name="folder" size={25} strokeWidth={1.4} />
          <strong>This folder is empty</strong>
          <p>There are no items to inspect here.</p>
          {trail.length > 1 ? (
            <button type="button" onClick={() => navigate(trail.length - 2)}>
              <Icon name="arrowLeft" size={13} />Back to parent
            </button>
          ) : null}
        </div>
      ) : view === 'district' ? (
        <>
          <div className="sd-plot" ref={plotRef} onPointerLeave={() => setHover(null)}>
            <svg className="sd-chart" width="100%" height={sceneHeight} viewBox={`0 0 ${width} ${sceneHeight}`} role="img" aria-labelledby={`${id}-title ${id}-description`}>
              <title id={`${id}-title`}>{`Storage map of ${current.name}`}</title>
              <desc id={`${id}-description`}>{items.length} items. Each block represents an item; height and blue intensity represent its size. Choose any item using the selector below for keyboard access.</desc>
              <polygon points={points(scene.ground)} fill="var(--sd-ground)" />
              {scene.blocks.map((block) => {
                const centerX = block.roof.reduce((sum, point) => sum + point[0], 0) / 4;
                const centerY = block.roof.reduce((sum, point) => sum + point[1], 0) / 4;
                const hovered = hover?.node.id === block.node.id;
                const isSelected = selected?.id === block.node.id;
                return (
                  <g
                    key={block.node.id}
                    className={`sd-block${hovered ? ' sd-hovered' : ''}${isSelected ? ' sd-selected' : ''}`}
                    data-level={block.level}
                    onClick={() => select(block.node)}
                    onDoubleClick={() => open(block.node)}
                    onPointerEnter={(event) => showHover(event, block.node)}
                    onPointerMove={(event) => showHover(event, block.node)}
                  >
                    <polygon className="sd-left" points={points([block.roof[3], block.roof[2], block.base[2], block.base[3]])} />
                    <polygon className="sd-right" points={points([block.roof[1], block.roof[2], block.base[2], block.base[1]])} />
                    <polygon className="sd-roof" points={points(block.roof)} />
                    <Icon
                      name={block.node.kind === 'folder' ? 'folder' : 'file'}
                      x={centerX - 7}
                      y={centerY - 7}
                      width={14}
                      height={14}
                      size={14}
                      strokeWidth={1.4}
                      style={{ color: 'var(--sd-icon)', pointerEvents: 'none' }}
                    />
                  </g>
                );
              })}
            </svg>
            {hover ? (
              <div className="sd-tooltip" role="tooltip" style={{ left: hover.x, top: hover.y }}>
                <strong>{hover.node.name}</strong>
                <span>{sizeLabel(sizeOf(hover.node))} · {hover.node.kind === 'folder' ? `${filesOf(hover.node)} files` : 'File'}</span>
              </div>
            ) : null}
          </div>
          <div className="sd-map-caption">
            <span>Height = size<span className="sd-dot">·</span>{items.length} items</span>
            <span>Double-click a folder to open</span>
          </div>
        </>
      ) : (
        <div className="sd-list" role="list" aria-label={`Items in ${current.name}`}>
          <div className="sd-list-heading"><span>Name</span><span>Size</span></div>
          {items.map((node) => (
            <div className={`sd-list-row${selected?.id === node.id ? ' sd-is-selected' : ''}`} role="listitem" key={node.id}>
              <button type="button" className="sd-select-row" aria-pressed={selected?.id === node.id} onClick={() => select(node)}>
                <Icon name={node.kind === 'folder' ? 'folder' : 'file'} size={15} />
                <span>
                  <strong>{node.name}</strong>
                  <small>{node.kind === 'folder' ? `${filesOf(node)} files` : node.name.split('.').at(-1)?.toUpperCase() ?? 'File'}</small>
                </span>
                <span className="sd-row-size">{sizeLabel(sizeOf(node))}</span>
              </button>
              {node.kind === 'folder' ? (
                <button className="sd-open-row" type="button" aria-label={`Open ${node.name}`} onClick={() => open(node)}>
                  <Icon name="chevronRight" size={14} />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      )}
      {selected ? (
        <div className="sd-inspector">
          <div className="sd-inspector-top">
            <label className="sd-node-select">
              <span className="sd-sr-only">Inspect storage item</span>
              <select
                value={selected.id}
                onChange={(event) => {
                  const node = items.find((item) => item.id === event.target.value);
                  if (node) select(node);
                }}
              >
                {items.map((node) => <option key={node.id} value={node.id}>{node.name}</option>)}
              </select>
              <Icon name="chevronDown" size={13} />
            </label>
            {selected.kind === 'folder' ? (
              <button type="button" className="sd-open" onClick={() => open(selected)}>
                Open folder<Icon name="arrowUpRight" size={13} />
              </button>
            ) : null}
          </div>
          <div className="sd-selected-summary" aria-live="polite" aria-atomic="true">
            <span>
              {sizeLabel(sizeOf(selected))}
              <span className="sd-dot">·</span>
              {selected.kind === 'folder' ? `${filesOf(selected)} files` : '1 file'}
            </span>
            <span>{total > 0 ? (sizeOf(selected) / total * 100).toFixed(1) : '0.0'}% of workspace</span>
          </div>
          <details className="sd-details" key={selected.id}>
            <summary>Item details<Icon name="chevronDown" size={13} /></summary>
            <dl>
              <div>
                <dt>Type</dt>
                <dd>{selected.kind === 'folder' ? 'Folder' : `${selected.name.split('.').at(-1)?.toUpperCase() ?? 'Unknown'} file`}</dd>
              </div>
              <div>
                <dt><Icon name="calendar" size={12} />Modified</dt>
                <dd>{modifiedLabel(selected.modifiedAt)}</dd>
              </div>
              <div>
                <dt>Size in bytes</dt>
                <dd>{sizeOf(selected).toLocaleString('en-US')}</dd>
              </div>
            </dl>
          </details>
        </div>
      ) : null}
    </section>
  );
}
