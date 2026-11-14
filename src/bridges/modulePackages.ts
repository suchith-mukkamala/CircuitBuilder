import {captureBlock} from '../digital/blocks';
import {compileSignals} from '../digital/compile';
import {digitalId,isDigitalDocument,type DigitalBlock,type DigitalDocument} from '../digital/types';

export type ModulePackage={version:1;kind:'circuitbuilder.module';rootId:string;definitions:DigitalBlock[]};
const clone=<T,>(value:T):T=>JSON.parse(JSON.stringify(value));
export function moduleDocument(bundle:ModulePackage):DigitalDocument{
  const root=bundle.definitions.find(d=>d.id===bundle.rootId);
  if(!root)throw new Error('The module root is missing.');
  return {version:1,lab:'signal',name:root.name,components:[{id:'module',kind:'block',blockId:root.id,
    x:420,y:252,rotation:0,ports:{inputs:root.inputs.map(p=>p.pin),outputs:root.outputs.map(p=>p.pin)}}],wires:[],blocks:bundle.definitions};
}
export function parseModulePackage(value:unknown):ModulePackage{
  if(!value||typeof value!=='object')throw new Error('Choose a CircuitBuilder module package.');
  const p=value as ModulePackage;
  if(p.version!==1||p.kind!=='circuitbuilder.module'||typeof p.rootId!=='string'||
    !Array.isArray(p.definitions)||!p.definitions.length||p.definitions.length>80)
    throw new Error('Invalid or unsupported module package.');
  let document:DigitalDocument;
  try{document=moduleDocument(p);}catch{throw new Error('The module has invalid ports or a missing root definition.');}
  if(!isDigitalDocument(document))throw new Error('The module has invalid ports, wires, or missing dependencies.');
  compileSignals(document); // Checks recursion, nesting, and expanded size before importing anything.
  return clone({version:1,kind:'circuitbuilder.module',rootId:p.rootId,definitions:p.definitions});
}
export function packageModule(catalog:DigitalBlock[],rootId:string):ModulePackage{
  const available=new Map(catalog.map(def=>[def.id,def]));
  const definitions:DigitalBlock[]=[],seen=new Set<string>();
  const visit=(id:string,ancestors:Set<string>)=>{
    if(ancestors.has(id))throw new Error('Recursive modules cannot be shared.');
    if(seen.has(id))return;
    const def=available.get(id);if(!def)throw new Error('A required module dependency is missing.');
    const stack=new Set(ancestors);stack.add(id);
    for(const part of def.circuit.components)if(part.kind==='block')visit(part.blockId!,stack);
    definitions.push(def);seen.add(id);
  };
  visit(rootId,new Set());
  return parseModulePackage({version:1,kind:'circuitbuilder.module',rootId,definitions});
}
/** Copies have new identities, so importing cannot silently rewrite another circuit. */
export function forkModule(bundle:ModulePackage):ModulePackage{
  const parsed=parseModulePackage(bundle);
  const ids=new Map(parsed.definitions.map(def=>[def.id,digitalId()]));
  return {version:1,kind:'circuitbuilder.module',rootId:ids.get(parsed.rootId)!,definitions:parsed.definitions.map(def=>({...def,
    id:ids.get(def.id)!,circuit:{...def.circuit,components:def.circuit.components.map(part=>part.kind==='block'
      ?{...part,blockId:ids.get(part.blockId!)!}:part)},
  }))};
}
export function packageCurrentCircuit(doc:DigitalDocument,name:string):ModulePackage{
  const {definition}=captureBlock(doc,name);
  return forkModule(packageModule([...(doc.blocks??[]),definition],definition.id));
}
export function moduleWorkingCopy(bundle:ModulePackage):DigitalDocument{
  const fork=forkModule(bundle),root=fork.definitions.find(d=>d.id===fork.rootId)!;
  return {...root.circuit,blocks:fork.definitions.filter(d=>d.id!==fork.rootId),name:root.name+' · working copy'};
}
export function nextModulePosition(doc:DigitalDocument){
  for(let row=0;row<8;row++)for(let col=0;col<8;col++){
    const point={x:360+col*264,y:240+row*360};
    if(!doc.components.some(c=>Math.abs(c.x-point.x)<200&&Math.abs(c.y-point.y)<300))return point;
  }
  return {x:Math.max(360,...doc.components.map(c=>c.x))+300,y:240};
}
export function thresholdSample(voltage:number,threshold:number):0|1{
  if(!Number.isFinite(voltage)||!Number.isFinite(threshold))throw new Error('A finite solved voltage and threshold are required.');
  return voltage>=threshold?1:0;
}
