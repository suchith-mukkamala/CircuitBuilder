import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { SignalCanvas } from './SignalCanvas';
import {
  DigitalDocument, LogicValue, gateKinds, GateKind,
  digitalLabel, pinsOf, isOutput, initialDigitalCircuit,
} from './types';
import { simulateLogic, generateTruthTable, TruthTable } from './engine';
import { useDigitalStore } from './useDigitalStore';
import { SignalPalette } from './SignalPalette';
import { partByKind } from './catalog';
import { SignalScopePanel, SignalVectorPanel } from './SignalTools';

const logicTone = (v: LogicValue | undefined) => v === 1 ? 'high' : v === 0 ? 'low'
  : v === 'X' ? 'unknown' : 'floating';

function LogicChip({ value }: { value: LogicValue | undefined }) {
  return <span className={'logic-chip logic-' + logicTone(value)}>
    {value === undefined ? 'Z' : value === 'X' ? 'X' : value === 'Z' ? 'Z' : String(value)}
  </span>;
}

function downloadSignal(doc: DigitalDocument) {
  const data = new Blob([JSON.stringify(doc, null, 2)],{ type:'application/json' });
  const url = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url;
  link.download = (doc.name.replace(/[^a-z0-9_-]/gi, '-').toLowerCase() || 'signal') + '.signal.json';
  document.body.appendChild(link); link.click(); link.remove();
  URL.revokeObjectURL(url);
}
function SignalInspector({ result }: { result: ReturnType<typeof simulateLogic> }) {
  const doc = useDigitalStore(s=>s.document);
  const selected = useDigitalStore(s=>s.selection);
  const selectedIds = useDigitalStore(s=>s.selectedIds);
  const toggle = useDigitalStore(s=>s.toggleInput);
  const rename = useDigitalStore(s=>s.setName);
  const rotate = useDigitalStore(s=>s.rotate);
  const remove = useDigitalStore(s=>s.remove);
  const copy = useDigitalStore(s=>s.copy);
  const duplicate = useDigitalStore(s=>s.duplicate);
  const openBlock = useDigitalStore(s=>s.openBlock);
  const part = selected?.type==='component' ? doc.components.find(c=>c.id===selected.id) : null;
  const wire = selected?.type==='wire' ? doc.wires.find(w=>w.id===selected.id) : null;
  const [draft,setDraft] = useState('');
  useEffect(() => { setDraft(part?.name??''); }, [part?.id,part?.name]);
  return (
    <div className="signal-inspect-panel">
      <div className="signal-panel-heading">◈ SIGNAL INSPECTOR <span>/ EDIT</span></div>
      {part ? <div className="signal-inspect-body">
        {selectedIds.length>1 && <div className="signal-multiselect">
          ▣ {selectedIds.length} PARTS SELECTED
          <div><button onClick={copy}>COPY</button><button onClick={duplicate}>DUPLICATE</button>
            <button onClick={remove}>DELETE ALL</button></div>
        </div>}
        <div className="signal-selected">
          <div className="signal-selected-sprite">{part.kind==='block'?'▣':
            partByKind[part.kind]?.glyph??'◇'}</div>
          <div><strong>{digitalLabel(part,doc.components)}</strong>
            <small>{part.kind==='block'?'REUSABLE MODULE':partByKind[part.kind]?.name??part.kind.toUpperCase()}</small>
          </div>
        </div>
        <label className="signal-field-label" htmlFor="signal-component-name">DISPLAY LABEL</label>
        <input id="signal-component-name" className="signal-text-field" value={draft}
          maxLength={28} placeholder={digitalLabel({...part,name:undefined},doc.components)}
          onChange={e=>setDraft(e.target.value)}
          onBlur={()=>{if(draft !== (part.name??''))rename(part.id,draft);}}
          onKeyDown={e=>{if(e.key==='Enter')e.currentTarget.blur();}}/>
        {part.kind==='input' && <div className="signal-input-control">
          <span>INPUT STATE</span>
          <button className={part.bit===1?'high':'low'} onClick={()=>toggle(part.id)}>
            {part.bit===1?'● HIGH / 1':'○ LOW / 0'}
          </button>
          <small>Click this button or the pixel switch on canvas.</small>
        </div>}
        {part.kind==='block'&&<div className="signal-block-inspect">
          <strong>▣ REUSABLE MODULE</strong>
          <p>Logic inside this block is simulated independently in each instance.</p>
          <small>{doc.blocks?.find(def=>def.id===part.blockId)?.circuit.components.length??0} internal components</small>
          <button className="signal-open-block" onClick={()=>{
            try { openBlock(part.id); }
            catch(error){window.alert(error instanceof Error?error.message:'Unable to open block.');}
          }}>▣ OPEN & EDIT BLOCK</button>
          <small>Or double-click this block on the canvas.</small>
        </div>}
        <div className="signal-pin-list">
          <div className="signal-section-label">LIVE TERMINALS</div>
          {pinsOf(part).map(pin=><div className="signal-readout" key={pin}>
            <span>{part.kind==='block'
              ? doc.blocks?.find(d=>d.id===part.blockId)?.[
                  part.ports?.inputs.includes(pin)?'inputs':'outputs']
                  .find(port=>port.pin===pin)?.label??pin
              :pin.toUpperCase()} {isOutput(part,pin)?'→':'←'}</span>
            <LogicChip value={result.terminalValues[part.id+':'+pin]}/>
          </div>)}
        </div>
        {part.kind==='led' && <div className="signal-led-banner">
          <span className={'signal-led-pulse '+logicTone(result.ledValues[part.id])}></span>
          OUTPUT <LogicChip value={result.ledValues[part.id]}/>
        </div>}
        <div className="signal-readout"><span>POSITION</span><strong>{part.x} · {part.y}</strong></div>
        <div className="signal-readout"><span>ROTATION</span><strong>{part.rotation}°</strong></div>
        <div className="signal-inspector-actions">
          <button onClick={()=>rotate(part.id)}>↻ ROTATE</button>
          <button onClick={duplicate}>⊞ DUPLICATE</button>
          <button className="danger" onClick={remove}>× DELETE</button>
        </div>
      </div> : wire ? <div className="signal-inspect-body">
        <div className="signal-selected"><div className="signal-selected-sprite">⌁</div>
          <div><strong>WIRE</strong><small>SIGNAL CONNECTION</small></div></div>
        <div className="signal-readout"><span>STATE</span><LogicChip value={result.wireValues[wire.id]}/></div>
        <p className="signal-inspector-note">Use right-click on a wire to create a branch or delete it.</p>
        <button className="signal-delete-button" onClick={remove}>× DELETE WIRE</button>
      </div> : <div className="signal-inspect-empty">
        <span>⌖</span><strong>SELECT A COMPONENT</strong>
        <p>Inspect a gate, toggle an input, rename a signal, or follow connected wires.</p>
      </div>}
      {!!result.warnings.length && <div className="signal-warnings">
        <div className="signal-section-label">⚠ SIGNAL DIAGNOSTICS</div>
        {result.warnings.slice(0,8).map((warning,i)=><p key={i}>{warning}</p>)}
        {result.warnings.length>8 && <p>+{result.warnings.length-8} additional warnings</p>}
      </div>}
    </div>
  );
}

