import { beforeEach, describe, expect, it } from 'vitest';
import { fixSocialMetaImages } from '../js/core/socialMeta';

function setMeta(property: 'og:image' | 'twitter:image', content: string): void {
  const selector =
    property === 'og:image' ? 'meta[property="og:image"]' : 'meta[name="twitter:image"]';
  const el = document.createElement('meta');
  if (property === 'og:image') {
    el.setAttribute('property', property);
  } else {
    el.setAttribute('name', property);
  }
  el.setAttribute('content', content);
  document.head.appendChild(el);
  expect(document.querySelector(selector)).not.toBeNull();
}

describe('fixSocialMetaImages', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
  });

  it('convierte og:image relativa a absoluta usando origin + BASE_URL', () => {
    setMeta('og:image', 'assets/icon-512.png');

    fixSocialMetaImages();

    const content = document
      .querySelector('meta[property="og:image"]')
      ?.getAttribute('content');
    expect(content).toMatch(/^https?:\/\//);
    expect(content).toContain('assets/icon-512.png');
  });

  it('convierte twitter:image relativa a absoluta', () => {
    setMeta('twitter:image', 'assets/icon-512.png');

    fixSocialMetaImages();

    const content = document
      .querySelector('meta[name="twitter:image"]')
      ?.getAttribute('content');
    expect(content).toMatch(/^https?:\/\//);
  });

  it('no toca una URL que ya es absoluta', () => {
    const already = 'https://example.com/foo.png';
    setMeta('og:image', already);

    fixSocialMetaImages();

    const content = document
      .querySelector('meta[property="og:image"]')
      ?.getAttribute('content');
    expect(content).toBe(already);
  });

  it('no lanza si el meta tag no existe en el documento', () => {
    expect(() => fixSocialMetaImages()).not.toThrow();
  });
});
