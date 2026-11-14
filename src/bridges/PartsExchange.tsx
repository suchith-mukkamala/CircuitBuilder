import {useEffect,useMemo,useRef,useState,type ChangeEvent} from 'react';
import {useDigitalStore} from '../digital/useDigitalStore';
import {useCircuitStore} from '../state/useCircuitStore';
import {labelFor,pinsFor,formatElectrical} from '../circuit/types';
import {simulateLogic} from '../digital/engine';
import {andDemo} from '../digital/samples';
import {CircuitThumbnail} from '../workbench/CircuitThumbnail';
import {packageModule,parseModulePackage,thresholdSample,type ModulePackage} from './modulePackages';
import {aluWorkshop,aluPortMap} from './aluWorkshop';
import {controllerFromModule} from './logicController';
import {useExchangeState} from './exchangeState';
type Page='home'|'analog'|'signal'|'computer'|'robotics';

function ModuleTester({bundle}:{bundle:ModulePackage}){
  const root=bundle.definitions.find(d=>d.id===bundle.rootId)!;
  const [bits,setBits]=useState<Record<string,0|1>>(()=>Object.fromEntries(root.inputs.map(p=>[p.componentId,root.circuit.components.find(c=>c.id===p.componentId)?.bit??0])));
  const doc=useMemo(()=>({...root.circuit,blocks:bundle.definitions,components:root.circuit.components.map(c=>c.kind==='input'?{...c,bit:bits[c.id]}:c)}),[bundle,bits]);
  const result=useMemo(()=>simulateLogic(doc),[doc]);
  let isAlu=false;try{aluPortMap(bundle);isAlu=true;}catch{/* Generic modules still have a pin tester. */}
  const word=(prefix:string)=>root.inputs.filter(p=>new RegExp('^'+prefix+'[0-3]$','i').test(p.label))
    .reduce((value,p)=>value+(bits[p.componentId]??0)*2**Number(p.label.at(-1)),0);
  const setWord=(prefix:string,value:number)=>setBits(old=>({...old,...Object.fromEntries(root.inputs.filter(p=>new RegExp('^'+prefix+'[0-3]$','i').test(p.label))
    .map(p=>[p.componentId,((value>>Number(p.label.at(-1)))&1) as 0|1]))}));
  const outputs=root.outputs.map(p=>result.ledValues[p.componentId]??'Z');
  return <section className="exchange-tester" aria-label="Module test bench">
    <div className="exchange-section-title"><h3>Try the actual circuit</h3><span>{root.circuit.components.length} parts · {bundle.definitions.length} definitions</span></div>
    {isAlu&&<div className="exchange-operands">
      <label>Operand A<input aria-label="Operand A" type="number" min="0" max="15" value={word('A')} onChange={event=>setWord('A',Math.max(0,Math.min(15,Number(event.target.value))))}/></label>
      <label>Operand B<input aria-label="Operand B" type="number" min="0" max="15" value={word('B')} onChange={event=>setWord('B',Math.max(0,Math.min(15,Number(event.target.value))))}/></label>
      <label>Operation<select aria-label="ALU operation" value={root.inputs.filter(p=>/^OP[01]$/i.test(p.label)).reduce((n,p)=>n+(bits[p.componentId]??0)*2**Number(p.label.at(-1)),0)}
        onChange={event=>setBits(old=>({...old,...Object.fromEntries(root.inputs.filter(p=>/^OP[01]$/i.test(p.label)).map(p=>[p.componentId,((Number(event.target.value)>>Number(p.label.at(-1)))&1) as 0|1]))}))}>
        {['ADD','AND','OR','XOR'].map((name,i)=><option key={name} value={i}>{name}</option>)}</select></label>
    </div>}
    <div className="exchange-pin-grid">{root.inputs.map(port=><button key={port.pin} aria-pressed={bits[port.componentId]===1}
      aria-label={'Test input '+port.label} onClick={()=>setBits(old=>({...old,[port.componentId]:old[port.componentId]?0:1}))}>
      <span>{port.label}</span><strong>{bits[port.componentId]}</strong></button>)}</div>
    <div className="exchange-output-grid">{root.outputs.map((port,i)=><div key={port.pin} className={'logic-output value-'+outputs[i]}><span>{port.label}</span><strong>{outputs[i]===1?'HIGH / 1':outputs[i]===0?'LOW / 0':outputs[i]}</strong></div>)}</div>
    <p>Output bits [{outputs.length-1}:0]: <strong>{[...outputs].reverse().join('')}</strong>
      {outputs.every(v=>v===0||v===1)&&<> · Unsigned <strong>{outputs.reduce<number>((n,v,i)=>n+(v===1?2**i:0),0)}</strong></>}</p>
    <small>Test inputs stay in this preview. They do not change your working circuit or the published module.</small>
  </section>;
}

