const fs=require('fs'),path=require('path');
// NOLOOT=1 leaves out data/loot.js. NOGOLD=1 leaves out data/gold_economy.js (to compare with the old rules); ARENA=1 adds data/arena.js (it has its own checks and needs the arena maps).
module.exports=function(){const dir=process.env.GAME_DIR||path.join(__dirname,'..','game');const store={};
 const w={localStorage:{getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=String(v)},removeItem:k=>{delete store[k]},key:i=>Object.keys(store)[i],get length(){return Object.keys(store).length}},console,setTimeout,clearTimeout,Math,Date,JSON};w.window=w;
 const files=['combatRules','maps','abilities','classes','passives','races','factions','gear','loadout','shapes','triggers','gamestate','regions','places','roads_gen','encounters','campaign','intrigue','intrigue_cast','faction_work','faction_climax','story_world','faction_quests','relations','supply','attacks','roads','gear_tiers','uniques','enemy_kits'];
 if(!process.env.NOGOLD)files.push('gold_economy');if(!process.env.NOLOOT)files.push('loot');if(process.env.ARENA)files.push('arena');
 files.forEach(f=>{new Function('window','localStorage','document',fs.readFileSync(path.join(dir,'data',f+'.js'),'utf8'))(w,w.localStorage,undefined)});
 return w};
