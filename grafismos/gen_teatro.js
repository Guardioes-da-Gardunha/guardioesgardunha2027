const fs=require('fs');
let s=1337;const r=()=>{s=(s*16807)%2147483647;return s/2147483647};
const W=1200,H=900;
const pal=['#23271F','#292E26','#2F342B','#262A25','#2C3128'];
// stone blocks
let blocks='';
for(let y=120,row=0;y<780;row++){const h=30+Math.floor(r()*18);let x=-40+(row%2?30:0);
 while(x<1000){const w=54+Math.floor(r()*70);const c=pal[Math.floor(r()*pal.length)];
  const moss=r()<.07?'#2E3A26':c;
  blocks+=`<rect x="${x}" y="${y}" width="${w-3}" height="${h-3}" rx="5" fill="${moss}"/>`;x+=w;}
 y+=h;}
// contour lines
let cont='';
for(let i=0;i<16;i++){const y=40+i*58,a=18+r()*30;
 cont+=`<path d="M-20 ${y} C 250 ${y-a}, 450 ${y+a}, 700 ${y-a/2} S 1050 ${y+a}, 1220 ${y-a/3}" stroke-opacity="${i%4==0?.22:.10}"/>`;}
// cobbles
let cob='';
for(let i=0;i<110;i++){const x=640+r()*560,y=745+r()*150;cob+=`<ellipse cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" rx="${10+r()*8}" ry="${4+r()*3}" fill="none" stroke="#3D433B" stroke-width="1.5" opacity="${.35+r()*.4}"/>`;}
const win=(x,y,w,h)=>`<g><rect x="${x-6}" y="${y-6}" width="${w+12}" height="${h+12}" rx="3" fill="#33382F"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="#0E100D" stroke="#8FB573" stroke-width="2"/><path d="M${x+w/2} ${y}V${y+h}M${x} ${y+h*.42}H${x+w}" stroke="#8FB573" stroke-width="1.6" opacity=".7"/><rect x="${x+4}" y="${y+4}" width="${w/2-6}" height="${h*.42-8}" fill="#8FB573" opacity=".16"/></g>`;
const door=(x,y,w,h)=>`<g><rect x="${x-8}" y="${y-8}" width="${w+16}" height="${h+8}" rx="3" fill="#33382F"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="#0E100D" stroke="#8FB573" stroke-width="2"/><g stroke="#8FB573" stroke-width="1.4" opacity=".55"><path d="M${x+w*.33} ${y}V${y+h}M${x+w*.66} ${y}V${y+h}"/><path d="M${x} ${y+h*.22}H${x+w}"/></g></g>`;
const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Archivo,'Arial Narrow',Arial,sans-serif">
<defs>
<clipPath id="fc"><polygon points="130,320 730,290 730,700 130,730"/></clipPath>
<clipPath id="sd"><polygon points="730,290 960,380 960,625 730,700"/></clipPath>
<linearGradient id="moss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8FB573" stop-opacity="0"/><stop offset="1" stop-color="#8FB573" stop-opacity=".30"/></linearGradient>
<linearGradient id="sun" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ECEEE6" stop-opacity=".07"/><stop offset="1" stop-color="#ECEEE6" stop-opacity="0"/></linearGradient>
<radialGradient id="glow" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#8FB573" stop-opacity=".16"/><stop offset="1" stop-color="#8FB573" stop-opacity="0"/></radialGradient>
</defs>
<rect width="${W}" height="${H}" fill="#141614"/>
<rect width="${W}" height="${H}" fill="url(#glow)"/>
<g fill="none" stroke="#A3A895" stroke-width="1.2">${cont}</g>
<!-- fundo: casas e torre -->
<g stroke="#8FB573" stroke-opacity=".55" stroke-width="2" fill="#1A1D1A">
 <polygon points="1010,420 1010,610 1190,640 1190,420 1100,376"/>
 <polygon points="1040,300 1052,230 1064,300" fill="#262A25"/>
 <rect x="1036" y="296" width="32" height="90" fill="#262A25"/>
 <rect x="1044" y="316" width="8" height="18" fill="#0E100D"/>
</g>
<!-- solo -->
<polygon points="0,735 1200,735 1200,900 0,900" fill="#1A1D1A"/>
<polygon points="730,700 960,625 1200,640 1200,740 730,740" fill="#1D201D"/>
${cob}
<!-- lado -->
<g clip-path="url(#sd)"><rect x="730" y="280" width="240" height="440" fill="#1C1F1A"/><g opacity=".6" transform="translate(0 0)">${blocks}</g><rect x="730" y="280" width="240" height="440" fill="#141614" opacity=".45"/></g>
<polygon points="730,290 960,380 960,625 730,700" fill="none" stroke="#3D433B" stroke-width="2"/>
<polygon points="730,290 960,380 980,372 742,262" fill="#262A25" stroke="#3D433B" stroke-width="2"/>
<rect x="944" y="450" width="26" height="130" fill="#0E100D" stroke="#8FB573" stroke-width="1.6" opacity=".8" transform="skewY(8) translate(0 -135)"/>
<!-- frente -->
<g clip-path="url(#fc)"><rect x="120" y="280" width="620" height="460" fill="#23271F"/>${blocks}<rect x="120" y="280" width="620" height="460" fill="url(#sun)"/><rect x="120" y="560" width="620" height="180" fill="url(#moss)"/></g>
<polygon points="130,320 730,290 730,700 130,730" fill="none" stroke="#3D433B" stroke-width="2.5"/>
<!-- platibanda -->
<path d="M122,326 L122,262 Q250,212 335,196 C430,176 520,206 610,170 L742,134 L742,296 Z" fill="#ECEEE6"/>
<path d="M122,326 L122,262 Q250,212 335,196 C430,176 520,206 610,170 L742,134" fill="none" stroke="#8FB573" stroke-width="3"/>
<text x="330" y="262" font-size="66" font-weight="900" fill="#141614" letter-spacing="10" textLength="260" lengthAdjust="spacingAndGlyphs" style="font-stretch:62%">TEATRO</text>
<!-- janelas e portas -->
${win(210,378,58,118)}${win(372,372,58,118)}${win(540,366,58,118)}
${door(205,520,72,190)}${door(350,516,72,190)}${door(505,512,72,190)}
<rect x="440" y="588" width="26" height="34" rx="2" fill="#ECEEE6" opacity=".85"/>
<g stroke="#141614" stroke-width="1.2" opacity=".6"><path d="M446 596H460M446 603H460M446 610H460"/></g>
<!-- cabo -->
<path d="M130 548 L720 528 C 722 528 724 420 726 296" fill="none" stroke="#0E100D" stroke-width="3"/>
<!-- rota pontilhada -->
<path d="M-10,830 C 260,812 520,812 760,770 S 1010,690 1210,660" fill="none" stroke="#8FB573" stroke-width="5" stroke-linecap="round" stroke-dasharray="1 11"/>
<circle cx="60" cy="826" r="9" fill="#141614" stroke="#8FB573" stroke-width="3"/>
<!-- etiqueta -->
<g font-family="'JetBrains Mono',ui-monospace,monospace" font-size="20" letter-spacing="4" fill="#B0B6A8"><text x="60" y="96">ALPEDRINHA</text></g>
<rect x="60" y="112" width="56" height="4" fill="#8FB573"/>
</svg>`;
fs.writeFileSync('alpedrinha-teatro.svg',svg);
