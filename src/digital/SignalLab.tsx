import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import { SignalCanvas } from './SignalCanvas';
import {
  DigitalDocument, DigitalKind, LogicValue, digitalKinds,
  digitalLabel, pinsOf, initialDigitalCircuit,
} from './types';
import { simulateLogic, generateTruthTable, TruthTable } from './engine';
import { useDigitalStore } from './useDigitalStore';
import { andDemo, halfAdderDemo, notDemo } from './samples';
import { SignalScopePanel, SignalVectorPanel } from './SignalTools';

const groups: { heading: string; entries: { kind: DigitalKind; icon: string; label: string; detail: string }[] }[] = [
  { heading: '01 / INPUT & OUTPUT', entries: [
    {kind:'input',icon:'▣',label:'INPUT SWITCH',detail:'Click to toggle 0/1'},
    {kind:'led',icon:'◉',label:'NEON LED',detail:'Live output display'},
  ]},
  { heading: '02 / BASIC GATES', entries: [
    {kind:'and',icon:'∧',label:'AND',detail:'A · B'},
    {kind:'or',icon:'∨',label:'OR',detail:'A + B'},
    {kind:'not',icon:'¬',label:'NOT',detail:'Invert A'},
    {kind:'xor',icon:'⊕',label:'XOR',detail:'A ⊕ B'},
  ]},
  { heading: '03 / ADVANCED GATES', entries: [
    {kind:'nand',icon:'⊼',label:'NAND',detail:'NOT (A · B)'},
    {kind:'nor',icon:'⊽',label:'NOR',detail:'NOT (A + B)'},
    {kind:'xnor',icon:'⊙',label:'XNOR',detail:'Equal inputs'},
    {kind:'buffer',icon:'▷',label:'BUFFER',detail:'Pass A through'},
  ]},
];
const samples = [
  { label: 'XOR PLAYGROUND', document: initialDigitalCircuit },
  { label: 'AND GATE LAB', document: andDemo },
  { label: 'NOT GATE LAB', document: notDemo },
  { label: 'HALF ADDER', document: halfAdderDemo },
];
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
function SignalPalette() {
  const add = useDigitalStore(s=>s.add);
  const load = useDigitalStore(s=>s.load);
  const count = useDigitalStore(s=>s.document.components.length);
  const library = useDigitalStore(s=>s.blockLibrary);
  const capture = useDigitalStore(s=>s.captureAsBlock);
  const placeBlock = useDigitalStore(s=>s.addSavedBlock);
  const circuitName = useDigitalStore(s=>s.document.name);
  const [blockName,setBlockName] = useState('MY LOGIC BLOCK');
  const [blockError,setBlockError] = useState('');
  const saveBlock = () => {
    try {capture(blockName);setBlockError('');setBlockName(circuitName.replace(/ · BLOCK$/, '')+' MODULE');}
    catch(e){setBlockError(e instanceof Error?e.message:'Unable to capture this circuit.');}
  };
  const drag = (event: DragEvent<HTMLButtonElement>, kind: DigitalKind) => {
    event.dataTransfer.setData('application/x-signal-kind',kind);
    event.dataTransfer.effectAllowed = 'copy';
  };
  return (
    <aside className="signal-palette">
      <div className="signal-panel-heading">▦ LOGIC COMPONENTS <span>/ 10</span></div>
      {groups.map(group=><div className="signal-palette-group" key={group.heading}>
        <div className="signal-section-label">{group.heading}</div>
        <div className="signal-palette-grid">
          {group.entries.map(item=>
            <button key={item.kind} draggable
              title={'Drag onto canvas or click to place ' + item.label}
              onDragStart={e=>drag(e,item.kind)}
              onClick={()=>{
                const offset=count%6;
                add(item.kind,{x:240+offset*72,y:192+offset*48});
              }} className={'signal-palette-item kind-'+item.kind}>
              <span className="signal-palette-glyph">{item.icon}</span>
              <span className="signal-palette-words"><strong>{item.label}</strong>
                <small>{item.detail}</small></span>
              <span className="signal-plus">+</span>
            </button>
          )}
        </div>
      </div>)}
      <section className="signal-block-library">
        <div className="signal-section-label">04 / REUSABLE CIRCUIT BLOCKS</div>
        <details className="signal-block-creator">
          <summary>▣ CAPTURE CURRENT CIRCUIT <span>▸</span></summary>
          <p>INPUT switches become input ports. LED outputs become output ports.
            The circuit collapses into a single reusable module; undo restores it.</p>
          <label htmlFor="signal-new-block-name">MODULE NAME</label>
          <input id="signal-new-block-name" maxLength={40} value={blockName}
            onChange={e=>setBlockName(e.target.value)}/>
          <button onClick={saveBlock}>✦ SAVE AS BLOCK</button>
          {blockError&&<p className="signal-block-error" role="alert">{blockError}</p>}
        </details>
        <div className="signal-saved-block-list">
          {library.length===0&&<p className="signal-block-empty">No modules saved yet.</p>}
          {library.map(def=><button key={def.id} draggable
            onDragStart={event=>{
              event.dataTransfer.setData('application/x-signal-block',def.id);
              event.dataTransfer.effectAllowed='copy';
            }}
            title={'Click to insert '+def.name+' or drag it onto the canvas'}
            onClick={()=>{
              try {placeBlock(def.id,{x:384+count%3*120,y:252+count%4*72});setBlockError('');}
              catch(error){setBlockError(error instanceof Error?error.message:'Block failed to load.');}
            }}>
            <span className="saved-block-glyph">▣</span>
            <span><strong>{def.name}</strong>
              <small>{def.inputs.length} IN / {def.outputs.length} OUT</small></span>
            <span className="saved-block-plus">+</span>
          </button>)}
        </div>
      </section>
      <details className="signal-presets">
        <summary>◇ SAMPLE CIRCUITS <span>▸</span></summary>
        {samples.map(preset=><button key={preset.label}
          onClick={()=>load(preset.document())}>✦ {preset.label}</button>)}
      </details>
      <div className="signal-palette-tip">✦ WIRE HIGH = MINT · LOW = DIM BLUE · X = MAGENTA</div>
    </aside>
  );
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
          <div className="signal-selected-sprite">{part.kind==='input'?'▣':part.kind==='led'?'◉':'◇'}</div>
          <div><strong>{digitalLabel(part,doc.components)}</strong><small>{part.kind.toUpperCase()}</small></div>
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
        <div className="signal-pin-list">
          <div className="signal-section-label">LIVE TERMINALS</div>
          {pinsOf(part).map(pin=><div className="signal-readout" key={pin}>
            <span>{pin.toUpperCase()} {pin==='out'?'→':'←'}</span>
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
    wires: doc.wires,
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
  const gates = doc.components.filter(c=>digitalKinds.includes(c.kind) && c.kind!=='input' && c.kind!=='led');
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
        <div><strong>SIGNAL LAB</strong><small>LAB 02 / DIGITAL LOGIC v0.2</small></div></div>
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
          <button onClick={()=>{if(window.confirm('Create an empty Signal Lab circuit? You can undo.'))newCircuit();close();}}>+ NEW SIGNAL CIRCUIT</button>
          <button onClick={()=>{load(initialDigitalCircuit());close();}}>◇ LOAD DEMO</button>
          <button onClick={()=>{downloadSignal(doc);close();}}>⇩ EXPORT .SIGNAL.JSON</button>
          <button onClick={()=>{fileRef.current?.click();close();}}>⇧ IMPORT SIGNAL JSON</button>
        </div>
      </details>
      <input ref={fileRef} type="file" accept=".json,.signal.json,application/json"
        hidden onChange={importFile}/>
    </header>
    <div className={'signal-workspace'+(!paletteOpen?' signal-no-palette':'')+
      (!panelOpen?' signal-no-panel':'')}>
      {paletteOpen && <SignalPalette/>}
      <main className="signal-editor">
        <div className="signal-editor-heading">
          <span><i/> DIGITAL SCHEMATIC <small>/ {doc.name.toUpperCase()}</small></span>
          <span className="signal-editor-tags"><b>{gates.length} GATES</b><b>{doc.wires.length} NETS</b></span>
        </div>
        <SignalCanvas result={result} onProbe={()=>{setPanelOpen(true);setTab('scope');}}/>
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
          <p>Signal colors: green = HIGH (1), blue = LOW (0), pink = undefined (X), gray = undriven (Z).</p>
          <p>Save a complete circuit as a block from the Parts Library. Probe any wire or pin with right-click; use INPUT TEST for binary vectors and SCOPE to inspect event history.</p>
        </details>
      </aside>}
    </div>
  </div>;
}
