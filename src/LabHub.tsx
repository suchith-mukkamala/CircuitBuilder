import { lazy,Suspense,useEffect,useState } from 'react';
const AnalogLab=lazy(()=>import('./App').then(module=>({default:module.App})));
import { SignalLab } from './digital/SignalLab';
import { ComputerBuilder } from './ComputerBuilder';
import { HomeScreen } from './HomeScreen';
import { useDigitalStore } from './digital/useDigitalStore';
import {DisplayControls} from './visuals/DisplayControls';
import {useScenePreferences} from './visuals/preferences';
import type { DigitalWorkspace } from './digital/useDigitalStore';
const RoboticsLab=lazy(()=>import('./robotics/RoboticsLab').then(module=>({default:module.RoboticsLab})));
const PartsExchange=lazy(()=>import('./bridges/PartsExchange').then(module=>({default:module.PartsExchange})));

type Destination = 'home'|'analog'|'signal'|'computer'|'robotics';
const destinations = [
  {id:'analog',number:'01',name:'Analog',symbol:'〰'},
  {id:'signal',number:'02',name:'Signals',symbol:'⊕'},
  {id:'computer',number:'03',name:'Computer',symbol:'▣'},
  {id:'robotics',number:'04',name:'Robotics',symbol:'⌘'},
] as const;

export function LabHub(){
  const [page,setPage]=useState<Destination>('home');
  const [exchangeOpen,setExchangeOpen]=useState(false);
  const scene=useScenePreferences();
  useEffect(()=>{
    const sync=()=>{
    const hash=window.location.hash.slice(1);
    const destination:Destination=destinations.some(d=>d.id===hash)?hash as Destination:'home';
    if(destination===page)return;
    const store=useDigitalStore.getState();
    if(store.editStack.length&&(page==='signal'||page==='computer')){
      window.alert('Save or Cancel the open reusable block before changing laboratories.');
      window.history.replaceState(null,'','#'+page);
      return;
    }
    if(destination==='signal'||destination==='computer'){
      const workspace=destination as DigitalWorkspace;
      if(!store.switchWorkspace(workspace)){
        window.alert('Finish the current block edit before changing laboratories.');
        window.history.replaceState(null,'','#'+page);
        return;
      }
    }
    setPage(destination);
    window.scrollTo(0,0);
    };
    sync();
    window.addEventListener('hashchange',sync);
    return ()=>window.removeEventListener('hashchange',sync);
  },[page]);
  const choose=(destination:Destination)=>{window.location.hash=destination;};
  return <div className="lab-hub-shell" data-graphics={scene.style} data-motion={scene.motionAllowed?'on':'off'}>
    <a className="skip-link" href="#lab-content" onClick={event=>{
      event.preventDefault();document.getElementById('lab-content')?.focus();
    }}>Skip to workspace</a>
    <nav className={'lab-switcher'+(page==='home'?' landing-nav':'')}
      aria-label="CircuitBuilder navigation">
      <button className="lab-switcher-home" onClick={()=>choose('home')}
        aria-label="CircuitBuilder home" title="Return to homepage">
        <span className="lab-switcher-cube">▣</span>
        <span>CircuitBuilder <small>THE ELECTRONICS PLAYGROUND</small></span>
      </button>
        <div className="lab-switcher-tabs" aria-label="Laboratories">
          {destinations.map(lab=><button key={lab.id} aria-current={page===lab.id?'page':undefined}
            className={page===lab.id?'lab-active':''} onClick={()=>choose(lab.id)}>
            <span className="lab-switch-symbol" aria-hidden="true">{lab.symbol}</span>
            <span className="lab-nav-number">{lab.number}</span><strong>{lab.name}</strong>
          </button>)}
        </div>
        <button className="exchange-open" onClick={()=>setExchangeOpen(true)}>↗ Parts Exchange</button>
        <DisplayControls/>
    </nav>
    {exchangeOpen&&<Suspense fallback={<p className="lab-loading" role="status">Opening Parts Exchange…</p>}><PartsExchange page={page} onNavigate={choose} onClose={()=>setExchangeOpen(false)}/></Suspense>}
    <div id="lab-content" tabIndex={-1}>
    <Suspense fallback={<p className="lab-loading" role="status">Opening lab…</p>}>
    {page==='home'?
      <HomeScreen onAnalog={()=>choose('analog')}
        onSignal={()=>choose('signal')} onComputer={()=>choose('computer')} onRobotics={()=>choose('robotics')}/>:
      page==='analog'?<AnalogLab/>:
      page==='signal'?<SignalLab/>:page==='computer'?<ComputerBuilder/>:
      <RoboticsLab/>}
    </Suspense>
    </div>
  </div>;
}
