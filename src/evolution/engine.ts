/** Evolution Lab 0.1 — deterministic agent ecosystem. One tick = one year.
 *  Individuals forage, migrate, age, pair, produce mixed-ancestry offspring
 *  and form settlements. Wars, disasters and neural learning remain future work. */
import {
  pureAncestry,traitProfile,livingRecord,
  finalizeDeaths,growBonds,offspringFromBonds,hybridFraction,
} from './family';
export type Species='human'|'elf'|'dwarf'|'demon';
export type Biome='plains'|'forest'|'mountain'|'cave'|'wasteland'|'volcanic'|'water';
export type WorldSize='small'|'medium'|'large'|'vast';
export type WorldSettings={
  seed:number;size:WorldSize;starting:Record<Species,number>;
  resourceLevel:number;wandering:number;interbreeding:boolean;
};
export type Genes={vigor:number;curiosity:number;fertility:number;social:number};
export type Ancestry=Record<Species,number>;
export type Agent={id:number;species:Species;ancestry:Ancestry;generation:number;
  x:number;y:number;age:number;energy:number;health:number;genes:Genes;
  born:number;parents?:[number,number];partnerId?:number};
export type Bond={id:number;a:number;b:number;since:number;
  stage:'courting'|'partner'|'ended';strength:number;ended?:number;
  lastBirthYear?:number;children:number[]};
export type LineageRecord={id:number;species:Species;ancestry:Ancestry;
  genes:Genes;born:number;died?:number;generation:number;
  parents?:[number,number];children:number[];partnerIds:number[]};
export type Tile={biome:Biome;food:number};
export type Settlement={id:number;species:Species;name:string;x:number;y:number;
  founded:number;population:number;stores:number;emptyYears:number};
export type WorldEvent={id:number;year:number;
  type:'world'|'birth'|'death'|'settlement'|'collapse'|'milestone'|'bond'|'hybrid';message:string};
export type DeathCause='old_age'|'starvation'|'exposure'|'ill_health';
export const DEATH_CAUSES:DeathCause[]=['old_age','starvation','exposure','ill_health'];
export const DEATH_LABELS:Record<DeathCause,string>={
  old_age:'Old age',starvation:'Starvation',exposure:'Harsh terrain',
  ill_health:'Declining health',
};
export type SpeciesVital={births:number;deaths:number;juvenileDeaths:number;
  ageAtDeathSum:number;causes:Record<DeathCause,number>};
export type Demography={sinceYear:number;bySpecies:Record<Species,SpeciesVital>};
export type YearVital={births:Record<Species,number>;
  deaths:Record<Species,number>;juvenileDeaths:Record<Species,number>;
  causes:Record<DeathCause,number>};
export type Sample={year:number;total:number;human:number;elf:number;dwarf:number;
  demon:number;births:number;deaths:number;settlements:number;vitals?:YearVital};
export type World={version:2;settings:WorldSettings;width:number;height:number;
  year:number;nextAgentId:number;nextSettlementId:number;nextEventId:number;
  nextBondId:number;rngState:number;tiles:Tile[];agents:Agent[];
  settlements:Settlement[];bonds:Bond[];lineage:LineageRecord[];
  events:WorldEvent[];history:Sample[];totalBirths:number;totalDeaths:number;
  demography?:Demography};