function AnalogAdapter({onUse}:{onUse:()=>void}){
  const doc=useCircuitStore(s=>s.document),solution=useCircuitStore(s=>s.simulation);
  const transient=useCircuitStore(s=>s.transient),timeIndex=useCircuitStore(s=>s.timeIndex);
  const terminals=doc.components.flatMap(c=>pinsFor(c).map(pin=>({id:c.id+':'+pin,label:labelFor(c,doc.components)+'.'+pin.toUpperCase()})));
  const [target,setTarget]=useState(terminals[0]?.id??''),[threshold,setThreshold]=useState('2.5');
  const [error,setError]=useState('');
  const voltage=solution?.nodeVoltages[solution.terminalNodes[target]];
  const ready=voltage!==undefined&&threshold.trim()!==''&&Number.isFinite(Number(threshold));
  return <section className="exchange-analog" aria-label="Analog to digital adapter">
    <span className="exchange-eyebrow">ANALOG → SIGNALS</span><h3>A voltage becomes a logic level</h3>
    <p>Take a solved voltage from your analog circuit and compare it with a threshold. The resulting HIGH or LOW source can be wired into a digital circuit.</p>
    <div className="exchange-operands"><label>Analog point<select aria-label="Analog sample point" value={target} onChange={event=>setTarget(event.target.value)}>
      {terminals.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}</select></label>
      <label>Threshold (V)<input aria-label="Logic threshold" type="number" step="0.1" value={threshold} onChange={event=>setThreshold(event.target.value)}/></label></div>
    <div className="exchange-sample"><span>{doc.name}{transient?' · t = '+formatElectrical(transient.frames[timeIndex]?.time??0,'s'):''}</span>
      <strong>{formatElectrical(voltage??NaN,'V')} <b>→</b> {ready?(thresholdSample(voltage!,Number(threshold))?'HIGH / 1':'LOW / 0'):'Run analog analysis first'}</strong></div>
    <p className="exchange-snapshot-note">This captures one sample. It does not create a live mixed-signal simulation. Re-run and sample again to refresh it.</p>
    <button className="exchange-primary" disabled={!ready} onClick={()=>{
      try{useDigitalStore.getState().useVoltageSample(voltage!,Number(threshold),terminals.find(t=>t.id===target)?.label??target);onUse();}
      catch(error){setError(error instanceof Error?error.message:'Could not transfer the sample.');}
    }}>Add sampled source to Signals →</button>
    {error&&<p role="alert">{error}</p>}
  </section>;
}

