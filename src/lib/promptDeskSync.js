import { convertFileToWebpData } from './convertImageToWebp.js';
import { EMBED_BRAND_MAX_BYTES, PROMPT_LIMIT_COPY, PROMPT_STORAGE_BYTES } from './promptPlanLimits.js';
import { normalizePromptFile } from './promptPages.js';
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
    recommendedModel: typeof row.recommended_model === 'string' ? row.recommended_model : '',
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
        coverSkipped: Boolean(file.cover_skipped),
        assets: assetsFromRow(file.assets),
        steps: (stepsByFile.get(file.id) || [])
          .sort((a, b) => a.position - b.position)
          .map((row) => {
            const step = stepFromRow(row);
            return { ...step, video: null, pdf: null };
          }),
      })).map((file) => normalizePromptFile(file)),
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
    cover_skipped: Boolean(prompt.coverSkipped),
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
    recommended_model: typeof step.recommendedModel === 'string' ? step.recommendedModel : '',
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
    if (error && /reference_url|reference_name|pdf_name|pdf_path|cover_path|cover_skipped/i.test(error.message || '')) {
      const message = error.message || '';
      rows = rows.map((row) => {
        const next = { ...row };
        if (/reference_url/i.test(message)) delete next.reference_url;
        if (/reference_name/i.test(message)) delete next.reference_name;
        if (/pdf_name/i.test(message)) delete next.pdf_name;
        if (/pdf_path/i.test(message)) delete next.pdf_path;
        if (/cover_path/i.test(message)) delete next.cover_path;
        if (/cover_skipped/i.test(message)) delete next.cover_skipped;
        return next;
      });
      ({ error } = await supabase.from('prompt_files').upsert(rows, { onConflict: 'id' }));
    }
    if (error) throw error;
  }
  if (steps.length) {
    let rows = steps;
    let { error } = await supabase.from('prompt_steps').upsert(rows, { onConflict: 'id' });
    if (error && /sheet_face|recommended_model/i.test(error.message || '')) {
      const message = error.message || '';
      if (/recommended_model/i.test(message)) {
        console.warn(
          '[prompt-desk] recommended_model column missing — run supabase_prompt_recommended_model.sql in Supabase SQL Editor',
        );
      }
      rows = rows.map((row) => {
        const next = { ...row };
        if (/sheet_face/i.test(message)) delete next.sheet_face;
        if (/recommended_model/i.test(message)) delete next.recommended_model;
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

function embedBrandPrefix(userId) {
  return `${userId}/embed-brand`;
}

function isBrandLogoName(name) {
  return /^logo\.(jpe?g|svg|png|webp)$/i.test(name);
}

function brandMimeError(error) {
  const message = error?.message || '';
  if (/mime|content type|invalidmime|octet-stream/i.test(message)) {
    return new Error('Couldn’t save branding. Try SVG, PNG or JPG under 5 MB.');
  }
  return new Error(message || 'Couldn’t save branding.');
}

function parseBrandMeta(raw) {
  const text = String(raw || '').trim();
  const fromSvg = text.match(/<desc>([\s\S]*?)<\/desc>/i);
  const json = fromSvg ? fromSvg[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') : text;
  const meta = JSON.parse(json);
  return {
    alt: String(meta.alt || ''),
    saved: meta.saved === true,
  };
}

async function uploadBrandObject(path, body, contentType) {
  const { error } = await supabase.storage.from(BUCKET).upload(path, body, {
    contentType,
    upsert: true,
    cacheControl: '3600',
  });
  return error;
}

async function readBrandMeta(prefix, names) {
  for (const name of names) {
    const { data: blob } = await supabase.storage.from(BUCKET).download(`${prefix}/${name}`);
    if (!blob) continue;
    try {
      return parseBrandMeta(await blob.text());
    } catch {
      /* Try the next sidecar. */
    }
  }
  return { alt: '', saved: false };
}

export async function loadPromptBrandLogo(userId) {
  if (!userId) return { src: '', alt: '', path: '', saved: false };
  const prefix = embedBrandPrefix(userId);
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 40 });
  if (error || !data?.length) return { src: '', alt: '', path: '', saved: false };
  const names = (data || []).map((item) => item.name);
  const logo = data.find((item) => isBrandLogoName(item.name));
  const metaNames = ['meta.txt', 'meta.svg', 'meta.json'].filter((name) => names.includes(name));
  const meta = metaNames.length ? await readBrandMeta(prefix, metaNames) : { alt: '', saved: false };
  if (!logo) return { src: '', alt: meta.alt, path: '', saved: false };
  const path = `${prefix}/${logo.name}`;
  return { src: promptImageUrl(path), alt: meta.alt, path, saved: meta.saved || Boolean(meta.alt) };
}

export async function savePromptBrandMeta(userId, alt) {
  if (!userId) throw new Error('Sign in to save branding.');
  const prefix = embedBrandPrefix(userId);
  const payload = JSON.stringify({ alt: String(alt || '').trim(), saved: true });
  const textError = await uploadBrandObject(
    `${prefix}/meta.txt`,
    new Blob([payload], { type: 'text/plain' }),
    'text/plain',
  );
  if (!textError) return;
  const safe = payload.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const svgError = await uploadBrandObject(
    `${prefix}/meta.svg`,
    new Blob([`<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><desc>${safe}</desc></svg>`], { type: 'image/svg+xml' }),
    'image/svg+xml',
  );
  if (svgError) console.warn('[prompt-desk] brand meta skipped', svgError.message);
}

export async function savePromptBrandLogo(userId, file, alt) {
  if (!userId) throw new Error('Sign in to save branding.');
  if (!file) throw new Error('Choose an SVG, PNG or JPG.');
  const type = String(file.type || '').toLowerCase();
  const name = String(file.name || '').toLowerCase();
  const isSvg = type === 'image/svg+xml' || name.endsWith('.svg');
  const isPng = type === 'image/png' || name.endsWith('.png');
  const isJpg = type === 'image/jpeg' || name.endsWith('.jpg') || name.endsWith('.jpeg');
  if (!isSvg && !isPng && !isJpg) throw new Error('Use SVG, PNG or JPG.');
  if (file.size > EMBED_BRAND_MAX_BYTES) throw new Error('Use a file under 5 MB.');
  const prefix = embedBrandPrefix(userId);
  const { data: existing } = await supabase.storage.from(BUCKET).list(prefix, { limit: 40 });
  const oldLogoPaths = (existing || [])
    .filter((item) => isBrandLogoName(item.name))
    .map((item) => `${prefix}/${item.name}`);
  let ext = isSvg ? 'svg' : isPng ? 'png' : 'jpg';
  let contentType = isSvg ? 'image/svg+xml' : isPng ? 'image/png' : 'image/jpeg';
  let body = file;
  await assertStorageRoom(userId, body.size, oldLogoPaths[0] || '');
  let error = await uploadBrandObject(`${prefix}/logo.${ext}`, body, contentType);
  if (error && /mime|content type|invalidmime/i.test(error.message || '')) {
    const converted = await convertFileToWebpData(file);
    if (!converted?.blob) throw brandMimeError(error);
    ext = 'webp';
    contentType = 'image/webp';
    body = converted.blob;
    await assertStorageRoom(userId, body.size, oldLogoPaths[0] || '');
    error = await uploadBrandObject(`${prefix}/logo.webp`, body, contentType);
  }
  if (error) throw brandMimeError(error);
  const path = `${prefix}/logo.${ext}`;
  const stale = oldLogoPaths.filter((item) => item !== path);
  if (stale.length) {
    const { error: removeError } = await supabase.storage.from(BUCKET).remove(stale);
    if (removeError) console.warn('[prompt-desk] brand replace failed', removeError.message);
  }
  await savePromptBrandMeta(userId, alt);
  return { src: promptImageUrl(path), path, alt: String(alt || '').trim() };
}

export async function removePromptBrandLogo(userId) {
  if (!userId) return;
  const prefix = embedBrandPrefix(userId);
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 40 });
  if (error) throw error;
  const paths = (data || [])
    .filter((item) => item?.name && item.name !== '.emptyFolderPlaceholder')
    .map((item) => `${prefix}/${item.name}`);
  if (!paths.length) return;
  const { error: removeError } = await supabase.storage.from(BUCKET).remove(paths);
  if (removeError) throw removeError;
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
