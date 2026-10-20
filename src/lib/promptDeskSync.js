import { convertFileToWebpData } from './convertImageToWebp.js';
import { PROMPT_LIMIT_COPY, PROMPT_STORAGE_BYTES } from './promptPlanLimits.js';
import { storageTreeFromDesk, treeBytes } from './promptStorageTree.js';
import { claimDocumentVariables, normalizeVariables } from './promptVariables.js';
import { supabase } from './supabaseClient.js';

const BUCKET = 'prompt-images';

export async function currentPromptUserId() {
  const first = await supabase.auth.getUser();
  if (!first.error && first.data?.user?.id) return first.data.user.id;
  const refreshed = await supabase.auth.refreshSession();
  if (refreshed.error) throw first.error || refreshed.error;
  return refreshed.data?.session?.user?.id || null;
}

export function promptDocumentKind(name) {
  const lower = String(name || '').toLowerCase();
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'md';
  if (lower.endsWith('.txt')) return 'txt';
  return 'pdf';
}

export function promptImageUrl(path) {
  if (!path) return '';
  if (path.startsWith('http') || path.startsWith('data:')) return path;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data?.publicUrl || '';
}

function stepFromRow(row) {
  const imagePath = row.image_path || '';
  return {
    id: row.id,
    title: row.title || '',
    description: row.description || '',
    prompt: row.prompt || '',
    image: promptImageUrl(imagePath),
    imagePath,
    pdfPage: null,
    video: row.video_embed_src
      ? {
        rawInput: row.video_raw_input || '',
        provider: row.video_provider,
        videoId: row.video_id,
        embedSrc: row.video_embed_src,
      }
      : null,
    pdf: row.pdf_name
      ? {
        name: row.pdf_name,
        path: row.pdf_path || '',
        url: promptImageUrl(row.pdf_path || ''),
      }
      : null,
    format: row.format || 'text',
    modelIds: Array.isArray(row.model_ids) ? row.model_ids.filter((id) => typeof id === 'string' && id) : [],
    promptSaved: Boolean(row.prompt_saved),
    ...(row.sheet_face === 0 || row.sheet_face === 1 ? { sheetFace: row.sheet_face } : {}),
  };
}

export function foldersFromRows(collections, files, steps) {
  const stepsByFile = new Map();
  for (const row of steps || []) {
    const list = stepsByFile.get(row.file_id) || [];
    list.push(row);
    stepsByFile.set(row.file_id, list);
  }
  const filesByCollection = new Map();
  for (const row of files || []) {
    const list = filesByCollection.get(row.collection_id) || [];
    list.push(row);
    filesByCollection.set(row.collection_id, list);
  }
  const built = (collections || []).map((collection) => ({
    id: collection.id,
    label: collection.label || 'Prompts',
    art: collection.art || 'aurora',
    tone: collection.tone === 'dark' ? 'dark' : 'light',
    seed: Number(collection.seed) || 0,
    updatedAt: collection.updated_at || null,
    prompts: (filesByCollection.get(collection.id) || [])
      .sort((a, b) => a.position - b.position)
      .map((file) => ({
        id: file.id,
        name: file.name || 'Untitled',
        meta: file.meta || 'Prompt',
        updatedAt: file.updated_at || null,
        modelId: file.model_id || '',
        variables: normalizeVariables(file.variables),
        stepIndex: Number(file.step_index) || 0,
        pdf: file.pdf_name
          ? {
            name: file.pdf_name,
            path: file.pdf_path || '',
            url: promptImageUrl(file.pdf_path || ''),
            kind: promptDocumentKind(file.pdf_name),
          }
          : null,
        video: null,
        referenceUrl: typeof file.reference_url === 'string' ? file.reference_url : '',
        referenceName: typeof file.reference_name === 'string' ? file.reference_name : '',
        cover: promptImageUrl(file.cover_path || ''),
        coverPath: file.cover_path || '',
        assets: assetsFromRow(file.assets),
        steps: (stepsByFile.get(file.id) || [])
          .sort((a, b) => a.position - b.position)
          .map((row) => {
            const step = stepFromRow(row);
            return { ...step, video: null, pdf: null };
          }),
      })),
  }));
  return claimDocumentVariables(built);
}

