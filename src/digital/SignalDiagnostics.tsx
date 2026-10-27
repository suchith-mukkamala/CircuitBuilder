import {useMemo,useState} from 'react';
import {useDigitalStore} from './useDigitalStore';
import {diagnoseDigitalCircuit,type CircuitIssue} from './diagnostics';

const issueTarget=(issue:CircuitIssue)=>{
  if(issue.componentId)return {type:'component' as const,id:issue.componentId};
  if(issue.wireId)return {type:'wire' as const,id:issue.wireId};
  if(issue.busId)return {type:'bus' as const,id:issue.busId};
  return null;
};
export function SignalDiagnostics(){
  const doc=useDigitalStore(s=>s.document);
  const locate=useDigitalStore(s=>s.focusIssue);
  const [filter,setFilter]=useState<'all'|'error'|'warning'>('all');
  const issues=useMemo(()=>diagnoseDigitalCircuit(doc),[doc]);
  const errors=issues.filter(i=>i.severity==='error').length;
  const warnings=issues.filter(i=>i.severity==='warning').length;
  const shown=issues.filter(i=>filter==='all'||i.severity===filter);
  return <section className="signal-diagnostics-panel">
    <div className="signal-panel-heading">⚠ CIRCUIT CHECK <span>/ LIVE</span></div>
    <p className="signal-scope-intro">
      Diagnostics update as you edit. Select LOCATE to highlight the affected
      component, wire, or bus and center it on the canvas.
    </p>
    <div className="diagnostics-counts">
      <button aria-pressed={filter==='all'} className={filter==='all'?'selected':''}
        onClick={()=>setFilter('all')}><strong>{issues.length}</strong><span>ALL</span></button>
      <button aria-pressed={filter==='error'} className={filter==='error'?'selected':''}
        onClick={()=>setFilter('error')}><strong>{errors}</strong><span>ERRORS</span></button>
      <button aria-pressed={filter==='warning'} className={filter==='warning'?'selected':''}
        onClick={()=>setFilter('warning')}><strong>{warnings}</strong><span>WARNINGS</span></button>
    </div>
    <div aria-live="polite" className="diagnostics-items">
      {!issues.length&&<div className="diagnostics-clean">
        <span>✓</span><strong>NO PROBLEMS DETECTED</strong>
        <p>All current top-level inputs have drivers, and no driver
          conflicts or obvious combinational loops were detected.</p>
      </div>}
      {issues.length>0&&!shown.length&&<p className="signal-scope-intro">
        No {filter} issues. Choose ALL to see other results.</p>}
      {shown.map(issue=>{
        const target=issueTarget(issue);
        return <article className={'diagnostic-item severity-'+issue.severity} key={issue.id}>
          <div className="diagnostic-item-head"><span>
            {issue.severity==='error'?'✖':'⚠'} {issue.code.replace(/_/g,' ')}</span>
            <small>{issue.severity.toUpperCase()}</small>
          </div>
          <strong>{issue.title}</strong>
          <p>{issue.detail}</p>
          {target&&<button onClick={()=>locate(target)}>⌖ LOCATE IN CIRCUIT</button>}
        </article>;
      })}
    </div>
    <div className="diagnostics-footer">
      Named signals are local to the current schematic. 4/8/16-bit buses
      carry separate bit-level signals; mismatched widths are not silently joined.
    </div>
  </section>;
}
