import { describe, expect, it } from 'vitest';
import { parseEngineering, unitName } from './units';

describe('engineering input parsing', () => {
  it('parses SI prefixes and typed units', () => {
    expect(parseEngineering('4.7kΩ', 'resistor')).toBe(4700);
    expect(parseEngineering('100uF', 'capacitor')).toBeCloseTo(0.0001, 12);
    expect(parseEngineering('2.2µF', 'capacitor')).toBeCloseTo(2.2e-6, 13);
    expect(parseEngineering('10mH', 'inductor')).toBeCloseTo(0.01, 12);
    expect(parseEngineering('5mA', 'current_source')).toBeCloseTo(0.005, 12);
    expect(parseEngineering('-12V', 'voltage_source')).toBe(-12);
    expect(parseEngineering('1e-3', 'resistor')).toBe(.001);
    expect(parseEngineering('4.7M', 'resistor')).toBe(4.7e6);
    expect(parseEngineering('4.7m', 'resistor')).toBeCloseTo(.0047);
    expect(unitName('capacitor')).toBe('F');
  });
  it('rejects malformed and mismatched units', () => {
    expect(parseEngineering('1kF', 'resistor')).toBeNull();
    expect(parseEngineering('3.3xyz', 'capacitor')).toBeNull();
    expect(parseEngineering('1e999', 'voltage_source')).toBeNull();
    expect(parseEngineering('', 'resistor')).toBeNull();
    expect(parseEngineering('0.5x', 'resistor')).toBeNull();
  });
});
