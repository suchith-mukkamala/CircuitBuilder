import { useState } from 'react';
import { App as AnalogLab } from './App';
import { SignalLab } from './digital/SignalLab';

type Lab = 'analog' | 'signal';
function preferredLab(): Lab {
  try {
    return window.localStorage.getItem('circuitbuilder-active-lab') === 'signal'
      ? 'signal' : 'analog';
  } catch { return 'analog'; }
}
export function LabHub() {
  const [lab, setLab] = useState<Lab>(preferredLab);
  const choose = (next: Lab) => {
    setLab(next);
    try { window.localStorage.setItem('circuitbuilder-active-lab', next); }
    catch { /* Browser storage may be disabled; switching still works. */ }
  };
  return <div className="lab-hub-shell">
    <nav className="lab-switcher" aria-label="Select a CircuitBuilder laboratory">
      <div className="lab-switcher-home"><span className="lab-switcher-cube">▣</span>
        <span>CIRCUITBUILDER <small>/ PIXEL ELECTRONICS</small></span></div>
      <div className="lab-switcher-tabs" role="tablist" aria-label="Laboratories">
        <button role="tab" aria-selected={lab==='analog'}
          className={lab==='analog'?'lab-active':''}
          onClick={()=>choose('analog')}>
          <span className="lab-switch-symbol">〰</span>
          <span>01 <strong>ANALOG LAB</strong></span>
        </button>
        <button role="tab" aria-selected={lab==='signal'}
          className={lab==='signal'?'lab-active':''}
          onClick={()=>choose('signal')}>
          <span className="lab-switch-symbol">▥</span>
          <span>02 <strong>SIGNAL LAB</strong></span>
          <small className="lab-new-flag">NEW</small>
        </button>
      </div>
      <div className="lab-switcher-status"><span/> TWO LABS · ONE WORKBENCH</div>
    </nav>
    {lab==='analog' ? <AnalogLab/> : <SignalLab/>}
  </div>;
}
