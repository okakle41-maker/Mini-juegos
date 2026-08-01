/**
 * Normaliza un tag de categoría (ej. "PERCEPCIÓN") a un slug CSS-safe
 * ("percepcion") para data-category y selectores de identidad visual.
 */
export function categorySlug(tag: string): string {
  return tag
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
