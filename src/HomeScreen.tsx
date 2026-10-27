type LabChoice = {
  id:'analog'|'signal'|'computer';
  number:string;
  name:string;
  description:string;
  symbol:string;
  action:()=>void;
};

function CpuCircuitArt() {
  const trace = '#79d9c5';
  const violet = '#a797ea';
  return <svg className="landing-cpu-svg" viewBox="0 0 1040 400" role="img"
    aria-label="Simple four-bit CPU circuit: program counter connects to ROM, ROM connects to an ALU, and the ALU connects to an accumulator register with a feedback loop">
    <defs>
      <pattern id="landing-grid" width="26" height="26" patternUnits="userSpaceOnUse">
        <path d="M26 0H0V26" fill="none" stroke="#313b5c" strokeWidth=".7" opacity=".45"/>
      </pattern>
      <filter id="landing-glow" x="-30%" y="-30%" width="160%" height="160%">
        <feGaussianBlur stdDeviation="5" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <rect width="1040" height="400" fill="url(#landing-grid)" opacity=".58"/>
    <g stroke="#344367" strokeWidth="1" strokeDasharray="3 9" opacity=".7">
      <path d="M26 54H1014M26 345H1014"/>
    </g>
    {/* Circuit trace, intentionally schematic rather than photorealistic. */}
    <g fill="none" stroke={trace} strokeWidth="3" strokeLinecap="square"
      strokeLinejoin="miter">
      <path d="M239 181H318"/>
      <path d="M481 181H559"/>
      <path d="M727 181H805"/>
      <path d="M897 245V315H643V262" stroke={violet}/>
      <path d="M149 121V78H897V117" stroke="#477a85" strokeWidth="2"
        strokeDasharray="6 8"/>
      <path d="M95 262V314H149V245" stroke="#477a85" strokeWidth="2"/>
    </g>
    <g fill={trace} filter="url(#landing-glow)">
      {[268,292,510,534,748,772].map(x=><rect key={x} x={x} y="178" width="5" height="6"/>)}
      <rect x="890" y="311" width="6" height="6" fill={violet}/>
    </g>
    {[
      {x:74,w:164,label:'COUNTER',sub:'PROGRAM / PC',stroke:'#80b9ff'},
      {x:317,w:164,label:'ROM',sub:'16 × 4 MEMORY',stroke:'#9c9af1'},
      {x:559,w:168,label:'ALU',sub:'4-BIT LOGIC',stroke:'#8cf2d3'},
      {x:805,w:168,label:'REGISTER',sub:'ACCUMULATOR',stroke:'#d0a8ea'},
    ].map(chip=><g key={chip.label}>
      <rect x={chip.x+6} y="127" width={chip.w} height="118" fill="#060a18" opacity=".9"/>
      <rect x={chip.x} y="121" width={chip.w} height="118" rx="2"
        fill="#151a32" stroke={chip.stroke} strokeWidth="2.5"/>
      <rect x={chip.x+9} y="130" width={chip.w-18} height="100"
        fill="none" stroke={chip.stroke} strokeWidth=".8" opacity=".24"/>
      {[0,1,2,3].map(i=><g key={i} stroke={chip.stroke} strokeWidth="2">
        <path d={'M'+(chip.x+23+i*(chip.w-46)/3)+' 109v12'}/>
        <path d={'M'+(chip.x+23+i*(chip.w-46)/3)+' 239v12'}/>
      </g>)}
      <text x={chip.x+chip.w/2} y="170" textAnchor="middle"
        fill="#f1edff" fontSize="17" fontFamily="monospace" fontWeight="bold" letterSpacing="1.1">{chip.label}</text>
      <text x={chip.x+chip.w/2} y="193" textAnchor="middle"
        fill="#91a7c4" fontSize="10.5" fontFamily="monospace" letterSpacing=".6">{chip.sub}</text>
      <g stroke={chip.stroke} strokeWidth="1.4" fill="none" opacity=".65">
        <path d={'M'+(chip.x+23)+' 210h20m12 0h11'}/>
      </g>
    </g>)}
    <g fill="#819abb" fontFamily="monospace" fontSize="11">
      <text x="278" y="161" textAnchor="middle">ADDR</text>
      <text x="520" y="161" textAnchor="middle">DATA</text>
      <text x="765" y="161" textAnchor="middle">RESULT</text>
      <text x="757" y="306" textAnchor="middle">FEEDBACK</text>
      <text x="95" y="286">CLK</text>
    </g>
    <g fill="none" stroke={trace} strokeWidth="1.6">
      <path d="M310 176l7 5-7 5M552 176l7 5-7 5M798 176l7 5-7 5"/>
    </g>
    <g fill="#8bf8d6" opacity=".85">
      <rect x="21" y="22" width="6" height="6"/>
      <rect x="1012" y="373" width="6" height="6"/>
    </g>
    <text x="30" y="31" fill="#7098aa" fontSize="10" fontFamily="monospace"
      letterSpacing="1.5">FOUR BIT ARCHITECTURE</text>
    <text x="1009" y="378" textAnchor="end" fill="#7098aa" fontSize="10"
      fontFamily="monospace" letterSpacing="1.5">SIGNAL FLOW / 01</text>
  </svg>;
}

export function HomeScreen({
  onAnalog,onSignal,onComputer,
}:{
  onAnalog:()=>void;onSignal:()=>void;onComputer:()=>void;
}) {
  const labs:LabChoice[]=[
    {id:'analog',number:'01',name:'ANALOG LAB',
      description:'Voltage & circuits',symbol:'〰',action:onAnalog},
    {id:'signal',number:'02',name:'SIGNAL LAB',
      description:'Logic & signals',symbol:'⊕',action:onSignal},
    {id:'computer',number:'03',name:'COMPUTER BUILDER',
      description:'Memory & processors',symbol:'▣',action:onComputer},
  ];
  return <main className="landing-home">
    <div className="landing-content">
      <div className="landing-eyebrow"><span/> THE ELECTRONICS PLAYGROUND</div>
      <h1>Build something <em>brilliant.</em></h1>
      <p className="landing-subtitle">Design circuits. Explore signals. Program computers.</p>
      <div className="landing-art">
        <CpuCircuitArt/>
      </div>
      <div className="landing-choices" aria-label="Choose a laboratory">
        {labs.map(lab=><button key={lab.id}
          className={'landing-choice landing-choice-'+lab.id}
          onClick={lab.action}>
          <span className="landing-choice-icon" aria-hidden="true">{lab.symbol}</span>
          <span className="landing-choice-text">
            <span className="landing-choice-name">{lab.name}</span>
            <span className="landing-choice-description">{lab.description}</span>
          </span>
          <span className="landing-choice-arrow" aria-hidden="true">↗</span>
          <span className="landing-choice-number" aria-hidden="true">{lab.number}</span>
        </button>)}
      </div>
      <div className="landing-bottom">CIRCUITBUILDER <span aria-hidden="true">·</span> DESIGN / CONNECT / DISCOVER</div>
    </div>
  </main>;
}
