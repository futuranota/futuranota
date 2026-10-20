import { describe, expect, it } from 'vitest';
import { buildPromptEmbed, sanitizeBrandSvg } from './EmbedHtml.jsx';

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

describe('sanitizeBrandSvg', () => {
  it('strips scripts and keeps the svg', () => {
    const next = sanitizeBrandSvg('<svg><script>alert(1)</script><circle cx="1" cy="1" r="1"/></svg>');
    expect(next).toContain('<svg>');
    expect(next).toContain('<circle');
    expect(next).not.toContain('script');
  });
});
