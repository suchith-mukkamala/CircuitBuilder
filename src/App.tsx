import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { Palette } from './components/Palette';
import { CircuitCanvas } from './components/CircuitCanvas';
import { Inspector, SimulationPanel } from './components/Inspector';
import { TransientPanel } from './components/TransientPanel';
import { starterCircuit } from './circuit/sample';
import { useCircuitStore } from './state/useCircuitStore';
import {LabGuide} from './workbench/LabGuide';
import {useWorkbenchLayout} from './workbench/useWorkbenchLayout';
import {ProjectShelf} from './workbench/ProjectShelf';
import {GuidedProject} from './workbench/GuidedProject';
import {PanelResizer,usePanelWidths} from './workbench/PanelResizer';
import {analogMeasurement,type AnalogTarget} from './editor/measurements';
import {SaveIndicator} from './workbench/SaveIndicator';

function downloadCircuit() {
  const doc = useCircuitStore.getState().document;
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = (doc.name.replace(/[^a-z0-9_-]/gi, '-').toLowerCase() || 'circuit') + '.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

type RightTab = 'inspect' | 'simulate';

export function App() {
  const fileInput = useRef<HTMLInputElement>(null);
  const fileMenu = useRef<HTMLDetailsElement>(null);
  const {partsOpen:showLibrary,toolsOpen:showRight,setParts:setShowLibrary,
    setTools:setShowRight,focused,toggleFocus}=useWorkbenchLayout('analog');
  const [rightTab, setRightTab] = useState<RightTab>('inspect');
  const panelWidths=usePanelWidths('analog');
  const [probeTarget,setProbeTarget]=useState<AnalogTarget|null>(null);
  const [lesson,setLesson]=useState({loaded:false,solved:false,probed:false,changed:false});
  const circuit = useCircuitStore(s => s.document);
  const rename = useCircuitStore(s => s.rename);
  const save = useCircuitStore(s => s.save);
  const load = useCircuitStore(s => s.loadDocument);
  const fresh = useCircuitStore(s => s.newCircuit);
  const remove = useCircuitStore(s => s.removeSelection);
  const cancel = useCircuitStore(s => s.cancelWire);
  const rotate = useCircuitStore(s => s.rotateComponent);
  const toggleSwitch = useCircuitStore(s => s.toggleSwitch);
  const selection = useCircuitStore(s => s.selection);
  const selectedIds = useCircuitStore(s => s.selectedIds);
  const past = useCircuitStore(s => s.past.length);
  const future = useCircuitStore(s => s.future.length);
  const undo = useCircuitStore(s => s.undo);
  const redo = useCircuitStore(s => s.redo);
  const copy = useCircuitStore(s => s.copySelection);
  const paste = useCircuitStore(s => s.pasteClipboard);
  const duplicate = useCircuitStore(s => s.duplicateSelection);
  const selectAll = useCircuitStore(s => s.selectAll);
  const pendingPin = useCircuitStore(s => s.pendingPin);
  const message = useCircuitStore(s => s.message);
  const simulation = useCircuitStore(s => s.simulation);
  const runDC = useCircuitStore(s => s.simulate);
  const runTransient = useCircuitStore(s => s.simulateTransient);
  useEffect(()=>{
    if(!lesson.loaded||!simulation)return;
    const resistor=circuit.components.find(c=>c.id==='r2'&&c.kind==='resistor');
    const node=simulation.terminalNodes['r2:a'];
    const voltage=simulation.nodeVoltages[node];
    const point=probeTarget?analogMeasurement(circuit,simulation,probeTarget):null;
    setLesson(old=>{
      const next={...old,solved:old.solved||(resistor?.value===1000&&Math.abs(voltage-5)<1e-6),
        probed:old.probed||(point?.kind==='node'&&point.node===node&&Math.abs(voltage-5)<1e-6),
        changed:old.changed||(resistor?.value===2000&&Math.abs(voltage-20/3)<1e-6)};
      return JSON.stringify(next)===JSON.stringify(old)?old:next;
    });
  },[simulation,circuit,probeTarget,lesson.loaded]);

  const run = (kind: 'dc' | 'transient') => {
    if (kind === 'dc') runDC();
    else runTransient();
    setShowRight(true);
    setRightTab('simulate');
  };
  const closeFileMenu = () => { if (fileMenu.current) fileMenu.current.open = false; };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = !!target?.closest('input, textarea, select, button, a, summary, [contenteditable="true"]');
      const command = e.ctrlKey || e.metaKey;
      if (command && e.key.toLowerCase() === 's') {
        e.preventDefault(); save(); return;
      }
      if (typing) return;
      const key = e.key.toLowerCase();
      if (command) {
        switch (key) {
          case 'z':
            e.preventDefault();
            if (e.shiftKey) redo(); else undo();
            return;
          case 'y': e.preventDefault(); redo(); return;
          case 'c': e.preventDefault(); copy(); return;
          case 'v': e.preventDefault(); paste(); return;
          case 'd': e.preventDefault(); duplicate(); return;
          case 'a': e.preventDefault(); selectAll(); return;
          default: break;
        }
      }
      if (e.key === 'Escape') cancel();
      if (e.key === 'Delete' || e.key === 'Backspace') remove();
      if (key === 'r' && selection?.type === 'component') rotate(selection.id);
      if (e.code === 'Space' && selection?.type === 'component') {
        const part = useCircuitStore.getState().document.components.find(c => c.id === selection.id);
        if (part?.kind === 'switch') { e.preventDefault(); toggleSwitch(part.id); }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selection, undo, redo, copy, paste, duplicate, selectAll, remove, rotate, toggleSwitch, cancel, save]);

  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.currentTarget.value = '';
    if (!file) return;
    try { load(JSON.parse(await file.text())); }
    catch (error) { window.alert(error instanceof Error ? error.message : 'Could not import circuit.'); }
  };

  return (
    <div className="app-shell polished-shell">
      <LabGuide number="01" title="Analog circuits" description="Explore voltage, current, and the components in between."
        steps={[
          {title:'Start with a circuit',detail:'Open Parts to place components, or load an instant lab from the library.'},
          {title:'Connect and inspect',detail:'Click two terminals to wire them. Select a component to edit its value in the inspector.'},
          {title:'See what happens',detail:'Run DC for steady-state readings. Run RLC for a capacitor or inductor response over time.'},
        ]}/>
      <GuidedProject title="Your first voltage divider" description="Two equal resistors share a 10 V supply. Predict the midpoint voltage, measure it, then change the ratio."
        onStart={()=>{if(!window.confirm('Load the guided voltage divider? Save a project copy first to keep your working circuit.'))return false;
          load(starterCircuit());setProbeTarget(null);setLesson({loaded:true,solved:false,probed:false,changed:false});return true;}}
        steps={[
          {title:'Make a prediction',detail:'R1 and R2 are both 1 kΩ. The midpoint should be 10 × R2 / (R1 + R2) = 5 V.',complete:lesson.loaded},
          {title:'Solve the circuit',detail:'Run DC to calculate voltages and branch currents. Results are invalidated whenever the circuit changes.',complete:lesson.solved,action:()=>run('dc'),actionLabel:'Run DC'},
          {title:'Measure the midpoint',detail:'Choose Inspect points on the canvas. Click R2 pin A or the wire between R1 and R2; it should read 5 V to ground.',complete:lesson.probed},
          {title:'Change the ratio',detail:'Select R2, change its resistance to 2k, then run DC again. The midpoint should rise to about 6.67 V.',complete:lesson.changed,
            action:()=>{useCircuitStore.getState().select({type:'component',id:'r2'});setShowRight(true);setRightTab('inspect');},actionLabel:'Select R2'},
        ]}/>
      <header className="topbar polished-topbar">
        <div className="brand">
          <span className="brand-chip"><span className="chip-center">▣</span></span>
          <div className="brand-name">ANALOG <small>WORKBENCH</small></div>
        </div>
        <div className="file-name polished-filename">
          <span className="folder-icon">▰</span>
          <input aria-label="Circuit name" title="Rename circuit" value={circuit.name} maxLength={90}
            onChange={e => rename(e.target.value)} />
        </div>
        <nav className="workbench-tools" aria-label="Editor toolbar">
          <button className={'workbench-tool ' + (showLibrary ? 'active-tool' : '')}
            aria-pressed={showLibrary} title="Toggle component library"
            onClick={() => setShowLibrary(v => !v)}>▦ <span>PARTS</span></button>
          <span className="tool-divider" />
          <button className="workbench-tool" disabled={!past} title="Undo (Ctrl/Cmd+Z)"
            onClick={undo}>↶ <span>UNDO</span></button>
          <button className="workbench-tool" disabled={!future} title="Redo (Ctrl/Cmd+Shift+Z)"
            onClick={redo}>↷ <span>REDO</span></button>
          <button className="workbench-tool" disabled={!selectedIds.length} title="Copy selected parts (Ctrl/Cmd+C)"
            onClick={copy}>▣ <span>COPY</span></button>
          <button className="workbench-tool" title="Paste clipboard (Ctrl/Cmd+V)"
            onClick={paste}>⊞ <span>PASTE</span></button>
          <span className="tool-divider" />
          <button className="workbench-tool primary-run" title="Solve steady-state voltages and currents" onClick={() => run('dc')}>▶ <span>RUN DC</span></button>
          <button className="workbench-tool primary-run secondary-run"
            onClick={() => run('transient')}>〰 <span>RLC</span></button>
          <button className={'workbench-tool ' + (showRight ? 'active-tool' : '')}
            aria-pressed={showRight} title="Toggle inspector and instruments"
            onClick={() => setShowRight(v => !v)}>◈ <span>PANEL</span></button>
          <button className="workbench-tool" aria-pressed={focused} onClick={toggleFocus}
            title="Hide or restore the side panels">⊡ <span>FOCUS</span></button>
        </nav>
        <ProjectShelf lab="analog" getSnapshot={()=>({document:useCircuitStore.getState().document})}
          onLoad={snapshot=>load(snapshot.document)}/>
        <details className="file-dropdown" ref={fileMenu}>
          <summary title="File actions">⋮ <span>FILE</span></summary>
          <div className="file-dropdown-menu">
            <button onClick={() => {
              if (window.confirm('Create an empty circuit? Undo can restore the current one.')) fresh();
              closeFileMenu();
            }}>＋ NEW CIRCUIT</button>
            <button onClick={() => { load(starterCircuit()); closeFileMenu(); }}>◇ LOAD DEMO</button>
            <button onClick={() => { save(); closeFileMenu(); }}>▣ SAVE LOCALLY</button>
            <button onClick={() => { downloadCircuit(); closeFileMenu(); }}>⇩ EXPORT JSON</button>
            <button onClick={() => { fileInput.current?.click(); closeFileMenu(); }}>⇧ IMPORT JSON</button>
          </div>
        </details>
        <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={onImport} />
      </header>

      <div className={'workspace polished-workspace' +
        (!showLibrary ? ' no-library' : '') +
        (!showRight ? ' no-inspector' : '')} style={panelWidths.style}>
        {showLibrary&&<PanelResizer side="parts" value={panelWidths.widths.parts} onChange={value=>panelWidths.resize('parts',value)}/>}
        {showRight&&<PanelResizer side="tools" value={panelWidths.widths.tools} onChange={value=>panelWidths.resize('tools',value)}/>}
        {showLibrary && <Palette />}
        <main className="editor-region">
          <div className="editor-titlebar">
            <div><span className="titlebar-indicator" /> WORKBENCH
              <small> / {circuit.name.toUpperCase()}</small>
            </div>
            <div className="editor-tags"><span>GRID · 12 PX SNAP</span><span>ANALOG CIRCUIT</span></div>
          </div>
          <CircuitCanvas onMeasure={setProbeTarget}/>
          <div className="editor-foot">
            <span><i className={simulation ? 'foot-ready' : ''} />
              {pendingPin ? 'WIRING' : simulation ? 'SIMULATION READY' : 'EDITOR READY'}
            </span>
            <span className="editor-foot-message" role="status" title={message}>{message}</span>
            <SaveIndicator storageKey="pixel-circuits-v01" value={{document:circuit}} revision={message}/>
          </div>
        </main>
        {showRight && <aside className="right-panel compact-right">
          <div className="right-tabs" role="tablist" aria-label="Workbench tools">
            <button role="tab" aria-selected={rightTab === 'inspect'}
              className={rightTab === 'inspect' ? 'active-tab' : ''}
              onClick={() => setRightTab('inspect')}>◈ INSPECT</button>
            <button role="tab" aria-selected={rightTab === 'simulate'}
              className={rightTab === 'simulate' ? 'active-tab' : ''}
              onClick={() => setRightTab('simulate')}>〰 SIMULATE</button>
          </div>
          {rightTab === 'inspect'
            ? <Inspector />
            : <div className="simulation-stack"><SimulationPanel /><TransientPanel /></div>}
          <details className="shortcut-help">
            <summary>⌘ SHORTCUTS & TIPS</summary>
            <div><kbd>SHIFT+CLICK</kbd><span>Multi-select parts</span></div>
            <div><kbd>CTRL/CMD + Z/Y</kbd><span>Undo / Redo</span></div>
            <div><kbd>CTRL/CMD + C/V/D</kbd><span>Copy / Paste / Duplicate</span></div>
            <div><kbd>CTRL/CMD + A</kbd><span>Select all</span></div>
            <div><kbd>R</kbd><span>Rotate part</span></div>
            <div><kbd>DEL</kbd><span>Delete selection</span></div>
            <div><kbd>SHIFT+DRAG</kbd><span>Move free wire tip</span></div>
            <div><kbd>RIGHT CLICK</kbd><span>Edit / route wire</span></div>
          </details>
        </aside>}
      </div>
    </div>
  );
}
