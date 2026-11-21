const fs=require('fs');
let sd=23;const r=()=>{sd=(sd*16807)%2147483647;return sd/2147483647};
const f=n=>n.toFixed(1);
const tones=['#3A4037','#363C33','#3F463B','#333930','#41483D','#383E35'];
function blocks(x0,x1,y0,y1,rowH,wMin,wMax,tn){let o='',y=y0;
 while(y<y1){const h=Math.min(y1-y,rowH*(.85+r()*.35));let x=x0-r()*50;
  while(x<x1){const w=wMin+r()*(wMax-wMin);const a=Math.max(x,x0),b=Math.min(x+w,x1);
   if(b-a>6)o+=`<rect x="${f(a)}" y="${f(y)}" width="${f(b-a-3)}" height="${f(h-3)}" rx="3" fill="${tn[Math.floor(r()*tn.length)]}"/><path d="M${f(a+3)},${f(y+1)}H${f(b-6)}" stroke="#ECEEE6" stroke-opacity="${(.05+r()*.07).toFixed(2)}"/>`;
   x+=w;}y+=h;}return o;}
let cont='';for(let i=0;i<20;i++){const yy=170+i*42,a=20+(i*7%24);cont+=`<path d="M-20 ${yy} C 250 ${yy-a}, 450 ${yy+a}, 700 ${yy-a/2} S 1050 ${yy+a}, 1220 ${yy-a/3}" stroke-opacity="${i%4==0?.24:.11}"/>`}
let gravel='';for(let i=0;i<150;i++){const x=40+r()*1060,y=935+r()*55;gravel+=`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(5+r()*8)}" ry="${f(2+r()*2.5)}" fill="none" stroke="#3D433B" stroke-width="1" opacity="${(.3+r()*.4).toFixed(2)}"/>`}
let treads='';for(let i=0;i<10;i++){const t=i/9;const x=lerp(520,718,t),y=lerp(560,436,t);treads+=`<path d="M${f(x)},${f(y)}l9,-5.5" stroke="#141614" stroke-width="2"/>`}
function lerp(a,b,t){return a+(b-a)*t}
let slats='';for(let i=0;i<6;i++){const x=486+i*28;slats+=`<path d="M${x},272V345" stroke="#ECEEE6" stroke-width="3.5"/>`}
let rail='';for(let i=0;i<9;i++){const x=490+i*26;rail+=`<path d="M${x},338V318" stroke="#8FB573" stroke-width="1.6" opacity=".8"/>`}
const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="40 160 1067 800" width="1200" height="900">
<defs>
<filter id="rough" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".03" numOctaves="3" seed="6" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G"/></filter>
<clipPath id="ct"><rect x="398" y="330" width="346" height="580"/></clipPath>
<linearGradient id="moss" x1="0" y1="0" x2="0" y2="1"><stop offset=".6" stop-color="#8FB573" stop-opacity="0"/><stop offset="1" stop-color="#8FB573" stop-opacity=".28"/></linearGradient>
<linearGradient id="lit" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ECEEE6" stop-opacity=".10"/><stop offset="1" stop-color="#ECEEE6" stop-opacity="0"/></linearGradient>
<radialGradient id="glow" cx=".5" cy=".5" r=".7"><stop offset="0" stop-color="#8FB573" stop-opacity=".12"/><stop offset="1" stop-color="#8FB573" stop-opacity="0"/></radialGradient>
</defs>
<rect x="0" y="0" width="1200" height="1000" fill="#141614"/><rect x="0" y="0" width="1200" height="1000" fill="url(#glow)"/>
<g fill="none" stroke="#A3A895" stroke-width="1.1">${cont}</g>
<!-- chão -->
<rect x="0" y="925" width="1200" height="80" fill="#171A16"/>${gravel}
<!-- afloramento rochoso -->
<g filter="url(#rough)"><polygon points="744,812 808,806 862,830 930,868 938,900 744,912" fill="#2B3029" stroke="#3D433B" stroke-width="1.6"/><polygon points="770,860 830,846 900,876 930,896 770,900" fill="#232721"/></g>
<path d="M880,872c6,-10 12,-10 14,0M900,880c4,-10 10,-10 14,0" stroke="#8FB573" stroke-opacity=".6" fill="none" stroke-width="2"/>
<!-- marco branco -->
<rect x="742" y="695" width="46" height="118" fill="#D5D9CE"/><rect x="752" y="650" width="22" height="48" rx="6" fill="#ECEEE6"/><rect x="752" y="672" width="22" height="10" fill="#141614"/>
<g fill="#141614" opacity=".55"><rect x="764" y="728" width="12" height="6"/><rect x="764" y="748" width="12" height="6"/><rect x="764" y="768" width="12" height="6"/><rect x="764" y="788" width="12" height="6"/></g>
<!-- anexo branco -->
<polygon points="300,684 397,684 397,722 300,722" fill="#C9CFC0"/><polygon points="300,684 397,684 397,690 300,690" fill="#ECEEE6"/>
<polygon points="276,758 398,708 398,722 276,770" fill="#ECEEE6"/>
<rect x="290" y="766" width="108" height="118" fill="#D5D9CE"/><rect x="340" y="758" width="28" height="94" rx="2" fill="#4E6B3C" stroke="#141614" stroke-width="1.4"/><path d="M354,758V852M340,805H368" stroke="#141614" stroke-width="1.2" opacity=".6"/>
<!-- pedra à esquerda -->
<rect x="155" y="888" width="150" height="46" rx="6" fill="#2B3029" stroke="#3D433B" stroke-width="1.6"/>
<!-- torre -->
<g clip-path="url(#ct)"><rect x="398" y="330" width="346" height="580" fill="#363C33"/><g filter="url(#rough)">${blocks(398,744,330,910,50,90,150,tones)}</g><rect x="398" y="330" width="346" height="580" fill="url(#lit)"/><rect x="398" y="330" width="346" height="580" fill="url(#moss)"/>
<polygon points="545,545 705,440 744,440 744,720 650,720 600,640" fill="#0D0F0C" opacity=".22"/></g>
<rect x="398" y="330" width="346" height="580" fill="none" stroke="#2A2E27" stroke-width="2"/>
<!-- aberturas -->
<rect x="500" y="420" width="46" height="132" fill="#0D0F0C" stroke="#8FB573" stroke-width="1.6" opacity=".95"/>
<rect x="521" y="470" width="23" height="80" fill="#ECEEE6"/><rect x="521" y="486" width="23" height="38" fill="#E3B062"/>
<rect x="418" y="458" width="32" height="48" fill="#0D0F0C" stroke="#8FB573" stroke-width="1.5"/>
<rect x="428" y="752" width="26" height="156" fill="#0D0F0C" stroke="#8FB573" stroke-width="1.6"/>
<rect x="388" y="738" width="76" height="12" fill="#5A6158"/>
<!-- escada e corrimão -->
<path d="M498,566L724,430" stroke="#ECEEE6" stroke-width="12" stroke-linecap="butt"/>${treads}
<path d="M548,520L706,418M548,498L706,396" stroke="#8FB573" stroke-width="2" opacity=".85"/>
<rect x="494" y="556" width="96" height="10" fill="#B9BFB0"/>
<!-- varanda -->
<rect x="477" y="345" width="246" height="62" fill="#ECEEE6"/><rect x="477" y="396" width="246" height="11" fill="#B9BFB0"/>
<path d="M483,338H718" stroke="#8FB573" stroke-width="2.4"/>${rail}
<!-- cabine de vigia -->
<rect x="478" y="268" width="172" height="77" fill="#0D0F0C" stroke="#ECEEE6" stroke-width="3"/>
<rect x="484" y="276" width="160" height="30" fill="#8FB573" opacity=".14"/>${slats}<path d="M478,296H650" stroke="#ECEEE6" stroke-width="3"/><path d="M650,268L664,330" stroke="#ECEEE6" stroke-width="3"/>
<polygon points="408,266 470,216 536,186 640,192 724,246 722,258 468,266 418,284 406,276" fill="#ECEEE6"/>
<polygon points="418,284 468,266 722,258 722,268 470,278 420,296" fill="#B9BFB0"/>
<path d="M408,266L470,216L536,186L640,192L724,246" fill="none" stroke="#8FB573" stroke-width="2.6"/>
<!-- rota -->
<path d="M40,948 C 330,944 620,958 900,946 S 1050,930 1110,918" fill="none" stroke="#8FB573" stroke-width="4.5" stroke-linecap="round" stroke-dasharray="1 10"/>
<circle cx="90" cy="947" r="8" fill="#141614" stroke="#8FB573" stroke-width="2.6"/>
</svg>`;
fs.writeFileSync('posto-de-vigia.svg',svg);
