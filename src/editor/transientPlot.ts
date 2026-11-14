import type {TransientResult} from '../circuit/types';
export function transientPlot(result:TransientResult,ids:string[],kind:'voltage'|'current',range?:{min:number;max:number}){
  const series=ids.map(id=>({id,values:result.frames.map(frame=>frame.readings[id]?.[kind]??NaN)}));
  const values=series.flatMap(s=>s.values).filter(Number.isFinite);
  let min=range?.min??Math.min(0,...values),max=range?.max??Math.max(0,...values);
  if(!Number.isFinite(min)||!Number.isFinite(max)||max<=min){min=0;max=1;}
  const y=(value:number)=>20+105*(max-value)/(max-min);
  const x=(index:number)=>52+index/result.steps*290;
  return {min,max,x,y,series:series.map(s=>({...s,path:s.values.map((value,index)=>(index?'L':'M')+x(index).toFixed(2)+' '+y(value).toFixed(2)).join(' ')}))};
}
