const fs=require('fs');
let sd=7;const r=()=>{sd=(sd*16807)%2147483647;return sd/2147483647};
const f=n=>n.toFixed(1);
const lerp=(a,b,t)=>a+(b-a)*t;
const bil=(q,u,v)=>{const top=[lerp(q[0][0],q[1][0],u),lerp(q[0][1],q[1][1],u)],bot=[lerp(q[3][0],q[2][0],u),lerp(q[3][1],q[2][1],u)];return[lerp(top[0],bot[0],v),lerp(top[1],bot[1],v)]};
const P=a=>a.map(p=>f(p[0])+','+f(p[1])).join(' ');
function masonry(q,tones,rowH,wMin,wMax,seed){
  let out='',v=0;
  const qh=Math.hypot(q[3][0]-q[0][0],q[3][1]-q[0][1]);
  while(v<1){const dv=(rowH*(0.75+r()*.6))/qh;const v2=Math.min(1,v+dv);
    let u=-r()*.05;const qw=Math.hypot(q[1][0]-q[0][0],q[1][1]-q[0][1]);
    while(u<1){const du=(wMin+r()*(wMax-wMin))/qw;const u2=u+du;
      const a=Math.max(0,u),b=Math.min(1,u2);
      if(b>a){const c=[bil(q,a,v),bil(q,b,v),bil(q,b,v2),bil(q,a,v2)];
        const t=tones[Math.floor(r()*tones.length)];
        out+=`<polygon points="${P(c)}" fill="${t}" stroke="#141614" stroke-width="1.6" stroke-linejoin="round"/>`;
        // luz na aresta superior
        out+=`<path d="M${f(c[0][0])},${f(c[0][1])}L${f(c[1][0])},${f(c[1][1])}" stroke="#ECEEE6" stroke-opacity="${(.04+r()*.07).toFixed(2)}" stroke-width="1"/>`;}
      u=u2;}
    v=v2;}
  return out;}
const FQ=[[95,300],[905,135],[915,782],[62,738]];
const SQ=[[915,138],[1150,408],[1150,572],[915,782]];
const tonesF=['#272B25','#2B3029','#2F342B','#252923','#30362C','#2A2E27'];
const tonesS=['#1E211D','#222620','#1B1E1A','#20241F'];
// janelas / portas como quadriláteros
const quad=(q,fill,stroke,sw=1.6,extra='')=>`<polygon points="${P(q)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" ${extra}/>`;
function opening(q,frameW,bars){
  const inner=q.map((p,i)=>{const c=[(q[0][0]+q[1][0]+q[2][0]+q[3][0])/4,(q[0][1]+q[1][1]+q[2][1]+q[3][1])/4];return[p[0]+(c[0]-p[0])*frameW,p[1]+(c[1]-p[1])*frameW]});
  const grow=q.map(p=>{const c=[(q[0][0]+q[1][0]+q[2][0]+q[3][0])/4,(q[0][1]+q[1][1]+q[2][1]+q[3][1])/4];return[p[0]+(p[0]-c[0])*.13,p[1]+(p[1]-c[1])*.07]});
  let s=quad(grow,'#3A4034','#141614',1.4);
  s+=quad(q,'#0D0F0C','#8FB573',1.6);
  // reflexo
  s+=`<polygon points="${P([bil(q,.12,.08),bil(q,.5,.06),bil(q,.5,.4),bil(q,.12,.44)])}" fill="#8FB573" opacity=".10"/>`;
  bars(q,(u,v)=>bil(q,u,v)).forEach(l=>s+=`<path d="M${f(l[0][0])},${f(l[0][1])}L${f(l[1][0])},${f(l[1][1])}" stroke="#8FB573" stroke-width="1.3" opacity=".65"/>`);
  return s;}
