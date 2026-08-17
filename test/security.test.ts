import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  escapeHtml,
  randomInt,
  sanitizeInput,
  isSafeString,
  safeJsonParse,
  RateLimiter,
  globalRateLimiter
} from '../js/security';

describe('escapeHtml', () => {
  it('escapa los cinco caracteres HTML peligrosos', () => {
    expect(escapeHtml('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#039;');
  });

  it('escapa un payload típico de XSS', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('deja intacto un string sin caracteres especiales', () => {
    expect(escapeHtml('hola mundo 123')).toBe('hola mundo 123');
  });

  it('maneja string vacío', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('escapa el & primero para no doble-escapar entidades generadas', () => {
    // Si escapara '<' antes que '&', '<' -> '&lt;' luego '&' -> '&amp;'
    // produciría '&amp;lt;' (doble escape). El orden actual evita eso.
    expect(escapeHtml('<')).toBe('&lt;');
  });
});

describe('randomInt', () => {
  it('devuelve 0 si max es 0 o negativo', () => {
    expect(randomInt(0)).toBe(0);
    expect(randomInt(-5)).toBe(0);
  });

  it('devuelve siempre un entero en [0, max)', () => {
    for (let i = 0; i < 200; i++) {
      const value = randomInt(7);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(7);
    }
  });

  it('con max=1 siempre devuelve 0', () => {
    for (let i = 0; i < 20; i++) {
      expect(randomInt(1)).toBe(0);
    }
  });

  it('usa crypto.getRandomValues en vez de Math.random', () => {
    const spy = vi.spyOn(crypto, 'getRandomValues');
    randomInt(10);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('re-muestrea (rechazo) cuando el primer valor cae fuera del rango uniforme', () => {
    // max=3: range = floor(2^32/3)*3 = 4294967295 (0x100000000/3 es exacto
    // en este caso). Usamos 0xFFFFFFFF (4294967295), que es >= range y
    // por lo tanto se descarta, y luego un valor válido, para cubrir la
    // rama del do-while que vuelve a pedir valores.
    let call = 0;
    const spy = vi.spyOn(crypto, 'getRandomValues').mockImplementation((buf: any) => {
      call++;
      buf[0] = call === 1 ? 0xffffffff : 5; // 1ra: fuera de range; 2da: válida
      return buf;
    });

    const result = randomInt(3);
    expect(spy).toHaveBeenCalledTimes(2);
    expect(result).toBe(5 % 3);
    spy.mockRestore();
  });
});

describe('sanitizeInput', () => {
  it('trunca al maxLength por defecto (1000)', () => {
    const longInput = 'a'.repeat(1500);
    expect(sanitizeInput(longInput).length).toBe(1000);
  });

  it('respeta un maxLength custom', () => {
    expect(sanitizeInput('abcdefgh', { maxLength: 3 })).toBe('abc');
  });

  it('remueve caracteres de control peligrosos', () => {
    const withControlChars = 'hola\x00mundo\x1Ftest\x7F';
    expect(sanitizeInput(withControlChars, { allowScript: true })).toBe('holamundotest');
  });

  it('preserva tab, newline y carriage return (fuera del rango removido)', () => {
    const input = 'linea1\nlinea2\ttab';
    // allowScript true para no interferir con otras reglas en este caso puntual
    expect(sanitizeInput(input, { allowScript: true })).toBe('linea1\nlinea2\ttab');
  });

  it('escapa HTML por defecto (allowHtml=false)', () => {
    // allowScript:true evita que el paso anti-script remueva los
    // caracteres < > ya escapados, así se aisla el efecto de escapeHtml.
    expect(sanitizeInput('<b>hola</b>', { allowScript: true })).toBe(
      '&lt;b&gt;hola&lt;/b&gt;'
    );
  });

  it('no escapa HTML si allowHtml=true', () => {
    // Con allowHtml true no se escapa, pero allowScript por defecto es
    // false, así que igual se remueven < > " ' ` = en el paso de
    // sanitización de scripts.
    const result = sanitizeInput('<b>hola</b>', { allowHtml: true, allowScript: true });
    expect(result).toBe('<b>hola</b>');
  });

  it('remueve el patrón javascript: (case-insensitive)', () => {
    const result = sanitizeInput('JavaScript:alert(1)', { allowHtml: true });
    expect(result.toLowerCase()).not.toContain('javascript:');
  });

  it('remueve la palabra "script" en cualquier casing', () => {
    const result = sanitizeInput('<ScRiPt>x</ScRiPt>', { allowHtml: true });
    expect(result.toLowerCase()).not.toContain('script');
  });

  it('remueve los caracteres < > " \' ` = cuando allowScript es false', () => {
    const result = sanitizeInput(`a<b>c"d'e\`f=g`, { allowHtml: true });
    expect(result).not.toMatch(/[<>"'`=]/);
  });

  it('aplica la limpieza de forma iterativa hasta estabilizar (evita bypass por anidamiento)', () => {
    // 'javascript:' anidado de forma que una sola pasada de replace
    // dejaría un 'javascript:' reconstruido si no fuera iterativo.
    const payload = 'javajavascript:script:alert(1)';
    const result = sanitizeInput(payload, { allowHtml: true });
    expect(result.toLowerCase()).not.toContain('javascript:');
    expect(result.toLowerCase()).not.toContain('script');
  });

  it('permite script y HTML crudo si ambas opciones están en true, pero igual limpia control chars y trunca', () => {
    const result = sanitizeInput('<script>x</script>\x00', { allowHtml: true, allowScript: true });
    expect(result).toBe('<script>x</script>');
  });

  it('hace trim del resultado final', () => {
    expect(sanitizeInput('  hola  ', { allowScript: true, allowHtml: true })).toBe('hola');
  });

  it('devuelve string vacío para input vacío', () => {
    expect(sanitizeInput('')).toBe('');
  });
});

describe('isSafeString', () => {
  it('acepta strings normales sin patrones peligrosos', () => {
    expect(isSafeString('Hola, este es un nombre de sala normal 123')).toBe(true);
  });

  it.each([
    ['<script>alert(1)</script>', '<script'],
    ['javascript:alert(1)', 'javascript:'],
    ['<img onerror=alert(1)>', 'on\\w+='],
    ['<iframe src="x"></iframe>', '<iframe'],
    ['<object data="x">', '<object'],
    ['<embed src="x">', '<embed'],
    ['eval(maliciousCode)', 'eval('],
    ['document.cookie', 'document.'],
    ['window.location', 'window.'],
    ['../../etc/passwd', '../'],
    ['data:text/html;base64,xxx', 'data:'],
    ['vbscript:msgbox(1)', 'vbscript:']
  ])('rechaza el patrón peligroso: %s', (input) => {
    expect(isSafeString(input)).toBe(false);
  });

  it('la detección de patrones no distingue mayúsculas/minúsculas', () => {
    expect(isSafeString('<SCRIPT>alert(1)</SCRIPT>')).toBe(false);
    expect(isSafeString('JAVASCRIPT:alert(1)')).toBe(false);
  });

  it('BUG conocido: /data:/i matchea cualquier palabra que contenga "data:" como substring, no solo el esquema de URI', () => {
    // No es estrictamente un bug de seguridad (falso positivo, no falso
    // negativo), pero documenta que el patrón es más agresivo de lo
    // que su nombre sugiere: cualquier texto legítimo con "data:" en
    // medio (p.ej. un mensaje de error) se marca como inseguro.
    expect(isSafeString('metadata: importante')).toBe(false);
  });
});

describe('safeJsonParse', () => {
  it('devuelve el fallback si el JSON no es parseable', () => {
    expect(safeJsonParse('{esto no es json', { ok: false })).toEqual({ ok: false });
  });

  it('devuelve el fallback si isSafeString detecta un patrón peligroso en el texto crudo', () => {
    const malicious = '{"x": "<script>alert(1)</script>"}';
    expect(safeJsonParse(malicious, null)).toBeNull();
  });

  it('parsea correctamente primitivos seguros (no son "object", así que no pasan por la validación de claves)', () => {
    expect(safeJsonParse('42', 0)).toBe(42);
    expect(safeJsonParse('"hola"', '')).toBe('hola');
    expect(safeJsonParse('true', false)).toBe(true);
    expect(safeJsonParse('null', 'fallback')).toBeNull();
  });

  it('parsea correctamente arrays JSON legítimos (fix: ya no cae en la validación de claves heredadas)', () => {
    const fallback: number[] = [];
    expect(safeJsonParse('[1,2,3]', fallback)).toEqual([1, 2, 3]);
  });

  it(
    'FIX: parsea correctamente cualquier objeto JSON legítimo, incluso no vacío, ' +
      'porque ahora usa `Object.prototype.hasOwnProperty.call(parsed, key)` en vez de ' +
      '`key in parsed` (que recorría la cadena de prototipos). Antes, todo objeto ' +
      'heredaba "constructor" de Object.prototype y la condición siempre daba true, ' +
      'rechazando cualquier objeto/array no vacío.',
    () => {
      const fallback = { default: true };
      expect(safeJsonParse('{"a":1,"b":"text"}', fallback)).toEqual({ a: 1, b: 'text' });
      expect(safeJsonParse('{}', fallback)).toEqual({});
      expect(safeJsonParse('{"nombre":"jugador1","puntaje":100}', fallback)).toEqual({
        nombre: 'jugador1',
        puntaje: 100
      });
    }
  );

  it('sigue rechazando un objeto con __proto__ propio (el caso que la función intenta prevenir)', () => {
    const fallback = { safe: true };
    // JSON.parse('{"__proto__":...}') crea __proto__ como propiedad PROPIA
    // del objeto (no la heredada de Object.prototype), así que
    // hasOwnProperty sigue detectándola correctamente.
    expect(safeJsonParse('{"__proto__":{"polluted":true}}', fallback)).toBe(fallback);
  });

  it('sigue rechazando un objeto con "constructor" o "prototype" como propiedad propia', () => {
    const fallback = { safe: true };
    expect(safeJsonParse('{"constructor":{"polluted":true}}', fallback)).toBe(fallback);
    expect(safeJsonParse('{"prototype":{"polluted":true}}', fallback)).toBe(fallback);
  });

  it('captura el warning de consola cuando rechaza por clave peligrosa propia', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    safeJsonParse('{"__proto__":{"polluted":true}}', null);
    expect(warnSpy).toHaveBeenCalledWith(
      '[Security] Dangerous key detected in JSON:',
      expect.any(String)
    );
    warnSpy.mockRestore();
  });
});

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('permite requests hasta el límite configurado', () => {
    const limiter = new RateLimiter(3, 60000);
    expect(limiter.check('user1')).toBe(true);
    expect(limiter.check('user1')).toBe(true);
    expect(limiter.check('user1')).toBe(true);
  });

  it('bloquea el request que excede el límite', () => {
    const limiter = new RateLimiter(2, 60000);
    expect(limiter.check('user1')).toBe(true);
    expect(limiter.check('user1')).toBe(true);
    expect(limiter.check('user1')).toBe(false);
  });

  it('trackea identificadores distintos de forma independiente', () => {
    const limiter = new RateLimiter(1, 60000);
    expect(limiter.check('user1')).toBe(true);
    expect(limiter.check('user2')).toBe(true);
    expect(limiter.check('user1')).toBe(false);
    expect(limiter.check('user2')).toBe(false);
  });

  it('libera cupo una vez que pasa la ventana de tiempo', () => {
    const limiter = new RateLimiter(1, 60000);
    expect(limiter.check('user1')).toBe(true);
    expect(limiter.check('user1')).toBe(false);

    vi.advanceTimersByTime(60001);

    expect(limiter.check('user1')).toBe(true);
  });

  it('no libera cupo justo antes de que expire la ventana', () => {
    const limiter = new RateLimiter(1, 60000);
    expect(limiter.check('user1')).toBe(true);

    vi.advanceTimersByTime(59999);

    expect(limiter.check('user1')).toBe(false);
  });

  it('reset() limpia el historial de un identificador puntual', () => {
    const limiter = new RateLimiter(1, 60000);
    limiter.check('user1');
    limiter.check('user2');
    expect(limiter.check('user1')).toBe(false);

    limiter.reset('user1');

    expect(limiter.check('user1')).toBe(true);
    // user2 no fue afectado
    expect(limiter.check('user2')).toBe(false);
  });

  it('clear() limpia todos los identificadores', () => {
    const limiter = new RateLimiter(1, 60000);
    limiter.check('user1');
    limiter.check('user2');

    limiter.clear();

    expect(limiter.check('user1')).toBe(true);
    expect(limiter.check('user2')).toBe(true);
  });

  it('usa los valores por defecto (maxRequests=10, windowMs=60000) si no se pasan', () => {
    const limiter = new RateLimiter();
    for (let i = 0; i < 10; i++) {
      expect(limiter.check('default-user')).toBe(true);
    }
    expect(limiter.check('default-user')).toBe(false);
  });

  it('solo cuenta requests dentro de la ventana al filtrar, dejando pasar tras vencimiento parcial', () => {
    const limiter = new RateLimiter(2, 1000);
    expect(limiter.check('user1')).toBe(true); // t=0

    vi.advanceTimersByTime(500);
    expect(limiter.check('user1')).toBe(true); // t=500, 2 requests activos

    vi.advanceTimersByTime(501); // t=1001: el de t=0 expira, el de t=500 sigue vivo
    expect(limiter.check('user1')).toBe(true); // ahora hay 2 activos (t=500, t=1001)
    expect(limiter.check('user1')).toBe(false); // 3ro se bloquea
  });
});

describe('globalRateLimiter', () => {
  afterEach(() => {
    globalRateLimiter.clear();
  });

  it('es una instancia de RateLimiter exportada como singleton', () => {
    expect(globalRateLimiter).toBeInstanceOf(RateLimiter);
  });

  it('está configurado con maxRequests=100 y windowMs=60000', () => {
    for (let i = 0; i < 100; i++) {
      expect(globalRateLimiter.check('singleton-test')).toBe(true);
    }
    expect(globalRateLimiter.check('singleton-test')).toBe(false);
  });
});
