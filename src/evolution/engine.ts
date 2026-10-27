/** Evolution Lab 0.1 — deterministic agent ecosystem. One tick = one year.
 *  Individuals forage, migrate, age, reproduce within their species and die.
 *  Local groups found settlements that may be abandoned. Hybrid inheritance,
 *  love, war, disasters, realms and neural learning are future milestones. */
export type Species='human'|'elf'|'dwarf'|'demon';
export type Biome='plains'|'forest'|'mountain'|'cave'|'wasteland'|'volcanic'|'water';
export type WorldSize='small'|'medium'|'large';
export type WorldSettings={
  seed:number;size:WorldSize;starting:Record<Species,number>;
  resourceLevel:number;wandering:number;
};
export type Genes={vigor:number;curiosity:number;fertility:number};
export type Agent={id:number;species:Species;x:number;y:number;age:number;
  energy:number;health:number;genes:Genes;born:number;parents?:[number,number]};
export type Tile={biome:Biome;food:number};
export type Settlement={id:number;species:Species;name:string;x:number;y:number;
  founded:number;population:number;stores:number;emptyYears:number};
export type WorldEvent={id:number;year:number;
  type:'world'|'birth'|'death'|'settlement'|'collapse'|'milestone';message:string};
export type Sample={year:number;total:number;human:number;elf:number;dwarf:number;
  demon:number;births:number;deaths:number;settlements:number};
export type World={version:1;settings:WorldSettings;width:number;height:number;
  year:number;nextAgentId:number;nextSettlementId:number;nextEventId:number;
  rngState:number;tiles:Tile[];agents:Agent[];settlements:Settlement[];
  events:WorldEvent[];history:Sample[];totalBirths:number;totalDeaths:number};
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
  plains:{name:'Plains',color:'#536c55',food:6.5,growth:1.1},
  forest:{name:'Forest',color:'#275c53',food:8,growth:1.4},
  mountain:{name:'Mountains',color:'#61657b',food:3.8,growth:.6},
  cave:{name:'Caverns',color:'#35394f',food:3.2,growth:.42},
  wasteland:{name:'Wasteland',color:'#74546a',food:2.8,growth:.4},
  volcanic:{name:'Volcanic',color:'#87475f',food:2.1,growth:.25},
  water:{name:'Water',color:'#1f4866',food:0,growth:0},
};
export const DEFAULT_SETTINGS:WorldSettings={
  seed:104729,size:'medium',starting:{human:26,elf:19,dwarf:16,demon:13},
  resourceLevel:1,wandering:1,
};
const SIZES:Record<WorldSize,[number,number]>={
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
    size:input.size&&Object.hasOwn(SIZES,input.size)?input.size:'medium',
    starting:Object.fromEntries(SPECIES.map(s=>[s,clamp(Math.trunc(
      Number.isFinite(input.starting?.[s])?input.starting![s]:DEFAULT_SETTINGS.starting[s]
    ),0,75)])) as Record<Species,number>,
    resourceLevel:clamp(Number.isFinite(input.resourceLevel)?input.resourceLevel!:1,.5,1.8),
    wandering:clamp(Number.isFinite(input.wandering)?input.wandering!:1,.5,1.8)};
}
export function population(world:Pick<World,'agents'>):Record<Species,number>{
  const counts={human:0,elf:0,dwarf:0,demon:0};
  for(const a of world.agents)counts[a.species]++;
  return counts;
}
function sample(world:World,births:number,deaths:number):Sample{
  return {year:world.year,total:world.agents.length,...population(world),
    births,deaths,settlements:world.settlements.length};
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
    fertility:inherit('fertility')};
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
  const settings=normalizeSettings(input),[width,height]=SIZES[settings.size];
  const state={n:prngState(settings.seed)};
  const tiles:Tile[]=Array.from({length:width*height},(_,index)=>{
    const biome=biomeAt(index%width,Math.floor(index/width),width,height,settings.seed);
    const info=BIOME_INFO[biome];
    return {biome,food:round(info.food*settings.resourceLevel*(.75+.25*random(state)))};
  });
  const world:World={version:1,settings,width,height,year:0,rngState:state.n,
    nextAgentId:1,nextSettlementId:1,nextEventId:1,
    tiles,agents:[],settlements:[],events:[],history:[],totalBirths:0,totalDeaths:0};
  const occupied=new Set<number>();
  for(const s of SPECIES){
    const info=SPECIES_INFO[s];
    const target={x:Math.round(centers[s][0]*(width-1)),
      y:Math.round(centers[s][1]*(height-1))};
    const closest=tiles.map((t,index)=>({t,x:index%width,y:Math.floor(index/width)}))
      .filter(p=>info.preferred.includes(p.t.biome)).sort((a,b)=>
        (a.x-target.x)**2+(a.y-target.y)**2-
        ((b.x-target.x)**2+(b.y-target.y)**2))[0]??target;
    for(let i=0;i<settings.starting[s];i++){
      const point=freeNearby(world,closest,Math.max(8,Math.ceil(Math.sqrt(i+1)*2.1)),
        occupied,t=>info.preferred.includes(t.biome),state)??
        freeNearby(world,closest,15,occupied,t=>t.biome!=='water',state);
      if(!point)continue;
      occupied.add(offset(width,point.x,point.y));
      const age=i%5===0?Math.floor(random(state)*info.maturity):
        info.maturity+Math.floor(random(state)*info.lifespan*.28);
      world.agents.push({id:world.nextAgentId++,species:s,
        x:point.x,y:point.y,age,energy:round(78+random(state)*19),
        health:round(84+random(state)*16),genes:genes(state),born:-age});
    }
  }
  world.rngState=state.n;
  log(world,'world','A world awakens. Humans, elves, dwarves and demons explore their homelands.');
  world.history.push(sample(world,0,0));
  return world;
}
const adult=(a:Agent)=>a.age>=SPECIES_INFO[a.species].maturity&&
  a.age<SPECIES_INFO[a.species].lifespan*.76;
