import {useEffect,useRef} from 'react';
import type {KeyboardEvent,MouseEvent} from 'react';
import {BIOME_INFO,SPECIES_INFO,type Brush,type World} from './engine';

const CELL=12;
const hex=(n:number)=>Math.abs(Math.imul(n,16807))>>>0;
/** Pixel-art fantasy map. Canvas redraw depends ONLY on world / map settings. */
export function WorldCanvas({
  world,brush,overlay,selected,onSelect,onEdit,zoom=1,
}:{
  world:World;brush:Brush;overlay:'terrain'|'resources';selected:{x:number;y:number}|null;
  onSelect:(x:number,y:number)=>void;onEdit:(x:number,y:number)=>void;zoom?:number;
}){
  const canvasRef=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    const canvas=canvasRef.current,ctx=canvas?.getContext('2d');
    if(!canvas||!ctx)return;
    const W=world.width,H=world.height;
    ctx.clearRect(0,0,canvas.width,canvas.height);
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){
      const tile=world.tiles[y*W+x],biome=BIOME_INFO[tile.biome];
      const px=x*CELL,py=y*CELL,h=hex((x+5)*73+(y+11)*317+world.settings.seed);
      ctx.fillStyle=biome.color;ctx.fillRect(px,py,CELL,CELL);
      // Seeded tiny marks add texture without breaking deterministic replays.
      if(tile.biome==='forest'){
        ctx.fillStyle=h%3===0?'#43836b':'#32705c';
        ctx.fillRect(px+(h%7)+1,py+((h>>>4)%6)+1,3,4);
        ctx.fillStyle='#1b5046';ctx.fillRect(px+8,py+8,2,2);
      }else if(tile.biome==='mountain'){
        ctx.fillStyle='#9da2b2';
        ctx.fillRect(px+(h%5)+2,py+2,4,2);
        ctx.fillStyle='#343b4d';ctx.fillRect(px+8,py+7,2,3);
      }else if(tile.biome==='cave'){
        ctx.fillStyle='#71738e';ctx.fillRect(px+2,py+3,8,1);
        ctx.fillStyle='#131b31';ctx.fillRect(px+4,py+5,5,5);
      }else if(tile.biome==='water'){
        ctx.fillStyle=h%2?'#2a6180':'#347291';
        ctx.fillRect(px+(h%7),py+4,5,1);
      }else if(tile.biome==='volcanic'){
        ctx.fillStyle=h%2?'#e48e6f':'#c36d6e';
        ctx.fillRect(px+3,py+4,3,3);
      }else if(tile.biome==='plains'){
        ctx.fillStyle=h%3===0?'#89a179':'#637e60';
        ctx.fillRect(px+(h%7),py+((h>>>4)%8),2,2);
      }else if(tile.biome==='wasteland'){
        ctx.fillStyle='#9e6e7c';
        ctx.fillRect(px+(h%7),py+((h>>>4)%8),3,1);
      }
      if(overlay==='resources'&&tile.biome!=='water'){
        const fullness=Math.min(1,tile.food/Math.max(1,biome.food*world.settings.resourceLevel));
        ctx.fillStyle=fullness>.66?'rgba(117,255,176,.34)':
          fullness>.32?'rgba(233,202,99,.35)':'rgba(255,88,124,.45)';
        ctx.fillRect(px+1,py+1,10,10);
      }
    }
    for(const s of world.settlements){
      const px=s.x*CELL+6,py=s.y*CELL+6;
      ctx.save();ctx.strokeStyle='#ffe7a1';ctx.lineWidth=1.4;
      ctx.fillStyle='#101c34';
      ctx.fillRect(px-8,py-8,16,16);ctx.strokeRect(px-8,py-8,16,16);
      ctx.fillStyle=SPECIES_INFO[s.species].color;
      ctx.fillRect(px-5,py-4,10,9);
      ctx.fillStyle='#182437';ctx.fillRect(px-1,py+1,3,4);
      ctx.fillStyle='#f6e5ba';ctx.fillRect(px-6,py-7,12,3);
      ctx.restore();
    }
    for(const a of world.agents){
      const px=a.x*CELL,py=a.y*CELL;
      ctx.fillStyle='#0b1025';ctx.fillRect(px+2,py+2,9,9);
      ctx.fillStyle=SPECIES_INFO[a.species].color;
      ctx.fillRect(px+3,py+2,7,7);
      ctx.fillStyle='#f5ebdc';ctx.fillRect(px+5,py+3,2,2);
      if(a.age<SPECIES_INFO[a.species].maturity){
        ctx.fillStyle='#121c2e';ctx.fillRect(px+4,py+8,5,2);
      }
    }
    if(selected){
      const px=selected.x*CELL,py=selected.y*CELL;
      ctx.strokeStyle='#fff3b4';ctx.lineWidth=2;ctx.strokeRect(px+1,py+1,CELL-2,CELL-2);
      ctx.strokeStyle='#15192e';ctx.lineWidth=1;ctx.strokeRect(px-1,py-1,CELL+2,CELL+2);
    }
  },[world,overlay,selected]);
  const select=(event:MouseEvent<HTMLCanvasElement>)=>{
    const rect=event.currentTarget.getBoundingClientRect();
    const x=Math.floor((event.clientX-rect.left)/rect.width*world.width);
    const y=Math.floor((event.clientY-rect.top)/rect.height*world.height);
    if(x<0||x>=world.width||y<0||y>=world.height)return;
    if(brush.kind==='inspect')onSelect(x,y);
    else onEdit(x,y);
  };
  const keyboard=(event:KeyboardEvent<HTMLCanvasElement>)=>{
    if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Enter',' '].includes(event.key))return;
    event.preventDefault();
    const current=selected??{x:Math.floor(world.width/2),y:Math.floor(world.height/2)};
    let {x,y}=current;
    if(event.key==='ArrowUp')y=Math.max(0,y-1);
    if(event.key==='ArrowDown')y=Math.min(world.height-1,y+1);
    if(event.key==='ArrowLeft')x=Math.max(0,x-1);
    if(event.key==='ArrowRight')x=Math.min(world.width-1,x+1);
    if(event.key==='Enter'||event.key===' '){
      if(brush.kind!=='inspect')onEdit(x,y);
    }else onSelect(x,y);
  };
  return <canvas ref={canvasRef} className="evo-world-canvas"
    width={world.width*CELL} height={world.height*CELL}
    style={{width:(zoom*100)+'%'}}
    role="grid" tabIndex={0}
    aria-label={'Interactive fantasy map: '+world.width+' by '+world.height+
      ' cells. Click to '+(brush.kind==='inspect'?'inspect a location':
        brush.kind==='spawn'?'place a '+brush.species:
          brush.kind==='food'?'replenish food':'paint '+brush.biome)+
      '. Arrow keys move the selection; Enter applies the selected brush.'}
    onClick={select} onKeyDown={keyboard}/>;
}