export const SPECIES:Species[]=['human','elf','dwarf','demon'];
export const BIOMES:Biome[]=['plains','forest','mountain','cave','wasteland','volcanic','water'];
export const SPECIES_INFO:Record<Species,{name:string;symbol:string;color:string;
  lifespan:number;maturity:number;fertility:number;wander:number;metabolism:number;
  preferred:Biome[];intro:string}>={
  human:{name:'Humans',symbol:'H',color:'#f2c38c',lifespan:74,maturity:16,
    fertility:.23,wander:.60,metabolism:10,preferred:['plains','forest'],
    intro:'Adaptable wanderers · fast generations'},
  elf:{name:'Elves',symbol:'E',color:'#83e7bc',lifespan:245,maturity:36,
    fertility:.072,wander:.18,metabolism:7.5,preferred:['forest'],
    intro:'Forest guardians · slow generations'},
  dwarf:{name:'Dwarves',symbol:'D',color:'#aebdff',lifespan:166,maturity:27,
    fertility:.115,wander:.12,metabolism:8.5,preferred:['mountain','cave'],
    intro:'Mountain dwellers · enduring strongholds'},
  demon:{name:'Demons',symbol:'Δ',color:'#e39afa',lifespan:137,maturity:23,
    fertility:.105,wander:.32,metabolism:10.5,preferred:['wasteland','volcanic'],
    intro:'Borderland survivors · harsh terrain'},
};
export const BIOME_INFO:Record<Biome,{name:string;color:string;food:number;growth:number}>={
  plains:{name:'Plains',color:'#536c55',food:7.5,growth:1.8},
  forest:{name:'Forest',color:'#275c53',food:9.5,growth:2.2},
  mountain:{name:'Mountains',color:'#61657b',food:5,growth:1.15},
  cave:{name:'Caverns',color:'#35394f',food:4.5,growth:.95},
  wasteland:{name:'Wasteland',color:'#74546a',food:4.2,growth:.85},
  volcanic:{name:'Volcanic',color:'#87475f',food:3.7,growth:.73},
  water:{name:'Water',color:'#1f4866',food:0,growth:0},
};
export const DEFAULT_SETTINGS:WorldSettings={
  seed:104729,size:'medium',starting:{human:26,elf:19,dwarf:16,demon:13},
  resourceLevel:1,wandering:1,interbreeding:true,
};
export const WORLD_SIZES:Record<WorldSize,[number,number]>={
  small:[96,64],medium:[160,104],large:[256,160],vast:[320,208],
};
export const LEGACY_SIZES:Record<'small'|'medium'|'large',[number,number]>={
  small:[44,30],medium:[64,42],large:[82,54],
};
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x));
const round=(n:number)=>Math.round(n*100)/100;
const prngState=(n:number)=>(Math.trunc(n)>>>0)||0x6d2b79f5;
function random(state:{n:number}){
  let x=state.n>>>0;
  x^=x<<13;x^=x>>>17;x^=x<<5;
  state.n=x>>>0;
  return state.n/4294967296;
}
const offset=(width:number,x:number,y:number)=>width*y+x;
const within=(w:number,h:number,x:number,y:number)=>x>=0&&y>=0&&x<w&&y<h;
const distance=(a:{x:number;y:number},b:{x:number;y:number})=>
  Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
