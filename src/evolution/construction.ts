/** Evolution Lab v0.7 — deterministic settlement construction.
 * Every change is driven by the world tick, not by map zoom or UI visibility.
 */
import type {Agent,Biome,Settlement,Species,World} from './engine';
import {traitProfile} from './family';

export const BUILDING_TYPES=['shelter','house','farm','storage','well',
  'workshop','communal'] as const;
export type BuildingType=typeof BUILDING_TYPES[number];
export type BuildingStage='foundation'|'frame'|'finishing'|'complete'|
  'abandoned'|'ruin';
export const BUILDING_STAGES:BuildingStage[]=['foundation','frame','finishing',
  'complete','abandoned','ruin'];
export type Material='wood'|'stone'|'clay';
export const MATERIALS:Material[]=['wood','stone','clay'];
export type MaterialStock=Record<Material,number>;
export type Building={id:number;type:BuildingType;x:number;y:number;
  culture:Species;stage:BuildingStage;progress:number;condition:number;
  started:number;finished?:number;abandoned?:number;
  spent:MaterialStock;labor:number;householdId?:number};
export type SettlementInfrastructure={land:number[];buildings:Building[];
  roads:number[];stock:MaterialStock;nextBuildingId:number;
  foundedWithResidents:number};
export type RuinSite={id:number;name:string;species:Species;x:number;y:number;
  collapsed:number;buildings:Building[];roads:number[]};
export type Trail={index:number;wear:number};
export type SettlementStage='encampment'|'hamlet'|'village'|'town'|'city';
export const COSTS:Record<BuildingType,{materials:MaterialStock;labor:number}>={
  shelter:{materials:{wood:5,stone:1,clay:2},labor:7},
  house:{materials:{wood:12,stone:5,clay:6},labor:18},
  farm:{materials:{wood:5,stone:2,clay:3},labor:11},
  storage:{materials:{wood:10,stone:6,clay:5},labor:16},
  well:{materials:{wood:4,stone:10,clay:5},labor:17},
  workshop:{materials:{wood:12,stone:11,clay:6},labor:22},
  communal:{materials:{wood:11,stone:9,clay:9},labor:21},
};
export const BUILDING_LABELS:Record<BuildingType,string>={
  shelter:'Shelter',house:'Residence',farm:'Farm',storage:'Storehouse',
  well:'Well',workshop:'Workshop',communal:'Communal hall',
};
export const ARCHITECTURE:Record<Species,{name:string;wall:string;
  roof:string;trim:string}>={
  human:{name:'Timber and clay',wall:'#c99b77',roof:'#9e6853',trim:'#f2d4aa'},
  elf:{name:'Living wood and leaf',wall:'#75b895',roof:'#32775f',trim:'#a9e9bf'},
  dwarf:{name:'Carved masonry',wall:'#9399b7',roof:'#515b81',trim:'#dde2f8'},
  demon:{name:'Basalt and ember',wall:'#766779',roof:'#482e54',trim:'#da879c'},
};
const clamp=(v:number,a=0,b=100)=>Math.max(a,Math.min(b,v));
const round=(v:number)=>Math.round(v*100)/100;
const distance=(a:{x:number;y:number},b:{x:number;y:number})=>
  Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
const position=(w:World,x:number,y:number)=>y*w.width+x;
const inWorld=(w:World,x:number,y:number)=>x>=0&&y>=0&&x<w.width&&y<w.height;
const complete=(b:Building)=>b.stage==='complete';
const stock=():MaterialStock=>({wood:0,stone:0,clay:0});
const materialsFor=(biome:Biome):MaterialStock=>({
  plains:{wood:.65,stone:.1,clay:.75},forest:{wood:1.5,stone:.1,clay:.5},
  mountain:{wood:.12,stone:1.65,clay:.28},cave:{wood:.07,stone:1.55,clay:.15},
  wasteland:{wood:.22,stone:.75,clay:.55},
  volcanic:{wood:.04,stone:1.6,clay:.42},water:stock(),
})[biome];

