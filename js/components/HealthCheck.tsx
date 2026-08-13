/**
 * js/components/HealthCheck.tsx
 *
 * Componente de validación de la Fase 1 (infraestructura de Preact).
 * No forma parte del producto — su único propósito es confirmar que
 * la cadena completa funciona: tsconfig (jsx/jsxImportSource) + Vite
 * (@preact/preset-vite) + Preact en sí, montando un nodo real en el
 * DOM y reaccionando a un cambio de estado (useState). Si esto
 * renderiza y el contador incrementa al hacer click, la infraestructura
 * está lista para migrar componentes reales (Fase 2 en adelante).
 *
 * Se borra una vez confirmada la Fase 1, o se puede dejar montado
 * temporalmente en una vista de desarrollo/debug si resulta útil.
 */
import { useState } from 'preact/hooks';

export function HealthCheck() {
  const [count, setCount] = useState(0);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '16px',
        right: '16px',
        zIndex: 9999,
        padding: '12px',
        background: 'rgba(15, 23, 42, 0.95)',
        border: '1px dashed var(--accent-orange, orange)',
        borderRadius: '8px',
        color: '#fff',
        fontFamily: 'monospace',
        fontSize: '13px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
      }}
    >
      <p>✅ Preact está montado y funcionando.</p>
      <button type="button" onClick={() => setCount((c) => c + 1)}>
        Clicks: {count}
      </button>
    </div>
  );
}
