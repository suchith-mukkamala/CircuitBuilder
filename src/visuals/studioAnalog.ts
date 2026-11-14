import type {CircuitComponent,ComponentReading} from '../circuit/types';
const bandColors=['#302c2a','#85513c','#bf5147','#de8e49','#e2c857','#629d72','#537eb8','#9e6cb5','#a0a5ab','#e6e5dc'];
// Encode the actual resistance; arbitrary values keep a plain body rather than a misleading color code.
function resistanceBands(value:number){
  if(!Number.isFinite(value)||value<=0)return [];
  for(const digits of [2,3]){
    const exponent=Math.floor(Math.log10(value))-digits+1,significand=value/10**exponent;
    if(exponent< -2||exponent>9||Math.abs(significand-Math.round(significand))>1e-7)continue;
    return [...String(Math.round(significand))].map(d=>bandColors[Number(d)]).concat(exponent===-2?'#b6bec8':exponent===-1?'#d7b658':bandColors[exponent]);
  }
  return [];
}
export function drawStudioAnalog(ctx:CanvasRenderingContext2D,c:CircuitComponent,selected:boolean,reading:ComponentReading|undefined,voltageScale:number){
  ctx.save();ctx.translate(c.x,c.y);ctx.rotate(c.rotation*Math.PI/180);ctx.lineCap='round';ctx.lineJoin='round';ctx.shadowBlur=0;
  if(selected){ctx.strokeStyle='#e9d59f';ctx.lineWidth=1.5;ctx.setLineDash([5,4]);ctx.strokeRect(-40,-35,80,70);ctx.setLineDash([]);}
  ctx.strokeStyle='#8eb6c9';ctx.lineWidth=3;
  const line=(x:number,y:number,xx:number,yy:number)=>{ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(xx,yy);ctx.stroke();};
  if(c.kind==='ground'){
    line(0,-36,0,-8);for(let i=0;i<3;i++)line(-23+i*8,-8+i*9,23-i*8,-8+i*9);
  }else if(c.kind==='voltage_source'||c.kind==='current_source'){
    line(0,-48,0,-25);line(0,25,0,48);
    const fill=ctx.createLinearGradient(-20,-20,20,20);fill.addColorStop(0,'#334852');fill.addColorStop(1,'#152f3e');
    ctx.fillStyle=fill;ctx.strokeStyle='#dec98f';ctx.beginPath();ctx.arc(0,0,25,0,Math.PI*2);ctx.fill();ctx.stroke();
    if(c.kind==='voltage_source'){line(-6,-10,6,-10);line(0,-16,0,-4);line(-6,11,6,11);}
    else{line(0,-14,0,14);line(0,14,-6,5);line(0,14,6,5);}
  }else{
    line(-48,0,-28,0);line(28,0,48,0);
    if(c.kind==='resistor'||c.kind==='potentiometer'){
      const fill=ctx.createLinearGradient(0,-15,0,15);fill.addColorStop(0,'#e6c590');fill.addColorStop(.45,'#b99568');fill.addColorStop(1,'#765c49');
      ctx.fillStyle=fill;ctx.strokeStyle='#d4b183';ctx.lineWidth=1.2;ctx.beginPath();ctx.roundRect(-28,-13,56,26,5);ctx.fill();ctx.stroke();
      const bands=c.kind==='resistor'?resistanceBands(c.value):[];
      bands.forEach((color,i)=>{ctx.fillStyle=color;ctx.fillRect(-19+i*34/Math.max(1,bands.length-1),-12,4,24);});
      if(c.kind==='potentiometer'){ctx.strokeStyle='#c4b4ed';ctx.lineWidth=2;const x=-20+(c.wiper??.5)*40;line(0,48,0,32);line(0,32,x,17);line(x,17,x-5,26);line(x,17,x+6,25);}
    }else if(c.kind==='capacitor'){
      ctx.strokeStyle='#adbac9';ctx.lineWidth=4;line(-28,0,-9,0);line(9,0,28,0);line(-9,-25,-9,25);line(9,-25,9,25);
      if(reading){const charge=Math.max(0,Math.min(1,Math.abs(reading.voltage)/Math.max(.001,voltageScale)));
        ctx.fillStyle=reading.voltage<0?'#b6a5dd88':'#7edbb788';ctx.fillRect(-6,23-charge*46,12,charge*46);}
    }else if(c.kind==='inductor'){
      ctx.strokeStyle='#95bfdf';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-28,0);for(let i=0;i<4;i++)ctx.bezierCurveTo(-28+i*14,-24,-14+i*14,-24,-14+i*14,0);ctx.stroke();
    }else if(c.kind==='switch'){
      ctx.strokeStyle=c.closed?'#91dcb9':'#bac7dc';line(-28,0,-18,0);line(18,0,28,0);line(-18,0,18,c.closed?0:-25);
      ctx.fillStyle='#162b3d';for(const x of [-18,18]){ctx.beginPath();ctx.arc(x,0,4,0,Math.PI*2);ctx.fill();ctx.stroke();}
    }
  }
  ctx.restore();
}
