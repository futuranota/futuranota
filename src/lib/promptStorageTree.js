/** Build the Storage District tree from prompt desk rows. */

function utf8Bytes(value) {
  return new TextEncoder().encode(String(value ?? '')).length;
}

/** @param {object} prompt */
export function promptTextBytes(prompt) {
  let total = utf8Bytes(prompt?.name) + utf8Bytes(prompt?.meta);
  total += utf8Bytes(prompt?.referenceUrl) + utf8Bytes(prompt?.referenceName);
  total += utf8Bytes(JSON.stringify(prompt?.variables || []));
  for (const step of prompt?.steps || []) {
    total += utf8Bytes(step?.title) + utf8Bytes(step?.description) + utf8Bytes(step?.prompt);
  }
  return total;
}

/** @param {object} prompt @param {Record<string, number>} [sizesByPath] */
export function promptFileBytes(prompt, sizesByPath = {}) {
  let total = promptTextBytes(prompt);
  const paths = [];
  if (prompt?.pdf?.path) paths.push(prompt.pdf.path);
  if (prompt?.coverPath) paths.push(prompt.coverPath);
  for (const asset of prompt?.assets || []) {
    if (asset?.path) paths.push(asset.path);
  }
  for (const step of prompt?.steps || []) {
    if (step?.imagePath) paths.push(step.imagePath);
  }
  for (const path of paths) total += Math.max(0, Number(sizesByPath[path]) || 0);
  return total;
}

/** @param {object} node */
export function treeBytes(node) {
  if (!node) return 0;
  if (node.kind === 'file') return Math.max(0, Number(node.bytes) || 0);
  return (node.children || []).reduce((total, child) => total + treeBytes(child), 0);
}

/** Bytes under `{userId}/embed-brand/` in the prompt-images bucket. */
export function brandStorageBytes(sizesByPath = {}) {
  return Object.entries(sizesByPath).reduce((sum, [path, n]) => (
    String(path).includes('/embed-brand/') ? sum + Math.max(0, Number(n) || 0) : sum
  ), 0);
}

/**
 * @param {Array<object>} [folders]
 * @param {Record<string, number>} [sizesByPath]
 */
export function storageTreeFromDesk(folders, sizesByPath = {}) {
  const children = (folders || []).map((folder) => ({
    id: folder.id,
    name: folder.label || 'Prompts',
    kind: 'folder',
    modifiedAt: folder.updatedAt || null,
    children: (folder.prompts || []).map((prompt) => ({
      id: prompt.id,
      name: prompt.name || 'Untitled',
      kind: 'file',
      modifiedAt: prompt.updatedAt || null,
      bytes: promptFileBytes(prompt, sizesByPath),
    })),
  }));
  const brand = brandStorageBytes(sizesByPath);
  if (brand > 0) {
    children.push({
      id: 'embed-brand',
      name: 'Branding',
      kind: 'file',
      modifiedAt: null,
      bytes: brand,
    });
  }
  return {
    id: 'workspace',
    name: 'Workspace',
    kind: 'folder',
    modifiedAt: null,
    children,
  };
}
