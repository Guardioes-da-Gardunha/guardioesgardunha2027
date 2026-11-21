const fs=require('fs');
let sd=11;const r=()=>{sd=(sd*16807)%2147483647;return sd/2147483647};
const f=n=>n.toFixed(1);
const X0=150,X1=1010,WALL_T=330,WALL_B=760; // fachada frontal, sem perspetiva
const tones=['#272B25','#2B3029','#2F342B','#252923','#30362C','#2A2E27'];
let st='',y=WALL_T;
while(y<WALL_B){const h=Math.min(WALL_B-y,30+r()*20);let x=X0-r()*40;
  while(x<X1){const w=40+r()*90;const a=Math.max(x,X0),b=Math.min(x+w,X1);
    if(b-a>6)st+=`<rect x="${f(a)}" y="${f(y)}" width="${f(b-a-2.5)}" height="${f(h-2.5)}" rx="3" fill="${tones[Math.floor(r()*6)]}"/><path d="M${f(a+3)},${f(y+1)}H${f(b-6)}" stroke="#ECEEE6" stroke-opacity="${(.04+r()*.06).toFixed(2)}"/>`;
    x+=w;}y+=h;}
let cont='';for(let i=0;i<18;i++){const yy=20+i*52,a=20+(i*7%24);cont+=`<path d="M-20 ${yy} C 250 ${yy-a}, 450 ${yy+a}, 700 ${yy-a/2} S 1050 ${yy+a}, 1220 ${yy-a/3}" stroke-opacity="${i%4==0?.24:.11}"/>`}
const win=(x,y,w,h)=>`<rect x="${x-7}" y="${y-7}" width="${w+14}" height="${h+14}" rx="3" fill="#3A4034"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="#0D0F0C" stroke="#8FB573" stroke-width="2"/><path d="M${x+w/2},${y}V${y+h}M${x},${y+h*.42}H${x+w}" stroke="#8FB573" stroke-width="1.6" opacity=".7"/><rect x="${x+5}" y="${y+5}" width="${w/2-8}" height="${h*.42-10}" fill="#8FB573" opacity=".12"/>`;
const door=(x,y,w,h)=>`<rect x="${x-9}" y="${y-9}" width="${w+18}" height="${h+9}" rx="3" fill="#3A4034"/><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="#0D0F0C" stroke="#8FB573" stroke-width="2"/><path d="M${x+w/3},${y}V${y+h}M${x+2*w/3},${y}V${y+h}M${x},${y+h*.2}H${x+w}" stroke="#8FB573" stroke-width="1.5" opacity=".6"/>`;
// platibanda: onda suave como na foto (baixa à esquerda, bossa ao primeiro terço, depois sobe devagar)
const pb=`M${X0-8},${WALL_T+6} L${X0-8},${WALL_T-26} C ${X0+110},${WALL_T-40} ${X0+190},${WALL_T-105} ${X0+300},${WALL_T-112} C ${X0+420},${WALL_T-118} ${X0+520},${WALL_T-84} ${X0+640},${WALL_T-88} C ${X0+740},${WALL_T-92} ${X0+800},${WALL_T-100} ${X1+8},${WALL_T-104} L${X1+8},${WALL_T+6} Z`;
const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" width="1200" height="900">
<defs>
<filter id="rough" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".03" numOctaves="3" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G"/></filter>
<clipPath id="cw"><rect x="${X0}" y="${WALL_T}" width="${X1-X0}" height="${WALL_B-WALL_T}"/></clipPath>
<linearGradient id="moss" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stop-color="#8FB573" stop-opacity="0"/><stop offset="1" stop-color="#8FB573" stop-opacity=".30"/></linearGradient>
<radialGradient id="glow" cx=".5" cy=".42" r=".75"><stop offset="0" stop-color="#8FB573" stop-opacity=".12"/><stop offset="1" stop-color="#8FB573" stop-opacity="0"/></radialGradient>
</defs>
<rect width="1200" height="900" fill="#141614"/><rect width="1200" height="900" fill="url(#glow)"/>
<g fill="none" stroke="#A3A895" stroke-width="1.1">${cont}</g>
<g fill="#181B17" stroke="#8FB573" stroke-opacity=".45" stroke-width="1.3" stroke-linejoin="round"><polygon points="1066,262 1086,200 1106,262"/><rect x="1056" y="260" width="60" height="70"/><rect x="1080" y="278" width="12" height="22" fill="#0D0F0C"/></g>
<rect y="${WALL_B}" width="1200" height="140" fill="#171A16"/>
<g clip-path="url(#cw)"><rect x="${X0}" y="${WALL_T}" width="${X1-X0}" height="${WALL_B-WALL_T}" fill="#23271F"/><g filter="url(#rough)">${st}</g><rect x="${X0}" y="${WALL_T}" width="${X1-X0}" height="${WALL_B-WALL_T}" fill="url(#moss)"/></g>
<rect x="${X0}" y="${WALL_T}" width="${X1-X0}" height="${WALL_B-WALL_T}" fill="none" stroke="#3D433B" stroke-width="1.8"/>
${win(240,362,54,125)}${win(430,362,54,125)}${win(640,362,54,125)}
${door(224,566,84,194)}${door(424,566,84,194)}${door(634,566,84,194)}
<rect x="535" y="590" width="26" height="44" rx="1.5" fill="#ECEEE6" opacity=".88"/><path d="M541,602H555M541,611H555M541,620H555" stroke="#141614" stroke-width="1.2" opacity=".6"/>
<path d="${pb}" fill="#ECEEE6"/><path d="M${X0-8},${WALL_T-26} C ${X0+110},${WALL_T-40} ${X0+190},${WALL_T-105} ${X0+300},${WALL_T-112} C ${X0+420},${WALL_T-118} ${X0+520},${WALL_T-84} ${X0+640},${WALL_T-88} C ${X0+740},${WALL_T-92} ${X0+800},${WALL_T-100} ${X1+8},${WALL_T-104}" fill="none" stroke="#8FB573" stroke-width="3"/>
<rect x="${X0-8}" y="${WALL_T-2}" width="${X1-X0+16}" height="8" fill="#B9BFB0"/>
<g transform="translate(${X0+300} ${WALL_T-26})" fill="none" stroke="#141614" stroke-width="3.2" stroke-linecap="square" stroke-linejoin="round">
 <path d="M0,-40H26M13,-40V0"/><g transform="translate(38 0)"><path d="M24,-40H0V0H24M0,-20H18"/></g><g transform="translate(76 0)"><path d="M0,0L13,-40L26,0M5,-14H21"/></g><g transform="translate(114 0)"><path d="M0,-40H26M13,-40V0"/></g><g transform="translate(152 0)"><path d="M0,0V-40H16Q26,-40 26,-30Q26,-20 16,-20H0M14,-20L26,0"/></g><g transform="translate(190 0)"><path d="M13,-40Q26,-40 26,-28V-12Q26,0 13,0Q0,0 0,-12V-28Q0,-40 13,-40Z"/></g></g>
<path d="M0,845 C 300,842 620,852 900,838 S 1100,800 1200,790" fill="none" stroke="#8FB573" stroke-width="4.5" stroke-linecap="round" stroke-dasharray="1 10"/>
<circle cx="60" cy="845" r="8" fill="#141614" stroke="#8FB573" stroke-width="2.6"/>
</svg>`;
fs.writeFileSync('teatro-frontal.svg',svg);
