import { DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import type { DigitalKind } from './types';
import { useDigitalStore } from './useDigitalStore';
import { paletteCategories, allParts, partByKind, searchParts, type PartCategory } from './catalog';
import { initialDigitalCircuit } from './types';
import { andDemo, halfAdderDemo, notDemo } from './samples';
import { counterDemo,flipFlopDemo,cpuCoreDemo } from './computerSamples';

const exampleCircuits = [
  {label:'XOR PLAYGROUND',document:initialDigitalCircuit},
  {label:'AND GATE LAB',document:andDemo},
  {label:'NOT GATE LAB',document:notDemo},
  {label:'HALF ADDER',document:halfAdderDemo},
  {label:'D FLIP-FLOP',document:flipFlopDemo},
  {label:'CLOCKED 4-BIT COUNTER',document:counterDemo},
  {label:'4-BIT CPU DATAPATH',document:cpuCoreDemo},
];
type CategoryFilter = PartCategory | 'all' | 'custom';

export function SignalPalette(){
  const searchRef=useRef<HTMLInputElement>(null);
  const [query,setQuery]=useState('');
  const [category,setCategory]=useState<CategoryFilter>('all');
  const [expanded,setExpanded]=useState<Record<string,boolean>>({});
  const [blockName,setBlockName]=useState('MY LOGIC BLOCK');
  const [blockError,setBlockError]=useState('');
  const add=useDigitalStore(s=>s.add);
  const load=useDigitalStore(s=>s.load);
  const capture=useDigitalStore(s=>s.captureAsBlock);
  const placeBlock=useDigitalStore(s=>s.addSavedBlock);
  const library=useDigitalStore(s=>s.blockLibrary);
  const favorites=useDigitalStore(s=>s.favoriteKinds);
  const recent=useDigitalStore(s=>s.recentKinds);
  const toggleFavorite=useDigitalStore(s=>s.toggleFavorite);
  const document=useDigitalStore(s=>s.document);
  const count=document.components.length;
  const inBlock=useDigitalStore(s=>s.editStack.length)>0;
  const matches=useMemo(()=>category==='custom' ? [] :
    searchParts(query,category),[query,category]);
  const shown=new Set(matches.map(p=>p.kind));
  const savedBlocks=useMemo(()=>library.filter(def=>
    def.name.toLowerCase().includes(query.toLowerCase().trim()) ||
    !query.trim()).filter(()=>category==='all'||category==='custom'),
    [library,query,category]);
  const visibleCount=matches.length+savedBlocks.length;
  useEffect(()=>{
    const shortcut=(event:KeyboardEvent)=>{
      if(event.key!=='/'||event.ctrlKey||event.metaKey||event.altKey)return;
      const active=event.target as HTMLElement|null;
      if(active?.closest('input,textarea,select,[contenteditable="true"]'))return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener('keydown',shortcut);
    return ()=>window.removeEventListener('keydown',shortcut);
  },[]);
  const drag=(event:DragEvent<HTMLButtonElement>,kind:DigitalKind)=>{
    event.dataTransfer.setData('application/x-signal-kind',kind);
    event.dataTransfer.effectAllowed='copy';
  };
  const place=(kind:Exclude<DigitalKind,'block'>)=>{
    const offset=count%6;
    add(kind,{x:264+offset*72,y:192+offset*48});
  };
  const saveBlock=()=>{
    try{
      capture(blockName);setBlockError('');
      setBlockName(document.name.replace(/ · BLOCK$/,'')+' MODULE');
    }catch(err){setBlockError(err instanceof Error?err.message:'Could not capture module.');}
  };
  return <aside className="signal-palette signal-catalog" aria-label="Digital component catalog">
    <div className="signal-panel-heading">▦ PARTS CATALOG <span>/ {allParts.length} PARTS</span></div>

    <div className="signal-catalog-search">
      <label htmlFor="signal-part-search" className="signal-section-label">FIND A COMPONENT</label>
      <div className="signal-search-field">
        <span aria-hidden="true">⌕</span>
        <input id="signal-part-search" ref={searchRef} type="search" autoComplete="off"
          value={query} placeholder="Search gates, mux, adders…"
          onChange={event=>setQuery(event.target.value)}
          onKeyDown={event=>{
            if(event.key==='Escape') {setQuery('');event.currentTarget.blur();}
            if(event.key==='Enter'&&matches.length===1) {
              place(matches[0].kind);event.currentTarget.blur();
            }
          }}/>
        {query ? <button aria-label="Clear search" title="Clear search" onClick={()=>{
          setQuery('');searchRef.current?.focus();
        }}>×</button> : <kbd>/</kbd>}
      </div>
      <div className="signal-catalog-meta">
        <span>{visibleCount} MATCH{visibleCount===1?'':'ES'}</span>
        {(query||category!=='all')&&<button onClick={()=>{
          setQuery('');setCategory('all');
        }}>↻ RESET</button>}
      </div>
    </div>

    <div className="signal-catalog-filters" aria-label="Filter components by category">
      {[{id:'all' as const,name:'ALL',icon:'▦'},...paletteCategories,
        {id:'custom' as const,name:'MY BLOCKS',icon:'▣'}].map(cat=>
        <button key={cat.id}
          className={'signal-filter-chip'+(category===cat.id?' selected':'')}
          aria-pressed={category===cat.id}
          onClick={()=>setCategory(cat.id)}>
          <span>{cat.icon}</span> {cat.name}
        </button>)}
    </div>

    {category==='all'&&!query&&!!favorites.length&&
      <section className="signal-catalog-shortcuts">
        <div className="signal-section-label">★ FAVORITES</div>
        <div className="signal-mini-tiles">
          {favorites.filter(kind=>kind!=='block').map(kind=>{
            const part=partByKind[kind as Exclude<DigitalKind,'block'>];
            return part?<button key={kind} title={'Place '+part.name}
              onClick={()=>place(part.kind)}>{part.glyph} {part.name}</button>:null;
          })}
        </div>
      </section>}
    {category==='all'&&!query&&!!recent.length&&
      <section className="signal-catalog-shortcuts">
        <div className="signal-section-label">◷ RECENTLY USED</div>
        <div className="signal-mini-tiles">
          {recent.filter(kind=>kind!=='block').slice(0,4).map(kind=>{
            const part=partByKind[kind as Exclude<DigitalKind,'block'>];
            return part?<button key={kind} title={'Place '+part.name}
              onClick={()=>place(part.kind)}>{part.glyph} {part.name}</button>:null;
          })}
        </div>
      </section>}

    {paletteCategories.map((group,index)=>{
      const parts=group.parts.filter(part=>shown.has(part.kind));
      if(!parts.length)return null;
      return <details key={group.id+'-'+(query?'search':category)}
        className="signal-catalog-category"
        open={!!query || (expanded[group.id] ?? index<2)}
        onToggle={event=>{
          if(query)return;
          const nextOpen=event.currentTarget.open;
          setExpanded(previous=>previous[group.id]===nextOpen?previous:
            {...previous,[group.id]:nextOpen});
        }}>
        <summary>
          <span className="signal-catalog-icon">{group.icon}</span>
          <span className="signal-catalog-category-title">{group.name}
            <small>{group.description}</small>
          </span>
          <span className="signal-catalog-count">{parts.length}</span>
          <span className="signal-catalog-chevron">⌄</span>
        </summary>
        <div className="signal-palette-grid">
          {parts.map(part=>
            <div className="signal-catalog-entry" key={part.kind}>
              <button className={'signal-palette-item kind-'+part.kind}
                draggable onDragStart={event=>drag(event,part.kind)}
                title={'Click or drag to place '+part.name}
                onClick={()=>place(part.kind)}>
                <span className="signal-palette-glyph">{part.glyph}</span>
                <span className="signal-palette-words">
                  <strong>{part.name}</strong><small>{part.description}</small>
                </span>
                <span className="signal-plus">+</span>
              </button>
              <button className={'signal-favorite'+(favorites.includes(part.kind)?' is-favorite':'')}
                aria-label={(favorites.includes(part.kind)?'Remove ':'Add ')+part.name+
                  (favorites.includes(part.kind)?' from':' to')+' favorites'}
                title={favorites.includes(part.kind)?'Remove favorite':'Add to favorites'}
                aria-pressed={favorites.includes(part.kind)}
                onClick={()=>toggleFavorite(part.kind)}>
                {favorites.includes(part.kind)?'★':'☆'}
              </button>
            </div>)}
        </div>
      </details>;
    })}

    {(category==='all'||category==='custom')&&
    <section className="signal-block-library">
      <div className="signal-section-label">▣ YOUR REUSABLE BLOCKS / {savedBlocks.length}</div>
      {!query&&<details className="signal-block-creator">
        <summary>▣ CAPTURE CURRENT CIRCUIT <span>▸</span></summary>
        <p>INPUT switches become input pins; LED outputs become output pins.
          Save the original gate-level design as a reusable module.</p>
        <label htmlFor="signal-new-block-name">MODULE NAME</label>
        <input id="signal-new-block-name" maxLength={40} value={blockName}
          onChange={event=>setBlockName(event.target.value)}/>
        <button disabled={inBlock} title={inBlock?'Finish editing the current module first':'Save module'}
          onClick={saveBlock}>✦ SAVE AS BLOCK</button>
        {blockError&&<p className="signal-block-error" role="alert">{blockError}</p>}
      </details>}
      <div className="signal-saved-block-list">
        {savedBlocks.length===0&&<p className="signal-block-empty">
          {query?'No matching saved blocks.':'No reusable modules saved yet.'}
        </p>}
        {savedBlocks.map(def=><button key={def.id} draggable
          onDragStart={event=>{
            event.dataTransfer.setData('application/x-signal-block',def.id);
            event.dataTransfer.effectAllowed='copy';
          }}
          title={'Click or drag to place '+def.name}
          onClick={()=>{
            try {placeBlock(def.id,{x:384+count%3*120,y:252+count%4*72});setBlockError('');}
            catch(err){setBlockError(err instanceof Error?err.message:'Cannot place block.');}
          }}>
          <span className="saved-block-glyph">▣</span>
          <span><strong>{def.name}</strong>
            <small>{def.inputs.length} IN / {def.outputs.length} OUT</small>
          </span><span className="saved-block-plus">+</span>
        </button>)}
      </div>
    </section>}

    {visibleCount===0&&<div className="signal-catalog-empty">
      <strong>⌕ NO PARTS FOUND</strong>
      <p>Try “xor”, “adder”, “mux”, “3 input”, or a different category.</p>
      <button onClick={()=>{setQuery('');setCategory('all');searchRef.current?.focus();}}>
        SHOW ALL COMPONENTS
      </button>
    </div>}

    {!query&&category==='all'&&<details className="signal-presets">
      <summary>◇ SAMPLE CIRCUITS <span>▸</span></summary>
      {exampleCircuits.map(preset=><button key={preset.label}
        disabled={inBlock} title={inBlock?'Finish editing current module first':undefined}
        onClick={()=>load(preset.document())}>✦ {preset.label}</button>)}
    </details>}
    <div className="signal-palette-tip">✦ CLICK TO PLACE · DRAG TO POSITION · / TO SEARCH</div>
  </aside>;
}
