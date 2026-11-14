import {useEffect,useState} from 'react';
export function useCompactCanvas(){
  const [compact,setCompact]=useState(()=>typeof window!=='undefined'&&window.innerWidth<=740);
  useEffect(()=>{
    const media=window.matchMedia('(max-width:740px)');
    const update=()=>setCompact(media.matches);update();
    media.addEventListener('change',update);return ()=>media.removeEventListener('change',update);
  },[]);
  return compact;
}
