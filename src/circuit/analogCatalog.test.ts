import { describe,expect,it } from 'vitest';
import { analogCategories, analogParts, searchAnalogParts } from './analogCatalog';
import { isCircuitDocument } from './types';
import { starterCircuit, rcCircuit, rlCircuit } from './sample';

describe('analog parts catalog',()=>{
  it('lists every supported analog device exactly once',()=>{
    const kinds=analogParts.map(p=>p.kind);
    expect(kinds).toHaveLength(8);
    expect(new Set(kinds).size).toBe(8);
    expect(analogCategories).toHaveLength(3);
    for(const part of analogParts){
      expect(searchAnalogParts(part.label)).toContain(part);
      expect(part.symbol).not.toBe('');
    }
  });
  it('supports free-text synonyms and analog categories',()=>{
    expect(searchAnalogParts('coil').map(p=>p.kind)).toEqual(['inductor']);
    expect(searchAnalogParts('voltage source').map(p=>p.kind)).toContain('voltage_source');
    expect(searchAnalogParts(' ground ').map(p=>p.kind)).toContain('ground');
    expect(searchAnalogParts('inductor','reactive').map(p=>p.kind)).toEqual(['inductor']);
    expect(searchAnalogParts('voltage','reactive')).toHaveLength(0);
    expect(searchAnalogParts('')).toHaveLength(8);
  });
  it('keeps all existing analog documents compatible',()=>{
    expect(isCircuitDocument(starterCircuit())).toBe(true);
    expect(isCircuitDocument(rcCircuit())).toBe(true);
    expect(isCircuitDocument(rlCircuit())).toBe(true);
  });
});
