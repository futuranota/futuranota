import { describe, expect, it } from 'vitest';
import {
  assetCategoryForKind,
  detectPromptAssetKind,
  filterAssetsByCategory,
  uniqueZipName,
} from './promptAssets.js';

describe('detectPromptAssetKind', () => {
  it('classifies common files', () => {
    expect(detectPromptAssetKind({ name: 'a.png', type: 'image/png' })).toBe('image');
    expect(detectPromptAssetKind({ name: 'a.svg', type: 'image/svg+xml' })).toBe('svg');
    expect(detectPromptAssetKind({ name: 'a.pdf', type: 'application/pdf' })).toBe('pdf');
    expect(detectPromptAssetKind({ name: 'a.mp3', type: 'audio/mpeg' })).toBe('audio');
    expect(detectPromptAssetKind({ name: 'a.ttf', type: '' })).toBe('font');
    expect(detectPromptAssetKind({ name: 'notes.txt', type: 'text/plain' })).toBe('other');
  });
});

describe('filterAssetsByCategory', () => {
  const assets = [
    { id: '1', kind: 'image' },
    { id: '2', kind: 'svg' },
    { id: '3', kind: 'pdf' },
    { id: '4', kind: 'font' },
  ];

  it('defaults to all', () => {
    expect(filterAssetsByCategory(assets, 'all')).toHaveLength(4);
    expect(assetCategoryForKind('svg')).toBe('images');
  });

  it('filters images and fonts', () => {
    expect(filterAssetsByCategory(assets, 'images').map((item) => item.id)).toEqual(['1', '2']);
    expect(filterAssetsByCategory(assets, 'fonts').map((item) => item.id)).toEqual(['4']);
  });
});

describe('uniqueZipName', () => {
  it('avoids collisions', () => {
    const used = new Set();
    expect(uniqueZipName('a.png', used)).toBe('a.png');
    expect(uniqueZipName('a.png', used)).toBe('a-2.png');
  });
});
