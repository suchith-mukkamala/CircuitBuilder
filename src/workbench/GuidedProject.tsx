import {useState} from 'react';
type Step={title:string;detail:string;complete:boolean;action?:()=>void;actionLabel?:string};
export function GuidedProject({title,description,onStart,steps}:{title:string;description:string;onStart:()=>boolean;steps:Step[]}){
  const [started,setStarted]=useState(false);
  return <details className="guided-project">
    <summary><span>◇ Guided project <strong>{title}</strong></span><span>LEARN BY DOING <b>⌄</b></span></summary>
    <div className="guided-project-body">
      <div className="guided-project-intro"><p>{description}</p><button onClick={()=>{if(onStart())setStarted(true);}}>{started?'Restart lesson':'Load lesson circuit'}</button>
        <small>Loading replaces the working circuit. Save a project copy first to keep your experiment.</small></div>
      <ol>{steps.map((step,index)=><li key={step.title} className={started&&step.complete?'is-complete':''}>
        <span className="lesson-step-number">{started&&step.complete?'✓':index+1}</span>
        <div><strong>{step.title}</strong><p>{step.detail}</p>{step.action&&<button disabled={!started} onClick={step.action}>{step.actionLabel}</button>}</div>
      </li>)}</ol>
      {started&&steps.every(step=>step.complete)&&<p className="lesson-complete" role="status">✓ Experiment complete. Try changing a value or the program and predict what happens next.</p>}
    </div>
  </details>;
}
