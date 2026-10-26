import { DragEvent, useEffect, useRef, useState } from 'react';
import { useCircuitStore } from '../state/useCircuitStore';
import { ComponentKind, snap } from '../circuit/types';
import { analogCategories, analogParts, searchAnalogParts, type AnalogCategory, type AnalogPart } from '../circuit/analogCatalog';
import {
  switchCircuit, currentSourceCircuit, potentiometerCircuit, starterCircuit, rcCircuit, rlCircuit,
} from '../circuit/sample';

export function Palette(){
  const addComponent=useCircuitStore(s=>s.addComponent);
  const loadDocument=useCircuitStore(s=>s.loadDocument);
  const setTransientDuration=useCircuitStore(s=>s.setTransientDuration);
  const count=useCircuitStore(s=>s.document.components.length);
  const searchRef=useRef<HTMLInputElement>(null);
  const [query,setQuery]=useState('');
  const [category,setCategory]=useState<AnalogCategory|'all'>('all');
  const [expanded,setExpanded]=useState<Record<string,boolean>>({});
  const shown=searchAnalogParts(query,category);
  const kinds=new Set(shown.map(part=>part.kind));
  useEffect(()=>{
    const onKey=(event:KeyboardEvent)=>{
      if(event.key!=='/'||event.ctrlKey||event.metaKey||event.altKey)return;
      const target=event.target as HTMLElement|null;
      if(target?.closest('input,textarea,select,[contenteditable="true"]'))return;
      event.preventDefault();searchRef.current?.focus();
    };
    window.addEventListener('keydown',onKey);
    return ()=>window.removeEventListener('keydown',onKey);
  },[]);
  const startDrag=(event:DragEvent<HTMLButtonElement>,kind:ComponentKind)=>{
    event.dataTransfer.setData('application/x-circuit-component',kind);
    event.dataTransfer.effectAllowed='copy';
  };
  const place=(part:AnalogPart)=>{
    const offset=count%6;
    addComponent(part.kind,{x:snap(216+72*offset),y:snap(216+48*offset)});
  };
  const renderEntry=(part:AnalogPart)=><button
    className={'palette-item accent-'+part.tone} key={part.kind} draggable
    onDragStart={event=>startDrag(event,part.kind)} onClick={()=>place(part)}
    title={'Click or drag onto the canvas: '+part.label}>
    <span className="palette-icon">{part.symbol}</span>
    <span className="palette-text"><strong>{part.label}</strong><small>{part.detail}</small></span>
    <span className="palette-plus">+</span>
  </button>;
  const selectLab=(doc:ReturnType<typeof starterCircuit>,duration?:number)=>{
    loadDocument(doc);
    if(duration)setTransientDuration(duration);
  };
  return <aside className="left-panel neon-panel analog-catalog">
    <div className="panel-heading"><span className="heading-cube">▦</span> PARTS LIBRARY
      <span className="tiny-muted">/ {String(analogParts.length).padStart(2,'0')}</span>
    </div>
    <div className="signal-catalog-search">
      <label htmlFor="analog-part-search" className="sidebar-section-label">⌕ FIND AN ANALOG PART</label>
      <div className="signal-search-field">
        <span aria-hidden="true">⌕</span>
        <input id="analog-part-search" ref={searchRef} type="search" autoComplete="off"
          value={query} placeholder="Resistor, capacitor, source…"
          onChange={event=>setQuery(event.target.value)}
          onKeyDown={event=>{
            if(event.key==='Escape'){setQuery('');event.currentTarget.blur();}
            if(event.key==='Enter'&&shown.length===1){
              place(shown[0]);event.currentTarget.blur();
            }
          }}/>
        {query?<button title="Clear search" aria-label="Clear search"
          onClick={()=>{setQuery('');searchRef.current?.focus();}}>×</button>:<kbd>/</kbd>}
      </div>
      <div className="signal-catalog-meta">
        <span>{shown.length} / {analogParts.length} COMPONENTS</span>
        {(query||category!=='all')&&<button onClick={()=>{setQuery('');setCategory('all');}}>↻ RESET</button>}
      </div>
    </div>
    <div className="signal-catalog-filters" aria-label="Filter analog components">
      {[{id:'all' as const, title:'ALL',icon:'▦'},...analogCategories].map(group=>
        <button key={group.id} className={'signal-filter-chip'+(category===group.id?' selected':'')}
          aria-pressed={category===group.id} onClick={()=>setCategory(group.id)}>
          <span>{group.icon}</span> {group.title}
        </button>)}
    </div>
    <div className="analog-catalog-groups">
      {analogCategories.map((group,index)=>{
        const parts=group.parts.filter(part=>kinds.has(part.kind));
        if(!parts.length)return null;
        return <details className="signal-catalog-category" key={group.id+'-'+(query?'q':category)}
          open={!!query||(expanded[group.id]??index<2)}
          onToggle={event=>{
            if(query)return;
            const next=event.currentTarget.open;
            setExpanded(old=>old[group.id]===next?old:{...old,[group.id]:next});
          }}>
          <summary>
            <span className="signal-catalog-icon">{group.icon}</span>
            <span className="signal-catalog-category-title">{group.title}
              <small>{group.description}</small>
            </span>
            <span className="signal-catalog-count">{parts.length}</span>
            <span className="signal-catalog-chevron">⌄</span>
          </summary>
          <div className="palette-list">{parts.map(renderEntry)}</div>
        </details>;
      })}
      {!shown.length&&<div className="signal-catalog-empty">
        <strong>⌕ NO MATCHES</strong>
        <p>Search by component name, symbol, or electrical term.</p>
        <button onClick={()=>{setQuery('');setCategory('all');searchRef.current?.focus();}}>
          SHOW ALL COMPONENTS
        </button>
      </div>}
    </div>
    {!query&&category==='all'&&<details className="lab-presets lab-presets-collapsible">
      <summary className="sidebar-section-label">◇ INSTANT LABS <span>▸</span></summary>
      <button onClick={()=>selectLab(starterCircuit())}><span>◇</span> VOLTAGE DIVIDER</button>
      <button onClick={()=>selectLab(switchCircuit())}><span>↯</span> SWITCH CONTROL</button>
      <button onClick={()=>selectLab(currentSourceCircuit())}><span>⇣</span> CURRENT SOURCE</button>
      <button onClick={()=>selectLab(potentiometerCircuit())}><span>◈</span> POTENTIOMETER</button>
      <button onClick={()=>selectLab(rcCircuit(),.5)}><span>▥</span> RC CHARGING (0.5 s)</button>
      <button onClick={()=>selectLab(rlCircuit(),.012)}><span>∿</span> RL RESPONSE (12 ms)</button>
    </details>}
    <div className="palette-mini-tip">✦ PRESS / TO SEARCH · RIGHT-CLICK TO PLACE</div>
  </aside>;
}
