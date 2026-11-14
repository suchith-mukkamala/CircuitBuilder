import {useRef,useState} from 'react';
import {parseSavedProjects,type ProjectLab,type ProjectSnapshot,type SavedProject} from './projects';
import {CircuitThumbnail} from './CircuitThumbnail';
export function ProjectShelf({lab,getSnapshot,onLoad,disabled=false}:{lab:ProjectLab;getSnapshot:()=>ProjectSnapshot;onLoad:(snapshot:ProjectSnapshot)=>void;disabled?:boolean}){
  const dialog=useRef<HTMLDialogElement>(null);
  const [projects,setProjects]=useState<SavedProject[]>([]);
  const [name,setName]=useState('');
  const [message,setMessage]=useState('');
  const [readError,setReadError]=useState(false);
  const storageKey='cb-projects-v1-'+lab;
  const open=()=>{
    setName(getSnapshot().document.name);setMessage('');setReadError(false);
    try{setProjects(parseSavedProjects(JSON.parse(localStorage.getItem(storageKey)??'[]'),lab));}
    catch(error){setProjects([]);setMessage(error instanceof Error?error.message:'Browser storage unavailable. Export the working project as JSON.');setReadError(true);}
    dialog.current?.showModal();
  };
  const persist=(next:SavedProject[],success:string)=>{
    try{localStorage.setItem(storageKey,JSON.stringify(next));setProjects(next);setMessage(success);return true;}
    catch{setMessage('Could not save: browser storage is full or unavailable. Export JSON to keep a backup.');return false;}
  };
  const save=(existing?:SavedProject)=>{
    if(!name.trim()){setMessage('Give the project a name first.');return;}
    if(!existing&&projects.length>=12){setMessage('This shelf holds 12 projects. Replace or delete a saved copy first.');return;}
    const snapshot=JSON.parse(JSON.stringify(getSnapshot())) as ProjectSnapshot;
    snapshot.document.name=name.trim();
    const item:SavedProject={id:existing?.id??crypto.randomUUID(),name:name.trim(),savedAt:new Date().toISOString(),snapshot};
    persist(existing?projects.map(project=>project.id===existing.id?item:project):[item,...projects],'Saved “'+item.name+'” in this browser.');
  };
  return <>
    <button className="workbench-projects-button" disabled={disabled} title={disabled?'Finish editing the module first':'Named project copies saved in this browser'} onClick={open}>▣ Projects</button>
    <dialog ref={dialog} className="project-shelf" aria-label="Saved projects">
      <header><div><span>{lab.toUpperCase()} LAB</span><h2>Your projects</h2></div><button aria-label="Close saved projects" onClick={()=>dialog.current?.close()}>×</button></header>
      <p>Keep up to 12 named copies per lab. These are stored in this browser; export JSON for a separate backup.{lab==='computer'?' Computer copies also include your un-injected CASM drafts.':''}</p>
      <div className="project-save-row"><label>Project copy name<input aria-label="Project copy name" maxLength={90} value={name} onChange={event=>setName(event.target.value)}/></label>
        <button disabled={readError} onClick={()=>save()}>Save new copy</button></div>
      <div className="project-shelf-message" role="status">{message}</div>
      {!projects.length&&!readError&&<div className="project-shelf-empty">Your first experiment belongs here. Save a copy above to begin.</div>}
      <div className="project-shelf-list">{projects.map(project=><article key={project.id}>
        <CircuitThumbnail snapshot={project.snapshot}/>
        <div><h3>{project.name}</h3><small>{project.snapshot.document.components.length} components · {new Date(project.savedAt).toLocaleDateString()}</small></div>
        <div className="project-copy-actions">
          <button onClick={()=>{
            if(!window.confirm('Open “'+project.name+'”? Save or export the working circuit first to keep it.'))return;
            try{onLoad(JSON.parse(JSON.stringify(project.snapshot)));dialog.current?.close();}
            catch(error){setMessage(error instanceof Error?error.message:'Could not open the saved project.');}
          }}>Open</button>
          <button onClick={()=>{if(window.confirm('Replace “'+project.name+'” with the working circuit?'))save(project);}}>Replace</button>
          <button onClick={()=>{if(window.confirm('Delete saved copy “'+project.name+'”?'))persist(projects.filter(item=>item.id!==project.id),'Saved copy deleted.');}}>Delete</button>
        </div>
      </article>)}</div>
    </dialog>
  </>;
}
