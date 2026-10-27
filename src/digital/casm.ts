/**
 * CASM v1 — CircuitBuilder's deliberately tiny 4-bit ISA.
 *
 * Each instruction is exactly one byte: high nibble opcode and low nibble
 * operand. Program ROM is 16 x 8 bits. RAM is 16 x 4 bits per CPU instance.
 * This module contains ONLY parsing/encoding metadata, never CPU execution.
 */
export type Mnemonic =
  'NOP'|'LDI'|'ADD'|'SUB'|'AND'|'OR'|'XOR'|'LOAD'|'STORE'|
  'JMP'|'JZ'|'JNZ'|'OUT'|'HLT'|'INC';

export type Instruction = {
  name:Mnemonic;
  opcode:number;
  operand:boolean;
  description:string;
};
export const CASM_INSTRUCTIONS:ReadonlyArray<Instruction>=[
  {name:'NOP',opcode:0x0,operand:false,description:'No operation'},
  {name:'LDI',opcode:0x1,operand:true,description:'ACC ← immediate'},
  {name:'ADD',opcode:0x2,operand:true,description:'ACC ← ACC + immediate'},
  {name:'SUB',opcode:0x3,operand:true,description:'ACC ← ACC − immediate'},
  {name:'AND',opcode:0x4,operand:true,description:'ACC ← ACC AND immediate'},
  {name:'OR',opcode:0x5,operand:true,description:'ACC ← ACC OR immediate'},
  {name:'XOR',opcode:0x6,operand:true,description:'ACC ← ACC XOR immediate'},
  {name:'LOAD',opcode:0x7,operand:true,description:'ACC ← RAM[address]'},
  {name:'STORE',opcode:0x8,operand:true,description:'RAM[address] ← ACC'},
  {name:'JMP',opcode:0x9,operand:true,description:'PC ← address'},
  {name:'JZ',opcode:0xA,operand:true,description:'Jump if ZERO flag'},
  {name:'JNZ',opcode:0xB,operand:true,description:'Jump if not ZERO'},
  {name:'OUT',opcode:0xC,operand:false,description:'Output ← ACC'},
  {name:'HLT',opcode:0xD,operand:false,description:'Halt execution'},
  {name:'INC',opcode:0xE,operand:false,description:'ACC ← ACC + 1'},
];
export const mnemonicByName = Object.fromEntries(
  CASM_INSTRUCTIONS.map(i=>[i.name,i]),
) as Record<Mnemonic,Instruction>;
export const opcodeByNumber = new Map(CASM_INSTRUCTIONS.map(i=>[i.opcode,i]));
export const EMPTY_PROGRAM=()=>Array(16).fill(0) as number[];
export const DEFAULT_CASM_SOURCE = [
  '; CASM / first program',
  '; 3 + 5 = 8',
  'START:',
  '    LDI 3',
  '    ADD 5',
  '    OUT',
  '    HLT',
].join('\n');

export const CASM_EXAMPLES = [
  {id:'first',name:'3 + 5 · FIRST PROGRAM',source:DEFAULT_CASM_SOURCE},
  {id:'count',name:'COUNTDOWN LOOP',source:[
    '; Loop until accumulator reaches zero',
    'LDI 4',
    'LOOP: SUB 1',
    'JNZ LOOP',
    'OUT',
    'HLT',
  ].join('\n')},
  {id:'memory',name:'RAM SAVE & LOAD',source:[
    '; Write 7 to RAM[2], then read it back',
    'LDI 7',
    'STORE 2',
    'LDI 0',
    'LOAD 2',
    'OUT',
    'HLT',
  ].join('\n')},
] as const;

export type AsmIssue={line:number;column:number;message:string};
export type AsmListing={
  address:number;
  byte:number;
  line:number;
  source:string;
  mnemonic:Mnemonic;
  operand:number;
};
export type AsmResult={
  ok:boolean;
  bytes:number[];
  listing:AsmListing[];
  labels:Record<string,number>;
  issues:AsmIssue[];
};

export function decodeCasm(byte:number):{
  opcode:number;operand:number;instruction:Instruction|undefined;
}{
  if(!Number.isInteger(byte)||byte<0||byte>255)
    return {opcode:-1,operand:0,instruction:undefined};
  const opcode=byte>>>4,operand=byte&15;
  return {opcode,operand,instruction:opcodeByNumber.get(opcode)};
}
const parseInteger=(token:string):number|null=>{
  if(/^0x[0-9a-f]+$/i.test(token))return parseInt(token.slice(2),16);
  if(/^0b[01]+$/i.test(token))return parseInt(token.slice(2),2);
  if(/^[0-9]+$/.test(token))return Number(token);
  return null;
};
const LABEL=/^[A-Z_][A-Z0-9_]*$/;
type ParsedLine={line:number;address:number;raw:string;mnemonic:string;arg?:string};

