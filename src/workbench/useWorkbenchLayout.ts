import {useEffect,useRef,useState} from 'react';

/** Keep each lab's panel preferences separate. Small screens start with a canvas. */
export function useWorkbenchLayout(lab:string,defaults={parts:true,tools:true}){
  const [layout,setLayout]=useState(()=>{
    try{
      const saved=JSON.parse(localStorage.getItem('cb-layout-'+lab)??'null');
      if(saved&&typeof saved.parts==='boolean'&&typeof saved.tools==='boolean')return saved as typeof defaults;
    }catch{/* Storage can be disabled. Editing still works. */}
    const wide=typeof window==='undefined'||window.innerWidth>=1100;
    return {parts:wide&&defaults.parts,tools:wide&&defaults.tools};
  });
  const previous=useRef(layout);
  useEffect(()=>{
    try{localStorage.setItem('cb-layout-'+lab,JSON.stringify(layout));}catch{/* optional */}
  },[lab,layout]);
  const setParts=(next:boolean|((old:boolean)=>boolean))=>setLayout(old=>({...old,
    parts:typeof next==='function'?next(old.parts):next}));
  const setTools=(next:boolean|((old:boolean)=>boolean))=>setLayout(old=>({...old,
    tools:typeof next==='function'?next(old.tools):next}));
  const focused=!layout.parts&&!layout.tools;
  const toggleFocus=()=>{
    if(focused)setLayout(previous.current.parts||previous.current.tools?previous.current:defaults);
    else{previous.current=layout;setLayout({parts:false,tools:false});}
  };
  return {partsOpen:layout.parts,toolsOpen:layout.tools,setParts,setTools,focused,toggleFocus};
}
