import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  PROMPT_ASSET_CATEGORIES,
  assetDisplayUrl,
  filterAssetsByCategory,
  triggerBrowserDownload,
  zipPromptAssets,
} from '../../lib/promptAssets.js';
import {
  currentPromptUserId,
  downloadPromptDocument,
  uploadPromptAsset,
  uploadPromptAssetCover,
} from '../../lib/promptDeskSync.js';
import { PROMPT_LIMIT_COPY } from '../../lib/promptPlanLimits.js';
import './prompt-file-assets.css';

const ACCEPT = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
  'image/*',
  'application/pdf',
  '.pdf',
  'audio/*',
  '.mp3',
  '.wav',
  '.ogg',
  '.m4a',
  '.ttf',
  '.otf',
  '.woff',
  '.woff2',
  '*/*',
].join(',');

function kindLabel(kind) {
  if (kind === 'svg') return 'SVG';
  if (kind === 'image') return 'Image';
  if (kind === 'pdf') return 'PDF';
  if (kind === 'audio') return 'Audio';
  if (kind === 'font') return 'Font';
  return 'File';
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v7" />
      <path d="m8.5 11.5 3.5 3.5 3.5-3.5" />
      <path d="M8 16.5h8" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h8" />
    </svg>
  );
}

function AssetPreview({ asset }) {
  const face = assetDisplayUrl(asset);
  if (face) {
    return <img className="prompt-assets__media" src={face} alt="" />;
  }
  if (asset.kind === 'audio' && asset.url) {
    return (
      <div className="prompt-assets__native">
        <audio className="prompt-assets__audio" controls preload="metadata" src={asset.url}>
          <track kind="captions" />
        </audio>
        <span className="prompt-assets__kind">{kindLabel(asset.kind)}</span>
      </div>
    );
  }
  if (asset.kind === 'pdf' && asset.url) {
    return (
      <div className="prompt-assets__native prompt-assets__native--pdf">
        <iframe className="prompt-assets__pdf" title={asset.name} src={`${asset.url}#toolbar=0`} />
        <span className="prompt-assets__kind">PDF</span>
      </div>
    );
  }
  return (
    <div className="prompt-assets__native prompt-assets__native--plain">
      <span className="prompt-assets__glyph" aria-hidden="true">
        {asset.kind === 'font' ? 'Aa' : asset.kind === 'pdf' ? 'PDF' : 'FILE'}
      </span>
      <span className="prompt-assets__kind">{kindLabel(asset.kind)}</span>
      <span className="prompt-assets__hint">
        {asset.kind === 'font' ? 'Add a cover to preview' : asset.name}
      </span>
    </div>
  );
}

/**
 * Visual asset pack — toolbar row + stage aligned to the home fan cards.
 * Returns two grid children for the prompt split.
 * @param {{ prompt: object, onPatch: Function, onNote?: (msg: string) => void }} props
 */
