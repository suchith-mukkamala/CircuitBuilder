import {digitalId,pinAt,isOutput,type DigitalComponent,type DigitalDocument,type DigitalEndpoint,type DigitalWire} from '../digital/types';
import {cpuCoreDemo} from '../digital/computerSamples';
import {forkModule,type ModulePackage} from './modulePackages';

/** A real four-bit ALU assembled from full adders, Boolean gates, and multiplexers. */
export function aluWorkshop():DigitalDocument{
  const components:DigitalComponent[]=[],wires:DigitalWire[]=[];
  const add=(id:string,kind:DigitalComponent['kind'],x:number,y:number,name?:string)=>{
    components.push({id,kind,x,y,rotation:0,name,...(kind==='input'?{bit:0 as const}:{})});
  };
  const net=(name:string,componentId:string,pin:string)=>{
    const part=components.find(c=>c.id===componentId)!,p=pinAt(part,pin);
    wires.push({id:'n'+wires.length,label:name,from:{componentId,pin},to:{x:p.x+(isOutput(part,pin)?24:-24),y:p.y}});
  };
  for(const word of ['A','B'])for(let bit=0;bit<4;bit++){
    const id=word+bit;add(id,'input',120,120+(word==='B'?360:0)+bit*72,id);net(id,id,'out');
  }
  for(let bit=0;bit<2;bit++){add('OP'+bit,'input',120,864+bit*84,'OP'+bit);net('OP'+bit,'OP'+bit,'out');}
  add('zero','low',420,1104,'CARRY IN = 0');net('C0','zero','out');
  for(let bit=0;bit<4;bit++){
    const y=156+bit*288;
    add('add'+bit,'fulladder',420,y,'ADD BIT '+bit);
    net('A'+bit,'add'+bit,'a');net('B'+bit,'add'+bit,'b');net('C'+bit,'add'+bit,'cin');
    net('C'+(bit+1),'add'+bit,'carry');net('SUM'+bit,'add'+bit,'sum');
    for(const [i,kind] of (['and','or','xor'] as const).entries()){
      add(kind+bit,kind,660,y-84+i*84,kind.toUpperCase()+' BIT '+bit);
      net('A'+bit,kind+bit,'a');net('B'+bit,kind+bit,'b');net(kind.toUpperCase()+bit,kind+bit,'out');
    }
    add('lo'+bit,'mux2',924,y-48,'ADD / AND');add('hi'+bit,'mux2',924,y+48,'OR / XOR');
    net('SUM'+bit,'lo'+bit,'a');net('AND'+bit,'lo'+bit,'b');net('OP0','lo'+bit,'sel');net('LO'+bit,'lo'+bit,'out');
    net('OR'+bit,'hi'+bit,'a');net('XOR'+bit,'hi'+bit,'b');net('OP0','hi'+bit,'sel');net('HI'+bit,'hi'+bit,'out');
    add('select'+bit,'mux2',1164,y,'SELECT BIT '+bit);
    net('LO'+bit,'select'+bit,'a');net('HI'+bit,'select'+bit,'b');net('OP1','select'+bit,'sel');net('Y'+bit,'select'+bit,'out');
    add('Y'+bit,'led',1392,y,'Y'+bit);net('Y'+bit,'Y'+bit,'in');
  }
  return {version:1,lab:'signal',name:'ALU Workshop · ADD / AND / OR / XOR',components,wires};
}
export function aluPortMap(bundle:ModulePackage){
  const root=bundle.definitions.find(d=>d.id===bundle.rootId)!;
  const inputs=new Map(root.inputs.map(port=>[port.label.toLowerCase(),port.pin]));
  const outputs=new Map(root.outputs.map(port=>[port.label.toLowerCase(),port.pin]));
  const map=new Map<string,string>();
  for(const prefix of ['a','b'])for(let i=0;i<4;i++)if(inputs.has(prefix+i))map.set(prefix+i,inputs.get(prefix+i)!);
  for(let i=0;i<2;i++)if(inputs.has('op'+i))map.set('op'+i,inputs.get('op'+i)!);
  for(let i=0;i<4;i++)if(outputs.has('y'+i))map.set('y'+i,outputs.get('y'+i)!);
  if(map.size!==14)throw new Error('This datapath needs inputs A0–A3, B0–B3, OP0–OP1 and outputs Y0–Y3. Rename the module boundary switches/LEDs to match.');
  return map;
}
/** Replaces the actual ALU primitive; no hidden alternate ALU executes the design. */
export function computerWithModuleAlu(bundle:ModulePackage):DigitalDocument{
  const fork=forkModule(bundle),root=fork.definitions.find(d=>d.id===fork.rootId)!;
  const mapping=aluPortMap(fork),base=cpuCoreDemo();
  const endpoint=(end:DigitalEndpoint):DigitalEndpoint=>'componentId' in end&&end.componentId==='alu'
    ?{componentId:'alu',pin:mapping.get(end.pin)!}:end;
  return {...base,name:'Computer datapath · '+root.name,blocks:fork.definitions,
    components:base.components.map(c=>c.id==='alu'?{id:c.id,kind:'block',blockId:root.id,name:root.name,x:c.x,y:c.y,rotation:0,
      ports:{inputs:root.inputs.map(p=>p.pin),outputs:root.outputs.map(p=>p.pin)}}:c),
    wires:base.wires.map(w=>({...w,id:digitalId(),from:endpoint(w.from),to:endpoint(w.to)})),
  };
}
