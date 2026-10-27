import {useEffect,useMemo,useRef,useState} from 'react';
import type {ChangeEvent} from 'react';
import {WorldCanvas} from './WorldCanvas';
import {WorldCreator} from './WorldCreator';
import {EvolutionHistory} from './EvolutionHistory';
import {WorldFamily} from './WorldFamily';
import {PeopleDirectory} from './PeopleDirectory';
import {DivineCodex} from './DivineCodex';
import {personName,isPersonFavorite,renamePerson,togglePersonFavorite,
  toggleSettlementFavorite,renameSettlement,knownSettlements} from './identity';
import {hybridFraction,traitProfile,ancestryLabel} from './family';
import {compactWorld,loadBrowserWorld,readSavedWorld,WORLD_STORAGE_KEY,
  MAX_WORLD_FILE_BYTES} from './storage';
export {readSavedWorld} from './storage';
import {
  BIOME_INFO,BIOMES,DEFAULT_SETTINGS,SPECIES,SPECIES_INFO,
  advanceWorld,createWorld,editWorld,population,
  type Brush,type World,type WorldSettings,type Biome,
} from './engine';

function initialWorld():World{
  if(typeof window!=='undefined'){
    try{
      const restored=loadBrowserWorld(window.localStorage);
      if(restored)return restored;
    }catch{/* Restricted storage: continue with an in-memory world. */}
  }
  return createWorld(DEFAULT_SETTINGS);
}
type Tab='world'|'creator'|'history'|'family'|'people'|'codex';
const format=(n:number)=>n.toLocaleString('en-US');
const brushValue=(b:Brush)=>b.kind==='inspect'?'inspect':
  b.kind==='food'?'food':b.kind==='spawn'?'spawn-'+b.species:'terrain-'+b.biome;
