import { describe, expect, it } from 'vitest';
import { type AllowedTypes, type Mechanism, generateMechanism } from '../js/games/mechlock.logic';

/**
 * test/mechlock.logic.test.ts
 *
 * `mechlock.logic.ts` (680 líneas) no tenía ningún test antes de
 * este. La pieza central testeable sin DOM es `generateMechanism`:
 * arma un grafo aleatorio de piezas mecánicas (bolt → cadena
 * principal → latches que bloquean nodos de la cadena → sub-cadenas
 * de desbloqueo → nodos señuelo/decoy) que el resto del juego
 * (dentro de `init()`, no exportado) usa para dibujar el SVG y
 * resolver la lógica de clicks.
 *
 * Como `generateMechanism` depende de `Math.random` en varios puntos
 * (tipo de nodo aleatorio, posiciones, elección lever/wheel) y el
 * propósito del generador es "cualquier mecanismo válido", los tests
 * verifican invariantes estructurales que deben cumplirse para
 * cualquier resultado posible, corriendo el generador muchas veces en
 * vez de fijar una semilla.
 */

const ALL_TYPES: AllowedTypes = { magnets: true, chains: true, weights: true, clutches: true };
const NO_EXTRA_TYPES: AllowedTypes = { magnets: false, chains: false, weights: false, clutches: false };

function generate(partsCount: number, allowedTypes: AllowedTypes = ALL_TYPES, difficulty = 1): Mechanism {
  return generateMechanism({ partsCount, allowedTypes, difficulty });
}

