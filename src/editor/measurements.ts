import {circuitNodes} from '../circuit/connectivity';
import {labelFor,pinsFor,type CircuitDocument,type DCResult} from '../circuit/types';
export type AnalogTarget={kind:'terminal';componentId:string;pin:string}|{kind:'wire';id:string}|{kind:'component';id:string};

export function analogMeasurement(doc:CircuitDocument,result:DCResult|null,target:AnalogTarget,connectivity?:ReturnType<typeof circuitNodes>){
  const component=target.kind!=='wire'?doc.components.find(c=>c.id===(target.kind==='terminal'?target.componentId:target.id)):undefined;
  const wire=target.kind==='wire'?doc.wires.find(w=>w.id===target.id):undefined;
  if((target.kind==='wire'&&!wire)||(target.kind!=='wire'&&!component))return null;
  if(target.kind==='terminal'&&!pinsFor(component!).some(pin=>pin===target.pin))return null;
  const label=target.kind==='wire'?'Wire '+target.id:
    labelFor(component!,doc.components)+(target.kind==='terminal'?' · '+target.pin.toUpperCase():'');
  if(target.kind==='component'&&component!.kind!=='ground')return {
    label,kind:'branch' as const,reading:result?.readings[component!.id],node:undefined,voltage:undefined,terminals:[],
  };
  const nodes=connectivity??circuitNodes(doc,{allowIncomplete:true});
  const key=component?.id+':'+(target.kind==='terminal'?target.pin:'g');
  const node=target.kind==='wire'?nodes.wireNodes[target.id]:nodes.terminalNodes[key];
  const terminals=doc.components.flatMap(c=>pinsFor(c).filter(pin=>nodes.terminalNodes[c.id+':'+pin]===node)
    .map(pin=>({componentId:c.id,pin,label:labelFor(c,doc.components)+' '+pin.toUpperCase()})));
  return {label,kind:'node' as const,node,voltage:result?.nodeVoltages[node],terminals,reading:undefined};
}
