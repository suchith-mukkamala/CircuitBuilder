import {
  DigitalDocument, DigitalComponent, DigitalKind, GateKind,
  LogicBit, LogicValue, LogicResult, DigitalRuntime,
  emptyDigitalRuntime, defaultRomWords, outputsOf,
} from './types';
import { compileSignals } from './compile';

/**
 * Four-state Boolean logic: floating (Z) is unknown when used as an input.
 * Known controlling values still win: 0 AND X = 0, 1 OR X = 1.
 */
const normalized = (v: LogicValue | undefined): LogicValue =>
  v === 0 || v === 1 ? v : 'X';
const not = (a: LogicValue): LogicValue =>
  a === 0 ? 1 : a === 1 ? 0 : 'X';
const allAnd = (vs: LogicValue[]): LogicValue =>
  vs.includes(0) ? 0 : vs.every(v=>v===1) ? 1 : 'X';
const allOr = (vs: LogicValue[]): LogicValue =>
  vs.includes(1) ? 1 : vs.every(v=>v===0) ? 0 : 'X';
const allXor = (vs: LogicValue[]): LogicValue =>
  vs.every(v=>v===0||v===1) ? (vs.filter(v=>v===1).length%2) as LogicBit : 'X';
const majority = (vs: LogicValue[]): LogicValue => {
  if (vs.filter(v=>v===1).length>=2) return 1;
  if (vs.filter(v=>v===0).length>=2) return 0;
  return 'X';
};
/** Backward-compatible gate evaluator used by existing lessons and tests. */
export function evaluateGate(kind: GateKind, a: LogicValue, b: LogicValue = 'Z'): LogicValue {
  const x = normalized(a),y = normalized(b);
  switch(kind) {
    case 'buffer': return x;
    case 'not': return not(x);
    case 'and': return allAnd([x,y]);
    case 'nand': return not(allAnd([x,y]));
    case 'or': return allOr([x,y]);
    case 'nor': return not(allOr([x,y]));
    case 'xor': return allXor([x,y]);
    case 'xnor': return not(allXor([x,y]));
    default: return 'X';
  }
}
export const isBinary = (value: LogicValue): value is LogicBit => value === 0 || value === 1;

/** Evaluate each output pin of an arbitrary combinational component. */
export function evaluateComponent(
  kind: DigitalKind, raw: Record<string,LogicValue>,
): Record<string,LogicValue> {
  const read = (pin:string) => normalized(raw[pin]);
  const a=read('a'),b=read('b'),c=read('c');
  switch(kind) {
    case 'input': return {out:raw.out===1?1:0};
    case 'high': return {out:1};
    case 'low': return {out:0};
    case 'led':
    case 'block':
    case 'splitter4':
    case 'splitter8':
    case 'splitter16': return {};
    case 'not':
    case 'buffer':
    case 'and': case 'or': case 'xor':
    case 'nand': case 'nor': case 'xnor':
      return {out:evaluateGate(kind,a,b)};
    case 'and3': return {out:allAnd([a,b,c])};
    case 'or3': return {out:allOr([a,b,c])};
    case 'xor3': return {out:allXor([a,b,c])};
    case 'majority': return {out:majority([a,b,c])};
    case 'mux2': {
      const sel=read('sel');
      return {out:sel===0?a:sel===1?b:(a===b&&isBinary(a)?a:'X')};
    }
    case 'demux2': {
      const input=read('in'),sel=read('sel');
      if(sel===0)return {out0:input,out1:0};
      if(sel===1)return {out0:0,out1:input};
      // Unknown selector and definitely LOW data: both outputs are LOW.
      return {out0:input===0?0:'X',out1:input===0?0:'X'};
    }
    case 'halfadder':
      return {sum:allXor([a,b]),carry:allAnd([a,b])};
    case 'fulladder':
      return {sum:allXor([a,b,read('cin')]),carry:majority([a,b,read('cin')])};
    case 'alu4': return calculateAlu4(raw);
    case 'rom16x4': return nibbleOutput(0);
    case 'clock':return {out:0};
    case 'dff':case 'tff':return {q:0};
    case 'register4':case 'counter4':case 'ram16x4':return nibbleOutput(0);
  }
}


/** Every bus bit is a separate named 1-bit terminal; suffix 0 is LSB. */
export const nibbleOutput = (word:number):Record<string,LogicValue> =>
  Object.fromEntries([0,1,2,3].map(i=>['q'+i,((word>>i)&1) as LogicBit]));
