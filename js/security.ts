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
 * Escapa caracteres especiales de JavaScript
 */
export function escapeJs(unsafe: string): string {
  return unsafe
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\f/g, '\\f')
    .replace(/\v/g, '\\v')
    .replace(/\0/g, '\\0');
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
  
  // Remover caracteres de control peligrosos
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
 * Valida que un string sea un ID seguro (solo letras, números, guiones, guiones bajos)
 */
export function isValidId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

/**
 * Valida que una URL sea segura (solo http, https, mailto, tel)
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Valida que un email tenga formato válido
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Valida que un número esté en un rango seguro
 */
export function isSafeNumber(value: number, min?: number, max?: number): boolean {
  if (!Number.isFinite(value)) return false;
  if (min !== undefined && value < min) return false;
  if (max !== undefined && value > max) return false;
  return true;
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
 * Sanitiza un nombre de archivo para prevenir path traversal
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\.\./g, '_')
    .replace(/^\./, '_')
    .slice(0, 255);
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
        if (key in parsed) {
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
 * Crea un CSP (Content Security Policy) nonce
 */
export function generateNonce(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Valida que un nonce sea seguro
 */
export function isValidNonce(nonce: string): boolean {
  return /^[a-f0-9]{32}$/.test(nonce);
}

/**
 * Sanitiza atributos HTML
 */
export function sanitizeAttributes(attrs: Record<string, string>): Record<string, string> {
  const dangerousAttrs = ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus', 'onblur'];
  const sanitized: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(attrs)) {
    // Saltar atributos de evento
    if (dangerousAttrs.includes(key.toLowerCase())) {
      console.warn('[Security] Skipping dangerous attribute:', key);
      continue;
    }
    
    // Validar que el valor sea seguro
    if (key === 'href' || key === 'src') {
      if (!isValidUrl(value) && !value.startsWith('#') && !value.startsWith('/')) {
        console.warn('[Security] Skipping unsafe URL in attribute:', key);
        continue;
      }
    }
    
    sanitized[key] = escapeHtml(value);
  }
  
  return sanitized;
}

/**
 * Valida que un objeto de configuración sea seguro
 */
export function validateConfig(config: Record<string, any>, schema: Record<string, {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  allowedValues?: any[];
}>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  for (const [key, rules] of Object.entries(schema)) {
    const value = config[key];
    
    // Validar required
    if (rules.required && (value === undefined || value === null)) {
      errors.push(`Required field missing: ${key}`);
      continue;
    }
    
    if (value === undefined || value === null) continue;
    
    // Validar tipo
    switch (rules.type) {
      case 'string':
        if (typeof value !== 'string') {
          errors.push(`Invalid type for ${key}: expected string, got ${typeof value}`);
        } else if (rules.pattern && !rules.pattern.test(value)) {
          errors.push(`Invalid pattern for ${key}`);
        } else if (rules.allowedValues && !rules.allowedValues.includes(value)) {
          errors.push(`Invalid value for ${key}: not in allowed values`);
        }
        break;
        
      case 'number':
        if (typeof value !== 'number') {
          errors.push(`Invalid type for ${key}: expected number, got ${typeof value}`);
        } else if (!isSafeNumber(value, rules.min, rules.max)) {
          errors.push(`Invalid number for ${key}: out of safe range`);
        }
        break;
        
      case 'boolean':
        if (typeof value !== 'boolean') {
          errors.push(`Invalid type for ${key}: expected boolean, got ${typeof value}`);
        }
        break;
        
      case 'object':
        if (typeof value !== 'object' || Array.isArray(value)) {
          errors.push(`Invalid type for ${key}: expected object, got ${typeof value}`);
        }
        break;
        
      case 'array':
        if (!Array.isArray(value)) {
          errors.push(`Invalid type for ${key}: expected array, got ${typeof value}`);
        }
        break;
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
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