const fromBrushValue=(value:string):Brush=>{
  if(value==='food')return {kind:'food'};
  if(value.startsWith('spawn-')&&SPECIES.includes(value.slice(6) as typeof SPECIES[number]))
    return {kind:'spawn',species:value.slice(6) as typeof SPECIES[number]};
  if(value.startsWith('terrain-')&&BIOMES.includes(value.slice(8) as Biome))
    return {kind:'terrain',biome:value.slice(8) as Biome};
  return {kind:'inspect'};
};
const downloadJson=(world:World)=>{
  const blob=new Blob([JSON.stringify(world)],{type:'application/json'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;
  link.download='evolution-world-'+world.settings.seed+'-year-'+world.year+'.json';
  document.body.appendChild(link);link.click();link.remove();
  URL.revokeObjectURL(url);
};

export function EvolutionLab(){
  const [world,setWorld]=useState<World>(initialWorld);
  const [tab,setTab]=useState<Tab>('world');
  const [playing,setPlaying]=useState(false);
  const [speed,setSpeed]=useState(4);
  const [brush,setBrush]=useState<Brush>({kind:'inspect'});
  const [overlay,setOverlay]=useState<'terrain'|'resources'>('terrain');
  const [zoom,setZoom]=useState(1);
  const [selected,setSelected]=useState<{x:number;y:number}|null>(null);
  const [selectedAgentId,setSelectedAgentId]=useState<number|null>(null);
  const [mapFocus,setMapFocus]=useState<number|null>(null);
  const mapScrollRef=useRef<HTMLDivElement>(null);
  const [notice,setNotice]=useState('');
  const fileRef=useRef<HTMLInputElement>(null);
  const currentWorld=useRef(world);
  currentWorld.current=world;
  useEffect(()=>{
    const timer=window.setTimeout(()=>{
      try{window.localStorage.setItem(WORLD_STORAGE_KEY,compactWorld(world));}
      catch{setNotice('Browser storage is full. Export World JSON to keep this world.');}
    },500);
    return ()=>window.clearTimeout(timer);
  },[world]);
  // Ensure the latest tick is retained even if the user switches to another lab
  // before the debounced autosave fires.
  useEffect(()=>()=>{try{window.localStorage.setItem(WORLD_STORAGE_KEY,
    compactWorld(currentWorld.current));}catch{/* Storage may be unavailable. */}},[]);
  useEffect(()=>{if(tab!=='world')setPlaying(false);},[tab]);
  useEffect(()=>{
    if(!playing||tab!=='world')return;
    const timer=window.setInterval(()=>{
      setWorld(w=>{
        if(!w.agents.length||w.year>=9999)return w;
        return advanceWorld(w,1);
      });
    },1000/speed);
    return ()=>window.clearInterval(timer);
  },[playing,speed,tab]);
  useEffect(()=>{
    if(playing&&(!world.agents.length||world.year>=9999))setPlaying(false);
  },[world.agents.length,world.year,playing]);
  const counts=useMemo(()=>population(world),[world]);
  const agent=selectedAgentId===null?null:
    world.agents.find(a=>a.id===selectedAgentId)??null;
  const displayed=agent?{x:agent.x,y:agent.y}:selected;
  const tile=displayed?world.tiles[displayed.y*world.width+displayed.x]:null;
  const settlement=displayed?world.settlements.find(s=>s.x===displayed.x&&
    s.y===displayed.y)??null:null;
  const latest=world.history.at(-1);
  const hybrids=useMemo(()=>world.agents.filter(a=>hybridFraction(a.ancestry)>.01).length,
    [world.agents]);
  const partnerships=useMemo(()=>world.bonds.filter(b=>b.stage==='partner').length,
    [world.bonds]);
  const focusPerson=(id:number)=>{
    setPlaying(false);setSelectedAgentId(id);setTab('family');
  };
  const openPerson=(id:number)=>{
    setPlaying(false);setSelectedAgentId(id);setTab('people');
  };
  const favoritePerson=(id:number)=>setWorld(w=>togglePersonFavorite(w,id));
  const favoriteSettlement=(id:number)=>setWorld(w=>toggleSettlementFavorite(w,id));
  const giveName=(id:number,name:string)=>setWorld(w=>renamePerson(w,id,name));
  const renamePlace=(id:number,name:string)=>setWorld(w=>renameSettlement(w,id,name));
  const findSettlement=(id:number)=>{
    const place=knownSettlements(world).find(s=>s.id===id);
    if(!place)return;
    setPlaying(false);
    setSelected({x:place.x,y:place.y});setSelectedAgentId(null);
    setZoom(3);setTab('world');setMapFocus(-1);
  };
  const findOnMap=(id:number)=>{
    const target=world.agents.find(a=>a.id===id);
    if(!target)return;
    setSelectedAgentId(id);setSelected({x:target.x,y:target.y});
    setZoom(3);setTab('world');setMapFocus(id);
  };
  useEffect(()=>{
    if(tab!=='world'||mapFocus===null)return;
    const target=mapFocus===-1?selected:
      world.agents.find(a=>a.id===mapFocus);
    const viewport=mapScrollRef.current;
    if(target&&viewport){
      const scaledTile=viewport.scrollWidth/world.width;
      viewport.scrollLeft=Math.max(0,(target.x+.5)*scaledTile-viewport.clientWidth/2);
      viewport.scrollTop=Math.max(0,(target.y+.5)*scaledTile-viewport.clientHeight/2);
    }
    setMapFocus(null);
  },[tab,mapFocus,zoom]);
  const chooseTile=(x:number,y:number)=>{
    setSelected({x,y});
    const individual=world.agents.find(a=>a.x===x&&a.y===y);
    setSelectedAgentId(individual?.id??null);
  };
  const brushAt=(x:number,y:number)=>{
    const before=world;
    const next=editWorld(before,x,y,brush);
    if(next===before){
      setNotice('That tile cannot accept the selected brush. Water and occupied tiles have restrictions.');
    }else{
      setWorld(next);setNotice('');
      setSelected({x,y});setSelectedAgentId(null);
    }
  };
  const startWorld=(settings:WorldSettings)=>{
    if(!window.confirm('Generate a new world? This replaces your current simulation. '+
      'Use Export World JSON first to keep this timeline.'))return;
    setPlaying(false);setWorld(createWorld(settings));setTab('world');
    setSelected(null);setSelectedAgentId(null);setBrush({kind:'inspect'});
    setZoom(1);setNotice('New world created with seed '+settings.seed+'.');
  };
  const reset=()=>{
    const legacyDimensions=world.width!==({
      small:96,medium:160,large:256,vast:320,
    }[world.settings.size]);
    const note=legacyDimensions?
      'This is a migrated v0.1 world. Replaying its seed will start a NEW, LARGER v0.2 map. ':
      '';
    if(!window.confirm(note+'Restart from year 0 using seed '+world.settings.seed+
      '? Your current timeline will be replaced. Export World JSON first to keep it.'))return;
    setPlaying(false);setWorld(createWorld(world.settings));
    setSelected(null);setSelectedAgentId(null);
    setNotice('World replayed from the same starting seed.');
  };
  const importWorld=async(event:ChangeEvent<HTMLInputElement>)=>{
    const file=event.currentTarget.files?.[0];event.currentTarget.value='';
    if(!file)return;
    if(file.size>MAX_WORLD_FILE_BYTES){
      setNotice('World file exceeds the 12 MB safety limit.');return;
    }
    if(!window.confirm('Load '+file.name+'? This replaces the current world. '+
      'Export your world first if you want a backup.'))return;
    try{
      const obj=readSavedWorld(await file.text());
      if(!obj)throw Error('Invalid or unsupported Evolution Lab world JSON.');
      setPlaying(false);setWorld(obj);setTab('world');
      setSelected(null);setSelectedAgentId(null);setZoom(1);setBrush({kind:'inspect'});
      setNotice('Loaded saved world, year '+obj.year+'.');
    }catch(error){setNotice(error instanceof Error?error.message:'Unable to open world file.');}
  };
  const step=(years:number)=>{
    setPlaying(false);setWorld(w=>advanceWorld(w,years));
  };
  const navigate=(next:Tab)=>{
    setPlaying(false);setTab(next);setNotice('');
  };
  return <div className="evo-app">
    <header className="evo-lab-nav">
      <div className="evo-lab-brand">
        <span>✦</span>
        <div><strong>EVOLUTION LAB</strong><small>LAB 04 / FANTASY ECOSYSTEMS</small></div>
      </div>
      <nav role="tablist" aria-label="Evolution Lab pages" className="evo-lab-tabs">
        <button role="tab" aria-selected={tab==='world'}
          className={tab==='world'?'active':''} onClick={()=>navigate('world')}>
          ◈ WORLD</button>
        <button role="tab" aria-selected={tab==='creator'}
          className={tab==='creator'?'active':''} onClick={()=>navigate('creator')}>
          ✧ WORLD CREATOR</button>
        <button role="tab" aria-selected={tab==='history'}
          className={tab==='history'?'active':''} onClick={()=>navigate('history')}>
          ≋ HISTORY</button>
        <button role="tab" aria-selected={tab==='people'}
          className={tab==='people'?'active':''} onClick={()=>navigate('people')}>
          ◉ PEOPLE</button>
        <button role="tab" aria-selected={tab==='family'}
          className={tab==='family'?'active':''} onClick={()=>navigate('family')}>
          ♡ FAMILIES</button>
        <button role="tab" aria-selected={tab==='codex'}
          className={tab==='codex'?'active':''} onClick={()=>navigate('codex')}>
          ✦ DIVINE CODEX</button>
      </nav>
      <div className="evo-nav-status"><span/> YEAR {world.year}</div>
    </header>
    {tab==='creator'?<WorldCreator key={world.settings.seed+'-'+world.year}
      current={world.settings} onCreate={startWorld} onReturn={()=>navigate('world')}/>:
    tab==='history'?<EvolutionHistory world={world}/>:
    tab==='family'?<WorldFamily world={world} focusId={selectedAgentId}
      onChoose={focusPerson} onShowOnMap={findOnMap}
      onFavorite={favoritePerson} onRename={giveName}/>:
    tab==='people'?<PeopleDirectory world={world} selectedId={selectedAgentId}
      onOpen={focusPerson} onFavorite={favoritePerson}
      onRename={giveName} onFindOnMap={findOnMap}/>:
    tab==='codex'?<DivineCodex world={world}
      onOpenPerson={focusPerson} onFavoritePerson={favoritePerson}
      onFavoriteSettlement={favoriteSettlement}
      onRenameSettlement={renamePlace} onFindSettlement={findSettlement}/>:
    <main className="evo-playground">
      <header className="evo-playground-heading">
        <div>
          <span className="evo-overline">THE WORLD IS YOUR EXPERIMENT</span>
          <h1>Let the world <em>write itself.</em></h1>
          <p>Watch four fantasy peoples survive, spread and form settlements
            in a living pixel world.</p>
        </div>
        <div className="evo-sim-controls">
          <button className={playing?'playing evo-play-main':'evo-play-main'}
            disabled={!world.agents.length||world.year>=9999}
            onClick={()=>setPlaying(v=>!v)}>{playing?'■ PAUSE':'▶ PLAY'}</button>
          <button onClick={()=>step(1)} title="Advance one year">+1 YEAR</button>
          <button onClick={()=>step(10)} title="Advance ten years">+10</button>
          <label htmlFor="evo-play-speed">SPEED
            <select id="evo-play-speed" value={speed}
              onChange={e=>setSpeed(Number(e.target.value))}>
              {[1,2,4,8,16].map(v=><option value={v} key={v}>{v} yr/s</option>)}
            </select>
          </label>
        </div>
      </header>
      <section className="evo-stats" aria-label="Live world statistics">
        <div className="evo-stat big"><small>WORLD YEAR</small>
          <strong>{world.year}</strong><span>Seed {world.settings.seed}</span></div>
        <div className="evo-stat"><small>LIVING PEOPLE</small>
          <strong>{format(world.agents.length)}</strong>
          <span>{latest?.births??0} births · {latest?.deaths??0} deaths this year</span>
        </div>
        <div className="evo-stat"><small>SETTLEMENTS</small>
          <strong>{world.settlements.length}</strong><span>Founded by local groups</span></div>
        <div className="evo-stat"><small>LIVING HYBRIDS</small>
          <strong>{hybrids}</strong><span>Mixed-species ancestry</span></div>
        <div className="evo-stat"><small>PARTNERSHIPS</small>
          <strong>{partnerships}</strong><span>Active mutual bonds</span></div>
        <div className="evo-stat"><small>TOTAL BIRTHS</small>
          <strong>{world.totalBirths}</strong><span>New individuals born</span></div>
      </section>
      <div className="evo-playground-layout">
        <section className="evo-map-card">
          <div className="evo-card-heading evo-map-heading">
            <div><strong>◈ LIVING WORLD</strong>
              <small>{world.width} × {world.height} TILES · {world.settings.size.toUpperCase()} WORLD</small>
            </div>
            <div className="evo-map-actions">
              <button onClick={()=>setZoom(v=>Math.max(1,v-.5))}
                disabled={zoom<=1} title="Zoom out">−</button>
              <button onClick={()=>setZoom(1)} title="Fit map to view">⌖ FIT</button>
              <button onClick={()=>setZoom(v=>Math.min(8,v+.5))}
                disabled={zoom>=8} title="Zoom in">+</button>
            </div>
          </div>
          <div className="evo-map-toolbar">
            <label htmlFor="evo-brush">MAP TOOL</label>
            <select id="evo-brush" value={brushValue(brush)}
              onChange={e=>setBrush(fromBrushValue(e.target.value))}>
              <option value="inspect">⌖ Inspect tile or individual</option>
              <optgroup label="Place individuals">
                {SPECIES.map(s=><option value={'spawn-'+s} key={s}>
                  + Place {SPECIES_INFO[s].name.slice(0,-1)}
                </option>)}
              </optgroup>
              <optgroup label="World editing">
                <option value="food">✿ Replenish tile food</option>
                {BIOMES.map(b=><option value={'terrain-'+b} key={b}>
                  Paint {BIOME_INFO[b].name}
                </option>)}
              </optgroup>
            </select>
            <label htmlFor="evo-overlay">MAP LAYER</label>
            <select id="evo-overlay" value={overlay}
              onChange={e=>setOverlay(e.target.value as 'terrain'|'resources')}>
              <option value="terrain">Biomes</option>
              <option value="resources">Food levels</option>
            </select>
          </div>
          <div className="evo-map-scroll" ref={mapScrollRef}>
            <WorldCanvas world={world} brush={brush} overlay={overlay} zoom={zoom}
              selected={displayed} onSelect={chooseTile} onEdit={brushAt}/>
          </div>
          <div className="evo-map-footer">
            <div className="evo-species-legend">
              {SPECIES.map(s=><span key={s}>
                <i style={{background:SPECIES_INFO[s].color}}/>{SPECIES_INFO[s].name}
                <b>{counts[s]}</b>
              </span>)}
            </div>
            <span>⌂ SETTLEMENTS · CLICK TO INSPECT · {brush.kind==='inspect'?
              'ARROW KEYS TO MOVE SELECTION':'CLICK TO APPLY TOOL'}</span>
          </div>
          {notice&&<div className="evo-notice" role="status">{notice}</div>}
        </section>
        <aside className="evo-world-sidebar">
          <section className="evo-section-card evo-inspector-card">
            <div className="evo-card-heading">
              <strong>◉ WORLD INSPECTOR</strong>
              <span>{displayed?'X '+displayed.x+' · Y '+displayed.y:'NO SELECTION'}</span>
            </div>
            {!displayed||!tile?<div className="evo-inspector-empty">
              <div>⌖</div>
              <strong>CLICK SOMEWHERE IN THE WORLD</strong>
              <p>Select an individual, a settlement or a terrain tile to view its
                details. Change the Map Tool to place people or edit resources.</p>
            </div>:<>
              <div className="evo-biome-info">
                <span className="evo-biome-swatch"
                  style={{background:BIOME_INFO[tile.biome].color}}/>
                <div><strong>{BIOME_INFO[tile.biome].name}</strong>
                  <small>Food available: {tile.food.toFixed(1)} units</small></div>
              </div>
              {agent?<div className="evo-individual">
                <div className="evo-individual-title">
                  <span className="evo-species-avatar"
                    style={{color:SPECIES_INFO[agent.species].color}}>
                    {SPECIES_INFO[agent.species].symbol}
                  </span>
                  <div><strong>{personName(world,world.lineage.find(r=>r.id===agent.id)??agent)}</strong>
                    <small>#{agent.id} · {agent.age} years old · Born year {agent.born}
                      · Generation {agent.generation}</small></div>
                </div>
                <div className="evo-inspector-heritage">
                  <strong>{ancestryLabel(agent.ancestry)}</strong>
                  <div className="evo-ancestry-bar" aria-label="Ancestry breakdown">
                    {SPECIES.map(s=><i key={s} style={{width:
                      (agent.ancestry[s]*100)+'%',
                      background:SPECIES_INFO[s].color}}/>)}
                  </div>
                  {hybridFraction(agent.ancestry)>.01&&<small>✧ MIXED ANCESTRY</small>}
                </div>
                <div className="evo-world-person-buttons">
                  <button onClick={()=>favoritePerson(agent.id)}
                    aria-label="Favorite individual"
                    aria-pressed={isPersonFavorite(world,agent.id)}>
                    {isPersonFavorite(world,agent.id)?'★ FOLLOWING':'☆ FAVORITE'}
                  </button>
                  <button onClick={()=>openPerson(agent.id)}>◉ PROFILE ↗</button>
                  <button className="evo-ancestry-open"
                    onClick={()=>focusPerson(agent.id)}>♡ FAMILY TREE ↗</button>
                </div>
                <div className="evo-vitals">
                  <label>ENERGY <b>{Math.round(agent.energy)}%</b>
                    <progress max="100" value={agent.energy}/></label>
                  <label>HEALTH <b>{Math.round(agent.health)}%</b>
                    <progress max="100" value={agent.health}/></label>
                </div>
                <div className="evo-individual-facts">
                  <span>Maturity <b>{Math.round(traitProfile(agent.ancestry).maturity)} years</b></span>
                  <span>Typical lifespan <b>{Math.round(traitProfile(agent.ancestry).lifespan)} years</b></span>
                  <span>Partner <b>{agent.partnerId?'#'+agent.partnerId:'None'}</b></span>
                  <span>Curiosity <b>{agent.genes.curiosity.toFixed(2)}×</b></span>
                  <span>Vigor <b>{agent.genes.vigor.toFixed(2)}×</b></span>
                  {agent.parents&&<span>Parent IDs <b>{agent.parents.join(' + ')}</b></span>}
                </div>
              </div>:<div className="evo-inspector-empty small">
                No individual currently occupies this tile.
              </div>}
              {settlement&&<div className="evo-selected-settlement">
                <strong>⌂ {settlement.name}</strong>
                <span>{SPECIES_INFO[settlement.species].name} founded Y{settlement.founded}</span>
                <span>{settlement.population} nearby people · {settlement.stores.toFixed(0)} stores</span>
              </div>}
            </>}
          </section>
          <section className="evo-section-card evo-world-actions">
            <div className="evo-card-heading"><strong>WORLD FILE</strong></div>
            <div className="evo-actions-buttons">
              <button onClick={()=>{setPlaying(false);downloadJson(world);}}>
                ⇩ EXPORT WORLD JSON
              </button>
              <button onClick={()=>fileRef.current?.click()}>⇧ IMPORT WORLD JSON</button>
              <input type="file" accept=".json,application/json" hidden ref={fileRef}
                onChange={importWorld}/>
              <button onClick={reset}>↺ REPLAY THIS SEED</button>
            </div>
            <p>Changes autosave in this browser. Export JSON for portable backups.
              Replay resets the simulation to its original conditions.</p>
          </section>
          <section className="evo-section-card evo-latest-events">
            <div className="evo-card-heading"><strong>RECENT CHRONICLE</strong>
              <button onClick={()=>navigate('history')}>VIEW ALL ↗</button></div>
            {world.events.slice(-4).reverse().map(e=><div key={e.id} className="evo-event-small">
              <span>Y{e.year}</span><p>{e.message}</p>
            </div>)}
          </section>
        </aside>
      </div>
      <div className="evo-future-note">
        <strong>V0.3: LIVES & LEGACIES</strong>
        <span>People now have names, family houses, personal chronicles and lasting favorites.
          Browse lives in People and discover settlements in the Divine Codex.</span>
      </div>
    </main>}
  </div>;
}
