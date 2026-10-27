import type { DigitalDocument } from './types';
import {digitalLabel,inputsOf,outputsOf} from './types';
import {buildSignalNetwork} from './network';

export type CircuitIssue = {
  id:string;
  severity:'error'|'warning'|'info';
  code:'DRIVER_CONFLICT'|'FLOATING_INPUT'|'FLOATING_CLOCK'|'FEEDBACK_LOOP'
    |'BUS_WIDTH_MISMATCH'|'SCALAR_BUS_NAME';
  title:string;
  detail:string;
  componentId?:string;
  wireId?:string;
  busId?:string;
};

const severityOrder={error:0,warning:1,info:2};
const sequential=new Set(['dff','tff','register4','counter4','ram16x4','clock']);
const ignore=new Set(['splitter4','splitter8','splitter16']);
/**
 * Static, actionable circuit diagnostics. Pure and independent of the live
 * solver, so it works on stopped/reset machines without corrupting state.
 *
 * Inspection is local to the currently open schematic (block drilldown is a
 * separate schematic). Bus width/name checks are deterministic and display
 * even if all the component terminals are otherwise connected.
 */
export function diagnoseDigitalCircuit(doc:DigitalDocument):CircuitIssue[]{
  const net=buildSignalNetwork(doc);
  const issues:CircuitIssue[]=[];
  const drivers=new Map<string,{part:string;pin:string}[]>();
  const consumed=new Map<string,{part:string;pin:string}[]>();
  const components=new Map(doc.components.map(c=>[c.id,c]));
  for(const part of doc.components){
    if(ignore.has(part.kind))continue;
    for(const pin of outputsOf(part)){
      const root=net.terminals[part.id+':'+pin];
      if(!root)continue;
      const items=drivers.get(root)??[];
      items.push({part:part.id,pin});drivers.set(root,items);
    }
    for(const pin of inputsOf(part)){
      const root=net.terminals[part.id+':'+pin];
      if(!root)continue;
      const items=consumed.get(root)??[];
      items.push({part:part.id,pin});consumed.set(root,items);
    }
  }
  const labelOf=(id:string)=> {
    const p=components.get(id);
    return p?digitalLabel(p,doc.components):id;
  };
  for(const [root,items] of drivers){
    if(items.length<2)continue;
    const names=items.map(d=>labelOf(d.part)+'.'+d.pin);
    issues.push({
      id:'driver:'+root,severity:'error',code:'DRIVER_CONFLICT',
      title:'Multiple outputs driving the same signal',
      detail:names.join(' + ')+' share a net. Disconnect the conflicting drivers or add a multiplexer.',
      componentId:items[0].part,
    });
  }
  for(const [root,items] of consumed){
    if(drivers.has(root))continue;
    for(const item of items){
      const clock=item.pin==='clk';
      issues.push({
        id:'floating:'+item.part+':'+item.pin,
        severity:clock?'error':'warning',
        code:clock?'FLOATING_CLOCK':'FLOATING_INPUT',
        title:clock?'Clock input has no driver':'Input pin is floating',
        detail:labelOf(item.part)+'.'+item.pin.toUpperCase()+
          (clock?' needs a CLOCK source or a manual INPUT switch.':
            ' has no signal. Connect an output, a bus tap, or a named net.'),
        componentId:item.part,
      });
    }
  }
  const names=new Map<string,{width:number;id:string}>();
  for(const bus of doc.buses??[]){
    if(!bus.label)continue;
    const prior=names.get(bus.label);
    if(prior&&prior.width!==bus.width){
      issues.push({id:'mismatch:'+bus.id,severity:'error',code:'BUS_WIDTH_MISMATCH',
        title:'Named bus width mismatch',
        detail:bus.label+' is used for '+prior.width+'-bit and '+bus.width+
          '-bit buses. Rename one or use an explicit splitter/adapter.',
        busId:bus.id});
    }else if(!prior)names.set(bus.label,{width:bus.width,id:bus.id});
  }
  for(const wire of doc.wires){
    if(wire.label&&names.has(wire.label)){
      issues.push({id:'scalar:'+wire.id,severity:'warning',code:'SCALAR_BUS_NAME',
        title:'1-bit wire shares a multi-bit bus name',
        detail:'The wire '+wire.label+' will NOT automatically attach to all bits of that bus. '+
          'Use a splitter and choose the individual bit instead.',
        wireId:wire.id});
    }
  }
  // Dependency edges between combinational gate outputs and their consumers.
  // Sequential storage intentionally breaks feedback loops.
  const graph=new Map<string,Set<string>>();
  for(const part of doc.components){
    if(!sequential.has(part.kind)&&!ignore.has(part.kind)&&part.kind!=='led')
      graph.set(part.id,new Set());
  }
  for(const [root,sinks] of consumed){
    for(const source of drivers.get(root)??[]){
      const edges=graph.get(source.part);
      if(!edges)continue;
      for(const sink of sinks){
        if(graph.has(sink.part))edges.add(sink.part);
      }
    }
  }
  const visiting=new Set<string>(),visited=new Set<string>(),flagged=new Set<string>();
  const dfs=(id:string,path:string[])=>{
    if(visiting.has(id)){
      const start=path.indexOf(id);
      const members=path.slice(Math.max(0,start));
      for(const member of members)flagged.add(member);
      return;
    }
    if(visited.has(id))return;
    visiting.add(id);
    for(const next of graph.get(id)??[])dfs(next,[...path,id]);
    visiting.delete(id);visited.add(id);
  };
  for(const id of graph.keys())dfs(id,[]);
  if(flagged.size){
    const [id]=flagged;
    issues.push({id:'feedback:'+id,severity:'warning',code:'FEEDBACK_LOOP',
      title:'Combinational feedback detected',
      detail:[...flagged].map(labelOf).join(' → ')+
        ' forms a logic loop. Use a flip-flop/register to break the cycle, or inspect the wiring.',
      componentId:id});
  }
  return issues.sort((a,b)=>severityOrder[a.severity]-severityOrder[b.severity]
    ||a.title.localeCompare(b.title));
}
