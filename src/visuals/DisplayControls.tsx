import {useEffect,useRef} from 'react';
import {useScenePreferences,useVisualPreferences} from './preferences';
export function DisplayControls(){
  const menu=useRef<HTMLDetailsElement>(null);
  const scene=useScenePreferences(),motion=useVisualPreferences(s=>s.motion);
  useEffect(()=>{
    const outside=(event:PointerEvent)=>{if(menu.current&&!menu.current.contains(event.target as Node))menu.current.open=false;};
    const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'&&menu.current?.open){menu.current.open=false;menu.current.querySelector('summary')?.focus();}};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
    return ()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
  },[]);
  return <details ref={menu} className="display-menu"><summary>◐ Display</summary><div>
    <label>Graphics style<select aria-label="Graphics style" value={scene.style} onChange={event=>useVisualPreferences.getState().setStyle(event.target.value as 'studio'|'neon')}>
      <option value="studio">Studio · circuit symbols</option><option value="neon">Classic · neon pixels</option></select></label>
    <label className="display-motion"><input aria-label="Animate state changes" type="checkbox" checked={motion} disabled={scene.reduced} onChange={event=>useVisualPreferences.getState().setMotion(event.target.checked)}/> Animate state changes</label>
    <p>{scene.reduced?'System reduced motion is active. All animation is disabled.':'Animations are visual cues. Simulation values update independently.'}</p>
  </div></details>;
}