export async function loadPromptDesk(userId) {
  const [collections, files, steps] = await Promise.all([
    supabase.from('prompt_collections').select('*').eq('user_id', userId).order('position'),
    supabase.from('prompt_files').select('*').eq('user_id', userId).order('position'),
    supabase.from('prompt_steps').select('*').eq('user_id', userId).order('position'),
  ]);
  if (collections.error) throw collections.error;
  if (files.error) throw files.error;
  if (steps.error) throw steps.error;
  return foldersFromRows(collections.data, files.data, steps.data);
}

function assetsFromRow(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => item && item.id && item.path)
    .map((item) => ({
      id: String(item.id),
      name: String(item.name || 'Image'),
      kind: item.kind === 'svg' ? 'svg' : 'image',
      path: String(item.path),
      url: promptImageUrl(item.path),
    }));
}

function assetRows(assets) {
  return (assets || [])
    .filter((item) => item && item.id && item.path)
    .map((item) => ({
      id: String(item.id),
      name: String(item.name || 'Image'),
      kind: item.kind === 'svg' ? 'svg' : 'image',
      path: String(item.path),
    }));
}

function collectionRow(folder, userId, position) {
  return {
    id: folder.id,
    user_id: userId,
    label: folder.label || 'Prompts',
    art: folder.art || 'aurora',
    tone: folder.tone === 'dark' ? 'dark' : 'light',
    seed: Number(folder.seed) || 0,
    position,
    updated_at: new Date().toISOString(),
  };
}

function fileRow(prompt, userId, collectionId, position) {
  return {
    id: prompt.id,
    user_id: userId,
    collection_id: collectionId,
    name: prompt.name || 'Untitled',
    meta: prompt.meta || 'Prompt',
    model_id: prompt.modelId || '',
    variables: normalizeVariables(prompt.variables),
    step_index: Number(prompt.stepIndex) || 0,
    pdf_name: prompt.pdf?.path ? (prompt.pdf.name || null) : null,
    pdf_path: prompt.pdf?.path || null,
    reference_url: typeof prompt.referenceUrl === 'string' ? prompt.referenceUrl : '',
    reference_name: typeof prompt.referenceName === 'string' ? prompt.referenceName : '',
    cover_path: prompt.coverPath || null,
    assets: assetRows(prompt.assets),
    position,
    updated_at: new Date().toISOString(),
  };
}

function stepRow(step, userId, fileId, position) {
  return {
    id: step.id,
    user_id: userId,
    file_id: fileId,
    position,
    title: step.title || '',
    description: step.description || '',
    prompt: step.prompt || '',
    format: step.format || 'text',
    model_ids: Array.isArray(step.modelIds) ? step.modelIds : [],
    prompt_saved: Boolean(step.promptSaved),
    sheet_face: step.sheetFace === 0 || step.sheetFace === 1 ? step.sheetFace : null,
    image_path: step.imagePath || null,
    pdf_page: null,
    video_provider: null,
    video_id: null,
    video_raw_input: null,
    video_embed_src: null,
    pdf_name: null,
    pdf_path: null,
    updated_at: new Date().toISOString(),
  };
}

async function deleteMissing(table, userId, ids) {
  const query = supabase.from(table).delete().eq('user_id', userId);
  const { error } = ids.length
    ? await query.not('id', 'in', `(${ids.join(',')})`)
    : await query;
  if (error) throw error;
}

