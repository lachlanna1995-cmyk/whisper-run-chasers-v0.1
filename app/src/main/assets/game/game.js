(()=>{'use strict';
const c=document.getElementById('game'),ctx=c.getContext('2d'),Art=window.SBArt;
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
let W=innerWidth,H=innerHeight,dpr=1,last=performance.now();
const GRID=24,TW=86,TH=43,SAVE_KEY='starbase_dead_orbit_v04';
const defaultBuildings=()=>[
{id:'hq',type:'COMMAND',name:'COMMAND CORE',x:10,y:10,w:4,h:4,level:1},
{id:'power1',type:'POWER',name:'FUSION PLANT',x:6,y:9,w:3,h:3,level:1},
{id:'med1',type:'MEDBAY',name:'MED BAY',x:15,y:9,w:3,h:3,level:1},
{id:'arm1',type:'ARMORY',name:'ARMORY',x:6,y:14,w:3,h:3,level:1},
{id:'store1',type:'STORAGE',name:'STORAGE',x:15,y:14,w:3,h:3,level:1},
{id:'air1',type:'AIR',name:'AIR PROCESSOR',x:11,y:5,w:3,h:3,level:1},
{id:'tur1',type:'TURRET',name:'SENTRY TURRET',x:4,y:5,w:2,h:2,level:1},
{id:'tur2',type:'TURRET',name:'SENTRY TURRET',x:18,y:5,w:2,h:2,level:1},
{id:'solar1',type:'SOLAR',name:'SOLAR ARRAY',x:3,y:17,w:3,h:2,level:1},
{id:'solar2',type:'SOLAR',name:'SOLAR ARRAY',x:18,y:18,w:3,h:2,level:1}
];
const defaults=()=>({alloy:420,data:60,orange:0,purple:0,server:'01',faction:'UNASSIGNED',command:1,rotation:0,buildings:defaultBuildings()});
let state=load();
let cam={x:W*.5,y:H*.2,zoom:.82,rot:state.rotation||0};
let selected=null,placement=null,moveMode=false,touches=new Map(),dragStart=null,moved=false,lastPinch=0,toastTimer=null,category='base';
const catalog={
base:[{type:'HAB',name:'HAB MODULE',w:3,h:2,cost:85,desc:'Crew capacity and recovery space.'},{type:'STORAGE',name:'STORAGE',w:3,h:3,cost:95,desc:'Raises logistics capacity.'},{type:'MEDBAY',name:'MED BAY',w:3,h:3,cost:110,desc:'Improves crew recovery.'}],
defense:[{type:'TURRET',name:'SENTRY TURRET',w:2,h:2,cost:120,desc:'Automated perimeter defense.'},{type:'WALL',name:'BLAST WALL',w:1,h:1,cost:20,desc:'Armored perimeter segment.'},{type:'SENSOR',name:'SENSOR TOWER',w:2,h:2,cost:135,desc:'Extends detection range.'}],
utility:[{type:'POWER',name:'FUSION PLANT',w:3,h:3,cost:140,desc:'Powers advanced structures.'},{type:'AIR',name:'AIR PROCESSOR',w:3,h:3,cost:125,desc:'Supports filters and suits.'},{type:'SOLAR',name:'SOLAR ARRAY',w:3,h:2,cost:70,desc:'Auxiliary power.'}],
decor:[{type:'BEACON',name:'SIGNAL BEACON',w:1,h:1,cost:25,desc:'Visual signal object.'},{type:'CRATE',name:'CARGO STACK',w:1,h:1,cost:10,desc:'Staging decoration.'},{type:'MONUMENT',name:'FOUNDER PLINTH',w:2,h:2,cost:0,desc:'Founder launch-series cosmetic.'}]};
function load(){try{const s=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');return s&&s.buildings?Object.assign(defaults(),s):defaults()}catch(e){return defaults()}}
function save(){state.rotation=cam.rot;localStorage.setItem(SAVE_KEY,JSON.stringify(state));hud()}
function resize(){W=innerWidth;H=innerHeight;dpr=Math.min(devicePixelRatio||1,2);c.width=W*dpr;c.height=H*dpr;c.style.width=W+'px';c.style.height=H+'px';ctx.setTransform(dpr,0,0,dpr,0,0)}addEventListener('resize',resize);resize();
function hud(){$('#alloy').textContent=Math.floor(state.alloy);$('#data').textContent=Math.floor(state.data);$('#orangeGoo').textContent=Math.floor(state.orange);$('#purpleGoo').textContent=Math.floor(state.purple);$('#baseLevel').textContent='COMMAND '+state.command}
function toast(t){const el=$('#toast');el.textContent=t;el.style.opacity=1;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.style.opacity=0,1500)}
function rotPoint(x,y,r=cam.rot){const n=GRID;switch(r%4){case 0:return{x,y};case 1:return{x:n-y,y:x};case 2:return{x:n-x,y:n-y};default:return{x:y,y:n-x}}}
function unrotPoint(x,y,r=cam.rot){const n=GRID;switch(r%4){case 0:return{x,y};case 1:return{x:y,y:n-x};case 2:return{x:n-x,y:n-y};default:return{x:n-y,y:x}}}
function project(x,y,z=0){const p=rotPoint(x,y);return{x:cam.x+(p.x-p.y)*(TW/2)*cam.zoom,y:cam.y+(p.x+p.y)*(TH/2)*cam.zoom-z*cam.zoom}}
function unproject(sx,sy){const dx=(sx-cam.x)/cam.zoom,dy=(sy-cam.y)/cam.zoom;return unrotPoint(dy/TH+dx/TW,dy/TH-dx/TW)}
function noise(x,y){const n=Math.sin(x*12.9898+y*78.233)*43758.5453;return n-Math.floor(n)}
function center(b){return project(b.x+b.w/2,b.y+b.h/2,0)}
function drawTerrain(time){const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#151b1d');bg.addColorStop(.58,'#252823');bg.addColorStop(1,'#3b2b20');ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);const cells=[];for(let y=0;y<GRID;y++)for(let x=0;x<GRID;x++){const p=project(x+.5,y+.5);cells.push({x,y,p,sy:p.y})}cells.sort((a,b)=>a.sy-b.sy);for(const t of cells)Art.drawGround(ctx,t.p,t.x<2||t.y<2||t.x>GRID-3||t.y>GRID-3,noise(t.x,t.y),cam.zoom);
  // service roads around command core
  const h=state.buildings.find(b=>b.type==='COMMAND');if(h){const hc=center(h);for(const id of ['power1','med1','arm1','store1','air1']){const b=state.buildings.find(x=>x.id===id);if(b)Art.drawRoad(ctx,hc,center(b),cam.zoom)}}
  // perimeter fence segments
  const a=project(3,3),b=project(20,3),d=project(3,20),e=project(20,20);Art.drawFence(ctx,a,b,cam.zoom);Art.drawFence(ctx,a,d,cam.zoom);Art.drawFence(ctx,b,e,cam.zoom);Art.drawFence(ctx,d,e,cam.zoom);
  // base props
  const props=[[8.4,8.5,'lamp'],[16.3,8.5,'lamp'],[8,16.7,'lamp'],[16.6,16.7,'lamp'],[4.7,13.2,'crate'],[19.3,13.8,'barrel'],[9.2,18.5,'barrel'],[14.7,18.9,'crate']];
  props.forEach((q,i)=>{const p=project(q[0],q[1]);Art.drawProp(ctx,p.x,p.y,q[2],cam.zoom,time+i*.13)});
}
function buildingOrder(){return state.buildings.map(b=>({b,sy:center(b).y})).sort((a,b)=>a.sy-b.sy)}
function drawBuildings(time){for(const o of buildingOrder()){const p=center(o.b);Art.drawBuilding(ctx,o.b,p.x,p.y,cam.zoom,time,selected&&selected.id===o.b.id);if(['POWER','AIR'].includes(o.b.type)){Art.drawSmoke(ctx,p.x+28*cam.zoom,p.y-48*cam.zoom,cam.zoom,time,noise(o.b.x,o.b.y))}if(state.alloy>=upgradeCost(o.b)&&o.b.type!=='MONUMENT'){ctx.save();ctx.globalAlpha=.75+.25*Math.sin(time*4+o.b.x);ctx.fillStyle='#78e99d';ctx.beginPath();ctx.moveTo(p.x,p.y-102*cam.zoom);ctx.lineTo(p.x-7*cam.zoom,p.y-88*cam.zoom);ctx.lineTo(p.x+7*cam.zoom,p.y-88*cam.zoom);ctx.closePath();ctx.fill();ctx.restore()}}
  // moving maintenance drones
  const routes=[[10.5,12,7.3,10.5],[12,11.5,16.4,10.2],[11,13.4,7.4,15.4],[13,13.2,16.5,15.8]];routes.forEach((r,i)=>{const t=(time*.035+i*.24)%1,e=.5-.5*Math.cos(t*Math.PI*2),p=project(r[0]+(r[2]-r[0])*e,r[1]+(r[3]-r[1])*e,5);Art.drawProp(ctx,p.x,p.y,'drone',cam.zoom,time+i)})
}
function drawPlacement(){if(!placement)return;const b=placement.preview,p=[project(b.x,b.y),project(b.x+b.w,b.y),project(b.x+b.w,b.y+b.h),project(b.x,b.y+b.h)],bad=occupied(b.x,b.y,b.w,b.h,moveMode&&selected?selected.id:null);ctx.save();ctx.globalAlpha=.55;ctx.fillStyle=bad?'#cb565a':'#69d995';ctx.strokeStyle=bad?'#ff7b80':'#8affb6';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p[0].x,p[0].y);for(let i=1;i<p.length;i++)ctx.lineTo(p[i].x,p[i].y);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore()}
function draw(time){drawTerrain(time);drawBuildings(time);drawPlacement();const shade=ctx.createLinearGradient(0,H*.64,0,H);shade.addColorStop(0,'#00000000');shade.addColorStop(1,'#4a271b28');ctx.fillStyle=shade;ctx.fillRect(0,H*.64,W,H*.36)}
function occupied(x,y,w,h,ignoreId=null){if(x<2||y<2||x+w>GRID-2||y+h>GRID-2)return true;return state.buildings.some(b=>b.id!==ignoreId&&!(x+w<=b.x||x>=b.x+b.w||y+h<=b.y||y>=b.y+b.h))}
function description(b){return({COMMAND:'The operational heart of STAR BASE. Raises the structure tier ceiling.',POWER:'Produces power for advanced base systems.',MEDBAY:'Recovers injured personnel and improves deployment turnaround.',ARMORY:'Maintains weapons and deployment equipment.',STORAGE:'Secures recovered materials and expands logistics.',AIR:'Processes atmosphere and supports suit/filter endurance.',TURRET:'Automated perimeter defense.',SOLAR:'Reliable auxiliary power.',HAB:'Crew quarters and recovery capacity.',WALL:'Armored perimeter protection.',SENSOR:'Long-range detection and early warning.',BEACON:'Base signal marker.',CRATE:'Cargo staging decoration.',MONUMENT:'Founder launch-series base object. Cosmetic only.'})[b.type]||'STAR BASE structure.'}
function upgradeCost(b){return Math.round((b.type==='COMMAND'?180:80)*Math.pow(1.5,b.level-1))}
function selectBuilding(b){selected=b;placement=null;moveMode=false;$('#buildingCard').classList.remove('hidden');$('#buildingClass').textContent=['TURRET','WALL','SENSOR'].includes(b.type)?'DEFENSE':['BEACON','CRATE','MONUMENT'].includes(b.type)?'DECOR':'BASE';$('#buildingName').textContent=b.name;$('#buildingLevel').textContent='LEVEL '+b.level;$('#buildingEffect').textContent=description(b);const cost=upgradeCost(b);$('#upgradeCost').textContent=cost+' ALLOY';$('#upgradeBuilding').disabled=state.alloy<cost||b.type==='MONUMENT'}
function upgrade(){if(!selected)return;const cost=upgradeCost(selected);if(selected.type==='MONUMENT'){toast('FOUNDER COSMETIC');return}if(state.alloy<cost){toast('NOT ENOUGH ALLOY');return}state.alloy-=cost;selected.level++;if(selected.type==='COMMAND')state.command=selected.level;save();selectBuilding(selected);toast(selected.name+' UPGRADED')}
function renderBuildItems(){const host=$('#buildItems');host.innerHTML='';for(const item of catalog[category]){const b=document.createElement('button');b.className='buildItem';b.innerHTML=`<b>${item.name}</b><span>${item.w}×${item.h} GRID</span><em>${item.cost===0?'LAUNCH SERIES':item.cost+' ALLOY'}</em>`;b.onclick=()=>beginPlacement(item);host.appendChild(b)}}
function beginPlacement(item){if(item.cost>state.alloy&&item.cost>0){toast('NOT ENOUGH ALLOY');return}placement={item,preview:{x:11,y:11,w:item.w,h:item.h}};moveMode=false;$('#buildTray').classList.remove('open');$('#modeBanner').classList.remove('hidden');$('#modeTitle').textContent='PLACE '+item.name;$('#modeHint').textContent='Tap clear ground. Drag to pan.'}
function beginMove(){if(!selected)return;moveMode=true;placement={item:{type:selected.type,name:selected.name,w:selected.w,h:selected.h,cost:0},preview:{x:selected.x,y:selected.y,w:selected.w,h:selected.h}};$('#buildingCard').classList.add('hidden');$('#modeBanner').classList.remove('hidden');$('#modeTitle').textContent='MOVE '+selected.name;$('#modeHint').textContent='Tap a clear tile.'}
function cancelMode(){placement=null;moveMode=false;$('#modeBanner').classList.add('hidden')}
function placeAt(sx,sy){if(!placement)return false;const t=unproject(sx,sy),px=Math.floor(t.x-placement.item.w/2+.5),py=Math.floor(t.y-placement.item.h/2+.5);placement.preview={x:px,y:py,w:placement.item.w,h:placement.item.h};const ignore=moveMode&&selected?selected.id:null;if(occupied(px,py,placement.item.w,placement.item.h,ignore)){toast('SPACE BLOCKED');return true}if(moveMode&&selected){selected.x=px;selected.y=py;save();toast('STRUCTURE MOVED');selectBuilding(selected);cancelMode();return true}const item=placement.item;if(item.cost>0)state.alloy-=item.cost;const b={id:'b'+Date.now(),type:item.type,name:item.name,x:px,y:py,w:item.w,h:item.h,level:1};state.buildings.push(b);save();selectBuilding(b);cancelMode();toast(item.name+' PLACED');return true}
function hitBuilding(sx,sy){let best=null,bestD=1e9;for(const b of state.buildings){const p=center(b),d=Math.hypot((sx-p.x)/(55*cam.zoom),(sy-(p.y-35*cam.zoom))/(45*cam.zoom));if(d<bestD&&d<1.35){best=b;bestD=d}}return best}
function tapCanvas(x,y){if(placement){placeAt(x,y);return}const b=hitBuilding(x,y);if(b)selectBuilding(b);else{$('#buildingCard').classList.add('hidden');selected=null}}
function rotateBase(){cam.rot=(cam.rot+1)%4;save();toast('BASE ROTATED')}
function zoom(d){cam.zoom=clamp(cam.zoom+d,.52,1.45)}
function openPanel(s){$$('.panel').forEach(p=>p.classList.remove('open'));$(s).classList.add('open')}
function closePanels(){$$('.panel').forEach(p=>p.classList.remove('open'))}
function pinchDistance(){const a=[...touches.values()];return a.length<2?0:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)}
c.addEventListener('touchstart',e=>{for(const t of e.changedTouches)touches.set(t.identifier,{x:t.clientX,y:t.clientY});moved=false;if(touches.size===1){const t=[...touches.values()][0];dragStart={x:t.x,y:t.y,cx:cam.x,cy:cam.y}}else if(touches.size===2)lastPinch=pinchDistance();e.preventDefault()},{passive:false});
c.addEventListener('touchmove',e=>{for(const t of e.changedTouches){const q=touches.get(t.identifier);if(q){q.x=t.clientX;q.y=t.clientY}}if(touches.size===1&&dragStart){const t=[...touches.values()][0],dx=t.x-dragStart.x,dy=t.y-dragStart.y;if(Math.hypot(dx,dy)>7)moved=true;cam.x=dragStart.cx+dx;cam.y=dragStart.cy+dy}else if(touches.size===2){moved=true;const d=pinchDistance();if(lastPinch)cam.zoom=clamp(cam.zoom*d/lastPinch,.52,1.45);lastPinch=d}e.preventDefault()},{passive:false});
c.addEventListener('touchend',e=>{let tap=null;for(const t of e.changedTouches){const q=touches.get(t.identifier);if(q&&!moved)tap={x:t.clientX,y:t.clientY};touches.delete(t.identifier)}if(touches.size<2)lastPinch=0;if(touches.size===0){dragStart=null;if(tap)tapCanvas(tap.x,tap.y)}e.preventDefault()},{passive:false});
let md=false,mm=false,ms=null;c.addEventListener('mousedown',e=>{md=true;mm=false;ms={x:e.clientX,y:e.clientY,cx:cam.x,cy:cam.y}});addEventListener('mousemove',e=>{if(!md)return;const dx=e.clientX-ms.x,dy=e.clientY-ms.y;if(Math.hypot(dx,dy)>6)mm=true;cam.x=ms.cx+dx;cam.y=ms.cy+dy});addEventListener('mouseup',e=>{if(md&&!mm)tapCanvas(e.clientX,e.clientY);md=false});c.addEventListener('wheel',e=>{zoom(e.deltaY<0?.08:-.08);e.preventDefault()},{passive:false});
$('#upgradeBuilding').onclick=upgrade;$('#moveBuilding').onclick=beginMove;$('#infoBuilding').onclick=()=>{if(!selected)return;$('#infoTitle').textContent=selected.name;$('#infoText').textContent=description(selected);openPanel('#infoPanel')};$('#closeBuilding').onclick=()=>{$('#buildingCard').classList.add('hidden');selected=null};$('#buildBtn').onclick=()=>{$('#buildTray').classList.toggle('open');renderBuildItems()};$('#trayClose').onclick=()=>$('#buildTray').classList.remove('open');$$('.tab').forEach(t=>t.onclick=()=>{$$('.tab').forEach(x=>x.classList.remove('active'));t.classList.add('active');category=t.dataset.category;renderBuildItems()});$('#rotateBtn').onclick=rotateBase;$('#zoomIn').onclick=()=>zoom(.12);$('#zoomOut').onclick=()=>zoom(-.12);$('#cancelMode').onclick=cancelMode;$('#deployBtn').onclick=()=>openPanel('#deployPanel');$('#settingsBtn').onclick=()=>openPanel('#menuPanel');$('#commanderBtn').onclick=()=>toast('COMMANDER PROFILE • ACCOUNT LINK NEXT');$('#factionBtn').onclick=()=>toast('FACTION SYSTEM • SERVER PHASE');$('#mapBtn').onclick=()=>toast('SERVER 01 • STAR BASE SECTOR');$$('.panelClose').forEach(b=>b.onclick=closePanels);$('#launchMission').onclick=()=>{closePanels();toast('DEPLOYMENT COMBAT LAYER NEXT')};
function loop(t){const time=t/1000,dt=Math.min(.04,(t-last)/1000);last=t;draw(time);requestAnimationFrame(loop)}
hud();renderBuildItems();requestAnimationFrame(loop);
})();