export function readNibble(values:Record<string,LogicValue>,prefix:string):number|null {
  let word=0;
  for(let i=0;i<4;i++) {
    const bit=values[prefix+i];
    if(bit!==0&&bit!==1)return null;
    word |= bit<<i;
  }
  return word;
}
export function calculateAlu4(raw:Record<string,LogicValue>):Record<string,LogicValue> {
  const unknown=Object.fromEntries([
    ...[0,1,2,3].map(i=>['y'+i,'X' as LogicValue]),
    ['carry','X' as LogicValue],['zero','X' as LogicValue],
  ]);
  const op0=normalized(raw.op0),op1=normalized(raw.op1);
  if(!isBinary(op0)||!isBinary(op1))return unknown;
  const a=readNibble(raw,'a'),b=readNibble(raw,'b');
  if(a===null||b===null)return unknown;
  const operation=op0|(op1<<1);
  const total=operation===0?a+b:operation===1?a&b:operation===2?a|b:a^b;
  const result=total&15;
  return Object.fromEntries([
    ...[0,1,2,3].map(i=>['y'+i,((result>>i)&1) as LogicValue]),
    ['carry',(operation===0&&total>15?1:0) as LogicValue],
    ['zero',(result===0?1:0) as LogicValue],
  ]);
}
function stateOutputs(
  kind:DigitalKind,id:string,raw:Record<string,LogicValue>,
  component:DigitalComponent,runtime:DigitalRuntime,clockHigh:boolean,
):Record<string,LogicValue> {
  if(kind==='clock')return {out:clockHigh?1:0};
  if(kind==='dff'||kind==='tff')return {q:runtime.registers[id]?.q??0};
  if(kind==='register4'||kind==='counter4')return Object.fromEntries(
    [0,1,2,3].map(i=>['q'+i,runtime.registers[id]?.['q'+i]??0]));
  if(kind==='rom16x4'||kind==='ram16x4') {
    const address=readNibble(raw,'a');
    if(address===null)return Object.fromEntries(
      [0,1,2,3].map(i=>['q'+i,'X' as LogicValue]));
    const words=kind==='rom16x4'?component.words??defaultRomWords():
      runtime.memories[id]??Array(16).fill(0);
    return nibbleOutput(words[address]??0);
  }
  return evaluateComponent(kind,raw);
}

/**
 * Pure four-state combinational solver over a flattened hierarchy of modules.
 * Independent module instances get independent gate state, including multiple
 * named outputs on adders and demultiplexers.
 */