export function normalizeSettings(input:Partial<WorldSettings>={}):WorldSettings {
  return {seed:Number.isFinite(input.seed)?clamp(Math.trunc(input.seed!),1,2147483647):
    DEFAULT_SETTINGS.seed,
    size:input.size&&Object.hasOwn(WORLD_SIZES,input.size)?input.size:'medium',
    starting:Object.fromEntries(SPECIES.map(s=>[s,clamp(Math.trunc(
      Number.isFinite(input.starting?.[s])?input.starting![s]:DEFAULT_SETTINGS.starting[s]
    ),0,75)])) as Record<Species,number>,
    resourceLevel:clamp(Number.isFinite(input.resourceLevel)?input.resourceLevel!:1,.5,1.8),
    wandering:clamp(Number.isFinite(input.wandering)?input.wandering!:1,.5,1.8),
    interbreeding:input.interbreeding!==false};
}
export function population(world:Pick<World,'agents'>):Record<Species,number>{
  const counts={human:0,elf:0,dwarf:0,demon:0};
  for(const a of world.agents)counts[a.species]++;
  return counts;
}
export function emptyDemography(sinceYear:number):Demography{
  return {sinceYear,bySpecies:Object.fromEntries(SPECIES.map(species=>
    [species,{births:0,deaths:0,juvenileDeaths:0,ageAtDeathSum:0,
      causes:Object.fromEntries(DEATH_CAUSES.map(c=>[c,0]))}])) as Record<Species,SpeciesVital>};
}
function emptyVitalYear():YearVital{
  return {births:Object.fromEntries(SPECIES.map(s=>[s,0])) as Record<Species,number>,
    deaths:Object.fromEntries(SPECIES.map(s=>[s,0])) as Record<Species,number>,
    juvenileDeaths:Object.fromEntries(SPECIES.map(s=>[s,0])) as Record<Species,number>,
    causes:Object.fromEntries(DEATH_CAUSES.map(c=>[c,0])) as Record<DeathCause,number>};
}
function sample(world:World,births:number,deaths:number,vitals?:YearVital):Sample{
  return {year:world.year,total:world.agents.length,...population(world),
    births,deaths,settlements:world.settlements.length,
    ...(vitals?{vitals}: {})};
}
function log(world:World,type:WorldEvent['type'],message:string){
  world.events.push({id:world.nextEventId++,year:world.year,type,message});
  if(world.events.length>90)world.events=world.events.slice(-90);
}
function biomeAt(x:number,y:number,w:number,h:number,seed:number):Biome{
  const u=x/(w-1),v=y/(h-1);
  const noise=(n:number)=>Math.sin(n+seed*.000173);
  const river=.475+.04*noise(v*12)+.017*noise(v*35);
  if(Math.abs(u-river)<.012||Math.hypot((u-.62)*1.6,(v-.20)*1.2)<.05)
    return 'water';
  // Remote scorched corners are the demons' starting borderlands.
  if(u>.82&&(v<.36||v>.72)){
    const edge=Math.min(Math.hypot(u-.95,v-.09),Math.hypot(u-.95,v-.90));
    return edge<.125?'volcanic':'wasteland';
  }
  const ridge=.66+.075*noise(v*9)+.025*noise(v*26);
  if(u>ridge&&v>.27&&v<.86)
    return (noise(x*.9+y*.51)*.5+.5)>.68?'cave':'mountain';
  const forest=.34+.065*noise(v*10)+.035*noise(v*31);
  if(u<forest||(u<.53&&Math.sin(x*.28+y*.21+seed*.008)>.72))
    return 'forest';
  if(u>.79&&v<.24)return 'wasteland';
  return 'plains';
}
function genes(state:{n:number},parents?:[Genes,Genes]):Genes{
  const inherit=(key:keyof Genes)=>{
    const value=parents?(parents[0][key]+parents[1][key])*.5+
      (random(state)-.5)*.16:.8+random(state)*.4;
    return round(clamp(value,.65,1.4));
  };
  return {vigor:inherit('vigor'),curiosity:inherit('curiosity'),
    fertility:inherit('fertility'),social:inherit('social')};
}
function freeNearby(world:World,origin:{x:number;y:number},radius:number,
  occupied:Set<number>,accept:(tile:Tile)=>boolean,state:{n:number}){
  const possible:{x:number;y:number;score:number}[]=[];
  for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
    const x=origin.x+dx,y=origin.y+dy;
    if(!within(world.width,world.height,x,y)||occupied.has(offset(world.width,x,y)))continue;
    if(!accept(world.tiles[offset(world.width,x,y)]))continue;
    possible.push({x,y,score:Math.abs(dx)+Math.abs(dy)+random(state)*3});
  }
  possible.sort((a,b)=>a.score-b.score);
  return possible[0]??null;
}
const centers:Record<Species,[number,number]>={
  human:[.42,.66],elf:[.18,.45],dwarf:[.70,.58],demon:[.91,.15],
};
export function createWorld(input:Partial<WorldSettings>={}):World{
  const settings=normalizeSettings(input),[width,height]=WORLD_SIZES[settings.size];
  const state={n:prngState(settings.seed)};
  const tiles:Tile[]=Array.from({length:width*height},(_,index)=>{
    const biome=biomeAt(index%width,Math.floor(index/width),width,height,settings.seed);
    const info=BIOME_INFO[biome];
    return {biome,food:round(info.food*settings.resourceLevel*(.75+.25*random(state)))};
  });
  const world:World={version:2,settings,width,height,year:0,rngState:state.n,
    nextAgentId:1,nextSettlementId:1,nextEventId:1,nextBondId:1,
    tiles,agents:[],settlements:[],bonds:[],lineage:[],
    events:[],history:[],totalBirths:0,totalDeaths:0,demography:emptyDemography(0)};
  const occupied=new Set<number>();
  for(const s of SPECIES){
    const info=SPECIES_INFO[s];
    const target={x:Math.round(centers[s][0]*(width-1)),
      y:Math.round(centers[s][1]*(height-1))};
    // Nearest favored starting biome in O(tiles) rather than sorting huge worlds.
    let closest=target,closestD=Infinity;
    for(let index=0;index<tiles.length;index++){
      if(!info.preferred.includes(tiles[index].biome))continue;
      const x=index%width,y=Math.floor(index/width);
      const d=(x-target.x)**2+(y-target.y)**2;
      if(d<closestD){closestD=d;closest={x,y};}
    }
    for(let i=0;i<settings.starting[s];i++){
      const point=freeNearby(world,closest,Math.max(8,Math.ceil(Math.sqrt(i+1)*2.1)),
        occupied,t=>info.preferred.includes(t.biome),state)??
        freeNearby(world,closest,15,occupied,t=>t.biome!=='water',state);
      if(!point)continue;
      occupied.add(offset(width,point.x,point.y));
      const age=i%5===0?Math.floor(random(state)*info.maturity):
        info.maturity+Math.floor(random(state)*info.lifespan*.28);
      const founder:Agent={id:world.nextAgentId++,species:s,
        ancestry:pureAncestry(s),generation:0,
        x:point.x,y:point.y,age,energy:round(78+random(state)*19),
        health:round(84+random(state)*16),genes:genes(state),born:age===0?0:-age};
      world.agents.push(founder);
      world.lineage.push(livingRecord(founder));
    }
  }
  world.rngState=state.n;
  log(world,'world','A world awakens. Humans, elves, dwarves and demons explore their homelands.');
  world.history.push(sample(world,0,0));
  return world;
}
const adult=(a:Agent)=>{
  const profile=traitProfile(a.ancestry);
  return a.age>=profile.maturity&&a.age<profile.lifespan*.76;
};
const favorable=(s:Species,biome:Biome)=>{
  if(s==='human')return biome!=='volcanic'&&biome!=='water';
  if(s==='elf')return biome==='forest'||biome==='plains';
  if(s==='dwarf')return biome==='mountain'||biome==='cave';
  return biome==='wasteland'||biome==='volcanic'||biome==='mountain';
};
export const biomeSuitability=(ancestry:Ancestry,biome:Biome)=>
  SPECIES.reduce((score,s)=>score+ancestry[s]*(favorable(s,biome)?1:0),0);
