import {describe,expect,it} from 'vitest';
import {executeCasm,initialCpuState} from './cpuCore';
import {assembleCasm} from './casm';
import {explainCpuStep} from './explainCpu';
import {halfAdderDemo} from './samples';
import {simulateLogic} from './engine';
import {logicDescription,targetNet} from './SignalReadout';
describe('explanations of actual CPU transitions',()=>{
  it('describes the loaded value, arithmetic, output, and halt from the executed bytes',()=>{
    const code=assembleCasm('LDI 3\nADD 5\nOUT\nHLT');
    let state=initialCpuState(),ram=Array(16).fill(0);
    const explanations=[];
    for(const byte of code.bytes.slice(0,4)){
      const next=executeCasm(state,byte,ram);
      explanations.push(explainCpuStep(state,next.state,next.ram));state=next.state;ram=next.ram;
    }
    expect(explanations[0].detail).toContain('Loaded 3 into ACC');
    expect(explanations[1].detail).toContain('ACC 3 → 8');
    expect(explanations[2]).toMatchObject({blocks:['ACC','OUT']});
    expect(explanations[3].detail).toContain('Stopped execution');
    expect(explainCpuStep(state,state,ram).title).toContain('halted');
  });
  it('reports branch decisions from the tested flags rather than PC coincidence',()=>{
    for(const [source,zero,taken] of [['JZ 1',1,true],['JZ 1',0,false],['JNZ 1',0,true]] as const){
      const before={...initialCpuState(),zero};
      const next=executeCasm(before,assembleCasm(source).bytes[0],[]);
      expect(explainCpuStep(before,next.state,next.ram).detail).toContain(taken?'branch taken':'continued');
    }
  });
  it('does not invent an instruction when a floating bus faults the CPU',()=>{
    const before=initialCpuState(),after=executeCasm(before,null,[]);
    expect(explainCpuStep(before,after.state,after.ram)).toMatchObject({title:'CPU fault',blocks:[]});
  });
  it('finds the actual connected digital net and names all four logic states',()=>{
    const doc=halfAdderDemo(),result=simulateLogic(doc);
    expect(targetNet(doc,result,{kind:'pin',componentId:'xor',pin:'a'})).toBe(targetNet(doc,result,{kind:'wire',id:'w1'}));
    expect(targetNet(doc,result,{kind:'pin',componentId:'xor',pin:'a'})).not.toBe(targetNet(doc,result,{kind:'pin',componentId:'xor',pin:'out'}));
    expect([1,0,'X','Z'].map(value=>logicDescription(value as 0|1|'X'|'Z'))).toEqual(['HIGH · 1','LOW · 0','X · Unknown / conflicting','Z · Undriven']);
  });
});