export function cloneInfrastructure(i:SettlementInfrastructure):SettlementInfrastructure{
  return {...i,land:[...i.land],roads:[...i.roads],stock:{...i.stock},
    buildings:i.buildings.map(b=>({...b,spent:{...b.spent}}))};
}
export function settlementStage(s:Settlement):SettlementStage{
  const buildings=s.infrastructure?.buildings.filter(complete).length??0;
  if(buildings>=24&&s.population>=65)return 'city';
  if(buildings>=12&&s.population>=30)return 'town';
  if(buildings>=6&&s.population>=12)return 'village';
  if(buildings>=2)return 'hamlet';
  return 'encampment';
}
/** Land is physically attached to a settlement, never a viewport region. */
function landClaim(w:World,s:Settlement,radius:number):number[]{
  const owned=new Set(w.settlements.filter(other=>other.id!==s.id)
    .flatMap(other=>other.infrastructure?.land??[]));
  const land:number[]=[],seen=new Set<number>();
  const queue=[{x:s.x,y:s.y}];
  for(let cursor=0;cursor<queue.length&&land.length<300;cursor++){
    const {x,y}=queue[cursor];
    if(!inWorld(w,x,y)||distance({x,y},s)>radius)continue;
    const id=position(w,x,y);
    if(seen.has(id)||owned.has(id)||w.tiles[id].biome==='water')continue;
    seen.add(id);land.push(id);
    // Claim only land connected to the settlement by walkable steps.
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      if(dx||dy)queue.push({x:x+dx,y:y+dy});
    }
  }
  return land;
}
export function prepareInfrastructure(w:World):void{
  w.ruins??=[];w.trails??=[];
  for(const s of w.settlements){
    s.infrastructure??={land:landClaim(w,s,5),buildings:[],roads:[],
      stock:{wood:8,stone:5,clay:6},nextBuildingId:1,
      foundedWithResidents:s.population};
  }
}

/** Available workers still have competing goals, health needs and careers. */
function willingBuilders(w:World,s:Settlement,residents:Agent[]):Agent[]{
  return residents.filter(a=>a.age>=traitProfile(a.ancestry).maturity&&
    a.energy>=58&&a.health>=48&&
    (a.mind?.goal==='build'||a.development?.career==='artisan'||
      ((a.id*13+w.year)%7===0&&
        (a.development?.values.community??50)>=43))); 
}

/** Population needs and the preferences of actual residents select projects. */
function chooseProject(w:World,s:Settlement,residents:Agent[]):BuildingType{
  const buildings=s.infrastructure!.buildings.filter(b=>b.stage!=='ruin'&&
    b.stage!=='abandoned');
  const count=(type:BuildingType)=>buildings.filter(b=>b.type===type).length;
  const adultCount=residents.filter(a=>a.age>=traitProfile(a.ancestry).maturity).length;
  const families=new Set(residents.map(a=>a.development?.householdId)
    .filter((v):v is number=>v!==undefined));
  const unhomed=[...families].filter(id=>!w.households?.find(h=>h.id===id)?.residence);
  const votes=residents.reduce((score,a)=>score+
    ((a.development?.values.community??50)-50)*.008,0);
  const workshops=count('workshop');
  const unmet:Record<BuildingType,number>={
    shelter:count('shelter')===0?22:0,
    house:unhomed.length*3+Math.max(0,families.size-count('house'))*1.2,
    farm:Math.max(0,12+s.population*.25-s.stores*.18-count('farm')*9),
    storage:Math.max(0,7+s.population*.07-count('storage')*8),
    well:count('well')===0?11:Math.max(0,s.population/23-count('well')*5),
    workshop:workshops===0&&adultCount>=5?9:Math.max(0,adultCount/25-workshops*5),
    communal:Math.max(0,3+votes-count('communal')*6),
  };
  // A preference is a vote, not a player-placed blueprint.
  for(const a of residents){
    const d=a.development;
    if(d?.career==='artisan')unmet.workshop+=.8;
    if(d?.career==='forager')unmet.farm+=.45;
    if(d?.career==='healer')unmet.well+=.6;
    if(d?.career==='scholar')unmet.communal+=.35;
    if((d?.values.tradition??0)>62)unmet.house+=.13;
  }
  return [...BUILDING_TYPES].sort((a,b)=>unmet[b]-unmet[a]||
    BUILDING_TYPES.indexOf(a)-BUILDING_TYPES.indexOf(b))[0];
}

