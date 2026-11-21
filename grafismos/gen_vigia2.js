const fs=require('fs');
let sd=5;const r=()=>{sd=(sd*16807)%2147483647;return sd/2147483647};
const f=n=>n.toFixed(1), HY=560, VL=-500, VR=1700;
const yL=(cx,yc,x)=>yc+(HY-yc)*(Math.abs(x-cx)/Math.abs((x<cx?VL:VR)-cx));
function box(cx,yt,yb,wl,wr,cL,cR,o={}){
  const a=[cx,yt],b=[cx,yb],lt=[cx-wl,yL(cx,yt,cx-wl)],lb=[cx-wl,yL(cx,yb,cx-wl)],rt=[cx+wr,yL(cx,yt,cx+wr)],rb=[cx+wr,yL(cx,yb,cx+wr)];
  const P=q=>q.map(p=>f(p[0])+','+f(p[1])).join(' ');
  const st=o.stroke?` stroke="${o.stroke}" stroke-width="${o.sw||1.4}" stroke-linejoin="round"`:'';
  return {svg:`<polygon points="${P([a,lt,lb,b])}" fill="${cL}"${st}/><polygon points="${P([a,rt,rb,b])}" fill="${cR}"${st}/>`,pt:{a,b,lt,lb,rt,rb}};
}
let cont='';for(let i=0;i<20;i++){const yy=20+i*46,a=20+(i*7%24);cont+=`<path d="M-20 ${yy} C 250 ${yy-a}, 450 ${yy+a}, 700 ${yy-a/2} S 1050 ${yy+a}, 1220 ${yy-a/3}" stroke-opacity="${i%4==0?.22:.10}"/>`}
let grav='';for(let i=0;i<190;i++){const v=r(),y=735+v*150,x=r()*1200,sc=.5+v*1.1;grav+=`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(10*sc)}" ry="${f(3.6*sc)}" fill="none" stroke="#3D433B" stroke-width="1" opacity="${(.25+r()*.4).toFixed(2)}"/>`}
const annex=box(470,656,716,100,44,'#D5D9CE','#9AA091');
const tower=box(600,330,704,132,96,'#4B5345','#2A2F28',{stroke:'#232721'});
const slab=box(612,324,346,142,104,'#ECEEE6','#B9BFB0');
const glass=box(606,262,324,98,72,'#101310','#0A0C09',{stroke:'#ECEEE6',sw:2.2});
const roof=box(606,236,262,156,118,'#ECEEE6','#B9BFB0');
const t=tower.pt;
// escada na face esquerda/frente
const sx0=600-112,sx1=600-14;
const sy=(x,yy)=>yy;
const stair=`<path d="M498,586 L592,368" stroke="#ECEEE6" stroke-width="8"/><path d="M498,556 L592,338" stroke="#8FB573" stroke-width="2" opacity=".9"/><path d="M498,556V586M548,440V470" stroke="#8FB573" stroke-width="1.6" opacity=".7"/>`;
const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" width="1200" height="900">
<defs>
<linearGradient id="sh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ECEEE6" stop-opacity=".06"/><stop offset="1" stop-color="#8FB573" stop-opacity=".22"/></linearGradient>
<radialGradient id="glow" cx=".5" cy=".5" r=".7"><stop offset="0" stop-color="#8FB573" stop-opacity=".13"/><stop offset="1" stop-color="#8FB573" stop-opacity="0"/></radialGradient>
</defs>
<rect width="1200" height="900" fill="#141614"/><rect width="1200" height="900" fill="url(#glow)"/>
<g fill="none" stroke="#A3A895" stroke-width="1.1">${cont}</g>
<!-- serras ao longe -->
<g fill="none" stroke="#8FB573" stroke-opacity=".35" stroke-width="1.3"><path d="M0,690 C 90,660 160,650 240,672 S 380,700 470,706"/><path d="M0,720 C 120,690 200,690 300,712"/><path d="M790,706 C 880,690 980,680 1070,698 S 1160,690 1200,684"/></g>
<!-- chão -->
<path d="M0,712 C 200,706 420,708 600,710 S 1000,708 1200,704 V900 H0Z" fill="#1A1D19"/>
<g>${grav}</g>
<!-- rochedo -->
<polygon points="760,712 806,694 858,706 930,728 960,752 900,760 770,748" fill="#2B3029" stroke="#3D433B" stroke-width="1.4"/>
<polygon points="806,694 858,706 930,728 900,730 840,716" fill="#3A4036"/>
<polygon points="110,728 190,716 262,724 280,746 120,752" fill="#2B3029" stroke="#3D433B" stroke-width="1.4"/>
<!-- marco branco -->
<rect x="728" y="634" width="34" height="76" fill="#D5D9CE"/><rect x="728" y="634" width="12" height="76" fill="#ECEEE6"/><rect x="733" y="620" width="22" height="16" rx="6" fill="#ECEEE6"/><rect x="733" y="626" width="22" height="5" fill="#141614"/>
<!-- anexo -->
${annex.svg}<polygon points="${annex.pt.a} ${annex.pt.lt} ${annex.pt.lt[0]-6},${annex.pt.lt[1]-4} ${annex.pt.a[0]},${annex.pt.a[1]-10}" fill="#ECEEE6"/>
<rect x="436" y="672" width="18" height="32" fill="#4E6B3C"/>
<!-- torre -->
${tower.svg}
<rect x="${f(600-132)}" y="330" width="1" height="1" fill="none"/>
<polygon points="${f(t.a[0])},${f(t.a[1])} ${f(t.rt[0])},${f(t.rt[1])} ${f(t.rb[0])},${f(t.rb[1])} ${f(t.b[0])},${f(t.b[1])}" fill="#0D0F0C" opacity=".15"/>
<polygon points="${f(t.lt[0])},${f(t.lt[1])} ${f(t.a[0])},${f(t.a[1])} ${f(t.b[0])},${f(t.b[1])} ${f(t.lb[0])},${f(t.lb[1])}" fill="url(#sh)"/>
${stair}
<!-- varanda, cabine, telhado -->
${glass.svg}${slab.svg}${roof.svg}
<path d="M${f(roof.pt.lt[0])},${f(roof.pt.lt[1])} L${f(roof.pt.a[0])},${f(roof.pt.a[1])} L${f(roof.pt.rt[0])},${f(roof.pt.rt[1])}" fill="none" stroke="#8FB573" stroke-width="2.4" stroke-linejoin="round"/>
<!-- rota -->
<path d="M40,860 C 280,850 420,790 580,730 S 900,780 1180,742" fill="none" stroke="#8FB573" stroke-width="4.5" stroke-linecap="round" stroke-dasharray="1 10"/>
<circle cx="70" cy="859" r="8" fill="#141614" stroke="#8FB573" stroke-width="2.6"/>
</svg>`;
fs.writeFileSync('posto-de-vigia.svg',svg);
