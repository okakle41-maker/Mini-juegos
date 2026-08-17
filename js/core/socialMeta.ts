/**
 * socialMeta.ts — Convierte las og:image / twitter:image de index.html
 * (rutas relativas, ver comentario en el <head>) a URLs absolutas en
 * runtime.
 *
 * Por qué no van absolutas directo en el HTML: el dominio real depende
 * de dónde se despliega el fork (GitHub Pages publica en
 * https://<usuario>.github.io/<repo>/, ver VITE_BASE en
 * .github/workflows/deploy.yml) — no hay un único dominio fijo que
 * hardcodear sin romperse en cualquier fork con otro usuario/nombre de
 * repo. `location.origin + import.meta.env.BASE_URL` sí resuelve al
 * dominio real de quien esté sirviendo la página, sea GitHub Pages,
 * Cloudflare Pages, un fork, o localhost en dev.
 *
 * Por qué esto no puede vivir directo en el <head> como <meta> estático:
 * el HTML se sirve tal cual (sin templating de servidor), así que
 * cualquier valor que dependa del origin solo puede resolverse en el
 * navegador — de ahí que este módulo corra en el bootstrap de app.ts
 * y reescriba los <meta> ya presentes en vez de generarlos desde cero.
 */

function toAbsolute(relativePath: string): string {
  return new URL(relativePath, `${location.origin}${import.meta.env.BASE_URL}`).href;
}

export function fixSocialMetaImages(): void {
  const selectors = [
    'meta[property="og:image"]',
    'meta[name="twitter:image"]',
  ];

  for (const selector of selectors) {
    const el = document.querySelector<HTMLMetaElement>(selector);
    if (!el) continue;
    const current = el.getAttribute('content');
    // Si ya es absoluta (alguien cambió el HTML a mano, o esto corre
    // dos veces), no hay nada que hacer — new URL() con una URL ya
    // absoluta la devuelve intacta de todos modos, pero el chequeo
    // evita trabajo de más.
    if (!current || /^https?:\/\//.test(current)) continue;
    el.setAttribute('content', toAbsolute(current));
  }
}

export default fixSocialMetaImages;