function SignalTruthPanel({ doc, result }: {
  doc: DigitalDocument; result: ReturnType<typeof simulateLogic>;
}) {
  const [table, setTable] = useState<TruthTable|null>(null);
  const [error, setError] = useState('');
  const [generatedFor, setGeneratedFor] = useState('');
  // A truth table is a snapshot: recompute when the topology changes
  // (but not for every input toggle, since all rows cover both values).
  const shape = JSON.stringify({
    components: doc.components.map(c=>[c.id,c.kind,c.name,c.rotation,c.x,c.y]),
    wires: doc.wires, blocks: doc.blocks,
  });
  useEffect(()=>{setTable(null);setGeneratedFor('');},[shape]);
  const generate = () => {
    try { setTable(generateTruthTable(doc)); setError(''); setGeneratedFor(doc.name); }
    catch (err) {setTable(null);setError(err instanceof Error?err.message:'Cannot build truth table.');}
  };
  const inputs = doc.components.filter(c=>c.kind==='input');
  const outputs = doc.components.filter(c=>c.kind==='led');
  return <div className="signal-truth-panel">
    <div className="signal-panel-heading">▦ TRUTH TABLE <span>/ BOOLEAN</span></div>
    <div className="signal-truth-intro">
      Automatically evaluate every input combination using the digital engine.
      Supports up to six switches (64 rows).
    </div>
    <div className="signal-truth-summary">
      <div><strong>{inputs.length}</strong><small>INPUTS</small></div>
      <div><strong>{outputs.length}</strong><small>OUTPUT LEDs</small></div>
      <div><strong>{inputs.length<=6?(1<<inputs.length):'—'}</strong><small>COMBINATIONS</small></div>
    </div>
    <button className="signal-generate" onClick={generate}>▶ GENERATE TRUTH TABLE</button>
    {error && <div role="alert" className="signal-truth-error">{error}</div>}
    {table && <div className="signal-table-scroll" role="region" aria-label="Digital circuit truth table">
      <div className="signal-table-caption">{generatedFor} · FULL EVALUATION</div>
      <table className="signal-truth-table">
        <thead><tr>
          {table.inputs.map(input=><th key={input.id}>{digitalLabel(input,doc.components)}</th>)}
          {table.outputs.map(output=><th key={output.id}>{digitalLabel(output,doc.components)}</th>)}
        </tr></thead>
        <tbody>{table.rows.map((row,i)=><tr key={i}>
          {row.inputs.map((value,j)=><td key={'i'+j}>{value}</td>)}
          {row.outputs.map((value,j)=><td key={'o'+j}>
            <LogicChip value={value}/>
          </td>)}
        </tr>)}</tbody>
      </table>
    </div>}
    <div className="signal-truth-live">
      <div className="signal-section-label">CURRENT INPUT SNAPSHOT</div>
      {inputs.map(c=><div className="signal-readout" key={c.id}><span>{digitalLabel(c,doc.components)}</span>
        <LogicChip value={c.bit??0}/></div>)}
      {outputs.map(c=><div className="signal-readout" key={c.id}><span>{digitalLabel(c,doc.components)}</span>
        <LogicChip value={result.ledValues[c.id]}/></div>)}
    </div>
  </div>;
}

