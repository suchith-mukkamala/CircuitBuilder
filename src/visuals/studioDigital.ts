import {digitalLabel,inputsOf,outputsOf,localPinAt,partHeight,type DigitalComponent,type DigitalDocument,type LogicResult} from '../digital/types';
const signal=(value:unknown)=>value===1?'#8de5c4':value===0?'#739dc9':value==='X'?'#ff9ebd':'#8a9cae';
/** Draw at the component's local origin; electrical pin positions stay unchanged. */
export function drawStudioDigital(ctx:CanvasRenderingContext2D,c:DigitalComponent,doc:DigitalDocument,result:LogicResult,selected:boolean){
  const inputs=inputsOf(c),outputs=outputsOf(c),chip=c.kind==='block'||inputs.length>2||outputs.length>1;
  const value=c.kind==='led'?result.ledValues[c.id]:result.terminalValues[c.id+':'+(outputs[0]??inputs[0])];
  const tint=signal(value),h=chip?partHeight(c):56,w=c.kind==='block'?120:chip?88:58;
  ctx.shadowBlur=0;ctx.lineWidth=2;ctx.lineCap='round';ctx.lineJoin='round';
  if(selected){ctx.strokeStyle='#e8d6a3';ctx.setLineDash([5,4]);ctx.strokeRect(-w/2-8,-h/2-8,w+16,h+16);ctx.setLineDash([]);}
  for(const pin of [...inputs,...outputs]){const p=localPinAt(c,pin);ctx.strokeStyle='#7695a9';ctx.lineWidth=3;
    ctx.beginPath();ctx.moveTo(p.x<0?-w/2:w/2,p.y);ctx.lineTo(p.x,p.y);ctx.stroke();}
  const fill=ctx.createLinearGradient(0,-h/2,0,h/2);fill.addColorStop(0,'#253a50');fill.addColorStop(1,'#142638');
  ctx.fillStyle=fill;ctx.strokeStyle=chip?'#7f9faf':tint;ctx.lineWidth=1.7;
  const finish=()=>{ctx.fill();ctx.stroke();};
  const simpleGate=['and','nand','or','nor','xor','xnor','not','buffer'].includes(c.kind);
  if(simpleGate){
    const negate=['nand','nor','xnor','not'].includes(c.kind);
    const isAnd=c.kind==='and'||c.kind==='nand',isTriangle=c.kind==='not'||c.kind==='buffer';
    ctx.beginPath();
    if(isAnd){ctx.moveTo(-27,-24);ctx.lineTo(-2,-24);ctx.bezierCurveTo(34,-24,34,24,-2,24);ctx.lineTo(-27,24);ctx.closePath();}
    else if(isTriangle){ctx.moveTo(-26,-24);ctx.lineTo(22,0);ctx.lineTo(-26,24);ctx.closePath();}
    else{ctx.moveTo(-28,-24);ctx.quadraticCurveTo(-10,0,-28,24);ctx.quadraticCurveTo(5,27,29,0);ctx.quadraticCurveTo(5,-27,-28,-24);ctx.closePath();}
    finish();
    if(c.kind==='xor'||c.kind==='xnor'){ctx.beginPath();ctx.moveTo(-35,-24);ctx.quadraticCurveTo(-17,0,-35,24);ctx.stroke();}
    if(negate){ctx.fillStyle='#102235';ctx.beginPath();ctx.arc(29,0,4,0,Math.PI*2);finish();}
    ctx.fillStyle='#d7e5ef';ctx.font='bold 11px monospace';ctx.fillText(isAnd?'&':isTriangle?'1':c.kind==='xor'||c.kind==='xnor'?'=1':'≥1',-6,1);
  }else{
    ctx.beginPath();ctx.roundRect(-w/2,-h/2,w,h,chip?5:9);finish();
    ctx.strokeStyle='#ffffff18';ctx.beginPath();ctx.moveTo(-w/2+7,-h/2+4);ctx.lineTo(w/2-7,-h/2+4);ctx.stroke();
    if(chip){
      ctx.fillStyle='#102033';ctx.beginPath();ctx.arc(0,-h/2,7,0,Math.PI);ctx.fill();
      ctx.font='bold 10px monospace';ctx.fillStyle='#c5dce8';
      const title=c.kind==='block'?'MODULE':c.kind.toUpperCase();ctx.fillText(title,0,-8);
      const known=outputs.slice(0,4).map(pin=>result.terminalValues[c.id+':'+pin]);
      ctx.font='11px monospace';ctx.fillStyle=tint;
      ctx.fillText(known.every(v=>v===0||v===1)?'0x'+known.reduce<number>((n,v,i)=>n+(v===1?2**i:0),0).toString(16).toUpperCase():'—',0,11);
      const def=doc.blocks?.find(d=>d.id===c.blockId);
      for(const [ports,side] of [[inputs,-1],[outputs,1]] as const)for(const [i,pin] of ports.entries()){
        const p=localPinAt(c,pin),caption=(side<0?def?.inputs[i]?.label:def?.outputs[i]?.label)??pin.toUpperCase();
        ctx.font='8px monospace';ctx.textAlign=side<0?'left':'right';ctx.fillStyle='#a9c2d3';ctx.fillText(caption.slice(0,c.kind==='block'?10:7),side*(w/2-7),p.y-7);
      }
    }else if(c.kind==='led'){
      const lens=ctx.createRadialGradient(-4,-4,1,0,0,18);lens.addColorStop(0,value===1?'#d2fff0':'#55728c');lens.addColorStop(1,value===1?'#3fbd93':'#213c52');
      ctx.fillStyle=lens;ctx.beginPath();ctx.arc(0,0,17,0,Math.PI*2);ctx.fill();ctx.strokeStyle=tint;ctx.stroke();
      ctx.fillStyle='#ffffff33';ctx.beginPath();ctx.ellipse(-5,-7,6,3,-.5,0,Math.PI*2);ctx.fill();
    }else{
      ctx.fillStyle=value===1?'#9ae5c7':'#9cb8d5';ctx.font='bold 22px monospace';ctx.textAlign='center';ctx.fillText(c.kind==='clock'?'CLK':String(value??'Z'),0,1);
    }
  }
  ctx.textAlign='center';ctx.font='bold 10px monospace';ctx.fillStyle=selected?'#f4dfaa':'#c5d9e9';
  ctx.fillText(digitalLabel(c,doc.components),0,-h/2-15);
  if(!chip){ctx.font='9px monospace';ctx.fillStyle=tint;ctx.fillText(value===1?'HIGH':value===0?'LOW':String(value??'Z'),0,h/2+17);}
}