/** Two-pass assembler with forward/backward labels and line-specific errors. */
export function assembleCasm(source:string):AsmResult {
  const lines=source.replace(/\r\n?/g,'\n').split('\n');
  const labels:Record<string,number>=Object.create(null) as Record<string,number>;
  const parsed:ParsedLine[]=[];
  const issues:AsmIssue[]=[];
  let address=0;
  const error=(line:number,column:number,message:string)=>
    issues.push({line,column,message});
  if(source.length>8192)
    return {ok:false,bytes:EMPTY_PROGRAM(),listing:[],labels:{},
      issues:[{line:1,column:1,message:'Program source exceeds 8192 characters.'}]};
  for(let i=0;i<lines.length;i++){
    const raw=lines[i],code=raw.split(/;|\/\/|#/)[0].trim();
    if(!code)continue;
    let rest=code;
    const labelMatch=/^([A-Za-z_][A-Za-z_0-9]*):/.exec(rest);
    if(labelMatch){
      const label=labelMatch[1].toUpperCase();
      if(!LABEL.test(label))error(i+1,1,'Invalid label name.');
      else if(Object.hasOwn(labels,label))
        error(i+1,1,'Duplicate label '+label+'.');
      else labels[label]=address;
      rest=rest.slice(labelMatch[0].length).trim();
      if(!rest)continue;
    }
    if(rest.includes(':')) {
      error(i+1,raw.indexOf(':')+1,'Unexpected colon or invalid label.');
      continue;
    }
    const parts=rest.split(/[\s,]+/).filter(Boolean);
    const mnemonic=(parts.shift()??'').toUpperCase();
    if(!Object.hasOwn(mnemonicByName,mnemonic)) {
      error(i+1,Math.max(1,raw.toUpperCase().indexOf(mnemonic)+1),
        'Unknown instruction "'+mnemonic+'".');
      continue;
    }
    if(parts.length>1) {
      error(i+1,1,mnemonic+' accepts at most one operand.');
      continue;
    }
    if(address>=16){
      error(i+1,1,'Program exceeds 16 ROM instructions.');
      continue;
    }
    parsed.push({line:i+1,address,raw:raw.trim(),mnemonic,arg:parts[0]});
    address++;
  }
  const bytes=EMPTY_PROGRAM(),listing:AsmListing[]=[];
  for(const row of parsed){
    const instruction=mnemonicByName[row.mnemonic as Mnemonic];
    if(instruction.operand&&!row.arg){
      error(row.line,1,instruction.name+' requires a number or label (0–15).');
      continue;
    }
    if(!instruction.operand&&row.arg!==undefined){
      error(row.line,1,instruction.name+' does not accept an operand.');
      continue;
    }
    let operand=0;
    if(row.arg!==undefined){
      const word=row.arg.toUpperCase();
      const number=parseInteger(row.arg);
      if(number!==null)operand=number;
      else if(Object.hasOwn(labels,word))operand=labels[word];
      else {error(row.line,1,'Unknown operand/label "'+row.arg+'".');continue;}
      if(!Number.isInteger(operand)||operand<0||operand>15){
        error(row.line,1,'Operand '+row.arg+' is outside the 4-bit range 0–15.');
        continue;
      }
    }
    const byte=(instruction.opcode<<4)|operand;
    bytes[row.address]=byte;
    listing.push({address:row.address,byte,line:row.line,source:row.raw,
      mnemonic:instruction.name,operand});
  }
  return {ok:issues.length===0,bytes,listing,labels:{...labels},issues};
}
export function disassembleCasm(bytes:number[]):AsmListing[]{
  return bytes.slice(0,16).map((byte,address)=>{
    const decoded=decodeCasm(byte);
    return {address,byte,line:address+1,source:decoded.instruction?
      decoded.instruction.name+(decoded.instruction.operand?' '+decoded.operand:''):
      'DB 0x'+byte.toString(16).toUpperCase().padStart(2,'0'),
      mnemonic:decoded.instruction?.name??'NOP',operand:decoded.operand};
  });
}
