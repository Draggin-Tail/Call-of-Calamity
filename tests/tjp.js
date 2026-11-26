// JP costs vs enemy class gates. Run: cd tests && node tjp.js   (loads classes, abilities, gamestate only; GAME_DIR=<game folder> to override)
global.window=global;const fs=require('fs'),vm=require('vm'),path=require('path'),dir=path.join(process.env.GAME_DIR||path.join(__dirname,'..','game'),'data');
for(const f of ['classes','abilities','gamestate'])vm.runInThisContext(fs.readFileSync(dir+'/'+f+'.js','utf8'));
let fails=0;const ok=(n,c)=>{console.log((c?'PASS ':'FAIL ')+n);if(!c)fails++};
const D=GAME_DATA,S=GAME_SAVE,cl=D.classes,ids=Object.keys(cl).filter(i=>cl[i].selectable!==false);
const need=(c,s)=>{(cl[c].requires||[]).forEach(r=>{if(!s.has(r)){s.add(r);need(r,s)}});return s};
const unlock=c=>[...need(c,new Set())].reduce((n,r)=>n+S.classCost(r),0);
const GATE=[[0,1],[450,5],[900,5],[2900,9],[3350,10]];   // mirror of KIT_RULES.gate in enemy_kits.js
const gate=c=>{let g=1;GATE.forEach(([n,l])=>{if(unlock(c)>=n)g=l});return g};
const t=n=>ids.filter(i=>cl[i].tier===n);
ok('first skill of every class is free',ids.every(i=>S.skillCost(i,cl[i].ab[0])===0));
ok('every cost is a multiple of 5',ids.every(i=>cl[i].ab.every(a=>S.skillCost(i,a)%5===0)));
ok('entry classes open at gate 1',t(1).every(i=>gate(i)===1));
ok('every Tier 2 class unlocks at 450 to 1,100 JP (gate 5)',t(2).every(i=>unlock(i)>=450&&unlock(i)<=1100&&gate(i)===5));
ok('every Tier 3 class unlocks at 2,900 to 4,000 JP (gate 9 or 10)',t(3).every(i=>unlock(i)>=2900&&unlock(i)<=4000&&[9,10].includes(gate(i))));
ok('Tier 3 gates split 9 / 7 as designed',t(3).filter(i=>gate(i)===9).length===9&&t(3).filter(i=>gate(i)===10).length===7);
ok('mastering a Tier 2 class takes 900 to 1,300 JP (about 9 to 13 battles)',t(2).every(i=>S.classCost(i)>=900&&S.classCost(i)<=1300));
const u={id:'u1',primary:'squire',jp:{},learned:{},unlocked:['squire']};
ok('learning spends the scaled cost',(()=>{const a=cl.squire.ab[1],c=S.skillCost('squire',a);u.jp.squire=1000;const r=S.learnSkill({roster:[u]},u.id,a);return r.ok&&r.cost===c&&u.jp.squire===1000-c})());
console.log(fails?fails+' FAILED':'ALL PASS');process.exit(fails?1:0);
