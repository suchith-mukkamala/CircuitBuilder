import {digitalPins,readInput,type Device,type Inputs,type Pin,type Wiring} from './model';
import type {ControllerState} from './engine';

const pinPosition:Record<Pin,{x:number;y:number}>={
  D0:{x:270,y:156},D1:{x:270,y:188},D2:{x:490,y:144},D3:{x:490,y:176},
  D4:{x:490,y:208},D5:{x:490,y:240},D6:{x:490,y:272},D7:{x:490,y:304},
  A0:{x:270,y:252},A1:{x:270,y:300},
};
const endpoints:{id:Device;x:number;y:number;color:string}[]=[
  {id:'button',x:172,y:124,color:'#a8bcfc'},
  {id:'distance',x:172,y:240,color:'#81d8ed'},
  {id:'knob',x:172,y:345,color:'#c8aff9'},
  {id:'red',x:600,y:110,color:'#ff8e9e'},
  {id:'amber',x:600,y:183,color:'#ffd083'},
  {id:'green',x:600,y:256,color:'#80e2c5'},
  {id:'servo',x:600,y:353,color:'#9bc0ff'},
];

export function ControllerBench({wiring,inputs,state}:{wiring:Wiring;inputs:Inputs;state:ControllerState}){
  const ledOn=(id:'red'|'amber'|'green')=>{
    const pin=wiring[id];return pin!==null&&digitalPins.includes(pin as typeof digitalPins[number])&&state.pins[pin as typeof digitalPins[number]]===1;
  };
  const servo=wiring.servo?state.servos[wiring.servo as typeof digitalPins[number]]??0:0;
  return <svg className="controller-bench" viewBox="0 0 760 440" role="img"
    aria-label="Virtual controller connected to a button, distance sensor, analog dial, three LEDs, and a servo. Live values appear in the pin monitor.">
    <defs>
      <pattern id="robotics-grid" width="20" height="20" patternUnits="userSpaceOnUse">
        <circle cx="1" cy="1" r=".7" fill="#3b526a" opacity=".6"/>
      </pattern>
      <filter id="led-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="7"/></filter>
    </defs>
    <rect width="760" height="440" fill="#0c1829"/><rect width="760" height="440" fill="url(#robotics-grid)"/>
    <g fontFamily="monospace" fontSize="9" fill="#7896af" letterSpacing="1.5">
      <text x="40" y="36">INPUTS / SENSE</text><text x="295" y="36">CB MICRO / 01</text><text x="584" y="36">OUTPUTS / ACT</text>
    </g>
    {endpoints.map(endpoint=>{
      const pin=wiring[endpoint.id];if(!pin)return null;
      const target=pinPosition[pin];
      const path=`M${endpoint.x} ${endpoint.y} H${endpoint.x<270?218:548} V${target.y} H${target.x}`;
      const value=endpoint.id==='button'?inputs.button:endpoint.id==='distance'?inputs.distance:endpoint.id==='knob'?inputs.knob:endpoint.id==='servo'?servo:state.pins[pin as typeof digitalPins[number]];
      return <g key={endpoint.id}><path d={path} fill="none" stroke={endpoint.color} opacity=".5" strokeWidth="2" strokeLinejoin="round"/>
        <path key={pin+':'+value} className="bench-signal-change" d={path} fill="none" stroke={endpoint.color} strokeWidth="4" strokeLinejoin="round"/></g>;
    })}
    <rect x="274" y="87" width="220" height="270" rx="12" fill="#000" opacity=".35"/>
    <rect x="270" y="81" width="220" height="270" rx="12" fill="#153d3b" stroke="#427d72" strokeWidth="2"/>
    {[[283,94],[477,94],[283,338],[477,338]].map(([x,y])=><circle key={x+':'+y} cx={x} cy={y} r="4" fill="#0c2430" stroke="#639d8e"/>)}
    <rect x="347" y="182" width="64" height="75" rx="3" fill="#0c1c29" stroke="#587782"/>
    {[0,1,2,3,4,5].map(i=><g key={i} stroke="#a7bdb8" strokeWidth="2"><path d={`M339 ${190+i*11}h8M411 ${190+i*11}h8`}/></g>)}
    <text x="379" y="216" textAnchor="middle" fill="#b3ded2" fontFamily="monospace" fontSize="13">CB</text>
    <text x="379" y="234" textAnchor="middle" fill="#789c9c" fontFamily="monospace" fontSize="8">CONTROLLER</text>
    <rect x="354" y="70" width="52" height="31" rx="3" fill="#8294a0" stroke="#becbd2"/>
    <rect x="362" y="74" width="36" height="13" rx="2" fill="#24374b"/>
    <text x="380" y="133" textAnchor="middle" fill="#b0d8ca" fontFamily="monospace" fontSize="11" letterSpacing="2">CB MICRO</text>
    <text x="380" y="151" textAnchor="middle" fill="#8bb6ad" fontFamily="monospace" fontSize="9">8 DIGITAL · 2 ANALOG</text>
    <circle cx="360" cy="284" r="3" fill="#80e2c5"/>
    <text x="371" y="287" fill="#a0c9bb" fontFamily="monospace" fontSize="8">POWER</text>
    {(Object.entries(pinPosition) as [Pin,{x:number;y:number}][]).map(([pin,{x,y}])=>{
      const value=readInput(pin,inputs,wiring,state.pins);
      return <g key={pin}>
        <rect x={x-5} y={y-4} width="10" height="8" rx="1" fill={value>0?'#a3e8d1':'#637b86'} stroke="#142936"/>
        <text x={x+(x<380?13:-13)} y={y+3} textAnchor={x<380?'start':'end'} fill="#a8c9be" fontFamily="monospace" fontSize="9">{pin}</text>
      </g>;
    })}
    <g transform="translate(78 89)">
      <rect width="94" height="70" rx="6" fill="#23354c" stroke="#63769c"/>
      <circle cx="47" cy="32" r="19" fill={inputs.button?'#a8bcfc':'#15233b'} stroke="#a8bcfc" strokeWidth="2"/>
      <text x="47" y="93" textAnchor="middle" fill="#b4c6df" fontFamily="monospace" fontSize="10">BUTTON</text>
    </g>
    <g transform="translate(78 212)">
      <rect width="94" height="54" rx="5" fill="#233d51" stroke="#578fa6"/>
      {[25,69].map(x=><g key={x}><circle cx={x} cy="25" r="17" fill="#102335" stroke="#9ebed0" strokeWidth="2"/><circle cx={x} cy="25" r="11" fill="#354d61"/></g>)}
      <text x="47" y="78" textAnchor="middle" fill="#81d8ed" fontFamily="monospace" fontSize="10">{inputs.distance} cm</text>
    </g>
    <g transform="translate(125 345)">
      <circle r="26" fill="#25304b" stroke="#806aab"/>
      <g transform={`rotate(${-135+inputs.knob/1023*270})`}><path d="M0 -8V-20" stroke="#d1bafd" strokeWidth="4" strokeLinecap="round"/></g>
      <text y="47" textAnchor="middle" fill="#c8aff9" fontFamily="monospace" fontSize="10">DIAL / {inputs.knob}</text>
    </g>
    {(['red','amber','green'] as const).map((id,i)=>{
      const y=110+i*73,color=endpoints.find(e=>e.id===id)!.color,on=ledOn(id);
      return <g key={id}>
        <rect x="600" y={y-25} width="112" height="50" rx="5" fill="#1a2a40" stroke="#354e68"/>
        {on&&<circle cx="627" cy={y} r="16" fill={color} opacity=".5" filter="url(#led-glow)"/>}
        <circle className="bench-led-lens" cx="627" cy={y} r="11" fill={on?color:'#202d40'} stroke={color} strokeWidth="1.5"/>
        <text x="648" y={y-3} fill="#b9cce1" fontFamily="monospace" fontSize="9">{id.toUpperCase()}</text>
        <text x="648" y={y+12} fill={on?color:'#7791aa'} fontFamily="monospace" fontSize="8">{on?'ON':'OFF'}</text>
      </g>;
    })}
    <g transform="translate(650 353)">
      <rect x="-50" y="-26" width="100" height="58" rx="5" fill="#233e64" stroke="#719dd2"/>
      <g className="servo-horn" style={{transform:`rotate(${-servo}deg)`}}><rect x="-7" y="-7" width="49" height="14" rx="7" fill="#d2dded"/><circle r="4" fill="#637eaa"/></g>
      <text y="55" textAnchor="middle" fill="#9bc0ff" fontFamily="monospace" fontSize="10">SERVO / {servo}°</text>
    </g>
    <text x="380" y="408" textAnchor="middle" fill="#7896af" fontFamily="monospace" fontSize="9">IDEAL SIGNAL CONNECTIONS · POWER & GROUND PROVIDED</text>
  </svg>;
}
