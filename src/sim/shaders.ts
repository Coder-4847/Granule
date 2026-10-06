import { materialGLSL, physicsGLSL, reactionsGLSL } from '../data/materials';
import { header } from './gl';
const props = materialGLSL();
const fields = `uniform sampler2D uField;
vec4 field(ivec2 p){return texelFetch(uField,clamp(p,ivec2(0),uSize-1),0);}`;
export const dynamics =
  header +
  props +
  physicsGLSL() +
  fields +
  `
void main(){
 ivec2 p=ivec2(gl_FragCoord.xy);vec4 s=cell(p),f=field(p);
 Physics m=phys(int(s.x));Property material=prop(int(s.x));
 vec4 a=field(p+ivec2(-1,0)),b=field(p+ivec2(1,0)),c=field(p+ivec2(0,-1)),d=field(p+ivec2(0,1));
 float pressure=(2.0*f.x-f.y+.22*(a.x+b.x+c.x+d.x-4.0*f.x))*.965;
 if(m.hardness>99999.0)pressure=0.0;
 float charge=f.z;
 if(charge>0.0)charge=charge>.18?charge-.18:-12.0;
 else if(charge<0.0)charge=min(0.0,charge+1.0);
 else if(m.electric>0.0&&max(max(a.z,b.z),max(c.z,d.z))>.25)charge=.55+.45*m.electric;
 bool spark=phys(int(cell(p+ivec2(-1,0)).x)).source||phys(int(cell(p+ivec2(1,0)).x)).source||phys(int(cell(p+ivec2(0,-1)).x)).source||phys(int(cell(p+ivec2(0,1)).x)).source||max(max(a.z,b.z),max(c.z,d.z))>.8;
 if(m.source)charge=1.0;
 if(spark&&m.electric>0.0&&f.z==0.0)charge=1.0;
 bool detonate=m.blast>0.0&&(s.y>=material.ignition||max(max(a.x,b.x),max(c.x,d.x))>5.0||spark);
 if(detonate)pressure+=m.blast;
 float head=0.0;
 if(material.phase==3){
   if(m.burn==0.0&&material.lifetime==0.0)head=max(0.0,mod(s.z,5000.0)*.96);
   if(prop(int(cell(p+ivec2(0,1)).x)).phase==3)head=max(head,d.w+material.density);
   if(prop(int(cell(p+ivec2(0,-1)).x)).phase==3)head=max(head,c.w-material.density);
   if(prop(int(cell(p+ivec2(-1,0)).x)).phase==3)head=max(head,a.w-.02);
   if(prop(int(cell(p+ivec2(1,0)).x)).phase==3)head=max(head,b.w-.02);
 }
 outState=vec4(clamp(pressure,-200.0,200.0),f.x,charge,clamp(head*.998,0.0,1000.0));
}`;
export const transport =
  header +
  props +
  fields +
  `
uniform uint uTick; uniform uint uSeed; uniform int uOffset;
bool mobile(vec4 a){ int phase=prop(int(a.x)).phase; return phase==2||phase==3||phase==4; }
bool fall(vec4 a,vec4 b){
 Property pa=prop(int(a.x)),pb=prop(int(b.x));
 if(pa.phase==1||pb.phase==1||a.x==b.x) return false;
 if(pa.phase==3&&a.z>=5000.0&&pb.phase==0)return false;
 if(pa.phase==0) return pb.phase==4;
 if(pb.phase==2) return false;
 return pa.density>pb.density && (mobile(a)||mobile(b));
}
bool flow(vec4 a,vec4 b,ivec2 p){int ap=prop(int(a.x)).phase,bp=prop(int(b.x)).phase;if(!((ap==3&&bp==0)||(ap==0&&bp==3)))return true;float g=field(p+ivec2(-1,0)).w-field(p+ivec2(2,0)).w;return abs(g)<.1||(g>0.0&&ap==3)||(g<0.0&&bp==3);}
void swapCells(inout vec4 a,inout vec4 b){vec4 t=a;a=b;b=t;}
void main(){
 ivec2 p=ivec2(gl_FragCoord.xy); ivec2 base=((p+uOffset)/2)*2-uOffset;
 if(any(lessThan(base,ivec2(1)))||any(greaterThanEqual(base+1,uSize-1))){outState=cell(p);return;}
 vec4 a=cell(base),b=cell(base+ivec2(1,0)),c=cell(base+ivec2(0,1)),d=cell(base+ivec2(1,1));
 uint key=uint(base.x)+uint(base.y)*uint(uSize.x)+uTick*747796405u+uSeed;
 bool left=random(key)<0.5;
 // Horizontal impulse transports grains without duplicating cells. Shock gradients
 // add outward momentum; the same block permutation is computed by all four cells.
 float force=clamp((field(base+ivec2(-1,0)).x-field(base+ivec2(2,0)).x)*.35,-4.0,4.0);
 a.w=clamp(a.w+force,-4.0,4.0);b.w=clamp(b.w+force,-4.0,4.0);
 c.w=clamp(c.w+force,-4.0,4.0);d.w=clamp(d.w+force,-4.0,4.0);
 if((mobile(a)&&a.w>.5&&b.x==0.0)||(mobile(b)&&b.w<-.5&&a.x==0.0))swapCells(a,b);
 if((mobile(c)&&c.w>.5&&d.x==0.0)||(mobile(d)&&d.w<-.5&&c.x==0.0))swapCells(c,d);
 float lift=field(base+ivec2(0,-1)).x-field(base+ivec2(0,2)).x;
 bool holdC=prop(int(c.x)).phase==3&&c.z>=5000.0;bool holdD=prop(int(d.x)).phase==3&&d.z>=5000.0;
 if(!holdC&&fall(c,a)) swapCells(c,a); if(!holdD&&fall(d,b)) swapCells(d,b);
 if(left){if(!holdC&&fall(c,b)){swapCells(c,b);b.w=1.0;} if(!holdD&&fall(d,a)){swapCells(d,a);a.w=-1.0;}}
 else {if(!holdD&&fall(d,a)){swapCells(d,a);a.w=-1.0;} if(!holdC&&fall(c,b)){swapCells(c,b);b.w=1.0;}}
 Property pa=prop(int(a.x)),pb=prop(int(b.x)),pc=prop(int(c.x)),pd=prop(int(d.x));
 if((pa.phase==3||pa.phase==4||pb.phase==3||pb.phase==4)&&pa.phase!=1&&pb.phase!=1&&pa.phase!=2&&pb.phase!=2&&random(key+31u)>max(pa.viscosity,pb.viscosity)&&flow(a,b,base)) swapCells(a,b);
 if((pc.phase==3||pc.phase==4||pd.phase==3||pd.phase==4)&&pc.phase!=1&&pd.phase!=1&&pc.phase!=2&&pd.phase!=2&&random(key+71u)>max(pc.viscosity,pd.viscosity)&&flow(c,d,base+ivec2(0,1))) swapCells(c,d);
 // Upward transport is applied after gravity so the same block cannot immediately
 // undo a pressure impulse. Hydraulic head equilibrates connected liquid columns.
 bool supported=prop(int(a.x)).phase==3&&prop(int(b.x)).phase==3&&prop(int(cell(base+ivec2(0,-1)).x)).phase==3&&prop(int(cell(base+ivec2(1,-1)).x)).phase==3;
 if(c.x==0.0&&mobile(a)&&(lift>2.0||(supported&&left&&prop(int(a.x)).phase==3&&max(field(base).w,mod(a.z,5000.0))>prop(int(a.x)).density*3.0&&random(key+101u)>prop(int(a.x)).viscosity))){swapCells(a,c);if(prop(int(c.x)).phase==3&&prop(int(c.x)).ignition>9999.0&&prop(int(c.x)).lifetime==0.0)c.z=15000.0+max(field(base).w,mod(c.z,5000.0));}
 if(d.x==0.0&&mobile(b)&&(lift>2.0||(supported&&!left&&prop(int(b.x)).phase==3&&max(field(base+ivec2(1,0)).w,mod(b.z,5000.0))>prop(int(b.x)).density*3.0&&random(key+103u)>prop(int(b.x)).viscosity))){swapCells(b,d);if(prop(int(d.x)).phase==3&&prop(int(d.x)).ignition>9999.0&&prop(int(d.x)).lifetime==0.0)d.z=15000.0+max(field(base+ivec2(1,0)).w,mod(d.z,5000.0));}
 ivec2 local=p-base;outState=local.y==0?(local.x==0?a:b):(local.x==0?c:d);
 outState.w*=0.85;
}`;
export const thermal =
  header +
  props +
  physicsGLSL() +
  reactionsGLSL() +
  fields +
  `
uniform uint uTick;uniform uint uSeed;
layout(location=1) out vec4 outEvent;
void main(){
 ivec2 p=ivec2(gl_FragCoord.xy); vec4 s=cell(p);Property m=prop(int(s.x));
 Physics ph=phys(int(s.x));vec4 f=field(p);int old=int(s.x);float event=0.0;
 vec4 a=cell(p+ivec2(-1,0)),b=cell(p+ivec2(1,0)),c=cell(p+ivec2(0,-1)),d=cell(p+ivec2(0,1));
 vec4 neighbors[4]=vec4[4](a,b,c,d);ivec2 offsets[4]=ivec2[4](ivec2(-1,0),ivec2(1,0),ivec2(0,-1),ivec2(0,1));
 uint key=uint(p.x+p.y*uSize.x)+uTick*747796405u+uSeed;float r=random(key);
 float delta=(a.y-s.y)*min(m.conductivity,prop(int(a.x)).conductivity)+(b.y-s.y)*min(m.conductivity,prop(int(b.x)).conductivity)+(c.y-s.y)*min(m.conductivity,prop(int(c.x)).conductivity)+(d.y-s.y)*min(m.conductivity,prop(int(d.x)).conductivity);
 s.y+=delta/(m.capacity*4.0); s.y=mix(s.y,20.0,m.phase==0?0.01:0.0001);
 if(m.emissive>0.0&&m.lifetime>0.0) s.y=max(s.y,m.initialTemp*0.9);
 int next=int(s.x);
 bool wet=false;bool spark=false;bool fuel=false;int growing=0;float grow=0.0;
 for(int i=0;i<4;i++){
  Physics n=phys(int(neighbors[i].x));wet=wet||n.coolant;spark=spark||n.source||field(p+offsets[i]).z>.8;
  fuel=fuel||(neighbors[i].z<0.0&&n.burn>0.0);
  if(ph.burn>0.0&&neighbors[i].y>m.ignition&&(prop(int(neighbors[i].x)).emissive>0.0||neighbors[i].z<0.0)&&random(key+uint(i)*31u)<.08)s.y=max(s.y,m.ignition+1.0);
  if(n.growth>0.0){growing=int(neighbors[i].x);grow=n.growth;}
 }
 if(ph.blast>0.0&&(s.y>=m.ignition||abs(f.x)>5.0)){next=6;event=4.0;s.y=900.0;}
 else if(ph.blast==0.0&&s.y>m.ignition&&ph.burn==0.0){next=m.burnTo;event=1.0;}
 else if(s.y>m.hot){next=m.hotTo;event=prop(next).phase==4?2.0:7.0;}
 else if(s.y<m.cold){next=m.coldTo;event=5.0;}
 // A newly arrived electrical pulse primes the fuel for the next dynamics pass,
 // which emits its pressure impulse before the fuel is consumed.
 if(ph.blast>0.0&&spark&&next==old)s.y=max(s.y,m.ignition+1.0);
 if(ph.burn>0.0){
  if((s.y>m.ignition||spark)&&s.z>=0.0)s.z=-ph.burn;
  if(s.z<0.0){s.z+=1.0;s.y=max(s.y,650.0);event=1.0;if(s.z>=0.0)next=ph.residue;}
  if(wet){s.z=0.0;s.y=min(s.y,90.0);event=2.0;}
 }
 if(old==6&&wet){next=7;s.y=110.0;event=2.0;}
 if(old==0&&fuel&&r<.22){next=r<.025?25:6;event=1.0;}
 if(old==0&&growing>0&&r<grow){
   bool moisture=false;
   for(int j=1;j<=4;j++){moisture=moisture||phys(int(cell(p+ivec2(j,0)).x)).coolant||phys(int(cell(p-ivec2(j,0)).x)).coolant||phys(int(cell(p+ivec2(0,j)).x)).coolant||phys(int(cell(p-ivec2(0,j)).x)).coolant;}
   if(moisture){next=growing;event=5.0;}
 }
 if(next==old){for(int i=0;i<4;i++){
  uint own=uint(p.x+p.y*uSize.x),other=uint(p.x+offsets[i].x+(p.y+offsets[i].y)*uSize.x);
  vec3 reaction=react(old,int(neighbors[i].x),random(min(own,other)*1664525u+max(own,other)+uTick*747796405u+uSeed));
  if(reaction.x>=0.0){next=int(reaction.x);event=reaction.y;if(reaction.z> -9999.0)s.y=reaction.z;break;}
 }}
 if(ph.hardness<99999.0&&m.phase!=0&&m.phase!=4&&abs(f.x)>ph.hardness&&ph.blast==0.0){next=ph.debris;event=9.0;s.w=clamp(f.x*.2,-4.0,4.0);}
 if(m.lifetime>0.0){s.z-=1.0;if(s.z<=0.0)next=m.decayTo;}
 if(m.phase==3&&m.lifetime==0.0&&ph.burn==0.0)s.z=max(f.w,mod(s.z,5000.0)*.96)+max(0.0,floor(s.z/5000.0)-1.0)*5000.0;
 if(next!=int(s.x)){Property n=prop(next);s.x=float(next);s.z=n.lifetime;if(n.emissive>0.0)s.y=n.initialTemp;}
 if(event==0.0){if(m.emissive>0.0)event=1.0;else if(m.phase==4)event=8.0;else if(m.phase==3&&d.x==0.0&&abs(s.w)>.2)event=6.0;else if(m.phase==2&&abs(s.w)>.05)event=10.0;}
 outEvent=vec4(event,event>0.0?1.0:0.0,s.y,float(next));
 outState=s;
}`;
export const brush =
  header +
  props +
  `
uniform vec2 uFrom;uniform vec2 uTo;uniform float uRadius;uniform int uMaterial;uniform int uShape;uniform int uTool;uniform bool uOverwrite;
void main(){
 vec2 p=gl_FragCoord.xy;vec2 v=uTo-uFrom;float t=clamp(dot(p-uFrom,v)/max(dot(v,v),0.001),0.0,1.0);vec2 d=abs(p-(uFrom+v*t));
 bool inside=uShape==1?max(d.x,d.y)<=uRadius:length(d)<=uRadius;
 vec4 s=cell(ivec2(p));
 if(inside && p.x>2.0&&p.y>2.0&&p.x<float(uSize.x)-2.0&&p.y<float(uSize.y)-2.0){
 if(uTool==1)s.y=min(1800.0,s.y+120.0);else if(uTool==2)s.y=max(-100.0,s.y-80.0);
 else if(uOverwrite||s.x==0.0||uMaterial==0){Property m=prop(uMaterial);s=vec4(float(uMaterial),m.initialTemp,m.lifetime,clamp(v.x,-4.0,4.0));}}
 outState=s;
}`;
