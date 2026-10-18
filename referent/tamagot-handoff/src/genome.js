/* Tamagot genome: seed -> DNA, life stages, raising styles.
   Extracted verbatim from app/index.html (sections 1, 2, 2b). Keep both in sync.
   heartShape/crescent need THREE and are only used by the 3D builder. */
/* ---------- 1. GENOME: the rules that turn a seed into DNA ---------- */
const GENES=[
{key:'body',name:'Body',alleles:[['mochi','Mochi',35],['bean','Bean',25],['pudding','Pudding',25],['drop','Droplet',15]]},
{key:'hue',name:'Color',alleles:[['#FFB59A','Peach',18],['#93E2BE','Mint',18],['#98C6FF','Sky',16],['#C7B0FF','Lilac',16],['#FFE07A','Lemon',12],['#FFA3C2','Rose',12],['#C99E82','Cocoa',6],['#6C78E0','Midnight',2]]},
{key:'ears',name:'Top',alleles:[['none','Bare',20],['cat','Cat ears',22],['bunny','Bunny ears',20],['antenna','Antenna',16],['sprout','Sprout',14],['horns','Tiny horns',8]]},
{key:'eyes',name:'Eyes',alleles:[['dot','Dot',30],['sparkle','Sparkle',28],['sleepy','Sleepy',18],['wink','Wink',16],['star','Star',8]]},
{key:'mouth',name:'Mouth',alleles:[['smile','Smile',35],['cat','Kitty',25],['open','Gasp',20],['tongue','Bleh',20]]},
{key:'cheeks',name:'Cheeks',alleles:[['blush','Blush',50],['freckles','Freckles',30],['none','Plain',20]]},
{key:'pattern',name:'Pattern',alleles:[['plain','Solid',40],['belly','Belly',30],['spots','Spots',20],['stripe','Stripes',10]]},
{key:'aura',name:'Charm',alleles:[['none','None',55],['bow','Bow',25],['crown','Crown',15],['halo','Halo',5]]},
{key:'temper',name:'Temper',alleles:[['playful','Playful',20],['sleepy','Dreamy',20],['curious','Curious',20],['brave','Brave',20],['shy','Shy',20]]}
];
const UNIQUE_CHANCE=40;
const UQ=[
['tail','Tail',45,[['tail_fluffy','Fluffy tail',50],['tail_curly','Curly tail',30],['tail_bolt','Lightning tail',15],['tail_flame','Flame tail',5]]],
['wing','Wings',35,[['wing_feather','Feather wings',50],['wing_bat','Bat wings',30],['wing_butterfly','Butterfly wings',15],['wing_angel','Angel wings',5]]],
['ear','Mystic ears',20,[['ear_fox','Fox ears',50],['ear_elf','Elf ears',30],['ear_crystal','Crystal horns',15],['ear_unicorn','Unicorn horn',5]]]
];
const SYL=['Mo','Pi','Nu','Ki','Lu','Bo','Ta','Fi','Zu','Po','Mi','Ru','Ko','Yu','Chi','Pa'];
const SUF=['','chi','po','n','ko','mi'];
const B='ATGC';
function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function rng(a){return()=>{a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}
function pick(list,roll,wi){let acc=0;for(let i=0;i<list.length;i++){acc+=list[i][wi];if(roll<acc)return i;}return list.length-1;}
const pointsFor=p=>p<=1?5:p<=3?4:p<=6?3:p<=12?2:1;
function decode(seed){
  const norm=String(seed??'').trim().toUpperCase();
  const h=hash(norm), r=rng(h);
  const name=SYL[Math.floor(r()*16)]+SYL[Math.floor(r()*16)].toLowerCase()+SUF[Math.floor(r()*6)];
  const genes={}, list=[]; let pts=0;
  for(const g of GENES){
    const idx=pick(g.alleles,r()*100,2), a=g.alleles[idx], w=a[2];
    const p=w<=5?4:w<=8?3:w<=12?2:w<=16?1:0; pts+=p; genes[g.key]=a[0];
    list.push({key:g.key,gene:g.name,label:a[1],odds:w+'%',points:p,codon:B[(idx>>2)&3]+B[idx&3]});
  }
  const stats={appetite:3+Math.floor(r()*8),stamina:3+Math.floor(r()*8),charm:3+Math.floor(r()*8)};
  const u1=r()*100,u2=r()*100,u3=r()*100;
  let uq={value:'none',slot:'none',label:'No unique part',chance:'60%',points:0,idx:0};
  if(u1<UNIQUE_CHANCE){
    const si=pick(UQ,u2,2), S=UQ[si], vi=pick(S[3],u3,2);
    const pc=UNIQUE_CHANCE*S[2]*S[3][vi][2]/10000, up=pointsFor(pc);
    uq={value:S[3][vi][0],slot:S[0],slotLabel:S[1],label:S[3][vi][1],chance:(Math.round(pc*10)/10)+'%',slotOdds:S[2]+'%',varOdds:S[3][vi][2]+'%',points:up,idx:si*4+vi+1};
    pts+=up;
  }
  genes.unique=uq.value;
  list.push({key:'unique',gene:'Unique',label:uq.slot==='none'?'None':uq.label,odds:uq.chance,points:uq.points,codon:B[(uq.idx>>2)&3]+B[uq.idx&3]});
  const tier=pts>=13?'Legendary':pts>=10?'Epic':pts>=7?'Rare':pts>=4?'Uncommon':'Common';
  /* fine DNA: a second stream of small, continuous differences, so no two seeds look exactly alike */
  const m=rng((h^0xA11CE)>>>0);
  const micro={hue:Math.round((m()*2-1)*10),light:(m()*2-1)*.05,w:.94+m()*.12,h:.94+m()*.12,eye:.9+m()*.22,gap:.92+m()*.16,tilt:(m()*2-1)*.12,cheek:.85+m()*.35,
    mark:['heart','star','dot'][Math.floor(m()*3)],markY:-.4+m()*.8,markAz:(m()*2-1)*Math.PI,code:'FP-'+Math.floor(m()*0xFFFFFF).toString(16).toUpperCase().padStart(6,'0')};
  if(Math.abs(micro.markAz)<1.05)micro.markAz+=micro.markAz<0?-1.25:1.25;
  return {norm,hash:h,hex:h.toString(16).toUpperCase().padStart(8,'0'),name,genes,list,points:pts,tier,stats,unique:uq,micro};
}
/* shift a hex color's hue (degrees) and lightness */
function shiftHue(hex,deg,dl){let r=parseInt(hex.slice(1,3),16)/255,g=parseInt(hex.slice(3,5),16)/255,b=parseInt(hex.slice(5,7),16)/255;
  const mx=Math.max(r,g,b),mn=Math.min(r,g,b);let h=0,s=0,l=(mx+mn)/2;
  if(mx!==mn){const dd=mx-mn;s=l>.5?dd/(2-mx-mn):dd/(mx+mn);h=mx===r?(g-b)/dd+(g<b?6:0):mx===g?(b-r)/dd+2:(r-g)/dd+4;h/=6;}
  h=(h+deg/360+1)%1;l=Math.max(0,Math.min(1,l+dl));
  const f=(p,q,t)=>{t=(t+1)%1;return t<1/6?p+(q-p)*6*t:t<1/2?q:t<2/3?p+(q-p)*(2/3-t)*6:p;};
  const q=l<.5?l*(1+s):l+s-l*s,p=2*l-q;const to=x=>Math.round(x*255).toString(16).padStart(2,'0');
  return '#'+(s===0?to(l)+to(l)+to(l):to(f(p,q,h+1/3))+to(f(p,q,h))+to(f(p,q,h-1/3)));}
function mix(a,b,t){const pa=parseInt(a.slice(1),16),pb=parseInt(b.slice(1),16);const ch=s=>Math.round(((pa>>s)&255)*(1-t)+((pb>>s)&255)*t);return '#'+((1<<24)|(ch(16)<<16)|(ch(8)<<8)|ch(0)).toString(16).slice(1);}

/* ---------- 2. LIFE STAGES: which genes show at each age ---------- */
const STAGES=['Egg','Baby','Child','Teen','Adult'];
const XP_AT=[0,0,40,120,240];               // XP needed to reach each stage (Baby comes from hatching)
const SHOWS_AT={hue:1,eyes:1,mouth:1,cheeks:1,temper:1,body:2,ears:2,pattern:3,aura:3,unique:3};
const LOOK=[null,
  {size:.58,eye:1.4,top:0,  pattern:false,charm:false,unique:0,  round:true},  // Baby: round, big eyes, a tuft
  {size:.74,eye:1.15,top:.62,pattern:false,charm:false,unique:0},              // Child: real body shape, small top
  {size:.87,eye:1.05,top:.85,pattern:true, charm:true, unique:.62},            // Teen: pattern, charm, unique bud
  {size:1,  eye:1,   top:1,  pattern:true, charm:true, unique:1}];             // Adult: everything

/* ---------- 2b. NURTURE: how it is raised decides its form ---------- */
const NURTURE_AT=[0,0,.5,.8,1];  // how strongly the raising style shows at each stage (babies all look like their DNA)
const FORMS={
  Sweet:  {need:'a bit of everything', look:'Looks just like its DNA'},
  Chonky: {need:'mostly Feed',         look:'Rounder, comfy belly'},
  Sporty: {need:'mostly Play',         look:'Taller, sweatband'},
  Dreamy: {need:'mostly Nap',          look:'Paler, sleepy nightcap'},
  Radiant:{need:'lots of all three',   look:'Glossy glow, sparkles, bigger unique part'},
  Scruffy:{need:'left hungry or bored',look:'Duller, droopy ears, a band-aid'}
};
const FORM_ORDER=['Sweet','Chonky','Sporty','Dreamy','Radiant','Scruffy'];
function raisingStyle(s){
  const h=s.hist||{feed:0,play:0,nap:0,night:0,neglect:0}, n=h.feed+h.play+h.nap;
  const sh={feed:n?h.feed/n:0,play:n?h.play/n:0,nap:n?h.nap/n:0};
  const moon=n>=6&&h.night/n>=.5;
  if(s.form)return {form:s.form,moon:!!s.moon,locked:true,n,sh,h};
  let form='Sweet';
  if(h.neglect>=180)form='Scruffy';
  else if(n>=4){const top=Object.entries(sh).sort((a,b)=>b[1]-a[1])[0];
    if(top[1]>=.5)form={feed:'Chonky',play:'Sporty',nap:'Dreamy'}[top[0]];
    else if(n>=12&&sh.feed>=.22&&sh.play>=.22&&sh.nap>=.22)form='Radiant';}
  return {form,moon,locked:false,n,sh,h};
}
function heartShape(m,s){const p=new THREE.Shape();p.moveTo(0,-s*.9);p.bezierCurveTo(s*1.2,-s*.1,s*.7,s*.95,0,s*.35);p.bezierCurveTo(-s*.7,s*.95,-s*1.2,-s*.1,0,-s*.9);const g=new THREE.ExtrudeGeometry(p,{depth:.015,bevelEnabled:false,curveSegments:16});g.translate(0,0,-.0075);return new THREE.Mesh(g,m);}
function crescent(m){const p=new THREE.Shape();p.absarc(0,0,.085,0,Math.PI*2,false);const hole=new THREE.Path();hole.absarc(.04,.025,.075,0,Math.PI*2,true);p.holes.push(hole);const g=new THREE.ExtrudeGeometry(p,{depth:.02,bevelEnabled:false,curveSegments:24});g.translate(0,0,-.01);return new THREE.Mesh(g,m);}


if(typeof module!=="undefined")module.exports={GENES,UQ,UNIQUE_CHANCE,SYL,SUF,decode,hash,rng,shiftHue,mix,STAGES,XP_AT,SHOWS_AT,LOOK,NURTURE_AT,FORMS,FORM_ORDER,raisingStyle};