/** Site selection is based on safety, biome suitability and real routes. */
function chooseLocation(w:World,s:Settlement,type:BuildingType):{x:number;y:number}|null{
  const infra=s.infrastructure!,used=new Set(infra.buildings.map(b=>position(w,b.x,b.y)));
  const roads=new Set(infra.roads);
  let best=-Infinity,target:null|{x:number;y:number}=null;
  for(const id of infra.land){
    if(used.has(id))continue;
    const x=id%w.width,y=Math.floor(id/w.width),tile=w.tiles[id];
    if(tile.biome==='water')continue;
    const near=distance({x,y},s),hazard=tile.biome==='volcanic'?4:
      tile.biome==='wasteland'?2:0;
    const nearbyRoad=[id-1,id+1,id-w.width,id+w.width].some(n=>roads.has(n));
    const productive=type==='farm'?
      (tile.biome==='plains'?11:tile.biome==='forest'?8:-5):
      type==='well'?([id-1,id+1,id-w.width,id+w.width]
        .some(n=>w.tiles[n]?.biome==='water')?9:1):
      type==='workshop'?(['mountain','cave'].includes(tile.biome)?7:2):
      type==='storage'?Math.max(0,7-near):Math.max(0,6-near);
    const score=productive-near*.8-hazard+(nearbyRoad?4:0)+
      // Stable tie breaker: site choice is independent of rendering.
      ((s.id*97+x*17+y*43)%31)*.01;
    if(score>best){best=score;target={x,y};}
  }
  return target;
}

function beginProject(w:World,s:Settlement,residents:Agent[]):void{
  const i=s.infrastructure!,live=i.buildings.filter(b=>
    !['ruin','abandoned'].includes(b.stage));
  const underway=live.filter(b=>!complete(b));
  if(underway.length>=2||live.length>=76||residents.length<3)return;
  // No automatic blueprint spam if too little community interest or material.
  if(i.stock.wood+i.stock.stone+i.stock.clay<3)return;
  const type=chooseProject(w,s,residents),at=chooseLocation(w,s,type);
  if(!at)return;
  const b:Building={id:i.nextBuildingId++,type,x:at.x,y:at.y,
    culture:s.species,stage:'foundation',progress:0,condition:100,
    started:w.year,spent:stock(),labor:0};
  i.buildings.push(b);
  if(i.buildings.length>90){
    const old=i.buildings.findIndex(v=>v.stage==='ruin');
    if(old>=0)i.buildings.splice(old,1);
  }
}

function gather(w:World,s:Settlement,residents:Agent[]):void{
  const i=s.infrastructure!,adults=residents.filter(a=>
    a.age>=traitProfile(a.ancestry).maturity&&a.energy>45);
  if(!adults.length)return;
  const available=stock();
  for(const id of i.land){
    const biome=w.tiles[id].biome,yieldRate=materialsFor(biome);
    for(const material of MATERIALS)available[material]+=yieldRate[material];
  }
  const workforce=Math.max(.6,Math.min(12,adults.length*.16));
  const cap=Math.min(500,90+i.buildings.filter(b=>
    complete(b)&&b.type==='storage').length*55);
  for(const material of MATERIALS){
    const rate=Math.min(available[material]/28,workforce*
      (material==='wood'?.85:material==='stone'?.57:.65));
    i.stock[material]=round(clamp(i.stock[material]+rate,0,cap));
  }
}

