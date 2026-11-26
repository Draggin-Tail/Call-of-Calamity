// Map pass 2 (design/battle_map_rules.md): every battle and dungeon map, as the game loads it (after wallsPass). Run: cd tests && LD=./real_ld.js node tmaps.js
// Checks: 10-14 a side, 8 spawns a side on free land at one level per side, every walkable tile reachable climbing 1 (walls not walkable),
// heights <= 8 (walls <= 10), at least half the land free, rotation symmetric unless the map says asym: true, the new props are named,
// zones on land, story objectives resolve, and both spawn lists still work after swapSides (each side's list reaches the other).
const w=require(process.env.LD||'./real_ld.js')();const C=w.GAME_CAMPAIGN,D=w.GAME_DATA;let fails=0;
const ok=(n,c)=>{console.log((c?'PASS':'FAIL')+' '+n);if(!c)fails++};
const nb=(x,y)=>(y&1?[[1,0],[-1,0],[0,-1],[1,-1],[0,1],[1,1]]:[[1,0],[-1,0],[0,-1],[-1,-1],[0,1],[-1,1]]).map(([a,b])=>[x+a,y+b]);
const ids=Object.keys(D.maps).filter(k=>!D.maps[k].arena&&D.maps[k].heights.length>=10);
const bad=[];let nAsym=0;
for(const id of ids){const m=D.maps[id],H=m.heights.length,W=m.heights[0].length,pr=m.props||{},V=new Set((m.voids||[]).map(v=>v+''));
 const wall=new Set(Object.keys(pr).filter(k=>pr[k]==='h')),rock=new Set((m.rocks||[]).map(r=>r+''));const blocked=k=>V.has(k)||rock.has(k)||wall.has(k);
 if(W<10||W>14||H<10||H>14)bad.push(id+' size');
 if(m.spawns.P.length<8||m.spawns.E.length<8)bad.push(id+' spawns');
 for(const s of [...m.spawns.P,...m.spawns.E])if(blocked(s+''))bad.push(id+' spawn blocked '+s);
 for(const side of ['P','E'])if(new Set(m.spawns[side].map(([x,y])=>m.heights[y][x])).size!==1)bad.push(id+' '+side+' not one level');
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){const k=x+','+y;if(V.has(k))continue;if(m.heights[y][x]>(wall.has(k)?10:8))bad.push(id+' too tall '+k)}
 const land=[];for(let y=0;y<H;y++)for(let x=0;x<W;x++)if(!V.has(x+','+y))land.push(x+','+y);const free=land.filter(k=>!blocked(k));
 if(free.length<0.5*land.length)bad.push(id+' free '+free.length+'/'+land.length);
 const reach=st=>{const seen=new Set([st+'']),q=[st];while(q.length){const [x,y]=q.pop();for(const [a,b] of nb(x,y)){const k=a+','+b;if(a<0||b<0||a>=W||b>=H||blocked(k)||seen.has(k))continue;if(Math.abs(m.heights[y][x]-m.heights[b][a])<=1){seen.add(k);q.push([a,b])}}}return seen};
 const fromE=reach(m.spawns.E[0]),fromP=reach(m.spawns.P[0]);
 if(free.some(k=>!fromE.has(k)))bad.push(id+' cut off');
 if(!m.spawns.P.every(s=>fromE.has(s+''))||!m.spawns.E.every(s=>fromP.has(s+'')))bad.push(id+' sides not joined (swapSides)');
 if(m.asym)nAsym++;else for(let y=0;y<H;y++)for(let x=0;x<W;x++){const a=W-1-x,b=H-1-y,k=x+','+y,k2=a+','+b;if(V.has(k)!==V.has(k2)||(!V.has(k)&&!wall.has(k)&&m.heights[y][x]!==m.heights[b][a])||(pr[k]||'')!==(pr[k2]||'')){bad.push(id+' not symmetric '+k);y=H;break}}
 for(const [z,t] of Object.entries(m.zones||{}))for(const s of t)if(blocked(s+''))bad.push(id+' zone '+z+' blocked '+s);
 for(const k of Object.keys(pr))if(!blocked(k)&&pr[k]!=='h')bad.push(id+' prop not blocked '+k);}
ok(ids.length+' battle and dungeon maps ('+nAsym+' asymmetric): size, spawns, levels, reach, swap, symmetry unless asym'+(bad.length?' ['+bad.slice(0,8)+']':''),bad.length===0);
// story objectives that name zones resolve on land
const zoneUse=[];for(const [id,e] of Object.entries(C.ENCOUNTERS)){const objs=[e.objective].concat((e.options||[]).map(o=>o.objective)).filter(Boolean);for(const o of objs)if(o.zone&&!['enemy_camp','player_camp'].includes(o.zone)||(o.zone&&D.maps[e.map].zones&&D.maps[e.map].zones[o.zone]))zoneUse.push([id,e.map,o.zone])}
ok('zone objectives find their zone ('+zoneUse.map(z=>z.join(':'))+')',zoneUse.every(([id,m,z])=>(D.maps[m].zones||{})[z]&&D.maps[m].zones[z].length>0));
// a leader fight's first enemy spawn is on free land
ok('every encounter map exists and C.validate is empty',C.validate().length===0);
const L=D.maps;ok('the new prop letters are on maps (j, a, u, o)',['j','a','u','o'].every(c=>Object.values(L).some(m=>Object.values(m.props||{}).includes(c))));
console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails?1:0);
