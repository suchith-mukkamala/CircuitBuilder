import {beforeEach,describe,expect,it} from 'vitest';
import {
  type DigitalDocument,type DigitalComponent,type DigitalRuntime,type LogicValue,
  emptyDigitalRuntime,isDigitalDocument,inputsOf,outputsOf,defaultRomWords,
} from './types';
import { simulateLogic, calculateAlu4, generateTruthTable } from './engine';
import { stepCircuit,transitionInputs,resetComputer } from './computerEngine';
import { cpuCoreDemo,counterDemo,flipFlopDemo } from './computerSamples';
import { useDigitalStore } from './useDigitalStore';
import { captureBlock,placeBlock } from './blocks';

const part = (
  id:string,kind:DigitalComponent['kind'],x:number,y:number,bit?:0|1,
):DigitalComponent=>({id,kind,x,y,rotation:0,...(bit!==undefined?{bit}:{})});
const end=(componentId:string,pin:string)=>({componentId,pin});
const wire=(id:string,a:string,ap:string,b:string,bp:string)=>({
  id,from:end(a,ap),to:end(b,bp),
});
const word=(doc:DigitalDocument,id:string,state:DigitalRuntime)=>{
  const value=simulateLogic(doc,state).terminalValues;
  return [0,1,2,3].reduce((n,i)=>{
    const bit=value[id+':q'+i];
    if(bit!==0&&bit!==1)throw Error('Unexpected unknown bit');
    return n+(bit<<i);
  },0);
};

