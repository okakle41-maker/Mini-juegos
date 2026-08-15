/**
 * js/types/cssVars.ts
 *
 * `CSSProperties` de Preact/React no tipa custom properties (`--foo`) —
 * es una limitación conocida del tipo estándar de DOM, no específica de
 * este proyecto. El patrón usual para asignar una custom property vía
 * `style={{ '--accent': valor }}` era silenciarlo con `as any`
 * (ver GameCard.tsx y ModuleOfDay.tsx), lo que además apaga el chequeo
 * de tipos del resto de las propiedades declaradas en ese `style`.
 *
 * `CSSPropertiesWithVars` reabre `CSSProperties` solo para claves que
 * empiezan con `--`, dejando el resto de las propiedades tan
 * chequeadas como siempre.
 */

import type { JSX } from 'preact';

export type CSSPropertiesWithVars = JSX.CSSProperties & {
  [customProperty: `--${string}`]: string | number;
};