function build(w:World,s:Settlement,residents:Agent[]):void{
  const i=s.infrastructure!,workers=willingBuilders(w,s,residents);
  const workshop=i.buildings.some(b=>b.type==='workshop'&&complete(b));
  let laborPool=workers.reduce((total,a)=>total+
    (a.mind?.goal==='build'?1.65:.7)+
    (a.development?.skills.craft??0)*.018,0)*(workshop?1.3:1);
  for(const worker of workers)
    worker.energy=round(Math.max(1,worker.energy-
      (worker.mind?.goal==='build'?1.1:.35)));
  for(const b of i.buildings){
    if(['ruin','abandoned','complete'].includes(b.stage))continue;
    const cost=COSTS[b.type];
    for(const material of MATERIALS){
      const need=cost.materials[material]-b.spent[material];
      const take=round(Math.max(0,Math.min(need,i.stock[material],
        Math.max(.5,workers.length*.45))));
      b.spent[material]=round(b.spent[material]+take);
      i.stock[material]=round(i.stock[material]-take);
    }
    const delivered=MATERIALS.every(m=>b.spent[m]>=cost.materials[m]-.01);
    if(delivered&&laborPool>0){
      const effort=Math.min(cost.labor-b.labor,laborPool);
      b.labor=round(b.labor+effort);laborPool-=effort;
    }
    const costSum=MATERIALS.reduce((t,m)=>t+cost.materials[m],0);
    const paid=MATERIALS.reduce((t,m)=>t+b.spent[m],0);
    b.progress=round(clamp((paid/costSum*.55+b.labor/cost.labor*.45)*100));
    if(delivered&&b.labor>=cost.labor-.01){
      b.stage='complete';b.progress=100;b.finished=w.year;
    }else b.stage=b.progress<34?'foundation':b.progress<72?'frame':'finishing';
  }
}

/** Residences are occupied by households, not abstract settlement capacity. */
function assignHomes(w:World,s:Settlement,residents:Agent[]):void{
  const i=s.infrastructure!,families=new Set(residents.map(a=>a.development?.householdId)
    .filter((id):id is number=>id!==undefined));
  const localHouses=(w.households??[]).filter(h=>families.has(h.id)||
    h.residence?.settlementId===s.id);
  for(const h of localHouses){
    if(h.residence?.settlementId!==s.id)continue;
    const home=i.buildings.find(b=>b.id===h.residence!.buildingId);
    if(!families.has(h.id)||!home||!complete(home))h.residence=undefined;
  }
  for(const b of i.buildings){
    if(!complete(b)||!['house','shelter'].includes(b.type))continue;
    if(b.householdId&&localHouses.some(h=>h.id===b.householdId&&
      h.residence?.settlementId===s.id&&h.residence.buildingId===b.id))continue;
    const unassigned=localHouses.filter(h=>families.has(h.id)&&!h.residence);
    unassigned.sort((a,c)=>distance(a.home,b)-distance(c.home,b)||a.id-c.id);
    const chosen=unassigned.find(h=>distance(h.home,b)<=10);
    if(chosen){chosen.residence={settlementId:s.id,buildingId:b.id};
      chosen.home={x:b.x,y:b.y};b.householdId=chosen.id;}
    else b.householdId=undefined;
  }
}