describe('computer primitives',()=>{
  it('exposes explicit pinouts for clocked storage, RAM, ROM and ALU',()=>{
    const pins=(kind:DigitalComponent['kind'])=>{
      const c=part('x',kind,0,0);
      return {in:inputsOf(c),out:outputsOf(c)};
    };
    expect(pins('clock')).toEqual({in:[],out:['out']});
    expect(pins('dff')).toEqual({in:['d','clk'],out:['q']});
    expect(pins('tff')).toEqual({in:['t','clk'],out:['q']});
    expect(pins('register4').in).toEqual(['d0','d1','d2','d3','clk','en']);
    expect(pins('counter4').out).toEqual(['q0','q1','q2','q3']);
    expect(pins('ram16x4').in).toHaveLength(10);
    expect(pins('rom16x4').out).toHaveLength(4);
    expect(pins('alu4').out).toEqual(['y0','y1','y2','y3','carry','zero']);
  });
  it('counts all 16 four-bit values then wraps, and resets without changing the document',()=>{
    const doc=counterDemo();
    expect(isDigitalDocument(doc)).toBe(true);
    let state=emptyDigitalRuntime();
    const values:number[]=[];
    for(let i=0;i<17;i++) {
      state=stepCircuit(doc,state);
      values.push(word(doc,'pc',state));
    }
    expect(values).toEqual([...Array.from({length:15},(_,i)=>i+1),0,1]);
    expect(state.cycle).toBe(17);
    expect(word(doc,'pc',resetComputer())).toBe(0);
    expect(doc.components.find(c=>c.id==='pc')?.kind).toBe('counter4');
  });
  it('DFF captures D at rising edges and ignores data changes between clock pulses',()=>{
    let doc=flipFlopDemo();
    const initial=emptyDigitalRuntime();
    expect(simulateLogic(doc,initial).ledValues.out).toBe(0);
    const high=stepCircuit(doc,initial);
    expect(simulateLogic(doc,high).ledValues.out).toBe(1);
    const changed:DigitalDocument={...doc,components:doc.components.map(c=>
      c.id==='d'?{...c,bit:0}:c)};
    expect(simulateLogic(changed,high).ledValues.out).toBe(1);
    const next=stepCircuit(changed,high);
    expect(simulateLogic(changed,next).ledValues.out).toBe(0);
    doc=changed;
    expect(doc.components.find(c=>c.id==='d')?.bit).toBe(0);
  });
  it('manual clock switch triggers a strict 0→1 transition, but not a high→high change',()=>{
    const doc:DigitalDocument={version:1,lab:'signal',name:'Manual DFF',
      components:[
        part('clk','input',120,150,0),part('data','input',120,250,1),
        part('ff','dff',380,190),part('led','led',620,200),
      ],
      wires:[
        wire('clock','clk','out','ff','clk'),
        wire('data','data','out','ff','d'),
        wire('result','ff','q','led','in'),
      ]};
    const switched={...doc,components:doc.components.map(c=>
      c.id==='clk'?{...c,bit:1 as const}:c)};
    let runtime=transitionInputs(doc,switched,emptyDigitalRuntime());
    expect(simulateLogic(switched,runtime).ledValues.led).toBe(1);
    const dLow={...switched,components:switched.components.map(c=>
      c.id==='data'?{...c,bit:0 as const}:c)};
    runtime=transitionInputs(switched,dLow,runtime);
    expect(simulateLogic(dLow,runtime).ledValues.led).toBe(1);
    const falling={...dLow,components:dLow.components.map(c=>
      c.id==='clk'?{...c,bit:0 as const}:c)};
    runtime=transitionInputs(dLow,falling,runtime);
    expect(simulateLogic(falling,runtime).ledValues.led).toBe(1);
    const secondRise={...falling,components:falling.components.map(c=>
      c.id==='clk'?{...c,bit:1 as const}:c)};
    runtime=transitionInputs(falling,secondRise,runtime);
    expect(simulateLogic(secondRise,runtime).ledValues.led).toBe(0);
  });
  it('T flip-flop divides input clock: T=1 toggles state on each pulse',()=>{
    const doc:DigitalDocument={version:1,lab:'signal',name:'TFF',
      components:[part('clk','clock',120,180),part('t','high',120,290),
        part('ff','tff',410,190),part('led','led',670,180)],
      wires:[wire('c','clk','out','ff','clk'),wire('t','t','out','ff','t'),
        wire('q','ff','q','led','in')]};
    let state=emptyDigitalRuntime();
    const values=[];
    for(let i=0;i<6;i++){
      state=stepCircuit(doc,state);
      values.push(simulateLogic(doc,state).ledValues.led);
    }
    expect(values).toEqual([1,0,1,0,1,0]);
  });
  it('register chain samples all D inputs before either flip-flop output changes',()=>{
    const doc:DigitalDocument={version:1,lab:'signal',name:'Shift',
      components:[part('clk','clock',90,170),part('d','input',90,320,1),
        part('a','dff',345,190),part('b','dff',590,190),
        part('led','led',820,190)],
      wires:[wire('ca','clk','out','a','clk'),wire('cb','clk','out','b','clk'),
        wire('in','d','out','a','d'),wire('shift','a','q','b','d'),
        wire('out','b','q','led','in')]};
    let state=emptyDigitalRuntime();
    state=stepCircuit(doc,state);
    expect(simulateLogic(doc,state).terminalValues['a:q']).toBe(1);
    expect(simulateLogic(doc,state).ledValues.led).toBe(0);
    state=stepCircuit(doc,state);
    expect(simulateLogic(doc,state).ledValues.led).toBe(1);
  });
  it('four-bit register latches only when enabled, and supports reset of simulation state',()=>{
    const sources=[0,1,2,3].map(i=>part('d'+i,'input',90,120+i*65,
      (6>>i&1) as 0|1));
    const doc:DigitalDocument={version:1,lab:'signal',name:'4-bit Reg',
      components:[...sources,part('en','high',90,450),part('clk','clock',90,550),
        part('reg','register4',440,280)],
      wires:[...sources.map((c,i)=>wire('d'+i,c.id,'out','reg','d'+i)),
        wire('en','en','out','reg','en'),wire('clock','clk','out','reg','clk')]};
    let state=stepCircuit(doc,emptyDigitalRuntime());
    expect(word(doc,'reg',state)).toBe(6);
    const changed={...doc,components:doc.components.map(c=>
      c.id==='d0'?{...c,bit:1 as const}:c)};
    const disabled={...changed,components:changed.components.map(c=>
      c.id==='en'?{...c,kind:'low' as const}:c)};
    state=stepCircuit(disabled,state);
    expect(word(disabled,'reg',state)).toBe(6);
    expect(word(disabled,'reg',emptyDigitalRuntime())).toBe(0);
  });
  it('ROM contents are programmable, stored in valid circuit JSON and addressable',()=>{
    const parts=[0,1,2,3].map(i=>part('a'+i,'input',120,90+i*72,((9>>i)&1) as 0|1));
    const words=defaultRomWords();words[9]=13;
    const rom={...part('rom','rom16x4',420,225),words};
    const doc:DigitalDocument={version:1,lab:'signal',name:'ROM',
      components:[...parts,rom],
      wires:parts.map((c,i)=>wire('a'+i,c.id,'out','rom','a'+i))};
    expect(isDigitalDocument(doc)).toBe(true);
    expect(word(doc,'rom',emptyDigitalRuntime())).toBe(13);
    expect(isDigitalDocument({...doc,components:doc.components.map(c=>
      c.id==='rom'?{...c,words:[16]}:c)})).toBe(false);
    expect(isDigitalDocument({...doc,components:doc.components.map(c=>
      c.id==='rom'?{...c,words:Array(16).fill(15.5)}:c)})).toBe(false);
  });
  it('RAM writes on rising edge when WE=1 and reads the selected address asynchronously',()=>{
    const controls=[0,1,2,3].map(i=>part('a'+i,'input',90,100+i*65,
      ((5>>i)&1) as 0|1));
    const data=[0,1,2,3].map(i=>part('d'+i,'input',90,430+i*65,
      ((11>>i)&1) as 0|1));
    const doc:DigitalDocument={version:1,lab:'signal',name:'RAM',
      components:[...controls,...data,part('we','high',90,740),
        part('clk','clock',90,810),part('ram','ram16x4',490,425)],
      wires:[...controls.map((c,i)=>wire('a'+i,c.id,'out','ram','a'+i)),
        ...data.map((c,i)=>wire('d'+i,c.id,'out','ram','d'+i)),
        wire('we','we','out','ram','we'),wire('clk','clk','out','ram','clk')]};
    const blank=emptyDigitalRuntime();
    expect(word(doc,'ram',blank)).toBe(0);
    const stored=stepCircuit(doc,blank);
    expect(word(doc,'ram',stored)).toBe(11);
    expect(stored.memories['top/ram'][5]).toBe(11);
    const nextData={...doc,components:doc.components.map(c=>
      c.id==='d0'?{...c,bit:0 as const}:c)};
    const disabled={...nextData,components:nextData.components.map(c=>
      c.id==='we'?{...c,kind:'low' as const}:c)};
    const held=stepCircuit(disabled,stored);
    expect(word(disabled,'ram',held)).toBe(11);
    expect(word(doc,'ram',resetComputer())).toBe(0);
  });
});

