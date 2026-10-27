import {useEffect,useMemo,useRef,useState} from 'react';
import type {ChangeEvent} from 'react';
import {SignalCanvas} from './digital/SignalCanvas';
import {SignalPalette} from './digital/SignalPalette';
import {SignalInspector} from './digital/SignalLab';
import {SignalScopePanel,SignalVectorPanel} from './digital/SignalTools';
import {ComputerPanel} from './digital/ComputerPanel';
import {CasmProgramPanel} from './digital/CasmProgramPanel';
import {SignalDiagnostics} from './digital/SignalDiagnostics';
import {diagnoseDigitalCircuit} from './digital/diagnostics';
import {cpuCoreDemo,counterDemo,flipFlopDemo,programmableCpuDemo} from './digital/computerSamples';
import {simulateLogic} from './digital/engine';
import type {DigitalDocument} from './digital/types';
import {useDigitalStore} from './digital/useDigitalStore';

type ComputerView='hardware'|'code';
type HardwareTool='run'|'inspect'|'scope'|'inputs'|'check';

export function ComputerBuilder(){
  const doc=useDigitalStore(s=>s.document);
  const runtime=useDigitalStore(s=>s.runtime);
  const drafts=useDigitalStore(s=>s.casmDrafts);
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
  const focus=useDigitalStore(s=>s.focusIssue);
  const [view,setView]=useState<ComputerView>('hardware');
  const [paletteOpen,setPaletteOpen]=useState(false);
  const [panelOpen,setPanelOpen]=useState(false);
  const [tab,setTab]=useState<HardwareTool>('inspect');
  const [saveError,setSaveError]=useState('');
  const fileRef=useRef<HTMLInputElement>(null);
  const actionsRef=useRef<HTMLDetailsElement>(null);
  const result=useMemo(()=>simulateLogic(doc,runtime),[doc,runtime]);
  const issues=useMemo(()=>diagnoseDigitalCircuit(doc),[doc]);
  const inBlock=editStack.length>0;
  const hasDraft=doc.components.some(c=>c.kind==='rom16x8'&&
    drafts?.[c.id]!==undefined&&drafts[c.id]!==c.source);
  const closeMenu=()=>{if(actionsRef.current)actionsRef.current.open=false;};
  const showTool=(next:HardwareTool)=>{setView('hardware');setTab(next);setPanelOpen(true);};
  const switchView=(target:ComputerView)=>{
    if(target==='code'&&inBlock){
      window.alert('Save or Cancel the open block before entering Code Studio.');return;
    }
    setView(target);
  };
  const viewRomInHardware=(romId?:string)=>{
    setView('hardware');
    if(romId&&doc.components.some(c=>c.id===romId)){
      setTab('inspect');setPanelOpen(true);
      focus({type:'component',id:romId});
    }
  };
  const confirmReplace=()=>window.confirm(
    'Replace this Computer Builder circuit? Export the current project JSON for a backup. '+
    (hasDraft?'Your un-injected CASM drafts will also be cleared.':''));
  const openExample=(make:()=>DigitalDocument)=>{
    if(inBlock){window.alert('Save or cancel your current block first.');return;}
    if(!confirmReplace())return;
    try{
      load(make());reset();closeMenu();
      setView(make===programmableCpuDemo?'code':'hardware');
      setPaletteOpen(false);setPanelOpen(false);
    }catch(error){
      window.alert(error instanceof Error?error.message:'Could not load circuit.');
    }
  };
  const exportProject=()=>{
    const blob=new Blob([JSON.stringify(doc,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const anchor=document.createElement('a');
    anchor.href=url;
    anchor.download=(doc.name.replace(/[^a-z0-9_-]/gi,'-').toLowerCase()||'computer')+
      '.signal.json';
    document.body.appendChild(anchor);anchor.click();anchor.remove();
    URL.revokeObjectURL(url);closeMenu();
  };
  const importProject=async(event:ChangeEvent<HTMLInputElement>)=>{
    const file=event.currentTarget.files?.[0];
    event.currentTarget.value='';
    if(!file||!confirmReplace())return;
    try{
      const imported:unknown=JSON.parse(await file.text());
      load(imported);reset();setView('hardware');
      setPanelOpen(false);setPaletteOpen(false);closeMenu();
    }catch(error){
      window.alert(error instanceof Error?error.message:'Invalid digital circuit JSON.');
    }
  };
  const createNew=()=>{
    if(!confirmReplace())return;
    newCircuit();rename('Untitled computer circuit');reset();
    setPanelOpen(false);setPaletteOpen(true);setView('hardware');closeMenu();
  };
  const publish=()=>{
    try{saveBlock();setSaveError('');}
    catch(error){setSaveError(error instanceof Error?error.message:'Unable to save block.');}
  };
  // The canvas owns keyboard shortcuts. Code Studio leaves the whole keyboard
  // to the textarea, including Ctrl+Enter injection and native text undo.
  useEffect(()=>{
    if(view!=='hardware')return;
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
          useDigitalStore.setState({message:'Project saved in this browser. Export JSON for a backup.'});
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
  },[view]);
  useEffect(()=>{
    if(view==='hardware'&&selection){
      setTab('inspect');setPanelOpen(true);
    }
  },[selection?.type,selection?.id,view]);
  useEffect(()=>{
    if(view==='hardware'&&focusTarget){
      setPanelOpen(true);setTab('inspect');
    }
  },[focusTarget?.nonce,view]);

  return <div className={'signal-lab-shell computer-builder-shell computer-v12-shell view-'+view}>
    <header className="signal-workbench-header computer-builder-header">
      <div className="signal-lab-brand">
        <span className="signal-lab-glyph">▣</span>
        <div><strong>COMPUTER BUILDER</strong><small>LAB 03 / HARDWARE + SOFTWARE</small></div>
      </div>
      <nav className="computer-view-tabs" role="tablist" aria-label="Computer Builder pages">
        <button role="tab" aria-selected={view==='hardware'} className={
          view==='hardware'?'is-current':''}
          onClick={()=>switchView('hardware')}>▣ HARDWARE</button>
        <button role="tab" aria-selected={view==='code'} className={
          view==='code'?'is-current':''}
          onClick={()=>switchView('code')}>
          ⌘ CODE STUDIO {hasDraft&&<span className="computer-draft-indicator" title="A saved CASM draft has not been injected">●</span>}
        </button>
      </nav>
      {view==='hardware'&&<nav className="computer-main-tools" aria-label="Hardware controls">
        <button aria-pressed={paletteOpen} className={paletteOpen?'is-selected':''}
          onClick={()=>setPaletteOpen(v=>!v)} title="Show or hide the parts library">
          ▦ <span>PARTS</span>
        </button>
        <button onClick={undo} disabled={!past} title="Undo (Ctrl/Cmd+Z)">↶</button>
        <button onClick={redo} disabled={!future} title="Redo (Ctrl/Cmd+Shift+Z)">↷</button>
        <button onClick={clock} className="computer-top-step"
          title="Emit one clock edge">↯ <span>STEP</span></button>
        <button onClick={()=>showTool('check')} title="Check circuit connections">
          ⚠ <span>{issues.length}</span>
        </button>
        <button aria-pressed={panelOpen} className={panelOpen?'is-selected':''}
          onClick={()=>setPanelOpen(v=>!v)} title="Show or hide circuit inspector/tools">
          ◈ <span>TOOLS</span>
        </button>
      </nav>}
      <details className="signal-file-menu computer-project-menu" ref={actionsRef}>
        <summary title="Project actions and example circuits" aria-label="Project actions">⋮</summary>
        <div>
          <strong>PROJECT</strong>
          <button disabled={inBlock} onClick={createNew}>+ NEW CIRCUIT</button>
          <button disabled={inBlock} onClick={()=>openExample(programmableCpuDemo)}>
            ⌘ LOAD PROGRAMMABLE CASM CPU
          </button>
          <button disabled={inBlock} onClick={()=>openExample(cpuCoreDemo)}>▣ LOAD CPU DATAPATH</button>
          <button disabled={inBlock} onClick={()=>openExample(counterDemo)}>04 LOAD COUNTER</button>
          <button disabled={inBlock} onClick={()=>openExample(flipFlopDemo)}>◈ LOAD FLIP-FLOP</button>
          <button onClick={exportProject}>⇩ EXPORT CIRCUIT JSON</button>
          <button disabled={inBlock} onClick={()=>{fileRef.current?.click();closeMenu();}}>
            ⇧ IMPORT CIRCUIT JSON
          </button>
        </div>
      </details>
      <input hidden ref={fileRef} type="file" accept=".json,.signal.json,application/json"
        onChange={importProject}/>
    </header>

    {inBlock&&<div className="signal-block-navigation" role="navigation"
      aria-label="Editing a computer circuit module">
      <div className="signal-edit-crumbs">
        <span className="signal-edit-tag">▣ INSIDE MODULE</span>
        <span>COMPUTER PROJECT</span>
        {editStack.map((frame,i)=><span key={i} className="signal-edit-crumb">
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

    {view==='code'?
      <section role="tabpanel" aria-label="Code Studio page" className="computer-studio-page">
        <CasmProgramPanel active onViewHardware={viewRomInHardware}/>
      </section>:
      <section role="tabpanel" aria-label="Hardware design page" className="computer-hardware-page">
        <div className="computer-contextbar">
          <span><b>HARDWARE</b> / {doc.name}</span>
          <span className="computer-context-tip">Click a chip to inspect · Right-click for wiring ·
            use ⊡ FIT to center the circuit</span>
          {hasDraft&&<button title="Saved CASM draft has not been injected"
            onClick={()=>switchView('code')}>● CODE DRAFT NOT INJECTED</button>}
          <span className="computer-local-save">● SAVED LOCALLY</span>
        </div>
        <div className={'signal-workspace computer-workspace'+
          (!paletteOpen?' signal-no-palette':'')+(!panelOpen?' signal-no-panel':'')}>
          {paletteOpen&&<SignalPalette focus="computer"/>}
          <main className="signal-editor computer-editor">
            <div className="signal-editor-heading">
              <span><i/> {inBlock?'EDITING MODULE':'CIRCUIT CANVAS'}</span>
              <span className="signal-editor-tags">
                <b>{doc.components.length} PARTS</b>
                <b>CYCLE {runtime.cycle}</b>
                <b>{result.netCount} NETS</b>
              </span>
            </div>
            <SignalCanvas key={editStack.map(f=>f.blockId).join('/')||'computer-root'}
              result={result} onProbe={()=>showTool('scope')}/>
            <div className="signal-status">
              <span><i/> ENGINE READY</span>
              <span className="signal-status-message">{message}</span>
              <button className="computer-status-check"
                onClick={()=>showTool('check')}>
                {issues.length?'⚠ '+issues.length+' CIRCUIT ISSUES':'✓ CIRCUIT CHECK'}
              </button>
            </div>
          </main>
          {panelOpen&&<aside className="signal-right-panel computer-tools-panel">
            <div className="signal-tabs computer-tool-tabs" role="tablist"
              aria-label="Hardware inspection tools">
              {([
                ['inspect','◈ EDIT'],['run','↯ CLOCK'],
                ['scope','〰 GRAPH'],['inputs','101 INPUT'],['check','⚠ CHECK'],
              ] as [HardwareTool,string][]).map(([id,label])=><button
                role="tab" key={id} aria-selected={tab===id}
                className={tab===id?'active':''}
                onClick={()=>setTab(id)}>{label}</button>)}
            </div>
            {tab==='run'?<ComputerPanel doc={doc} result={result}/>:
              tab==='inspect'?<SignalInspector result={result}/>:
              tab==='scope'?<SignalScopePanel doc={doc}/>:
              tab==='inputs'?<SignalVectorPanel doc={doc} result={result}/>:
              <SignalDiagnostics/>}
          </aside>}
        </div>
      </section>}
  </div>;
}
