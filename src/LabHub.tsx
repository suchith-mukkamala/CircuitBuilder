import { useState } from 'react';
import { App as AnalogLab } from './App';
import { SignalLab } from './digital/SignalLab';
import { HomeScreen } from './HomeScreen';
import { cpuCoreDemo } from './digital/computerSamples';
import { useDigitalStore } from './digital/useDigitalStore';

type Destination = 'home' | 'analog' | 'signal';

export function LabHub() {
  const [page,setPage] = useState<Destination>('home');
  const choose=(next:Destination)=>setPage(next);
  const launchCpu=()=>{
    try {
      useDigitalStore.getState().load(cpuCoreDemo());
      setPage('signal');
    } catch(error) {
      window.alert(error instanceof Error?error.message:'Unable to load CPU starter.');
    }
  };
  return <div className="lab-hub-shell">
    <nav className="lab-switcher" aria-label="CircuitBuilder navigation">
      <button className="lab-switcher-home" onClick={()=>choose('home')}
        aria-label="CircuitBuilder home" title="Return to homepage">
        <span className="lab-switcher-cube">▣</span>
        <span>CIRCUITBUILDER <small>/ PIXEL ELECTRONICS</small></span>
      </button>
      <div className="lab-switcher-tabs" role="tablist" aria-label="Laboratories and home">
        <button role="tab" aria-selected={page==='home'}
          className={page==='home'?'lab-active':''} onClick={()=>choose('home')}>
          <span className="lab-switch-symbol">⌂</span><span><strong>HOME</strong></span>
        </button>
        <button role="tab" aria-selected={page==='analog'}
          className={page==='analog'?'lab-active':''} onClick={()=>choose('analog')}>
          <span className="lab-switch-symbol">〰</span>
          <span>01 <strong>ANALOG LAB</strong></span>
        </button>
        <button role="tab" aria-selected={page==='signal'}
          className={page==='signal'?'lab-active':''} onClick={()=>choose('signal')}>
          <span className="lab-switch-symbol">▥</span>
          <span>02 <strong>SIGNAL LAB</strong></span>
        </button>
      </div>
      <div className="lab-switcher-status"><span/> BUILD · WIRE · SIMULATE</div>
    </nav>
    {page==='home'?<HomeScreen onAnalog={()=>choose('analog')}
      onSignal={()=>choose('signal')} onCpu={launchCpu}/>:
      page==='analog'?<AnalogLab/>:<SignalLab/>}
  </div>;
}