describe('CPU datapath, arithmetic and module hierarchy',()=>{
  it('ALU operations support 4-bit add, bitwise AND/OR/XOR and two flags',()=>{
    const values=Object.fromEntries([
      ...[0,1,2,3].map(i=>['a'+i,((9>>i)&1) as 0|1]),
      ...[0,1,2,3].map(i=>['b'+i,((7>>i)&1) as 0|1]),
    ]);
    const evaluate=(op:number)=>calculateAlu4({...values,
      op0:(op&1) as 0|1,op1:((op>>1)&1) as 0|1});
    const bits=(result:Record<string,LogicValue>)=>[0,1,2,3]
      .reduce((word,i)=>word+(Number(result['y'+i])<<i),0);
    expect(bits(evaluate(0))).toBe(0);
    expect(evaluate(0)).toMatchObject({carry:1,zero:1});
    expect(bits(evaluate(1))).toBe(1);
    expect(bits(evaluate(2))).toBe(15);
    expect(bits(evaluate(3))).toBe(14);
    expect(evaluate(1).carry).toBe(0);
    expect(calculateAlu4({...values,op0:'X',op1:0}).zero).toBe('X');
  });
  it('complete starter CPU has a working PC→ROM→ALU→ACC accumulator loop',()=>{
    const doc=cpuCoreDemo();
    expect(isDigitalDocument(doc)).toBe(true);
    expect(simulateLogic(doc).warnings).toEqual([]);
    let runtime=emptyDigitalRuntime();
    let sum=0;
    for(let cycle=1;cycle<=6;cycle++){
      const oldRom=word(doc,'rom',runtime);
      sum=(sum+oldRom)&15;
      runtime=stepCircuit(doc,runtime);
      expect(word(doc,'pc',runtime)).toBe(cycle);
      expect(word(doc,'acc',runtime)).toBe(sum);
      for(let i=0;i<4;i++) {
        expect(simulateLogic(doc,runtime).ledValues['out'+i]).toBe((sum>>i)&1);
      }
    }
    expect(runtime.cycle).toBe(6);
  });
  it('clocked flip-flop inside a reusable module has independently scoped state',()=>{
    const original=flipFlopDemo();
    const {definition,condensed}=captureBlock(original,'CLOCKED BIT');
    // The module exposes DATA as an external INPUT and the Q indicator
    // as its output; its internal CLOCK generator remains inside.
    expect(definition.inputs).toHaveLength(1);
    expect(definition.outputs).toHaveLength(1);
    const block=condensed.components.find(c=>c.kind==='block')!;
    const twice=placeBlock(condensed,[definition],definition.id,{x:890,y:450});
    const instances=twice.components.filter(c=>c.kind==='block');
    expect(instances).toHaveLength(2);
    const zero=simulateLogic(twice,emptyDigitalRuntime());
    const first=stepCircuit(twice,emptyDigitalRuntime());
    expect(zero.ledValues).toBeTruthy();
    expect(first.registers['top/'+block.id+'/ff']).toBeDefined();
    expect(first.registers['top/'+instances[1].id+'/ff']).toBeDefined();
  });
  it('truth table refuses a sequential design rather than implying time has no effect',()=>{
    expect(()=>generateTruthTable(flipFlopDemo())).toThrow(/combinational/);
    expect(()=>generateTruthTable(counterDemo())).toThrow(/combinational/);
  });
});

