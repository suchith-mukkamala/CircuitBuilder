import {beforeEach,describe,expect,it} from 'vitest';
import {aluWorkshop,computerWithModuleAlu} from './aluWorkshop';
import {forkModule,moduleDocument,moduleWorkingCopy,packageCurrentCircuit,parseModulePackage,thresholdSample} from './modulePackages';
import {applyInputVector,captureBlock} from '../digital/blocks';
import {andDemo} from '../digital/samples';
import {simulateLogic} from '../digital/engine';
import {stepCircuit} from '../digital/computerEngine';
import {emptyDigitalRuntime,initialDigitalCircuit,isDigitalDocument} from '../digital/types';
import {cpuCoreDemo} from '../digital/computerSamples';
import {useDigitalStore} from '../digital/useDigitalStore';
import {controllerFromModule,advanceLogicController,validateLogicController} from './logicController';
import {defaultInputs,defaultWiring,parseProject} from '../robotics/model';
import {starterProject} from '../robotics/projects';
import {initialController} from '../robotics/engine';

const bits=(value:number,width:number)=>Array.from({length:width},(_,i)=>String((value>>i)&1)).join('');
beforeEach(()=>{
  const doc=initialDigitalCircuit();useDigitalStore.setState({document:doc,signalDocument:doc,computerDocument:cpuCoreDemo(),activeWorkspace:'signal',
    blockLibrary:[],editStack:[],past:[],future:[],selection:null,selectedIds:[],casmDrafts:{},runtime:emptyDigitalRuntime()});
});
describe('portable modules and independent lab copies',()=>{
  it('publishes without condensing or changing the source circuit and preserves the target project',()=>{
    const original=useDigitalStore.getState().document,target=useDigitalStore.getState().computerDocument;
    const id=useDigitalStore.getState().publishModule('My XOR');
    expect(useDigitalStore.getState().document).toBe(original);
    useDigitalStore.getState().useModuleInLab(id,'computer');
    const state=useDigitalStore.getState();
    expect(state.activeWorkspace).toBe('computer');expect(state.document.components).toHaveLength(target.components.length+1);
    expect(state.signalDocument).toBe(original);expect(state.document.blocks?.[0].id).not.toBe(id);
    state.undo();expect(useDigitalStore.getState().document).toEqual(target);
  });
  it('round-trips definitions, forks identities, and leaves imported copies independent',()=>{
    const bundle=packageCurrentCircuit(andDemo(),'Enable');
    const roundTrip=parseModulePackage(JSON.parse(JSON.stringify(bundle))),fork=forkModule(roundTrip);
    expect(fork.rootId).not.toBe(roundTrip.rootId);
    fork.definitions[0].name='Edited';expect(roundTrip.definitions[0].name).toBe('Enable');
    expect(isDigitalDocument(moduleDocument(fork))).toBe(true);
    expect(isDigitalDocument(moduleWorkingCopy(roundTrip))).toBe(true);
  });
  it('rejects missing dependencies, unsupported packages, and recursive modules before changing a project',()=>{
    const bundle=packageCurrentCircuit(andDemo(),'Enable');
    expect(()=>parseModulePackage({})).toThrow();
    expect(()=>parseModulePackage({...bundle,rootId:'missing'})).toThrow();
    const broken=JSON.parse(JSON.stringify(bundle));broken.definitions[0].circuit.components.push({id:'recursive',kind:'block',blockId:bundle.rootId,x:12,y:12,rotation:0,
      ports:{inputs:['in0','in1'],outputs:['out0']}});
    expect(()=>parseModulePackage(broken)).toThrow();
    const original=useDigitalStore.getState().document;expect(()=>useDigitalStore.getState().importModule(broken)).toThrow();
    expect(useDigitalStore.getState().document).toBe(original);
  });
  it('includes nested dependencies, remaps every reference, and excludes unrelated library parts',()=>{
    const inner=captureBlock(andDemo(),'Inner enable'),unused=packageCurrentCircuit(andDemo(),'Unrelated');
    inner.condensed.blocks!.push(...unused.definitions);
    const bundle=packageCurrentCircuit(inner.condensed,'Outer enable'),copy=forkModule(bundle);
    expect(bundle.definitions).toHaveLength(2);expect(copy.definitions).toHaveLength(2);
    expect(bundle.definitions.some(d=>d.name==='Unrelated')).toBe(false);
    expect(copy.definitions.every(d=>!bundle.definitions.some(original=>original.id===d.id))).toBe(true);
    const working=moduleWorkingCopy(copy),result=simulateLogic(applyInputVector(working,'11'));
    expect(result.ledValues[working.components.find(c=>c.kind==='led')!.id]).toBe(1);
    expect(()=>parseModulePackage({...copy,definitions:copy.definitions.filter(d=>d.id===copy.rootId)})).toThrow();
  });
  it('adapts a finite solved voltage to an explicit fixed logic sample',()=>{
    expect(thresholdSample(5,2.5)).toBe(1);expect(thresholdSample(2.49,2.5)).toBe(0);expect(thresholdSample(2.5,2.5)).toBe(1);
    expect(()=>thresholdSample(NaN,2.5)).toThrow();expect(()=>thresholdSample(1,Infinity)).toThrow();
    useDigitalStore.getState().useVoltageSample(5,2.5,'R2.A');
    const part=useDigitalStore.getState().document.components.at(-1)!;expect(part.kind).toBe('high');
    expect(useDigitalStore.getState().message).toContain('fixed snapshot');
  });
});