export function PartsExchange({page,onNavigate,onClose}:{page:Page;onNavigate:(page:Page)=>void;onClose:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null),file=useRef<HTMLInputElement>(null);
  const library=useDigitalStore(s=>s.blockLibrary),doc=useDigitalStore(s=>s.document),inBlock=useDigitalStore(s=>s.editStack.length)>0;
  const [tab,setTab]=useState<'modules'|'analog'|'workshops'>('modules');
  const [selected,setSelected]=useState(library.at(-1)?.id??''),[name,setName]=useState(doc.name.slice(0,40));
  const [message,setMessage]=useState('');
  useEffect(()=>{dialog.current?.showModal();},[]);
  const bundle=useMemo(()=>{try{return selected?packageModule(library,selected):null;}catch{return null;}},[library,selected]);
  const root=bundle?.definitions.find(d=>d.id===bundle.rootId);
  const act=(action:()=>void)=>{try{action();}catch(error){setMessage(error instanceof Error?error.message:'The module could not be transferred.');}};
  const navigate=(destination:Page)=>{onClose();onNavigate(destination);};
  const canPublish=(page==='signal'||page==='computer')&&!inBlock;
  const exportModule=()=>{if(!bundle)return;const url=URL.createObjectURL(new Blob([JSON.stringify(bundle,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download=(root!.name.replace(/[^a-z0-9_-]/gi,'-')||'module')+'.cbmodule.json';link.click();URL.revokeObjectURL(url);
    setMessage('Module exported with all required definitions.');};
  const importFile=async(event:ChangeEvent<HTMLInputElement>)=>{
    const chosen=event.currentTarget.files?.[0];event.currentTarget.value='';if(!chosen)return;
    try{if(chosen.size>1000000)throw new Error('Module packages must be smaller than 1 MB.');
      const parsed=parseModulePackage(JSON.parse(await chosen.text()));setSelected(useDigitalStore.getState().importModule(parsed));setTab('modules');setMessage('Imported an independent module copy.');
    }catch(error){setMessage(error instanceof Error?error.message:'Could not import the module.');}
  };
  return <dialog ref={dialog} className="parts-exchange" aria-label="Parts Exchange" onClose={onClose}>
    <header><div><span className="exchange-eyebrow">BUILD ON WHAT YOU BUILD</span><h2>Parts Exchange</h2><p>Your experiments can become the next lab’s building blocks.</p></div>
      <button aria-label="Close Parts Exchange" onClick={onClose}>×</button></header>
    <nav className="exchange-tabs" aria-label="Parts Exchange sections">{[['modules','Shared modules'],['analog','Voltage adapter'],['workshops','Connected projects']].map(([id,label])=><button key={id} aria-pressed={tab===id} onClick={()=>setTab(id as typeof tab)}>{label}</button>)}</nav>
    {tab==='modules'?<>
      <div className="exchange-publish"><div><h3>Publish a reusable part</h3><p>INPUT switches become named inputs; LED indicators become outputs. Your working circuit stays intact.</p></div>
        {canPublish?<div className="exchange-publish-controls"><input aria-label="Shared module name" maxLength={40} value={name} onChange={event=>setName(event.target.value)}/>
          <button className="exchange-primary" onClick={()=>act(()=>{setSelected(useDigitalStore.getState().publishModule(name));setMessage('Published a snapshot. You can test and use it in another lab below.');})}>Publish module</button></div>:
          <p>{inBlock?'Save or Cancel the open block before sharing.':'Open Signals or Computer Builder to publish a circuit.'}</p>}
      </div>
      <div className="exchange-library-tools"><label>Shared library<select aria-label="Shared module" value={selected} onChange={event=>{setSelected(event.target.value);setMessage('');}}>
        {!library.length&&<option value="">No modules yet</option>}{library.map(def=><option key={def.id} value={def.id}>{def.name} · {def.inputs.length} in / {def.outputs.length} out</option>)}</select></label>
        <button onClick={()=>file.current?.click()}>Import module</button><button disabled={!bundle} onClick={exportModule}>Export module</button>
        <input hidden ref={file} type="file" accept=".json,.cbmodule.json,application/json" onChange={importFile}/></div>
      {bundle&&root?<>
        <div className="exchange-module-heading"><CircuitThumbnail snapshot={{document:root.circuit}}/><div><h3>{root.name}</h3><p>Self-contained module · copies keep their own definitions</p></div></div>
        <ModuleTester key={root.id} bundle={bundle}/>
        <div className="exchange-destinations">
          {(['signal','computer'] as const).map(destination=><button key={destination} disabled={inBlock} onClick={()=>act(()=>{
            useDigitalStore.getState().useModuleInLab(root.id,destination);navigate(destination);
          })}>Use in {destination==='signal'?'Signals':'Computer'} →</button>)}
          <button disabled={inBlock} onClick={()=>act(()=>{const controller=controllerFromModule(bundle);useExchangeState.getState().offer(controller);navigate('robotics');})}>Use in Robotics →</button>
          <button disabled={inBlock} onClick={()=>act(()=>{if(window.confirm('Open a working copy in Signals? Save the current Signals project first to keep it.')){useDigitalStore.getState().openModuleCopy(root.id);navigate('signal');}})}>Edit a working copy</button>
          <button disabled={inBlock} onClick={()=>act(()=>{aluPortMap(bundle);if(window.confirm('Build a computer datapath around this ALU? Save the current Computer project first to keep it.')){useDigitalStore.getState().buildModuleComputer(root.id);navigate('computer');}})}>Build computer with this ALU</button>
        </div>
        <p className="exchange-footnote">Transfers add independent copies. Editing a copy does not silently change other labs. Re-export or transfer again to share a revision.</p>
      </>:<div className="exchange-empty"><span>↗</span><h3>Start with a circuit. Keep the useful part.</h3><p>Publish your own circuit, import a module, or open a connected project to try the complete journey.</p><button onClick={()=>setTab('workshops')}>Explore connected projects</button></div>}
    </>:tab==='analog'?<AnalogAdapter onUse={()=>navigate('signal')}/>:<div className="exchange-workshops">
      <article><span className="exchange-eyebrow">SIGNALS → COMPUTER</span><h3>Build the ALU inside your computer</h3><p>Explore a four-bit ALU made from full adders, logic gates, and multiplexers. Publish it, test operands, and build a computer datapath that uses your actual circuit.</p>
        <button className="exchange-primary" disabled={inBlock} onClick={()=>act(()=>{if(!window.confirm('Open the ALU workshop in Signals? Save that lab’s working project first to keep it.'))return;
          const store=useDigitalStore.getState();store.switchWorkspace('signal');store.load(aluWorkshop());navigate('signal');})}>Open ALU workshop →</button>
        <small>00 ADD · 01 AND · 10 OR · 11 XOR · four-bit results wrap modulo 16</small></article>
      <article><span className="exchange-eyebrow">SIGNALS → ROBOTICS</span><h3>Turn a logic gate into a controller</h3><p>Build an enable gate, publish it, and map its inputs to the button and distance sensor. Its real output can drive an LED or open the servo.</p>
        <button className="exchange-primary" disabled={inBlock} onClick={()=>act(()=>{if(!window.confirm('Open the enable-gate project in Signals? Save the working project first to keep it.'))return;
          const store=useDigitalStore.getState(),example=andDemo();example.name='Enable gate · button AND proximity';store.switchWorkspace('signal');store.load(example);navigate('signal');})}>Open enable-gate project →</button>
        <small>Combinational modules · explicit sensor thresholds · live actuator outputs</small></article>
    </div>}
    <div className="exchange-feedback" role="status">{message}</div>
  </dialog>;
}
