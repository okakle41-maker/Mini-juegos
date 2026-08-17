/**
 * Security Utilities
 * Validaciones y sanitización para prevenir XSS, inyección de código y otros problemas de seguridad
 */

/**
 * Escapa caracteres HTML especiales para prevenir XSS
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Entero aleatorio en [0, max) usando crypto.getRandomValues en vez de
 * Math.random(). No hay implicaciones de seguridad reales en los
 * lugares donde se usa hoy (generación de contenido de minijuegos, no
 * tokens/secretos), pero se prefiere sobre Math.random() para no
 * depender de un PRNG no-criptográfico y evitar la alerta de "insecure
 * randomness" de CodeQL. Usa rechazo de muestreo para no introducir
 * sesgo modular cuando `max` no divide exactamente el rango de
 * Uint32.
 */
export function randomInt(max: number): number {
  if (max <= 0) return 0;
  const range = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  let value: number;
  do {
    crypto.getRandomValues(buf);
    value = buf[0];
  } while (value >= range);
  return value % max;
}

/**
 * Sanitiza input de usuario para prevenir inyección de código
 */
export function sanitizeInput(input: string, options?: {
  maxLength?: number;
  allowHtml?: boolean;
  allowScript?: boolean;
}): string {
  const { maxLength = 1000, allowHtml = false, allowScript = false } = options || {};
  
  // Truncar si excede maxLength
  let sanitized = input.length > maxLength ? input.slice(0, maxLength) : input;
  
  // Remover caracteres de control peligrosos. Intencional: esta es
  // precisamente la sanitización que remueve caracteres de control
  // (incluye \x7F/DEL, fuera del rango que cubre no-control-regex por
  // defecto). No es un regex con un caracter de control colado por
  // error; es el propósito de esta línea.
  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Si no se permite HTML, escapar
  if (!allowHtml) {
    sanitized = escapeHtml(sanitized);
  }
  
  // Si no se permite script, remover patrones de script
  if (!allowScript) {
    let previous: string;
    do {
      previous = sanitized;
      sanitized = sanitized
        .replace(/javascript:/gi, '')
        .replace(/script/gi, '')
        .replace(/[<>"'`=]/g, '');
    } while (sanitized !== previous);
  }
  
  return sanitized.trim();
}

/**
 * Valida que un string no contenga patrones peligrosos
 */
export function isSafeString(input: string): boolean {
  const dangerousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /eval\(/i,
    /document\./i,
    /window\./i,
    /\.\.\//i,
    /data:/i,
    /vbscript:/i
  ];
  
  return !dangerousPatterns.some(pattern => pattern.test(input));
}

/**
 * Valida que un JSON sea seguro antes de parsear
 */
export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    // Validar que no contenga patrones peligrosos
    if (!isSafeString(json)) {
      console.warn('[Security] Potentially dangerous JSON detected');
      return fallback;
    }
    
    const parsed = JSON.parse(json);
    
    // Validar que no sea un objeto con propiedades peligrosas
    if (typeof parsed === 'object' && parsed !== null) {
      const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
      for (const key of dangerousKeys) {
        if (Object.prototype.hasOwnProperty.call(parsed, key)) {
          console.warn('[Security] Dangerous key detected in JSON:', key);
          return fallback;
        }
      }
    }
    
    return parsed as T;
  } catch (error) {
    console.warn('[Security] Failed to parse JSON:', error);
    return fallback;
  }
}

/**
 * Rate limiter simple para prevenir abuso
 */
export class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 10, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  check(identifier: string): boolean {
    const now = Date.now();
    const requests = this.requests.get(identifier) || [];
    
    // Remover requests viejos fuera de la ventana
    const validRequests = requests.filter(time => now - time < this.windowMs);
    
    if (validRequests.length >= this.maxRequests) {
      return false;
    }
    
    validRequests.push(now);
    this.requests.set(identifier, validRequests);
    return true;
  }

  reset(identifier: string): void {
    this.requests.delete(identifier);
  }

  clear(): void {
    this.requests.clear();
  }
}

// Singleton instance para rate limiting global
export const globalRateLimiter = new RateLimiter(100, 60000);
