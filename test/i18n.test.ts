import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// I18nManager corre detectLocale() dentro de su constructor y se
// exporta como singleton (`export const i18n = new I18nManager()`),
// así que cada test necesita un módulo fresco vía vi.resetModules() +
// re-import dinámico — mismo patrón que test/safeStorage.test.ts —
// para poder controlar localStorage/navigator.language ANTES de que
// el constructor corra.

const originalLanguage = Object.getOwnPropertyDescriptor(navigator, 'language');

function setBrowserLanguage(lang: string): void {
  Object.defineProperty(navigator, 'language', {
    value: lang,
    configurable: true,
  });
}

async function freshI18n(): Promise<typeof import('../js/i18n').default> {
  vi.resetModules();
  return (await import('../js/i18n')).default;
}

describe('I18n — detección de locale al iniciar', () => {
  afterEach(() => {
    if (originalLanguage) {
      Object.defineProperty(navigator, 'language', originalLanguage);
    }
  });

  it('usa el locale guardado en localStorage si es uno disponible', async () => {
    (localStorage.getItem as any).mockReturnValue('fr');
    setBrowserLanguage('en-US');

    const i18n = await freshI18n();

    expect(i18n.getLocale()).toBe('fr');
  });

  it('ignora un locale guardado que no está disponible y cae al idioma del navegador', async () => {
    (localStorage.getItem as any).mockReturnValue('klingon');
    setBrowserLanguage('de-DE');

    const i18n = await freshI18n();

    expect(i18n.getLocale()).toBe('de');
  });

  it('sin locale guardado, usa el idioma del navegador si está disponible (recorta la región)', async () => {
    (localStorage.getItem as any).mockReturnValue(null);
    setBrowserLanguage('pt-BR');

    const i18n = await freshI18n();

    expect(i18n.getLocale()).toBe('pt');
  });

  it('sin locale guardado y con idioma de navegador no soportado, cae a español por defecto', async () => {
    (localStorage.getItem as any).mockReturnValue(null);
    setBrowserLanguage('ru-RU');

    const i18n = await freshI18n();

    expect(i18n.getLocale()).toBe('es');
  });
});

describe('I18n — t() (traducción de claves)', () => {
  let i18n: Awaited<ReturnType<typeof freshI18n>>;

  beforeEach(async () => {
    (localStorage.getItem as any).mockReturnValue(null);
    setBrowserLanguage('es-ES');
    i18n = await freshI18n();
  });

  afterEach(() => {
    if (originalLanguage) {
      Object.defineProperty(navigator, 'language', originalLanguage);
    }
  });

  it('devuelve la traducción para una clave con namespace (nested)', () => {
    expect(i18n.t('game.start')).toBe('Iniciar');
  });

  it('devuelve la clave tal cual si no existe en ningún idioma', () => {
    expect(i18n.t('esto.no.existe')).toBe('esto.no.existe');
  });

  it('con params pero sin placeholders {} en el string, devuelve el valor sin modificar', () => {
    // Ninguna clave real del diccionario usa placeholders {} hoy;
    // esto documenta que pasar params no rompe ni altera un string
    // que no los declara.
    const result = i18n.t('game.score', { round: 3 });
    expect(result).toBe('Puntuación');
  });

  it('con una clave inexistente y params, no lanza y devuelve la clave tal cual', () => {
    const result = i18n.t('clave.inexistente', { nombre: 'Ana' });
    expect(result).toBe('clave.inexistente');
  });

  it('cuando el locale actual es "en", devuelve la traducción en inglés', () => {
    i18n.setLocale('en');
    expect(i18n.t('game.start')).toBe('Start');
  });

  it('si la clave no existe en el locale activo pero sí en el fallback (es), usa el fallback', () => {
    // El diccionario real tiene las mismas claves en todos los idiomas,
    // así que no hay un caso real que ejercite el fallback sin tocar
    // el estado interno. Se borra la clave del diccionario 'en' para
    // simular el escenario real: traducción faltante en el locale
    // activo pero presente en el fallback ('es').
    i18n.setLocale('en');
    delete (i18n as any).translations.get('en')['button.ok'];

    expect(i18n.t('button.ok')).toBe('Aceptar'); // valor en 'es', el fallbackLocale
  });

  it('si la clave no existe ni en el locale activo ni en el fallback, devuelve la clave', () => {
    i18n.setLocale('en');
    delete (i18n as any).translations.get('en')['button.ok'];
    delete (i18n as any).translations.get('es')['button.ok'];

    expect(i18n.t('button.ok')).toBe('button.ok');
  });
});

