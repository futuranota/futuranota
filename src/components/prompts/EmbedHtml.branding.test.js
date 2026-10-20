import { describe, expect, it } from 'vitest';
import { buildPromptEmbed, readBrandFile, sanitizeBrandSvg, stripPasteColor } from './EmbedHtml.jsx';

describe('buildPromptEmbed branding', () => {
  it('injects the 40x40 mark, alt, and data-fn-brand into copied HTML', () => {
    const html = buildPromptEmbed({
      text: 'Hello',
      background: '#ffffff',
      color: '#000000',
      button: '#f4f1eb',
      logoSrc: 'data:image/png;base64,aaa',
      logoAlt: 'Studio Norte',
    });
    expect(html).toContain('data-fn-brand="Studio Norte"');
    expect(html).toContain('alt="Studio Norte"');
    expect(html).toContain('width="40"');
    expect(html).toContain('height="40"');
    expect(html).toContain('src="data:image/png;base64,aaa"');
    expect(html).toContain('querySelector("[data-fn-prompt]")');
  });

  it('injects a public brand URL into copied HTML', () => {
    const html = buildPromptEmbed({
      text: 'Hello',
      background: '#ffffff',
      color: '#000000',
      button: '#f4f1eb',
      logoSrc: 'https://cdn.example.com/embed-brand/logo.jpg',
      logoAlt: 'Studio Norte',
    });
    expect(html).toContain('src="https://cdn.example.com/embed-brand/logo.jpg"');
    expect(html).toContain('data-fn-brand="Studio Norte"');
  });

  it('rejects a brand file over 5 MB and accepts PNG as a format', async () => {
    const file = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'logo.png', { type: 'image/png' });
    await expect(readBrandFile(file)).rejects.toThrow(/5 MB/);
  });

  it('omits the image when there is no logo', () => {
    const html = buildPromptEmbed({
      text: 'Hello',
      background: '#ffffff',
      color: '#000000',
      button: '#f4f1eb',
    });
    expect(html).not.toContain('<img');
    expect(html).not.toContain('data-fn-brand');
  });
});

describe('stripPasteColor', () => {
  it('drops inline color so pasted text follows the box', () => {
    const next = stripPasteColor('<span style="color:#ff0000;font-weight:700">Hello</span>');
    expect(next).not.toMatch(/color\s*:/i);
    expect(next).toContain('Hello');
  });
});

describe('sanitizeBrandSvg', () => {
  it('strips scripts and keeps the svg', () => {
    const next = sanitizeBrandSvg('<svg><script>alert(1)</script><circle cx="1" cy="1" r="1"/></svg>');
    expect(next).toContain('<svg>');
    expect(next).toContain('<circle');
    expect(next).not.toContain('script');
  });
});
