import { convertFileToWebpData } from './convertImageToWebp.js';
import { normalizeVariables } from './promptVariables.js';
import { supabase } from './supabaseClient.js';

const BUCKET = 'prompt-images';

export async function currentPromptUserId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data?.user?.id || null;
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
    promptSaved: Boolean(row.prompt_saved),
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
  return (collections || []).map((collection) => ({
    id: collection.id,
    label: collection.label || 'Prompts',
    art: collection.art || 'aurora',
    tone: collection.tone === 'dark' ? 'dark' : 'light',
    seed: Number(collection.seed) || 0,
    prompts: (filesByCollection.get(collection.id) || [])
      .sort((a, b) => a.position - b.position)
      .map((file) => ({
        id: file.id,
        name: file.name || 'Untitled',
        meta: file.meta || 'Prompt',
        modelId: file.model_id || '',
        variables: normalizeVariables(file.variables),
        stepIndex: Number(file.step_index) || 0,
        steps: (stepsByFile.get(file.id) || [])
          .sort((a, b) => a.position - b.position)
          .map(stepFromRow),
      })),
  }));
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
    position,
    updated_at: new Date().toISOString(),
  };
}

function stepRow(step, userId, fileId, position) {
  const video = step.video?.embedSrc ? step.video : null;
  return {
    id: step.id,
    user_id: userId,
    file_id: fileId,
    position,
    title: step.title || '',
    description: step.description || '',
    prompt: step.prompt || '',
    format: step.format || 'text',
    prompt_saved: Boolean(step.promptSaved),
    image_path: step.imagePath || null,
    video_provider: video?.provider || null,
    video_id: video?.videoId || null,
    video_raw_input: video?.rawInput || null,
    video_embed_src: video?.embedSrc || null,
    pdf_name: step.pdf?.name || null,
    pdf_path: step.pdf?.path || null,
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
      for (const step of prompt.steps || []) {
        if (step.imagePath) paths.add(step.imagePath);
        if (step.pdf?.path) paths.add(step.pdf.path);
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
    const { error } = await supabase.from('prompt_files').upsert(files, { onConflict: 'id' });
    if (error) throw error;
  }
  if (steps.length) {
    const { error } = await supabase.from('prompt_steps').upsert(steps, { onConflict: 'id' });
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

export async function uploadPromptImage(file, stepId, userId) {
  const converted = await convertFileToWebpData(file);
  if (!converted?.blob) throw new Error('No se pudo leer la imagen.');
  const path = `${userId}/${stepId}.webp`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, converted.blob, {
    contentType: 'image/webp',
    upsert: true,
    cacheControl: '3600',
  });
  if (error) throw error;
  return { path, url: promptImageUrl(path) };
}

export async function uploadPromptPdf(file, stepId, userId) {
  const path = `${userId}/${stepId}.pdf`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: 'application/pdf',
    upsert: true,
    cacheControl: '3600',
  });
  if (error) throw error;
  return { path, url: promptImageUrl(path) };
}