const winBars=(q,m)=>[[m(.5,0),m(.5,1)],[m(0,.42),m(1,.42)]];
const doorBars=(q,m)=>[[m(.33,0),m(.33,1)],[m(.66,0),m(.66,1)],[m(0,.2),m(1,.2)]];
const W=[[[222,302],[252,298],[248,420],[208,425]],[[352,268],[404,264],[402,402],[350,406]],[[541,232],[604,226],[603,380],[540,388]]];
const D=[[[196,528],[244,527],[241,742],[188,742]],[[324,527],[408,525],[409,756],[318,752]],[[524,521],[611,518],[612,772],[522,766]]];
// contours
let cont='';for(let i=0;i<18;i++){const y=20+i*50,a=20+(i*7%24);cont+=`<path d="M-20 ${y} C 250 ${y-a}, 450 ${y+a}, 700 ${y-a/2} S 1050 ${y+a}, 1220 ${y-a/3}" stroke-opacity="${i%4==0?.24:.11}"/>`}
// paralelepípedos da calçada em perspetiva
let cob='';
for(let row=0;row<9;row++){const t=row/8;const y0=lerp(790,590,t*0+0);}
const street=[[915,782],[1150,572],[1280,548],[1280,832],[880,832]];
for(let i=0;i<260;i++){const u=r(),v=r();const x=lerp(900,1280,u*0.9+0.05),y0=lerp(600,830,v);
  // só dentro do polígono da rua: acima da linha base da parede
  const base=lerp(782,572,Math.min(1,Math.max(0,(x-915)/235)));if(y0<base+8)continue;
  const sc=.6+v*.9;cob+=`<ellipse cx="${f(x)}" cy="${f(y0)}" rx="${f(11*sc)}" ry="${f(4.6*sc)}" fill="#1D201D" stroke="#3D433B" stroke-width="1.1" opacity="${(.5+r()*.4).toFixed(2)}" transform="rotate(${f(-8+r()*10)} ${f(x)} ${f(y0)})"/>`}
// estrada esquerda (asfalto) com linha
const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="55 0 1109 832" width="1200" height="900">
<defs>
<filter id="rough" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="3" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="9" xChannelSelector="R" yChannelSelector="G"/></filter>
<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="2" result="t"/><feColorMatrix in="t" type="matrix" values="0 0 0 0 .93  0 0 0 0 .94  0 0 0 0 .9  0 0 0 .5 -.18"/></filter>
<clipPath id="cF"><polygon points="${P(FQ)}"/></clipPath>
<clipPath id="cS"><polygon points="${P(SQ)}"/></clipPath>
<clipPath id="cR"><polygon points="${P(street)}"/></clipPath>
<linearGradient id="moss" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stop-color="#8FB573" stop-opacity="0"/><stop offset="1" stop-color="#8FB573" stop-opacity=".34"/></linearGradient>
<linearGradient id="lit" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ECEEE6" stop-opacity=".10"/><stop offset=".7" stop-color="#ECEEE6" stop-opacity="0"/></linearGradient>
<linearGradient id="par" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F3F5EE"/><stop offset="1" stop-color="#C9CFC0"/></linearGradient>
<radialGradient id="glow" cx=".42" cy=".45" r=".75"><stop offset="0" stop-color="#8FB573" stop-opacity=".13"/><stop offset="1" stop-color="#8FB573" stop-opacity="0"/></radialGradient>
</defs>
<rect x="0" y="0" width="1300" height="832" fill="#141614"/><rect x="0" y="0" width="1300" height="832" fill="url(#glow)"/>
<g fill="none" stroke="#A3A895" stroke-width="1.1" transform="translate(0 0) scale(1 .93)">${cont}</g>
<!-- fundo: casa e torre -->
<g fill="#181B17" stroke="#8FB573" stroke-opacity=".5" stroke-width="1.3" stroke-linejoin="round">
 <polygon points="1112,306 1130,262 1148,306"/><rect x="1104" y="304" width="52" height="38"/>
 <polygon points="1118,350 1175,322 1240,342 1240,495 1118,495"/>
 <path d="M1190,398h30v22h-30z M1135,372h20v26h-20z" fill="#0D0F0C" stroke-opacity=".35"/>
