import {useEffect,useState} from 'react';
/** Verify the persisted copy rather than claiming a local save always succeeded. */
export function SaveIndicator({storageKey,value,revision,draft=false}:{storageKey:string;value:Record<string,unknown>;revision?:unknown;draft?:boolean}){
  const snapshot=JSON.stringify(value);
  const [status,setStatus]=useState('Checking save…');
  useEffect(()=>{
    if(draft){setStatus('Module draft · Save block to commit');return;}
    try{
      const raw=localStorage.getItem(storageKey);
      if(!raw){setStatus('Not saved · Export a backup');return;}
      const persisted=JSON.parse(raw)?.state;
      const expected=JSON.parse(snapshot) as Record<string,unknown>;
      const matches=Object.entries(expected).every(([key,value])=>JSON.stringify(persisted?.[key])===JSON.stringify(value));
      setStatus(matches?'Saved in this browser':'Save failed · Export a backup');
    }catch{setStatus('Storage unavailable · Export a backup');}
  },[storageKey,snapshot,revision,draft]);
  return <span className={'save-indicator'+(/failed|unavailable/.test(status)?' save-failed':'')} role="status" aria-label="Project save status">{status}</span>;
}