export function simulateLogic(
  doc:DigitalDocument, runtime:DigitalRuntime=emptyDigitalRuntime(),
  options:{clockHigh?:boolean}={},
):LogicResult {
  const network = compileSignals(doc);
  const primitives = network.primitives;
  const gates = primitives.filter(p =>
    !['input','high','low','clock','led'].includes(p.component.kind));
  const drivers = primitives.filter(p => Object.keys(p.outputs).length>0);
  let computed = new Map<string,Record<string,LogicValue>>(
    gates.map(p=>[p.id,Object.fromEntries(
      Object.keys(p.outputs).map(pin=>[pin,'X' as LogicValue]))]),
  );
  let netValues = new Map<string,LogicValue>();
  const conflicts = new Set<string>();
  const updateNets = (): Map<string,LogicValue> => {
    const incoming = new Map<string,LogicValue[]>();
    for(const root of network.roots)incoming.set(root,[]);
    for(const p of drivers) {
      for(const [pin,net] of Object.entries(p.outputs)) {
        const value = p.component.kind === 'input' ? (p.component.bit??0)
          : p.component.kind === 'high' ? 1
            : p.component.kind === 'low' ? 0
              : p.component.kind === 'clock' ? (options.clockHigh?1:0)
                : computed.get(p.id)?.[pin] ?? 'X';
        incoming.get(net)?.push(value);
      }
    }
    const next = new Map<string,LogicValue>();
    for(const root of network.roots) {
      const sources=incoming.get(root)??[];
      if(sources.length>1) {next.set(root,'X');conflicts.add(root);}
      else next.set(root,sources.length?sources[0]:'Z');
    }
    return next;
  };
  let stabilized=false;
  for(let iteration=0;iteration<Math.max(6,gates.length+3);iteration++) {
    const nextNets=updateNets();
    const nextGates=new Map<string,Record<string,LogicValue>>();
    for(const p of gates) {
      const inputs=Object.fromEntries(Object.entries(p.inputs)
        .map(([pin,net])=>[pin,nextNets.get(net)??'Z']));
      nextGates.set(p.id,stateOutputs(p.component.kind,p.id,inputs,
        p.component,runtime,!!options.clockHigh));
    }
    stabilized=[...nextGates].every(([id,outputs])=>
      Object.entries(outputs).every(([pin,value])=>computed.get(id)?.[pin]===value));
    netValues=nextNets; computed=nextGates;
    if(stabilized)break;
  }
  netValues=updateNets();
  if(!stabilized) {
    for(const p of gates) {
      computed.set(p.id,Object.fromEntries(
        Object.keys(p.outputs).map(pin=>[pin,'X'])));
    }
    netValues=updateNets();
  }
  const terminalValues:Record<string,LogicValue>={};
  const wireValues:Record<string,LogicValue>={};
  for(const [pin,root] of Object.entries(network.terminals)) {
    terminalValues[pin]=netValues.get(root)??'Z';
  }
  for(const [wire,root] of Object.entries(network.wires)) {
    wireValues[wire]=netValues.get(root)??'Z';
  }
  const ledValues:Record<string,LogicValue>={},gateValues:Record<string,LogicValue>={};
  for(const c of doc.components) {
    if(c.kind==='led')ledValues[c.id]=terminalValues[c.id+':in']??'Z';
    else if(c.kind!=='input') {
      const first=outputsOf(c)[0];
      gateValues[c.id]=first?terminalValues[c.id+':'+first]??'Z':'Z';
    }
  }
  const warnings:string[]=[];
  for(const p of primitives) {
    for(const [pin,root] of Object.entries(p.inputs)) {
      if(netValues.get(root)==='Z')warnings.push(p.label+'.'+pin.toUpperCase()+' has no driver.');
    }
  }
  for(const c of doc.components.filter(c=>c.kind==='block')) {
    for(const pin of c.ports?.inputs??[]) {
      if(terminalValues[c.id+':'+pin]==='Z')
        warnings.push((c.name??'BLOCK')+'.'+pin+' has no driver.');
    }
  }
  if(conflicts.size)warnings.push(conflicts.size+' net(s) have multiple active outputs connected together.');
  if(!stabilized)warnings.push('Combinational feedback did not settle; check for loops without storage.');
  return {
    terminalValues,wireValues,netValues:Object.fromEntries(netValues),
    terminalNets:network.terminals,wireNets:network.wires,
    ledValues,gateValues,netCount:network.roots.length,warnings,
  };
}

export type TruthTable = {
  inputs: DigitalComponent[];
  outputs: DigitalComponent[];
  rows: { inputs: LogicBit[]; outputs: LogicValue[] }[];
};
export function generateTruthTable(doc: DigitalDocument): TruthTable {
  const sequential=['clock','dff','tff','register4','counter4','ram16x4'];
  if(doc.components.some(c=>sequential.includes(c.kind))||doc.blocks?.some(def=>
    def.circuit.components.some(c=>sequential.includes(c.kind))))
    throw new Error('Truth tables are for combinational designs. Use CLOCK STEP and WAVEFORM for stateful circuits.');
  const inputs = doc.components.filter(c => c.kind === 'input');
  const outputs = doc.components.filter(c => c.kind === 'led');
  if (!inputs.length) throw new Error('Add at least one INPUT switch to generate a truth table.');
  if (!outputs.length) throw new Error('Add an LED output to generate a truth table.');
  if (inputs.length > 6) throw new Error('Truth tables are limited to 6 input switches (64 combinations).');
  const rows: TruthTable['rows'] = [];
  for (let mask = 0; mask < 1 << inputs.length; mask++) {
    const bits: LogicBit[] = inputs.map((_, i) =>
      ((mask >> (inputs.length - i - 1)) & 1) as LogicBit);
    const byId = new Map(inputs.map((c, i) => [c.id, bits[i]]));
    const modified: DigitalDocument = {
      ...doc, components: doc.components.map(c =>
        c.kind === 'input' ? { ...c, bit: byId.get(c.id) } : c),
    };
    const result = simulateLogic(modified);
    rows.push({ inputs: bits, outputs: outputs.map(c => result.ledValues[c.id]) });
  }
  return { inputs, outputs, rows };
}
