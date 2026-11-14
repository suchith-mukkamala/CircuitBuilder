import {compileSignals} from '../digital/compile';
import {simulateLogic} from '../digital/engine';
import {isDigitalDocument,sequentialKinds,type DigitalDocument,type LogicBit} from '../digital/types';
import {forkModule,type ModulePackage} from './modulePackages';
import type {ControllerState} from '../robotics/engine';
import type {Inputs,Wiring} from '../robotics/model';

export type LogicSensor='button'|'near'|'dialHigh';
export type LogicActuator='red'|'amber'|'green'|'servo';
export type LogicController={name:string;document:DigitalDocument;inputs:Record<string,LogicSensor>;
  outputs:Record<string,LogicActuator|null>;distanceThreshold:number;dialThreshold:number};
export function validateLogicController(value:unknown):value is LogicController{
  if(!value||typeof value!=='object')return false;
  const p=value as LogicController;
  if(typeof p.name!=='string'||p.name.length>80||!isDigitalDocument(p.document)||
    !p.inputs||typeof p.inputs!=='object'||!p.outputs||typeof p.outputs!=='object'||
    !Number.isFinite(p.distanceThreshold)||p.distanceThreshold<0||p.distanceThreshold>400||
    !Number.isFinite(p.dialThreshold)||p.dialThreshold<0||p.dialThreshold>1023)return false;
  const inputs=p.document.components.filter(c=>c.kind==='input'),outputs=p.document.components.filter(c=>c.kind==='led');
  if(!inputs.length||inputs.length>12||!outputs.length||outputs.length>12||Object.keys(p.inputs).length!==inputs.length||Object.keys(p.outputs).length!==outputs.length)return false;
  if(inputs.some(c=>!['button','near','dialHigh'].includes(p.inputs[c.id]))||outputs.some(c=>p.outputs[c.id]!==null&&!['red','amber','green','servo'].includes(p.outputs[c.id]!)))return false;
  const mapped=outputs.map(c=>p.outputs[c.id]).filter(Boolean);
  if(!mapped.length||new Set(mapped).size!==mapped.length)return false;
  try{
    const compiled=compileSignals(p.document);
    return compiled.primitives.length<=200&&!compiled.primitives.some(p=>sequentialKinds.includes(p.component.kind as typeof sequentialKinds[number]));
  }catch{return false;}
}
export function controllerFromModule(bundle:ModulePackage):LogicController{
  const fork=forkModule(bundle),root=fork.definitions.find(d=>d.id===fork.rootId)!;
  const controller:LogicController={name:root.name,document:{...root.circuit,blocks:fork.definitions.filter(d=>d.id!==fork.rootId)},
    inputs:Object.fromEntries(root.inputs.map((port,i)=>[port.componentId,(['button','near','dialHigh'] as const)[i%3]])),
    outputs:Object.fromEntries(root.outputs.map((port,i)=>[port.componentId,(['green','red','amber','servo'] as const)[i]??null])),
    distanceThreshold:35,dialThreshold:512};
  if(!validateLogicController(controller))throw new Error('Robotics needs a combinational module with at most 200 expanded parts. Clocked components are not supported by this adapter.');
  return controller;
}
export function logicWiringErrors(controller:LogicController,wiring:Wiring):string[]{
  const pins=new Map<string,string>(),errors:string[]=[];
  for(const device of Object.values(controller.outputs)){
    if(!device)continue;
    const pin=wiring[device];if(!pin)continue;
    const other=pins.get(pin);
    if(other)errors.push('Module outputs for '+other+' and '+device+' both drive '+pin+'. Give each driven output a separate pin.');
    pins.set(pin,device);
  }
  return errors;
}
export function evaluateLogicController(controller:LogicController,inputs:Inputs,wiring:Wiring){
  const conflicts=logicWiringErrors(controller,wiring);if(conflicts.length)throw new Error(conflicts[0]);
  const sensors:Record<LogicSensor,LogicBit>={button:wiring.button&&inputs.button?1:0,
    near:wiring.distance&&inputs.distance<controller.distanceThreshold?1:0,
    dialHigh:wiring.knob&&inputs.knob>=controller.dialThreshold?1:0};
  const doc={...controller.document,components:controller.document.components.map(c=>c.kind==='input'
    ?{...c,bit:sensors[controller.inputs[c.id]]}:c)};
  const result=simulateLogic(doc);
  const values:Partial<Record<LogicActuator,LogicBit>>={};
  for(const [id,device] of Object.entries(controller.outputs)){
    if(!device)continue;
    const value=result.ledValues[id];
    if(value!==0&&value!==1)throw new Error('Module output '+id+' is '+(value??'Z')+'. Drive every mapped output before running.');
    values[device]=value;
  }
  return values;
}
export function advanceLogicController(controller:LogicController,state:ControllerState,elapsed:number,inputs:Inputs,wiring:Wiring):ControllerState{
  if(state.error)return state;
  if(!Number.isFinite(elapsed)||elapsed<0||elapsed>60000)throw new Error('Invalid controller time step.');
  let values:ReturnType<typeof evaluateLogicController>;
  try{values=evaluateLogicController(controller,inputs,wiring);}
  catch(error){return {...state,error:error instanceof Error?error.message:'Module could not be evaluated.'};}
  const vm={...state,time:state.time+elapsed,steps:state.steps+1,pins:{...state.pins},servos:{...state.servos},trace:[...state.trace]};
  for(const [device,value] of Object.entries(values) as [LogicActuator,LogicBit][]){
    const pin=wiring[device];if(!pin||pin.startsWith('A'))continue;
    const key=pin as keyof typeof vm.pins;
    if(device==='servo'){
      const angle=value?90:0;
      if(vm.servos[key]!==angle)vm.trace.push({time:vm.time,message:pin+' → '+angle+'° (logic module)'});
      vm.servos[key]=angle;
    }else{
      if(vm.pins[key]!==value)vm.trace.push({time:vm.time,message:pin+' → '+(value?'HIGH':'LOW')+' (logic module)'});
      vm.pins[key]=value;
    }
  }
  vm.trace=vm.trace.slice(-80);return vm;
}
