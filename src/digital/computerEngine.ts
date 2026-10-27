import {
  type DigitalDocument, type DigitalRuntime, type LogicValue,
  type DigitalKind, emptyDigitalRuntime,
} from './types';
import { compileSignals, type Primitive } from './compile';
import { simulateLogic, readNibble, isBinary } from './engine';

/**
 * Clock edges are atomic and evaluated against OLD register values.
 * This allows counters, feedback paths, register chains and block instances
 * without introducing order-dependent gate execution.
 *
 * Explicit CLOCK STEP creates one 0→1→0 pulse on all CLOCK generators.
 * Manual clock-switch edges are handled by transitionInputs.
 * Cycle/event numbers are discrete: this is not a timing-delay simulator.
 */
const asInput = (netValues:Record<string,LogicValue>,p:Primitive,pin:string):LogicValue =>
  netValues[p.inputs[pin]]??'Z';
const getRegister = (runtime:DigitalRuntime,p:Primitive,pin:string):LogicValue =>
  runtime.registers[p.id]?.[pin]??0;
const flip = (bit:LogicValue):LogicValue =>
  bit===0?1:bit===1?0:'X';
const copyState = (runtime:DigitalRuntime):DigitalRuntime => ({
  cycle:runtime.cycle,
  registers:{...runtime.registers},
  memories:{...runtime.memories},
});
const sequential = (kind:DigitalKind):boolean =>
  ['dff','tff','register4','counter4','ram16x4'].includes(kind);

function captureEdges(
  doc:DigitalDocument,runtime:DigitalRuntime, oldSnapshot:ReturnType<typeof simulateLogic>,
  newSnapshot:ReturnType<typeof simulateLogic>,
):DigitalRuntime {
  const compiled=compileSignals(doc);
  const next=copyState(runtime);
  for(const p of compiled.primitives) {
    if(!sequential(p.component.kind))continue;
    const was=asInput(oldSnapshot.netValues,p,'clk');
    const now=asInput(newSnapshot.netValues,p,'clk');
    if(was!==0||now!==1)continue; // strict rising edge, no trigger on X/Z→1
    const read=(pin:string)=>asInput(newSnapshot.netValues,p,pin);
    const previous=runtime.registers[p.id]??{};
    const store=(bits:Record<string,LogicValue>)=>{next.registers[p.id]=bits;};
    if(p.component.kind==='dff') {
      const data=read('d');
      store({q:isBinary(data)?data:'X'});
    } else if(p.component.kind==='tff') {
      const t=read('t');
      store({q:t===0?getRegister(runtime,p,'q'):
        t===1?flip(getRegister(runtime,p,'q')):'X'});
    } else if(p.component.kind==='register4') {
      const en=read('en');
      store(Object.fromEntries([0,1,2,3].map(i=>{
        const key='q'+i,d=read('d'+i),q=getRegister(runtime,p,key);
        return [key,en===0?q:en===1?(isBinary(d)?d:'X'):
          (d===q?q:'X')];
      })));
    } else if(p.component.kind==='counter4') {
      const reset=read('reset'),en=read('en');
      const old=Object.fromEntries([0,1,2,3]
        .map(i=>['q'+i,getRegister(runtime,p,'q'+i)]));
      const word=readNibble(old,'q');
      const value=reset===1?0:reset===0&&en===0?word:
        reset===0&&en===1&&word!==null?(word+1)&15:null;
      store(Object.fromEntries([0,1,2,3].map(i=>['q'+i,
        value===null?'X':((value>>i)&1) as LogicValue])));
    } else if(p.component.kind==='ram16x4'&&read('we')===1) {
      const address=readNibble(Object.fromEntries([0,1,2,3]
        .map(i=>['a'+i,read('a'+i)])),'a');
      const data=readNibble(Object.fromEntries([0,1,2,3]
        .map(i=>['d'+i,read('d'+i)])),'d');
      if(address!==null&&data!==null) {
        const words=[...(runtime.memories[p.id]??Array(16).fill(0))];
        words[address]=data;
        next.memories[p.id]=words;
      }
    }
  }
  return next;
}
export function stepCircuit(
  doc:DigitalDocument,runtime:DigitalRuntime=emptyDigitalRuntime(),
):DigitalRuntime {
  // The 'old' snapshot is at clock LOW; every physical clock source pulses.
  const oldSnapshot=simulateLogic(doc,runtime,{clockHigh:false});
  const highSnapshot=simulateLogic(doc,runtime,{clockHigh:true});
  const next=captureEdges(doc,runtime,oldSnapshot,highSnapshot);
  next.cycle=runtime.cycle+1;
  return next;
}
export function transitionInputs(
  oldDoc:DigitalDocument,newDoc:DigitalDocument,
  runtime:DigitalRuntime=emptyDigitalRuntime(),
):DigitalRuntime {
  const oldSnapshot=simulateLogic(oldDoc,runtime,{clockHigh:false});
  const nextSnapshot=simulateLogic(newDoc,runtime,{clockHigh:false});
  return captureEdges(newDoc,runtime,oldSnapshot,nextSnapshot);
}
export function resetComputer():DigitalRuntime{return emptyDigitalRuntime();}