const settlementNames:Record<Species,string[]>={
  human:['Riverwatch','Ashvale','Westmere','Brightford','Stonebridge','Dawnreach'],
  elf:['Silvanor','Moonbloom','Evershade','Lunaris','Glimmerwood','Thornsong'],
  dwarf:['Ironhollow','Deepdelve','Anvilfall','Goldvein','Underpeak','Stoneforge'],
  demon:['Cinderhold','Ashrift','Nightspire','Emberreach','Duskfort','Blackflame'],
};
export function stepWorld(previous:World):World{
  const world:World={...previous,year:previous.year+1,
    tiles:previous.tiles.map(t=>({...t})),
    agents:previous.agents.map(a=>({...a})),
    settlements:previous.settlements.map(s=>({...s})),
    bonds:previous.bonds.map(b=>({...b,children:[...b.children]})),
    lineage:previous.lineage.map(r=>({...r,children:[...r.children],
      partnerIds:[...r.partnerIds]})),
    events:[...previous.events],history:[...previous.history],
    demography:previous.demography?{
      sinceYear:previous.demography.sinceYear,
      bySpecies:Object.fromEntries(SPECIES.map(s=>[s,
        {...previous.demography!.bySpecies[s],
          causes:{...previous.demography!.bySpecies[s].causes}}])) as Record<Species,SpeciesVital>,
    }:emptyDemography(previous.year)};
  const state={n:prngState(previous.rngState)};
  const yearVitals=emptyVitalYear();
  const occupied=new Map<number,number>();
  for(const a of world.agents)occupied.set(offset(world.width,a.x,a.y),a.id);
  // Biome-dependent regrowth and resource limits.
  for(const tile of world.tiles){
    const cfg=BIOME_INFO[tile.biome],limit=cfg.food*world.settings.resourceLevel;
    tile.food=round(clamp(tile.food+
      cfg.growth*world.settings.resourceLevel*(.48+.52*random(state)),0,limit));
  }
  const partnerPositions=new Map(world.agents.map(a=>[a.id,a]));
  const closeContacts=new Map<number,number>();
  for(const b of world.bonds){
    if(b.stage==='ended')continue;
    closeContacts.set(b.a,b.b);
    closeContacts.set(b.b,b.a);
  }
  const shuffled=[...world.agents];
  for(let i=shuffled.length-1;i>0;i--){
    const j=Math.floor(random(state)*(i+1));
    [shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];
  }
  const survivors:Agent[]=[];
  let deaths=0;
  for(const a of shuffled){
    const info=traitProfile(a.ancestry);
    const tile=world.tiles[offset(world.width,a.x,a.y)];
    a.age++;
    const travel=clamp(info.wander*a.genes.curiosity*world.settings.wandering,0,.94);
    if(random(state)<travel||a.energy<48||tile.food<.75){
      const choices:{x:number;y:number;score:number}[]=[];
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        const x=a.x+dx,y=a.y+dy;
        if(!within(world.width,world.height,x,y))continue;
        const index=offset(world.width,x,y),candidate=world.tiles[index];
        if(candidate.biome==='water'||(occupied.has(index)&&occupied.get(index)!==a.id))
          continue;
        const suitability=biomeSuitability(a.ancestry,candidate.biome);
        const preference=suitability*13;
        const suit=suitability*14+(1-suitability)*-17;
        const movement=dx||dy?Math.min(4,a.genes.curiosity*4):2;
        const mate=partnerPositions.get(closeContacts.get(a.id)??-1);
        const mateRange=mate?distance({x,y},mate):Infinity;
        // Courtship and partners intentionally remain near one another.
        // Nearby forage can still win when an individual is hungry.
        const toward=mate?
          Math.max(-20,Math.min(20,(distance(a,mate)-mateRange)*16))+
          (mateRange<=2?6:0):0;
        choices.push({x,y,score:candidate.food*3+preference+suit+toward+
          random(state)*(3+info.wander*14*world.settings.wandering)+movement});
      }
      choices.sort((a,b)=>b.score-a.score);
      const chosen=choices[0];
      if(chosen&&(chosen.x!==a.x||chosen.y!==a.y)){
        occupied.delete(offset(world.width,a.x,a.y));
        a.x=chosen.x;a.y=chosen.y;
        occupied.set(offset(world.width,a.x,a.y),a.id);
        a.energy-=1.5;
      }
    }
    const current=world.tiles[offset(world.width,a.x,a.y)];
    const suitability=biomeSuitability(a.ancestry,current.biome);
    const comfortable=suitability>.45;
    const juvenile=a.age<info.maturity;
    // An individual forages the immediate neighborhood, rather than relying
    // entirely on the resources of one tile. Each gathered unit is actually
    // withdrawn from terrain; dense populations deplete their local supply.
    const targetMeal=info.metabolism*(juvenile?.074:.11);
    let gathered=0;
    const sites:{tile:Tile;score:number}[]=[];
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const x=a.x+dx,y=a.y+dy;
      if(!within(world.width,world.height,x,y))continue;
      const source=world.tiles[offset(world.width,x,y)];
      if(source.biome==='water'||source.food<=0)continue;
      sites.push({tile:source,score:source.food+(dx===0&&dy===0?2:0)});
    }
    sites.sort((x,y)=>y.score-x.score);
    for(const site of sites){
      const take=Math.min(site.tile.food,targetMeal-gathered);
      site.tile.food=round(Math.max(0,site.tile.food-take));
      gathered+=take;
      if(gathered>=targetMeal-.001)break;
    }
    const dailyCost=info.metabolism*(juvenile?.62:1)*
      (comfortable?.86:1.12);
    const nourishment=gathered*(comfortable?13.4:10.5);
    a.energy=round(clamp(a.energy+nourishment-dailyCost-
      Math.max(0,a.age/info.lifespan-.7)*1.3,0,100));
    // Basic community support: nearby mature peers can help a hungry child.
    // This is deliberately modest; full households/caregivers come in v0.5.
    if(juvenile&&a.energy<58){
      careSearch: for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){
        const x=a.x+dx,y=a.y+dy;
        if(!within(world.width,world.height,x,y))continue;
        const helper=partnerPositions.get(occupied.get(offset(world.width,x,y))??-1);
        if(helper&&helper.id!==a.id&&helper.species===a.species&&
          helper.age>=traitProfile(helper.ancestry).maturity&&helper.energy>63){
          const aid=Math.min(5,helper.energy-63,65-a.energy);
          if(aid>0){a.energy=round(clamp(a.energy+aid,0,100));
            helper.energy=round(Math.max(1,helper.energy-aid));}
          break careSearch;
        }
      }
    }
    if(a.energy<32)a.health-=2.5+(32-a.energy)*.21;
    else a.health=Math.min(100,a.health+1.45*a.genes.vigor);
    if(!comfortable)a.health-=.45*(1-suitability);
    // Very low senescence until old age, then sharply increasing mortality.
    const ageRatio=a.age/info.lifespan;
    const senescence=ageRatio>.84?
      Math.min(.9,Math.pow((ageRatio-.84)/.30,2)*.20):0;
    let cause:DeathCause|null=null;
    if(a.energy<=0||a.health<=0){
      cause=a.energy<30?'starvation':suitability<.45?'exposure':'ill_health';
    }else if(ageRatio>1.22||random(state)<senescence){
      cause='old_age';
    }
    if(cause){
      occupied.delete(offset(world.width,a.x,a.y));
      deaths++;
      yearVitals.deaths[a.species]++;
      yearVitals.causes[cause]++;
      if(juvenile)yearVitals.juvenileDeaths[a.species]++;
      const record=world.demography!.bySpecies[a.species];
      record.deaths++;record.causes[cause]++;
      record.ageAtDeathSum+=a.age;
      if(juvenile)record.juvenileDeaths++;
    }else{
      a.health=round(clamp(a.health,0,100));survivors.push(a);
    }
  }
  world.agents=survivors;
  finalizeDeaths(world,survivors,world.year);
  const partnerships=growBonds(world,()=>random(state));
  if(partnerships)log(world,'bond',partnerships+' partnership'+
    (partnerships===1?'':'s')+' formed this year.');
  const newborns=offspringFromBonds(world,()=>random(state),(parent,ancestry)=>{
    const point=freeNearby(world,parent,2,new Set(occupied.keys()),
      t=>t.biome!=='water'&&biomeSuitability(ancestry,t.biome)>.34,state);
    if(point)occupied.set(offset(world.width,point.x,point.y),-1);
    return point;
  });
  world.agents=[...survivors,...newborns].sort((a,b)=>a.id-b.id);
  for(const baby of newborns){
    world.demography!.bySpecies[baby.species].births++;
    yearVitals.births[baby.species]++;
  }
  const hybrids=newborns.filter(a=>hybridFraction(a.ancestry)>.01).length;
  if(hybrids)log(world,'hybrid',hybrids+' mixed-ancestry child'+
    (hybrids===1?'':'ren')+' born this year.');
  for(const a of world.agents){
    if(!adult(a)||world.settlements.length>=54)continue;
    const info=SPECIES_INFO[a.species];
    if(biomeSuitability(a.ancestry,world.tiles[offset(world.width,a.x,a.y)].biome)<.55)
      continue;
    if(world.settlements.some(s=>distance(s,a)<=7))continue;
    const nearby=world.agents.filter(b=>b.species===a.species&&adult(b)&&
      distance(a,b)<=4);
    if(nearby.length<4)continue;
    const id=world.nextSettlementId++;
    const names=settlementNames[a.species];
    const n=world.settlements.filter(s=>s.species===a.species).length;
    const name=names[n%names.length]+(n>=names.length?' '+(1+Math.floor(n/names.length)):'');
    world.settlements.push({id,species:a.species,name,x:a.x,y:a.y,
      founded:world.year,population:nearby.length,stores:20,emptyYears:0});
    log(world,'settlement',info.name+' founded '+name+' in the '+
      BIOME_INFO[world.tiles[offset(world.width,a.x,a.y)].biome].name.toLowerCase()+'.');
  }
  world.settlements=world.settlements.filter(s=>{
    const residents=world.agents.filter(a=>distance(a,s)<=5).length;
    s.population=residents;
    const local=world.tiles[offset(world.width,s.x,s.y)];
    s.stores=round(clamp(s.stores+(residents>0?local.food*.35-residents*.13:-2),0,100));
    s.emptyYears=residents===0?s.emptyYears+1:0;
    if(s.emptyYears>=5){
      log(world,'collapse',s.name+' was abandoned after its population disappeared.');
      return false;
    }
    return true;
  });
  const births=newborns.length;
  world.totalBirths+=births;world.totalDeaths+=deaths;
  if(births)log(world,'birth',births+' newborn'+(births===1?'':'s')+' entered the world.');
  if(deaths){
    const breakdown=DEATH_CAUSES.filter(c=>yearVitals.causes[c]>0)
      .map(c=>DEATH_LABELS[c].toLowerCase()+': '+yearVitals.causes[c]).join(', ');
    log(world,'death',deaths+' individual'+(deaths===1?'':'s')+
      ' died ('+breakdown+').');
  }
  if(world.year%25===0)log(world,'milestone','Year '+world.year+': '+
    world.agents.length+' people, '+world.settlements.length+' settlements.');
  world.rngState=state.n;
  world.history.push(sample(world,births,deaths,yearVitals));
  if(world.history.length>400)world.history=world.history.slice(-400);
  return world;
}
export function advanceWorld(world:World,years:number):World{
  let next=world;
  for(let i=0;i<clamp(Math.trunc(years),0,200);i++)next=stepWorld(next);
  return next;
}
export type Brush={kind:'inspect'}|{kind:'spawn';species:Species}|
  {kind:'food'}|{kind:'terrain';biome:Biome};