const favorable=(s:Species,biome:Biome)=>{
  if(s==='human')return biome!=='volcanic'&&biome!=='water';
  if(s==='elf')return biome==='forest'||biome==='plains';
  if(s==='dwarf')return biome==='mountain'||biome==='cave';
  return biome==='wasteland'||biome==='volcanic'||biome==='mountain';
};
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
    events:[...previous.events],history:[...previous.history]};
  const state={n:prngState(previous.rngState)};
  const occupied=new Map<number,number>();
  for(const a of world.agents)occupied.set(offset(world.width,a.x,a.y),a.id);
  // Biome-dependent regrowth and resource limits.
  for(const tile of world.tiles){
    const cfg=BIOME_INFO[tile.biome],limit=cfg.food*world.settings.resourceLevel;
    tile.food=round(clamp(tile.food+
      cfg.growth*world.settings.resourceLevel*(.48+.52*random(state)),0,limit));
  }
  const shuffled=[...world.agents];
  for(let i=shuffled.length-1;i>0;i--){
    const j=Math.floor(random(state)*(i+1));
    [shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]];
  }
  const survivors:Agent[]=[];
  let deaths=0;
  for(const a of shuffled){
    const info=SPECIES_INFO[a.species];
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
        const preference=info.preferred.includes(candidate.biome)?13:0;
        const suit=favorable(a.species,candidate.biome)?14:-17;
        const movement=dx||dy?Math.min(4,a.genes.curiosity*4):2;
        choices.push({x,y,score:candidate.food*3+preference+suit+
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
    const comfortable=favorable(a.species,current.biome);
    const meal=Math.min(current.food,info.metabolism*.065);
    current.food=round(Math.max(0,current.food-meal));
    a.energy=round(clamp(a.energy+
      meal*(comfortable?19:12)*world.settings.resourceLevel-
      info.metabolism*(comfortable?.92:1.25)-a.age/info.lifespan*2,0,100));
    if(a.energy<35)a.health-=2.8+(35-a.energy)*.14;
    else a.health=Math.min(100,a.health+1.5*a.genes.vigor);
    if(!comfortable)a.health-=.35;
    const senescence=a.age>info.lifespan*.82?
      Math.pow((a.age/info.lifespan-.82)/.2,2)*.15:0;
    if(a.energy<=0||a.health<=0||a.age>info.lifespan*1.25||
      random(state)<senescence){
      occupied.delete(offset(world.width,a.x,a.y));deaths++;
    }else{
      a.health=round(clamp(a.health,0,100));survivors.push(a);
    }
  }
  world.agents=survivors;
  // Same-species, mature, nearby agents can reproduce. Love, partnerships,
  // hybrid fertility and cultural lineages belong to a future release.
  const byId=new Map(survivors.map(a=>[a.id,a]));
  const used=new Set<number>(),newborns:Agent[]=[];
  for(const a of survivors){
    if(survivors.length+newborns.length>=850)break;
    if(used.has(a.id)||!adult(a)||a.energy<57||a.health<52)continue;
    const info=SPECIES_INFO[a.species];
    const chance=info.fertility*a.genes.fertility*(a.energy/100)*
      world.settings.resourceLevel;
    if(random(state)>=chance)continue;
    const possible:Agent[]=[];
    for(let y=a.y-2;y<=a.y+2;y++)for(let x=a.x-2;x<=a.x+2;x++){
      if(!within(world.width,world.height,x,y))continue;
      const id=occupied.get(offset(world.width,x,y));
      if(!id||id===a.id||used.has(id))continue;
      const partner=byId.get(id);
      if(partner&&partner.species===a.species&&adult(partner)&&partner.energy>57&&
        partner.health>52&&distance(a,partner)<=2)possible.push(partner);
    }
    if(!possible.length)continue;
    const partner=possible[Math.floor(random(state)*possible.length)];
    const next=freeNearby(world,a,2,new Set(occupied.keys()),
      t=>t.biome!=='water'&&favorable(a.species,t.biome),state);
    if(!next)continue;
    const baby:Agent={id:world.nextAgentId++,species:a.species,x:next.x,y:next.y,
      age:0,energy:77,health:94,genes:genes(state,[a.genes,partner.genes]),
      born:world.year,parents:[a.id,partner.id]};
    newborns.push(baby);
    occupied.set(offset(world.width,next.x,next.y),baby.id);
    used.add(a.id);used.add(partner.id);
    a.energy=round(Math.max(1,a.energy-9));
    partner.energy=round(Math.max(1,partner.energy-9));
  }
  world.agents=[...survivors,...newborns].sort((a,b)=>a.id-b.id);
  for(const a of world.agents){
    if(!adult(a)||world.settlements.length>=54)continue;
    const info=SPECIES_INFO[a.species];
    if(!info.preferred.includes(world.tiles[offset(world.width,a.x,a.y)].biome))
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
  if(deaths)log(world,'death',deaths+' individual'+(deaths===1?'':'s')+
    ' died from old age, exhaustion or harsh conditions.');
  if(world.year%25===0)log(world,'milestone','Year '+world.year+': '+
    world.agents.length+' people, '+world.settlements.length+' settlements.');
  world.rngState=state.n;
  world.history.push(sample(world,births,deaths));
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
    tiles:[...previous.tiles],events:[...previous.events]};
  if(brush.kind==='spawn'){
    const state={n:prngState(previous.rngState)},info=SPECIES_INFO[brush.species];
    const age=info.maturity+Math.floor(random(state)*info.lifespan*.16);
    world.agents.push({id:world.nextAgentId++,species:brush.species,x,y,
      age,energy:88,health:95,genes:genes(state),born:world.year-age});
    world.rngState=state.n;
    log(world,'world','A '+brush.species+' wanderer entered the world.');
  }else if(brush.kind==='food'){
    world.tiles[index]={...tile,food:round(
      BIOME_INFO[tile.biome].food*world.settings.resourceLevel)};
  }else{
    world.tiles[index]={biome:brush.biome,food:round(
      BIOME_INFO[brush.biome].food*world.settings.resourceLevel)};
  }
  world.history=[...previous.history.slice(0,-1),sample(world,0,0)];
  return world;
}
export function isWorld(value:unknown):value is World{
  if(!value||typeof value!=='object')return false;
  const w=value as Partial<World>,settings=w.settings;
  if(w.version!==1||!settings||!Object.hasOwn(SIZES,settings.size)||
    !Number.isSafeInteger(settings.seed)||settings.seed<1||settings.seed>2147483647||
    !Number.isFinite(settings.resourceLevel)||settings.resourceLevel<.5||
    settings.resourceLevel>1.8||!Number.isFinite(settings.wandering)||
    settings.wandering<.5||settings.wandering>1.8||
    !settings.starting||typeof settings.starting!=='object'||
    !SPECIES.every(s=>Number.isInteger(settings.starting[s])&&
      settings.starting[s]>=0&&settings.starting[s]<=75))return false;
  if(!Number.isInteger(w.width)||!Number.isInteger(w.height)||
    !w.width||!w.height||w.width>82||w.height>54||
    w.width!==SIZES[settings.size][0]||w.height!==SIZES[settings.size][1]||
    !Number.isInteger(w.year)||w.year===undefined||w.year<0||w.year>9999||
    !Number.isInteger(w.rngState)||w.rngState===undefined||
    w.rngState<0||w.rngState>4294967295||
    !Number.isSafeInteger(w.nextAgentId)||!Number.isSafeInteger(w.nextSettlementId)||
    !Number.isSafeInteger(w.nextEventId)||
    !Number.isFinite(w.totalBirths)||!Number.isFinite(w.totalDeaths)||
    !Array.isArray(w.tiles)||w.tiles.length!==w.width*w.height||
    !Array.isArray(w.agents)||w.agents.length>850||
    !Array.isArray(w.settlements)||w.settlements.length>54||
    !Array.isArray(w.events)||w.events.length>90||
    !Array.isArray(w.history)||w.history.length>400||w.history.length===0)return false;
  const width=w.width,height=w.height;
  if(!w.tiles.every(t=>t&&BIOMES.includes(t.biome)&&Number.isFinite(t.food)&&
    t.food>=0&&t.food<=16))return false;
  const ids=new Set<number>(),positions=new Set<number>();
  for(const a of w.agents){
    if(!a||!SPECIES.includes(a.species)||!Number.isSafeInteger(a.id)||a.id<=0||
      ids.has(a.id)||!Number.isInteger(a.x)||!Number.isInteger(a.y)||
      !within(width,height,a.x,a.y)||!Number.isInteger(a.age)||a.age<0||
      !Number.isInteger(a.born)||!Number.isFinite(a.energy)||
      a.energy<0||a.energy>100||!Number.isFinite(a.health)||
      a.health<=0||a.health>100||!a.genes||
      !(['vigor','curiosity','fertility'] as const).every(k=>
        Number.isFinite(a.genes[k])&&a.genes[k]>=.5&&a.genes[k]<=1.5)||
      (a.parents!==undefined&&(!Array.isArray(a.parents)||a.parents.length!==2||
        !a.parents.every(p=>Number.isSafeInteger(p)&&p>0))))return false;
    const index=offset(width,a.x,a.y);
    if(positions.has(index)||w.tiles[index].biome==='water')return false;
    ids.add(a.id);positions.add(index);
  }
  const settlementIds=new Set<number>();
  for(const s of w.settlements){
    if(!s||!SPECIES.includes(s.species)||!Number.isSafeInteger(s.id)||
      s.id<=0||settlementIds.has(s.id)||!Number.isInteger(s.x)||
      !Number.isInteger(s.y)||!within(width,height,s.x,s.y)||
      typeof s.name!=='string'||s.name.length>100||
      !Number.isInteger(s.founded)||!Number.isFinite(s.stores)||
      s.stores<0||s.stores>100||!Number.isFinite(s.population)||
      !Number.isInteger(s.emptyYears)||s.emptyYears<0)return false;
    settlementIds.add(s.id);
  }
  if(!w.history.every(p=>Number.isInteger(p.year)&&p.year>=0&&
    Number.isInteger(p.total)&&p.total>=0&&
    Number.isInteger(p.births)&&Number.isInteger(p.deaths)&&
    Number.isInteger(p.settlements)&&
    SPECIES.every(s=>Number.isInteger(p[s])&&p[s]>=0)))return false;
  if(w.history.at(-1)!.year!==w.year||
    w.history.at(-1)!.total!==w.agents.length)return false;
  if(!w.events.every(e=>Number.isSafeInteger(e.id)&&
    Number.isInteger(e.year)&&e.year>=0&&
    ['world','birth','death','settlement','collapse','milestone'].includes(e.type)&&
    typeof e.message==='string'&&e.message.length<500))return false;
  return true;
}