describe('generateMechanism: estructura básica', () => {
  it('el primer nodo siempre es el bolt (cerrojo), con id 0', () => {
    for (let i = 0; i < 15; i++) {
      const { nodes } = generate(10);
      expect(nodes[0].type).toBe('bolt');
      expect(nodes[0].id).toBe(0);
    }
  });

  it('genera exactamente partsCount nodos (o más si el relleno de decoys lo requiere, nunca menos)', () => {
    for (const partsCount of [6, 10, 15, 20]) {
      const { nodes } = generate(partsCount);
      expect(nodes.length).toBeGreaterThanOrEqual(partsCount);
    }
  });

  it('cada nodo tiene un id único y consecutivo (id === índice en el array)', () => {
    const { nodes } = generate(12);
    nodes.forEach((n, i) => expect(n.id).toBe(i));
  });

  it('cada edge conecta ids que existen realmente en nodes', () => {
    const { nodes, edges } = generate(14);
    const validIds = new Set(nodes.map(n => n.id));
    for (const e of edges) {
      expect(validIds.has(e.from)).toBe(true);
      expect(validIds.has(e.to)).toBe(true);
    }
  });

  it('ningún nodo tiene coordenadas x/y fuera de [0,1] (espacio normalizado)', () => {
    for (let i = 0; i < 10; i++) {
      const { nodes } = generate(16);
      for (const n of nodes) {
        expect(n.x).toBeGreaterThanOrEqual(0);
        expect(n.x).toBeLessThanOrEqual(1);
        expect(n.y).toBeGreaterThanOrEqual(0);
        expect(n.y).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('generateMechanism: cadena principal y conectividad', () => {
  it('todo nodo no-bolt y no-decoy es alcanzable desde el bolt siguiendo edges en cualquier dirección', () => {
    for (let i = 0; i < 10; i++) {
      const { nodes, edges } = generate(14);
      const adjacency = new Map<number, number[]>();
      for (const e of edges) {
        if (!adjacency.has(e.from)) adjacency.set(e.from, []);
        if (!adjacency.has(e.to)) adjacency.set(e.to, []);
        adjacency.get(e.from)!.push(e.to);
        adjacency.get(e.to)!.push(e.from);
      }
      const visited = new Set<number>([0]);
      const queue = [0];
      while (queue.length) {
        const cur = queue.shift()!;
        for (const next of adjacency.get(cur) || []) {
          if (!visited.has(next)) { visited.add(next); queue.push(next); }
        }
      }
      const nonDecoyIds = nodes.filter(n => !n.decoy).map(n => n.id);
      for (const id of nonDecoyIds) {
        expect(visited.has(id)).toBe(true);
      }
    }
  });

  it('el nodo final de entrada (wheel/lever) de la cadena principal está conectado con kind "main"', () => {
    const { nodes, edges } = generate(10, NO_EXTRA_TYPES);
    const inputNodes = nodes.filter(n => n.type === 'wheel' || n.type === 'lever');
    expect(inputNodes.length).toBeGreaterThan(0);
    // Al menos un edge "main" debe terminar o partir de un nodo de entrada.
    const hasMainEdgeToInput = edges.some(
      e => e.kind === 'main' && inputNodes.some(n => n.id === e.from || n.id === e.to)
    );
    expect(hasMainEdgeToInput).toBe(true);
  });

  it('sin tipos extra permitidos (allowedTypes todo false), la cadena principal sólo usa gear/wheel/lever/latch/bolt', () => {
    const { nodes } = generate(14, NO_EXTRA_TYPES);
    const forbidden: string[] = ['chain', 'weight', 'magnet', 'clutch'];
    const usedTypes = new Set(nodes.map(n => n.type));
    for (const t of forbidden) {
      expect(usedTypes.has(t as never)).toBe(false);
    }
  });

  it('con todos los tipos permitidos, en mecanismos grandes eventualmente aparece algún tipo extra', () => {
    // No determinista en una sola corrida, así que se repite muchas
    // veces y se falla sólo si en NINGUNA aparece ningún tipo extra
    // (lo cual indicaría que allowedTypes no se está usando).
    const extraTypes = ['chain', 'weight', 'magnet', 'clutch'];
    let foundAny = false;
    for (let i = 0; i < 30 && !foundAny; i++) {
      const { nodes } = generate(20, ALL_TYPES);
      if (nodes.some(n => extraTypes.includes(n.type))) foundAny = true;
    }
    expect(foundAny).toBe(true);
  });
});

describe('generateMechanism: latches y bloqueo', () => {
  it('cada latch tiene `blocks` apuntando a un nodo real de la cadena principal', () => {
    for (let i = 0; i < 10; i++) {
      const { nodes } = generate(14);
      const latches = nodes.filter(n => n.type === 'latch');
      const validIds = new Set(nodes.map(n => n.id));
      for (const latch of latches) {
        expect(latch.blocks).toBeDefined();
        expect(validIds.has(latch.blocks!)).toBe(true);
        // Un latch nunca se bloquea a sí mismo.
        expect(latch.blocks).not.toBe(latch.id);
      }
    }
  });

  it('cada latch nace con state.locked = true', () => {
    const { nodes } = generate(14);
    const latches = nodes.filter(n => n.type === 'latch');
    for (const latch of latches) {
      expect(latch.state.locked).toBe(true);
    }
  });

  it('cada latch tiene al menos un edge de tipo "block" que lo conecta con el nodo que bloquea', () => {
    const { nodes, edges } = generate(14);
    const latches = nodes.filter(n => n.type === 'latch');
    for (const latch of latches) {
      const hasBlockEdge = edges.some(
        e => e.kind === 'block' && e.from === latch.id && e.to === latch.blocks
      );
      expect(hasBlockEdge).toBe(true);
    }
  });

  it('con partsCount muy chico igual genera al menos 1 latch (mínimo garantizado por el clamp)', () => {
    const { nodes } = generate(6);
    const latches = nodes.filter(n => n.type === 'latch');
    expect(latches.length).toBeGreaterThanOrEqual(1);
  });

  it('con difficulty alta (>=2) y partsCount grande, puede haber más latches que con difficulty baja', () => {
    // No es estrictamente monótono en una sola corrida (hay
    // aleatoriedad en otras partes), así que se compara el promedio
    // sobre varias corridas en vez de una comparación puntual.
    const easyCounts: number[] = [];
    const hardCounts: number[] = [];
    for (let i = 0; i < 20; i++) {
      easyCounts.push(generate(24, ALL_TYPES, 0).nodes.filter(n => n.type === 'latch').length);
      hardCounts.push(generate(24, ALL_TYPES, 3).nodes.filter(n => n.type === 'latch').length);
    }
    const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    expect(avg(hardCounts)).toBeGreaterThanOrEqual(avg(easyCounts));
  });
});

describe('generateMechanism: nodos señuelo (decoy)', () => {
  it('todo nodo marcado decoy:true tiene un edge de tipo "decoy" hacia un nodo cercano no-decoy', () => {
    const { nodes, edges } = generate(30); // partsCount grande fuerza que sobren slots para decoys
    const decoys = nodes.filter(n => n.decoy);
    for (const decoy of decoys) {
      const decoyEdge = edges.find(e => e.kind === 'decoy' && e.from === decoy.id);
      expect(decoyEdge).toBeDefined();
      const target = nodes.find(n => n.id === decoyEdge!.to);
      expect(target).toBeDefined();
      expect(target!.decoy).toBeFalsy();
      expect(target!.type).not.toBe('bolt');
    }
  });

  it('ningún nodo de la cadena principal ni de los latches está marcado como decoy', () => {
    const { nodes } = generate(20);
    const nonDecoyTypes: string[] = ['bolt', 'latch'];
    for (const n of nodes) {
      if (nonDecoyTypes.includes(n.type)) {
        expect(n.decoy).toBeFalsy();
      }
    }
  });
});

describe('generateMechanism: revelado según dificultad', () => {
  it('con difficulty=0, TODOS los edges quedan revealed=true', () => {
    for (let i = 0; i < 5; i++) {
      const { edges } = generate(14, ALL_TYPES, 0);
      expect(edges.every(e => e.revealed === true)).toBe(true);
    }
  });

  it('con difficulty>=1, los edges nacen sin revelar (revealed=false)', () => {
    for (let i = 0; i < 5; i++) {
      const { edges } = generate(14, ALL_TYPES, 2);
      expect(edges.every(e => e.revealed === false)).toBe(true);
    }
  });
});

describe('generateMechanism: estado inicial por tipo de nodo', () => {
  it('los nodos tipo clutch nacen con state.engaged = true', () => {
    // Fuerza que aparezcan clutches permitiéndolos y usando un
    // mecanismo grande para maximizar la chance de que se generen.
    let found = false;
    for (let i = 0; i < 20 && !found; i++) {
      const { nodes } = generate(20, { magnets: false, chains: false, weights: false, clutches: true });
      const clutches = nodes.filter(n => n.type === 'clutch');
      if (clutches.length > 0) {
        found = true;
        for (const c of clutches) expect(c.state.engaged).toBe(true);
      }
    }
    expect(found).toBe(true);
  });

  it('los nodos tipo gear/chain/weight/magnet (no clutch, no bolt/latch/wheel/lever) nacen con engaged: null', () => {
    const { nodes } = generate(20);
    const midTypes = ['gear', 'chain', 'weight', 'magnet'];
    for (const n of nodes) {
      if (midTypes.includes(n.type)) {
        expect(n.state.engaged).toBeNull();
      }
    }
  });

  it('el bolt nace con power:0 y retract:0', () => {
    const { nodes } = generate(10);
    expect(nodes[0].state).toEqual({ power: 0, retract: 0 });
  });
});

describe('generateMechanism: no lanza excepciones en casos límite', () => {
  it('no lanza con partsCount mínimo razonable', () => {
    expect(() => generate(5)).not.toThrow();
  });

  it('no lanza con partsCount grande', () => {
    expect(() => generate(40)).not.toThrow();
  });

  it('no lanza con todos los allowedTypes en false', () => {
    expect(() => generate(15, NO_EXTRA_TYPES)).not.toThrow();
  });

  it('no lanza con difficulty fuera del rango típico (valores extremos)', () => {
    expect(() => generate(15, ALL_TYPES, -1)).not.toThrow();
    expect(() => generate(15, ALL_TYPES, 10)).not.toThrow();
  });
});
