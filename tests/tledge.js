// Pushes and pulls: any drop (cliffs too), fall damage that grows per level (3, 7, 12, 18) but none for drops within the unit's jump, straight-line pushes, blocked pushes hurt.
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch(),p=await b.newPage(),errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(process.env.GAME_URL||'http://localhost:8766/index.html');
const r=await p.evaluate(()=>{Math.random=()=>0.99;const o=[],ok=(n,c)=>o.push((c?'PASS ':'FAIL ')+n);
start();over=false;
const setup=()=>{for(const row of HT)row.fill(0);ROCKS.length=0;units.length=0;const u=mk('warrior','P',1,3),t=mk('squire','E',2,3);units.push(u,t);units.forEach(x=>x.hp=x.max=100);active=u;return[u,t]};
let u,t;
for(const [drop,exp] of [[1,0],[2,7],[3,12],[4,18]]){[u,t]=setup();HT[3][3]=-drop;forcedMove(t,u,1,'push',{src:u});ok('push down '+drop+' level(s) (jump 1): '+exp+' fall damage, lands on the low tile ('+(100-t.hp)+')',t.x===3&&100-t.hp===exp)}
[u,t]=setup();HT[3][3]=-5;forcedMove(t,u,1,'push',{src:u});ok('a 5-level cliff can be pushed off',t.x===3&&t.hp<100);
[u,t]=setup();HT[3][3]=1;forcedMove(t,u,1,'push',{src:u});ok('pushing up one level within the climb is fine, no damage',t.x===3&&t.hp===100);
[u,t]=setup();HT[3][3]=3;forcedMove(t,u,1,'push',{src:u});ok('pushing up a 3-level wall does not move the unit and does not hurt it',t.x===2&&t.hp===100);
[u,t]=setup();const w=mk('squire','E',3,3);units.push(w);w.hp=w.max=100;forcedMove(t,u,1,'push',{src:u});ok('push into another unit: pushed unit takes 3, the other none ('+t.hp+','+w.hp+')',t.x===2&&t.hp===97&&w.hp===100);
[u,t]=setup();ROCKS.push('3,3');forcedMove(t,u,1,'push',{src:u});ok('push into a rock: 3 damage ('+t.hp+')',t.x===2&&t.hp===97);
[u,t]=setup();t.x=5;t.y=3;HT[3][6]=-2;HT[3][7]=-4;forcedMove(t,u,2,'push',{src:u});ok('2-hex push over two 2-level drops: two falls of 7 ('+(100-t.hp)+')',t.x===7&&100-t.hp===14);
[u,t]=setup();t.x=5;t.y=3;HT[3][6]=-1;HT[3][7]=-2;forcedMove(t,u,2,'push',{src:u});ok('2-hex push over two 1-level drops: free within jump ('+(100-t.hp)+')',t.x===7&&100-t.hp===0);
[u,t]=setup();t.jump=2;HT[3][3]=-2;forcedMove(t,u,1,'push',{src:u});ok('jump-2 unit: a 2-level drop is free ('+(100-t.hp)+')',100-t.hp===0);
[u,t]=setup();t.jump=2;HT[3][3]=-3;forcedMove(t,u,1,'push',{src:u});ok('jump-2 unit: a 3-level drop does full damage 12 ('+(100-t.hp)+')',100-t.hp===12);
[u,t]=setup();u.x=4;u.y=3;t.x=2;t.y=3;HT[3][3]=-2;forcedMove(t,u,1,'pull',{src:u});ok('a pull down a 2-level drop hurts: '+(100-t.hp),100-t.hp===7);
[u,t]=setup();t.hp=5;HT[3][3]=-2;forcedMove(t,u,1,'push',{src:u});ok('a fall can kill',t.hp<=0);
[u,t]=setup();t.st.root=2;HT[3][3]=-2;forcedMove(t,u,1,'push',{src:u});ok('rooted units cannot be pushed off a ledge',t.x===2&&t.hp===100);
// straight lines: from every side the unit ends two hexes from the pusher, in line with it
const px=(x,y)=>[x+(y&1?0.5:0),y*0.8660254];let allStraight=true;
for(const y of [3,4]){for(const [dx,dy] of (y&1?[[1,0],[-1,0],[0,-1],[1,-1],[0,1],[1,1]]:[[1,0],[-1,0],[0,-1],[-1,-1],[0,1],[-1,1]])){
  [u,t]=setup();u.x=4;u.y=y;t.x=4+dx;t.y=y+dy;const P=pushPath(t,u,2,'push');const e=P.steps[P.steps.length-1];
  const a=px(u.x,u.y),bb=px(t.x,t.y),c=e&&px(e[0],e[1]);if(!(e&&P.steps.length===2&&Math.abs((bb[0]-a[0])*(c[1]-a[1])-(bb[1]-a[1])*(c[0]-a[0]))<1e-6))allStraight=false}}
ok('a push goes in a straight line from all six sides',allStraight);
return o});
console.log(r.join('\n'),errs);await b.close()})();