describe('I18n — reemplazo de placeholders {param} en t()', () => {
  // Ninguna clave del diccionario real usa hoy placeholders {param}
  // (confirmado con grep sobre js/i18n.ts). El mecanismo de reemplazo
  // existe en el código (t(), ~líneas 542-552) pero está sin ejercitar
  // por ningún dato real. Se inserta una clave con placeholder
  // directamente en el Map interno (no hay API pública para agregar
  // traducciones) para probar el mecanismo sin tocar el diccionario de
  // producción.
  afterEach(() => {
    if (originalLanguage) {
      Object.defineProperty(navigator, 'language', originalLanguage);
    }
  });

  it('reemplaza {placeholder} por el valor pasado en params', async () => {
    (localStorage.getItem as any).mockReturnValue(null);
    setBrowserLanguage('es-ES');
    const i18n = await freshI18n();

    (i18n as any).translations.get('es')['test.saludo'] = 'Hola {nombre}, tenés {puntos} puntos';

    const result = i18n.t('test.saludo', { nombre: 'Ana', puntos: 42 });
    expect(result).toBe('Hola Ana, tenés 42 puntos');
  });

  it('deja intacto un placeholder sin correspondencia en params', async () => {
    (localStorage.getItem as any).mockReturnValue(null);
    setBrowserLanguage('es-ES');
    const i18n = await freshI18n();

    (i18n as any).translations.get('es')['test.saludo'] = 'Hola {nombre}, tenés {puntos} puntos';

    const result = i18n.t('test.saludo', { nombre: 'Ana' });
    expect(result).toBe('Hola Ana, tenés {puntos} puntos');
  });
});

describe('I18n — setLocale()', () => {
  let i18n: Awaited<ReturnType<typeof freshI18n>>;

  beforeEach(async () => {
    (localStorage.getItem as any).mockReturnValue(null);
    setBrowserLanguage('es-ES');
    document.documentElement.dir = 'ltr';
    document.documentElement.lang = '';
    i18n = await freshI18n();
  });

  afterEach(() => {
    if (originalLanguage) {
      Object.defineProperty(navigator, 'language', originalLanguage);
    }
  });

  it('cambia el locale activo cuando el código es válido', () => {
    i18n.setLocale('en');
    expect(i18n.getLocale()).toBe('en');
  });

  it('persiste el locale nuevo en localStorage', () => {
    i18n.setLocale('en');
    expect(localStorage.setItem).toHaveBeenCalledWith('locale', 'en');
  });

  it('ignora un locale inválido y mantiene el actual', () => {
    i18n.setLocale('klingon');
    expect(i18n.getLocale()).toBe('es');
  });

  it('no persiste el locale en localStorage si el locale pasado es inválido', () => {
    i18n.setLocale('klingon');
    // safeStorage hace un probe interno de disponibilidad
    // (__safe_storage_probe__) en cada construcción del singleton, así
    // que localStorage.setItem sí se llama durante el beforeEach — lo
    // que este test verifica es que la clave 'locale' específicamente
    // nunca se escribe cuando el locale es inválido.
    expect(localStorage.setItem).not.toHaveBeenCalledWith('locale', expect.anything());
  });

  it('dispara un evento "locale:changed" con el nuevo locale en el detail', () => {
    const handler = vi.fn();
    window.addEventListener('locale:changed', handler);

    i18n.setLocale('en');

    expect(handler).toHaveBeenCalledTimes(1);
    const event = handler.mock.calls[0][0] as CustomEvent;
    expect(event.detail).toBe('en');

    window.removeEventListener('locale:changed', handler);
  });

  it('actualiza document.documentElement.dir a "rtl" para un idioma RTL (árabe)', () => {
    i18n.setLocale('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
  });

  it('actualiza document.documentElement.dir a "ltr" para un idioma no-RTL', () => {
    i18n.setLocale('en');
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.documentElement.lang).toBe('en');
  });
});

describe('I18n — metadatos de locales', () => {
  let i18n: Awaited<ReturnType<typeof freshI18n>>;

  beforeEach(async () => {
    (localStorage.getItem as any).mockReturnValue(null);
    setBrowserLanguage('es-ES');
    i18n = await freshI18n();
  });

  afterEach(() => {
    if (originalLanguage) {
      Object.defineProperty(navigator, 'language', originalLanguage);
    }
  });

  it('getAvailableLocales() devuelve los 8 idiomas soportados', () => {
    const locales = i18n.getAvailableLocales();
    expect(locales).toHaveLength(8);
    expect(locales.map((l) => l.code)).toEqual(
      expect.arrayContaining(['es', 'en', 'pt', 'fr', 'de', 'ja', 'zh', 'ar'])
    );
  });

  it('isRTL() es false para español (locale por defecto)', () => {
    expect(i18n.isRTL()).toBe(false);
  });

  it('isRTL() es true tras cambiar a árabe', () => {
    i18n.setLocale('ar');
    expect(i18n.isRTL()).toBe(true);
  });

  it('getCurrentLocaleConfig() devuelve el config completo del locale activo', () => {
    i18n.setLocale('ja');
    const config = i18n.getCurrentLocaleConfig();
    expect(config).toMatchObject({ code: 'ja', name: '日本語', rtl: false });
  });
});
