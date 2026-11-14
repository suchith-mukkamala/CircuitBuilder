import {useEffect,useState} from 'react';
import {create} from 'zustand';
import {createJSONStorage,persist} from 'zustand/middleware';
import {browserStorage} from '../workbench/browserStorage';
export const useVisualPreferences=create<{
  style:'studio'|'neon';motion:boolean;setStyle:(style:'studio'|'neon')=>void;setMotion:(motion:boolean)=>void;
}>()(persist(set=>({style:'studio',motion:true,setStyle:style=>set({style}),setMotion:motion=>set({motion})}),{
  name:'cb-display-v1',storage:createJSONStorage(()=>browserStorage),partialize:state=>({style:state.style,motion:state.motion}),
}));
export function useScenePreferences(){
  const style=useVisualPreferences(s=>s.style),motion=useVisualPreferences(s=>s.motion);
  const [reduced,setReduced]=useState(()=>typeof window!=='undefined'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(()=>{const media=window.matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduced(media.matches);
    update();media.addEventListener('change',update);return ()=>media.removeEventListener('change',update);},[]);
  return {style,motionAllowed:motion&&!reduced,reduced};
}
