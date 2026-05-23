import { readFileSync, writeFileSync, renameSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '../src');

function patch(file, fn) {
  const p = join(srcDir, file);
  writeFileSync(p, fn(readFileSync(p, 'utf8')));
}

// data.jsx
patch('data.jsx', (s) =>
  s.replace(
    /Object\.assign\(window, \{[\s\S]*?\}\);?\s*$/,
    `export {
  TODAY, COMPANIES, CAMPAIGN_VOLTWAY, CAMPAIGN_LUMEN, INTEL, OVERVIEWS, URL_EXTRACT_SAMPLE,
  BLUEPRINT_COLORS,
  daysBetween, fmtDate, shortId, defaultOverview,
};
`
  )
);

// canvas.jsx
patch('canvas.jsx', (s) => {
  let out = `import { daysBetween, fmtDate, shortId } from './data.jsx';\n\n` + s;
  out = out
    .replace(/window\.daysBetween/g, 'daysBetween')
    .replace(/window\.fmtDate/g, 'fmtDate')
    .replace(/window\.shortId/g, 'shortId')
    .replace(
      /Object\.assign\(window, \{ BlueprintCanvas, CanvasNode, Icon, computeMetricValue, parseDate \}\);?\s*$/,
      `export { BlueprintCanvas, CanvasNode, Icon, computeMetricValue, parseDate };
`
    );
  return out;
});

// panels.jsx
patch('panels.jsx', (s) => {
  let out = `import { useState, useEffect, useRef } from 'react';
import { daysBetween, fmtDate, TODAY } from './data.jsx';
import { parseDate } from './canvas.jsx';

`;
  out += s
    .replace(
      /window\.parseDate\s*\?\s*window\.parseDate\(note\.content\)\s*:\s*new Date\(note\.content\)/g,
      'parseDate(note.content)'
    )
    .replace(/window\.parseDate/g, 'parseDate')
    .replace(/window\.TODAY/g, 'TODAY')
    .replace(/window\.daysBetween/g, 'daysBetween')
    .replace(/window\.fmtDate/g, 'fmtDate')
    .replace(/React\.useState/g, 'useState')
    .replace(/React\.useEffect/g, 'useEffect')
    .replace(/React\.useRef/g, 'useRef')
    .replace(
      /Object\.assign\(window, \{ NewNoteForm[\s\S]*?\}\);?\s*$/,
      `export { NewNoteForm, NoteCard, NotesPanel, Tabs, Signal, IntelPanel, Calendar, Timeline, TimelineTrack };
`
    );
  return out;
});

// dashboard.jsx
patch('dashboard.jsx', (s) => {
  let out = `import { useState, useEffect } from 'react';
import { URL_EXTRACT_SAMPLE } from './data.jsx';

`;
  out += s
    .replace(/window\.URL_EXTRACT_SAMPLE/g, 'URL_EXTRACT_SAMPLE')
    .replace(/React\.useState/g, 'useState')
    .replace(/React\.useEffect/g, 'useEffect')
    .replace(
      /Object\.assign\(window, \{ TopBar, MetaBar, ScanOverlay, UrlModal, Toast \}\);?\s*$/,
      `export { TopBar, MetaBar, ScanOverlay, UrlModal, Toast };
`
    );
  return out;
});

// tweaks-panel.jsx
patch('tweaks-panel.jsx', (s) => {
  let out = `import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

`;
  out += s
    .replace(/React\.useState/g, 'useState')
    .replace(/React\.useCallback/g, 'useCallback')
    .replace(/React\.useRef/g, 'useRef')
    .replace(/React\.useEffect/g, 'useEffect')
    .replace(/React\.useMemo/g, 'useMemo')
    .replace(
      /Object\.assign\(window, \{[\s\S]*?\}\);?\s*$/,
      `export {
  useTweaks, TweaksPanel, TweakSection, TweakRow,
  TweakSlider, TweakToggle, TweakRadio, TweakSelect,
  TweakText, TweakNumber, TweakColor, TweakButton,
};
`
    );
  return out;
});

// app.jsx -> App.jsx
const appImports = `import { useState, useEffect, useRef } from 'react';
import {
  COMPANIES, TODAY, CAMPAIGN_VOLTWAY, CAMPAIGN_LUMEN, INTEL, OVERVIEWS,
  BLUEPRINT_COLORS, daysBetween, fmtDate, shortId, defaultOverview,
} from './data.jsx';
import { BlueprintCanvas } from './canvas.jsx';
import {
  NotesPanel, IntelPanel, Timeline,
} from './panels.jsx';
import { TopBar, MetaBar, ScanOverlay, UrlModal, Toast } from './dashboard.jsx';
import {
  useTweaks, TweaksPanel, TweakSection, TweakRadio, TweakSelect, TweakButton,
} from './tweaks-panel.jsx';

`;

patch('app.jsx', (s) => {
  let out = appImports + s;
  const dataKeys = [
    'COMPANIES', 'TODAY', 'CAMPAIGN_VOLTWAY', 'CAMPAIGN_LUMEN', 'INTEL', 'OVERVIEWS',
    'BLUEPRINT_COLORS', 'daysBetween', 'fmtDate', 'shortId', 'defaultOverview',
  ];
  for (const k of dataKeys) {
    out = out.replace(new RegExp(`window\\.${k}\\b`, 'g'), k);
  }
  out = out
    .replace(/React\.useState/g, 'useState')
    .replace(/React\.useEffect/g, 'useEffect')
    .replace(/React\.useRef/g, 'useRef')
    .replace(/\nReactDOM\.createRoot\(document\.getElementById\("root"\)\)\.render\(<App \/>\);\s*$/, '\nexport default App;\n');
  return out;
});

renameSync(join(srcDir, 'app.jsx'), join(srcDir, 'App.jsx'));
console.log('Migration complete.');