export default function PromptFileAssets({ prompt, onPatch, onNote }) {
  const assets = prompt?.assets || [];
  const [category, setCategory] = useState('all');
  const [catsOpen, setCatsOpen] = useState(false);
  const [pageIndex, setPageIndex] = useState(0);
  const [busy, setBusy] = useState('');
  const [copied, setCopied] = useState(false);
  const [fanBox, setFanBox] = useState({ height: 0, width: 0, top: 0 });
  const bodyRef = useRef(null);
  const addRef = useRef(null);
  const coverRef = useRef(null);

  const visible = useMemo(
    () => filterAssetsByCategory(assets, category),
    [assets, category],
  );
  const safeIndex = Math.min(Math.max(pageIndex, 0), Math.max(visible.length - 1, 0));
  const current = visible[safeIndex] || null;
  const activeCategory = PROMPT_ASSET_CATEGORIES.find((item) => item.id === category)
    || PROMPT_ASSET_CATEGORIES[0];
  const showCover = current?.kind === 'font';

  useEffect(() => {
    setPageIndex(0);
  }, [category, prompt?.id]);

  useEffect(() => {
    if (pageIndex > 0 && pageIndex >= visible.length) {
      setPageIndex(Math.max(visible.length - 1, 0));
    }
  }, [visible.length, pageIndex]);

  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) return undefined;
    const split = body.closest('.prompt-panel__split');
    const fan = split?.querySelector('.prompt-index__fan');
    if (!fan) return undefined;

    const sync = () => {
      const fr = fan.getBoundingClientRect();
      const br = body.getBoundingClientRect();
      const next = {
        height: Math.round(fr.height),
        width: Math.round(fr.width),
        top: Math.round(fr.top - br.top),
      };
      setFanBox((prev) => (
        prev.height === next.height
          && prev.width === next.width
          && prev.top === next.top
          ? prev
          : next
      ));
    };

    sync();
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(sync)
      : null;
    observer?.observe(fan);
    observer?.observe(body);
    window.addEventListener('resize', sync);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', sync);
    };
  }, [prompt?.id, current?.id]);

  function patchAssets(next) {
    onPatch({ assets: next });
  }

  async function addFiles(fileList) {
    const files = [...(fileList || [])].filter(Boolean);
    if (!files.length) return;
    setBusy('upload');
    try {
      const userId = await currentPromptUserId();
      if (!userId) {
        onNote?.('Sign in to save assets.');
        return;
      }
      const added = [];
      for (const file of files) {
        const uploaded = await uploadPromptAsset(file, prompt.id, userId);
        added.push(uploaded);
      }
      const next = [...(assets || []), ...added];
      patchAssets(next);
      const filtered = filterAssetsByCategory(next, category);
      setPageIndex(Math.max(filtered.length - 1, 0));
    } catch (error) {
      console.warn('[prompt-assets] upload failed', error?.message || error);
      onNote?.(error instanceof Error ? error.message : PROMPT_LIMIT_COPY.storage);
    } finally {
      setBusy('');
    }
  }

  async function setCover(assetId, file) {
    if (!file || !file.type.startsWith('image/')) return;
    setBusy(`cover:${assetId}`);
    try {
      const userId = await currentPromptUserId();
      if (!userId) {
        onNote?.('Sign in to save covers.');
        return;
      }
      const currentAsset = (assets || []).find((item) => item.id === assetId);
      const uploaded = await uploadPromptAssetCover(
        file,
        prompt.id,
        assetId,
        userId,
        currentAsset?.coverPath || '',
      );
      patchAssets((assets || []).map((item) => (
        item.id === assetId
          ? { ...item, coverPath: uploaded.path, coverUrl: uploaded.url }
          : item
      )));
    } catch (error) {
      console.warn('[prompt-assets] cover failed', error?.message || error);
      onNote?.(error instanceof Error ? error.message : PROMPT_LIMIT_COPY.storage);
    } finally {
      setBusy('');
    }
  }

  function clearCover(assetId) {
    patchAssets((assets || []).map((item) => (
      item.id === assetId
        ? { ...item, coverPath: '', coverUrl: '' }
        : item
    )));
  }

  function removeAsset(assetId) {
    patchAssets((assets || []).filter((item) => item.id !== assetId));
  }

  async function downloadOne(asset) {
    if (!asset?.path) return;
    setBusy(`dl:${asset.id}`);
    try {
      const buffer = await downloadPromptDocument(asset.path);
      triggerBrowserDownload(buffer, asset.name || 'asset');
    } catch (error) {
      console.warn('[prompt-assets] download failed', error?.message || error);
      onNote?.('Couldn’t download the asset.');
    } finally {
      setBusy('');
    }
  }

  async function loadDisplayImageBlob(asset) {
    const useCover = Boolean(String(asset?.coverUrl || '').trim());
    const href = assetDisplayUrl(asset) || String(asset?.url || '').trim();
    if (href) {
      try {
        const response = await fetch(href);
        if (response.ok) return await response.blob();
      } catch {
        // Fall through to storage download.
      }
    }
    const path = useCover
      ? String(asset?.coverPath || '').trim()
      : String(asset?.path || '').trim();
    if (!path) return null;
    const buffer = await downloadPromptDocument(path);
    const type = useCover
      ? 'image/webp'
      : (asset?.kind === 'svg' ? 'image/svg+xml' : (asset?.mime || 'image/png'));
    return new Blob([buffer], { type });
  }

  async function blobAsPng(blob) {
    if (blob?.type === 'image/png') return blob;
    const bitmap = await createImageBitmap(blob);
    try {
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas');
      ctx.drawImage(bitmap, 0, 0);
      const png = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (next) => (next ? resolve(next) : reject(new Error('png'))),
          'image/png',
        );
      });
      return png;
    } finally {
      bitmap.close?.();
    }
  }

  async function copyImage(asset) {
    if (!assetDisplayUrl(asset) && !asset?.path && !asset?.coverPath) {
      onNote?.('No image to copy.');
      return;
    }
    setBusy(`copy:${asset.id}`);
    try {
      const raw = await loadDisplayImageBlob(asset);
      if (!raw) {
        onNote?.('No image to copy.');
        return;
      }
      const png = await blobAsPng(raw);
      if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
        onNote?.('Copy image isn’t supported in this browser.');
        return;
      }
      await navigator.clipboard.write([
        new ClipboardItem({
          // Promise form improves Safari ClipboardItem compatibility.
          'image/png': Promise.resolve(png),
        }),
      ]);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch (error) {
      console.warn('[prompt-assets] copy image failed', error?.message || error);
      onNote?.('Couldn’t copy the image.');
    } finally {
      setBusy('');
    }
  }

  async function extractAll() {
    if (!(assets || []).length) return;
    setBusy('zip');
    try {
      const entries = [];
      for (const asset of assets) {
        if (!asset?.path) continue;
        const buffer = await downloadPromptDocument(asset.path);
        entries.push({ name: asset.name || 'asset', data: buffer });
        if (asset.coverPath) {
          try {
            const cover = await downloadPromptDocument(asset.coverPath);
            const stem = String(asset.name || 'asset').replace(/\.[^.]+$/, '');
            entries.push({ name: `${stem}-cover.webp`, data: cover });
          } catch {
            // Cover is optional in the zip.
          }
        }
      }
      const base = String(prompt?.name || 'assets').replace(/[\\/]+/g, '-').trim() || 'assets';
      await zipPromptAssets(entries, `${base}-assets.zip`);
    } catch (error) {
      console.warn('[prompt-assets] zip failed', error?.message || error);
      onNote?.('Couldn’t export the zip.');
    } finally {
      setBusy('');
    }
  }

  const aligned = fanBox.height > 0;
  const stageStyle = aligned
    ? {
      position: 'absolute',
      top: `${Math.max(fanBox.top, 0)}px`,
      left: '50%',
      transform: 'translateX(-50%)',
      height: `${fanBox.height}px`,
      width: `${Math.min(fanBox.width || 420, 460)}px`,
      maxWidth: 'calc(100% - 24px)',
    }
    : undefined;
  const pagerStyle = aligned
    ? {
      position: 'absolute',
      top: `${Math.max(fanBox.top, 0) + fanBox.height + 12}px`,
      left: '50%',
      transform: 'translateX(-50%)',
    }
    : undefined;

  return (
    <>
      <div className="prompt-panel__assets-tools">
        <h2 className="prompt-assets__title">Assets</h2>
        <div className="prompt-assets__bar prompt-assets__bar--row">
          <div className="prompt-assets__bar-start">
            <div className="prompt-assets__cats">
              <button
                type="button"
                className={catsOpen ? 'prompt-assets__cat-btn is-open' : 'prompt-assets__cat-btn'}
                aria-expanded={catsOpen}
                aria-haspopup="listbox"
                onClick={() => setCatsOpen((open) => !open)}
              >
                <span className="prompt-assets__cat-folder" aria-hidden="true" />
                <span>{activeCategory.label}</span>
              </button>
              {catsOpen ? (
                <div className="prompt-assets__cat-menu" role="listbox" aria-label="Asset categories">
                  {PROMPT_ASSET_CATEGORIES.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected={category === item.id}
                      className={category === item.id ? 'is-selected' : undefined}
                      onClick={() => {
                        setCategory(item.id);
                        setCatsOpen(false);
                        setPageIndex(0);
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <div className="prompt-assets__bar-actions">
            <button
              type="button"
              className="prompt-assets__action"
              disabled={busy === 'zip' || !(assets || []).length}
              onClick={() => { void extractAll(); }}
            >
              {busy === 'zip' ? 'Zipping…' : 'Extract all'}
            </button>
            <button
              type="button"
              className="prompt-assets__action prompt-assets__action--primary"
              disabled={busy === 'upload'}
              onClick={() => addRef.current?.click()}
            >
              {busy === 'upload' ? 'Uploading…' : 'Add asset'}
            </button>
            <input
              ref={addRef}
              type="file"
              multiple
              accept={ACCEPT}
              hidden
              onChange={(event) => {
                void addFiles(event.target.files);
                event.target.value = '';
              }}
            />
          </div>
        </div>
      </div>

      <div ref={bodyRef} className="prompt-panel__assets">
        <div className={aligned ? 'prompt-assets__viewer is-aligned' : 'prompt-assets__viewer'}>
          {current ? (
            <div className="prompt-assets__frame" key={current.id}>
              <div className="prompt-assets__stage" style={stageStyle}>
                <AssetPreview asset={current} />
                <button
                  type="button"
                  className="prompt-assets__remove"
                  aria-label={`Remove ${current.name || 'asset'}`}
                  title="Remove"
                  onClick={() => {
                    removeAsset(current.id);
                    setPageIndex((index) => Math.max(0, Math.min(index, visible.length - 2)));
                  }}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
                <div className="prompt-assets__corner">
                  <button
                    type="button"
                    className={copied ? 'prompt-assets__copy is-copied' : 'prompt-assets__copy'}
                    disabled={busy === `copy:${current.id}` || (!assetDisplayUrl(current) && !current.url)}
                    aria-label={copied ? 'Copied' : 'Copy image'}
                    title={copied ? 'Copied' : 'Copy image'}
                    onClick={() => { void copyImage(current); }}
                  >
                    {copied ? (
                      <span className="prompt-assets__copy-label">Copied</span>
                    ) : (
                      <CopyIcon />
                    )}
                  </button>
                  <button
                    type="button"
                    className="prompt-assets__download"
                    disabled={busy === `dl:${current.id}`}
                    aria-label={`Download ${current.name || 'asset'}`}
                    title="Download"
                    onClick={() => { void downloadOne(current); }}
                  >
                    <DownloadIcon />
                  </button>
                </div>
              </div>
              <div
                className="prompt-assets__pager"
                style={pagerStyle}
                role="navigation"
                aria-label="Asset pages"
              >
                <button
                  type="button"
                  className="prompt-assets__arrow"
                  aria-label="Previous asset"
                  disabled={safeIndex <= 0}
                  onClick={() => setPageIndex((index) => Math.max(0, index - 1))}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M14.5 6.5 9 12l5.5 5.5" />
                  </svg>
                </button>
                <span className="prompt-assets__count">{`${safeIndex + 1} / ${visible.length}`}</span>
                <button
                  type="button"
                  className="prompt-assets__arrow"
                  aria-label="Next asset"
                  disabled={safeIndex >= visible.length - 1}
                  onClick={() => setPageIndex((index) => Math.min(visible.length - 1, index + 1))}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M9.5 6.5 15 12l-5.5 5.5" />
                  </svg>
                </button>
              </div>
              {!aligned ? (
                <p className="prompt-assets__name" title={current.name}>{current.name}</p>
              ) : null}
              {showCover ? (
                <div
                  className="prompt-assets__cover-row"
                  style={aligned
                    ? {
                      position: 'absolute',
                      top: `${Math.max(fanBox.top, 0) + fanBox.height + 12 + 54}px`,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: `${Math.min(fanBox.width || 280, 280)}px`,
                    }
                    : undefined}
                >
                  <button
                    type="button"
                    className="prompt-assets__cover-btn"
                    disabled={busy === `cover:${current.id}`}
                    onClick={() => coverRef.current?.click()}
                  >
                    {busy === `cover:${current.id}`
                      ? 'Saving…'
                      : current.coverUrl
                        ? 'Change cover'
                        : 'Add cover'}
                  </button>
                  {current.coverUrl ? (
                    <button
                      type="button"
                      className="prompt-assets__cover-clear"
                      onClick={() => clearCover(current.id)}
                    >
                      Clear
                    </button>
                  ) : null}
                  <input
                    ref={coverRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/*"
                    hidden
                    onChange={(event) => {
                      void setCover(current.id, event.target.files?.[0]);
                      event.target.value = '';
                    }}
                  />
                </div>
              ) : null}
              {aligned ? (
                <p
                  className="prompt-assets__name prompt-assets__name--dock"
                  title={current.name}
                  style={{
                    top: `${Math.max(fanBox.top, 0) + fanBox.height + 12 + 54 + (showCover ? 52 : 0)}px`,
                  }}
                >
                  {current.name}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="prompt-assets__empty">
              <p>
                {category === 'all'
                  ? 'Add images, PDF, audio, fonts, or other files to this pack.'
                  : `No ${activeCategory.label.toLowerCase()} in this file yet.`}
              </p>
              <button
                type="button"
                className="prompt-assets__action prompt-assets__action--primary"
                disabled={busy === 'upload'}
                onClick={() => addRef.current?.click()}
              >
                Add asset
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
