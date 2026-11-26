// Spells, heals and wards build on the equipped weapon (40% of strike x cost multiplier). GAME_DIR=<folder with data/> LD=./real_ld.js node t84.js
let fails=0;const ok=(n,c)=>{console.log((c?'PASS':'FAIL')+' '+n);if(!c)fails++};
const w=require(process.env.LD||'./real_ld.js')();const D=w.GAME_DATA,G=D.gear,A=D.abilities,LO=w.GAME_LOADOUT,T=D.gearTiers;
const unit=(cls,main,t)=>{const d=LO.derive(cls,{MainHand:T.tierItem(main,t||1)},[]);return {wpn:d.wpn,spellPow:d.spellPow,healPow:d.healPow,powerMods:d.power}};
const near=(a,b)=>Math.abs(a-b)<1e-9;
const wiz=unit('wizard','staff_fire'),gs=unit('warrior','greatsword'),wand=unit('wizard','wand_fire');
ok('staff strike 8: a 2-AP spell gets 0.3 x 8 = 2.4',near(LO.castPart(wiz,A.ember),2.4));
ok('1-AP spell gets half (cost multiplier 0.5): 1.2',near(LO.castPart(wiz,A.spark),1.2));
ok('3-AP spell gets 1.25x: 3.0',near(LO.castPart(wiz,A.judgment),3.0));
ok('tier 7 staff (26): 2-AP spell gets 7.8',near(LO.castPart(unit('wizard','staff_fire',7),A.ember),7.8));
ok('wand 6: 1.8; greatsword 12: 3.6 (a hybrid with a big weapon gets more)',near(LO.castPart(wand,A.ember),1.8)&&near(LO.castPart(gs,A.ember),3.6));
ok('heals get it: Salve (2 AP) 2.4, Mend (1 AP) 1.2',near(LO.castPart(wiz,A.salve),2.4)&&near(LO.castPart(wiz,A.mend),1.2));
ok('spell wards get it: Aegis (2 AP, base shield 9) takes 2.4 from the weapon, and the total is scaled by spell power',near(LO.castPart(wiz,A.aegis),2.4)&&A.aegis.fx.shield===9&&LO.wardFx(wiz,A.aegis).shield===Math.round((9+2.4)*(1+wiz.spellPow/100)));
const sc=D.combatRules.loadout.wardArmorScale!==undefined?D.combatRules.loadout.wardArmorScale:0.2,tank=Object.assign({},wiz,{armor:10});
ok('physical wards take the weapon share too (Fortify 1.2, Phalanx 2.4) plus a fifth of armor, with no spell power',near(LO.castPart(wiz,A.fortify),1.2)&&near(LO.castPart(wiz,A.phalanx),2.4)&&LO.wardFx(wiz,A.fortify).shield===Math.round(A.fortify.fx.shield+1.2)&&LO.wardFx(tank,A.fortify).shield===Math.round(A.fortify.fx.shield+1.2+10*sc));
ok('a skill with no shield (Stand Fast) gets no ward bonus',LO.castPart(wiz,A.brace)===0&&LO.wardFx(wiz,A.brace)===A.brace.fx);
ok('weapon skills and basic attacks do not get it',LO.castPart(gs,A.cleave)===0&&LO.castPart(gs,A[gs.wpn&&LO.attackId(gs.wpn)])===0);
ok('no weapon, no bonus',LO.castPart({wpn:null},A.ember)===0&&LO.castPart({},A.salve)===0);
ok('the share is tunable (combatRules.loadout.spellWeaponShare)',(()=>{const R=D.combatRules.loadout;const old=R.spellWeaponShare;R.spellWeaponShare=0.5;const v=LO.castPart(wiz,A.ember);R.spellWeaponShare=old;return near(v,4)&&old===0.3})());
// attack registration: every weapon, every tier and every unique
ok('every weapon has an Attack ability',Object.keys(G).filter(i=>G[i].weapon).every(i=>A['atk_'+i]&&A['atk_'+i].p===G[i].weapon.p&&A['atk_'+i].r===G[i].weapon.r));
ok('tier 7 greatsword Attack is 30',A.atk_t7_greatsword.p===30);
ok('every ability with an AP cost has its own mana cost (m) in abilities.js',Object.entries(A).filter(([i,a])=>!a.isAttack&&a.c>0).every(([i,a])=>Number.isFinite(a.m)&&a.m>=0&&LO.manaCost(a)===a.m));
ok('basic weapon Attacks cost no mana',Object.keys(A).filter(i=>A[i].isAttack).every(i=>LO.manaCost(A[i])===0));
ok('ranged weapon skills reach 1 hex further: Aimed Shot (id shoot) 5, Longshot 6, Snipe 6, Quick Shot 4, Leg Shot 4, Bombardment 6',A.shoot.r===5&&A.longshot.r===6&&A.snipe.r===6&&A.quick.r===4&&A.shortbow.r===4&&A.bombardment.r===6);
console.log('fails='+fails);