describe('editor computer controls and simulation reset',()=>{
  beforeEach(()=>useDigitalStore.setState({
    document:counterDemo(),runtime:emptyDigitalRuntime(),trace:[],
    past:[],future:[],editStack:[],selection:null,selectedIds:[],
    pending:null,dragOrigin:null,
  }));
  it('clock steps record state changes in waveform without mutating circuit geometry',()=>{
    const original=useDigitalStore.getState().document;
    useDigitalStore.getState().clockStep();
    useDigitalStore.getState().clockSteps(3);
    const state=useDigitalStore.getState();
    expect(state.runtime.cycle).toBe(4);
    expect(word(state.document,'pc',state.runtime)).toBe(4);
    expect(state.document).toBe(original);
    expect(state.trace.map(entry=>entry.terminals['pc:q0'])).toEqual([1,0,1,0]);
    useDigitalStore.getState().resetClock();
    expect(useDigitalStore.getState().runtime.cycle).toBe(0);
    expect(word(useDigitalStore.getState().document,'pc',useDigitalStore.getState().runtime)).toBe(0);
  });
  it('editing ROM program preserves exactly 16 four-bit words in schematic',()=>{
    useDigitalStore.getState().load(cpuCoreDemo());
    const next=Array.from({length:16},(_,i)=>15-i);
    useDigitalStore.getState().setRomWords('rom',next);
    const programmed=useDigitalStore.getState().document;
    expect(programmed.components.find(c=>c.id==='rom')?.words).toEqual(next);
    expect(isDigitalDocument(programmed)).toBe(true);
    expect(word(programmed,'rom',emptyDigitalRuntime())).toBe(15);
    useDigitalStore.getState().setRomWords('rom',[16]);
    expect(useDigitalStore.getState().document.components.find(c=>c.id==='rom')?.words).toEqual(next);
  });
});