</g>
<!-- edifício à esquerda -->
<g stroke="#8FB573" stroke-opacity=".38" stroke-width="1.2" fill="#181B17"><polygon points="0,326 84,312 84,735 0,735"/><path d="M0,400h62v108H0z" fill="#0D0F0C"/><path d="M0,430h62M0,462h62" fill="none"/></g>
<!-- rua -->
<rect x="0" y="735" width="1300" height="100" fill="#171A16"/>
<polygon points="${P(street)}" fill="#1C1F1B"/>
<g clip-path="url(#cR)">${cob}</g>
<path d="M62,738 L915,782" stroke="#3D433B" stroke-width="1.4"/>
<path d="M95,792 L330,800 M420,805 L610,812" stroke="#ECEEE6" stroke-opacity=".28" stroke-width="3" stroke-linecap="round"/>
<!-- lateral -->
<g clip-path="url(#cS)"><rect x="900" y="120" width="270" height="680" fill="#1A1D19"/><g filter="url(#rough)">${masonry(SQ,tonesS,28,26,96)}</g><rect x="900" y="120" width="270" height="680" fill="#141614" opacity=".28"/></g>
<polygon points="${P(SQ)}" fill="none" stroke="#3D433B" stroke-width="1.6"/>
<polygon points="915,126 1126,386 1156,412 1150,408 915,138" fill="#262A25" stroke="#3D433B" stroke-width="1.4"/>
<path d="M915,126L1128,386" stroke="#8FB573" stroke-opacity=".5" stroke-width="1.4"/>
${opening([[980,438],[1003,447],[1003,664],[980,668]],.0,()=>[])}
<polygon points="1082,388 1092,392 1092,424 1082,420" fill="#0D0F0C" stroke="#8FB573" stroke-width="1.2"/>
<!-- fachada -->
<g clip-path="url(#cF)"><rect x="55" y="120" width="880" height="680" fill="#23271F"/><g filter="url(#rough)">${masonry(FQ,tonesF,30,28,120)}</g><rect x="55" y="120" width="880" height="680" filter="url(#grain)" opacity=".18"/><rect x="55" y="120" width="880" height="680" fill="url(#lit)"/><rect x="55" y="120" width="880" height="680" fill="url(#moss)"/></g>
<polygon points="${P(FQ)}" fill="none" stroke="#3D433B" stroke-width="1.8"/>
<!-- pilastra esquerda -->
<polygon points="62,285 95,300 62,738 54,738" fill="#0D0F0C" opacity=".85"/>
<!-- aberturas -->
${W.map(q=>opening(q,.0,winBars)).join('')}
${D.map(q=>opening(q,.0,doorBars)).join('')}
<rect x="425" y="572" width="25" height="43" rx="1.5" fill="#ECEEE6" opacity=".88"/><path d="M431,584H444M431,592H444M431,600H444" stroke="#141614" stroke-width="1.2" opacity=".6"/>
<!-- cabo -->
<path d="M95,512 C 400,508 700,498 860,486 C 905,480 908,440 906,420 L 884,205 L 916,126" fill="none" stroke="#0D0F0C" stroke-width="2.6" stroke-linecap="round"/>
<!-- platibanda -->
<path d="M95,306 L95,282 Q 205,238 325,160 C 420,128 520,146 612,126 L 916,64 L 905,140 Z" fill="url(#par)"/>
<path d="M95,282 Q 205,238 325,160 C 420,128 520,146 612,126 L 916,64" fill="none" stroke="#8FB573" stroke-width="2.4"/>
<path d="M99,306 L905,140" stroke="#141614" stroke-opacity=".35" stroke-width="2"/>
<g transform="translate(333 224) rotate(-4)" fill="none" stroke="#141614" stroke-width="3" stroke-linecap="square" stroke-linejoin="round">
 <g><path d="M0,-40H26M13,-40V0"/></g>
 <g transform="translate(36 0)"><path d="M24,-40H0V0H24M0,-20H18"/></g>
 <g transform="translate(72 0)"><path d="M0,0L13,-40L26,0M5,-14H21"/></g>
 <g transform="translate(108 0)"><path d="M0,-40H26M13,-40V0"/></g>
 <g transform="translate(144 0)"><path d="M0,0V-40H16Q26,-40 26,-30Q26,-20 16,-20H0M14,-20L26,0"/></g>
 <g transform="translate(180 0)"><path d="M13,-40Q26,-40 26,-28V-12Q26,0 13,0Q0,0 0,-12V-28Q0,-40 13,-40Z"/></g>
</g>
<!-- rota pontilhada -->
<path d="M40,812 C 330,806 600,818 880,800 S 1080,690 1180,640" fill="none" stroke="#8FB573" stroke-width="4.5" stroke-linecap="round" stroke-dasharray="1 10"/>
<circle cx="86" cy="810" r="8" fill="#141614" stroke="#8FB573" stroke-width="2.6"/>
</svg>`;
fs.writeFileSync('alpedrinha-teatro.svg',svg);
