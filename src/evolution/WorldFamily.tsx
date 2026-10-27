import {useMemo,useState} from 'react';
import {
  SPECIES,SPECIES_INFO,type LineageRecord,type World,
} from './engine';
import {
  ancestryLabel,hybridFraction,traitProfile,
} from './family';

type Props={world:World;focusId:number|null;onChoose:(id:number)=>void;
  onShowOnMap:(id:number)=>void};
const percent=(n:number)=>Math.round(n*100)+'%';
function LifeCard({record,active,onSelect,compact=false}:{
  record:LineageRecord|undefined;active?:boolean;compact?:boolean;
  onSelect:(id:number)=>void;
}){
  if(!record)return <div className="evo-family-person missing">
    <span>?</span><small>Unknown / not retained</small>
  </div>;
  return <button type="button"
    className={'evo-family-person'+(active?' selected':'')+(compact?' compact':'')}
    onClick={()=>onSelect(record.id)}>
    <span className="evo-family-avatar"
      style={{background:SPECIES_INFO[record.species].color}}/>
    <span className="evo-family-person-text">
      <strong>#{record.id} · {ancestryLabel(record.ancestry)}</strong>
      <small>Gen {record.generation} · Born Y{record.born}
        {record.died!==undefined?' · Died Y'+record.died:' · Alive'}</small>
    </span>
  </button>;
}
export function WorldFamily({world,focusId,onChoose,onShowOnMap}:Props){
  const [query,setQuery]=useState('');
  const [showAllChildren,setShowAllChildren]=useState(false);
  const map=useMemo(()=>new Map(world.lineage.map(r=>[r.id,r])),[world.lineage]);
  const living=useMemo(()=>new Map(world.agents.map(a=>[a.id,a])),[world.agents]);
  const recommended=world.lineage.find(r=>r.children.length&&
    r.died===undefined)?.id??world.agents[0]?.id??null;
  const current=map.get(focusId??-1)??map.get(recommended??-1);
  const partners=current?world.bonds.filter(b=>b.a===current.id||b.b===current.id)
    .slice().sort((a,b)=>b.since-a.since):[];
  const ancestors=(id:number)=>map.get(id);
  const matches=world.lineage.filter(r=>query.trim()&&(
    String(r.id).includes(query.trim())||
    ancestryLabel(r.ancestry).toLowerCase().includes(query.toLowerCase().trim())))
    .slice(-25).reverse();
  const children=current?.children.map(ancestors).filter(
    (r):r is LineageRecord=>!!r)??[];
  const siblings=current?.parents?.flatMap(id=>map.get(id)?.children??[])
    .filter((id,i,ids)=>id!==current.id&&ids.indexOf(id)===i)
    .map(ancestors).filter((r):r is LineageRecord=>!!r)??[];
  const isLiving=current?living.has(current.id):false;
  const person=isLiving&&current?living.get(current.id):undefined;
  const traits=current?traitProfile(current.ancestry):null;
  const hybridCount=world.agents.filter(a=>hybridFraction(a.ancestry)>.01).length;
  return <main className="evo-family-page">
    <header className="evo-section-header">
      <div><span className="evo-overline">EVOLUTION LAB / RELATIONSHIPS & HERITAGE</span>
        <h2>Family Archives</h2>
        <p>Explore bonds, ancestry, parents, children and descendants across generations.</p>
      </div>
      <div className="evo-family-summary">
        <span><b>{world.bonds.filter(b=>b.stage==='partner').length}</b> partnerships</span>
        <span><b>{hybridCount}</b> living hybrids</span>
        <span><b>{world.lineage.length}</b> lineage records</span>
      </div>
    </header>
    <div className="evo-family-layout">
      <section className="evo-section-card evo-family-chooser">
        <div className="evo-card-heading"><strong>FIND AN INDIVIDUAL</strong><span>Living + recorded dead</span></div>
        <div className="evo-family-search">
          <label htmlFor="evo-family-search">SEARCH ID OR ANCESTRY</label>
          <input id="evo-family-search" type="search" placeholder="Try 42, Elf, Human…"
            value={query} onChange={event=>setQuery(event.target.value)}/>
        </div>
        {query.trim()?<div className="evo-family-results">
          {matches.length?matches.map(r=><LifeCard key={r.id} record={r}
            onSelect={id=>{onChoose(id);setQuery('');}} compact/>):
            <p className="evo-family-help">No retained ancestry records match your search.</p>}
        </div>:<div className="evo-family-results">
          <p className="evo-family-help">Choose someone on the World map and press
            VIEW FAMILY, or choose a name below.</p>
          {world.lineage.filter(r=>r.children.length>0||r.generation>0)
            .slice(-12).reverse().map(r=><LifeCard key={r.id} record={r}
              active={current?.id===r.id} compact onSelect={onChoose}/>)}
          {!world.lineage.some(r=>r.children.length||r.generation>0)&&
            world.lineage.slice(0,8).map(r=><LifeCard key={r.id}
              record={r} active={current?.id===r.id} compact onSelect={onChoose}/>)}
        </div>}
        <div className="evo-family-note">Archives retain up to 14,000 birth records.
          Very old ancestors may eventually be pruned for browser performance.
          Original v0.1 imports cannot recover people who died before migration.</div>
      </section>
      <div className="evo-family-detail">
        {!current?<section className="evo-section-card evo-empty-panel">
          <strong>NO ONE TO DISPLAY YET</strong>
          <p>Create a world with founding populations, or place individuals
            on the map to begin their lineage.</p>
        </section>:<>
          <section className="evo-section-card evo-family-highlight">
            <div className="evo-card-heading"><strong>SELECTED LINEAGE</strong>
              <span>{isLiving?'● ALIVE':'◌ DECEASED / ARCHIVED'}</span></div>
            <div className="evo-family-headline">
              <span className="evo-family-emblem"
                style={{color:SPECIES_INFO[current.species].color}}>
                {SPECIES_INFO[current.species].symbol}</span>
              <div>
                <span className="evo-overline">GENERATION {current.generation} / ID #{current.id}</span>
                <h3>{ancestryLabel(current.ancestry)}</h3>
                <p>Born Y{current.born}
                  {current.died!==undefined?' · Died Y'+current.died:''}
                  {person?' · Age '+person.age+' years':''}</p>
              </div>
              {isLiving&&<button className="evo-family-map-link"
                onClick={()=>onShowOnMap(current.id)}>⌖ FIND ON MAP ↗</button>}
            </div>
            <div className="evo-family-traits">
              <div><small>EXPECTED LIFESPAN</small><strong>{Math.round(traits?.lifespan??0)}</strong></div>
              <div><small>MATURITY AGE</small><strong>{Math.round(traits?.maturity??0)}</strong></div>
              <div><small>VIGOR GENE</small><strong>{current.genes.vigor.toFixed(2)}×</strong></div>
              <div><small>SOCIAL GENE</small><strong>{current.genes.social.toFixed(2)}×</strong></div>
            </div>
            <div className="evo-ancestry-heading"><strong>ANCESTRY</strong>
              <span>{hybridFraction(current.ancestry)>.01?'✧ MIXED HERITAGE':'PURE-LINE FOUNDER'}</span></div>
            <div className="evo-ancestry-bar" role="img"
              aria-label={'Ancestry: '+SPECIES.map(s=>
                SPECIES_INFO[s].name+' '+percent(current.ancestry[s])).join(', ')}>
              {SPECIES.map(s=><div key={s}
                style={{width:percent(current.ancestry[s]),
                  background:SPECIES_INFO[s].color}}/>)}
            </div>
            <div className="evo-ancestry-legend">
              {SPECIES.filter(s=>current.ancestry[s]>.00001).map(s=><span key={s}>
                <i style={{background:SPECIES_INFO[s].color}}/>
                {SPECIES_INFO[s].name} <b>{percent(current.ancestry[s])}</b>
              </span>)}
            </div>
          </section>
          <section className="evo-section-card evo-family-tree-card">
            <div className="evo-card-heading"><strong>ANCESTORS · 2 GENERATIONS</strong>
              <span>Click a relative to explore</span></div>
            <div className="evo-family-tree">
              <div className="evo-family-tree-level grandparents">
                {[0,1,2,3].map(i=>{
                  const parent=current.parents?.[Math.floor(i/2)];
                  const grand=parent?map.get(parent)?.parents?.[i%2]:undefined;
                  return <LifeCard key={i} record={grand?ancestors(grand):undefined}
                    onSelect={onChoose} compact/>;
                })}
              </div>
              <span className="evo-family-tree-line" aria-hidden="true">↓</span>
              <div className="evo-family-tree-level parents">
                {[0,1].map(i=><LifeCard key={i}
                  record={current.parents?ancestors(current.parents[i]):undefined}
                  onSelect={onChoose}/>)}
              </div>
              <span className="evo-family-tree-line" aria-hidden="true">↓</span>
              <div className="evo-family-tree-level center">
                <LifeCard record={current} active onSelect={onChoose}/>
              </div>
              {!!children.length&&<>
                <span className="evo-family-tree-line" aria-hidden="true">↓</span>
                <div className="evo-family-tree-level children">
                  {(showAllChildren?children:children.slice(0,12)).map(r=>
                    <LifeCard record={r} onSelect={onChoose} key={r.id} compact/>)}
                </div>
                {children.length>12&&<button className="evo-family-more"
                  onClick={()=>setShowAllChildren(v=>!v)}>
                  {showAllChildren?'SHOW FEWER':'SHOW ALL '+children.length+' CHILDREN'}
                </button>}
              </>}
            </div>
          </section>
          <div className="evo-family-secondary">
            <section className="evo-section-card">
              <div className="evo-card-heading"><strong>♥ PARTNERS & BONDS</strong></div>
              {partners.length?partners.map(b=><div key={b.id} className="evo-family-bond">
                <span>{b.stage==='partner'?'♥':b.stage==='courting'?'♡':'◌'}</span>
                <div><LifeCard record={ancestors(b.a===current.id?b.b:b.a)}
                  onSelect={onChoose} compact/>
                  <small>{b.stage.toUpperCase()} · Since Y{b.since} ·
                    {b.children.length} children ·
                    Affinity {Math.round(b.strength*100)}%</small></div>
              </div>):<p className="evo-family-help">No recorded bonds yet.
                Mature adults may gradually form bonds after repeated encounters.</p>}
            </section>
            <section className="evo-section-card">
              <div className="evo-card-heading"><strong>◈ SIBLINGS</strong>
                <span>{siblings.length} recorded</span></div>
              {siblings.length?siblings.slice(0,16).map(r=>
                <LifeCard key={r.id} record={r} onSelect={onChoose} compact/>):
                <p className="evo-family-help">No recorded siblings for this individual.</p>}
            </section>
          </div>
        </>}
      </div>
    </div>
  </main>;
}
