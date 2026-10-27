import JSZip from 'jszip';

/** @typedef {'image' | 'svg' | 'pdf' | 'audio' | 'font' | 'other'} PromptAssetKind */

export const PROMPT_ASSET_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'images', label: 'Images' },
  { id: 'pdf', label: 'PDF' },
  { id: 'audio', label: 'Audio' },
  { id: 'fonts', label: 'Fonts' },
  { id: 'other', label: 'Other' },
];

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|bmp)$/i;
const SVG_EXT = /\.svg$/i;
const PDF_EXT = /\.pdf$/i;
const AUDIO_EXT = /\.(mp3|wav|ogg|m4a|aac|flac|aiff?)$/i;
const FONT_EXT = /\.(ttf|otf|woff2?|eot)$/i;

/**
 * @param {File | { name?: string, type?: string }} file
 * @returns {PromptAssetKind}
 */
export function detectPromptAssetKind(file) {
  const name = String(file?.name || '');
  const type = String(file?.type || '').toLowerCase();
  if (type === 'image/svg+xml' || SVG_EXT.test(name)) return 'svg';
  if (type.startsWith('image/') || IMAGE_EXT.test(name)) return 'image';
  if (type === 'application/pdf' || PDF_EXT.test(name)) return 'pdf';
  if (type.startsWith('audio/') || AUDIO_EXT.test(name)) return 'audio';
  if (
    type.includes('font')
    || type === 'application/vnd.ms-fontobject'
    || FONT_EXT.test(name)
  ) return 'font';
  return 'other';
}

/**
 * @param {PromptAssetKind | string} kind
 * @returns {string}
 */
export function assetCategoryForKind(kind) {
  if (kind === 'image' || kind === 'svg') return 'images';
  if (kind === 'pdf') return 'pdf';
  if (kind === 'audio') return 'audio';
  if (kind === 'font') return 'fonts';
  return 'other';
}

/**
 * @param {object[]} assets
 * @param {string} categoryId
 */
export function filterAssetsByCategory(assets, categoryId) {
  const list = Array.isArray(assets) ? assets : [];
  if (!categoryId || categoryId === 'all') return list;
  return list.filter((item) => assetCategoryForKind(item?.kind) === categoryId);
}

/**
 * Card face: optional cover wins over native preview.
 * @param {object} asset
 */
export function assetDisplayUrl(asset) {
  const cover = String(asset?.coverUrl || '').trim();
  if (cover) return cover;
  const kind = asset?.kind;
  if (kind === 'image' || kind === 'svg') return String(asset?.url || '').trim();
  return '';
}

/**
 * @param {string} name
 * @param {Set<string>} used
 */
export function uniqueZipName(name, used) {
  const raw = String(name || 'asset').replace(/[\\/]+/g, '-').trim() || 'asset';
  if (!used.has(raw)) {
    used.add(raw);
    return raw;
  }
  const dot = raw.lastIndexOf('.');
  const stem = dot > 0 ? raw.slice(0, dot) : raw;
  const ext = dot > 0 ? raw.slice(dot) : '';
  let n = 2;
  let next = `${stem}-${n}${ext}`;
  while (used.has(next)) {
    n += 1;
    next = `${stem}-${n}${ext}`;
  }
  used.add(next);
  return next;
}

/**
 * @param {ArrayBuffer | Blob} data
 * @param {string} fileName
 */
export function triggerBrowserDownload(data, fileName) {
  const blob = data instanceof Blob ? data : new Blob([data]);
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = fileName || 'asset';
  link.click();
  URL.revokeObjectURL(href);
}

/**
 * @param {{ name: string, data: ArrayBuffer | Blob }[]} entries
 * @param {string} zipName
 */
export async function zipPromptAssets(entries, zipName = 'assets.zip') {
  const zip = new JSZip();
  const used = new Set();
  for (const entry of entries || []) {
    if (!entry?.data) continue;
    const name = uniqueZipName(entry.name, used);
    zip.file(name, entry.data);
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
  triggerBrowserDownload(blob, zipName);
}
