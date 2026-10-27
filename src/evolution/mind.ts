/** Mind Engine I — explainable, deterministic utility-based choices.
 * No language model is invoked: each mind responds to observable needs,
 * relationships and remembered experience, then chooses where to travel.
 */
import type {Agent,Ancestry,Biome,World} from './engine';

export type MindGoal='forage'|'seek_safety'|'seek_family'|'seek_partner'|
  'stay_together'|'explore';
export type PlaceMemory={x:number;y:number;year:number};
export type AgentMind={goal:MindGoal;reason:string;since:number;
  target?:{x:number;y:number};targetPersonId?:number;lastScarcity?:PlaceMemory;
  lastGoodFood?:PlaceMemory};

export const MIND_GOALS:MindGoal[]=[
  'forage','seek_safety','seek_family','seek_partner','stay_together','explore',
];
export const GOAL_LABELS:Record<MindGoal,string>={
  forage:'Gather food',seek_safety:'Find safer ground',
  seek_family:'Stay near family',seek_partner:'Find companionship',
  stay_together:'Stay with partner',explore:'Explore the world',
};
export const initialMind=(year:number):AgentMind=>({goal:'explore',
  reason:'Discovering a new world.',since:year});
const distance=(a:{x:number;y:number},b:{x:number;y:number})=>
  Math.max(Math.abs(a.x-b.x),Math.abs(a.y-b.y));
const inBounds=(w:World,x:number,y:number)=>
  x>=0&&y>=0&&x<w.width&&y<w.height;
const index=(w:World,x:number,y:number)=>y*w.width+x;
const edible=(w:World,x:number,y:number)=>
  inBounds(w,x,y)&&w.tiles[index(w,x,y)].biome!=='water';

/** Amount of forage reachable from a proposed location, not just its tile. */
export function foodAround(w:World,x:number,y:number):number{
  let sum=0;
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
    if(edible(w,x+dx,y+dy))sum+=w.tiles[index(w,x+dx,y+dy)].food;
  }
  return sum;
}

function nearestPerson(w:World,a:Agent,occupied:Map<number,number>,
  byId:Map<number,Agent>,eligible:(b:Agent)=>boolean,limit=6):Agent|undefined{
  let best:Agent|undefined,bestScore=Infinity;
  for(let dy=-limit;dy<=limit;dy++)for(let dx=-limit;dx<=limit;dx++){
    const x=a.x+dx,y=a.y+dy;
    if(!inBounds(w,x,y))continue;
    const id=occupied.get(index(w,x,y)),person=id===undefined?undefined:byId.get(id);
    if(!person||person.id===a.id||!eligible(person))continue;
    const score=distance(a,person)+Math.abs(a.genes.social-person.genes.social)*.1;
    if(score<bestScore||(score===bestScore&&person.id<(best?.id??Infinity))){
      best=person;bestScore=score;
    }
  }
  return best;
}

function bestHabitat(w:World,a:Agent,goal:MindGoal,
  suitability:(ancestry:Ancestry,biome:Biome)=>number):{x:number;y:number}{
  let target={x:a.x,y:a.y},best=-Infinity;
  // A finite search horizon keeps this affordable for hundreds of inhabitants.
  // Memory discourages returning to a site that recently failed to feed them.
  for(let dy=-6;dy<=6;dy+=2)for(let dx=-6;dx<=6;dx+=2){
    const x=a.x+dx,y=a.y+dy;
    if(!edible(w,x,y))continue;
    const compatible=suitability(a.ancestry,w.tiles[index(w,x,y)].biome);
    const food=foodAround(w,x,y);
    const bad=a.mind?.lastScarcity;
    const remembered=bad&&w.year-bad.year<12&&distance({x,y},bad)<=2?14:0;
    const good=a.mind?.lastGoodFood;
    const familiar=good&&w.year-good.year<12&&distance({x,y},good)<=2?3.5:0;
    const score=(goal==='forage'?Math.min(food,45)*.48:Math.min(food,35)*.12)+
      compatible*(goal==='seek_safety'?21:11)-
      distance(a,{x,y})*.7-remembered+familiar;
    if(score>best){best=score;target={x,y};}
  }
  return target;
}

