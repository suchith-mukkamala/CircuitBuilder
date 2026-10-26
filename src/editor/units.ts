import type { ComponentKind } from '../circuit/types';

/**
 * Human-friendly numerical input, stored internally in SI base units.
 * Examples: 4.7k, 4.7kΩ, 100uF, 2.2µF, 10mH, 5mA, 12V, 1e-3.
 * "M" is mega, "m" is milli, "u"/"µ"/"μ" are micro.
 */
const unitFor: Partial<Record<ComponentKind, string>> = {
  resistor: 'Ω', potentiometer: 'Ω',
  voltage_source: 'V', current_source: 'A',
  capacitor: 'F', inductor: 'H',
};
const factors: Record<string, number> = {
  '': 1, T: 1e12, G: 1e9, M: 1e6, k: 1e3, K: 1e3,
  m: 1e-3, u: 1e-6, µ: 1e-6, μ: 1e-6, n: 1e-9, p: 1e-12,
};
export function parseEngineering(input: string, kind?: ComponentKind): number | null {
  const normalized = input.trim().replace(/\s+/g, '');
  const match = normalized.match(
    /^([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)([TGMkKmuµμnp]?)(Ω|ohms?|V|A|F|H)?$/i,
  );
  if (!match) return null;
  const suffix = match[3];
  const expected = kind && unitFor[kind];
  if (suffix && expected && suffix.toLowerCase() !== expected.toLowerCase() &&
    !(expected === 'Ω' && /^ohms?$/i.test(suffix))) return null;
  const factor = factors[match[2]];
  const result = Number(match[1]) * factor;
  return Number.isFinite(result) ? result : null;
}
export function unitName(kind: ComponentKind): string {
  return unitFor[kind] ?? '';
}