function imagePaths(folders) {
  const paths = new Set();
  for (const folder of folders || []) {
    for (const prompt of folder.prompts || []) {
      if (prompt.pdf?.path) paths.add(prompt.pdf.path);
      if (prompt.coverPath) paths.add(prompt.coverPath);
      for (const asset of prompt.assets || []) {
        if (asset.path) paths.add(asset.path);
      }
      for (const step of prompt.steps || []) {
        if (step.imagePath) paths.add(step.imagePath);
      }
    }
  }
  return paths;
}

export async function savePromptDesk(userId, folders, previous) {
  const collections = [];
  const files = [];
  const steps = [];
  folders.forEach((folder, folderIndex) => {
    collections.push(collectionRow(folder, userId, folderIndex));
    (folder.prompts || []).forEach((prompt, fileIndex) => {
      files.push(fileRow(prompt, userId, folder.id, fileIndex));
      (prompt.steps || []).forEach((step, stepIndex) => {
        steps.push(stepRow(step, userId, prompt.id, stepIndex));
      });
    });
  });

  if (collections.length) {
    const { error } = await supabase.from('prompt_collections').upsert(collections, { onConflict: 'id' });
    if (error) throw error;
  }
  if (files.length) {
    let rows = files;
    let { error } = await supabase.from('prompt_files').upsert(rows, { onConflict: 'id' });
    if (error && /reference_url|reference_name|pdf_name|pdf_path|cover_path/i.test(error.message || '')) {
      const message = error.message || '';
      rows = rows.map((row) => {
        const next = { ...row };
        if (/reference_url/i.test(message)) delete next.reference_url;
        if (/reference_name/i.test(message)) delete next.reference_name;
        if (/pdf_name/i.test(message)) delete next.pdf_name;
        if (/pdf_path/i.test(message)) delete next.pdf_path;
        if (/cover_path/i.test(message)) delete next.cover_path;
        return next;
      });
      ({ error } = await supabase.from('prompt_files').upsert(rows, { onConflict: 'id' }));
    }
    if (error) throw error;
  }
  if (steps.length) {
    let rows = steps;
    let { error } = await supabase.from('prompt_steps').upsert(rows, { onConflict: 'id' });
    if (error && /sheet_face/i.test(error.message || '')) {
      rows = rows.map((row) => {
        const next = { ...row };
        delete next.sheet_face;
        return next;
      });
      ({ error } = await supabase.from('prompt_steps').upsert(rows, { onConflict: 'id' }));
    }
    if (error) throw error;
  }

  await deleteMissing('prompt_steps', userId, steps.map((row) => row.id));
  await deleteMissing('prompt_files', userId, files.map((row) => row.id));
  await deleteMissing('prompt_collections', userId, collections.map((row) => row.id));

  const nextPaths = imagePaths(folders);
  const removed = [...imagePaths(previous)].filter((path) => !nextPaths.has(path));
  if (removed.length) {
    const { error } = await supabase.storage.from(BUCKET).remove(removed);
    if (error) console.warn('[prompt-desk] image remove failed', error.message);
  }
}

export async function listPromptObjectSizes(userId) {
  const sizes = {};
  async function walk(prefix) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000 });
    if (error) throw error;
    for (const item of data || []) {
      if (!item?.name || item.name === '.emptyFolderPlaceholder') continue;
      const path = `${prefix}/${item.name}`;
      const size = Number(item.metadata?.size);
      if (item.id && Number.isFinite(size)) sizes[path] = size;
      else if (!item.id) await walk(path);
    }
  }
  await walk(userId);
  return sizes;
}

export async function loadPromptStorageTree(userId) {
  const folders = await loadPromptDesk(userId);
  const sizes = await listPromptObjectSizes(userId);
  return storageTreeFromDesk(folders, sizes);
}

export async function assertStorageRoom(userId, incomingBytes, replacePath = '') {
  const folders = await loadPromptDesk(userId);
  const sizes = await listPromptObjectSizes(userId);
  const used = treeBytes(storageTreeFromDesk(folders, sizes));
  const previous = replacePath ? (Number(sizes[replacePath]) || 0) : 0;
  const next = Math.max(0, used - previous) + Math.max(0, Number(incomingBytes) || 0);
  if (next > PROMPT_STORAGE_BYTES) {
    throw new Error(PROMPT_LIMIT_COPY.storage);
  }
}

