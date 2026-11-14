import {CircuitThumbnail} from '../workbench/CircuitThumbnail';
import {type LogicController,type LogicSensor,type LogicActuator} from '../bridges/logicController';
import {useDigitalStore} from '../digital/useDigitalStore';
export function LogicControllerEditor({controller,onChange,onDetach}:{controller:LogicController;onChange:(controller:LogicController)=>void;onDetach:()=>void}){
  const inputs=controller.document.components.filter(c=>c.kind==='input');
  const outputs=controller.document.components.filter(c=>c.kind==='led');
  return <section className="robotics-card robotics-logic-editor" aria-label="Logic module controller">
    <div className="robotics-card-heading"><h2>Logic module controller</h2><span className="robotics-language">Signals → Robotics</span></div>
    <div className="logic-controller-title"><CircuitThumbnail snapshot={{document:controller.document}}/><div><h3>{controller.name}</h3><p>Real combinational logic, evaluated against the bench inputs.</p></div></div>
    <div className="logic-controller-mapping"><h4>Inputs · connect the senses</h4>
      {inputs.map(part=><label key={part.id}><span>{part.name??part.id}</span><select aria-label={'Sensor for '+(part.name??part.id)} value={controller.inputs[part.id]}
        onChange={event=>onChange({...controller,inputs:{...controller.inputs,[part.id]:event.target.value as LogicSensor}})}>
        <option value="button">Button pressed</option><option value="near">Distance below threshold</option><option value="dialHigh">Dial at or above threshold</option>
      </select></label>)}
      <label><span>Near threshold (cm)</span><input aria-label="Module distance threshold" type="number" min="0" max="400" value={controller.distanceThreshold}
        onChange={event=>onChange({...controller,distanceThreshold:Number(event.target.value)})}/></label>
      <label><span>Dial threshold</span><input aria-label="Module dial threshold" type="number" min="0" max="1023" value={controller.dialThreshold}
        onChange={event=>onChange({...controller,dialThreshold:Number(event.target.value)})}/></label>
      <h4>Outputs · choose the action</h4>
      {outputs.map(part=><label key={part.id}><span>{part.name??part.id}</span><select aria-label={'Actuator for '+(part.name??part.id)} value={controller.outputs[part.id]??''}
        onChange={event=>onChange({...controller,outputs:{...controller.outputs,[part.id]:(event.target.value||null) as LogicActuator|null}})}>
        <option value="">Unused</option><option value="green">Green LED</option><option value="red">Red LED</option><option value="amber">Amber LED</option><option value="servo">Servo · LOW 0° / HIGH 90°</option>
      </select></label>)}
    </div>
    <p className="logic-controller-note">Upload after changing the mapping. Each mapped actuator needs its own output. Unconnected sensors read LOW. Unknown or floating outputs stop the controller with a fault.</p>
    <div className="logic-controller-actions"><button onClick={()=>{
      if(!window.confirm('Open a copy of this controller in Signals? Save that lab’s working project first to keep it.'))return;
      const store=useDigitalStore.getState();if(!store.switchWorkspace('signal'))return;
      store.load(JSON.parse(JSON.stringify(controller.document)));window.location.hash='signal';
    }}>Edit circuit in Signals ↗</button><button onClick={onDetach}>Detach module</button></div>
  </section>;
}