function maintain(w:World,s:Settlement):void{
  const i=s.infrastructure!;
  const occupiedHomes=new Set((w.households??[]).filter(h=>
    h.residence?.settlementId===s.id).map(h=>h.residence!.buildingId));
  for(const b of i.buildings){
    if(!['complete','abandoned'].includes(b.stage))continue;
    const occupied=occupiedHomes.has(b.id);
    const needed=s.population>0&&(occupied||!['house','shelter'].includes(b.type));
    b.condition=round(clamp(b.condition+(needed?.38:-2.3)-
      (w.tiles[position(w,b.x,b.y)].biome==='water'?14:0)));
    if(b.condition<=37){
      b.stage=b.condition<=10?'ruin':'abandoned';b.abandoned??=w.year;
      for(const h of w.households??[])
        if(h.residence?.settlementId===s.id&&h.residence.buildingId===b.id)
          h.residence=undefined;
      b.householdId=undefined;
    }
    else if(b.stage==='abandoned'&&needed){b.stage='complete';b.abandoned=undefined;}
  }
}

/** Actual movement leaves wear; unused traces decay. A road follows repeated travel. */
function updateRoutes(w:World,moved:number[]):void{
  const wear=new Map((w.trails??[]).map(t=>[t.index,t.wear*.88]));
  for(const index of moved)wear.set(index,Math.min(100,(wear.get(index)??0)+1.8));
  w.trails=[...wear.entries()].filter(([,v])=>v>=.4)
    .sort((a,b)=>b[1]-a[1]).slice(0,4000)
    .map(([index,v])=>({index,wear:round(v)}));
  const established=new Set(w.trails.filter(t=>t.wear>=4).map(t=>t.index));
  for(const s of w.settlements){
    const i=s.infrastructure;if(!i)continue;
    i.roads=i.land.filter(idx=>established.has(idx)).slice(0,300);
  }
}

/** Physical farms improve local food supply, and wells strengthen communities. */
function applyBenefits(w:World,s:Settlement):void{
  const finished=s.infrastructure?.buildings.filter(complete)??[];
  for(const farm of finished.filter(b=>b.type==='farm')){
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
      const x=farm.x+dx,y=farm.y+dy;
      if(!inWorld(w,x,y))continue;
      const t=w.tiles[position(w,x,y)];
      if(t.biome==='water')continue;
      const original={plains:7.5,forest:9.5,mountain:5,cave:4.5,
        wasteland:4.2,volcanic:3.7}[t.biome];
      // Cultivation speeds replenishment of harvested tiles without creating
      // food above the land's ecological carrying capacity.
      t.food=round(Math.min(original*w.settings.resourceLevel,t.food+.16));
    }
  }
}

export function archiveRuins(w:World,s:Settlement):void{
  if(!s.infrastructure)return;
  for(const household of w.households??[])
    if(household.residence?.settlementId===s.id)household.residence=undefined;
  w.ruins??=[];
  w.ruins.push({id:s.id,name:s.name,species:s.species,x:s.x,y:s.y,
    collapsed:w.year,buildings:s.infrastructure.buildings.map(b=>({...b,
      spent:{...b.spent},stage:b.stage==='ruin'?'ruin':'abandoned',
      abandoned:b.abandoned??w.year})),roads:[...s.infrastructure.roads]});
  if(w.ruins.length>80)w.ruins=w.ruins.slice(-80);
}

/** Run exactly once per simulated year, regardless of UI, zoom, or open tab. */
export function advanceConstruction(w:World,moved:number[]):void{
  prepareInfrastructure(w);
  for(const s of w.settlements){
    const i=s.infrastructure!;
    const residents=w.agents.filter(a=>distance(a,s)<=7);
    const targetRadius=Math.min(9,5+Math.floor(i.buildings.filter(complete).length/8));
    if(targetRadius>5&&w.year%4===0){
      const additional=landClaim(w,s,targetRadius);
      i.land=[...new Set([...i.land,...additional])].slice(0,300);
    }
    gather(w,s,residents);
    if(residents.length>0){beginProject(w,s,residents);build(w,s,residents);}
    assignHomes(w,s,residents);maintain(w,s);applyBenefits(w,s);
  }
  updateRoutes(w,moved);
  for(const ruin of w.ruins??[]){
    for(const b of ruin.buildings){
      if(b.stage==='ruin')continue;
      b.condition=round(Math.max(0,b.condition-3));
      if(b.condition<=10)b.stage='ruin';
    }
  }
}

