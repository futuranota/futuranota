import { useRef, useState } from 'react';

const UPLOAD_ICON = '/uploads/botones/CloudArrowUp.svg';

const CONFIG = {
  image: {
    accept: 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml',
    label: 'Cover image',
    hint: '16:10 · max 4 MB',
    formats: 'PNG, JPG, WebP, GIF, SVG',
    slotClass: 'horizon-kit-asset-slot--cover',
  },
  zip: {
    accept: '.zip,application/zip',
    label: 'ZIP attachment',
    hint: 'Optional · max 12 MB',
    formats: '.zip only',
    slotClass: 'horizon-kit-asset-slot--zip',
  },
};

function fileNameFromUrl(url) {
  if (!url) return '';
  try {
    const path = url.includes('://') ? new URL(url, 'http://local').pathname : url;
    return decodeURIComponent(path.split('/').pop() || url);
  } catch {
    return url.split('/').pop() || url;
  }
}

export function HorizonKitAssetSlot({
  kind = 'image',
  value = '',
  uploading = false,
  disabled = false,
  onFile,
  onClear,
}) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const cfg = CONFIG[kind] || CONFIG.image;
  const hasFile = Boolean(String(value || '').trim());
  const busy = uploading || disabled;
  const fileName = fileNameFromUrl(value);

  const pickFiles = (files) => {
    const file = files?.[0];
    if (!file || busy) return;
    onFile?.(file);
    if (inputRef.current) inputRef.current.value = '';
  };

  const openPicker = () => {
    if (!busy) inputRef.current?.click();
  };

  const handleDrag = (event, active) => {
    event.preventDefault();
    event.stopPropagation();
    if (!busy) setDragOver(active);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOver(false);
    pickFiles(event.dataTransfer?.files);
  };

  return (
    <div className="horizon-kit-asset-field">
      <span className="horizon-kit-asset-field__label">{cfg.label}</span>
      <input
        ref={inputRef}
        type="file"
        className="horizon-kit-asset-slot__input"
        accept={cfg.accept}
        disabled={busy}
        onChange={(e) => pickFiles(e.target.files)}
      />

      {kind === 'image' && hasFile ? (
        <div
          className={
            'horizon-kit-asset-slot horizon-kit-asset-slot--cover horizon-kit-asset-slot--has-file'
            + (uploading ? ' horizon-kit-asset-slot--busy' : '')
          }
        >
          <img className="horizon-kit-asset-slot__preview" src={value} alt="" />
          <div className="horizon-kit-asset-slot__overlay">
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={openPicker}>
              {uploading ? 'Uploading…' : 'Replace'}
            </button>
            {onClear ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={busy}
                onClick={() => onClear()}
              >
                Remove
              </button>
            ) : null}
          </div>
        </div>
      ) : kind === 'zip' && hasFile ? (
        <div
          className={
            'horizon-kit-asset-slot horizon-kit-asset-slot--zip horizon-kit-asset-slot--has-file'
            + (uploading ? ' horizon-kit-asset-slot--busy' : '')
          }
        >
          <div className="horizon-kit-asset-slot__zip-body">
            <span className="horizon-kit-asset-slot__zip-icon" aria-hidden>ZIP</span>
            <div className="horizon-kit-asset-slot__zip-meta">
              <span className="horizon-kit-asset-slot__zip-name" title={fileName}>{fileName}</span>
              <a href={value} className="horizon-kit-asset-slot__zip-link" download>
                Download
              </a>
            </div>
          </div>
          <div className="horizon-kit-asset-slot__zip-actions">
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={openPicker}>
              {uploading ? 'Uploading…' : 'Replace'}
            </button>
            {onClear ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={busy}
                onClick={() => onClear()}
              >
                Remove
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <button
          type="button"
          className={
            'horizon-kit-asset-slot'
            + ` ${cfg.slotClass}`
            + (dragOver ? ' horizon-kit-asset-slot--active' : '')
            + (uploading ? ' horizon-kit-asset-slot--busy' : '')
          }
          disabled={busy}
          onClick={openPicker}
          onDragEnter={(e) => handleDrag(e, true)}
          onDragOver={(e) => handleDrag(e, true)}
          onDragLeave={(e) => handleDrag(e, false)}
          onDrop={handleDrop}
        >
          <img className="horizon-kit-asset-slot__upload-icon" src={UPLOAD_ICON} alt="" aria-hidden />
          <span className="horizon-kit-asset-slot__copy">
            <span className="horizon-kit-asset-slot__title">
              {uploading ? 'Uploading…' : kind === 'zip' ? 'Upload ZIP' : 'Upload cover'}
            </span>
            <span className="horizon-kit-asset-slot__hint">{cfg.hint}</span>
            <span className="horizon-kit-asset-slot__formats">{cfg.formats}</span>
          </span>
        </button>
      )}
    </div>
  );
}