export function editWorld(previous:World,x:number,y:number,brush:Brush):World{
  if(!within(previous.width,previous.height,x,y)||brush.kind==='inspect')return previous;
  const index=offset(previous.width,x,y),tile=previous.tiles[index];
  if(brush.kind==='spawn'&&(previous.agents.length>=850||tile.biome==='water'||
    previous.agents.some(a=>a.x===x&&a.y===y)))return previous;
  if(brush.kind==='terrain'&&brush.biome==='water'&&
    previous.agents.some(a=>a.x===x&&a.y===y))return previous;
  const world:World={...previous,agents:[...previous.agents],
    tiles:[...previous.tiles],lineage:[...previous.lineage],
    events:[...previous.events]};
  if(brush.kind==='spawn'){
    const state={n:prngState(previous.rngState)},info=SPECIES_INFO[brush.species];
    const age=info.maturity+Math.floor(random(state)*info.lifespan*.16);
    const newcomer:Agent={id:world.nextAgentId++,species:brush.species,
      ancestry:pureAncestry(brush.species),generation:0,x,y,
      age,energy:88,health:95,genes:genes(state),born:world.year-age};
    world.agents.push(newcomer);
    world.lineage.push(livingRecord(newcomer));
    world.rngState=state.n;
    log(world,'world','A '+brush.species+' wanderer entered the world.');
  }else if(brush.kind==='food'){
    world.tiles[index]={...tile,food:round(
      BIOME_INFO[tile.biome].food*world.settings.resourceLevel)};
  }else{
    world.tiles[index]={biome:brush.biome,food:round(
      BIOME_INFO[brush.biome].food*world.settings.resourceLevel)};
  }
  const last=previous.history.at(-1);
  world.history=[...previous.history.slice(0,-1),
    {...(last??sample(previous,0,0)),total:world.agents.length,
      ...population(world)}];
  return world;
}
export function isWorld(value:unknown):value is World{
  if(!value||typeof value!=='object')return false;
  const w=value as Partial<World>,settings=w.settings;
  if(w.version!==2||!settings||!Object.hasOwn(WORLD_SIZES,settings.size)||
    !Number.isSafeInteger(settings.seed)||settings.seed<1||settings.seed>2147483647||
    !Number.isFinite(settings.resourceLevel)||settings.resourceLevel<.5||
    settings.resourceLevel>1.8||!Number.isFinite(settings.wandering)||
    settings.wandering<.5||settings.wandering>1.8||
    typeof settings.interbreeding!=='boolean'||
    !settings.starting||typeof settings.starting!=='object'||
    !SPECIES.every(s=>Number.isInteger(settings.starting[s])&&
      settings.starting[s]>=0&&settings.starting[s]<=75))return false;
  if(!Number.isInteger(w.width)||!Number.isInteger(w.height)||
    !w.width||!w.height||w.width>320||w.height>208||
    !([WORLD_SIZES[settings.size],
      ...(['small','medium','large'].includes(settings.size)?
        [LEGACY_SIZES[settings.size as keyof typeof LEGACY_SIZES]]:[])]
      .some(([width,height])=>w.width===width&&w.height===height))||
    !Number.isInteger(w.year)||w.year===undefined||w.year<0||w.year>9999||
    !Number.isInteger(w.rngState)||w.rngState===undefined||
    w.rngState<0||w.rngState>4294967295||
    !Number.isSafeInteger(w.nextAgentId)||(w.nextAgentId as number)<1||
    !Number.isSafeInteger(w.nextSettlementId)||(w.nextSettlementId as number)<1||
    !Number.isSafeInteger(w.nextEventId)||(w.nextEventId as number)<1||
    !Number.isSafeInteger(w.nextBondId)||(w.nextBondId as number)<1||
    !Number.isInteger(w.totalBirths)||(w.totalBirths as number)<0||
    !Number.isInteger(w.totalDeaths)||(w.totalDeaths as number)<0||
    !Array.isArray(w.tiles)||w.tiles.length!==w.width*w.height||
    !Array.isArray(w.agents)||w.agents.length>850||
    !Array.isArray(w.settlements)||w.settlements.length>54||
    !Array.isArray(w.bonds)||w.bonds.length>6000||
    !Array.isArray(w.lineage)||w.lineage.length>14000||
    !Array.isArray(w.events)||w.events.length>90||
    !Array.isArray(w.history)||w.history.length>400||w.history.length===0)return false;
  const width=w.width,height=w.height;
  if(!w.tiles.every(t=>t&&BIOMES.includes(t.biome)&&Number.isFinite(t.food)&&
    t.food>=0&&t.food<=20))return false;
  const ids=new Set<number>(),positions=new Set<number>();
  const checkGenes=(g:Genes)=>!!g&&
    (['vigor','curiosity','fertility','social'] as const).every(k=>
      Number.isFinite(g[k])&&g[k]>=.5&&g[k]<=1.5);
  const checkAncestry=(a:Ancestry)=>!!a&&SPECIES.every(s=>
    Number.isFinite(a[s])&&a[s]>=0&&a[s]<=1)&&
    Math.abs(SPECIES.reduce((sum,s)=>sum+a[s],0)-1)<.0001;
  for(const a of w.agents){
    if(!a||!SPECIES.includes(a.species)||!Number.isSafeInteger(a.id)||a.id<=0||
      ids.has(a.id)||!Number.isInteger(a.x)||!Number.isInteger(a.y)||
      !within(width,height,a.x,a.y)||!Number.isInteger(a.age)||a.age<0||
      !Number.isInteger(a.born)||!Number.isInteger(a.generation)||a.generation<0||
      !checkAncestry(a.ancestry)||!checkGenes(a.genes)||
      !Number.isFinite(a.energy)||a.energy<0||a.energy>100||
      !Number.isFinite(a.health)||a.health<=0||a.health>100||
      (a.partnerId!==undefined&&(!Number.isSafeInteger(a.partnerId)||a.partnerId<=0))||
      (a.parents!==undefined&&(!Array.isArray(a.parents)||a.parents.length!==2||
        !a.parents.every(p=>Number.isSafeInteger(p)&&p>0))))return false;
    const index=offset(width,a.x,a.y);
    if(positions.has(index)||w.tiles[index].biome==='water')return false;
    ids.add(a.id);positions.add(index);
  }
  const settlementIds=new Set<number>();
  for(const v of w.settlements){
    if(!v||!SPECIES.includes(v.species)||!Number.isSafeInteger(v.id)||
      v.id<=0||settlementIds.has(v.id)||!Number.isInteger(v.x)||
      !Number.isInteger(v.y)||!within(width,height,v.x,v.y)||
      typeof v.name!=='string'||v.name.length>100||
      !Number.isInteger(v.founded)||!Number.isFinite(v.stores)||
      v.stores<0||v.stores>100||!Number.isFinite(v.population)||
      !Number.isInteger(v.emptyYears)||v.emptyYears<0)return false;
    settlementIds.add(v.id);
  }
  const bondIds=new Set<number>(),activeBondIds=new Set<number>();
  for(const b of w.bonds){
    if(!b||!Number.isSafeInteger(b.id)||bondIds.has(b.id)||
      !Number.isSafeInteger(b.a)||!Number.isSafeInteger(b.b)||b.a===b.b||
      !Number.isInteger(b.since)||b.since>w.year||
      !['courting','partner','ended'].includes(b.stage)||
      !Number.isFinite(b.strength)||b.strength<0||b.strength>1||
      (b.lastBirthYear!==undefined&&
        (!Number.isInteger(b.lastBirthYear)||b.lastBirthYear>w.year||b.lastBirthYear<b.since))||
      !Array.isArray(b.children)||b.children.length>1000||
      !b.children.every(id=>Number.isSafeInteger(id)&&id>0)||
      (b.ended!==undefined&&!Number.isInteger(b.ended)))return false;
    bondIds.add(b.id);
    if(b.stage!=='ended'){
      if(activeBondIds.has(b.a)||activeBondIds.has(b.b)||!ids.has(b.a)||!ids.has(b.b))
        return false;
      activeBondIds.add(b.a);activeBondIds.add(b.b);
    }
  }
  const records=new Set<number>();
  for(const r of w.lineage){
    if(!r||!Number.isSafeInteger(r.id)||r.id<=0||records.has(r.id)||
      !SPECIES.includes(r.species)||!checkGenes(r.genes)||
      !checkAncestry(r.ancestry)||!Number.isInteger(r.generation)||r.generation<0||
      !Number.isInteger(r.born)||
      (r.died!==undefined&&(!Number.isInteger(r.died)||r.died<r.born))||
      !Array.isArray(r.children)||!Array.isArray(r.partnerIds)||
      r.children.length>2000||r.partnerIds.length>200||
      ![...r.children,...r.partnerIds].every(id=>Number.isSafeInteger(id)&&id>0)||
      (r.parents!==undefined&&(!Array.isArray(r.parents)||r.parents.length!==2||
        !r.parents.every(id=>Number.isSafeInteger(id)&&id>0))))return false;
    records.add(r.id);
  }
  // Optional because v0.2 JSON saves had no diagnostics. New saves are
  // populated with statistics from the year they begin tracking.
  if(w.demography!==undefined){
    const d=w.demography;
    if(!d||!Number.isInteger(d.sinceYear)||d.sinceYear<0||
      d.sinceYear>w.year||!d.bySpecies||
      !SPECIES.every(species=>{
        const r=d.bySpecies[species];
        return !!r&&Number.isInteger(r.births)&&r.births>=0&&
          Number.isInteger(r.deaths)&&r.deaths>=0&&
          Number.isInteger(r.juvenileDeaths)&&r.juvenileDeaths>=0&&
          r.juvenileDeaths<=r.deaths&&Number.isFinite(r.ageAtDeathSum)&&
          r.ageAtDeathSum>=0&&r.causes&&
          DEATH_CAUSES.every(c=>Number.isInteger(r.causes[c])&&r.causes[c]>=0)&&
          DEATH_CAUSES.reduce((n,c)=>n+r.causes[c],0)===r.deaths;
      }))return false;
  }
  if(!w.agents.every(a=>records.has(a.id)))return false;
  if(!w.history.every(p=>{
    const valid=Number.isInteger(p.year)&&p.year>=0&&
      Number.isInteger(p.total)&&p.total>=0&&
      Number.isInteger(p.births)&&p.births>=0&&
      Number.isInteger(p.deaths)&&p.deaths>=0&&
      Number.isInteger(p.settlements)&&
      SPECIES.every(s=>Number.isInteger(p[s])&&p[s]>=0);
    if(!valid)return false;
    if(!p.vitals)return true; // Prior snapshots need no fabricated history.
    return SPECIES.every(s=>Number.isInteger(p.vitals!.births[s])&&
      p.vitals!.births[s]>=0&&Number.isInteger(p.vitals!.deaths[s])&&
      p.vitals!.deaths[s]>=0&&Number.isInteger(p.vitals!.juvenileDeaths[s])&&
      p.vitals!.juvenileDeaths[s]>=0)&&
      DEATH_CAUSES.every(c=>Number.isInteger(p.vitals!.causes[c])&&
        p.vitals!.causes[c]>=0)&&
      SPECIES.reduce((n,s)=>n+p.vitals!.births[s],0)===p.births&&
      SPECIES.reduce((n,s)=>n+p.vitals!.deaths[s],0)===p.deaths&&
      DEATH_CAUSES.reduce((n,c)=>n+p.vitals!.causes[c],0)===p.deaths;
  }))return false;
  if(w.history.at(-1)!.year!==w.year||
    w.history.at(-1)!.total!==w.agents.length)return false;
  if(!w.events.every(e=>Number.isSafeInteger(e.id)&&
    Number.isInteger(e.year)&&e.year>=0&&
    ['world','birth','death','settlement','collapse','milestone','bond','hybrid']
      .includes(e.type)&&typeof e.message==='string'&&e.message.length<500))
    return false;
  return true;
}
