import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { SignalCanvas } from './digital/SignalCanvas';
import { SignalPalette } from './digital/SignalPalette';
import { SignalInspector } from './digital/SignalLab';
import { SignalScopePanel,SignalVectorPanel } from './digital/SignalTools';
import { ComputerPanel } from './digital/ComputerPanel';
import { CasmProgramPanel } from './digital/CasmProgramPanel';
import { SignalDiagnostics } from './digital/SignalDiagnostics';
import { diagnoseDigitalCircuit } from './digital/diagnostics';
import { cpuCoreDemo,counterDemo,flipFlopDemo,programmableCpuDemo } from './digital/computerSamples';
import { simulateLogic } from './digital/engine';
import type { DigitalDocument } from './digital/types';
import { useDigitalStore } from './digital/useDigitalStore';

type ComputerTab='code'|'run'|'inspect'|'scope'|'inputs'|'check';

/** A dedicated, persistent CPU-design workbench powered by the shared digital engine. */
export function ComputerBuilder(){
  const doc=useDigitalStore(s=>s.document);
  const runtime=useDigitalStore(s=>s.runtime);
  const focusTarget=useDigitalStore(s=>s.focusTarget);
  const selection=useDigitalStore(s=>s.selection);
  const editStack=useDigitalStore(s=>s.editStack);
  const message=useDigitalStore(s=>s.message);
  const clock=useDigitalStore(s=>s.clockStep);
  const reset=useDigitalStore(s=>s.resetClock);
  const load=useDigitalStore(s=>s.load);
  const newCircuit=useDigitalStore(s=>s.newCircuit);
  const rename=useDigitalStore(s=>s.renameDocument);
  const past=useDigitalStore(s=>s.past.length);
  const future=useDigitalStore(s=>s.future.length);
  const undo=useDigitalStore(s=>s.undo);
  const redo=useDigitalStore(s=>s.redo);
  const saveBlock=useDigitalStore(s=>s.saveBlockEdit);
  const cancelBlock=useDigitalStore(s=>s.cancelBlockEdit);
  const [paletteOpen,setPaletteOpen]=useState(true);
  const [panelOpen,setPanelOpen]=useState(true);
  const [tab,setTab]=useState<ComputerTab>('code');
  const [saveError,setSaveError]=useState('');
  const fileRef=useRef<HTMLInputElement>(null);
  const actionsRef=useRef<HTMLDetailsElement>(null);
  const result=useMemo(()=>simulateLogic(doc,runtime),[doc,runtime]);
  const issues=useMemo(()=>diagnoseDigitalCircuit(doc),[doc]);
  const inBlock=editStack.length>0;
  const closeMenu=()=>{if(actionsRef.current)actionsRef.current.open=false;};
  const openExample=(make:()=>DigitalDocument)=>{
    if(inBlock){window.alert('Save or cancel the current block before loading a project.');return;}
    try {load(make());reset();setTab(make===programmableCpuDemo?'code':'run');closeMenu();}
    catch(err){window.alert(err instanceof Error?err.message:'Could not load this circuit.');}
  };
  const exportProject=()=>{
    const json=JSON.stringify(doc,null,2);
    const blob=new Blob([json],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;
    link.download=(doc.name.replace(/[^a-z0-9_-]/gi,'-').toLowerCase()||'computer')+'.signal.json';
    document.body.appendChild(link);link.click();link.remove();
    URL.revokeObjectURL(url);closeMenu();
  };
  const importProject=async(event:ChangeEvent<HTMLInputElement>)=>{
    const file=event.currentTarget.files?.[0];
    if(!file)return;
    try {
      const imported:unknown=JSON.parse(await file.text());
      load(imported);reset();setTab('code');
    } catch(err) {
      window.alert(err instanceof Error?err.message:'Invalid Signal Lab JSON file.');
    }
    event.currentTarget.value='';
  };
  const createNew=()=>{
    if(!window.confirm('Create a blank computer circuit? Your current project will be kept in Undo history.'))return;
    newCircuit();reset();closeMenu();
  };
  const publish=()=>{
    try {saveBlock();setSaveError('');}
    catch(err){setSaveError(err instanceof Error?err.message:'Unable to save module.');}
  };

  // Familiar editor shortcuts should work in Lab 03 as well as Signal Lab.
  useEffect(()=>{
    const shortcut=(event:KeyboardEvent)=>{
      const target=event.target as HTMLElement|null;
      if(target?.closest('input,textarea,select,button,a,[contenteditable="true"]'))return;
      const store=useDigitalStore.getState();
      const key=event.key.toLowerCase();
      if(event.metaKey||event.ctrlKey){
        if(key==='z'){event.preventDefault();event.shiftKey?store.redo():store.undo();}
        else if(key==='y'){event.preventDefault();store.redo();}
        else if(key==='c'){event.preventDefault();store.copy();}
        else if(key==='v'){event.preventDefault();store.paste();}
        else if(key==='d'){event.preventDefault();store.duplicate();}
        else if(key==='a'){event.preventDefault();store.selectAll();}
        else if(key==='s'){
          event.preventDefault();
          useDigitalStore.setState({message:'Project autosaved locally. Use Export JSON for a file backup.'});
        }
        return;
      }
      if(event.key==='Escape')store.cancelWire();
      if(event.key==='Delete'||event.key==='Backspace')store.remove();
      if(key==='r'&&store.selection?.type==='component')store.rotate(store.selection.id);
      if(event.code==='Space'&&store.selection?.type==='component'){
        const part=store.document.components.find(c=>c.id===store.selection?.id);
        if(part?.kind==='input'){event.preventDefault();store.toggleInput(part.id);}
      }
    };
    window.addEventListener('keydown',shortcut);
    return ()=>window.removeEventListener('keydown',shortcut);
  },[]);

  // User journey: clicking a component should reveal its editable properties
  // rather than forcing a hunt for the inspector tab.
  useEffect(()=>{
    if(selection?.type==='component'||selection?.type==='wire'||selection?.type==='bus')
      setTab('inspect');
  },[selection?.type,selection?.id]);
  useEffect(()=>{if(focusTarget){setPanelOpen(true);setTab('inspect');}},
    [focusTarget?.nonce]);

  return <div className="signal-lab-shell computer-builder-shell">
    <header className="signal-workbench-header computer-builder-header">
      <div className="signal-lab-brand">
        <span className="signal-lab-glyph">▣</span>
        <div><strong>COMPUTER BUILDER</strong><small>LAB 03 / CPU WORKBENCH</small></div>
      </div>
      <input className="signal-circuit-title" aria-label="Computer project name"
        title="Rename this project" value={doc.name}
        onChange={event=>rename(event.target.value)}/>
      <nav className="computer-main-tools" aria-label="Computer Builder actions">
        <button aria-pressed={paletteOpen} className={paletteOpen?'is-selected':''}
          onClick={()=>setPaletteOpen(v=>!v)} title="Show or hide component library">▦ <span>PARTS</span></button>
        <button onClick={undo} disabled={!past} title="Undo circuit change">↶</button>
        <button onClick={redo} disabled={!future} title="Redo circuit change">↷</button>
        <button className="computer-top-step" onClick={()=>{clock();setTab('code');setPanelOpen(true);}}
          title="Execute one clocked instruction / circuit edge">↯ <span>STEP CLOCK</span></button>
        <button onClick={()=>{setPanelOpen(true);setTab('code');}} title="Open CASM assembler">
          ⌘ <span>CASM</span>
        </button>
        <button className={panelOpen?'is-selected':''}
          onClick={()=>setPanelOpen(v=>!v)} aria-pressed={panelOpen}
          title="Toggle computer tools">◈ <span>TOOLS</span></button>
      </nav>
      <details className="signal-file-menu computer-project-menu" ref={actionsRef}>
        <summary title="Project and example actions" aria-label="Project actions">⋮</summary>
        <div>
          <strong>PROJECT</strong>
          <button disabled={inBlock} onClick={createNew}>+ NEW BLANK CIRCUIT</button>
          <button disabled={inBlock} onClick={()=>openExample(programmableCpuDemo)}>⌘ LOAD PROGRAMMABLE CASM CPU</button>
          <button disabled={inBlock} onClick={()=>openExample(cpuCoreDemo)}>▣ LOAD CPU DATAPATH</button>
          <button disabled={inBlock} onClick={()=>openExample(counterDemo)}>04 LOAD 4-BIT COUNTER</button>
          <button disabled={inBlock} onClick={()=>openExample(flipFlopDemo)}>◈ LOAD FLIP-FLOP</button>
          <button onClick={exportProject}>⇩ EXPORT PROJECT JSON</button>
          <button disabled={inBlock} onClick={()=>{fileRef.current?.click();closeMenu();}}>
            ⇧ IMPORT PROJECT JSON
          </button>
        </div>
      </details>
      <input type="file" accept=".json,.signal.json,application/json"
        ref={fileRef} hidden onChange={importProject}/>
    </header>

    {inBlock&&<div className="signal-block-navigation" role="navigation"
      aria-label="Editing a computer circuit module">
      <div className="signal-edit-crumbs">
        <span className="signal-edit-tag">▣ INSIDE MODULE</span>
        <span>COMPUTER PROJECT</span>
        {editStack.map((frame,index)=><span key={index} className="signal-edit-crumb">
          <span aria-hidden="true">›</span> {frame.name}
        </span>)}
      </div>
      <div className="signal-edit-actions">
        <button className="signal-edit-cancel" onClick={()=>{
          cancelBlock();setSaveError('');
        }}>← CANCEL / BACK</button>
        <button className="signal-edit-save" onClick={publish}>✓ SAVE BLOCK</button>
      </div>
      {saveError&&<div className="signal-edit-error" role="alert">{saveError}</div>}
    </div>}

    <div className="computer-journey" aria-label="Quick guide">
      <span><b>01</b> WRITE CASM</span>
      <span><b>02</b> ASSEMBLE & LOAD</span>
      <span><b>03</b> STEP THE CPU</span>
      <span className="computer-local-save">● AUTOSAVED ON THIS DEVICE</span>
    </div>
    <div className={'signal-workspace computer-workspace'+
      (!paletteOpen?' signal-no-palette':'')+(!panelOpen?' signal-no-panel':'')}>
      {paletteOpen&&<SignalPalette focus="computer"/>}
      <main className="signal-editor computer-editor">
        <div className="signal-editor-heading">
          <span><i/> {inBlock?'EDITING MODULE':'CIRCUIT CANVAS'}
            <small> / {doc.name.toUpperCase()}</small>
          </span>
          <span className="signal-editor-tags">
            <b>CYCLE {runtime.cycle}</b>
            <b>{result.netCount} NETS</b>
          </span>
        </div>
        <SignalCanvas
          key={editStack.map(frame=>frame.blockId).join('/')||'computer-root'}
          result={result}
          onProbe={()=>{setPanelOpen(true);setTab('scope');}}/>
        <div className="signal-status">
          <span><i/> COMPUTER ENGINE</span>
          <span className="signal-status-message">{message}</span>
          <span>{issues.length?'⚠ '+issues.length+' CIRCUIT ISSUES':'✓ CIRCUIT CHECK'}</span>
        </div>
      </main>
      {panelOpen&&<aside className="signal-right-panel computer-tools-panel">
        <div className="signal-tabs computer-tool-tabs" role="tablist" aria-label="Computer Builder tools">
          {([
            ['code','⌘ CODE'],['run','↯ CLOCK'],['inspect','◈ EDIT'],
            ['scope','〰 GRAPH'],['inputs','101 INPUT'],['check','⚠ CHECK'],
          ] as [ComputerTab,string][]).map(([id,label])=><button
            key={id} role="tab" aria-selected={tab===id}
            className={tab===id?'active':''} onClick={()=>setTab(id)}>{label}</button>)}
        </div>
        <div hidden={tab!=='code'}><CasmProgramPanel active={tab==='code'}/></div>
        {tab==='code'?null:
          tab==='run'?<ComputerPanel doc={doc} result={result}/>:
          tab==='inspect'?<SignalInspector result={result}/>:
          tab==='scope'?<SignalScopePanel doc={doc}/>:
          tab==='inputs'?<SignalVectorPanel doc={doc} result={result}/>:
          <SignalDiagnostics/>}
        <div className="computer-workbench-help">
          <strong>QUICK TIPS</strong>
          <p>Open <b>CODE</b> to assemble CASM and watch instructions execute.
            For the original 4-bit ROM, use <b>EDIT</b>. Use
            <b> FIT</b> on the canvas to view the whole design. Right-click a
            four-bit port to create a bus, and use <b>CHECK</b> to locate wiring
            errors. Double-click custom blocks to edit them. Ctrl/Cmd+Z undoes a change,
            and Ctrl/Cmd+S confirms local autosave; Export JSON makes a backup.</p>
        </div>
      </aside>}
    </div>
  </div>;
}
