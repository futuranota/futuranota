import { useMemo, useState } from 'react';
import GlassFolder from './GlassFolder.jsx';
import './prompt-desk.css';

const ARTS = ['aurora', 'ember', 'dusk', 'glacier', 'verdant'];

function uid() {
  return crypto.randomUUID();
}

function blankPrompt() {
  return {
    id: uid(),
    name: 'Untitled',
    meta: 'Prompt',
    description: '',
    prompt: '',
    image: '',
  };
}

function blankFolder(index) {
  return {
    id: uid(),
    label: index === 0 ? 'Prompts' : `Collection ${index + 1}`,
    art: ARTS[index % ARTS.length],
    tone: index % 2 === 1 ? 'dark' : 'light',
    seed: index * 7 + 3,
    prompts: [],
  };
}

function sheetsOf(prompts) {
  return prompts.map((prompt) => ({
    name: prompt.name || 'Untitled',
    meta: prompt.meta || 'Prompt',
    image: prompt.image || undefined,
    promptId: prompt.id,
  }));
}

function readImageFile(file, onLoad) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = () => onLoad(String(reader.result || ''));
  reader.readAsDataURL(file);
}

function FolderCard({ folder, appearDelay, onAdd, onOpenPrompt, onRename, onDeleteFolder, onDeletePrompt }) {
  const sheets = useMemo(() => sheetsOf(folder.prompts), [folder.prompts]);
  return (
    <div className="prompt-desk__folder">
      <button
        type="button"
        className="prompt-desk__delete"
        onClick={() => onDeleteFolder(folder.id)}
      >
        Eliminar
      </button>
      <GlassFolder
        label={folder.label}
        art={folder.art}
        tone={folder.tone}
        seed={folder.seed}
        files={sheets}
        action="add"
        width={300}
        appearDelay={appearDelay}
        onLabelChange={(label) => onRename(folder.id, label)}
        onAdd={() => {
          const prompt = blankPrompt();
          onAdd(folder.id, prompt);
          return { name: prompt.name, meta: prompt.meta, promptId: prompt.id };
        }}
        onFileSelect={(file) => {
          if (file?.promptId) onOpenPrompt(folder.id, file.promptId);
        }}
        onFileDelete={(file) => {
          if (file?.promptId) onDeletePrompt(folder.id, file.promptId);
        }}
      />
    </div>
  );
}

export default function PromptDesk() {
  const [folders, setFolders] = useState(() => [blankFolder(0)]);
  const [active, setActive] = useState(null);
  const [compact, setCompact] = useState(false);

  const activePrompt = useMemo(() => {
    if (!active) return null;
    const folder = folders.find((item) => item.id === active.folderId);
    const prompt = folder?.prompts.find((item) => item.id === active.promptId);
    if (!folder || !prompt) return null;
    return { folder, prompt };
  }, [folders, active]);

  function addCollection() {
    setFolders((prev) => [...prev, blankFolder(prev.length)]);
  }

  function addPrompt(folderId, prompt) {
    setFolders((prev) => prev.map((folder) => (
      folder.id === folderId
        ? { ...folder, prompts: [...folder.prompts, prompt] }
        : folder
    )));
  }

  function patchPrompt(patch) {
    if (!active) return;
    setFolders((prev) => prev.map((folder) => {
      if (folder.id !== active.folderId) return folder;
      return {
        ...folder,
        prompts: folder.prompts.map((prompt) => (
          prompt.id === active.promptId ? { ...prompt, ...patch } : prompt
        )),
      };
    }));
  }

  function closePanel() {
    setActive(null);
    setCompact(false);
  }

  function renameFolder(folderId, label) {
    setFolders((prev) => prev.map((folder) => (
      folder.id === folderId ? { ...folder, label } : folder
    )));
  }

  function deleteFolder(folderId) {
    setFolders((prev) => prev.filter((folder) => folder.id !== folderId));
    setActive((current) => (current?.folderId === folderId ? null : current));
    setCompact(false);
  }

  function deletePrompt(folderId, promptId) {
    setFolders((prev) => prev.map((folder) => (
      folder.id === folderId
        ? { ...folder, prompts: folder.prompts.filter((prompt) => prompt.id !== promptId) }
        : folder
    )));
    setActive((current) => (current?.promptId === promptId ? null : current));
    setCompact(false);
  }

  function goNext() {
    if (!active) return;
    const folder = folders.find((item) => item.id === active.folderId);
    if (!folder) return;
    const index = folder.prompts.findIndex((prompt) => prompt.id === active.promptId);
    const next = folder.prompts[index + 1];
    if (!next) return;
    setActive({ folderId: folder.id, promptId: next.id });
    setCompact(false);
  }

  const hasNext = Boolean(
    activePrompt
    && activePrompt.folder.prompts.findIndex((prompt) => prompt.id === activePrompt.prompt.id)
      < activePrompt.folder.prompts.length - 1,
  );

  return (
    <div className="prompt-desk">
      <div className="prompt-desk__dots" aria-hidden="true" />
      <header className="prompt-desk__bar">
        <p className="prompt-desk__mark">Futura Nota</p>
        <button type="button" className="prompt-desk__new" onClick={addCollection}>
          Nueva colección
        </button>
      </header>
      <div className="prompt-desk__grid">
        {folders.map((folder, index) => (
          <FolderCard
            key={folder.id}
            folder={folder}
            appearDelay={index * 120}
            onAdd={addPrompt}
            onRename={renameFolder}
            onDeleteFolder={deleteFolder}
            onDeletePrompt={deletePrompt}
            onOpenPrompt={(folderId, promptId) => {
              setActive({ folderId, promptId });
              setCompact(false);
            }}
          />
        ))}
      </div>

      {activePrompt ? (
        <InstructionPanel
          prompt={activePrompt.prompt}
          compact={compact}
          hasNext={hasNext}
          onPatch={patchPrompt}
          onCompact={() => setCompact(true)}
          onExpand={() => setCompact(false)}
          onClose={closePanel}
          onNext={goNext}
          onDelete={() => deletePrompt(activePrompt.folder.id, activePrompt.prompt.id)}
        />
      ) : null}
    </div>
  );
}