export function validConstruction(w:World):boolean{
  const validId=(n:number)=>Number.isSafeInteger(n)&&n>0;
  const validPlace=(x:number,y:number)=>Number.isInteger(x)&&Number.isInteger(y)&&
    x>=0&&x<w.width&&y>=0&&y<w.height;
  const validStock=(s:MaterialStock)=>!!s&&MATERIALS.every(m=>
    Number.isFinite(s[m])&&s[m]>=0&&s[m]<=500);
  const validBuilding=(b:Building)=>!!b&&validId(b.id)&&
    BUILDING_TYPES.includes(b.type)&&validPlace(b.x,b.y)&&
    ['human','elf','dwarf','demon'].includes(b.culture)&&
    BUILDING_STAGES.includes(b.stage)&&Number.isFinite(b.progress)&&
    b.progress>=0&&b.progress<=100&&Number.isFinite(b.condition)&&
    b.condition>=0&&b.condition<=100&&Number.isInteger(b.started)&&
    b.started<=w.year&&b.started>=0&&
    (b.finished===undefined||Number.isInteger(b.finished)&&b.finished>=b.started&&
      b.finished<=w.year)&&
    (b.abandoned===undefined||Number.isInteger(b.abandoned)&&
      b.abandoned>=b.started&&b.abandoned<=w.year)&&
    (b.householdId===undefined||validId(b.householdId))&&validStock(b.spent)&&
    Number.isFinite(b.labor)&&b.labor>=0&&b.labor<=1000;
  const validTileIds=(ids:number[],limit:number)=>Array.isArray(ids)&&
    ids.length<=limit&&new Set(ids).size===ids.length&&
    ids.every(n=>Number.isInteger(n)&&n>=0&&n<w.width*w.height);
  const validBuildings=(list:Building[])=>Array.isArray(list)&&list.length<=90&&
    list.every(validBuilding)&&new Set(list.map(b=>b.id)).size===list.length;
  for(const s of w.settlements){
    const i=s.infrastructure;if(i===undefined)continue;
    if(!i||!validTileIds(i.land,300)||!validTileIds(i.roads,300)||
      !i.roads.every(n=>i.land.includes(n))||!validStock(i.stock)||
      !validId(i.nextBuildingId)||!Number.isInteger(i.foundedWithResidents)||
      i.foundedWithResidents<0||!validBuildings(i.buildings)||
      !i.buildings.every(b=>i.land.includes(position(w,b.x,b.y))))return false;
  }
  if(w.ruins!==undefined){
    if(!Array.isArray(w.ruins)||w.ruins.length>80||
      !w.ruins.every(s=>s&&validId(s.id)&&typeof s.name==='string'&&
        s.name.length<=100&&['human','elf','dwarf','demon'].includes(s.species)&&
        validPlace(s.x,s.y)&&Number.isInteger(s.collapsed)&&
        s.collapsed>=0&&s.collapsed<=w.year&&validBuildings(s.buildings)&&
        validTileIds(s.roads,300)))return false;
  }
  if(w.trails!==undefined){
    if(!Array.isArray(w.trails)||w.trails.length>4000||
      !w.trails.every(t=>t&&Number.isInteger(t.index)&&t.index>=0&&
        t.index<w.width*w.height&&Number.isFinite(t.wear)&&
        t.wear>=0&&t.wear<=100)||
      new Set(w.trails.map(t=>t.index)).size!==w.trails.length)return false;
  }
  if(w.households?.some(h=>{
    if(!h.residence)return false;
    const residence=h.residence;
    return !validId(residence.settlementId)||!validId(residence.buildingId)||
      !w.settlements.some(s=>s.id===residence.settlementId&&
        s.infrastructure?.buildings.some(b=>b.id===residence.buildingId&&complete(b)));
  }))return false;
  return true;
}