export function planMind(w:World,a:Agent,occupied:Map<number,number>,
  byId:Map<number,Agent>,contacts:Map<number,number>,
  suitability:(ancestry:Ancestry,biome:Biome)=>number,
  traits:(ancestry:Ancestry)=>{maturity:number;lifespan:number}):AgentMind{
  const prior=a.mind;
  const {maturity,lifespan}=traits(a.ancestry);
  const safe=suitability(a.ancestry,w.tiles[index(w,a.x,a.y)].biome);
  const adult=a.age>=maturity&&a.age<lifespan*.76;
  let goal:MindGoal='explore',reason='Healthy and curious about the surroundings.';
  let target:AgentMind['target'],targetPersonId:number|undefined;
  if(a.energy<57||foodAround(w,a.x,a.y)<4){
    goal='forage';reason='Food or stored energy is running low.';
    target=bestHabitat(w,a,goal,suitability);
  }else if((safe<.45||a.health<52)&&a.energy>=57){
    goal='seek_safety';reason='The terrain or current condition is unsafe.';
    target=bestHabitat(w,a,goal,suitability);
  }else if(a.age<maturity&&a.parents){
    const parent=a.parents.map(id=>byId.get(id)).find(Boolean);
    if(parent){goal='seek_family';reason='Seeking a familiar caregiver.';
      target={x:parent.x,y:parent.y};}
  }else if((a.partnerId||contacts.has(a.id))&&
    byId.has(a.partnerId??contacts.get(a.id)!)){
    const partner=byId.get(a.partnerId??contacts.get(a.id)!)!;
    goal='stay_together';reason=a.partnerId?
      'Protecting a close partnership.':'Building trust in a developing bond.';
    target={x:partner.x,y:partner.y};
  }else if(adult&&a.energy>=57&&a.health>=52){
    const eligible=(b:Agent)=>{
      if(b.partnerId||contacts.has(b.id)||b.energy<=40||b.health<=45||
        (!w.settings.interbreeding&&a.species!==b.species))return false;
      const p=traits(b.ancestry);
      return b.age>=p.maturity&&b.age<p.lifespan*.76;
    };
    const oldTarget=byId.get(prior?.targetPersonId??-1);
    const match=oldTarget&&oldTarget.id!==a.id&&eligible(oldTarget)&&
      distance(a,oldTarget)<=8?oldTarget:
      nearestPerson(w,a,occupied,byId,eligible);
    if(match){goal='seek_partner';reason='Looking for compatible company.';
      target={x:match.x,y:match.y};targetPersonId=match.id;}
  }
  return {goal,reason,since:prior?.goal===goal?prior.since:w.year,
    ...(target?{target}:{}),
    ...(targetPersonId?{targetPersonId}:{}),
    ...(prior?.lastScarcity?{lastScarcity:prior.lastScarcity}:{}),
    ...(prior?.lastGoodFood?{lastGoodFood:prior.lastGoodFood}:{})};
}

/** Utility for an adjacent position: intentions compete with immediate needs. */
export function movementIntent(a:Agent,x:number,y:number,year:number):number{
  const m=a.mind;
  if(!m)return 0;
  const here={x:a.x,y:a.y},candidate={x,y};
  const progress=m.target?(distance(here,m.target)-distance(candidate,m.target)):0;
  const urgency=m.goal==='forage'||m.goal==='seek_safety'?7:
    m.goal==='stay_together'?10:m.goal==='seek_partner'?8:
    m.goal==='seek_family'?7:0;
  const bad=m.lastScarcity;
  return progress*urgency-
    (bad&&year-bad.year<12&&distance(candidate,bad)<=1?6:0);
}

export function rememberForage(a:Agent,year:number,amount:number,needed:number):void{
  if(!a.mind)return;
  if(amount<needed*.45)
    a.mind.lastScarcity={x:a.x,y:a.y,year};
  else if(amount>=needed*.9)
    a.mind.lastGoodFood={x:a.x,y:a.y,year};
}
