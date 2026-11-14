import {useEffect,useState,type CSSProperties} from 'react';
export function usePanelWidths(lab:string){
  const [widths,setWidths]=useState(()=>{
    try{const value=JSON.parse(localStorage.getItem('cb-widths-'+lab)??'null');
      if(value&&Number.isFinite(value.parts)&&Number.isFinite(value.tools))return {parts:Math.max(200,Math.min(360,value.parts)),tools:Math.max(280,Math.min(480,value.tools))};
    }catch{/* Optional preference. */}
    return {parts:250,tools:320};
  });
  useEffect(()=>{try{localStorage.setItem('cb-widths-'+lab,JSON.stringify(widths));}catch{/* Optional preference. */}},[lab,widths]);
  return {widths,style:{'--parts':widths.parts+'px','--tools':widths.tools+'px'} as CSSProperties,
    resize:(side:'parts'|'tools',value:number)=>setWidths(old=>({...old,[side]:Math.max(side==='parts'?200:280,Math.min(side==='parts'?360:480,value))}))};
}
export function PanelResizer({side,value,onChange}:{side:'parts'|'tools';value:number;onChange:(value:number)=>void}){
  return <div className={'panel-resizer resize-'+side} role="separator" tabIndex={0} aria-orientation="vertical"
    aria-label={side==='parts'?'Resize parts library':'Resize instrument panel'} aria-valuenow={value}
    aria-valuemin={side==='parts'?200:280} aria-valuemax={side==='parts'?360:480}
    onKeyDown={event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();onChange(value+(event.key==='ArrowRight'?1:-1)*(side==='parts'?16:-16));}}}
    onPointerDown={event=>{event.preventDefault();event.currentTarget.setPointerCapture(event.pointerId);}}
    onPointerMove={event=>{
      if(!event.currentTarget.hasPointerCapture(event.pointerId))return;
      const bounds=event.currentTarget.parentElement!.getBoundingClientRect();
      onChange(side==='parts'?event.clientX-bounds.left-14:bounds.right-event.clientX-14);
    }}
    onPointerUp={event=>{if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);}}
  ><span/></div>;
}
