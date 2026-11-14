/** Presentation-only activity. It never changes a circuit or a simulator clock. */
export type Activity=Map<string,number>;
export const activityDuration=650;
export function recordActivity(previous:Record<string,string|number>|null,next:Record<string,string|number>,now:number,existing:Activity):Activity{
  const events=new Map([...existing].filter(([key,start])=>now-start<activityDuration&&key in next));
  if(previous)for(const [key,value] of Object.entries(next))if(key in previous&&previous[key]!==value)events.set(key,now);
  return events;
}
export const activityOpacity=(start:number|undefined,now:number)=>start===undefined?0:Math.max(0,Math.min(1,1-(now-start)/activityDuration));
