import {useEffect,useMemo,useRef,useState,type ChangeEvent} from 'react';
import {LabGuide} from '../workbench/LabGuide';
import {ControllerBench} from './ControllerBench';
import {compile,advanceController,initialController,type Program} from './engine';
import {devices,digitalPins,analogPins,defaultInputs,parseProject,wiringErrors,readInput,
  type Inputs,type Pin,type RoboticsProject} from './model';
import {lessons,starterProject} from './projects';

const storageKey='circuitbuilder-robotics-v1';
function restore(){
  try{
    const raw=localStorage.getItem(storageKey);
    return {project:raw?parseProject(JSON.parse(raw)):starterProject(),notice:''};
  }catch{return {project:starterProject(),notice:'Could not restore the saved bench. A starter project is open.'};}
}
const timeLabel=(ms:number)=>(ms/1000).toFixed(2)+' s';

export function RoboticsLab(){
  const [saved]=useState(restore);
  const [project,setProject]=useState(saved.project);
  const [inputs,setInputs]=useState<Inputs>({...defaultInputs});
  const inputsRef=useRef(inputs);inputsRef.current=inputs;
  const [program,setProgram]=useState<Program|null>(null);
  const [uploadedSource,setUploadedSource]=useState('');
  const [state,setState]=useState(initialController);
  const [running,setRunning]=useState(false);
  const [notice,setNotice]=useState(saved.notice);
  const [storageError,setStorageError]=useState(false);
  const [monitor,setMonitor]=useState<'pins'|'events'>('pins');
  const fileInput=useRef<HTMLInputElement>(null);
  const editor=useRef<HTMLTextAreaElement>(null);
  const gutter=useRef<HTMLDivElement>(null);
  const build=useMemo(()=>compile(project.source,project.wiring),[project.source,project.wiring]);
  const conflicts=useMemo(()=>wiringErrors(project.wiring),[project.wiring]);
  const lesson=lessons.find(item=>item.id===project.lesson);
  const isDraft=program!==null&&project.source!==uploadedSource;
  const canUpload=build.program!==null&&conflicts.length===0;

  useEffect(()=>{
    try{localStorage.setItem(storageKey,JSON.stringify(project));setStorageError(false);}
    catch{setStorageError(true);}
  },[project]);
  useEffect(()=>{
    if(!running||!program)return;
    // Deliberate fixed virtual ticks: background tabs slow playback, never skip simulation.
    const timer=window.setInterval(()=>setState(old=>advanceController(program,old,50,inputsRef.current,project.wiring)),50);
    return ()=>window.clearInterval(timer);
  },[running,program,project.wiring]);
  useEffect(()=>{if(state.error)setRunning(false);},[state.error]);
  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{
      if((event.ctrlKey||event.metaKey)&&event.key==='Enter'){
        event.preventDefault();upload();
      }
    };
    window.addEventListener('keydown',key);
    return ()=>window.removeEventListener('keydown',key);
  });

  const upload=()=>{
    if(!canUpload||!build.program){setNotice('Fix the program errors and pin conflicts before uploading.');return;}
    setRunning(false);
    setProgram(build.program);setUploadedSource(project.source);
    setState(advanceController(build.program,initialController(),0,inputsRef.current,project.wiring));
    setRunning(true);setNotice('Program uploaded. The controller repeats it from top to bottom.');
  };
  const reset=()=>{setRunning(false);setState(initialController());setNotice('Controller reset. Your code and connections are kept.');};
  const stopProgram=()=>{setRunning(false);setProgram(null);setUploadedSource('');setState(initialController());};
  const replace=(next:RoboticsProject)=>{stopProgram();setProject(next);setInputs({...defaultInputs});setNotice('Project ready. Upload the program to start.');};
  const confirmReplace=()=>{
    const original=starterProject(project.lesson);
    return (project.source===original.source&&project.name===original.name&&
      JSON.stringify(project.wiring)===JSON.stringify(original.wiring))||
      window.confirm('Replace this Robotics Lab project? Export JSON first to keep a separate backup.');
  };
  const exportProject=()=>{
    const url=URL.createObjectURL(new Blob([JSON.stringify(project,null,2)],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;
    link.download=(project.name.replace(/[^a-z0-9_-]/gi,'-').toLowerCase()||'robotics')+'.robotics.json';
    link.click();URL.revokeObjectURL(url);setNotice('Project exported with your code and pin map.');
  };
  const importProject=async(event:ChangeEvent<HTMLInputElement>)=>{
    const file=event.currentTarget.files?.[0];event.currentTarget.value='';
    if(!file)return;
    try{
      if(file.size>64000)throw new Error('Choose a Robotics Lab JSON file smaller than 64 KB.');
      const next=parseProject(JSON.parse(await file.text()));
      if(confirmReplace())replace(next);
    }catch(error){setNotice(error instanceof Error?error.message:'Could not import this project.');}
  };
  const jumpToLine=(line:number)=>{
    const field=editor.current;if(!field)return;
    const start=project.source.split('\n').slice(0,line-1).reduce((sum,text)=>sum+text.length+1,0);
    field.focus();field.setSelectionRange(start,start+(project.source.split('\n')[line-1]?.length??0));
    field.scrollTop=Math.max(0,(line-4)*24);if(gutter.current)gutter.current.scrollTop=field.scrollTop;
  };

  return <div className="robotics-lab">
    <LabGuide number="04" title="Robotics & control" description="Give your code a connection to the world."
      steps={[
        {title:'Choose a starter',detail:'Try a traffic light, automatic door, or obstacle detector. Each includes code and a connected controller.'},
        {title:'Upload and experiment',detail:'Upload the MicroScript program, then change sensor inputs. Pause or step 100 ms to follow the logic.'},
        {title:'Make it yours',detail:'Edit the code or change connections in the pin map. Upload again to apply changes. Export JSON to keep a backup.'},
      ]}/>
    <header className="robotics-toolbar">
      <div className="robotics-project-picker">
        <label htmlFor="robotics-starter">STARTER PROJECT</label>
        <select id="robotics-starter" value={lesson?.id??''} onChange={event=>{
          const id=event.target.value;if(confirmReplace())replace(starterProject(id));
        }}>
          {!lesson&&<option value="" disabled>Imported project</option>}
          {lessons.map(item=><option key={item.id} value={item.id}>{item.number} / {item.name}</option>)}
        </select>
      </div>
      <div className="robotics-run-controls" aria-label="Controller controls">
        <button className="robotics-upload" onClick={upload} disabled={!canUpload} title="Upload and run (Ctrl/Cmd+Enter)">↥ Upload & run</button>
        <button disabled={!program||!!state.error} aria-pressed={running} onClick={()=>setRunning(old=>!old)}>{running?'Ⅱ Pause':'▶ Resume'}</button>
        <button disabled={!program||running||!!state.error} onClick={()=>setState(old=>advanceController(program!,old,100,inputsRef.current,project.wiring))}>↯ Step 100 ms</button>
        <button onClick={reset} title="Pause and reset the controller outputs and clock">↺ Reset</button>
      </div>
      <div className="robotics-file-controls">
        <button onClick={exportProject}>↓ Export</button><button onClick={()=>fileInput.current?.click()}>↑ Import</button>
        <input ref={fileInput} type="file" accept=".json,.robotics.json,application/json" hidden onChange={importProject}/>
      </div>
    </header>
    <main className="robotics-content">
      <section className="robotics-project-intro" aria-label="Current project">
        <div><span className="robotics-eyebrow">SENSE → THINK → ACT</span>
          <input aria-label="Robotics project name" value={project.name} maxLength={90}
            onChange={event=>setProject(old=>({...old,name:event.target.value}))}/>
          <p>{lesson?.summary??'Your custom controller experiment.'}</p></div>
        <div className="robotics-experiment"><span>TRY THIS</span><p>{lesson?.challenge??'Change an input and follow the resulting output in the live monitor.'}</p></div>
      </section>
      <div className="robotics-columns">
        <div className="robotics-bench-column">
          <section className="robotics-card" aria-label="Virtual workbench">
            <div className="robotics-card-heading"><h2>Virtual workbench</h2>
              <div className={'robotics-runtime-state'+(running?' is-running':'')}><i/>{state.error?'FAULT':running?'RUNNING':program?'PAUSED':'READY'}<span>{timeLabel(state.time)}</span></div></div>
            <ControllerBench wiring={project.wiring} inputs={inputs} state={state}/>
            <div className="robotics-inputs" aria-label="Simulated inputs">
              <div className="robotics-button-input"><label>BUTTON <small>{project.wiring.button??'UNCONNECTED'}</small></label>
                <button aria-label="Button input" aria-pressed={inputs.button===1} onClick={()=>setInputs(old=>({...old,button:old.button?0:1}))}>
                  <i/>{inputs.button?'Pressed / HIGH':'Released / LOW'}</button></div>
              <label className="robotics-slider">DISTANCE <output>{inputs.distance} cm</output>
                <input aria-label="Distance sensor" type="range" min="0" max="400" step="1" value={inputs.distance}
                  onChange={event=>setInputs(old=>({...old,distance:Number(event.target.value)}))}/>
                <small>0 cm <span>400 cm</span></small></label>
              <label className="robotics-slider">ANALOG DIAL <output>{inputs.knob}</output>
                <input aria-label="Analog dial" type="range" min="0" max="1023" step="1" value={inputs.knob}
                  onChange={event=>setInputs(old=>({...old,knob:Number(event.target.value)}))}/>
                <small>0 <span>1023</span></small></label>
            </div>
          </section>
          <section className="robotics-card robotics-monitor" aria-label="Controller monitor">
            <div className="robotics-card-heading"><div className="robotics-monitor-tabs" role="tablist" aria-label="Controller monitor views">
              <button role="tab" aria-selected={monitor==='pins'} onClick={()=>setMonitor('pins')}>Live pins</button>
              <button role="tab" aria-selected={monitor==='events'} onClick={()=>setMonitor('events')}>Event log <span>{state.trace.length}</span></button>
            </div><span className="robotics-monitor-hint">{state.steps} instructions</span></div>
            {monitor==='pins'?<div role="tabpanel" aria-label="Live pin values" className="robotics-pin-monitor">
              {[...digitalPins,...analogPins].map(pin=><div key={pin} className={readInput(pin,inputs,project.wiring,state.pins)?'pin-high':''}>
                <span>{pin}</span><strong>{project.wiring.servo===pin?state.servos[pin as typeof digitalPins[number]]+'°':
                  pin.startsWith('A')?readInput(pin,inputs,project.wiring,state.pins):readInput(pin,inputs,project.wiring,state.pins)?'HIGH':'LOW'}</strong>
                <small>{devices.filter(device=>project.wiring[device.id]===pin).map(device=>device.name).join(', ')||'Available'}</small>
              </div>)}
            </div>:<div role="tabpanel" aria-label="Output events" className="robotics-event-log">
              {state.trace.length?[...state.trace].reverse().map((event,index)=><div key={index}><time>{timeLabel(event.time)}</time><span>{event.message}</span></div>):
                <p>Output changes will appear here after you upload a program.</p>}
            </div>}
          </section>
          <details className="robotics-card robotics-wiring">
            <summary><span>⌁ Pin map & connections</span><small>CHANGE WIRING</small></summary>
            <p>Choose a pin for each device. Changing a connection stops the controller until you upload again. Unconnected inputs read zero.</p>
            <div className="robotics-wiring-grid">{devices.map(device=><label key={device.id}>
              <span><i style={{background:device.color}}/>{device.name}</span>
              <select aria-label={device.name+' pin'} value={project.wiring[device.id]??''} onChange={event=>{
                stopProgram();setProject(old=>({...old,wiring:{...old.wiring,[device.id]:event.target.value as Pin||null}}));
                setNotice('Connection changed. Upload the program to apply the new pin map.');
              }}>
                <option value="">Unconnected</option>
                {(device.kind==='analog'?analogPins:digitalPins).map(pin=><option key={pin}>{pin}</option>)}
              </select></label>)}</div>
            {!!conflicts.length&&<div className="robotics-errors" role="alert">{conflicts.map(error=><p key={error}>{error}</p>)}</div>}
          </details>
        </div>
        <div className="robotics-code-column">
          <section className="robotics-card robotics-code-card" aria-label="Controller program">
            <div className="robotics-card-heading"><h2>Controller program</h2><span className="robotics-language">MicroScript</span></div>
            <div className="robotics-code-toolbar"><span>main.micro</span>
              <span className={isDraft?'robotics-draft':''}>{isDraft?'DRAFT · NOT UPLOADED':program?'UPLOADED PROGRAM':'EDIT → UPLOAD → EXPERIMENT'}</span></div>
            <div className="robotics-editor-surface">
              <div className="robotics-gutter" ref={gutter} aria-hidden="true">{project.source.split('\n').map((_,index)=>
                <div key={index} className={(build.errors.some(error=>error.line===index+1)?'has-error':'')+
                  (program&&!isDraft&&state.line===index+1?' is-executing':'')}>{index+1}</div>)}</div>
              <textarea ref={editor} className="robotics-source" aria-label="MicroScript source code" value={project.source}
                maxLength={16000} spellCheck={false} autoCapitalize="off" autoCorrect="off" wrap="off"
                onScroll={event=>{if(gutter.current)gutter.current.scrollTop=event.currentTarget.scrollTop;}}
                onKeyDown={event=>{
                  if(event.key==='Tab'){
                    event.preventDefault();const field=event.currentTarget,start=field.selectionStart,end=field.selectionEnd;
                    setProject(old=>({...old,source:old.source.slice(0,start)+'  '+old.source.slice(end)}));
                    requestAnimationFrame(()=>field.setSelectionRange(start+2,start+2));
                  }
                }}
                onChange={event=>setProject(old=>({...old,source:event.target.value}))}/>
            </div>
            <div className={'robotics-build-state'+(!canUpload?' has-errors':'')}>
              <div><span>{!canUpload?'⚠ Fix before uploading':'✓ Ready to upload'}</span>
                <small>{program&&!isDraft?'Line '+state.line:project.source.split('\n').length+' lines'} · Ctrl/Cmd+Enter to upload</small></div>
              <button disabled={!canUpload} onClick={upload} aria-label="Upload program from editor">↥ Upload & run</button>
            </div>
            {!!build.errors.length&&<div className="robotics-errors" aria-label="Program errors">{build.errors.map((error,index)=><button key={index} onClick={()=>jumpToLine(error.line)}>
              <b>Line {error.line}</b><span>{error.message}</span></button>)}</div>}
            {isDraft&&<p className="robotics-code-note">The controller is using your last uploaded program. Upload again to apply your edits.</p>}
            {state.error&&<p className="robotics-runtime-error" role="alert">{state.error}</p>}
          </section>
          <details className="robotics-card robotics-reference" open>
            <summary>MicroScript quick reference <span>⌄</span></summary>
            <p>The controller repeats your program forever. Add a <code>wait</code> to give it time between actions.</p>
            <dl>
              <div><dt><code>write D2 HIGH</code></dt><dd>Set a digital output to HIGH or LOW.</dd></div>
              <div><dt><code>servo D5 90</code></dt><dd>Set the connected servo to 0–180°.</dd></div>
              <div><dt><code>wait 1000</code></dt><dd>Wait in milliseconds. 1000 ms = 1 second.</dd></div>
              <div><dt><code>if distance &lt; 35</code><br/><code>  write D4 HIGH</code><br/><code>else</code><br/><code>  write D4 LOW</code><br/><code>end</code></dt><dd>Read <code>button</code>, <code>distance</code>, <code>knob</code>, or a pin. Compare with &lt;, &gt;, &lt;=, &gt;=, ==, or !=.</dd></div>
            </dl>
            <p><code>#</code> starts a comment. One instruction per line. MicroScript is a small teaching language; Arduino/C++ code needs to be rewritten using these commands.</p>
          </details>
        </div>
      </div>
      <div className="robotics-status" role="status" aria-label="Robotics project status"><span>{notice||'Choose a starter project and upload its program.'}</span>
        <span>{storageError?'Browser storage unavailable · export a backup':'● Draft saved in this browser'}</span></div>
    </main>
  </div>;
}
