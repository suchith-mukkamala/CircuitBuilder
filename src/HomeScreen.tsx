import { useMemo, useState } from 'react';
import type { DigitalRuntime, LogicValue } from './digital/types';
import { emptyDigitalRuntime } from './digital/types';
import { stepCircuit } from './digital/computerEngine';
import { cpuCoreDemo } from './digital/computerSamples';
import { simulateLogic } from './digital/engine';

const binary = (bits: LogicValue[]) => {
  if(bits.some(b=>b!==0&&b!==1))return 'XXXX';
  return [...bits].reverse().join('');
};
const numeric = (bits: LogicValue[]):number|null => {
  if(bits.some(b=>b!==0&&b!==1))return null;
  return bits.reduce<number>((n,b,i)=>n+Number(b)*(1<<i),0);
};
const textValue=(word:number|null):string=>
  word===null?'X':'0x'+word.toString(16).toUpperCase();

function Chip({x,y,w,h,label,subtitle,accent='mint'}:{
  x:number;y:number;w:number;h:number;label:string;subtitle:string;accent?:'mint'|'pink'|'blue'|'gold';
}){
  const colors={mint:'#79ffcf',pink:'#f3a6ff',blue:'#83cafb',gold:'#ffe09a'};
  const color=colors[accent];
  return <g className={'home-cpu-chip chip-'+accent}>
    <rect x={x+5} y={y+6} width={w} height={h} rx="2" fill="#050b20" opacity=".8"/>
    <rect x={x} y={y} width={w} height={h} fill="#191334" stroke={color} strokeWidth="2.6"/>
    <rect x={x+8} y={y+8} width={w-16} height={h-16} fill="#151d3c"
      stroke={color} strokeOpacity=".28" strokeWidth="1"/>
    {[0,1,2,3].map(i=><g key={i} stroke={color} strokeWidth="2">
      <line x1={x+17+i*(w-34)/3} y1={y-8} x2={x+17+i*(w-34)/3} y2={y}/>
      <line x1={x+17+i*(w-34)/3} y1={y+h} x2={x+17+i*(w-34)/3} y2={y+h+8}/>
    </g>)}
    <text x={x+w/2} y={y+h/2-3} fill={color} textAnchor="middle"
      fontFamily="monospace" fontWeight="900" fontSize={w<110?13:16}>{label}</text>
    <text x={x+w/2} y={y+h/2+17} fill="#aec7e9" textAnchor="middle"
      fontFamily="monospace" fontSize="10">{subtitle}</text>
  </g>;
}
export function HomeScreen({onAnalog,onSignal,onCpu}:{
  onAnalog:()=>void;onSignal:()=>void;onCpu:()=>void;
}) {
  const demo=useMemo(()=>cpuCoreDemo(),[]);
  const [runtime,setRuntime]=useState<DigitalRuntime>(emptyDigitalRuntime);
  const result=useMemo(()=>simulateLogic(demo,runtime),[demo,runtime]);
  const bits=(id:string)=>[0,1,2,3].map(i=>result.terminalValues[id+':q'+i]??'X');
  const pcBits=bits('pc'),accBits=bits('acc'),romBits=bits('rom');
  const pc=numeric(pcBits),acc=numeric(accBits),rom=numeric(romBits);
  const step=()=>setRuntime(current=>stepCircuit(demo,current));
  return <main className="home-root">
    <div className="home-stars" aria-hidden="true"/>
    <section className="home-hero">
      <div className="home-intro">
        <div className="home-microtag"><span className="home-led"/> CIRCUITBUILDER / COMPUTING WORKBENCH v0.8</div>
        <h1>BUILD THE <span>COMPUTER.</span><br/>UNDERSTAND THE <span>BIT.</span></h1>
        <p>From one transistor-inspired circuit to a clocked digital datapath.
          Design logic, wire your own modules, and discover how a computer remembers and computes.</p>
        <div className="home-actions">
          <button className="home-primary" onClick={onCpu}>▶ OPEN THE 4-BIT CPU DEMO</button>
          <button className="home-outline" onClick={onSignal}>▥ ENTER SIGNAL LAB</button>
        </div>
        <div className="home-mini-stats">
          <span><strong>02</strong> LABORATORIES</span>
          <span><strong>28</strong> DIGITAL PARTS</span>
          <span><strong>04</strong> BIT DEMO CPU</span>
        </div>
      </div>
      <div className="home-cpu-terminal">
        <div className="home-terminal-header"><span>▣</span> LIVE DATAPATH / 4-BIT CORE
          <span className="home-terminal-live"><i/> LIVE LOGIC</span></div>
        <div className="home-terminal-display">
          <svg viewBox="0 0 630 362" role="img"
            aria-label="4-bit CPU datapath connecting a program counter to ROM, ALU and an accumulator register"
            xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="cpu-grid" width="20" height="20" patternUnits="userSpaceOnUse">
                <path d="M20 0H0V20" fill="none" stroke="#2d3159" strokeWidth=".6"/>
              </pattern>
              <filter id="cpu-glow"><feGaussianBlur stdDeviation="3" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
            </defs>
            <rect width="630" height="362" fill="#090f28"/>
            <rect width="630" height="362" fill="url(#cpu-grid)"/>
            <g strokeWidth="3" fill="none" strokeLinejoin="bevel">
              <path d="M143 128H172" stroke="#83cafb"/>
              <path d="M291 128H325" stroke="#83cafb"/>
              <path d="M441 128H463V204" stroke="#ffe09a"/>
              <path d="M518 272V292H258V202H242" stroke="#79ffcf"/>
              <path d="M115 272V211H103V169" stroke="#ee9eff" strokeDasharray="5 5"/>
              <path d="M515 204V169" stroke="#79ffcf" strokeDasharray="5 6"/>
              <path d="M68 211V192H64V169" stroke="#df91f4"/>
            </g>
            <g filter="url(#cpu-glow)" fill="#8fffe0">
              {[190,213,236,259].map((x,i)=>
                <rect key={i} x={x+(runtime.cycle%3)*7} y="125" width="5" height="6"
                  opacity={.4+i*.13}/>)}
              {[345,370,395,420].map((x,i)=>
                <rect key={i} x={x+(runtime.cycle%4)*4} y="125" width="5" height="6"
                  opacity={.3+i*.14}/>)}
            </g>
            <Chip x={30} y={88} w={114} h={80} label="PC" subtitle={textValue(pc)} accent="blue"/>
            <Chip x={173} y={88} w={118} h={80} label="ROM" subtitle={textValue(rom)} accent="blue"/>
            <Chip x={324} y={88} w={117} h={80} label="4-BIT ALU" subtitle="ADD" accent="gold"/>
            <Chip x={463} y={204} w={125} h={69} label="ACC" subtitle={textValue(acc)} accent="mint"/>
            <Chip x={30} y={210} w={140} h={65} label="CLOCK" subtitle={'CYCLE '+runtime.cycle} accent="pink"/>
            <text x="158" y="116" fill="#adc1e4" fontFamily="monospace" fontSize="10">ADDR</text>
            <text x="300" y="116" fill="#adc1e4" fontFamily="monospace" fontSize="10">DATA</text>
            <text x="449" y="191" fill="#c8b5ce" fontFamily="monospace" fontSize="10">SUM</text>
            <text x="346" y="283" fill="#a3f1de" fontFamily="monospace" fontSize="10">FEEDBACK (4 BITS)</text>
            <text x="29" y="337" fill="#7c93bc" fontFamily="monospace" fontSize="10">
              4-BIT ACCUMULATOR DATAPATH — INTERACTIVE CLOCK DEMO
            </text>
          </svg>
        </div>
        <div className="home-terminal-console">
          <div className="home-cpu-readouts">
            <div><small>PROGRAM COUNTER</small><strong>{binary(pcBits)}</strong></div>
            <div><small>ROM VALUE</small><strong>{binary(romBits)}</strong></div>
            <div><small>ACCUMULATOR</small><strong>{binary(accBits)}</strong></div>
          </div>
          <div className="home-clock-actions">
            <button onClick={step}>↯ CLOCK STEP</button>
            <button onClick={()=>setRuntime(current=>{
              let next=current;
              for(let i=0;i<8;i++)next=stepCircuit(demo,next);
              return next;
            })}>+8 CYCLES</button>
            <button onClick={()=>setRuntime(emptyDigitalRuntime())}>↺ RESET</button>
          </div>
          <p>This preview runs the same digital engine as Signal Lab. Step the clock to watch the program counter and accumulator change.</p>
        </div>
      </div>
    </section>
    <section className="home-labs">
      <div className="home-section-heading"><span>▦</span><div>
        <small>CHOOSE YOUR WORKSPACE</small>
        <h2>THE LABORATORIES</h2>
      </div></div>
      <div className="home-lab-cards">
        <button className="home-lab-card home-analog" onClick={onAnalog}>
          <span className="home-card-number">LAB 01 / VOLTAGE & CURRENT</span>
          <span className="home-card-art" aria-hidden="true">∿ ──▤── ⏚</span>
          <strong>ANALOG LAB</strong>
          <span>Resistors, sources, capacitors, inductors, DC and transient simulation.</span>
          <b>ENTER ANALOG LAB <span>↗</span></b>
        </button>
        <button className="home-lab-card home-signal" onClick={onSignal}>
          <span className="home-card-number">LAB 02 / DIGITAL COMPUTATION</span>
          <span className="home-card-art" aria-hidden="true">01 ⊕ ▣ 10</span>
          <strong>SIGNAL LAB</strong>
          <span>Boolean gates, custom blocks, registers, memory, clock steps and CPU experiments.</span>
          <b>ENTER SIGNAL LAB <span>↗</span></b>
        </button>
        <button className="home-lab-card home-cpu" onClick={onCpu}>
          <span className="home-card-number">STARTER PROJECT / 4-BIT DATAPATH</span>
          <span className="home-card-art" aria-hidden="true">▣ ALU ▣</span>
          <strong>CPU STARTER</strong>
          <span>Explore and rewire a live program counter, ROM, ALU, and accumulator.</span>
          <b>OPEN STARTER CIRCUIT <span>↗</span></b>
        </button>
      </div>
    </section>
    <section className="home-roadmap">
      <div className="home-section-heading"><span>⌘</span><div>
        <small>FROM GATES TO COMPUTERS</small>
        <h2>YOUR HARDWARE JOURNEY</h2>
      </div></div>
      <div className="home-roadmap-grid">
        <div><strong>01 / LOGIC</strong><span>Gates, adders, multiplexers, and saved blocks.</span></div>
        <div><strong>02 / STATE</strong><span>Clocked flip-flops, RAM, ROM, counters and registers.</span></div>
        <div><strong>03 / DATAPATH</strong><span>Four-bit ALU, program counter, and interactive CPU example.</span></div>
        <div className="home-future"><strong>04 / NEXT FRONTIER</strong><span>Instruction sets, control units, buses and larger memory systems.</span></div>
      </div>
    </section>
    <footer className="home-footer">CIRCUITBUILDER // HARDWARE IS SOFTWARE YOU CAN TOUCH · EDUCATIONAL SIMULATOR</footer>
  </main>;
}