export function SignalLab() {
  const fileRef = useRef<HTMLInputElement>(null);
  const fileMenu = useRef<HTMLDetailsElement>(null);
  const doc = useDigitalStore(s=>s.document);
  const message = useDigitalStore(s=>s.message);
  const editStack = useDigitalStore(s=>s.editStack);
  const saveBlockEdit = useDigitalStore(s=>s.saveBlockEdit);
  const cancelBlockEdit = useDigitalStore(s=>s.cancelBlockEdit);
  const [blockSaveError,setBlockSaveError]=useState('');
  const inBlock = editStack.length>0;
  const saveInternal = () => {
    try {saveBlockEdit();setBlockSaveError('');}
    catch(error){setBlockSaveError(error instanceof Error?error.message:'Could not save this block.');}
  };
  const selectedIds = useDigitalStore(s=>s.selectedIds);
  const past = useDigitalStore(s=>s.past.length);
  const future = useDigitalStore(s=>s.future.length);
  const undo = useDigitalStore(s=>s.undo);
  const redo = useDigitalStore(s=>s.redo);
  const copy = useDigitalStore(s=>s.copy);
  const paste = useDigitalStore(s=>s.paste);
  const newCircuit = useDigitalStore(s=>s.newCircuit);
  const load = useDigitalStore(s=>s.load);
  const rename = useDigitalStore(s=>s.renameDocument);
  const [paletteOpen,setPaletteOpen] = useState(true);
  const [panelOpen,setPanelOpen] = useState(true);
  const [tab,setTab] = useState<'inspect'|'truth'|'scope'|'vector'>('inspect');
  const result = useMemo(()=>simulateLogic(doc),[doc]);
  const gates = doc.components.filter(c=>gateKinds.includes(c.kind as GateKind)||c.kind==='block');
  useEffect(()=>{
    const handle=(e:KeyboardEvent)=>{
      const target=e.target as HTMLElement|null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      const mod=e.ctrlKey||e.metaKey, key=e.key.toLowerCase();
      const store=useDigitalStore.getState();
      if (mod) {
        if (key==='z') {e.preventDefault();if(e.shiftKey)store.redo();else store.undo();}
        if (key==='y') {e.preventDefault();store.redo();}
        if (key==='c') {e.preventDefault();store.copy();}
        if (key==='v') {e.preventDefault();store.paste();}
        if (key==='d') {e.preventDefault();store.duplicate();}
        if (key==='a') {e.preventDefault();store.selectAll();}
        if (key==='s') {e.preventDefault();useDigitalStore.setState({message:'Signal circuit autosaved to browser.'});}
        return;
      }
      if (e.key==='Escape') store.cancelWire();
      if (e.key==='Delete'||e.key==='Backspace') store.remove();
      if (key==='r' && store.selection?.type==='component') store.rotate(store.selection.id);
      if (e.code==='Space' && store.selection?.type==='component') {
        const c=store.document.components.find(c=>c.id===store.selection?.id);
        if(c?.kind==='input'){e.preventDefault();store.toggleInput(c.id);}
      }
    };
    window.addEventListener('keydown',handle);
    return ()=>window.removeEventListener('keydown',handle);
  },[]);
  const importFile=async(e:ChangeEvent<HTMLInputElement>)=>{
    const f=e.target.files?.[0];
    if(!f)return;
    try {load(JSON.parse(await f.text()));}
    catch(error){window.alert(error instanceof Error?error.message:'Invalid signal file.');}
    e.currentTarget.value='';
  };
  const close=()=>{if(fileMenu.current)fileMenu.current.open=false;};
  return <div className="signal-lab-shell">
    <header className="signal-workbench-header">
      <div className="signal-lab-brand"><span className="signal-lab-glyph">▧</span>
        <div><strong>SIGNAL LAB</strong><small>LAB 02 / DIGITAL LOGIC v0.4</small></div></div>
      <input aria-label="Signal circuit name" className="signal-circuit-title"
        title="Rename circuit" value={doc.name} onChange={e=>rename(e.target.value)}/>
      <nav className="signal-toolbar" aria-label="Signal Lab actions">
        <button aria-pressed={paletteOpen} className={paletteOpen?'active':''}
          onClick={()=>setPaletteOpen(v=>!v)} title="Toggle component library">▦ <span>PARTS</span></button>
        <button disabled={!past} onClick={undo} title="Undo">↶ <span>UNDO</span></button>
        <button disabled={!future} onClick={redo} title="Redo">↷ <span>REDO</span></button>
        <button disabled={!selectedIds.length} onClick={copy} title="Copy selection">▣ <span>COPY</span></button>
        <button onClick={paste} title="Paste copied selection">⊞ <span>PASTE</span></button>
        <button className="signal-instrument-button" onClick={()=>{
          setPanelOpen(true);setTab('vector');
        }}>101 <span>INPUT TEST</span></button>
        <button className="signal-instrument-button" onClick={()=>{
          setPanelOpen(true);setTab('scope');
        }}>〰 <span>WAVEFORM</span></button>
        <button className="truth-shortcut" onClick={()=>{
          setPanelOpen(true);setTab('truth');
        }}>▦ <span>TRUTH TABLE</span></button>
        <button className={panelOpen?'active':''} onClick={()=>setPanelOpen(v=>!v)}>◈ <span>PANEL</span></button>
      </nav>
      <details className="signal-file-menu" ref={fileMenu}>
        <summary title="Signal file actions">⋮</summary>
        <div>
          <button disabled={inBlock} title={inBlock?'Save or cancel block editing first':'New circuit'}
            onClick={()=>{if(window.confirm('Create an empty Signal Lab circuit? You can undo.'))newCircuit();close();}}>+ NEW SIGNAL CIRCUIT</button>
          <button disabled={inBlock} onClick={()=>{load(initialDigitalCircuit());close();}}>◇ LOAD DEMO</button>
          <button onClick={()=>{downloadSignal(doc);close();}}>⇩ EXPORT .SIGNAL.JSON</button>
          <button disabled={inBlock} onClick={()=>{fileRef.current?.click();close();}}>⇧ IMPORT SIGNAL JSON</button>
        </div>
      </details>
      <input ref={fileRef} type="file" accept=".json,.signal.json,application/json"
        hidden onChange={importFile}/>
    </header>
    {inBlock && <div className="signal-block-navigation" role="navigation"
      aria-label="Internal module editing">
      <div className="signal-edit-crumbs">
        <span className="signal-edit-tag">▣ EDITING MODULE</span>
        <span>ROOT CIRCUIT</span>
        {editStack.map((frame,i)=><span className="signal-edit-crumb" key={i}>
          <span aria-hidden="true">›</span> {frame.name}
        </span>)}
        <small>Edits are drafts until saved.</small>
      </div>
      <div className="signal-edit-actions">
        <button className="signal-edit-cancel" onClick={()=>{
          cancelBlockEdit();setBlockSaveError('');
        }}>← CANCEL / BACK</button>
        <button className="signal-edit-save" onClick={saveInternal}>✓ SAVE BLOCK</button>
      </div>
      {!!blockSaveError&&<div className="signal-edit-error" role="alert">{blockSaveError}</div>}
    </div>}
    <div className={'signal-workspace'+(!paletteOpen?' signal-no-palette':'')+
      (!panelOpen?' signal-no-panel':'')}>
      {paletteOpen && <SignalPalette/>}
      <main className="signal-editor">
        <div className="signal-editor-heading">
          <span><i/> {inBlock ? 'MODULE INTERNALS' : 'DIGITAL SCHEMATIC'}
            <small>/ {doc.name.toUpperCase()}</small></span>
          <span className="signal-editor-tags"><b>{gates.length} LOGIC PARTS</b>
            <b>{result.netCount} NETS</b></span>
        </div>
        <SignalCanvas key={editStack.map(e=>e.blockId).join('/') || 'root'}
          result={result} onProbe={()=>{setPanelOpen(true);setTab('scope');}}/>
        <div className="signal-status">
          <span><i/> LIVE LOGIC</span><span className="signal-status-message">{message}</span>
          <span>{result.warnings.length?'⚠ '+result.warnings.length+' ISSUES':'✓ NO SIGNAL WARNINGS'}</span>
        </div>
      </main>
      {panelOpen && <aside className="signal-right-panel">
        <div className="signal-tabs" role="tablist" aria-label="Signal Lab panels">
          <button role="tab" aria-selected={tab==='inspect'}
            className={tab==='inspect'?'active':''} onClick={()=>setTab('inspect')}>◈ INSPECT</button>
          <button role="tab" aria-selected={tab==='truth'}
            className={tab==='truth'?'active':''} onClick={()=>setTab('truth')}>▦ TRUTH</button>
          <button role="tab" aria-selected={tab==='scope'}
            className={tab==='scope'?'active':''} onClick={()=>setTab('scope')}>〰 SCOPE</button>
          <button role="tab" aria-selected={tab==='vector'}
            className={tab==='vector'?'active':''} onClick={()=>setTab('vector')}>101 TEST</button>
        </div>
        {tab==='inspect' ? <SignalInspector result={result}/> :
          tab==='truth' ? <SignalTruthPanel doc={doc} result={result}/> :
          tab==='scope' ? <SignalScopePanel doc={doc}/> :
          <SignalVectorPanel doc={doc} result={result}/>}
        <details className="signal-help">
          <summary>⌘ SHORTCUTS & HELP</summary>
          <p>Click an INPUT to flip its bit. Wire pins by clicking the first pin and then another.</p>
          <p>Right-click any part to rotate, copy or delete. Drag blank canvas to pan.</p>
          <p>Shift-click to multi-select; Ctrl/Cmd+Z undo, C copy, V paste, D duplicate, A select all.</p>
          <p>Press / when the Parts Library is visible to search for a component. ★ favorites and Recent shortcuts are saved locally. Fold categories to reclaim space.</p>
          <p>Signal colors: green = HIGH (1), blue = LOW (0), pink = undefined (X), gray = undriven (Z).</p>
          <p>Save a complete circuit as a block from the Parts Library. Probe any wire or pin with right-click; use INPUT TEST for binary vectors and SCOPE to inspect event history.</p>
          <p>Double-click a reusable block to edit its internals. SAVE BLOCK updates all instances. CANCEL/BACK discards internal changes. Keep original INPUT and LED boundary components to preserve connected ports.</p>
        </details>
      </aside>}
    </div>
  </div>;
}