export async function uploadPromptAsset(file, fileId, userId) {
  const isSvg = file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
  if (isSvg) {
    await assertStorageRoom(userId, file.size);
    const path = `${userId}/${fileId}/assets/${crypto.randomUUID()}.svg`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
      contentType: 'image/svg+xml',
      upsert: false,
      cacheControl: '3600',
    });
    if (error) throw error;
    return {
      name: file.name || 'image.svg',
      kind: 'svg',
      path,
      url: promptImageUrl(path),
      file,
    };
  }
  const converted = await convertFileToWebpData(file);
  if (!converted?.blob) throw new Error('No se pudo leer la imagen.');
  await assertStorageRoom(userId, converted.blob.size);
  const path = `${userId}/${fileId}/assets/${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, converted.blob, {
    contentType: 'image/webp',
    upsert: false,
    cacheControl: '3600',
  });
  if (error) throw error;
  const stem = (file.name || 'image').replace(/\.[^.]+$/, '');
  const name = `${stem}.webp`;
  return {
    name,
    kind: 'image',
    path,
    url: promptImageUrl(path),
    file: new File([converted.blob], name, { type: 'image/webp' }),
  };
}

export async function uploadPromptImage(file, stepId, userId) {
  const converted = await convertFileToWebpData(file);
  if (!converted?.blob) throw new Error('No se pudo leer la imagen.');
  await assertStorageRoom(userId, converted.blob.size);
  const path = `${userId}/${stepId}/${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, converted.blob, {
    contentType: 'image/webp',
    upsert: false,
    cacheControl: '3600',
  });
  if (error) throw error;
  return { path, url: promptImageUrl(path) };
}

export async function uploadPromptCover(file, fileId, userId, replacePath = '') {
  const converted = await convertFileToWebpData(file);
  if (!converted?.blob) throw new Error('No se pudo leer la imagen.');
  await assertStorageRoom(userId, converted.blob.size, replacePath);
  const path = `${userId}/${fileId}/cover-${crypto.randomUUID()}.webp`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, converted.blob, {
    contentType: 'image/webp',
    upsert: false,
    cacheControl: '3600',
  });
  if (error) throw error;
  return { path, url: promptImageUrl(path) };
}

export async function downloadPromptDocument(path) {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error || !data) throw error || new Error('missing');
  return data.arrayBuffer();
}

export async function uploadPromptPdf(file, stepId, userId) {
  return uploadPromptDocument(file, stepId, userId);
}

export async function uploadPromptDocument(file, fileId, userId) {
  const kind = promptDocumentKind(file?.name);
  const ext = kind === 'md' ? 'md' : kind === 'txt' ? 'txt' : 'pdf';
  const path = `${userId}/${fileId}.${ext}`;
  await assertStorageRoom(userId, file.size, path);
  const bytes = await file.arrayBuffer();
  const types = kind === 'pdf'
    ? ['application/pdf', 'application/octet-stream', 'image/webp']
    : ['text/plain', 'text/markdown', 'application/octet-stream', 'application/pdf', 'image/webp'];
  let lastError = null;
  for (const type of types) {
    const body = new Blob([bytes], { type });
    const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
      contentType: type,
      upsert: true,
      cacheControl: '3600',
    });
    if (!error) return { path, url: promptImageUrl(path) };
    lastError = error;
    if (!/mime|content type|invalidmime/i.test(error.message || '')) break;
  }
  const message = lastError?.message || 'Couldn’t save the document.';
  if (/bucket not found|nosuchbucket/i.test(message)) {
    throw new Error('The storage bucket prompt-images is not available for this file.');
  }
  throw new Error(message);
}
