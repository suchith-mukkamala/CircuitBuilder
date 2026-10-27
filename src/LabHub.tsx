import { useState } from 'react';
import { App as AnalogLab } from './App';
import { SignalLab } from './digital/SignalLab';
import { ComputerBuilder } from './ComputerBuilder';
import { HomeScreen } from './HomeScreen';
import { useDigitalStore } from './digital/useDigitalStore';
import type { DigitalWorkspace } from './digital/useDigitalStore';

type Destination = 'home'|'analog'|'signal'|'computer';

export function LabHub(){
  const [page,setPage]=useState<Destination>('home');
  const choose=(destination:Destination)=>{
    if(destination===page)return;
    const store=useDigitalStore.getState();
    if(store.editStack.length&&(page==='signal'||page==='computer')){
      window.alert('Save or Cancel the open reusable block before changing laboratories.');
      return;
    }
    if(destination==='signal'||destination==='computer'){
      const workspace=destination as DigitalWorkspace;
      if(!store.switchWorkspace(workspace)){
        window.alert('Finish the current block edit before changing laboratories.');
        return;
      }
    }
    setPage(destination);
  };
  return <div className="lab-hub-shell">
    <nav className={'lab-switcher'+(page==='home'?' landing-nav':'')}
      aria-label="CircuitBuilder navigation">
      <button className="lab-switcher-home" onClick={()=>choose('home')}
        aria-label="CircuitBuilder home" title="Return to homepage">
        <span className="lab-switcher-cube">▣</span>
        <span>CIRCUITBUILDER <small>/ PIXEL ELECTRONICS</small></span>
      </button>
      {page!=='home'&&<>
        <div className="lab-switcher-tabs" role="tablist" aria-label="Laboratories">
          <button role="tab" aria-selected={page==='analog'}
            className={page==='analog'?'lab-active':''}
            onClick={()=>choose('analog')}>
            <span className="lab-switch-symbol">〰</span>
            <span>01 <strong>ANALOG</strong></span>
          </button>
          <button role="tab" aria-selected={page==='signal'}
            className={page==='signal'?'lab-active':''}
            onClick={()=>choose('signal')}>
            <span className="lab-switch-symbol">▥</span>
            <span>02 <strong>SIGNALS</strong></span>
          </button>
          <button role="tab" aria-selected={page==='computer'}
            className={page==='computer'?'lab-active':''}
            onClick={()=>choose('computer')}>
            <span className="lab-switch-symbol">▣</span>
            <span>03 <strong>COMPUTER</strong></span>
          </button>
        </div>
        <div className="lab-switcher-status"><span/> THREE WORKBENCHES</div>
      </>}
    </nav>
    {page==='home'?
      <HomeScreen onAnalog={()=>choose('analog')}
        onSignal={()=>choose('signal')} onComputer={()=>choose('computer')}/>:
      page==='analog'?<AnalogLab/>:
      page==='signal'?<SignalLab/>:<ComputerBuilder/>}
  </div>;
}
