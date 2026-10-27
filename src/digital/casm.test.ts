import {describe,it,expect} from 'vitest';
import {assembleCasm,decodeCasm,disassembleCasm,DEFAULT_CASM_SOURCE,
  CASM_INSTRUCTIONS} from './casm';

describe('CASM assembler and ISA encoding',()=>{
  it('has unique four-bit opcodes and a fixed one-byte format',()=>{
    expect(CASM_INSTRUCTIONS).toHaveLength(15);
    expect(new Set(CASM_INSTRUCTIONS.map(i=>i.opcode)).size).toBe(15);
    const r=assembleCasm(DEFAULT_CASM_SOURCE);
    expect(r.ok).toBe(true);
    expect(r.bytes).toHaveLength(16);
    expect(r.bytes.slice(0,4)).toEqual([0x13,0x25,0xC0,0xD0]);
    expect(r.labels.START).toBe(0);
    expect(decodeCasm(0x25)).toMatchObject({opcode:2,operand:5});
    expect(decodeCasm(0xF0).instruction).toBeUndefined();
    expect(disassembleCasm(r.bytes)[0].source).toBe('LDI 3');
  });
  it('supports forward/backward labels and numeric bases',()=>{
    const r=assembleCasm('JMP END\nLOOP: INC\nEND: JNZ LOOP\nHLT');
    expect(r.ok).toBe(true);
    expect(r.labels).toEqual({LOOP:1,END:2});
    expect(r.bytes.slice(0,4)).toEqual([0x92,0xE0,0xB1,0xD0]);
    const n=assembleCasm('start: ldi 0xA ; hi\nadd 0b0011\nout\nhlt');
    expect(n.ok).toBe(true);
    expect(n.bytes.slice(0,4)).toEqual([0x1A,0x23,0xC0,0xD0]);
    expect(n.labels.START).toBe(0);
  });
  it('rejects invalid syntax with line-specific messages',()=>{
    for(const [source,phrase] of [
      ['LDI','requires'],['OUT 2','does not accept'],
      ['LDI 16','outside'],['JMP MISSING','Unknown operand'],
      ['BORK 5','Unknown instruction'],['ADD 3 4','at most one operand'],
      ['FOO:\nFOO: NOP','Duplicate label'],
    ] as const){
      const r=assembleCasm(source);
      expect(r.ok).toBe(false);
      expect(r.issues.some(i=>i.message.includes(phrase))).toBe(true);
      expect(r.issues[0].line).toBeGreaterThan(0);
    }
  });
  it('enforces ROM capacity and source length',()=>{
    const long=assembleCasm(Array(17).fill('NOP').join('\n'));
    expect(long.ok).toBe(false);
    expect(long.issues[0].message).toMatch(/16 ROM/);
    const huge=assembleCasm('X'.repeat(8193));
    expect(huge.ok).toBe(false);
    expect(huge.issues[0].message).toMatch(/8192/);
    expect(assembleCasm('; comments only').bytes).toHaveLength(16);
  });
});