describe('ALU workshop and real computer integration',()=>{
  it('computes all four operations for every four-bit operand pair without an ALU4 primitive',()=>{
    const doc=aluWorkshop();expect(isDigitalDocument(doc)).toBe(true);expect(doc.components.some(c=>c.kind==='alu4')).toBe(false);
    for(let op=0;op<4;op++)for(let a=0;a<16;a++)for(let b=0;b<16;b++){
      const result=simulateLogic(applyInputVector(doc,bits(a,4)+bits(b,4)+bits(op,2)));
      const word=[0,1,2,3].reduce((n,i)=>n+(result.ledValues['Y'+i]===1?2**i:0),0);
      expect(word,`op ${op}, A ${a}, B ${b}`).toBe(([a+b,a&b,a|b,a^b][op])&15);
    }
  });
  it('runs the same accumulator sequence after replacing the original ALU with the published circuit',()=>{
    const bundle=packageCurrentCircuit(aluWorkshop(),'My ALU'),custom=computerWithModuleAlu(bundle),baseline=cpuCoreDemo();
    expect(custom.components.find(c=>c.id==='alu')?.kind).toBe('block');
    expect(custom.components.some(c=>c.kind==='alu4')).toBe(false);
    let a=emptyDigitalRuntime(),b=emptyDigitalRuntime();
    for(let i=0;i<12;i++){
      a=stepCircuit(baseline,a);b=stepCircuit(custom,b);
      const expected=simulateLogic(baseline,a),actual=simulateLogic(custom,b);
      for(let bit=0;bit<4;bit++)expect(actual.ledValues['out'+bit]).toBe(expected.ledValues['out'+bit]);
    }
  });
});

describe('Signals to Robotics controller',()=>{
  it('drives actual bench pins from a button AND proximity module and preserves its snapshot',()=>{
    const controller=controllerFromModule(packageCurrentCircuit(andDemo(),'Enable'));
    expect(validateLogicController(controller)).toBe(true);
    const original=JSON.stringify(controller);
    let vm=advanceLogicController(controller,initialController(),0,{...defaultInputs,button:1,distance:20},defaultWiring);
    expect(vm.error).toBeNull();expect(vm.pins.D4).toBe(1);
    vm=advanceLogicController(controller,vm,100,{...defaultInputs,button:1,distance:35},defaultWiring);
    expect(vm.pins.D4).toBe(0);
    const output=Object.keys(controller.outputs)[0];controller.outputs[output]='servo';
    vm=advanceLogicController(controller,initialController(),100,{...defaultInputs,button:1,distance:20},defaultWiring);
    expect(vm.servos.D5).toBe(90);controller.outputs[output]='green';
    expect(JSON.stringify(controller)).toBe(original);
    const project={...starterProject(),controller:'logic' as const,logic:controller};
    expect(parseProject(JSON.parse(JSON.stringify(project)))).toEqual(project);
  });
  it('rejects clocked modules and invalid bindings; faults on unknown outputs',()=>{
    expect(()=>controllerFromModule(packageCurrentCircuit(cpuCoreDemo(),'Clocked'))).toThrow();
    const controller=controllerFromModule(packageCurrentCircuit(andDemo(),'Enable'));
    controller.inputs[Object.keys(controller.inputs)[0]]='invalid' as never;
    expect(validateLogicController(controller)).toBe(false);
    const floating=andDemo();floating.wires=[];
    const unknown=controllerFromModule(packageCurrentCircuit(floating,'Floating'));
    const vm=advanceLogicController(unknown,initialController(),50,{...defaultInputs,button:1,distance:20},defaultWiring);
    expect(vm.error).toMatch(/X|Z/);expect(vm.pins.D4).toBe(0);
  });
  it('rejects independently driven module outputs sharing one physical pin',()=>{
    const doc=andDemo();doc.components.push({id:'second-led',kind:'led',name:'Second',x:700,y:400,rotation:0});
    doc.wires.push({id:'second-wire',from:{componentId:'second-led',pin:'in'},to:doc.wires.at(-1)!.from});
    const controller=controllerFromModule(packageCurrentCircuit(doc,'Two outputs'));
    const vm=advanceLogicController(controller,initialController(),0,defaultInputs,{...defaultWiring,red:'D4'});
    expect(vm.error).toContain('both drive D4');expect(vm.pins.D4).toBe(0);
  });
});
