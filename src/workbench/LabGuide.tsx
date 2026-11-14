type Step={title:string;detail:string};

export function LabGuide({number,title,description,steps,children}:{
  number:string;title:string;description:string;steps:Step[];children?:React.ReactNode;
}){
  return <section className="lab-guide" aria-label={title+' introduction'}>
    <div className="lab-guide-heading">
      <span className="lab-guide-number">LAB {number}</span>
      <h1>{title}</h1><p>{description}</p>
    </div>
    <details className="lab-guide-help">
      <summary>Quick start <span aria-hidden="true">⌄</span></summary>
      <div className="lab-guide-content">
        <ol>{steps.map(step=><li key={step.title}><strong>{step.title}</strong><p>{step.detail}</p></li>)}</ol>
        {children}
      </div>
    </details>
  </section>;
}