function InstructionPanel({ prompt, compact, hasNext, onPatch, onCompact, onExpand, onClose, onNext, onDelete }) {
  const snippet = (prompt.prompt || prompt.description || 'Prompt vacío').trim().slice(0, 90);

  function takeImage(file) {
    readImageFile(file, (image) => onPatch({ image }));
  }

  if (compact) {
    return (
      <button type="button" className="prompt-chip" onClick={onExpand}>
        {prompt.image ? (
          <img className="prompt-chip__img" src={prompt.image} alt="" />
        ) : (
          <span className="prompt-chip__img prompt-chip__img--empty" aria-hidden="true" />
        )}
        <span className="prompt-chip__copy">
          <span className="prompt-chip__name">{prompt.name || 'Untitled'}</span>
          <span className="prompt-chip__snippet">{snippet}</span>
        </span>
      </button>
    );
  }

  return (
    <section
      className="prompt-panel"
      aria-label="Prompt"
      onPaste={(event) => {
        const item = [...event.clipboardData.items].find((entry) => entry.type.startsWith('image/'));
        if (item) takeImage(item.getAsFile());
      }}
    >
      <header className="prompt-panel__bar">
        <input
          className="prompt-panel__name"
          value={prompt.name}
          placeholder="Nombre"
          aria-label="Nombre"
          onChange={(event) => onPatch({ name: event.target.value })}
        />
        <div className="prompt-panel__actions">
          <button type="button" onClick={onNext} disabled={!hasNext}>Next</button>
          <button type="button" onClick={onDelete}>Eliminar</button>
          <button type="button" onClick={onCompact}>Comprimir</button>
          <button type="button" onClick={onClose}>Cerrar</button>
        </div>
      </header>
      <input
        className="prompt-panel__desc"
        value={prompt.description}
        placeholder="Descripción"
        aria-label="Descripción"
        onChange={(event) => onPatch({ description: event.target.value })}
      />
      <div className="prompt-panel__split">
        <label
          className="prompt-panel__image"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            takeImage(event.dataTransfer.files?.[0]);
          }}
        >
          {prompt.image ? (
            <img src={prompt.image} alt="" />
          ) : (
            <span>Suelta o elige una imagen</span>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={(event) => takeImage(event.target.files?.[0])}
          />
        </label>
        <textarea
          className="prompt-panel__body"
          value={prompt.prompt}
          placeholder="Pega el prompt"
          aria-label="Prompt"
          onChange={(event) => onPatch({ prompt: event.target.value })}
        />
      </div>
    </section>
  );
}
