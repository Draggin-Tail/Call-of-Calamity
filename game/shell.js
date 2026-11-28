/* Campaign shell: title, new game, world map, camp (party, factions, menu), node services, battle briefing and results.
   Portrait only, one column (max 480px), tap targets of 44px or more. Plain DOM, no libraries. It sits on top of the battle page (index.html):
   it hides itself while a battle runs (Battle.start) and comes back with the result.
   All rules live in data/gamestate.js (GAME_SAVE) and data/campaign.js (GAME_CAMPAIGN); this file only shows them and calls them.
   Optional art: put a painted map at art/world.jpg (about 1376 x 768) and it becomes the map background; without it the map is drawn in code. */
(function () {
  'use strict';
  const D = window.GAME_DATA, S = window.GAME_SAVE, C = window.GAME_CAMPAIGN, LO = window.GAME_LOADOUT;
  let ST = null, tab = 'map', view = 'title', sheetFn = null, sheetTitle = '';
  const MAP_RATIO = 1380 / 752;   // the painted world map (art/world.jpg)
  const REGION = new Proxy({}, { get: (o, r) => (C.REGIONS[r] ? C.REGIONS[r].name : r) });   // territory names live in data/campaign.js
  // Place types: each has its own shape (CSS .t-<type>), colour and icon, and an entry in the map key.
  const ICON = {
    capital: '<path d="M3 18.5h18l-1.6-10-4.6 4.2L12 5l-2.8 7.7-4.6-4.2z"/><rect x="3" y="19.5" width="18" height="2" rx="1"/>',
    castle: '<path d="M4 21V9h2.5V5.5h2.5V9h2V5.5h2V9h2V5.5h2.5V9H20v12h-5.5v-5a2.5 2.5 0 0 0-5 0v5z"/>',
    market: '<path d="M3 9.5 5 4h14l2 5.5a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/><path d="M5 13.5V21h5v-4h4v4h5v-7.5a4.6 4.6 0 0 1-2.5.5A4.6 4.6 0 0 1 12 12.7 4.6 4.6 0 0 1 7.5 14 4.6 4.6 0 0 1 5 13.5z"/>',
    town: '<path d="M1.5 21v-8.5L7 7.5l5.5 5V21z"/><path d="M11.5 21v-10L17 5.5l5.5 5.5v10z" opacity=".75"/>',
    village: '<path d="M4 21v-9.5L12 4.5l8 7V21h-5.5v-5.5h-5V21z"/>',
    hamlet: '<path d="M6 19v-5.5L12 9l6 4.5V19z"/>',
    poi: '<path d="M12 2.5l2.7 6.3 6.8.6-5.2 4.5 1.6 6.6L12 17l-5.9 3.5 1.6-6.6-5.2-4.5 6.8-.6z"/>',
    zone: '<path d="M7.5 2.5 2 12h3.4L2 18.5h11L9.6 12H13zM17 6.5l-4 7h2.4L13 18.5h8.5L19 13.5h2.4z"/><rect x="6.6" y="18.5" width="1.8" height="3"/><rect x="16.4" y="18.5" width="1.6" height="3"/>',
    road: '<rect x="11" y="2" width="2" height="20" rx="1"/><path d="M4 4.5h12.5l3 2.75-3 2.75H4zM20 12H7.5l-3 2.75 3 2.75H20z"/>',
    dungeon: '<path d="M4 21.5V11a8 8 0 0 1 16 0v10.5h-3V12a5 5 0 0 0-10 0v9.5z"/><circle cx="12" cy="15.5" r="1.6"/>',
    sea: '<path d="M2 14c2.5-2.5 5-2.5 7.5 0s5 2.5 7.5 0 4-2 5-1v3c-1-1-2.5-1-5 1s-5 2.5-7.5 0-5-2.5-7.5 0z"/>'
  };
  const typeIcon = t => { const s = h('span', { class: 'ti' }); s.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' + (ICON[t] || ICON.poi) + '</svg>'; return s; };
  const TYPE_KEY = { capital: ['Capital', 'Seat of a power. Oaths, recruits and its best goods.'], castle: ['Castle', 'A fortress or hall. Contract boards; some take oaths.'],
    market: ['Market', 'The widest choice of goods, and a tavern.'], town: ['Town', 'A tavern and a notice board; most have a shop.'], village: ['Village', 'A tavern; some sell a few goods.'],
    hamlet: ['Hamlet', 'A few houses on the road.'], poi: ['Point of interest', 'Shrines, ruins and landmarks. Story scenes and set fights happen here.'],
    zone: ['Wild zone', 'Trouble may find you each time you walk in.'], road: ['Road stop', 'A waypoint, mostly where roads cross a border.'], dungeon: ['Dungeon', 'A run of fights, floor by floor.'] };
  const LABEL_MID = { castle: 1, zone: 1, dungeon: 1 }; // named at middle zoom; capitals always; everything when zoomed in
  const MAJOR = { capital: 1, castle: 1, market: 1, town: 1, zone: 1, dungeon: 1 }; // always named in a region view; the rest when zoomed in
  const SLOT_NAME = { MainHand: 'Main hand', OffHand: 'Off hand', Head: 'Head', Body: 'Body', Accessory: 'Accessory' };
  const SLOTS = ['MainHand', 'OffHand', 'Head', 'Body', 'Accessory'];

  // ---------- tiny DOM helper ----------
  function h(tag, props) {
    const e = document.createElement(tag); props = props || {};
    for (const k of Object.keys(props)) {
      const v = props[k]; if (v === undefined || v === null || v === false) continue;
      if (k === 'class') e.className = v; else if (k === 'style') e.style.cssText = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'text') e.textContent = v; else if (k === 'disabled') e.disabled = !!v; else e.setAttribute(k, v === true ? '' : v);
    }
    for (let i = 2; i < arguments.length; i++) add(e, arguments[i]);
    return e;
  }
  function add(e, c) { if (c === undefined || c === null || c === false) return; if (Array.isArray(c)) c.forEach(x => add(e, x)); else e.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c))); }
  const btn = (text, fn, cls, dis) => h('button', { class: 'sb ' + (cls || ''), onclick: fn, disabled: dis, text });
  const nm = (map, id) => (map[id] && (map[id].name || map[id].n)) || id;
  const cname = id => nm(D.classes, id), fname = id => (D.factions[id] ? D.factions[id].name : id === 'general' ? 'Locals' : id);
  const aname = id => (D.abilities[id] && D.abilities[id].n) || id;
  const iname = id => (D.gear[id] ? D.gear[id].name : id);

  // ---------- styles ----------
  const CSS = `
#shell{position:fixed;inset:0;z-index:40;background:var(--bg);color:var(--ink);display:none;flex-direction:column;align-items:center;font:15px/1.4 system-ui,sans-serif}
#shell.on{display:flex}
#shell .col{width:100%;max-width:480px;height:100%;display:flex;flex-direction:column;position:relative}
#shell *{box-sizing:border-box}
.sh-hud{display:flex;justify-content:space-between;align-items:center;padding:calc(env(safe-area-inset-top) + 8px) 12px 8px;background:var(--panel);border-bottom:1px solid var(--line);gap:8px;font-size:14px}
.sh-hud b{color:var(--gold)}
.sh-main{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch}
.sh-tabs{display:flex;background:var(--panel);border-top:1px solid var(--line);padding-bottom:env(safe-area-inset-bottom)}
.sh-tabs button{flex:1;min-height:52px;background:none;border:0;color:var(--dim);font:600 13px system-ui,sans-serif}
.sh-tabs button.on{color:var(--gold);box-shadow:inset 0 3px 0 var(--gold)}
.sb{min-height:44px;padding:8px 14px;border-radius:10px;border:1px solid var(--line);background:var(--t2);color:var(--ink);font:600 14px system-ui,sans-serif}
.sb.pri{background:var(--gold);color:#241a05;border-color:var(--gold)}
.sb.bad{background:#5a2a24;border-color:var(--foe)}
.sb.sm{min-height:36px;padding:4px 10px;font-size:13px}
.sb.full{width:100%}
.sb:disabled{opacity:.45}
.pad{padding:12px}
.card{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin:0 0 10px}
.card.sel{border-color:var(--gold)}
.row{display:flex;align-items:center;gap:8px}
.grow{flex:1;min-width:0}
.dim{color:var(--dim);font-size:13px}
.gold{color:var(--gold)}
.good{color:var(--ok)}.badc{color:var(--foe)}
.sh-h{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--dim);margin:14px 0 6px}
.bar{height:6px;background:var(--rock);border-radius:3px;overflow:hidden}.bar>i{display:block;height:100%;background:var(--ally)}
.shchip{display:inline-block;padding:1px 8px;border-radius:99px;background:var(--rock);border:1px solid var(--line);font-size:12px;margin:0 4px 4px 0}
.shchip.ok{border-color:var(--ok);color:var(--ok)}
.sh-title{text-align:center;padding:calc(env(safe-area-inset-top) + 40px) 20px 20px}
.sh-title h1{font:700 34px Georgia,serif;letter-spacing:.04em;margin:0 0 4px;color:var(--gold)}
.sh-map{position:relative;overflow:auto;-webkit-overflow-scrolling:touch;background:#0e1a24;touch-action:pan-x pan-y}
.sh-map .n{position:absolute;transform:translate(-50%,-50%) scale(var(--ns,1));width:44px;height:44px;border-radius:50%;border:3px solid var(--line);background:var(--panel);color:var(--ink);font:700 18px system-ui;display:grid;place-items:center;padding:0;cursor:pointer}
.sh-map .n.t-capital{width:56px;height:56px;font-size:26px;border-width:4px}
.sh-map .n.t-castle,.sh-map .n.t-hall{width:48px;height:48px}
.sh-map .n.t-hamlet,.sh-map .n.t-poi,.sh-map .n.t-sea{width:34px;height:34px;font-size:15px}
.sh-map .n.t-village{width:38px;height:38px;font-size:16px}
.sh-map .n.t-zone{border-style:dashed;border-radius:14px;background:rgba(27,42,56,.7)}
.sh-map .n.t-dungeon{border-style:double;border-width:4px;border-radius:6px;background:rgba(58,22,22,.85);color:#ffb0a0}
.sh-map .n.t-sea{background:rgba(40,70,100,.85);border-style:dotted}
.sh-map .lbl.cap{font-weight:700;color:var(--gold)}
.sh-map .lbl.zn{font-style:italic;letter-spacing:1px}
.sh-map .me{position:absolute;width:26px;height:34px;transform:translate(-50%,-112%) scale(max(var(--ns,1),.8));pointer-events:none;z-index:6;transition:left .5s linear,top .5s linear;filter:drop-shadow(0 2px 2px rgba(0,0,0,.7))}
.sh-map .me svg{width:100%;height:100%;overflow:visible}.sh-map .me .lg{transform-origin:50% 0}
.sh-map .me.walk svg{animation:mebob .28s ease-in-out infinite}.sh-map .me.walk .l1{animation:melg .28s ease-in-out infinite}.sh-map .me.walk .l2{animation:melg .28s ease-in-out infinite reverse}
.sh-map .me:not(.walk) svg{animation:meidle 2.4s ease-in-out infinite}
@keyframes mebob{0%,100%{transform:translateY(0) rotate(-3deg)}50%{transform:translateY(-3px) rotate(3deg)}}@keyframes melg{0%,100%{transform:rotate(-26deg)}50%{transform:rotate(26deg)}}@keyframes meidle{0%,100%{transform:translateY(0)}50%{transform:translateY(-1.5px)}}
.rgroup{margin:8px 0}.rhead{display:flex;align-items:center;gap:8px;width:100%;text-align:left;background:var(--panel);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:12px 14px;font:700 15px system-ui;cursor:pointer}.rhead.on{border-color:var(--gold)}
.sh-map .n.cur{box-shadow:0 0 0 4px rgba(226,178,76,.55);border-color:var(--gold)}
.sh-map .n.unk{opacity:.55;width:30px;height:30px;font-size:13px;border-style:dashed;cursor:pointer}
.zc{position:absolute;right:6px;top:6px;display:flex;flex-direction:column;gap:4px;z-index:3}
.zb{width:28px;height:28px;border-radius:8px;border:1px solid var(--line);background:rgba(27,42,56,.82);color:var(--ink);font:700 15px system-ui;display:grid;place-items:center;padding:0}
.sh-map .lbl{position:absolute;transform:translate(-50%,0);font-size:11px;color:#dfe8ee;text-shadow:0 1px 2px #000,0 0 4px #000;white-space:nowrap;pointer-events:none;text-align:center}
.sh-map .bdg{position:absolute;transform:translate(calc(-50% + var(--ns,1) * 22px),calc(-50% - var(--ns,1) * 22px)) scale(max(var(--ns,1),.75));background:var(--foe);color:#fff;font:700 12px system-ui;border-radius:99px;padding:1px 6px;pointer-events:none;box-shadow:0 0 0 2px #0e1620;white-space:nowrap}
.sh-map .bdg.b-zone{transform:translate(calc(-50% + var(--ns,1) * 20px),calc(-50% + var(--ns,1) * 20px)) scale(max(var(--ns,1),.75));background:#3a2a10;color:#ffd27a;border:1px solid #c58a2b}.sh-map .bdg.b-zone.z2{background:#4a2410;color:#ffb070;border-color:#e0702b}.sh-map .bdg.b-zone.z3{background:#4a1414;color:#ff9a8a;border-color:#e04a3a}
.sh-map .bdg.b-scene{background:var(--gold);color:#1a1205}.sh-map .bdg.b-dungeon{background:#5b1f1f;color:#ffd0c0;border:1px solid var(--foe)}
.sh-map .n.w-fight{box-shadow:0 0 0 3px rgba(209,74,74,.85)}.sh-map .n.w-scene{box-shadow:0 0 0 3px rgba(226,176,64,.9)}.sh-map .n.w-dungeon{box-shadow:0 0 0 3px rgba(150,40,40,.95)}.sh-map .n.w-siege{box-shadow:0 0 0 3px rgba(255,90,60,1)}
#sh-sheet{position:absolute;inset:0;background:rgba(0,0,0,.55);display:none;align-items:flex-end;z-index:20}
#sh-sheet.on{display:flex}
#sh-sheet .p{background:var(--bg);border-top:2px solid var(--line);border-radius:16px 16px 0 0;width:100%;max-height:88%;display:flex;flex-direction:column}
#sh-sheet .ph{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid var(--line)}
#sh-sheet .ph h2{margin:0;font-size:17px}
#sh-sheet .pb{overflow-y:auto;padding:12px;padding-bottom:calc(12px + env(safe-area-inset-bottom));-webkit-overflow-scrolling:touch}
.sh-sub{display:flex;gap:6px;margin:0 0 10px;overflow-x:auto}
.sh-sub button{flex:1;min-height:40px;white-space:nowrap}
.sh-sub button.on{background:var(--gold);color:#241a05}
#shell select,#shell input[type=text]{width:100%;min-height:44px;background:var(--rock);color:var(--ink);border:1px solid var(--line);border-radius:10px;padding:6px 10px;font-size:15px}
#sh-toast{position:absolute;left:12px;right:12px;bottom:calc(70px + env(safe-area-inset-bottom));background:#0b1218;border:1px solid var(--gold);border-radius:10px;padding:10px 12px;font-size:14px;display:none;z-index:30;text-align:center}
body.campaign #top .skirm{display:none}
.sh-map .qm{position:absolute;transform:translate(calc(-50% - var(--ns,1) * 22px),calc(-100% - var(--ns,1) * 18px)) scale(max(var(--ns,1),.8));min-width:22px;height:22px;border-radius:11px;padding:0 5px;font:800 13px/22px system-ui;text-align:center;pointer-events:none;z-index:5;box-shadow:0 0 0 2px #0e1620,0 2px 6px rgba(0,0,0,.6)}
.sh-map .qm.q-offer{background:#f2c14e;color:#241a05}.sh-map .qm.q-goal{background:#59c2ff;color:#04121c;animation:qbob 1.2s ease-in-out infinite}.sh-map .qm.q-report{background:#6fd36f;color:#08200a;animation:qbob 1.2s ease-in-out infinite}.sh-map .qm.q-lead{background:#c79cff;color:#1a0a2a}
.sh-map .n.q-ring{box-shadow:0 0 0 4px rgba(89,194,255,.55),0 0 14px rgba(89,194,255,.8)}
@keyframes qbob{0%,100%{margin-top:0}50%{margin-top:-5px}}
.qleg{position:absolute;left:8px;top:8px;display:flex;flex-direction:column;gap:4px;font-size:12px;color:#dfe8ee;background:rgba(14,22,32,.82);border:1px solid var(--line);border-radius:10px;padding:6px 9px;pointer-events:none}.qleg i{display:inline-block;min-width:16px;height:16px;border-radius:8px;font:800 11px/16px system-ui;text-align:center;font-style:normal;margin-right:4px;padding:0 3px}
.qgo{display:flex;gap:6px;align-items:center;margin-top:6px}.qgo .grow{font-size:13px}
.sh-tabs button .dot{display:inline-block;width:8px;height:8px;border-radius:4px;background:var(--foe);margin-left:4px;vertical-align:middle}
.sh-map .n.far{opacity:.8;border-style:dashed}
.sh-map .n.contested{animation:contest 1.1s ease-in-out infinite}@keyframes contest{0%,100%{box-shadow:0 0 0 3px var(--atk)}50%{box-shadow:0 0 0 6px var(--atk),0 0 14px var(--atk)}}
.sh-map .n .ti,.mkey .n .ti{display:grid;place-items:center;width:62%;height:62%;pointer-events:none}.sh-map .n .ti svg,.mkey .n .ti svg{width:100%;height:100%}
.sh-map .n,.mkey .n{box-shadow:0 2px 5px rgba(0,0,0,.55)}
.sh-map .n.t-capital,.mkey .t-capital{width:56px;height:56px;border-radius:50%;border-width:4px;background:radial-gradient(circle at 50% 35%,#6a4b12,#2a1c06);color:#ffd36a;outline:2px solid rgba(255,211,106,.55);outline-offset:2px}
.sh-map .n.t-castle,.mkey .t-castle{width:46px;height:46px;border-radius:9px;background:linear-gradient(#4a5568,#262d39);color:#e4e8ee}
.sh-map .n.t-market,.mkey .t-market{width:42px;height:42px;border-radius:50%;background:#5a3f10;color:#ffcf5c}
.sh-map .n.t-town,.mkey .t-town{width:42px;height:42px;border-radius:50%;background:#1f3550;color:#f3e7c9}
.sh-map .n.t-village,.mkey .t-village{width:36px;height:36px;border-radius:50%;background:#24402a;color:#e8f0d0}
.sh-map .n.t-hamlet,.mkey .t-hamlet{width:28px;height:28px;border-radius:50%;border-width:2px;background:#4a3d2c;color:#e9d9b8}
.sh-map .n.t-poi,.mkey .t-poi{width:32px;height:32px;border-radius:5px;background:#43285a;color:#e7c8ff}
.sh-map .n{border-width:4px}.sh-map .n.t-capital{border-width:6px}
.sh-map .n.t-poi{transform:translate(-50%,-50%) scale(var(--ns,1)) rotate(45deg)}.mkey .t-poi{transform:rotate(45deg)}.sh-map .n.t-poi .ti,.mkey .t-poi .ti{transform:rotate(-45deg)}
.sh-map .n.t-zone,.mkey .t-zone{width:40px;height:40px;border-radius:14px;border-style:dashed;background:rgba(70,40,20,.85);color:#b9e08a}
.sh-map .n.t-road,.mkey .t-road{width:26px;height:26px;border-radius:5px;border-width:2px;background:#3b4048;color:#cfd6de}
.sh-map .n.t-dungeon,.mkey .t-dungeon{width:38px;height:38px;border-radius:4px;border-style:double;border-width:4px;background:#4a1414;color:#ffb0a0}
.mkey .row2{display:flex;align-items:center;gap:12px;padding:6px 0;border-bottom:1px solid var(--line)}.mkey .sw{width:62px;display:grid;place-items:center;flex:none;min-height:46px}
.mkey .n{position:relative;display:grid;place-items:center;border:3px solid #9fb3c2;padding:0;color:var(--ink)}
.mkey .mk{display:inline-grid;place-items:center;min-width:24px;height:22px;border-radius:11px;padding:0 6px;font:800 12px system-ui}
.mhd .sb{white-space:nowrap}
.mhd{display:flex;gap:6px;align-items:center;padding:6px 8px;background:var(--panel);border-bottom:1px solid var(--line);min-width:0}
.mhd .mt{flex:1;min-width:0;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mhd .sb{min-height:30px;padding:4px 10px}
.etab{position:absolute;z-index:3;background:rgba(14,22,32,.78);color:var(--gold);border:1px solid rgba(226,178,76,.7);border-radius:99px;font:600 11px system-ui;padding:6px 9px;min-height:30px;max-width:36%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.etab.e-l{left:6px;transform:translateY(-50%)}.etab.e-r{right:6px;transform:translateY(-50%)}.etab.e-t{top:8px;transform:translateX(-50%)}.etab.e-b{bottom:8px;transform:translateX(-50%)}
.qleg{top:auto!important;bottom:8px}
/* ---- Status and Equip (UI pass phase 2): dark gold-framed panels, full screen, no scrolling ---- */
#stv{position:absolute;inset:0;z-index:15;background:radial-gradient(ellipse at 50% 20%,#1c2530,#0a0f15 75%);color:var(--ink);font:13px/1.3 system-ui,sans-serif;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;--sg:#e2b24c;--sl:rgba(217,178,90,.55);--serif:'Cardo','Palatino Linotype',Palatino,Georgia,serif}
#stv *{box-sizing:border-box}
#stv .dim{color:#9aa3ad}#stv .gold{color:var(--sg)}#stv .bad{color:#e2665a}
.stv-serif{font-family:var(--serif)}
.stv-screen{position:absolute;inset:0;display:flex;flex-direction:column;gap:6px;padding:calc(env(safe-area-inset-top) + 6px) calc(env(safe-area-inset-right) + 6px) calc(env(safe-area-inset-bottom) + 6px) calc(env(safe-area-inset-left) + 6px);max-width:560px;margin:0 auto}
.stv-a,.stv-b,.stv-c{display:flex;flex-direction:column;gap:6px;min-height:0;min-width:0}
.stv-frame{background:rgba(16,24,34,.92);border:1px solid var(--sl);border-radius:6px;box-shadow:inset 0 0 0 3px rgba(12,19,27,.9),inset 0 0 0 4px rgba(217,178,90,.22),0 6px 18px rgba(0,0,0,.45);min-width:0}
.stv-hdr{display:flex;align-items:center;gap:8px;padding:4px 6px 4px 10px;flex:none}
.stv-hdr h1{margin:0;font:700 18px var(--serif);flex:1;display:flex;align-items:baseline;gap:10px;min-width:0;white-space:nowrap}
.stv-who{display:flex;align-items:baseline;gap:6px;min-width:0;padding-left:10px;border-left:1px solid rgba(217,178,90,.35)}.stv-who b{color:var(--sg);overflow:hidden;text-overflow:ellipsis}.stv-who small{font:700 12px var(--serif);color:#9aa3ad;flex:none}
.stv-nav{display:flex;align-items:center;gap:2px;font:600 12px system-ui;color:#9aa3ad}
.stv-arr{background:none;border:0;color:var(--sg);font-size:16px;min-width:34px;min-height:34px;cursor:pointer}
.stv-id{display:flex;gap:9px;padding:8px;flex:none}
.stv-port{width:72px;height:72px;flex:none;image-rendering:pixelated;border:1px solid #000;border-radius:3px;background:#0b1118}
.stv-bars{flex:1;display:flex;flex-direction:column;gap:3px;min-width:0}
.stv-nm{display:flex;align-items:baseline;gap:8px;font:700 20px var(--serif);line-height:1;min-width:0}
.stv-nm span{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.stv-nm small{font:700 13px var(--serif);color:var(--sg);flex:none}
.stv-cl{font-size:11px;color:#9aa3ad;margin:2px 0 3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.stv-cl .sec{color:#8fd0ff}
.stv-bar{display:grid;grid-template-columns:28px 1fr auto;gap:5px;align-items:center;font:700 10px system-ui}
.stv-bar span{font:600 11px system-ui;font-variant-numeric:tabular-nums;min-width:34px;text-align:right}
.stv-bt{position:relative;height:8px;border-radius:2px;background:#0007;overflow:hidden;border:1px solid #0009}
.stv-bt i{position:absolute;inset:0 auto 0 0}
.stv-bt.hp i{background:linear-gradient(#9be08f,#4f9e4a)}.stv-bt.mp i{background:linear-gradient(#8fb6f0,#3d6fb8)}.stv-bt.xp i{background:linear-gradient(#f3d27e,#b88424)}.stv-bt.jp i{background:linear-gradient(#b7e3ff,#4b9fd0)}
.stv-stats{display:grid;grid-template-columns:repeat(3,1fr);padding:3px 0;flex:none}
.stv-stats div{display:flex;justify-content:space-between;gap:4px;padding:3px 9px;font:600 12px system-ui;border-right:1px solid rgba(217,178,90,.15)}
.stv-stats div:nth-child(3n){border-right:0}.stv-stats span{color:#9aa3ad;font-weight:500}.stv-stats b{font-variant-numeric:tabular-nums}
.stv-col{padding:5px 5px 3px;min-height:0;overflow:hidden}
.stv-col h3,.stv-cmp h3{margin:0 0 2px;padding:0 4px 4px;font:700 10px system-ui;letter-spacing:.14em;color:var(--sg);border-bottom:1px solid rgba(217,178,90,.25);display:flex;justify-content:space-between;gap:6px}
.stv-col h3 .dim,.stv-cmp h3 .dim{letter-spacing:0;font-weight:600}
.stv-row{display:flex;align-items:center;gap:7px;padding:3px;border-radius:4px;min-width:0;cursor:pointer}
.stv-row .t{min-width:0;flex:1}
.stv-row .t small{display:block;font:500 9px system-ui;color:#9aa3ad;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.stv-row .t b{display:block;font:600 12px system-ui;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.stv-row .t i{display:block;font:500 10px system-ui;font-style:normal;color:#b9c3cc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.stv-row.sel{background:rgba(217,178,90,.14);box-shadow:inset 0 0 0 1px var(--sg)}
.stv-slot{position:relative;width:38px;height:38px;flex:none;border-radius:5px;background:radial-gradient(circle at 50% 40%,#22344a,#0b1118 75%);border:1px solid var(--tc,#6d6d72);box-shadow:inset 0 0 0 1px #000a;display:grid;place-items:center}
.stv-slot img{width:32px;height:32px;image-rendering:pixelated}
.stv-slot .ii{--s:2;display:block;width:calc(16px*var(--s));height:calc(16px*var(--s));background:url(icons.png) no-repeat;background-size:calc(112px*var(--s)) auto;background-position:calc(var(--c)*-16px*var(--s)) calc(var(--r)*-16px*var(--s));image-rendering:-webkit-optimize-contrast;image-rendering:pixelated}
.stv-slot.big .ii{--s:3}.vic-li .stv-slot .ii{--s:1.5}
.stv-slot>b{font:700 15px var(--serif);color:var(--tc)}
.stv-slot em{position:absolute;right:-1px;bottom:-1px;font:700 8px system-ui;font-style:normal;background:var(--tc);color:#10161d;padding:0 3px;border-radius:3px 0 4px 0}
.stv-slot.empty{border:1px dashed #4a5662;opacity:.7}
.stv-slot.big{width:52px;height:52px}.stv-slot.big img{width:48px;height:48px}
.stv-ic{width:30px;height:30px;flex:none;display:grid;place-items:center;border-radius:5px;background:#0b1118;border:1px solid rgba(217,178,90,.35);font-size:14px}
.stv-ic.k{color:#ffd77a}.stv-ic.s{color:#8fd0ff;border-color:#4b9fd0}.stv-ic.p{color:#c7a6ff;border-color:#8b6fc4}
.stv-help{padding:7px 10px;font-size:11.5px;line-height:1.35;min-height:0;overflow:hidden;flex:1}
.stv-help b.stv-serif{font-size:13px;color:var(--sg)}.stv-desc{margin-top:2px}.stv-hint{margin-top:5px;font-size:10.5px}
.stv-chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:5px}
.stv-chips .more{color:var(--sg);cursor:pointer}
.stv-chips span{font:600 10px system-ui;padding:3px 6px;border-radius:3px;background:#0b1118;border:1px solid #3a4756}
.stv-acts{display:flex;gap:6px;flex:none;margin-top:auto}.stv-acts .sb{flex:1;min-height:40px}
.stv-mini{display:flex;align-items:center;gap:8px;padding:5px 8px;flex:none}.stv-mini .stv-port{width:44px;height:44px}.stv-mini .stv-nm{font-size:17px}.stv-mini .stv-cl{white-space:normal;margin:2px 0 0}
.stv-strip{display:flex;justify-content:space-around;padding:5px 3px;flex:none}
.stv-strip button{display:flex;flex-direction:column;align-items:center;gap:3px;padding:3px 4px;border-radius:5px;background:none;border:0;color:inherit;cursor:pointer;min-width:0}
.stv-strip small{font:600 9px system-ui;color:#9aa3ad;text-transform:uppercase;white-space:nowrap}
.stv-strip .on{background:rgba(217,178,90,.14);box-shadow:inset 0 0 0 1px var(--sg)}.stv-strip .on small{color:var(--sg)}
.stv-e{font:700 9px system-ui;color:#10161d;background:var(--sg);border-radius:3px;padding:1px 4px}
.stv-list{flex:1}
.stv-cmp{padding:5px 8px;flex:none}
.stv-cg{display:grid;grid-template-columns:1fr 1fr;gap:0 14px}
.stv-cg div{display:flex;justify-content:space-between;gap:4px;font:600 11.5px system-ui;padding:2px 0;border-bottom:1px solid rgba(255,255,255,.04)}
.stv-cg span{color:#9aa3ad;font-weight:500}.stv-cg .up{color:#7fd07a}.stv-cg .dn{color:#e2665a}
.stv-cg .up::after{content:' ▲';font-size:8px}.stv-cg .dn::after{content:' ▼';font-size:8px}
.stv-warn{margin-top:4px;font:500 10.5px system-ui;color:#f0c46a}
.stv-det{position:absolute;inset:0;z-index:5;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px}
.stv-detb{width:100%;max-width:420px;max-height:100%;overflow:auto;padding:12px 14px;display:flex;flex-direction:column;gap:6px;font-size:13px;line-height:1.4;-webkit-user-select:text;user-select:text}
.stv-detb b.stv-serif{font-size:17px;color:var(--sg)}
.stv-dh{display:flex;gap:10px;align-items:center}
.stv-kit{display:flex;flex-direction:column;gap:5px}.stv-kit .no{opacity:.55}
.stv-close{display:flex;justify-content:flex-end}
/* ---- Class tree (UI pass phase 3) ---- */
.stv-classes .stv-a{flex:1}.stv-classes .stv-c{flex:none}
.stv-treef{flex:1;display:flex;flex-direction:column;padding:4px 6px 3px;min-height:0}
.stv-tree{position:relative;flex:1;display:flex;flex-direction:column;gap:2px;min-height:0}
.stv-tier{display:flex;flex-direction:column;min-height:0;flex:1 1 13px}.stv-tier.t2,.stv-tier.t3{flex-grow:3}
.stv-tier .tl{height:13px;font:700 9px/11px system-ui;letter-spacing:.16em;color:var(--sg);padding:1px 2px;border-bottom:1px solid rgba(217,178,90,.2);flex:none}
.stv-tier .g{flex:1;display:grid;grid-template-columns:repeat(6,1fr);grid-auto-rows:1fr;min-height:0}
.stv-tier.t1 .g{grid-template-columns:repeat(4,1fr);padding:0 16.6%}
.stv-cc{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:1px;padding:0 1px 1px;border:0;border-radius:5px;background:none;color:inherit;cursor:pointer;min-width:0;min-height:0;z-index:1}
.stv-cc .ped{position:relative;display:grid;place-items:center;width:100%;flex:1;min-height:0}
.stv-cc .ped::after{content:'';position:absolute;left:50%;bottom:1px;width:min(36px,80%);height:8px;transform:translateX(-50%);border-radius:50%;background:radial-gradient(#3b4a5c,#1b2430 70%);box-shadow:0 0 0 1px #000a;z-index:-1}
.stv-spr{display:block;width:var(--sz,32px);height:var(--sz,32px);background-size:400% 2000%;background-position:0 0;background-repeat:no-repeat;image-rendering:pixelated}
.stv-spr.gai{transform:scale(1.4);transform-origin:50% 88%}
.stv-cc .ped{container-type:size}.stv-cc .stv-spr{--sz:min(36px,100cqh,100cqw)}
.stv-cc .n{font:600 9px system-ui;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;line-height:1.1}
.stv-cc .p{width:70%;height:3px;border-radius:2px;background:#0008;overflow:hidden;flex:none}.stv-cc .p i{display:block;height:100%;background:linear-gradient(90deg,#b7e3ff,#4b9fd0)}
.stv-cc .p:empty{background:none}
.stv-cc.lock .stv-spr,.stv-cdh .big.lock .stv-spr{filter:brightness(.12) saturate(0) drop-shadow(0 0 1px #7a8796)}
.stv-cc.lock .n{color:#8b96a1}.stv-cc.unk .n{color:#5d6873;letter-spacing:.1em}
.stv-cc.pri .ped::after{background:radial-gradient(#ffe39a,#b88424 70%);box-shadow:0 0 8px #e2b24c}
.stv-cc.sec .ped::after{background:radial-gradient(#cdeeff,#3d82b8 70%);box-shadow:0 0 8px #4b9fd0}
.stv-cc.sel{background:rgba(217,178,90,.14);box-shadow:inset 0 0 0 1px var(--sg)}
.stv-cc .tag{position:absolute;left:2px;top:1px;font:800 8px system-ui;background:var(--sg);color:#10161d;border-radius:2px;padding:0 3px}.stv-cc .tag.s{background:#8fd0ff}
.stv-cc .star{position:absolute;right:2px;top:0;font-size:10px;color:#ffd77a;text-shadow:0 0 3px #000}
.stv-lines{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:0;overflow:visible}
.stv-lines polyline{fill:none;stroke:#e2b24c;stroke-width:2;stroke-linejoin:round;filter:drop-shadow(0 0 2px rgba(226,178,76,.6))}
.stv-lines polyline.todo{stroke-dasharray:4 3;opacity:.8}
.stv-legend{display:flex;flex-wrap:wrap;gap:3px 10px;justify-content:center;font:500 9.5px system-ui;color:#9aa3ad;padding-top:3px;flex:none}
.stv-legend span{display:flex;align-items:center;gap:3px}.stv-legend b{width:10px;height:5px;border-radius:50%;background:#e2b24c}.stv-legend b.sec{background:#4b9fd0}.stv-legend .unk{letter-spacing:.06em}
.stv-cdet{padding:7px 9px;display:flex;flex-direction:column;gap:5px;font-size:11.5px;line-height:1.35}
.stv-cdh{display:flex;gap:9px;align-items:center}.stv-cdh b.stv-serif{font-size:17px;color:var(--sg)}
.stv-cdh .big{width:52px;height:52px;flex:none;display:grid;place-items:center;border-radius:5px;background:radial-gradient(circle at 50% 70%,#2a3a4e,#0b1118 75%);border:1px solid var(--sl)}.stv-cdh .big .stv-spr{--sz:48px}
.stv-req{display:grid;grid-template-columns:auto 1fr auto;gap:3px 8px;align-items:center;font:600 11px system-ui}
.stv-pips{display:flex;gap:2px;flex-wrap:wrap}.stv-pips i{width:7px;height:7px;border-radius:2px;background:#0b1118;border:1px solid #3a4756}.stv-pips i.on{background:#8fd0ff;border-color:#4b9fd0}
.stv-blurb{color:#c9d1d8}
.stv-cdet .stv-acts{margin-top:2px}.stv-cdet .stv-acts .sb{white-space:normal!important;line-height:1.1;padding-left:4px!important;padding-right:4px!important;min-width:0}
.stv-pen{font-style:normal;font-size:12px;color:#9aa3ad;margin-left:auto}
.stv-nm[role=button]{cursor:pointer}
@media (orientation:portrait){.stv-cdet{max-height:44vh;overflow:hidden}}
@media (orientation:landscape){
  .stv-classes .stv-screen{display:grid;grid-template-columns:1fr 240px;grid-template-rows:auto 1fr}
  .stv-classes .stv-c{min-height:0}.stv-classes .stv-cdet{flex:1;overflow:hidden}
  .stv-tree{flex-direction:row;gap:6px}
  .stv-tier{flex:none!important}.stv-tier.t1{width:11%}.stv-tier.t2,.stv-tier.t3{flex:1!important}
  .stv-tier .g{grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(4,1fr)}
  .stv-tier.t1 .g{grid-template-columns:1fr;padding:0}
  .stv-legend{gap:2px 8px;font-size:9px}
}
/* ---- Victory (UI pass phase 4) ---- */
#vic{position:absolute;inset:0;z-index:14;background:radial-gradient(ellipse at 50% 0%,#2a2414,#0a0f15 70%);color:var(--ink);font:13px/1.3 system-ui,sans-serif;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;--sg:#e2b24c;--sl:rgba(217,178,90,.55);--serif:'Cardo','Palatino Linotype',Palatino,Georgia,serif}
#vic.lost{background:radial-gradient(ellipse at 50% 0%,#2a1616,#0a0f15 70%)}
#vic *{box-sizing:border-box}#vic .dim{color:#9aa3ad}
.vic-screen{position:absolute;inset:0;display:flex;flex-direction:column;gap:6px;padding:calc(env(safe-area-inset-top) + 8px) calc(env(safe-area-inset-right) + 8px) calc(env(safe-area-inset-bottom) + 8px) calc(env(safe-area-inset-left) + 8px);max-width:560px;margin:0 auto}
.vic-l,.vic-r{display:flex;flex-direction:column;gap:6px;min-height:0;min-width:0}.vic-r{flex:1}
.vic-ban{text-align:center;flex:none;padding:2px 0 4px}
.vic-ban h1{margin:0;font:700 23px/1.1 var(--serif);letter-spacing:.08em;text-transform:uppercase;color:#f3d27e;text-shadow:0 2px 0 #000,0 0 14px rgba(226,178,76,.45)}
.vic-ban h1::before,.vic-ban h1::after{content:'❖';font-size:.7em;margin:0 .4em;vertical-align:.12em;color:var(--sg)}
#vic.lost .vic-ban h1{color:#e8a49a;text-shadow:0 2px 0 #000,0 0 14px rgba(226,102,90,.45)}#vic.lost .vic-ban h1::before,#vic.lost .vic-ban h1::after{color:#c0574c}
.vic-tag{font:italic 600 15px var(--serif);color:var(--sg);margin:1px 0}#vic.lost .vic-tag{color:#e2665a}
.vic-ban .dim{font-size:11px}.vic-lead{font-size:11px;color:#e8c8a0;margin-top:2px}
.vic-top{display:grid;grid-template-columns:1.6fr 1fr;gap:6px;flex:none}
.vic-sp,.vic-best,.vic-co,.vic-rf{padding:5px 7px 6px;min-height:0;overflow:hidden}
#vic h3{margin:0 0 4px;padding:0 2px 3px;font:700 9.5px system-ui;letter-spacing:.16em;color:var(--sg);border-bottom:1px solid rgba(217,178,90,.25);text-align:center;display:block}
.vic-li{display:flex;align-items:center;gap:7px;padding:2px 0;min-width:0}.vic-li b{font:600 12px system-ui;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vic-li .stv-slot{width:28px;height:28px}.vic-li .stv-slot img{width:24px;height:24px}.vic-coin{--tc:#e2b24c}.vic-coin b{font-size:14px!important}
.vic-sp .vic-li:nth-of-type(n+5){display:none}
.vic-none{text-align:center;padding:8px 0}
.vic-best{display:flex;flex-direction:column;align-items:center;text-align:center;gap:2px}.vic-best h3{align-self:stretch}
.vic-bp{width:52px;height:52px;image-rendering:pixelated;border:1px solid #000;border-radius:3px;background:#0b1118}.vic-best b{font-size:15px;color:var(--ink)}.vic-best .dim{font-size:10px}
.vic-co{flex:1;display:flex;flex-direction:column}
.vic-rows{flex:1;display:grid;grid-auto-rows:auto;gap:2px;min-height:0;align-content:space-evenly}
.vic-u{display:flex;gap:8px;align-items:center;min-height:0;min-width:0;padding:2px;border-radius:4px;cursor:pointer;max-height:62px}
.vic-p{width:42px;height:42px;flex:none;image-rendering:pixelated;border:1px solid #000;border-radius:3px;background:#0b1118;display:grid;place-items:center}
.vic-ut{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.vic-un{display:flex;align-items:baseline;gap:6px;min-width:0;white-space:nowrap}.vic-un b{font-size:14px}.vic-un .dim{font-size:11px;overflow:hidden;text-overflow:ellipsis;min-width:0}
.vic-un .xp{margin-left:auto;font:700 11px system-ui;color:var(--sg);flex:none}
.vic-lv{font:800 9px system-ui;font-style:normal;background:var(--sg);color:#10161d;border-radius:3px;padding:1px 5px;flex:none;animation:vicpulse 1.2s ease-in-out 3}
@keyframes vicpulse{50%{box-shadow:0 0 10px #ffd77a}}
.vic-bar{position:relative;height:6px;border-radius:2px;background:#0008;border:1px solid #0009;overflow:hidden}
.vic-bar i{position:absolute;top:0;bottom:0;left:0}.vic-bar .old{background:#9b7424}.vic-bar .gain{background:linear-gradient(90deg,#f3d27e,#fff1c4);transition:width 1.1s cubic-bezier(.2,.7,.2,1) .25s}
.vic-sub{display:flex;gap:4px 10px;font:500 10.5px system-ui;white-space:nowrap;overflow:hidden}.vic-sub span{font-size:10.5px!important}.vic-sub .jp{color:#8fd0ff}.vic-sub .new{color:#9be08f;overflow:hidden;text-overflow:ellipsis}
.vic-foot{display:flex;flex-direction:column;gap:6px;flex:none}.vic-bench{text-align:center;font-size:11px}
.vic-foot .sb{min-height:44px}.vic-go{font-weight:700}
.vic-rep .vic-foot{flex-direction:row}.vic-rep .vic-foot .sb{flex:1}
.vic-rf{flex:1;display:flex;flex-direction:column}.vic-rl{flex:1;overflow:auto;display:flex;flex-direction:column;gap:6px}
.vic-rl .card{margin:0}
#vic.n5 .vic-rows,#vic.n6 .vic-rows{grid-template-columns:1fr 1fr;gap:4px 8px}
#vic.n5 .vic-sub,#vic.n6 .vic-sub{flex-direction:column;gap:0}#vic.n5 .vic-p,#vic.n6 .vic-p{width:34px;height:34px}
@media (orientation:landscape){
  .vic-screen{max-width:none;display:grid;grid-template-columns:minmax(250px,.85fr) 1.15fr;grid-template-rows:auto 1fr;gap:6px 8px;padding-top:calc(env(safe-area-inset-top) + 4px);padding-bottom:calc(env(safe-area-inset-bottom) + 4px)}
  .vic-ban{grid-column:1/-1;padding:0}.vic-ban h1{font-size:20px}.vic-tag{font-size:13px;display:inline;margin-right:8px}.vic-ban .dim{display:inline}
  .vic-l .vic-top{grid-template-columns:1fr;grid-template-rows:auto auto;flex:1}
  .vic-best{display:grid;grid-template-columns:auto 1fr;grid-template-areas:"h h" "p n" "p d";text-align:left;gap:0 8px;align-items:center}.vic-best h3{grid-area:h}.vic-best .vic-bp{grid-area:p;width:44px;height:44px}.vic-best b{grid-area:n;align-self:end}.vic-best .dim{grid-area:d;align-self:start}.vic-best{align-content:start}
  .vic-sp .vic-li:nth-of-type(n+4){display:none}
  .vic-u{max-height:54px}.vic-p{width:36px;height:36px}
  #vic.n4 .vic-rows,#vic.n5 .vic-rows,#vic.n6 .vic-rows{grid-template-columns:1fr 1fr;gap:2px 8px}
  #vic.n4 .vic-sub{flex-direction:column;gap:0}
  .vic-rep{grid-template-columns:1fr}.vic-rep .vic-rf{grid-column:1/-1}.vic-rep .vic-foot{grid-column:1/-1}
}
/* equip, portrait: the slot list is replaced by the strip */
.stv-equip .stv-eq{display:none}
.stv-equip .stv-a{flex:none}.stv-equip .stv-b{flex:1}
.stv-status .stv-screen{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:auto auto auto auto minmax(60px,1fr) auto;grid-template-areas:"h h" "id id" "st st" "eq ab" "help help" "acts acts"}
.stv-status .stv-a,.stv-status .stv-b,.stv-status .stv-c{display:contents}
.stv-status .stv-hdr{grid-area:h}.stv-status .stv-id{grid-area:id}.stv-status .stv-stats{grid-area:st}.stv-status .stv-eq{grid-area:eq}.stv-status .stv-ab{grid-area:ab}.stv-status .stv-help{grid-area:help}.stv-status .stv-acts{grid-area:acts}
@media (orientation:landscape){
  .stv-screen{max-width:none;gap:5px;padding-top:calc(env(safe-area-inset-top) + 4px);padding-bottom:calc(env(safe-area-inset-bottom) + 4px)}
  .stv-status .stv-screen,.stv-equip .stv-screen{display:grid;grid-template-columns:minmax(230px,.9fr) 1fr 1fr;grid-template-rows:auto 1fr;grid-template-areas:none}
  .stv-status .stv-a,.stv-status .stv-b,.stv-status .stv-c{display:flex}
  .stv-hdr{grid-column:1/-1;padding:2px 6px 2px 10px}
  .stv-status .stv-hdr,.stv-status .stv-id,.stv-status .stv-stats,.stv-status .stv-eq,.stv-status .stv-ab,.stv-status .stv-help{grid-area:auto}
  .stv-status .stv-hdr{grid-column:1/-1}
  .stv-acts .sb{white-space:nowrap;padding-left:6px;padding-right:6px}
  .stv-id{padding:6px}.stv-port{width:58px;height:58px}
  .stv-stats div{padding:2px 7px;font-size:11px}
  .stv-row{padding:2px 3px}.stv-slot{width:34px;height:34px}
  .stv-ab .stv-row .t i{display:none}.stv-ab .stv-ic{width:24px;height:24px;font-size:12px}
  .stv-acts .sb{min-height:34px}
  .stv-equip .stv-eq{display:block}.stv-equip .stv-strip,.stv-equip .stv-mini{display:none}
  .stv-equip .stv-screen{grid-template-columns:minmax(220px,.9fr) 1.1fr minmax(220px,.9fr)}
  .stv-cg{grid-template-columns:1fr}
}
`;

  // ---------- state helpers ----------
  const toastEl = () => document.getElementById('sh-toast');
  let toastT = null;
  function toast(msg, bad) { const t = toastEl(); if (!t) return; t.textContent = msg; t.style.borderColor = bad ? 'var(--foe)' : 'var(--gold)'; t.style.display = 'block'; clearTimeout(toastT); toastT = setTimeout(() => { t.style.display = 'none'; }, 2800); }
  function autosave() { try { S.saveSlot('auto', ST); } catch (e) { /* storage may be blocked; play on */ } }
  const unit = id => ST.roster.find(u => u.id === id);
  // Everyone at home (not away) is available to deploy, last fight's squad first. There is no separate battle party to manage: you pick who goes on the deployment screen.
  const homeUnits = () => { const home = ST.roster.filter(u => !S.isAway(ST, u.id)), at = u => { const i = ST.party.indexOf(u.id); return i < 0 ? 999 : i; }; return home.map((u, i) => [u, i]).sort((a, b) => at(a[0]) - at(b[0]) || a[1] - b[1]).map(x => x[0]); };
  const loc = () => C.NODES[ST.world.location];
  const tierName = f => S.standingTier(ST, f).name;
  const fmtStand = f => { const n = S.getStanding(ST, f); return (n > 0 ? '+' : '') + n; };

  // ---------- mount ----------
  function mount() {
    const style = h('style', { text: CSS }); document.head.appendChild(style);
    const root = h('div', { id: 'shell', class: 'on' }, h('div', { class: 'col', id: 'sh-col' }));
    document.body.appendChild(root);
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
    render();
  }
  function col() { return document.getElementById('sh-col'); }
  function showShell(on) { document.getElementById('shell').classList.toggle('on', on); document.body.classList.toggle('campaign', on || !!window.__campaignBattle); }

  function render() {
    if (SV) setTimeout(drawStatus, 0);
    const c = col(); c.innerHTML = '';
    if (view === 'game') { const ln = C.takeLoreNews(ST); if (ln.length) setTimeout(() => toast(ln.slice(0, 2).map(x => x.text).join(' \u00b7 ')), 80); }
    if (view === 'title') return titleScreen(c);
    if (view === 'new') return newScreen(c);
    // in game
    c.appendChild(h('div', { class: 'sh-hud' },
      h('span', {}, 'Day ', h('b', { text: ST.world.day }), ' · ', h('span', { class: 'dim', text: C.calendar(ST.world.day).season.name + (C.calendar(ST.world.day).festival ? ' · ' + C.calendar(ST.world.day).festival : '') + ' · ' + (loc() ? loc().name : '') })),
      h('span', {}, h('b', { text: ST.inventory.gold + ' g' }))));
    const main = h('div', { class: 'sh-main', id: 'sh-main' });
    c.appendChild(main);
    if (tab === 'map') mapScreen(main); else if (tab === 'party') partyScreen(main); else if (tab === 'quests') journalScreen(main); else if (tab === 'factions') factionScreen(main); else menuScreen(main);
    c.appendChild(h('div', { class: 'sh-tabs' }, ['map|Map', 'party|Roster', 'quests|Journal', 'factions|Factions', 'menu|Menu'].map(t => { const [k, l] = t.split('|'); const dot = (k === 'factions' && attention()) || (k === 'quests' && journalAttention()); return h('button', { class: tab === k ? 'on' : '', onclick: () => { tab = k; render(); } }, l, dot ? h('span', { class: 'dot' }) : null); })));
    c.appendChild(h('div', { id: 'sh-sheet', onclick: e => { if (e.target.id === 'sh-sheet') userClose(); } }));
    c.appendChild(h('div', { id: 'sh-toast' }));
    if (sheetFn) refreshSheet();
  }

  // ---------- sheets (bottom panels) ----------
  // guided first week: finished steps queue a 'Word on the road' sheet that opens as soon as no other sheet is up
  let guideQ = [];
  function tierCheck() { // one-time nudge: the leader is one level short of the next fight size, so make sure there are enough people to fill it
    const lead = ST.roster[0]; if (!lead) return []; const nx = S.RULES.fightTiers.find(t => t[0] > lead.level); if (!nx || lead.level < nx[0] - 1) return [];
    const k = 'g_tier_' + nx[0]; if (ST.world.flags[k]) return []; ST.world.flags[k] = 1;
    const home = ST.roster.filter(u => !S.isAway(ST, u.id)).length; if (home >= nx[1]) return [];
    return [{ plain: 1, title: 'Level ' + nx[0] + ' is close', talk: 'From level ' + nx[0] + ' your leader takes bigger fights: ' + nx[1] + ' to a side. You have ' + home + ' at home, so recruit ' + (nx[1] - home) + ' more soon. Halls and markets that take recruits are marked on the map (' + S.recruitCost(ST) + ' g each), and new hires start at level 1 and catch up on the bench.' }]; }
  function guideCheck() { const r = C.guideCheck(ST).concat(tierCheck()); if (r.length) { guideQ = guideQ.concat(r); autosave(); setTimeout(guideFlush, 50); } }
  function guideFlush() { if (!guideQ.length || sheetFn || view !== 'game') return; const r = guideQ; guideQ = []; render();
    sheet(r.every(x => x.plain) ? 'Word of advice' : 'Word on the road', () => [r.map(x => h('div', { class: 'card' }, h('b', { text: x.title + (x.plain ? '' : ' \u2713') }), h('p', { text: x.talk }), x.purse ? h('div', { class: 'good', text: '+' + x.purse + ' g' }) : null)), btn('Onward', closeSheet, 'pri full')]); }
  // A forced sheet is a road stop (a fight, toll, checkpoint, obstacle or road choice) and what comes after it: no Close button, and tapping outside does nothing.
  // If nothing on it can be pressed (every choice costs gold you lack) it can be closed, so a player is never stuck.
  let sheetForced = false;
  const forcedSheet = (t, f) => sheet(t, f, true);
  function sheet(title, fn, forced) { sheetTitle = title; sheetFn = fn; sheetForced = !!forced; refreshSheet(); }
  function userClose() { if (sheetForced && sheetFn && document.querySelector('#sh-sheet .pb button:not([disabled])')) { toast('Settle this first'); return; } closeSheet(); }
  function refreshSheet() {
    const s = document.getElementById('sh-sheet'); if (!s) return;
    if (!sheetFn) { s.classList.remove('on'); s.innerHTML = ''; return; }
    const prev = s.querySelector('.pb'), top = prev ? prev.scrollTop : 0;
    s.innerHTML = ''; const body = h('div', { class: 'pb' });
    const head = h('div', { class: 'ph' }, h('h2', { text: sheetTitle }), btn('Close', userClose, 'sm'));
    s.appendChild(h('div', { class: 'p' }, head, body));
    add(body, sheetFn()); s.classList.add('on'); body.scrollTop = top;
    if (sheetForced && body.querySelector('button:not([disabled])')) head.lastChild.style.display = 'none';
  }
  function closeSheet() { sheetFn = null; refreshSheet(); if (guideQ.length) setTimeout(guideFlush, 50); }

  // ---------- title ----------
  function titleScreen(c) {
    const slots = S.listSlots().filter(s => !s.empty && !s.error);
    const wrap = h('div', { class: 'sh-main' },
      h('div', { class: 'sh-title' }, h('h1', { text: 'Call of Calamity' }), h('div', { class: 'dim', text: 'A tactics campaign across the Realm of Aethelgard' })),
      h('div', { class: 'pad' },
        slots.length ? [h('div', { class: 'sh-h', text: 'Continue' }), slots.sort((a, b) => b.updated - a.updated).map(s => h('div', { class: 'card' },
          h('div', { class: 'row' }, h('div', { class: 'grow' }, h('b', { text: s.name }), h('div', { class: 'dim', text: (D.races[s.race] ? D.races[s.race].name : '') + ' · day ' + s.day + ' · party ' + s.party + ' · ' + (s.slot === 'auto' || s.slot === undefined ? '' : 'slot ' + s.slot) + (s.slot ? '' : '') + (s.warning ? ' · ' + s.warning : '') }),
            h('div', { class: 'dim', text: new Date(s.updated).toLocaleString() })), btn('Load', () => loadSlot(s.slot), 'pri sm'))))] : null,
        h('div', { class: 'sh-h', text: 'Play' }),
        btn('New campaign', () => { view = 'new'; render(); }, 'pri full'), h('div', { style: 'height:8px' }),
        btn('Skirmish (battle prototype)', skirmish, 'full'), h('div', { style: 'height:8px' }),
        btn('Balance simulator', openSim, 'full'), h('div', { style: 'height:8px' }),
        btn('Import a save file', importFile, 'full')));
    c.appendChild(wrap);
  }
  function openSim() { let w = null; try { w = window.open('sim.html', '_blank'); } catch (e) { w = null; } if (!w) location.href = 'sim.html'; } // the headless balance simulator (sim.html), same folder as this page
  function skirmish() { showShell(false); document.body.classList.remove('campaign'); if (window.showSetup) window.showSetup(); }
  function loadSlot(slot) {
    const r = S.loadSlot(slot); if (!r.ok) { toast('Could not load: ' + (r.error || 'unknown error'), true); return; }
    ST = C.fixLocation(r.state); C.activeWander(ST); view = 'game'; tab = 'map'; sheetFn = null; document.body.classList.add('campaign'); render(); if (r.fixes && r.fixes.length) toast('Save repaired a few values'); }
  // Some browsers (phones, embedded views) cannot download files: copy the save text out and paste it back in instead.
  function copySave() {
    const text = S.exportString(ST), fallback = () => sheet('Your save', () => [h('div', { class: 'dim', text: 'Select all and copy this text. Keep it somewhere safe.' }), h('textarea', { id: 'sh-savetxt', readonly: 'readonly', rows: 8, style: 'width:100%', text, onfocus: e => e.target.select() }), btn('Close', closeSheet, 'full')]);
    try { navigator.clipboard.writeText(text).then(() => toast('Save copied. Paste it somewhere safe.'), fallback); } catch (e) { fallback(); }
  }
  function pasteSave() {
    sheet('Paste a save', () => [h('div', { class: 'dim', text: 'Paste save text copied from Menu > Copy save.' }), h('textarea', { id: 'sh-pastetxt', rows: 8, style: 'width:100%', placeholder: 'Paste here' }),
      btn('Import', () => { const t = document.getElementById('sh-pastetxt').value; const r = S.importString(t); if (!r.ok) { toast('Import failed: ' + (r.error || 'not a save'), true); return; } ST = C.fixLocation(r.state); view = 'game'; tab = 'map'; sheetFn = null; document.body.classList.add('campaign'); autosave(); render(); toast('Save imported'); }, 'pri full')]);
  }
  function importFile() {
    const i = h('input', { type: 'file', accept: '.json,.txt,application/json', style: 'display:none' });
    i.addEventListener('change', () => { const f = i.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { const r = S.importString(String(rd.result)); if (!r.ok) { toast('Import failed: ' + (r.error || 'bad file'), true); return; } ST = C.fixLocation(r.state); view = 'game'; tab = 'map'; document.body.classList.add('campaign'); autosave(); render(); }; rd.readAsText(f); });
    document.body.appendChild(i); i.click(); setTimeout(() => i.remove(), 4000);
  }

  // ---------- new game ----------
  let newRace = null, newName = '', newClass = null;
  function newScreen(c) {
    const opts = C.startOptions(); if (!newRace) newRace = opts[0].race;
    const cur = opts.find(o => o.race === newRace), T = C.STARTS[newRace], R = D.races[newRace];
    const entry = Object.keys(D.classes).filter(id => D.classes[id].tier === 1 && D.classes[id].selectable !== false);
    if (!newClass || !entry.includes(newClass)) newClass = T.recruits[0].primary;
    const input = h('input', { type: 'text', maxlength: 16, placeholder: R.names[0], value: newName, oninput: e => { newName = e.target.value; } });
    const dice = () => { const pool = R.names.filter(n => n !== newName); newName = pool[Math.floor(Math.random() * pool.length)] || R.names[0]; render(); };
    const main = h('div', { class: 'sh-main pad' },
      h('div', { class: 'row', style: 'margin-bottom:8px' }, btn('Back', () => { view = 'title'; render(); }, 'sm'), h('h2', { style: 'margin:0', text: 'New campaign' })),
      h('div', { class: 'sh-h', text: 'Your name' }), h('div', { class: 'row' }, h('div', { class: 'grow' }, input), btn('Random', dice, 'sm')),
      h('div', { class: 'sh-h', text: 'Your people' }),
      opts.map(o => h('div', { class: 'card' + (o.race === newRace ? ' sel' : ''), onclick: () => { newRace = o.race; newClass = null; render(); } },
        h('b', { text: o.name }), h('div', { class: 'dim', text: o.desc }),
        (o.race === 'dwarf' || o.race === 'wood_elf') ? h('div', { style: 'margin-top:4px;color:var(--gold)', text: 'Work in progress: this people\u2019s story and content are not complete yet.' }) : null,
        h('div', { style: 'margin-top:6px' }, C.traitLines(o.race).map(t => h('span', { class: 'shchip ok', text: t }))),
        h('div', { class: 'dim', style: 'margin-top:4px', text: 'Starts at ' + C.NODES[o.location].name }))),
      h('div', { class: 'sh-h', text: 'Your calling' }),
      h('div', { class: 'dim', text: 'You begin as this class. Your two companions are fixed for now, and anyone can change class later.' }),
      entry.map(id => { const k = D.classes[id]; return h('div', { class: 'card' + (id === newClass ? ' sel' : ''), onclick: () => { newClass = id; render(); } }, h('b', { text: k.name }), h('span', { class: 'dim', text: '  ' + k.role }), h('div', { class: 'dim', text: k.signature })); }),
      h('div', { class: 'card' }, h('div', { class: 'dim', style: 'white-space:pre-line', text: cur.opening }),
        h('div', { class: 'sh-h', text: 'Starting standing' }), (Object.values(T.standing).some(n => n) ? Object.entries(T.standing).filter(([f, n]) => n) : [['', 0]]).map(([f, n]) => !f ? h('span', { class: 'shchip', text: 'No ties yet' }) : h('span', { class: 'shchip', text: fname(f) + ' ' + (n > 0 ? '+' : '') + n }))),
      btn('Begin', () => {
        const nameVal = (newName || '').trim() || R.names[0];
        ST = C.newGame({ race: newRace, name: nameVal, heroClass: newClass });
        ST.player.name = nameVal; ST.meta.name = nameVal + ' · ' + R.name;
        view = 'game'; tab = 'map'; sheetFn = null; document.body.classList.add('campaign'); autosave(); render();
        if (!playScene('opening_' + newRace)) sheet('Your story begins', () => [h('p', { style: 'white-space:pre-line', text: ST.world.flags.opening }), btn('Onward', closeSheet, 'pri full')]);
      }, 'pri full'));
    c.appendChild(main);
  }

  // ---------- world map ----------
  function pathTo(from, to) {
    const seen = { [from]: null }, q = [from];
    while (q.length) { const x = q.shift(); if (x === to) break; for (const [y] of Object.entries(C.NODES[x].links)) if (!(y in seen) && (C.isDiscovered(ST, y) || y === to)) { seen[y] = x; q.push(y); } }
    if (!(to in seen)) return null; const p = []; for (let x = to; x !== from; x = seen[x]) p.unshift(x); return p;
  }
  const pathDays = (from, p) => { let d = 0, a = from; p.forEach(b => { d += C.travelCost(a, b); a = b; }); return d; };
  function ownerColor(id) { const o = C.ownerOf(ST, id); return o && D.factions[o] ? D.factions[o].color : o === 'player' ? '#e2b24c' : (C.OWNERLESS[o] || {}).color || '#4a5a68'; }
  // ---- owner colours on the land (design/node_ownership_and_land.md, section 8): each spot on the map takes the colour of the nearest
  //      place that has one. Unclaimed ground, dungeons and hidden places leave the art bare, and so does anything far from every place
  //      (open sea, the empty Desolation). Drawn once at world scale and redrawn only when an owner changes. ----
  const ownerField = { key: null, url: null, builds: 0 };
  function ownerFieldUrl() {
    const ids = Object.keys(C.NODES).filter(id => !C.NODES[id].hidden && !C.NODES[id].dungeon), key = ids.map(id => C.ownerOf(ST, id)).join();
    if (ownerField.key === key) return ownerField.url;
    if (typeof document === 'undefined' || !document.createElement) return null;
    const FW = 345, FH = 188, AX = 1380, AY = 752, maxD = 0.07 * AX, cv = document.createElement('canvas'); cv.width = FW; cv.height = FH;
    const g = cv.getContext('2d'); if (!g) return null; const img = g.createImageData(FW, FH), P = [], cols = [];
    const rgb = hex => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return null; const v = parseInt(m[1], 16); return [v >> 16, (v >> 8) & 255, v & 255]; };
    const oi = {}, byOwner = [];   // one colour per owner, so borders fall only where the owner changes
    ids.forEach(id => { const o = C.ownerOf(ST, id); if (!(o in oi)) { oi[o] = byOwner.length; byOwner.push(D.factions[o] ? rgb(D.factions[o].color) : o === 'player' ? rgb('#e2b24c') : null); } P.push([C.NODES[id].pos[0] * AX, C.NODES[id].pos[1] * AY, oi[o]]); });
    cols.push(...byOwner);
    const own = new Int16Array(FW * FH);
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) { const px = (x + 0.5) / FW * AX, py = (y + 0.5) / FH * AY; let best = -1, bd = maxD * maxD;
      for (let i = 0; i < P.length; i++) { const dx = P[i][0] - px, dy = P[i][1] - py, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = P[i][2]; } } own[y * FW + x] = best; }
    for (let y = 0; y < FH; y++) for (let x = 0; x < FW; x++) { const k = y * FW + x, c = own[k] >= 0 ? cols[own[k]] : null; if (!c) continue;
      const edge = (x > 0 && cols[own[k - 1]] !== c) || (x < FW - 1 && cols[own[k + 1]] !== c) || (y > 0 && cols[own[k - FW]] !== c) || (y < FH - 1 && cols[own[k + FW]] !== c);
      img.data.set([c[0], c[1], c[2], edge ? 190 : 70], k * 4); }
    g.putImageData(img, 0, 0); ownerField.key = key; ownerField.url = cv.toDataURL(); ownerField.builds++; return ownerField.url;
  }

  // ---------- where to go: quest markers ----------
  // offer (!): work you can take at a place you know; goal (◆): the next step of something you have taken; report (✓): go back and get paid; lead (?): a place named in a story lead.
  const SS = () => window.GAME_STORY_SCREENS || null;
  const GUIDE_AT = { gear: 'kingsway_cross', crown: 'rivermeet', fight: 'golden_reach', synod: 'pennant_green' };
  let flagAt = null;   // job step flags -> the place whose fight or scene sets them
  function flagPlace(flag) {
    if (!flagAt) { flagAt = {}; Object.entries(C.NODES).forEach(([id, n]) => {
      const e = n.encounter && C.ENCOUNTERS[n.encounter]; if (e && e.winFlag) flagAt[e.winFlag] = id;
      const ch = n.choice && C.CHOICES[n.choice]; if (ch) (ch.options || []).forEach(o => { if (o.jobFlag) flagAt[o.jobFlag] = id; if (o.flag) flagAt[o.flag] = flagAt[o.flag] || id; }); }); }
    return flagAt[flag] || null;
  }
  function jobTarget(id) { // where the next unfinished step of a job is, or where to report it
    const J = C.JOBS[id]; if (!J) return null; if (C.jobReady(ST, id)) return { at: J.at, kind: 'report' };
    for (let i = 0; i < J.steps.length; i++) { const x = J.steps[i]; if (C.jobStepDone(ST, id, x, i)) continue;
      const at = x.visit || x.at || x.tavern || (x.clear && (Object.keys(C.NODES).find(k => k === x.clear || C.NODES[k].dungeon === x.clear) || x.clear)) || (x.flag && flagPlace(x.flag)); if (at && C.NODES[at]) return { at, kind: 'goal', text: x.text }; }
    return null;
  }
  function leadPlaces(text) { const out = []; if (!text) return out; Object.entries(C.NODES).forEach(([id, n]) => { if (n.name && n.name.length > 4 && text.includes(n.name) && C.isDiscovered(ST, id)) out.push(id); }); return out; }
  function questMarks() {
    const m = {}, put = (id, kind, why) => { if (!id || !C.NODES[id]) return; const rank = { report: 4, goal: 3, offer: 2, lead: 1 }; const cur = m[id]; if (!cur || rank[kind] > rank[cur.kind]) m[id] = { kind, why: [why].concat(cur ? cur.why : []) }; else cur.why.push(why); };
    C.jobList(ST).filter(j => j.state === 'active').forEach(j => { const t = jobTarget(j.id); if (t) put(t.at, t.kind, j.name); });
    const ss = SS(); if (ss && C.contracts) C.contracts(ST).forEach(c => put(ss.contractTarget(ST, c), c.ready ? 'report' : 'goal', c.name));
    Object.keys(C.NODES).forEach(id => { if (!C.isDiscovered(ST, id)) return; C.jobOffers(ST, id).forEach(j => put(id, 'offer', 'Job: ' + j.name + (j.giver === 'general' ? '' : ' (' + fname(j.giver) + ')')));
      if (C.contractBoard) { const n = C.NODES[id]; if ((n.type === 'castle' || n.type === 'capital' || C.ownerOf(ST, id) === 'hearthwatch') && C.contractBoard(ST, id).some(o => !o.taken)) put(id, 'offer', 'Contract board: ' + C.contractBoard(ST, id).filter(o => !o.taken).length + ' posted'); } });
    if (C.leadList) C.leadList(ST).filter(l => !l.done).forEach(l => leadPlaces(l.text).forEach(id => put(id, 'lead', l.name)));
    C.jobLeads(ST).forEach(l => put(l.at, 'lead', 'Work is going here'));
    const gs = C.guideState(ST); if (!gs.off) { const nx = gs.steps.find(x => !x.done); if (nx && GUIDE_AT[nx.id]) put(GUIDE_AT[nx.id], 'goal', nx.title); }
    { const ms = C.mootState ? C.mootState(ST) : null; if (ms && ms.called && !ms.resolved && !ST.world.realm) put('crown_keep', 'goal', ms.open ? 'The Moot is sitting' : 'The Moot waits here'); }
    if (C.factionNext) C.factionNext(ST).forEach(x => { if (x.at) put(x.at, x.kind === 'offer' ? 'report' : x.kind === 'tryout' ? 'offer' : 'goal', fname(x.faction) + ': ' + (x.kind === 'offer' ? x.title + ' offered' : x.kind === 'induct' ? 'your induction' : 'a try-out')); });
    return m;
  }
  const QM_ICON = { offer: '!', goal: '\u25c6', report: '\u2713', lead: '?' };
  // jump to a place on the map and open its sheet
  function showOnMap(id) { if (!id || !C.NODES[id]) return; tab = 'map'; mapView = null; focusNode = id; mapRegion = C.NODES[id].region; render(); setTimeout(() => nodeSheet(id), 60); }
  let focusNode = null;
  function goLine(id, label) {
    if (!id || !C.NODES[id]) return null; const here = ST.world.location === id, p = here ? [] : pathTo(ST.world.location, id), d = p ? pathDays(ST.world.location, p) : null;
    return h('div', { class: 'qgo' }, h('span', { class: 'grow ' + (here ? 'good' : 'dim'), text: here ? 'You are here, at ' + C.NODES[id].name : (label || 'Go to') + ' ' + C.NODES[id].name + (d ? ' \u00b7 ' + d + ' day' + (d > 1 ? 's' : '') : p ? '' : ' \u00b7 no known road yet') }), btn(here ? 'Open' : 'Show on map', () => showOnMap(id), 'sm'));
  }

  let mapCentre = () => {};
  // the map key: every kind of place as it is drawn, and the markers that sit on them
  function mapKey() {
    const count = {}; Object.entries(C.NODES).forEach(([id, n]) => { if (C.isDiscovered(ST, id)) count[n.type] = (count[n.type] || 0) + 1; });
    const row = (sw, title, text) => h('div', { class: 'row2' }, h('div', { class: 'sw' }, sw), h('div', { class: 'grow' }, h('b', { text: title }), h('div', { class: 'dim', text })));
    const mk = (txt, bg, fg, extra) => h('span', { class: 'mk', style: 'background:' + bg + ';color:' + fg + (extra || ''), text: txt });
    sheet('Map key', () => h('div', { class: 'mkey' },
      h('div', { class: 'sh-h', text: 'Places' }),
      C.PLACE_TYPES.map(t => row(h('div', { class: 'n t-' + t }, typeIcon(t)), TYPE_KEY[t][0] + (count[t] ? ' (' + count[t] + ' known)' : ''), TYPE_KEY[t][1])),
      h('div', { class: 'sh-h', text: 'Rings' }),
      row(h('div', { class: 'n t-town', style: 'border-color:var(--gold);box-shadow:0 0 0 4px rgba(226,178,76,.55)' }, typeIcon('town')), 'You are here', 'The place your party stands in.'),
      row(h('div', { class: 'n t-town', style: 'border-color:#c0392b' }, typeIcon('town')), 'Who holds it', 'The ring is the colour of the power that holds the place.'),
      row(h('div', { class: 'n', style: 'width:30px;height:30px;border-style:dashed;opacity:.5;border-radius:50%', text: '?' }), 'Not yet found', 'A road leads there, but you have not been.'),
      h('div', { class: 'sh-h', text: 'Markers' }),
      row(mk('!', '#f2c14e', '#241a05'), 'Work offered', 'A job or contract you can take here.'),
      row(mk('\u25c6', '#59c2ff', '#04121c'), 'Next step', 'Where something you have taken on continues.'),
      row(mk('\u2713', '#6fd36f', '#08200a'), 'Report back', 'Finished work to hand in.'),
      row(mk('?', '#c79cff', '#1a0a2a'), 'A lead', 'A place named in a rumour or lead.'),
      row(mk('\u2694', 'var(--foe)', '#fff'), 'A fight waiting', 'A set battle you can start here.'),
      row(mk('\u2726', 'var(--gold)', '#1a1205'), 'A scene', 'A choice or story scene.'),
      row(mk('\u2620', '#5b1f1f', '#ffd0c0', ';border:1px solid var(--foe)'), 'Dungeon open', 'A dungeon run you can enter.'),
      row(mk('\u2694', '#4a2410', '#ffb070', ';border:1px solid #e0702b'), 'Danger', 'In a wild zone: the darker, the more dangerous.'),
      row(mk('under attack', 'var(--foe)', '#fff'), 'Under attack', 'Raiders hold it; services are closed.')));
  }
  function inPoly(x, y, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
  // ---------- the map: a world view of the whole painted map, and a region view of one territory's own picture ----------
  // mapRegion: null = follow the party (the territory it stands in), 'world' = the whole map, or a territory id.
  // Each territory has its own image (C.TERRITORIES[r].img) showing the part of the world picture in .crop, so a sharper painting
  // of one region can replace its file without touching the game data. Places keep world positions (fractions of the world picture).
  const art = {};   // url -> loaded url (a blob URL where the host needs one), or false if it cannot be loaded
  function loadArt(url, use) {
    if (art[url]) return use(art[url]); if (art[url] === false) return;
    const im = new Image(); im.onload = () => { art[url] = url; use(url); };
    im.onerror = () => { if (typeof fetch !== 'function') { art[url] = false; return; } fetch(url).then(r => { if (!r.ok) throw new Error(r.status); return r.blob(); }).then(b => { art[url] = URL.createObjectURL(b); use(art[url]); }).catch(() => { art[url] = false; }); };
    im.src = url;
  }
  let mapRegion = null, mapZ = { world: 1, region: 1 }, mapView = null;
  try { const z = JSON.parse(localStorage.getItem('coc_mapz2') || 'null'); if (z && z.world) mapZ = z; } catch (e) {}
  const terrOf = id => (C.NODES[id] ? C.NODES[id].region : null);
  const terrName = r => (C.TERRITORIES[r] && C.REGIONS[r] ? C.REGIONS[r].name : r);
  const knownTerr = () => { const k = {}; Object.entries(C.NODES).forEach(([id, n]) => { if (C.isDiscovered(ST, id)) k[n.region] = 1; }); return k; };
  function mapScreen(main) {
    const known = knownTerr(), here = loc() ? loc().region : null;
    let mode = mapRegion === 'world' ? 'world' : (mapRegion && C.TERRITORIES[mapRegion] ? mapRegion : (here && C.TERRITORIES[here] ? here : 'world'));
    const T = mode === 'world' ? null : C.TERRITORIES[mode], boxH = window.innerHeight - 170, boxW = Math.min(480, window.innerWidth);
    const crop = T ? T.crop : [0, 0, 1, 1], cw = crop[2] - crop[0], ch = crop[3] - crop[1], ratio = (cw * 1380) / (ch * 752);
    // base size: a tall region fills the view; a wide one fills the width and at least a squarish height; the world fills the height and scrolls sideways
    const fitOf = () => T ? Math.max(boxW / ratio, Math.min(boxH, boxW * 1.15)) : boxH;
    const minZ = 1, maxZ = T ? 5 : 3, zr = mapZ.r || (mapZ.r = {});
    // a region opens zoomed in far enough that its places sit about a thumb apart (narrow mountain strips need more)
    const autoZ = T ? (() => { const f = fitOf(), P = Object.values(C.NODES).filter(n => n.region === mode && !n.dungeon && !n.route).map(n => [(n.pos[0] - crop[0]) / cw * f * ratio, (n.pos[1] - crop[1]) / ch * f]);
      const d = P.map((a, i) => Math.min(...P.map((b, j) => i === j ? 1e9 : Math.hypot(a[0] - b[0], a[1] - b[1])))).sort((a, b) => a - b), med = d.length ? d[d.length >> 1] : 60; return Math.min(1.8, Math.max(1, 52 / med)); })() : 1;
    const Z = Math.min(maxZ, Math.max(minZ, T ? (zr[mode] || autoZ) : (mapZ.world || 1)));
    const fit = fitOf(), H = Math.round(fit * Z), W = Math.round(H * ratio);
    const proj = p => [(p[0] - crop[0]) / cw * W, (p[1] - crop[1]) / ch * H], px = n => proj(n.pos);
    const ns = (T ? Math.min(1, 0.6 + Z * 0.15) : Math.min(0.7, 0.3 + Z * 0.15)).toFixed(2);
    const box = h('div', { class: 'sh-map', style: 'height:' + Math.min(boxH, H) + 'px' });
    const inner = h('div', { style: 'position:relative;width:' + W + 'px;height:' + H + 'px;background:radial-gradient(ellipse at 50% 45%,#22384a 0%,#13212d 70%)' });
    loadArt(T ? T.img : 'art/world.jpg', u => { inner.style.backgroundImage = 'url(' + u + ')'; inner.style.backgroundSize = '100% 100%'; });
    const LINE = '#e8dcc0';   // territory outlines are plain now: the owner colours below show who holds what
    { const u = ownerFieldUrl(); if (u) { const fw = W / cw, fh = H / ch; inner.appendChild(h('div', { class: 'ofield', style: 'position:absolute;inset:0;overflow:hidden;pointer-events:none' }, h('img', { src: u, alt: '', style: 'position:absolute;max-width:none;left:' + (-crop[0] * fw) + 'px;top:' + (-crop[1] * fh) + 'px;width:' + fw + 'px;height:' + fh + 'px' }))); } }
    const pts = poly => poly.map(p => proj(p).map(v => v.toFixed(1)).join(',')).join(' ');
    let svg = '<svg width="' + W + '" height="' + H + '" style="position:absolute;inset:0">';
    const marks = questMarks();
    if (!T) { // ---- world view: territories, tinted by who holds them; unknown land stays dark ----
      Object.entries(C.TERRITORIES).forEach(([r, t]) => {
        const R = C.REGIONS[r] || {}, isK = known[r];
        if (R.unclaimed) svg += '<polygon points="' + pts(t.poly) + '" fill="#000" fill-opacity=".25" stroke="#c8b8a0" stroke-opacity=".55" stroke-width="2" stroke-dasharray="6 6"/>';
        else if (!isK) svg += '<polygon points="' + pts(t.poly) + '" fill="#0b1118" fill-opacity=".62" stroke="#0b1118" stroke-opacity=".8" stroke-width="2"/>';
        else svg += '<polygon points="' + pts(t.poly) + '" fill="none" stroke="' + LINE + '" stroke-opacity="' + (r === here ? '.7' : '.35') + '" stroke-width="' + (r === here ? 3 : 2) + '" stroke-linejoin="round"/>';
      });
      const fs = Math.round(Math.max(11, Math.min(18, 13 * Z)));
      Object.entries(C.TERRITORIES).forEach(([r, t]) => { const R = C.REGIONS[r] || {}, [x, y] = proj(t.label); const nm = !t.painted ? terrName(r).toUpperCase() : null, sub = R.unclaimed ? 'Unclaimed' : !known[r] ? 'Unexplored' : null;
        if (nm && (known[r] || R.unclaimed)) svg += '<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" fill="#f6ecd2" font-size="' + fs + '" font-family="Georgia,serif" font-weight="bold" text-anchor="middle" letter-spacing="2" stroke="#1a1208" stroke-width="3" paint-order="stroke">' + nm + '</text>';
        if (sub) svg += '<text x="' + x.toFixed(1) + '" y="' + (y + (nm ? fs + 2 : t.painted ? 26 : 0)).toFixed(1) + '" fill="#d8ccb0" font-size="' + (fs - 2) + '" font-style="italic" font-family="Georgia,serif" text-anchor="middle" stroke="#1a1208" stroke-width="3" paint-order="stroke">' + sub + '</text>'; });
      svg += '</svg>'; inner.insertAdjacentHTML('beforeend', svg);
      // tap a territory to open it
      inner.addEventListener('click', e => { const r0 = inner.getBoundingClientRect(), fx = crop[0] + (e.clientX - r0.left) / W * cw, fy = crop[1] + (e.clientY - r0.top) / H * ch;
        const hit = Object.entries(C.TERRITORIES).find(([r, t]) => inPoly(fx, fy, t.poly)); if (!hit) return; const r = hit[0], R = C.REGIONS[r] || {};
        if (R.unclaimed) { toast(terrName(r) + ': no one holds this land, and no road leads there yet.'); return; }
        if (!known[r]) { toast(terrName(r) + ': you have not found a road into it yet.'); return; }
        mapRegion = r; mapView = null; render(); });
      // capitals you know, quest marks (one per territory), and the party
      Object.entries(C.NODES).forEach(([id, n]) => { if (!C.isDiscovered(ST, id) || (n.type !== 'capital' && ST.world.location !== id)) return; const [x, y] = px(n);
        if (n.type === 'capital') { inner.appendChild(h('div', { class: 'n t-capital', style: 'left:' + x + 'px;top:' + y + 'px;--ns:' + ns + ';pointer-events:none;border-color:' + ownerColor(id) }, typeIcon('capital'))); if (Z >= 1.3) inner.appendChild(h('div', { class: 'lbl cap', style: 'left:' + x + 'px;top:' + (y + 18) + 'px', text: n.name })); } });
      const qt = {}; Object.entries(marks).forEach(([id, q]) => { const r = terrOf(id), rank = { report: 4, goal: 3, offer: 2, lead: 1 }; if (!qt[r] || rank[q.kind] > rank[qt[r].kind]) qt[r] = q; });
      Object.entries(qt).forEach(([r, q]) => { const t = C.TERRITORIES[r]; if (!t || !known[r]) return; const [x, y] = proj(t.label); inner.appendChild(h('div', { class: 'qm q-' + q.kind, style: 'left:' + (x + 46) + 'px;top:' + (y + 6) + 'px;--ns:1', title: q.why.join(', '), text: QM_ICON[q.kind] })); });
    } else { // ---- region view: this territory's picture, its places and roads, and the roads out ----
      Object.entries(C.TERRITORIES).forEach(([r, t]) => { if (r === mode || !t.next.includes(mode) && !(t.next || []).length) return; if (r !== mode && !known[r]) return;
        if (r !== mode) svg += '<polygon points="' + pts(t.poly) + '" fill="none" stroke="' + LINE + '" stroke-opacity=".35" stroke-width="2" stroke-dasharray="5 6"/>'; });
      svg += '<polygon points="' + pts(T.poly) + '" fill="none" stroke="' + LINE + '" stroke-opacity=".6" stroke-width="3" stroke-linejoin="round"/>';
    }
    // which places are drawn: in a region, its own places plus the far ends of roads leaving it; in the world view, none (capitals above)
    const show = {}; if (T) Object.entries(C.NODES).forEach(([id, n]) => { if (n.region !== mode) return; show[id] = 1; Object.keys(n.links).forEach(l => { if (C.NODES[l].region !== mode) show[l] = 2; }); });
    const nodes = Object.entries(C.NODES).filter(([id]) => show[id]);
    if (T) {
      const seen = {};
      nodes.forEach(([id, n]) => Object.keys(n.links).forEach(to => {
        if (!show[to]) return; const key = [id, to].sort().join('|'); if (seen[key]) return; seen[key] = 1;
        const a = C.isDiscovered(ST, id), b = C.isDiscovered(ST, to); if (!a && !b) return;
        const [x1, y1] = px(n), [x2, y2] = px(C.NODES[to]);
        svg += '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" stroke="' + (a && b ? '#e8dcc0' : '#8a8070') + '" stroke-width="3" stroke-linecap="round" stroke-dasharray="' + (a && b ? '' : '3 8') + '" opacity=".8"/>';
      }));
      svg += '</svg>'; inner.insertAdjacentHTML('beforeend', svg);
    }
    nodes.forEach(([id, n]) => {
      const [x, y] = px(n), disc = C.isDiscovered(ST, id), far = show[id] === 2;
      if (!disc) { const linked = !n.hidden && Object.keys(n.links).some(l => C.isDiscovered(ST, l) && ((ST.world.nodes[l] || {}).visited || ST.world.location === l)); if (!linked) return; inner.appendChild(h('button', { class: 'n unk', style: 'left:' + x + 'px;top:' + y + 'px', text: '?', 'aria-label': 'Unmarked road', onclick: e => { e.stopPropagation(); unknownSheet(id); } })); return; }
      const sv = C.nodeServices(ST, id), cur = ST.world.location === id, atk = sv.attack || null;
      const dgOpen = sv.dungeon && !sv.dungeon.cleared, bk = sv.besieged ? 'siege' : sv.encounter ? 'fight' : sv.choice ? 'scene' : dgOpen ? 'dungeon' : null;   // what is waiting here: fight, story scene, dungeon run, or a siege
      inner.appendChild(h('button', { class: 'n t-' + n.type + (cur ? ' cur' : '') + (bk ? ' w-' + bk : '') + (far ? ' far' : '') + (marks[id] && (marks[id].kind === 'goal' || marks[id].kind === 'report') ? ' q-ring' : '') + (atk ? ' contested' : ''), style: 'left:' + x + 'px;top:' + y + 'px;--ns:' + ns + ';border-color:' + (cur ? 'var(--gold)' : ownerColor(id)) + (atk ? ';--atk:' + ((D.factions[atk.by] || {}).color || '#c0392b') : ''), onclick: e => { e.stopPropagation(); nodeSheet(id); }, 'aria-label': n.name }, typeIcon(n.type)));
      if (cur || n.type === 'capital' || Z >= 1.6 || (!n.route && (MAJOR[n.type] || LABEL_MID[n.type])) || far) inner.appendChild(h('div', { class: 'lbl' + (n.type === 'capital' ? ' cap' : n.type === 'zone' ? ' zn' : ''), style: 'left:' + x + 'px;top:' + (y + 26 * ns) + 'px', text: n.name }));
      if (n.type === 'zone' && n.danger > 0) inner.appendChild(h('div', { class: 'bdg b-zone z' + Math.min(3, C.landDanger(id)), style: 'left:' + x + 'px;top:' + y + 'px;--ns:' + ns, text: '⚔' }));
      const qm = marks[id]; if (qm) inner.appendChild(h('div', { class: 'qm q-' + qm.kind, style: 'left:' + x + 'px;top:' + y + 'px;--ns:' + ns, title: qm.why.join(', '), text: QM_ICON[qm.kind] }));
      if (bk) inner.appendChild(h('div', { class: 'bdg b-' + bk, style: 'left:' + x + 'px;top:' + y + 'px;--ns:' + ns, text: { siege: 'under attack', fight: '⚔', scene: '✦', dungeon: '☠' }[bk] }));
    });
    // the player's figure: stands over the party's place; after a journey it walks the hops it just took
    { const cn = loc(); if (cn && (!T || cn.region === mode || show[ST.world.location])) { const FIG = '<svg viewBox="0 0 26 34"><ellipse cx="13" cy="32" rx="8" ry="2.2" fill="rgba(0,0,0,.45)"/><g class="lg l1"><rect x="9" y="19" width="3.4" height="11" rx="1.6" fill="#3a2a18"/></g><g class="lg l2"><rect x="13.6" y="19" width="3.4" height="11" rx="1.6" fill="#3a2a18"/></g><path d="M7 11 Q13 7 19 11 L20 22 L6 22 Z" fill="#c9482b" stroke="#2a1208" stroke-width="1.2"/><circle cx="13" cy="6" r="4.4" fill="#e8c9a0" stroke="#2a1208" stroke-width="1.2"/><path d="M8.6 5 Q13 -1 17.4 5 Q13 3 8.6 5Z" fill="#e2b24c" stroke="#2a1208" stroke-width=".8"/><rect x="19" y="8" width="2" height="15" rx="1" fill="#d8dde2" stroke="#2a1208" stroke-width=".6"/></svg>';
      const HOP = HOP_MS, el = walkAnim ? Date.now() - walkAnim.t0 : 1e9, full = walkAnim ? walkAnim.trail.filter(i => C.NODES[i]) : [];
      if (!walkAnim || full.length < 2 || el > (full.length - 1) * HOP + 80) walkAnim = null;   // a re-draw mid-walk picks the walk up where it is
      const trail = walkAnim ? full : [], k0 = walkAnim ? Math.min(trail.length - 1, Math.floor(el / HOP)) : 0;
      const at = i => 'left:' + px(C.NODES[i])[0] + 'px;top:' + px(C.NODES[i])[1] + 'px';
      const me = h('div', { class: 'me' + (trail.length > 1 ? ' walk' : ''), style: at(trail.length > 1 ? trail[k0] : ST.world.location) + ';--ns:' + Math.max(ns, 0.6), 'aria-label': 'Your party' }); me.innerHTML = FIG; inner.appendChild(me);
      if (trail.length > 1) { let k = k0 + 1; const hop = () => { if (!me.isConnected) return; if (k >= trail.length) { me.classList.remove('walk'); walkAnim = null; return; } const nx = px(C.NODES[trail[k]]); me.style.left = nx[0] + 'px'; me.style.top = nx[1] + 'px'; k++; setTimeout(hop, HOP); }; setTimeout(hop, 60); } } }
    box.appendChild(inner);
    // zoom: +/- buttons and two-finger pinch; the point under the centre of the view stays put
    const wrap = h('div', { style: 'position:relative' });
    const setZ = (z, cx, cy) => { // cx, cy: view-relative focus point in px (default centre)
      z = Math.min(maxZ, Math.max(minZ, z)); if (Math.abs(z - Z) < 0.001) return;
      cx = cx == null ? box.clientWidth / 2 : cx; cy = cy == null ? box.clientHeight / 2 : cy;
      const fx = (box.scrollLeft + cx) / W, fy = (box.scrollTop + cy) / H;
      if (T) zr[mode] = z; else mapZ.world = z; try { localStorage.setItem('coc_mapz2', JSON.stringify(mapZ)); } catch (e) {}
      mapRegion = T ? mode : 'world'; mapView = { fx, fy, cx, cy }; render();
    };
    const centre = p => { box.scrollLeft = proj(p)[0] - box.clientWidth / 2; box.scrollTop = proj(p)[1] - box.clientHeight / 2; };
    const zb = (t, f, lab) => h('button', { class: 'zb', text: t, 'aria-label': lab, onclick: () => setZ(Z * f) });
    // where you are looking, and the way back out to the world
    main.appendChild(h('div', { class: 'mhd' }, T ? btn('◂ World', () => { mapRegion = 'world'; mapView = null; render(); }, 'sm') : null,
      h('span', { class: 'mt' }, h('b', { text: T ? terrName(mode) : 'The Realm' }), h('span', { class: 'dim', text: T ? (C.REGIONS[mode].faction ? ' · ' + fname(C.REGIONS[mode].faction) : '') : ' · tap a land to open it' }))));
    wrap.appendChild(box);
    wrap.appendChild(h('div', { class: 'zc' }, zb('+', 1.3, 'Zoom in'), zb('−', 1 / 1.3, 'Zoom out'), h('button', { class: 'zb', text: '?', 'aria-label': 'Map key', onclick: mapKey }), h('button', { class: 'zb', text: '◎', 'aria-label': 'Back to your party', onclick: () => { if (T && here === mode || !T) { const n = loc(); if (n) centre(n.pos); } else { mapRegion = null; mapView = null; render(); } } })));
    // edge tabs: the neighbouring lands, on the side they lie
    if (T) { const cx0 = (crop[0] + crop[2]) / 2, cy0 = (crop[1] + crop[3]) / 2, tabs = [];
      T.next.filter(r => C.TERRITORIES[r] && known[r]).forEach(r => { const c = C.TERRITORIES[r].label, dx = (c[0] - cx0) * 1380, dy = (c[1] - cy0) * 752, side = Math.abs(dx) / boxW > Math.abs(dy) / boxH ? (dx > 0 ? 'r' : 'l') : (dy > 0 ? 'b' : 't');
        tabs.push({ r, side, tp: side === 'l' || side === 'r' ? 50 + dy / 752 / ch * 50 : 50 + dx / 1380 / cw * 50 }); });
      // keep tabs on the same edge apart, clear of the header (top), the zoom buttons (right) and the legend (bottom left)
      const LIM = { l: [20, 82], r: [52, 84], t: [18, 66], b: [52, 80] }, GAP = { l: 9, r: 9, t: 34, b: 34 };
      ['l', 'r', 't', 'b'].forEach(sd => { const g = tabs.filter(x => x.side === sd).sort((a, b) => a.tp - b.tp), [lo, hi] = LIM[sd];
        g.forEach((x, i) => { x.tp = Math.min(hi, Math.max(lo, x.tp)); if (i && x.tp < g[i - 1].tp + GAP[sd]) x.tp = g[i - 1].tp + GAP[sd]; });
        for (let i = g.length - 1; i >= 0; i--) { if (g[i].tp > hi - (g.length - 1 - i) * GAP[sd]) g[i].tp = hi - (g.length - 1 - i) * GAP[sd]; } });
      tabs.forEach(({ r, side, tp }) => wrap.appendChild(h('button', { class: 'etab e-' + side, style: (side === 'l' || side === 'r' ? 'top:' : 'left:') + tp + '%', onclick: () => { mapRegion = r; mapView = null; render(); } }, { l: '◂ ', t: '▴ ', r: '', b: '▾ ' }[side] + terrName(r).replace(/^The /, '').replace(/ Mountains$| of Mirewood$/, '').replace(/^Marshes$/, 'Mirewood') + (side === 'r' ? ' ▸' : '')))); }
    let p0 = null;
    const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    box.addEventListener('touchstart', e => { if (e.touches.length === 2) { const r = box.getBoundingClientRect(); p0 = { d: dist(e.touches), z: Z, cx: (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left, cy: (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top, k: 1 }; } }, { passive: true });
    box.addEventListener('touchmove', e => { if (p0 && e.touches.length === 2) { e.preventDefault(); p0.k = dist(e.touches) / p0.d; inner.style.transformOrigin = (box.scrollLeft + p0.cx) + 'px ' + (box.scrollTop + p0.cy) + 'px'; inner.style.transform = 'scale(' + Math.min(maxZ / p0.z, Math.max(minZ / p0.z, p0.k)) + ')'; } }, { passive: false });
    const endPinch = e => { if (p0 && e.touches.length < 2) { const q = p0; p0 = null; inner.style.transform = ''; setZ(q.z * q.k, q.cx, q.cy); } };
    box.addEventListener('touchend', endPinch); box.addEventListener('touchcancel', endPinch);
    main.appendChild(wrap);
    mapCentre = () => { if (mapView) { const v = mapView; mapView = null; box.scrollLeft = v.fx * W - v.cx; box.scrollTop = v.fy * H - v.cy; return; } const n = focusNode && C.NODES[focusNode] ? C.NODES[focusNode] : (T && here !== mode ? null : loc()); focusNode = null; centre(n ? n.pos : T ? [(crop[0] + crop[2]) / 2, (crop[1] + crop[3]) / 2] : [0.5, 0.45]); };
    const warn = ST.world.flags.marches_warned && !ST.world.flags.marches_defended && !ST.world.flags.marches_lost ? 'Raiders are massing near the Free Marches. They will strike around day 24.' : (ST.world.flags.marches_lost && !ST.world.flags.marches_defended ? 'The Free Marches have fallen to raiders. Retake them.' : null);
    const gs = C.guideState(ST);
    if (!gs.off) { const nx = gs.steps.find(x => !x.done);
      main.appendChild(h('div', { class: 'card', style: 'margin:8px' }, h('div', { class: 'row' }, h('b', { class: 'grow', text: 'Crossroads week' }), btn('Skip', () => { C.guideSkip(ST); autosave(); render(); }, 'sm')),
        gs.steps.map(x => h('div', { class: x.done ? 'dim' : '', text: (x.done ? '\u2713 ' : (x === nx ? '\u25b6 ' : '\u25cb ')) + x.title })), nx ? h('div', { class: 'dim', style: 'margin-top:4px', text: nx.hint }) : null)); }
    { const kinds = new Set(Object.values(marks).map(q => q.kind)), L = { offer: ['#f2c14e', '#241a05', 'work offered'], goal: ['#59c2ff', '#04121c', 'next step'], report: ['#6fd36f', '#08200a', 'report back'], lead: ['#c79cff', '#1a0a2a', 'a lead'] };
      if (kinds.size) wrap.appendChild(h('div', { class: 'qleg' }, Object.keys(L).filter(k => kinds.has(k)).map(k => h('span', {}, h('i', { style: 'background:' + L[k][0] + ';color:' + L[k][1], text: QM_ICON[k] }), L[k][2])))); }
    const jl = C.jobList(ST).filter(j => j.state === 'active'), kl = C.contracts ? C.contracts(ST) : [];
    if (jl.length || kl.length) main.appendChild(h('div', { class: 'card', style: 'margin:8px' }, h('div', { class: 'row' }, h('b', { class: 'grow', text: 'Your quests' }), btn('Journal', () => { tab = 'quests'; render(); }, 'sm')),
      jl.slice(0, 2).map(j => { const t = jobTarget(j.id); return h('div', { style: 'margin-top:4px' }, h('b', { text: j.name + ': ' }), h('span', { class: j.ready ? 'good' : 'dim', text: j.ready ? 'report back at ' + C.NODES[j.at].name : (t && t.text) || ((j.steps.find(x => !x.done) || {}).text) }), t ? btn('\u25ce', () => { mapView = null; focusNode = t.at; mapRegion = terrOf(t.at); render(); }, 'sm') : null); }),
      kl.slice(0, Math.max(0, 3 - Math.min(2, jl.length))).map(c => { const at = SS() && SS().contractTarget(ST, c); return h('div', { style: 'margin-top:4px' }, h('b', { text: c.name + ': ' }), h('span', { class: c.ready ? 'good' : 'dim', text: c.ready ? 'report back at ' + C.NODES[c.giver].name : at ? 'go to ' + C.NODES[at].name : '' }), at ? btn('\u25ce', () => { mapView = null; focusNode = at; mapRegion = terrOf(at); render(); }, 'sm') : null); })));
    if (warn) main.appendChild(h('div', { class: 'card', style: 'margin:8px;border-color:var(--foe)' }, h('b', { class: 'badc', text: 'Warning' }), h('div', { text: warn })));
    // centre on the current node once
    requestAnimationFrame(() => mapCentre());
  }

  // ---------- node sheet ----------
  function nodeRisk(id) { const d = C.landDanger(id); return d >= 3 ? 'bandits, beasts and worse.' : d === 2 ? 'raiders and beasts.' : 'mostly petty bandits and strays.'; }
  function nodeSheet(id) { sheet(C.NODES[id].name, () => nodeBody(id)); }
  // a road out of somewhere you have been, to somewhere you have not: no name, no details, only the way there
  function unknownSheet(id) {
    const n = C.NODES[id], via = Object.keys(n.links).filter(l => C.isDiscovered(ST, l) && ((ST.world.nodes[l] || {}).visited || ST.world.location === l)), p = pathTo(ST.world.location, id);
    const leaves = via.length && C.NODES[via[0]].region !== n.region;
    sheet('An unmarked road', () => [h('div', { text: 'A road leads off from ' + via.map(l => C.NODES[l].name).join(' and ') + ' toward somewhere you have not been.' }),
      leaves ? h('div', { class: 'dim', style: 'margin-top:6px', text: 'It crosses out of ' + (C.landName(C.NODES[via[0]].region) || 'this land') + '. Borders are watched.' }) : null, h('div', { style: 'height:8px' }),
      p ? btn('Follow the road (' + pathDays(ST.world.location, p) + ' day' + (pathDays(ST.world.location, p) > 1 ? 's' : '') + ')', () => travel(p), 'pri full') : h('div', { class: 'dim', text: 'You cannot get there from here yet.' })]);
  }
  function nodeBody(id) {
    const n = C.NODES[id], sv = C.nodeServices(ST, id), here = ST.world.location === id, out = [];
    out.push(h('div', { class: 'dim', text: n.desc }));
    out.push(h('div', { class: 'dim', style: 'font-style:italic;margin:4px 0', text: C.placeLine(ST, id) }));
    { const ev = C.placeEvent(ST, id), cal = C.calendar(ST.world.day); if (ev || (cal.festival && ['town', 'village', 'market', 'capital'].includes(n.type))) out.push(h('div', { style: 'margin:4px 0' }, ev ? h('span', { class: 'shchip', text: ev.name + ' until day ' + ev.until }) : null, cal.festival ? h('span', { class: 'shchip', style: 'border-color:var(--gold);color:var(--gold)', text: cal.festival }) : null)); }
    if (n.capital) out.push(h('div', { style: 'margin:6px 0' }, h('span', { class: 'shchip', style: 'border-color:var(--gold);color:var(--gold)', text: 'Capital of ' + fname(n.capital) }), n.danger >= 2 ? h('span', { class: 'shchip', text: 'Dangerous country' }) : null));
    else if (n.type === 'dungeon') out.push(h('div', { style: 'margin:6px 0' }, h('span', { class: 'shchip', style: 'border-color:var(--foe);color:#ffb0a0', text: 'Dungeon · tier ' + C.DUNGEONS[id].tier })));
    else if (n.type === 'zone' || n.danger >= 2) out.push(h('div', { style: 'margin:6px 0' }, n.type === 'zone' ? (C.zoneChance(id) ? [h('span', { class: 'shchip', style: 'border-color:var(--foe);color:#ffb0a0', text: '\u2694 Encounter zone' }), h('span', { class: 'shchip', text: 'about ' + Math.round(C.zoneChance(id) * 100) + '% each visit' }), h('div', { class: 'dim', style: 'margin-top:4px', text: 'Walk in and trouble may find you: ' + (nodeRisk(id)) + ' Other roads are nearly quiet.' })] : h('span', { class: 'shchip', text: 'Named area · safe' })) : h('span', { class: 'shchip', text: 'Wild' }), n.type !== 'zone' && n.danger >= 2 ? h('span', { class: 'shchip', text: 'Dangerous country' }) : null));
    { const qm = questMarks()[id]; if (qm) out.push(h('div', { class: 'card', style: 'border-color:' + ({ offer: '#f2c14e', goal: '#59c2ff', report: '#6fd36f', lead: '#c79cff' })[qm.kind] }, h('b', { text: ({ offer: 'Work here', goal: 'Your next step is here', report: 'Report back here', lead: 'Named in a lead' })[qm.kind] }), qm.why.map(t => h('div', { class: 'dim', text: '\u2022 ' + t })))); }
    if (sv.owner) out.push(h('div', { style: 'margin:6px 0' }, h('span', { class: 'shchip', text: 'Held by ' + fname(sv.owner) }), n.faction ? h('span', { class: 'shchip', text: fname(n.faction) + ': ' + tierName(n.faction) + ' (' + fmtStand(n.faction) + ')' }) : null));
    if (sv.garrison) { const co = sv.cutOff, cap = C.NODES[Object.keys(C.NODES).find(k => C.NODES[k].type === 'capital' && C.NODES[k].capital === sv.owner)];
      out.push(h('div', { class: 'dim', style: 'margin:0 2px 8px' + (co && co.cut ? ';color:var(--foe)' : '') }, 'Garrison: ' + sv.garrison + (sv.weakened ? ' (below strength)' : '') + '.',
        co && co.cut ? ' Cut off from ' + (cap ? cap.name : 'its capital') + ' for ' + Math.round(co.days) + ' days.' + (co.stage >= 3 ? ' Its people are talking of opening the gates.' : co.stage >= 2 ? ' Its garrison is dwindling.' : co.stage >= 1 ? ' The shelves are thinning.' : '') : co ? ' Supply has come back; it is still recovering.' : '')); }
    if (sv.attack) { const a = sv.attack;
      const when = a.days > 1 ? 'within ' + a.days + ' days' : 'any hour now', cap = t => t.charAt(0).toUpperCase() + t.slice(1);
      out.push(h('div', { class: 'card badc' }, h('b', { text: a.stages > 1 ? 'Under siege' : 'Under threat' }),
        h('div', { text: a.stages > 1 && a.stage > 0 ? 'The ' + fname(a.by) + ' has taken ' + a.done.join(' and ') + ' from the ' + fname(a.on) + '. ' + cap(a.stageName) + ' comes next, ' + when + '.'
          : 'The ' + fname(a.by) + ' is massing at ' + C.NODES[a.from].name + ' to ' + (a.stages > 1 ? 'lay siege to it' : 'take it from the ' + fname(a.on)) + '. ' + (a.stages > 1 ? 'They will be at ' + a.stageName + ' ' + when + '.' : a.days > 1 ? 'They will strike within ' + a.days + ' days.' : 'They strike any hour now.') }),
        a.stages > 1 ? h('div', { class: 'dim', style: 'margin-top:4px', text: a.stageName === 'the last stand' ? 'If this stage falls, so does the ' + fname(a.on) + '.' : 'It falls in stages: ' + a.stages + ' fights, a week apart. Holding any one of them breaks the siege.' }) : null,
        here && a.sides.length ? [h('div', { class: 'dim', style: 'margin:4px 0 8px', text: 'You could step in. Win, and the matter is settled your way; whoever you fight against will remember it.' }), btn('Step in', () => { const k = C.attackEncounter(ST, id); if (k) briefing(k); }, 'pri full')]
          : !here ? h('div', { class: 'dim', style: 'margin-top:4px', text: 'Be here before then if you want a say in it.' }) : null)); }
    if (!here) {
      const p = pathTo(ST.world.location, id);
      out.push(p ? btn('Travel here (' + pathDays(ST.world.location, p) + ' day' + (pathDays(ST.world.location, p) > 1 ? 's' : '') + (p.length > 1 ? ', ' + p.length + ' stops' : '') + ' · road risk ' + C.routeRisk(p, ST.world.location) + ')', () => travel(p), 'pri full') : h('div', { class: 'dim', text: 'No known road leads here yet.' }));
      return out;
    }
    out.push(h('div', { class: 'dim', text: 'You are here.' }));
    if (SS() && SS().mootHere) { const mh = SS().mootHere(ST); if (mh) out.push(mh); }   // the Moot is met in person: its cards lead the sheet
    if (SS() && SS().people) out.push(SS().people(ST));
    if (C.offersHere) out.push(C.offersHere(ST, id).map(placeOfferCard));
    out.push(proofHere());
    if (sv.besieged) out.push(h('div', { class: 'card badc', text: 'Raiders hold this place. Services are closed until it is retaken.' }));
    else if (n.faction && !sv.open) out.push(h('div', { class: 'card badc', text: fname(n.faction) + ' will not deal with you while you are Hostile.' }));
    if (sv.encounter) { const e = C.ENCOUNTERS[sv.encounter]; out.push(btn('Fight: ' + e.name + (e.rec ? ' (Lv ' + e.rec + ')' : ''), () => briefing(sv.encounter), 'pri full'), h('div', { style: 'height:8px' })); }
    if (sv.choice) { const ch = C.CHOICES[sv.choice]; out.push(h('div', { class: 'card' }, h('div', { style: 'white-space:pre-line', text: ch.text }), h('div', { style: 'height:8px' }), ch.options.map(o => [btn(o.label, () => decide(sv.choice, o.id), 'full', false), stakes(o)]))); }
    (sv.jobReports || []).forEach(j => out.push(h('div', { class: 'card' }, h('b', { text: j.name + ' \u2713' }), h('div', { class: 'dim', text: 'All done. Report back for your pay.' }),
      btn('Report back', () => { const r = C.reportJob(ST, j.id); if (!r.ok) { toast(r.reason, true); return; } autosave(); render(); sheet(j.name, () => [h('p', { text: r.text }), r.gold ? h('div', { class: 'good', text: '+' + r.gold + ' g' }) : null, S.visibleChanges(ST, r.changes).map(c => h('div', { class: 'dim', text: fname(c.faction) + ' ' + (c.delta > 0 ? '+' : '') + c.delta + ' (now ' + S.tierOf(c.to).name + ')' })), r.found.length ? h('div', { class: 'card' }, h('b', { text: 'You hear of ' + r.found.join(', ') }), h('div', { class: 'dim', text: 'It is on your map now.' })) : null, C.offersHere ? C.offersHere(ST, id).filter(o => o.faction === j.giver).map(placeOfferCard) : null, btn('Done', closeSheet, (C.offersHere && C.offersHere(ST, id).some(o => o.faction === j.giver) ? '' : 'pri ') + 'full')]); }, 'pri full'))));
    (sv.jobOffers || []).forEach(j => out.push(h('div', { class: 'card' }, h('b', { text: j.name }), h('span', { class: 'shchip', text: fname(j.giver) }), h('p', { class: 'dim', text: j.offer }),
      j.steps.map(x => h('div', { text: '\u25cb ' + x.text })), j.reward ? h('div', { class: 'dim', style: 'margin:4px 0', text: 'Pays ' + (j.reward.gold ? j.reward.gold + ' g' : '') + (j.reward.reveal ? ' and a rumour' : '') }) : null,
      btn('Take the job', () => { const r = C.acceptJob(ST, j.id); if (!r.ok) { toast(r.reason, true); return; } const t = jobTarget(j.id), shown = t && t.at && !C.isDiscovered(ST, t.at); if (t && t.at) C.discoverRoute(ST, ST.world.location, t.at); toast('Job taken: ' + j.name + (t && t.at ? '. ' + C.NODES[t.at].name + (shown ? ' is now on your map.' : ' is marked on your map.') : '')); autosave(); render(); sheet(C.NODES[id].name, () => nodeBody(id)); }, 'pri full'))));
    if (SS()) { out.push(SS().board(ST, id)); out.push(SS().place(ST)); }
    if (sv.dungeon) out.push(dungeonCard(sv.dungeon));
    if (sv.arena) out.push(arenaCard());
    (sv.bounty || []).forEach(o => out.push(h('div', { class: 'card' }, h('b', { text: 'A price on your head' }), h('div', { class: 'dim', text: o.how === 'pay' ? 'The Syndicate can make ' + fname(o.faction) + '\'s hunters look elsewhere, for a price.' : 'Do penance for ' + o.days + ' days. The Hearthwatch will vouch for you, and the hunters lose the scent.' }), h('div', { style: 'height:6px' }),
      btn(o.how === 'pay' ? 'Pay ' + o.cost + ' g' : 'Do penance (' + o.days + ' days)', () => { const r = C.settleBounty(ST, id, o.faction, o.how); if (!r.ok) { toast(r.reason, true); return; } toast('The hunt is called off'); autosave(); render(); refreshSheet(); }, 'pri full', !o.ok))));
    if (sv.tavern) out.push(h('div', { class: 'card' }, h('b', { text: 'The tavern' }), h('div', { class: 'dim', style: 'margin:4px 0 8px', text: sv.tavern.doneToday ? 'You have had your fill here today. Come back tomorrow.' : 'Rumours, gossip and the odd quarrel. ' + (sv.tavern.cost ? 'A cup costs ' + sv.tavern.cost + ' g.' : 'The first cup is free on a festival day.') }),
      btn(sv.tavern.cost ? 'Sit down for a cup (' + sv.tavern.cost + ' g)' : 'Sit down for a cup (free today)', () => tavernVisit(id), 'full', sv.tavern.doneToday || ST.inventory.gold < sv.tavern.cost)));
    if (here) C.informantAt(ST, id).forEach(inf => out.push(h('div', { class: 'card', style: 'border-color:var(--gold)' }, npcHead(inf.name), h('div', { class: 'dim', style: 'margin:2px 0 6px', text: 'You see ' + inf.desc + ', watching you a little too carefully.' }),
      inf.wait ? h('div', { class: 'dim', text: '"Come back in a few days. I need time to get it out."' }) : h('div', { style: 'margin-bottom:8px', text: inf.line }),
      !inf.wait && inf.stage === 0 ? btn('Hear them out', () => informantAct(id, inf.id, 'listen'), 'full pri') : null, !inf.wait && inf.stage === 1 && inf.canProof ? btn('Take it (costs standing with ' + fname(inf.faction) + ')', () => informantAct(id, inf.id, 'take'), 'full pri') : null,
      h('div', { style: 'height:6px' }), btn('Report them to ' + fname(inf.faction), () => informantAct(id, inf.id, 'report'), 'full bad'))));
    if (here) C.npcAt(ST, id).forEach(np => out.push(h('div', { class: 'card' }, npcHead(np.name), h('div', { class: 'dim', style: 'margin:2px 0 6px', text: 'You see ' + np.desc + (np.met ? ' (you have met)' : '') + '.' }), btn(np.talkedToday ? 'You spoke today' : 'Talk', () => npcTalk(id, np.id), 'full', np.talkedToday))));
    { const nb = C.noticeBoard(ST, id); if (nb) out.push(h('details', { class: 'card' }, h('summary', { text: 'Notice board' }), nb.map(t => h('div', { class: 'dim', style: 'margin:4px 0', text: '• ' + t })))); }
    if (sv.open && (sv.shop || n.recruit) && (sv.rival === 'uneasy' || sv.rival === 'opposed') && S.sworn(ST)) out.push(h('div', { class: 'dim', style: 'margin:0 2px 8px', text: 'They know you serve the ' + fname(S.sworn(ST)) + '. ' + (sv.rival === 'opposed' ? 'Their prices are steep for you, and their recruiters will not deal with you.' : 'Their prices are a little steeper for you.') }));
    if (sv.shop) out.push(btn('Shop', () => shopSheet(id), 'full'), h('div', { style: 'height:8px' }));
    if (sv.recruit) out.push(btn('Recruit (' + S.recruitCost(ST) + ' g)', () => recruitSheet(id), 'full'), h('div', { style: 'height:8px' }));
    if (C.sanctuaryAt ? C.sanctuaryAt(ST, id) : n.owner === 'hearthwatch') out.push(h('div', { class: 'card' }, h('b', { text: n.refuge ? 'Hearthwatch refuge' : 'Hearthwatch sanctuary' }), h('div', { class: 'dim', text: 'A bed, a fire and no questions. Your wounds are tended and old trails go cold. Takes a day.' }), h('div', { style: 'height:6px' }), btn('Rest here', () => { S.advanceDay(ST, 1); S.sanctuary(ST); S.changeGoodwill(ST, 1, 'rested at a chapel'); toast('You rest. The road feels a little further behind you.'); autosave(); render(); }, 'pri full')));
    return out;
  }
  // ---------- the Sandring (data/arena.js) ----------
  function arenaCard() {
    const rings = C.arenaStatus(ST);
    return [h('div', { class: 'card' }, h('b', { text: 'Sandmaster Tamsin Reeve' }),
      h('div', { class: 'dim', style: 'font-style:italic', text: '"Gate fee at the door, purse at the end. Nobody is killed for the crowd. The sand is not so careful, so mind the floor."' }),
      h('div', { class: 'dim', style: 'margin-top:6px', text: 'Win a ring\u2019s third bout, the rank match, to open the next ring. Fight a won bout again for half the purse. Your standing with the factions never changes here.' })),
    rings.map(R => h('div', { class: 'card' },
      h('div', { class: 'row' }, h('b', { class: 'grow', text: R.name }), h('span', { class: 'shchip', text: 'Lv ' + R.band[0] + '\u2013' + R.band[1] + ' \u00b7 gate ' + R.fee + ' g' })),
      R.open ? R.bouts.map(b => h('div', { class: 'row', style: 'margin-top:6px' },
        h('div', { class: 'grow' }, (b.won ? '\u2713 ' : '') + b.n + '. ' + b.name, h('div', { class: 'dim', text: (b.n === 3 ? 'Rank match \u00b7 ' : '') + 'purse ' + b.pay + ' g' + (b.won ? ' (repeat)' : '') })),
        btn(b.open ? 'Fight' : 'Locked', () => arenaBriefing(b.id), 'sm' + (b.won || !b.open ? '' : ' pri'), !b.open)))
        : h('div', { class: 'dim', text: 'Closed until you win the rank match in ' + R.needs + '.' }))),
    tourneyCard()];
  }
  let arenaBet = { type: null, stake: 0 }, tStake = 0;
  function betPicker(boutId, fee) {
    const cap = Math.max(0, Math.min(Math.floor((ST.inventory.gold - fee) / 4), C.arenaBetMax(ST))), under = C.arenaUnderdog(ST, boutId), n = C.arenaQuickN(boutId);
    if (arenaBet.type && arenaBet.stake > cap) arenaBet.stake = cap;
    const stakes = [...new Set([Math.ceil(cap / 4), Math.ceil(cap / 2), cap].filter(x => x >= 1))], B = C.ARENA_BETS;
    const out = [h('div', { class: 'sh-h', text: 'A wager at the gate' }), h('div', { class: 'dim', text: cap ? 'The bookmaker takes up to ' + cap + ' g from you. You lose the stake if the wager fails; a draw returns it.' + (under ? ' The crowd fancies the other side, so every wager pays half as much again.' : '') : 'You have too little gold to wager.' })];
    if (cap) {
      out.push(h('div', { class: 'sh-sub', style: 'margin-top:6px;flex-wrap:wrap;gap:6px' }, btn('No wager', () => { arenaBet = { type: null, stake: 0 }; refreshSheet(); }, arenaBet.type ? '' : 'on'),
        Object.keys(B).map(k => btn(B[k].name, () => { arenaBet = { type: k, stake: arenaBet.stake || stakes[0] }; refreshSheet(); }, arenaBet.type === k ? 'on' : ''))));
      if (arenaBet.type) out.push(h('div', { class: 'dim', style: 'margin-top:6px', text: B[arenaBet.type].line.replace('the round limit', n + ' rounds') }), h('div', { class: 'sh-sub', style: 'margin-top:6px' }, stakes.map(x => btn(x + ' g', () => { arenaBet.stake = x; refreshSheet(); }, arenaBet.stake === x ? 'on' : ''))), h('div', { class: 'dim', style: 'margin-top:4px', text: 'If it comes in you get ' + C.arenaPayout(arenaBet.stake, arenaBet.type, under) + ' g back, the house taking a tenth of the winnings.' }));
    }
    return out;
  }
  function arenaBriefing(boutId) {
    arenaBet = { type: null, stake: 0 };
    sheet('The Sandring', () => {
      const b = C.arenaBout(boutId), R = C.arenaRing(b.ring), party = homeUnits();
      C.ENCOUNTERS[boutId].rec = C.arenaLevel(ST, boutId);
      const info = C.encounterBuilds(boutId, null), br = C.arenaBrief(ST, boutId), pay = C.arenaBoutWon(ST, boutId) ? Math.floor(b.purse / 2) : b.purse;
      return [h('div', { class: 'gold', text: b.name }),
        h('div', { class: 'dim', text: R.name + ' \u00b7 bout ' + b.n + (b.n === 3 ? ', the rank match' : '') + ' \u00b7 opponents about level ' + br.level }),
        h('div', { style: 'margin:8px 0;font-style:italic', text: '\u201c' + br.warn + '\u201d' }), h('div', { class: 'dim', text: br.crowd }),
        h('div', { style: 'margin-top:8px', text: 'Opponents: ' + info.builds.map(x => x.name + ' (' + cname(x.primary) + ')').join(', ') }),
        h('div', { class: 'dim', style: 'margin:6px 0', text: 'Win by defeating every opponent. The sand can knock a fighter out, and if both sides go down together the bout is a draw: no purse, and the gate keeps the fee.' }),
        h('div', { class: 'dim', text: 'Gate fee ' + R.fee + ' g \u00b7 purse ' + pay + ' g \u00b7 you have ' + ST.inventory.gold + ' g' }),
        betPicker(boutId, R.fee),
        h('div', { style: 'height:8px' }),
        btn('Pay the gate and fight', () => { const r = C.arenaEnter(ST, boutId, arenaBet.type ? arenaBet : null); if (!r.ok) { toast(r.reason, true); return; } autosave(); runBattle(boutId, null); }, 'pri full', !party.length),
        btn('Back', () => nodeSheet(ST.world.location), 'full')];
    });
  }
  function tourneyCard() {
    const ts = C.arenaTourneyStatus(ST), T = C.ARENA_TOURNEY, run = ts.run, kids = [h('div', { class: 'row' }, h('b', { class: 'grow', text: 'The Grand Tourney' }), h('span', { class: 'shchip', text: 'entry ' + T.fee + ' g' }))];
    kids.push(h('div', { class: 'dim', text: 'Eight teams, three rounds: the Sand, the Gold Circle, then the Gate. Prizes ' + T.prizes.join(', ') + ' g, and the title.' }));
    if (!run) {
      if (ts.window.open) {
        kids.push(h('div', { style: 'margin:6px 0', text: 'The lists are open until day ' + ts.window.closes + '.' }));
        const cap = Math.max(0, Math.min(Math.floor((ST.inventory.gold - T.fee) / 4), C.arenaBetMax(ST))), stakes = [...new Set([Math.ceil(cap / 4), Math.ceil(cap / 2), cap].filter(x => x >= 1))];
        if (tStake > cap) tStake = 0;
        if (cap) kids.push(h('div', { class: 'dim', text: 'A stake on your own run pays by the round you reach: lost if you fall in round one, back with a profit after that.' }), h('div', { class: 'sh-sub', style: 'margin:6px 0' }, btn('No stake', () => { tStake = 0; refreshSheet(); }, tStake ? '' : 'on'), stakes.map(x => btn(x + ' g', () => { tStake = x; refreshSheet(); }, tStake === x ? 'on' : ''))));
        kids.push(btn('Enter the lists (' + (T.fee + tStake) + ' g)', () => { const r = C.arenaTourneyEnter(ST, tStake); if (!r.ok) { toast(r.reason, true); return; } tStake = 0; autosave(); render(); refreshSheet(); }, 'pri full', ST.inventory.gold < T.fee || !ST.party.length));
      } else kids.push(h('div', { style: 'margin:6px 0', text: 'The lists are closed. They open again on day ' + ts.window.next + ' (' + ts.daysToOpen + ' day' + (ts.daysToOpen === 1 ? '' : 's') + ').' }));
    } else if (run.status === 'active') {
      const nx = C.arenaTourneyNext(ST), lv = C.ENCOUNTERS[nx.id].rec;
      kids.push(h('div', { style: 'margin:6px 0' }, 'Round ' + run.round + ' of 3. ', run.wins ? 'Beaten so far: ' + run.log.map(i => C.arenaTourneyTeam(i).name).join(', ') + '.' : 'You have not fought yet.'));
      kids.push(h('div', { class: 'card' }, h('b', { text: C.ENCOUNTERS[nx.id].name }), h('div', { class: 'dim', text: nx.team.line }), h('div', { class: 'dim', text: 'Opponents about level ' + lv + ' \u00b7 prize ' + T.prizes[run.round - 1] + ' g' + (run.round === 3 ? ' and the title' : '') }),
        btn('Fight round ' + run.round, () => { C.ENCOUNTERS[nx.id].rec = lv; autosave(); runBattle(nx.id, null); }, 'pri full', !ST.party.length)));
    } else kids.push(h('div', { class: run.status === 'champion' ? 'good' : 'dim', style: 'margin:6px 0', text: run.status === 'champion' ? 'You won the Tourney this window. Come back when the lists open again.' : 'You are out of this window\u2019s lists. They open again on day ' + ts.window.next + '.' }));
    return h('div', { class: 'card' }, kids);
  }
  function dungeonCard(d) {
    const D = C.DUNGEONS[d.id], bits = [];
    bits.push(h('b', { text: d.name }), h('div', { class: 'dim', text: 'Recommended level ' + d.rec + ' · ' + d.floors + ' floors' }), h('div', { class: 'dim', style: 'margin:4px 0', text: d.why }));
    if (d.cleared) bits.push(h('div', { class: 'good', text: d.respawn ? (d.daysLeft > 0 ? 'Cleared. It refills in ' + d.daysLeft + ' day' + (d.daysLeft === 1 ? '' : 's') + '.' : 'It has refilled.') : 'Cleared for good.' }));
    else {
      bits.push(h('div', { class: 'gold', text: (d.stage ? 'Floor ' + (d.stage + 1) + ' of ' + d.floors : 'Entrance') + ': ' + d.floorName }));
      if (d.repeat) bits.push(h('div', { class: 'dim', text: 'You have cleared this before: repeat runs pay half and have no prize.' }));
      if (d.tooEasy) bits.push(h('div', { class: 'dim', text: 'Your party is well above its level, so rewards are reduced.' }));
      if (d.stage) bits.push(h('div', { class: 'dim', text: 'If you leave, or lose, the run starts again.' }));
      bits.push(h('div', { style: 'height:6px' }), btn(d.stage ? 'Go deeper' : 'Enter', () => { const e = C.dungeonFight(ST, d.id); if (e) briefing(e); }, 'pri full'));
    }
    return h('div', { class: 'card' }, bits);
  }
  function informantAct(id, k, how) {
    const r = C.informantAct(ST, id, k, how); if (!r.ok) { toast(r.reason, true); return; } autosave(); render();
    sheet(C.INFORMANTS[k].name, () => [h('div', { style: 'margin-bottom:8px', text: r.text }), r.learned ? h('div', { class: 'good', style: 'margin-bottom:8px', text: r.proof ? 'Added to your dossier. They will come for it.' : 'Added to your dossier.' }) : null, S.visibleChanges(ST, r.changes || []).map(c => h('div', { class: 'dim', text: fname(c.faction) + ' ' + (c.delta > 0 ? '+' : '') + c.delta + ' (now ' + S.tierOf(c.to).name + ')' })), h('div', { style: 'height:8px' }), btn('Close', () => { closeSheet(); render(); }, 'full')]);
  }
  function npcTalk(id, npcId) {
    const r = C.npcTalk(ST, id, npcId); if (!r.ok) { toast(r.reason, true); return; }
    autosave(); render();
    sheet(r.name, () => [h('div', { class: 'dim', style: 'font-style:italic;margin-bottom:6px', text: r.desc }), h('div', { style: 'margin-bottom:8px', text: r.text }),
      r.tip ? h('div', { style: 'margin-bottom:8px' }, h('div', { class: 'dim', style: 'font-size:12px;font-style:italic', text: 'They lean in and add:' }), h('div', { text: r.tip })) : null,
      r.found && r.found.length ? h('div', { class: 'good', style: 'margin-bottom:8px', text: 'On your map: ' + r.found.join(', ') }) : null,
      r.gift ? h('div', { class: 'good', style: 'margin-bottom:8px', text: r.gift + ' +' + r.gold + ' g' }) : null,
      btn('Part ways', () => { closeSheet(); render(); }, 'full')]);
  }
  function tavernVisit(id) {
    const r = C.tavernVisit(ST, id); if (!r.ok) { toast(r.reason, true); return; }
    autosave(); render(); tavernSheet(r.scene, id);
  }
  function tavernSheet(sc, id) {
    sheet(sc.title, () => [
      sc.lines.map(l => h('div', { style: 'margin:0 0 8px' }, h('div', { class: 'dim', style: 'font-size:12px;font-style:italic', text: l.who }), h('div', { text: '\u201c' + l.text + '\u201d' }))),
      sc.narr ? h('div', { class: 'dim', style: 'margin:6px 0 10px', text: sc.narr }) : null,
      sc.found && sc.found.length ? h('div', { class: 'good', style: 'margin-bottom:8px', text: 'On your map: ' + sc.found.join(', ') }) : null,
      sc.choice ? h('div', { class: 'card' }, h('div', { text: sc.choice.text }), h('div', { style: 'height:8px' }), sc.choice.options.map(o => [btn(o.label, () => tavernChoose(o.id, id), 'full', false), stakes(o)]).flat()) : null,
      btn('Finish your drink', () => { closeSheet(); render(); }, 'full')]);
  }
  function tavernChoose(optId, id) {
    const r = C.tavernChoose(ST, optId); if (!r.ok) { toast(r.reason, true); return; }
    autosave(); render();
    const vis = S.visibleChanges(ST, r.changes);
    sheet('The room reacts', () => [
      r.rumour ? r.rumour.lines.map(l => h('div', { style: 'margin:0 0 8px' }, h('div', { class: 'dim', style: 'font-size:12px;font-style:italic', text: l.who }), h('div', { text: '\u201c' + l.text + '\u201d' }))) : h('div', { text: 'Nothing more is said. The evening goes on.' }),
      r.found.length ? h('div', { class: 'good', style: 'margin:6px 0', text: 'On your map: ' + r.found.join(', ') }) : null,
      r.gold ? h('div', { class: r.gold > 0 ? 'good' : 'dim', text: (r.gold > 0 ? '+' : '') + r.gold + ' g' }) : null,
      vis.map(c => h('div', { class: 'dim', text: fname(c.faction) + ' ' + (c.delta > 0 ? '+' : '') + c.delta + ' (now ' + S.tierOf(c.to).name + ')' })),
      btn('Close', () => { closeSheet(); render(); }, 'full')]);
  }
  function decide(choiceId, optId) {
    const r = C.applyChoice(ST, choiceId, optId); if (!r.ok) { toast(r.reason, true); return; }
    autosave(); render(); const oo = ((C.CHOICES[choiceId] || {}).options || []).find(x => x.id === optId); sheet('Choice made', () => [h('div', { text: (oo && oo.reply) || 'It is done.' }), r.changes.map(c => h('div', { class: 'dim', text: fname(c.faction) + ' ' + (c.delta > 0 ? '+' : '') + c.delta + ' (now ' + S.tierOf(c.to).name + ')' })), h('div', { style: 'height:8px' }), btn('Continue', closeSheet, 'pri full')]);
  }
  // Travelling: each hop takes days and the road may throw something at you. A stop for news, or for anything met on the road, pauses the journey; a met-and-settled road meeting carries on to the end of the route.
  const HOP_MS = 520;   // one leg of a journey on the map (the walk animation's hop)
  let pending = null, trip = null, walkAnim = null, walkTrail = [], roadLog = [], journey = 0;   // roadLog: sights passed on this journey, shown together on arrival
  function travel(path) { journey++; mapRegion = null; pending = path.slice(); trip = null; walkTrail = [ST.world.location]; walkAnim = null; sheetFn = null; roadLog = []; step(); }
  const sightCard = e => h('div', { class: 'card' }, h('div', { text: e.text }), e.note ? h('div', { class: e.gold || (e.found && e.found.length) ? 'good' : 'dim', style: 'margin-top:4px', text: e.note }) : null);
  function step() {
    if (!pending || !pending.length) return;
    // one leg at a time: the party walks the leg on the map, and only then does whatever waits on that road happen
    const leg = ++journey, from = ST.world.location, to = pending.shift(), r = C.travel(ST, to);
    if (!r.ok) { toast(r.reason, true); pending = null; autosave(); render(); return; }
    trip = { from: r.from, to }; walkTrail.push(to); walkAnim = { trail: [from, to], t0: Date.now() }; if (r.revealed && r.revealed.length) heard = heard.concat(r.revealed);
    const after = fn => { sheetFn = null; render(); setTimeout(() => { if (leg === journey) fn(); }, HOP_MS); };
    roadLog = roadLog.concat(r.events.filter(e => e.id === 'sight')); r.events = r.events.filter(e => e.id !== 'sight');   // sights never stop the journey
    if (r.wander) return after(() => { // not saved yet: reloading the save before the road is settled gives the same road, so it cannot be dodged
      if (r.events.length) sheet('News', () => [r.events.map(e => h('div', { class: 'card', text: e.text })), btn('Continue', () => wanderSheet(r.wander), 'pri full')], true); else wanderSheet(r.wander); });
    if (r.events.length) { autosave(); return after(() => sheet('News', () => [r.events.map(e => h('div', { class: 'card', text: e.text })), btn(pending.length ? 'Continue the journey' : 'Continue', () => { closeSheet(); if (pending.length) step(); else arrival(to); }, 'pri full'), pending.length ? [h('div', { style: 'height:6px' }), btn('Stop here', () => { pending = null; closeSheet(); arrival(to); }, 'full')] : null])); }
    if (pending.length) return after(step);
    autosave(); after(() => arrival(to));
  }
  function resume() { // after something on the road is settled
    C.endWander(ST); autosave(); sheetFn = null; render();
    if (pending && pending.length) step(); else arrival(trip && trip.to);
  }
  function wanderSheet(w) {
    C.activeWander(ST);
    if (w.kind === 'fight') {
      const e = w.enc, info = C.encounterBuilds('wander', null), party = homeUnits(), fleeGold = Math.min(ST.inventory.gold, Math.max(ST.inventory.gold ? 5 : 0, Math.round(ST.inventory.gold * C.WANDER.fleeGoldFraction)));
      return forcedSheet(e.name, () => [h('div', { text: w.text || 'Trouble on the road.' }), h('div', { class: 'dim', style: 'margin:6px 0', text: 'Enemies: ' + info.builds.map(b => cname(b.primary) + ' Lv ' + b.level).join(', ') + ' · your company: ' + party.map(u => 'Lv ' + u.level).join(', ') }),
        h('div', { class: 'gold', text: 'Objective: ' + C.objectiveText(info.objective, info.builds) }), h('div', { class: 'dim', text: 'Reward: ' + info.reward.xp + ' XP, ' + info.reward.gold + ' gold' }), h('div', { style: 'height:8px' }),
        btn('Fight', () => runBattle('wander', null), 'pri full', !party.length), h('div', { style: 'height:6px' }),
        btn('Flee (lose a day' + (fleeGold ? ' and ' + fleeGold + ' gold' : '') + ')', () => { const r = C.flee(ST); pending = null; autosave(); sheetFn = null; render(); toast(r.proof ? 'You got away, but they took the proof' : 'You got away'); if (r.events.length) sheet(r.events.every(e => e.id === 'sight') ? 'On the road' : 'News', () => [r.events.map(x => h('div', { class: 'card', text: x.text })), btn('Continue', closeSheet, 'pri full')]); }, 'full')]);
    }
    if (w.kind === 'obstacle') {
      const opts = C.obstacleOptions(ST, w);
      return forcedSheet(w.title, () => [h('div', { style: 'white-space:pre-line', text: w.text }), h('div', { style: 'height:8px' }),
        opts.map(o => [btn(o.label, () => obstacle(o.id), 'full', !o.ok), o.ok ? stakes(o) : h('div', { class: 'dim', style: 'font-size:12px;margin:3px 4px 8px', text: o.note || 'Not enough gold.' })]).flat()]);
    }
    if (w.kind === 'checkpoint') {
      const opts = C.checkpointOptions(ST, w);
      return forcedSheet('Checkpoint', () => [h('div', { text: w.text }), h('div', { class: 'dim', style: 'margin:6px 0', text: 'You are Hostile with ' + fname(w.faction) + '. A toll is the polite way through.' }), h('div', { style: 'height:8px' }),
        opts.map(o => [btn(o.label, () => checkpoint(o.id), 'full' + (o.id === 'pay' ? ' pri' : ''), !o.ok), o.note ? h('div', { class: 'dim', text: o.note }) : null, h('div', { style: 'height:6px' })]).flat()]);
    }
    if (w.kind === 'trader') {
      return forcedSheet('Wandering trader', () => [h('div', { class: 'dim', text: 'He sells at ' + Math.round(100 - w.trader.mult * 100) + '% below town prices. He will not be here tomorrow.' }), h('div', { class: 'row' }, h('span', { class: 'grow' }), h('b', { class: 'gold', text: ST.inventory.gold + ' g' })),
        w.trader.stock.map(g => { const p = S.priceOf(g, w.trader.mult); return itemRow(g, btn(p + ' g', () => { const r = C.traderBuy(ST, g); if (!r.ok) toast(r.reason, true); else { toast('Bought ' + iname(g)); render(); refreshSheet(); } }, 'sm pri', ST.inventory.gold < p)); }),
        btn('Move on', resume, 'pri full')]);
    }
    if (w.kind === 'gift') {
      return forcedSheet('A friendly patrol', () => [h('div', { text: w.text }), h('div', { style: 'height:8px' }), btn('Accept (+' + w.gold + ' gold, a tip about the roads)', () => { const r = C.claimGift(ST); const names = (r.found || []).map(id => C.NODES[id].name); autosave(); render(); forcedSheet('Roads ahead', () => [h('div', { text: names.length ? 'They tell you of: ' + names.join(', ') + '.' : 'They have nothing new to tell you, but wish you well.' }), btn('Continue', resume, 'pri full')]); }, 'pri full')]);
    }
    if (w.kind === 'event') {
      const ch = C.CHOICES[w.choice];
      return forcedSheet('On the road', () => [h('div', { style: 'white-space:pre-line', text: ch.text }), h('div', { style: 'height:8px' }), ch.options.map(o => [btn(o.label, () => roadChoice(w.choice, o), 'full', o.gold < 0 && ST.inventory.gold < -o.gold), stakes(o)])]);
    }
    resume();
  }
  // a choice's stakes, in words: who it helps or hurts (no numbers)
  function stakes(o) { return o.hint ? h('div', { class: 'dim', style: 'font-size:12px;margin:3px 4px 8px;font-style:italic', text: o.hint }) : h('div', { style: 'height:6px' }); }
  function obstacle(choice) {
    const r = C.resolveObstacle(ST, choice); if (!r.ok) { toast(r.reason, true); return; }
    if (r.turned) { pending = null; autosave(); sheetFn = null; render(); toast('You turn back'); return; }
    if (r.fight) { render(); return wanderSheet(ST.world.wander); }
    render(); forcedSheet('On the road', () => [h('div', { text: r.text }), h('div', { style: 'height:8px' }), btn('Continue', resume, 'pri full')]);
  }
  function checkpoint(choice) {
    const r = C.resolveCheckpoint(ST, choice); if (!r.ok) { toast(r.reason, true); return; }
    if (r.turned) { pending = null; autosave(); sheetFn = null; render(); toast('You turn back'); return; }
    if (r.fight) { render(); toast(r.bluffFailed ? 'They are not fooled' : 'You force the issue'); return wanderSheet(ST.world.wander); }
    toast(r.bluffed ? 'They wave you through' : 'You pay and pass'); resume();
  }
  function roadChoice(id, o) {
    const r = C.applyChoice(ST, id, o.id); if (!r.ok) { toast(r.reason, true); return; }
    if (r.fight) { render(); return wanderSheet(ST.world.wander); }
    render();
    const lines = [].concat(r.gold ? [(r.gold > 0 ? '+' : '') + r.gold + ' gold'] : [], S.visibleChanges(ST, r.changes).map(c => fname(c.faction) + ' ' + (c.delta > 0 ? '+' : '') + c.delta + ' (now ' + S.tierOf(c.to).name + ')'), (r.found || []).length ? ['You learn of: ' + r.found.map(n => C.NODES[n].name).join(', ')] : []);
    forcedSheet('On the road', () => [h('div', { text: 'You go on your way.' }), lines.map(t => h('div', { class: 'dim', text: t })), h('div', { style: 'height:8px' }), btn('Continue', resume, 'pri full')]);
  }
  let heard = [];
  function arrival(id) { if (!id) return; guideCheck();
    if (roadLog.length) { const log = roadLog; roadLog = []; autosave(); render(); sheet('On the road', () => [log.map(sightCard), btn('Onward', () => { closeSheet(); arrival(id); }, 'pri full')]); return; } const jc = C.jobCheck(ST); if (jc.length) { autosave(); render(); } const sv = C.nodeServices(ST, id), n = C.NODES[id], h2 = heard; heard = []; if (sv.encounter && (n.type === 'road' || n.was === 'battle')) nodeSheet(id); else toast('Arrived at ' + n.name + (h2.length ? '. You hear of ' + h2.join(', ') + '.' : '') + (jc.length ? ' Job step done: ' + jc.map(x => x.step).join('; ') + '.' : ''));
    const lt = C.takeLetters(ST); if (lt.length) { autosave(); render(); sheet('A letter', () => [lt.map(l => h('div', { class: 'card' }, h('div', { class: 'dim', style: 'font-size:12px;font-style:italic', text: 'A sealed note finds you' }), h('div', { text: '\u201c' + l.text + '\u201d' }), h('div', { class: 'good', text: '+' + l.gold + ' g' }))), btn('Pocket it', () => { closeSheet(); render(); }, 'full')]); } }

  // ---------- shop and recruit ----------
  let shopTab = 'buy';
  function shopSheet(id) {
    sheet(C.NODES[id].name + ' shop', () => {
      const sv = C.nodeServices(ST, id); if (!sv.shop) return h('div', { text: sv.owner === 'outlaws' ? 'Raiders hold this place now. There is no shop, only what they have not yet carried off.' : sv.tier === 'hostile' ? 'The shutters stay down. The keeper knows the name on the notices, and it is yours.' : 'The shop is closed.' });
      const mult = sv.shop.priceMult, out = [h('div', { class: 'row' }, h('span', { class: 'dim grow', text: mult !== 1 ? (mult < 1 ? Math.round(100 - mult * 100) + '% off' : Math.round(mult * 100 - 100) + '% dearer') + (sv.shop.event ? ' (' + sv.shop.event + ')' : '') + (sv.shop.festival ? ' (' + sv.shop.festival + ')' : '') : 'Standard prices' }), h('b', { class: 'gold', text: ST.inventory.gold + ' g' })),
        h('div', { class: 'sh-sub', style: 'margin-top:8px' }, btn('Buy', () => { shopTab = 'buy'; refreshSheet(); }, shopTab === 'buy' ? 'on' : ''), btn('Sell', () => { shopTab = 'sell'; refreshSheet(); }, shopTab === 'sell' ? 'on' : ''))];
      if (shopTab === 'buy') sv.shop.stock.forEach(g => { const p = S.priceOf(g, mult); out.push(itemRow(g, btn(p + ' g', () => { const r = C.buy(ST, id, g); if (!r.ok) toast(r.reason, true); else { toast('Bought ' + iname(g)); autosave(); render(); guideCheck(); } }, 'sm pri', ST.inventory.gold < p))); });
      else { const items = Object.entries(ST.inventory.items); if (!items.length) out.push(h('div', { class: 'dim', text: 'Your stash is empty. Only items in the stash can be sold, not gear a unit is wearing.' })); items.forEach(([g, n]) => out.push(itemRow(g, btn('Sell ' + S.sellValue(g) + ' g', () => { const r = C.sell(ST, id, g); if (!r.ok) toast(r.reason, true); else { toast('Sold ' + iname(g)); autosave(); render(); } }, 'sm'), n))); }
      return out;
    });
  }
  function itemRow(g, action, count) { const it = D.gear[g]; return h('div', { class: 'card' }, h('div', { class: 'row' }, slotIcon(g), h('div', { class: 'grow' }, h('b', { text: it.name + (count > 1 ? ' ×' + count : '') }), h('div', { class: 'dim', text: SLOT_NAME[it.slot] + (it.weapon ? ' · ' + it.weapon.family + (it.weapon.hands === 2 ? ' (2h)' : '') : it.weight ? ' · ' + it.weight : '') }), h('div', { class: 'dim', text: it.desc })), action)); }
  function recruitSheet(id) {
    sheet('Recruit', () => {
      const sv = C.nodeServices(ST, id), cost = S.recruitCost(ST), price = cl => Math.round(cost * (C.recruitMult ? C.recruitMult(ST, id, cl) : 1)); if (!sv.recruit) return [h('div', { class: 'dim', text: 'No one is taking on recruits here right now.' })];
      const race = sv.recruit.race;
      return [h('div', { class: 'dim', text: (D.races[race] ? D.races[race].name + ' recruits' : 'Recruits') + ' start at level ' + S.recruitLevel(ST) + ' and are yours to build. Roster ' + ST.roster.length + '/' + S.RULES.rosterCap + ' · ' + ST.inventory.gold + ' g' }), h('div', { style: 'height:8px' }),
        S.entryClasses().map(cl => h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', { class: 'grow' }, h('b', { text: cname(cl) }), h('div', { class: 'dim', text: D.classes[cl].signature })), btn(price(cl) + ' g', () => { const r = S.recruit(ST, cl, { race, mult: C.recruitMult ? C.recruitMult(ST, id, cl) : 1 }); if (!r.ok) toast(r.reason, true); else { toast(r.unit.name + ' joins you'); autosave(); render(); } }, 'sm pri', ST.inventory.gold < price(cl) || ST.roster.length >= S.RULES.rosterCap))))];
    });
  }

  // ---------- briefing, battle, results ----------
  function briefing(encId) {
    const e = C.ENCOUNTERS[encId];
    sheet(e.name, () => {
      const party = homeUnits(), out = [];
      out.push(h('div', { class: 'dim', text: 'Recommended level ' + (e.rec || 1) + ' · your company: ' + party.map(u => u.name + ' (Lv ' + u.level + ')').join(', ') }));
      const start = (optId) => {
        const info = C.encounterBuilds(encId, optId), lim = C.partyLimit(ST, info.map), fielded = Math.min(party.length, lim);
        return h('div', { class: 'card' },
          h('div', { class: 'gold', text: 'Objective: ' + C.objectiveText(info.objective, info.builds) }),
          info.standing ? h('div', { class: 'dim', text: Object.entries(info.standing).map(([f, n]) => fname(f) + ' ' + (n > 0 ? '+' : '') + n).join(' · ') }) : null,
          h('div', { text: 'Enemies: ' + info.builds.map(b => cname(b.primary) + ' Lv ' + b.level).join(', ') }),
          h('div', { class: 'dim', text: 'Reward: ' + [info.reward.xp ? info.reward.xp + ' XP' : '', info.reward.gold ? info.reward.gold + ' gold' : '', ...Object.keys(info.reward.items || {}).map(iname)].filter(Boolean).join(', ') }),
          party.length > lim ? h('div', { class: 'dim', text: 'This ground holds ' + lim + ' of you. You choose who deploys on the next screen.' }) : null,
          fielded < info.builds.length ? h('div', { class: 'badc', text: 'They outnumber you: ' + info.builds.length + ' against your ' + fielded + '.' }) : null,
          h('div', { style: 'height:8px' }), btn('Start battle', () => runBattle(encId, optId), 'pri full', !party.length));
      };
      if (e.options) e.options.forEach(o => out.push(h('div', {}, h('b', { text: o.label }), start(o.id)))); else out.push(start(null));
      out.push(btn('Roster', () => { closeSheet(); tab = 'party'; render(); }, 'full'));
      return out;
    });
  }
  // A story scene on the battle board (design/cinematics.md). Returns false when there is no script, so the caller shows its sheet instead.
  function playScene(id, cb) {
    const sc = typeof id === 'object' ? id : C.sceneScript && C.sceneScript(ST, id); if (!sc || !window.Battle || !window.Battle.scene) return false;
    sheetFn = null; refreshSheet(); window.__campaignBattle = true; showShell(false);
    window.Battle.scene(sc, { onChoose: cb && cb.onChoose, onDone: ch => { window.__campaignBattle = false; showShell(true); render(); if (cb && cb.onDone) cb.onDone(ch); } });
    return true;
  }
  function runBattle(encId, optId) {
    const info = C.encounterBuilds(encId, optId), lim = C.partyLimit(ST, info.map), all = homeUnits().map(u => S.toBuild(u)), builds = all.slice(0, lim);
    // everyone at home is on the deployment screen (the first lim start deployed); whoever is deployed is recorded as the party, so XP and JP follow them
    const bench = all.slice(lim); sheetFn = null; refreshSheet();
    window.__campaignBattle = true; showShell(false); document.body.classList.add('campaign');
    addRetreat();
    window.Battle.start({ map: info.map, hazards: info.hazards, swapSides: info.swap, objective: info.objective, hideOverlay: true, placement: true, playerBuilds: builds, benchBuilds: bench, limit: lim, onDeploy: ids => { if (ids.length && ids.join() !== ST.party.join()) S.setParty(ST, ids); }, enemyBuilds: info.builds, onEnd: res => { window.__campaignBattle = false; removeRetreat(); afterBattle(encId, optId, res); } });
  }
  function addRetreat() { const top = document.querySelector('#top span'); if (!top || document.getElementById('sh-retreat')) return; const b = h('button', { id: 'sh-retreat', class: 'a sm', text: 'Retreat', onclick: e => { const b = e.currentTarget; if (b.dataset.arm) { window.Battle.abort(); return; } b.dataset.arm = '1'; b.textContent = 'Tap again to retreat (counts as a defeat)'; setTimeout(() => { if (b.isConnected) { delete b.dataset.arm; b.textContent = 'Retreat'; } }, 3000); } }); top.appendChild(b); }
  function removeRetreat() { const b = document.getElementById('sh-retreat'); if (b) b.remove(); }
  function afterBattle(encId, optId, res) {
    const wasRep = !!(C.ENCOUNTERS[encId] && C.ENCOUNTERS[encId].arena && C.arenaBoutWon(ST, encId));
    // a snapshot of every unit before the result is applied, for the XP bars, level-up gains and newly learnable skills
    const can = u => { const L = S.learnable(u); return new Set(L.skills.concat(L.passives).filter(x => x.affordable).map(x => x.id)); };
    const before = {}; ST.roster.forEach(u => { const t = statsOf(u, u.gear); before[u.id] = { level: u.level, xp: u.xp, hp: t.hp, mp: t.mp, can: can(u), cls: u.primary }; });
    const r = C.applyEncounterResult(ST, encId, optId, res), aw = r.awards || {};
    if (!res.won) { S.advanceDay(ST, 1); }
    autosave(); showShell(true); tab = 'map'; render(); guideCheck();
    const e = C.ENCOUNTERS[encId], stand = S.visibleChanges(ST, aw.standingChanges), info = C.encounterBuilds(encId, optId);
    const lead = res.draw ? 'Both sides went down together. No purse, and the gate keeps your fee.' : res.won ? '' : ((e && e.arena) ? 'Your party was beaten. The gate keeps your fee. ' : res.objective && res.objective !== 'rout' && res.survivors && res.survivors.length ? 'The objective slipped away. ' : 'Your party was beaten. ') + 'A day passes while you recover.';
    // everything that is not spoils or the company goes on a second page, Reports
    const reports = [
      r.dungeon ? dungeonResult(r.dungeon, res.won) : null,
      r.attack && r.attack.won && !r.attack.taken ? h('div', { class: 'card good', text: 'The ' + fname(r.attack.by) + ' takes ' + r.attack.stageName + ' at ' + C.NODES[r.attack.target].name + '. The siege goes on.' }) : null,
      r.attack && r.attack.fell ? h('div', { class: 'card good', text: 'The ' + fname(r.attack.fell.faction) + ' is no more.' + (r.attack.fell.rank ? ' Your rank went with it.' : '') }) : null,
      r.attack && (r.attack.taken || !r.attack.won) ? h('div', { class: 'card good', text: r.attack.won ? C.NODES[r.attack.target].name + ' falls to the ' + fname(r.attack.by) + '. They will not forget who opened the way.' : 'The ' + fname(r.attack.by) + ' falls back from ' + C.NODES[r.attack.target].name + '. The ' + fname(r.attack.on) + ' will not forget who held the line.' }) : null,
      r.proof ? h('div', { class: 'card ' + (r.proof.kept ? 'good' : 'badc'), text: r.proof.text }) : null,
      r.wager ? h('div', { class: 'card ' + (r.wager.result === 'won' ? 'good' : 'dim'), text: r.wager.result === 'won' ? 'Your wager came in: ' + C.ARENA_BETS[r.wager.type].name + '. The bookmaker pays ' + r.wager.payout + ' g.' : r.wager.result === 'draw' ? 'A draw: the bookmaker returns your ' + r.wager.stake + ' g.' : 'Your wager on ' + C.ARENA_BETS[r.wager.type].name.toLowerCase() + ' lost (' + r.wager.why + '). The stake is gone.' }) : null,
      r.tourney ? h('div', { class: 'card ' + (r.tourney.out || r.tourney.draw ? 'dim' : 'good') }, h('b', { text: r.tourney.draw ? 'A draw' : r.tourney.out ? 'Out of the Tourney' : r.tourney.champion ? 'Champions of the Sandring' : 'Through to round ' + r.tourney.next }), h('div', { class: 'dim', text: r.tourney.draw ? 'Nobody wins a draw. The round is fought again.' : r.tourney.out ? 'The other teams carry on without you.' : r.tourney.champion ? 'The crowd is on its feet.' : 'The crowd will see you again.' }), r.tourney.stake ? h('div', { class: 'dim', text: r.tourney.stake.payout ? 'Your stake pays ' + r.tourney.stake.payout + ' g.' : 'Your stake on the run is lost.' }) : null) : null,
      (r.bestiary || []).length ? h('div', { class: 'card' }, h('b', { text: 'Bestiary updated' }), r.bestiary.map(x => h('div', { class: 'dim', text: C.BEASTS[x.id].name + ': ' + (x.tier === 1 ? 'now known' : x.tier === 2 ? 'you have seen how it fights' : 'you have learned what hurts it') }))) : null,
      stand.length ? h('div', { class: 'card' }, h('b', { text: 'Reputation' }), stand.map(c => h('div', { class: 'row' }, h('span', { class: 'grow', text: fname(c.faction) }), h('span', { class: c.delta > 0 ? 'good' : 'badc', text: (c.delta > 0 ? '+' : '') + c.delta + ' (' + S.tierOf(c.to).name + ')' })))) : null
    ].filter(Boolean);
    const spoils = [];
    if (res.won) { const g = Math.floor((info.reward.gold || 0) / (wasRep ? 2 : 1)); if (g) spoils.push({ gold: g, text: g + ' gold' }); Object.keys(info.reward.items || {}).forEach(i => spoils.push({ item: i })); }
    (r.drops || []).forEach(i => spoils.push({ item: i }));
    (r.uniques || []).forEach(i => spoils.push({ item: i, unique: true }));
    if (r.purse) spoils.push({ gold: r.purse, text: 'Purse: ' + r.purse + ' gold' });
    const goOn = () => { VIC = null; drawVictory(); if (r.dungeon) { sheetFn = null; render(); nodeSheet(ST.world.location); return; } if (e && e.arena) { sheetFn = null; render(); nodeSheet(ST.world.location); return; } if (encId !== 'wander') { closeSheet(); return; } if (res.won) resume(); else { C.turnBack(ST, trip && trip.from); pending = null; autosave(); sheetFn = null; render(); } };
    const company = (aw.xpAwards || []).map(x => { const u = unit(x.unit), b = before[x.unit] || {}, jp = (aw.jpAwards || []).find(j => j.unit === x.unit), t = u ? statsOf(u, u.gear) : {};
        const nowCan = u ? [...can(u)].filter(i => !(b.can || new Set()).has(i)) : [];
        return u && { u, x, jp: jp ? jp.jp : 0, b, dhp: t.hp - (b.hp || t.hp), dmp: t.mp - (b.mp || t.mp), learn: nowCan.map(i => aname(i) || (D.passives[i] || {}).name || i) }; }).filter(Boolean);
    (aw.jpAwards || []).forEach(j => { if (!company.some(c => c.u.id === j.unit) && unit(j.unit)) company.push({ u: unit(j.unit), x: null, jp: j.jp, b: before[j.unit] || {}, dhp: 0, dmp: 0, learn: [] }); });
    const st = res.unitStats || {}, score = id => { const k = st[id] || {}; return (k.kills || 0) * 1000 + (k.dmg || 0) * 3 + (k.helps || 0) * 25 + (k.uses || 0); };
    const best = company.map(c => c.u.id).sort((a, b) => score(b) - score(a))[0];
    VIC = { won: res.won, draw: res.draw, title: res.draw ? 'A Draw' : res.won ? 'The Enemy Is Vanquished' : 'Defeat', tag: res.draw ? 'Neither side stands' : res.won ? 'Victory is yours!' : 'The field is lost', lead,
      line: [(e ? e.name : 'The fight'), res.won ? 'won in round ' + (res.rounds || res.turns) : 'round ' + (res.rounds || res.turns), (res.fallen || []).length ? (res.fallen || []).length + ' fell' : 'no one fell'].join(' · '),
      spoils, company, best: best && score(best) > 0 ? { u: unit(best), s: st[best] || {} } : null,
      bench: (aw.benchAwards || []).map(b => unit(b.unit)).filter(Boolean), reports, page: 0, goOn, anim: true };
    drawVictory();
  }

  // ---------- victory screen (UI pass phase 4) ----------
  let VIC = null;
  function drawVictory() {
    let root = document.getElementById('vic');
    if (!VIC) { if (root) root.remove(); return; }
    if (!root) { root = h('div', { id: 'vic' }); lpBind(root); document.getElementById('shell').appendChild(root); }
    root.innerHTML = ''; root.className = (VIC.won ? 'won' : 'lost') + ' n' + VIC.company.length;
    root.appendChild(VIC.page ? vicReports() : vicMain());
    if (VIC.anim && !VIC.page) { VIC.anim = false; requestAnimationFrame(() => requestAnimationFrame(() => root.querySelectorAll('[data-to]').forEach(i => { i.style.width = i.dataset.to; }))); }
    else root.querySelectorAll('[data-to]').forEach(i => { i.style.transition = 'none'; i.style.width = i.dataset.to; });
  }
  // a named NPC's portrait beside their name (portraits/npc/), or just the name
  const npcHead = name => { const src = window.PORT && PORT.npcSrc ? PORT.npcSrc(name) : ''; return src ? h('div', { style: 'display:flex;align-items:center;gap:10px;margin-bottom:2px' }, h('img', { src, alt: '', style: 'width:52px;height:52px;border:1px solid var(--gold);border-radius:4px;background:#1a1f2a;flex:none' }), h('b', { text: name })) : h('b', { text: name }); };
  const portOf = u => window.PORT && PORT.url ? PORT.url({ name: u.name, race: u.race, primary: u.primary }, 'P') : '';
  const portImg = (u, cls) => { const s = portOf(u); return s ? h('img', { class: cls, alt: '', src: s }) : h('div', { class: cls, text: u.name[0] }); };
  function vicBanner() {
    return h('div', { class: 'vic-ban' }, h('h1', { text: VIC.title }), h('div', { class: 'vic-tag', text: VIC.tag }), h('div', { class: 'dim', text: VIC.line }), VIC.lead ? h('div', { class: 'vic-lead', text: VIC.lead }) : null);
  }
  function vicMain() {
    const sp = frame('vic-sp', colHead('SPOILS OF WAR'), VIC.spoils.length ? VIC.spoils.map(x => {
      const ic = x.item ? slotIcon(x.item) : h('span', { class: 'stv-slot vic-coin' }, h('b', { text: '◎' }));
      const r = h('div', { class: 'vic-li' }, ic, h('b', { text: x.item ? iname(x.item) : x.text }), x.unique ? h('span', { class: 'stv-e', text: 'RARE' }) : null);
      return x.item ? lp(r, () => itemDetail(x.item)) : r; }) : h('div', { class: 'dim vic-none', text: VIC.won ? 'Nothing taken this time.' : 'Nothing taken.' }));
    const b = VIC.best, best = frame('vic-best', colHead('GREATEST CONTRIBUTION'), b ? [portImg(b.u, 'vic-bp'), h('b', { class: 'stv-serif', text: b.u.name }),
      h('div', { class: 'dim', text: [b.s.kills ? b.s.kills + (b.s.kills === 1 ? ' foe' : ' foes') + ' felled' : '', b.s.dmg ? b.s.dmg + ' damage dealt' : '', b.s.helps ? b.s.helps + ' aid' + (b.s.helps === 1 ? '' : 's') + ' to allies' : ''].filter(Boolean).join(' · ') })] : h('div', { class: 'dim vic-none', text: '—' }));
    const co = frame('vic-co', colHead('THE COMPANY'), h('div', { class: 'vic-rows' }, VIC.company.map(vicRow)));
    const benchN = VIC.bench.map(u => u.name), share = Math.round(100 * S.RULES.bench.rate);
    return h('div', { class: 'vic-screen' }, vicBanner(), h('div', { class: 'vic-l' }, h('div', { class: 'vic-top' }, sp, best)), h('div', { class: 'vic-r' }, co,
      h('div', { class: 'vic-foot' }, benchN.length ? h('div', { class: 'dim vic-bench', text: 'On the bench: ' + (benchN.length > 3 ? benchN.slice(0, 3).join(', ') + ' and ' + (benchN.length - 3) + ' more' : benchN.join(benchN.length === 2 ? ' and ' : ', ')) + (benchN.length === 1 ? ' takes' : ' take') + ' a ' + share + '% share.' }) : null,
        btn(VIC.reports.length ? 'Next: reports (' + VIC.reports.length + ')' : 'Continue', () => { if (VIC.reports.length) { VIC.page = 1; drawVictory(); } else VIC.goOn(); }, 'pri vic-go'))));
  }
  function vicRow(c) {
    const u = c.u, x = c.x, lv = x && x.levelUps, a = LO.xpForLevel(u.level), nb = LO.xpForLevel(u.level + 1), cap = u.level >= LO.levelMods(999).level;
    const pct = v => Math.max(0, Math.min(100, Math.round(100 * (v - a) / Math.max(1, nb - a)))) + '%', from = lv ? '0%' : pct(c.b.xp || u.xp), to = cap ? '100%' : pct(u.xp);
    const subs = [h('span', { class: 'jp', text: '+' + c.jp + ' JP in ' + cname(u.primary) }), lv && (c.dhp || c.dmp) ? h('span', { class: 'dim', text: [c.dhp ? 'HP +' + c.dhp : '', c.dmp ? 'MP +' + c.dmp : ''].filter(Boolean).join(' · ') }) : null,
      c.learn.length ? h('span', { class: 'new', text: '✦ ' + c.learn[0] + (c.learn.length > 1 ? ' +' + (c.learn.length - 1) : '') + ' can be learned' }) : null];
    const r = h('div', { class: 'vic-u' + (lv ? ' up' : ''), role: 'button', onclick: () => openStatus(u.id) }, portImg(u, 'vic-p'),
      h('div', { class: 'vic-ut' }, h('div', { class: 'vic-un' }, h('b', { class: 'stv-serif', text: u.name }), h('span', { class: 'dim', text: cname(u.primary) + ' · Lv ' + (lv ? x.from + ' → ' + x.to : u.level) }), lv ? h('em', { class: 'vic-lv', text: 'LEVEL UP' }) : null, h('span', { class: 'xp', text: x ? '+' + x.gained + ' XP' : '' })),
        h('div', { class: 'vic-bar' }, h('i', { class: 'old', style: 'width:' + from }), h('i', { class: 'gain', style: 'left:' + from + ';width:0', 'data-to': 'calc(' + to + ' - ' + from + ')' })),
        h('div', { class: 'vic-sub' }, subs)));
    return c.learn.length ? lp(r, () => [h('b', { class: 'stv-serif', text: u.name + ' can now learn' }), c.learn.map(n => h('div', { text: '✦ ' + n })), h('div', { class: 'dim', text: 'Spend JP with Learn on the Status screen (tap the unit).' })]) : r;
  }
  function vicReports() {
    return h('div', { class: 'vic-screen vic-rep' }, vicBanner(), frame('vic-rf', colHead('REPORTS'), h('div', { class: 'vic-rl' }, VIC.reports)), h('div', { class: 'vic-foot' }, btn('Back', () => { VIC.page = 0; drawVictory(); }), btn('Continue', () => VIC.goOn(), 'pri vic-go')));
  }

  function dungeonResult(d, won) {
    const D = C.DUNGEONS[d.id];
    if (!won) return h('div', { class: 'card badc', text: 'The run is lost. The dungeon closes up behind you and you will have to start again.' });
    if (d.final) return h('div', { class: 'card good', text: D.name + ' is cleared. ' + (d.respawn ? 'It will refill in ' + d.respawn + ' days.' : 'It stays quiet for good.') });
    return h('div', { class: 'card', text: 'Floor ' + d.floor + ' of ' + D.floors.length + ' done. Go deeper, or leave and the run starts again.' });
  }

  // ---------- party ----------
  function xpBar(u) { const a = LO.xpForLevel(u.level), b = LO.xpForLevel(u.level + 1), pct = u.level >= LO.levelMods(999).level ? 100 : Math.round(100 * (u.xp - a) / Math.max(1, b - a)); return h('div', { class: 'bar' }, h('i', { style: 'width:' + pct + '%' })); }
  function partyScreen(main) {
    const back = S.dispatchCollect(ST);   // anyone whose time is up comes home and is paid when the roster is opened
    if (back.length) { toast(back.map(b => b.name + ' is back from ' + S.RULES.dispatch.kinds[b.kind].name.toLowerCase() + ': +' + b.xp + ' XP, +' + b.jp + ' JP' + (b.gold ? ', +' + b.gold + ' g' : '') + (b.levelUps ? ' (level up)' : '')).join(' · ')); autosave(); }
    const stashN = Object.values(ST.inventory.items).reduce((a, b) => a + b, 0), away = S.dispatchState(ST).out, awayOf = id => away.find(e => e.unit === id);
    main.appendChild(h('div', { class: 'pad' },
      h('div', { class: 'row' }, h('div', { class: 'grow' }, h('b', { text: 'Roster' }), h('div', { class: 'dim', text: 'Roster ' + ST.roster.length + '/' + S.RULES.rosterCap + ' · away ' + away.length + '/' + S.RULES.dispatch.maxOut + ' · stash ' + stashN + ' item' + (stashN === 1 ? '' : 's') })), btn('Stash', stashSheet, 'sm')),
      h('div', { style: 'height:8px' }),
      ST.roster.map((u, i) => { const aw = awayOf(u.id), cu = S.catchUp(ST, u);
        return h('div', { class: 'card', onclick: () => openStatus(u.id) },
        h('div', { class: 'row' }, h('div', { class: 'grow' }, h('b', { text: u.name }), ' ', h('span', { class: 'dim', text: (D.races[u.race] ? D.races[u.race].name + ' · ' : '') + 'Lv ' + u.level + ' · ' + cname(u.primary) + (u.secondary ? ' / ' + cname(u.secondary) : '') })),
          aw ? h('span', { class: 'dim', text: 'Away' }) : [
            i > 0 ? btn('Send out', e => { e.stopPropagation(); dispatchSheet(u.id); }, 'sm') : null]),
        xpBar(u), h('div', { class: 'dim', text: S.jpOf(u, u.primary) + ' JP in ' + cname(u.primary) }),
        aw ? h('div', { class: 'dim', text: S.RULES.dispatch.kinds[aw.kind].name + ': back on day ' + aw.end + ' (day ' + ST.world.day + ' now)' }) : null,
        cu > 1 ? h('div', { class: 'dim', text: 'Catching up: +' + Math.round((cu - 1) * 100) + '% XP and JP' }) : null,
        S.nothingLeft(u) ? h('div', { class: 'dim', text: 'Nothing left to learn as ' + cname(u.primary) + '. A new class would give them something to work on.' }) : null); })));
  }
  function dispatchSheet(unitId) {
    const u = ST.roster.find(x => x.id === unitId); if (!u) return;
    sheet('Send out ' + u.name, () => {
      const D0 = S.RULES.dispatch, out = S.dispatchState(ST).out.length, full = out >= D0.maxOut;
      return [h('div', { class: 'dim', text: u.name + ' is gone for the days shown and is paid on return, into ' + cname(u.primary) + '. ' + out + '/' + D0.maxOut + ' away now.' }), h('div', { style: 'height:8px' }),
        Object.entries(D0.kinds).map(([k, K]) => { const rw = S.dispatchReward(ST, u, k);
          return h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', { class: 'grow' }, h('b', { text: K.name + ' · ' + K.days + ' days' }), h('div', { class: 'dim', text: K.desc }), h('div', { class: 'dim', text: 'About ' + rw.xp + ' XP, ' + rw.jp + ' JP' + (rw.gold ? ', ' + rw.gold + ' g' : '') })),
            btn('Send', () => { const r = S.dispatchSend(ST, unitId, k); if (!r.ok) toast(r.reason, true); else { toast(u.name + ' sets out'); autosave(); closeSheet(); render(); } }, 'sm pri', full))); })];
    });
  }
  function stashSheet() { sheet('Stash', () => { const it = Object.entries(ST.inventory.items); return it.length ? it.map(([g, n]) => itemRow(g, null, n)) : h('div', { class: 'dim', text: 'Nothing in the stash. Gear comes from drops and shops; items you unequip land here.' }); }); }

  function unitSummary(u) {
    const d = LO.derive(u.primary, u.gear, u.passives, u.race), cls = D.classes[u.primary], lm = LO.levelMods(u.level), hp = Math.round((cls.hp + d.stat.hp) * lm.hp);
    return h('div', { class: 'dim', text: 'HP ' + hp + ' · armor ' + Math.round(d.armor) + '% · res ' + Math.round(d.res) + '% · move ' + (cls.mv + d.stat.mv) + ' · jump ' + (cls.jump + d.stat.jump) + ' · mana ' + d.manaMax + (u.level > 1 ? ' · power ×' + lm.power.toFixed(2) : '') });
  }
  let uTab = 'class';
  function unitSheet(id, t) {
    if (t) uTab = t;
    const u0 = unit(id); sheet(u0.name + ' · Lv ' + u0.level, () => {
      const u = unit(id), subs = [['class', 'Class'], ['skills', 'Skills'], ['passives', 'Passives'], ['gear', 'Gear']];
      const nameIn = document.createElement('input'); nameIn.type = 'text'; nameIn.maxLength = 20; nameIn.value = u.name; nameIn.setAttribute('aria-label', 'Name'); nameIn.style.cssText = 'flex:1;min-width:0;padding:8px;border-radius:8px;border:1px solid var(--line,#555);background:rgba(0,0,0,.25);color:inherit;font:inherit';
      const doRename = () => { const v = nameIn.value.replace(/\s+/g, ' ').trim().slice(0, 20); if (!v) { toast('A name cannot be empty.', true); return; } u.name = v; if (ST.roster[0] === u) { if (ST.player) ST.player.name = v; if (ST.meta) ST.meta.name = v + ' \u00b7 ' + ((D.races[u.race] || {}).name || ''); } autosave(); toast('Renamed to ' + v + '.'); render(); unitSheet(id); };
      nameIn.addEventListener('keydown', e => { if (e.key === 'Enter') doRename(); });
      const out = [h('div', { class: 'row', style: 'gap:6px;margin-bottom:8px' }, nameIn, btn('Rename', doRename, 'sm')), unitSummary(u), h('div', { style: 'height:8px' }), h('div', { class: 'sh-sub' }, subs.map(([k, l]) => btn(l, () => { uTab = k; refreshSheet(); }, 'sm ' + (uTab === k ? 'on' : '')))) ];
      out.push(uTab === 'class' ? classTab(u) : uTab === 'skills' ? skillsTab(u) : uTab === 'passives' ? passivesTab(u) : gearTab(u));
      return out;
    });
  }
  function classTab(u) {
    const un = u.unlocked.slice().sort((a, b) => D.classes[a].tier - D.classes[b].tier || cname(a).localeCompare(cname(b)));
    const opt = (v, sel, label) => h('option', { value: v, selected: sel, text: label });
    const pSel = h('select', { onchange: e => changeClass(u.id, e.target.value, u.secondary) }, un.map(c => opt(c, c === u.primary, cname(c) + ' (tier ' + D.classes[c].tier + ')')));
    const sSel = h('select', { onchange: e => changeClass(u.id, u.primary, e.target.value || null) }, opt('', !u.secondary, 'None'), un.filter(c => c !== u.primary).map(c => opt(c, c === u.secondary, cname(c) + ' (' + S.knownSkills(u, c).length + '/' + D.classes[c].ab.length + ' skills)')));
    const locked = Object.keys(D.classes).filter(c => D.classes[c].selectable !== false && !u.unlocked.includes(c)).sort((a, b) => D.classes[a].tier - D.classes[b].tier);
    return [h('div', { class: 'sh-h', text: 'Primary class' }), pSel, h('div', { class: 'sh-h', text: 'Secondary kit (only skills you have learned)' }), sSel,
      h('div', { class: 'sh-h', text: 'Mastery' }), un.map(c => h('span', { class: 'shchip' + (S.isMastered(u, c) ? ' ok' : ''), text: cname(c) + ' ' + S.knownSkills(u, c).length + '/' + D.classes[c].ab.length })),
      h('div', { class: 'sh-h', text: 'Locked classes' }), h('details', {}, h('summary', { class: 'dim', text: locked.length + ' to unlock by mastering other classes' }),
        locked.map(c => h('div', { class: 'card' }, h('b', { text: cname(c) }), ' ', h('span', { class: 'dim', text: 'tier ' + D.classes[c].tier }), h('div', {}, D.classes[c].requires.map(r => h('span', { class: 'shchip' + (S.isMastered(u, r) ? ' ok' : ''), text: cname(r) + ' ' + S.knownSkills(u, r).length + '/' + D.classes[r].ab.length }))))))];
  }
  function changeClass(id, p, s) {
    const r = S.setClass(ST, id, p, s || null); if (!r.ok) { toast(r.reason, true); refreshSheet(); return; }
    toast(r.needsWeapon ? 'No weapon this class can wield: buy or equip one' : r.returned.length ? 'Unusable gear went to the stash' : 'Class changed'); autosave(); render(); refreshSheet();
  }
  // The skill's real numbers for this unit's gear and level (enemy armor and resistance not included).
  function calcLines(cu, A, a) {
    const t = LO.skillCalcText(cu, A, a); if (!t) return null;
    return h('div', { style: 'margin-top:4px' }, h('div', { class: 'gold', text: t.head }), t.detail ? h('div', { class: 'dim', text: t.detail }) : null, t.extra.map(x => h('div', { class: 'dim', text: x })));
  }
  function skillsTab(u) {
    const cls = D.classes[u.primary], known = new Set(S.knownSkills(u, u.primary)), pool = S.jpOf(u, u.primary), L = S.learnable(u);
    const dv = LO.derive(u.primary, u.gear, u.passives, u.race), cu = { wpn: dv.wpn, spellPow: dv.spellPow, healPow: dv.healPow, armor: dv.armor, mods: { power: dv.power }, lvPow: LO.levelMods(u.level).power };
    return [h('div', { class: 'row' }, h('b', { class: 'grow', text: cname(u.primary) + (S.isMastered(u, u.primary) ? ' · mastered' : '') }), h('b', { class: 'gold', text: pool + ' JP' })),
      cls.ab.map(a => { const A = D.abilities[a] || {}, ok = known.has(a), cost = S.skillCost(u.primary, a);
        return h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', { class: 'grow' }, h('b', { text: aname(a) }), A.c !== undefined ? h('span', { class: 'dim', text: '  ' + A.c + ' AP' }) : null, h('div', { class: 'dim', text: A.desc || '' }), h('div', { class: A.tags && A.tags.includes('spell') ? 'gold' : 'dim', style: 'font-size:11px' + (A.k === 'heal' ? ';color:var(--ok)' : ''), text: LO.typeLabel(A) }), calcLines(cu, A, a)),
          ok ? h('span', { class: 'good', text: 'Known' }) : btn(cost + ' JP', () => learn(u.id, a), 'sm pri', pool < cost))); }),
      L.skills.length ? null : h('div', { class: 'dim', text: 'Every skill of this class is learned.' })];
  }
  function learn(id, a) {
    const r = S.learnSkill(ST, id, a); if (!r.ok) { toast(r.reason, true); return; }
    autosave(); render(); refreshSheet();
    if (r.unlocked.length) toast('Unlocked: ' + r.unlocked.map(cname).join(', ')); else if (r.mastered) toast(cname(unit(id).primary) + ' mastered!'); else toast('Learned ' + aname(a));
  }
  function passivesTab(u) {
    const known = u.passivesKnown, P = D.passives, pool = S.jpOf(u, u.primary), L = S.learnable(u);
    const slot = i => h('select', { onchange: e => { const ids = [u.passives[0], u.passives[1]]; ids[i] = e.target.value || null; const r = S.setPassives(ST, u.id, ids); if (!r.ok) toast(r.reason, true); else { toast(r.returned && r.returned.length ? 'Gear the unit can no longer wear went to the stash' : 'Passives set'); autosave(); render(); } refreshSheet(); } },
      h('option', { value: '', text: '— empty —', selected: !u.passives[i] }), known.map(p => h('option', { value: p, selected: u.passives[i] === p, text: nm(P, p) })));
    return [h('div', { class: 'sh-h', text: 'Equipped (2 slots)' }), slot(0), h('div', { style: 'height:6px' }), slot(1),
      u.passives.filter(Boolean).map(p => h('div', { class: 'dim', text: nm(P, p) + ': ' + P[p].desc })),
      h('div', { class: 'row', style: 'margin-top:12px' }, h('div', { class: 'sh-h grow', text: 'Learn from ' + cname(u.primary) }), h('b', { class: 'gold', text: pool + ' JP' })),
      L.passives.length ? L.passives.map(p => h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', { class: 'grow' }, h('b', { text: nm(P, p.id) }), h('div', { class: 'dim', text: P[p.id].desc })), btn(p.cost + ' JP', () => { const r = S.learnPassive(ST, u.id, p.id); if (!r.ok) toast(r.reason, true); else { toast('Learned ' + nm(P, p.id)); autosave(); render(); refreshSheet(); } }, 'sm pri', pool < p.cost)))) : h('div', { class: 'dim', text: 'You know every passive this class teaches.' }),
      known.length ? [h('div', { class: 'sh-h', text: 'Known passives' }), known.map(p => h('span', { class: 'shchip', text: nm(P, p) }))] : null];
  }
  function gearTab(u) {
    return SLOTS.map(sl => {
      const cur = u.gear[sl], options = Object.keys(ST.inventory.items).filter(g => D.gear[g].slot === sl && LO.canEquip(u.primary, g, u.passives));
      return h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', { class: 'grow' }, h('div', { class: 'dim', text: SLOT_NAME[sl] }), h('b', { text: cur ? iname(cur) : '—' }), cur ? h('div', { class: 'dim', text: D.gear[cur].desc }) : null), cur ? btn('Remove', () => { S.unequip(ST, u.id, sl); autosave(); render(); refreshSheet(); }, 'sm') : null),
        options.length ? h('select', { onchange: e => { if (!e.target.value) return; const r = S.equip(ST, u.id, e.target.value); if (!r.ok) toast(r.reason, true); else { toast('Equipped'); autosave(); render(); } refreshSheet(); } }, h('option', { value: '', text: 'Change… (' + options.length + ' in stash)' }), options.map(g => h('option', { value: g, text: iname(g) }))) : h('div', { class: 'dim', text: 'Nothing wearable in the stash.' }));
    });
  }

  // ---------- status and equip screens (UI pass phase 2, FFT style) ----------
  // Full-screen views over the shell: Status (stats, equipment with item icons, abilities, a help box) and Equip (slots, the items this unit can wear, what changes).
  // Tap a row to read about it in the help box; tap it again to change it. Hold any item, skill or passive for its full details.
  // Editing classes, learning and passives still happens in the unit sheet (Classes and Learn open it on top).
  let SV = null;   // { id, mode: 'status' | 'equip', sel, slot, pick }
  const II = () => window.ITEM_ICON;
  const TIER_NAME = t => t ? 'Tier ' + t : 'Unique';
  function statsOf(u, gear) {
    const d = LO.derive(u.primary, gear, u.passives, u.race), cls = D.classes[u.primary], lm = LO.levelMods(u.level), w = d.wpn || {};
    return { hp: Math.round((cls.hp + d.stat.hp) * lm.hp), mp: d.manaMax, mv: cls.mv + d.stat.mv, jump: (cls.jump || D.combatRules.height.defaultClimb) + d.stat.jump, spd: cls.spd + d.stat.spd,
      armor: Math.round(d.armor), res: Math.round(d.res), crit: Math.round(d.crit + (w.crit || 0)), wpn: w.p ? Math.round(LO.strike(w)) : 0, range: w.r || 1, guard: !!(d.guard || cls.guard), power: lm.power, d };
  }
  function itemLine(id) {   // one short line: what the item mostly does
    const it = D.gear[id]; if (!it) return '';
    if (it.weapon) { const w = it.weapon; return Math.round(LO.strike(Object.assign({}, w))) + ' dmg · ' + (w.hands === 2 ? 'two-handed' : w.r > 1 ? 'range ' + w.r : 'melee'); }
    const p = [];
    if (it.guard) p.push('Guard');
    if (it.armor) p.push('+' + it.armor + '% armor'); if (it.res) p.push('+' + it.res + '% resist');
    if (it.spellPow) p.push('+' + it.spellPow + '% spell'); if (it.healPow) p.push('+' + it.healPow + '% heal'); if (it.crit) p.push('+' + it.crit + '% crit');
    const sm = it.statMods || {}; if (sm.hp) p.push('+' + sm.hp + ' HP'); if (sm.spd) p.push((sm.spd > 0 ? '+' : '') + sm.spd + ' Speed'); if (sm.mv) p.push('+' + sm.mv + ' Move'); if (sm.mana) p.push('+' + sm.mana + ' mana');
    if (!p.length && it.elemRes) Object.keys(it.elemRes).forEach(k => p.push('+' + it.elemRes[k] + '% vs ' + k));
    return p.slice(0, 2).join(' · ') || (it.effect ? 'Special effect' : '');
  }
  function slotIcon(id, big) {
    if (!id) return h('span', { class: 'stv-slot empty' });
    const t = II() ? II().tier(id) : 1, cell = II() && II().cell ? II().cell(id) : null, url = !cell && II() ? II().url(id, 2) : '', s = h('span', { class: 'stv-slot' + (big ? ' big' : ''), style: '--tc:' + (II() ? II().color(t) : '#8a8f96') });
    if (cell) s.appendChild(h('i', { class: 'ii', style: '--c:' + cell[0] + ';--r:' + cell[1] })); else if (url) s.appendChild(h('img', { alt: '', src: url })); else s.appendChild(h('b', { text: (D.gear[id].name || '?')[0] }));
    s.appendChild(h('em', { text: t ? String(t) : 'U' })); return s;
  }
  // Long press: hold an element with ._lp (a function returning the detail content) to open the detail panel.
  let lpT = null, lpFired = false;
  function lpBind(root) {
    root.addEventListener('pointerdown', e => { const el = e.target.closest('[data-lp]'); if (!el || !el._lp) return; lpFired = false; const x = e.clientX, y = e.clientY; clearTimeout(lpT);
      lpT = setTimeout(() => { lpFired = true; detail(el._lp()); }, 450);
      const cancel = ev => { if (ev.type === 'pointermove' && Math.hypot(ev.clientX - x, ev.clientY - y) < 10) return; clearTimeout(lpT); root.removeEventListener('pointermove', cancel); };
      root.addEventListener('pointermove', cancel); root.addEventListener('pointerup', cancel, { once: true }); root.addEventListener('pointercancel', cancel, { once: true }); });
    root.addEventListener('click', e => { if (lpFired) { e.stopPropagation(); e.preventDefault(); lpFired = false; } }, true);
    root.addEventListener('contextmenu', e => { if (e.target.closest('[data-lp]')) e.preventDefault(); });
  }
  const lp = (el, fn) => { el.setAttribute('data-lp', ''); el._lp = fn; return el; };
  function detail(content) {
    const root = document.getElementById('stv') || document.getElementById('vic'); if (!root) return;
    const old = root.querySelector('.stv-det'); if (old) old.remove();
    const box = h('div', { class: 'stv-det', onclick: () => box.remove() }, h('div', { class: 'stv-frame stv-detb', onclick: e => e.stopPropagation() }, content, h('div', { class: 'stv-close' }, btn('Close', () => box.remove(), 'sm'))));
    root.appendChild(box);
  }
  function itemDetail(id, u) {
    const it = D.gear[id], t = II() ? II().tier(id) : 1, w = it.weapon, who = Object.keys(D.classes).filter(c => D.classes[c].selectable !== false && LO.canEquip(c, id, [])).map(cname);
    return [h('div', { class: 'stv-dh' }, slotIcon(id, true), h('div', {}, h('b', { class: 'stv-serif', text: it.name }), h('div', { class: 'dim', text: SLOT_NAME[it.slot] + ' · ' + TIER_NAME(t) + (w ? ' · ' + w.family + (w.hands === 2 ? ', two-handed' : '') : it.weight ? ' · ' + it.weight : it.offType ? ' · ' + it.offType : '') }))),
      w ? h('div', { class: 'gold', text: 'Attack: ' + Math.round(LO.strike(Object.assign({}, w))) + ' damage, ' + (w.r > 1 ? 'range ' + w.r : 'melee') + (w.c ? ' · ' + w.c + ' AP' : '') + (w.crit ? ' · ' + w.crit + '% crit' : '') }) : null,
      h('div', { text: it.desc || '' }), it.effect ? h('div', { class: 'gold', text: it.effect }) : null, it.lore ? h('div', { class: 'dim', style: 'font-style:italic', text: it.lore }) : null,
      h('div', { class: 'dim', text: who.length ? 'Worn by: ' + who.join(', ') : 'Only some passives let a unit use this.' }),
      u && !LO.canEquip(u.primary, id, u.passives) ? h('div', { class: 'bad', text: cname(u.primary) + ' cannot use this.' }) : null,
      it.price ? h('div', { class: 'dim', text: 'Shop price about ' + it.price + ' g' }) : null];
  }
  function skillDetail(a, u) {
    const A = D.abilities[a] || {}, dv = LO.derive(u.primary, u.gear, u.passives, u.race), cu = { wpn: dv.wpn, spellPow: dv.spellPow, healPow: dv.healPow, armor: dv.armor, mods: { power: dv.power }, lvPow: LO.levelMods(u.level).power };
    return [h('b', { class: 'stv-serif', text: aname(a) }), h('div', { class: 'dim', text: [A.c !== undefined ? A.c + ' AP' : null, A.r !== undefined ? (A.r > 1 ? 'range ' + A.r : A.r === 0 ? 'self' : 'melee') : null, A.mana ? A.mana + ' mana' : null, A.cd ? 'cooldown ' + A.cd : null, A.tags && A.tags.includes('spell') ? 'spell' : null].filter(Boolean).join(' · ') }),
      h('div', { text: A.desc || '' }), calcLines(cu, A, a)];
  }
  function kitDetail(u, c, role) {
    const C0 = D.classes[c], known = new Set(S.knownSkills(u, c));
    return [h('b', { class: 'stv-serif', text: C0.command || cname(c) }), h('div', { class: 'dim', text: role + ' · ' + cname(c) + ' · ' + known.size + ' of ' + C0.ab.length + ' skills learned' + (S.isMastered(u, c) ? ' (mastered)' : '') }),
      C0.signature ? h('div', { text: C0.signature }) : null,
      h('div', { class: 'stv-kit' }, C0.ab.map(a => { const A = D.abilities[a] || {}; return h('div', { class: known.has(a) ? '' : 'no' }, h('b', { text: aname(a) + (A.c !== undefined ? '  ' + A.c + ' AP' : '') + (known.has(a) ? '' : ' · not learned') }), h('div', { class: 'dim', text: A.desc || '' })); }))];
  }
  function passiveDetail(p) {
    const P = D.passives[p] || {};
    return [h('b', { class: 'stv-serif', text: nm(D.passives, p) }), h('div', { class: 'dim', text: 'Passive' + (P.teacher ? ' · taught by ' + cname(P.teacher) : '') + (P.jp ? ' · ' + P.jp + ' JP' : '') }), h('div', { text: P.desc || '' })];
  }

  function openStatus(id, mode, slot) { SV = { id, mode: mode || 'status', sel: SV && SV.id === id ? SV.sel : 'primary', slot: slot || 'MainHand', pick: null }; drawStatus(); }
  addEventListener('resize', () => { if (SV && SV.mode === 'classes') drawStatus(); });
  function closeStatus() { SV = null; drawStatus(); render(); }
  function drawStatus() {
    let root = document.getElementById('stv');
    if (!SV || !ST || !unit(SV.id)) { if (root) root.remove(); SV = null; return; }
    if (!root) { root = h('div', { id: 'stv' }); lpBind(root); document.getElementById('shell').appendChild(root); }
    root.innerHTML = ''; root.className = 'stv-' + SV.mode;
    root.appendChild(SV.mode === 'equip' ? equipView(unit(SV.id)) : SV.mode === 'classes' ? classesView(unit(SV.id)) : statusView(unit(SV.id)));
  }
  const frame = (cls, ...kids) => h('div', { class: 'stv-frame ' + (cls || '') }, ...kids);
  const colHead = (t, r) => h('h3', {}, h('span', { text: t }), r ? h('span', { class: 'dim', text: r }) : null);
  function statusHeader(title, u, nav) {
    const i = ST.roster.indexOf(u), n = ST.roster.length, go = d => { const v = ST.roster[(i + d + n) % n]; SV.id = v.id; SV.pick = null; SV.cls = null; drawStatus(); };
    return frame('stv-hdr', h('h1', {}, title, SV.mode === 'classes' ? h('span', { class: 'stv-who' }, h('b', { text: u.name }), h('small', { text: 'Lv ' + u.level })) : null), nav && n > 1 ? h('div', { class: 'stv-nav' }, h('button', { class: 'stv-arr', 'aria-label': 'Previous unit', onclick: () => go(-1), text: '◂' }), h('span', { text: (i + 1) + ' / ' + n }), h('button', { class: 'stv-arr', 'aria-label': 'Next unit', onclick: () => go(1), text: '▸' })) : null,
      btn('Back', () => { if (SV.mode !== 'status') { SV.mode = 'status'; SV.pick = null; drawStatus(); } else closeStatus(); }, 'sm'));
  }
  function bar(k, l, pct, txt) { return h('div', { class: 'stv-bar' }, h('b', { text: l }), h('div', { class: 'stv-bt ' + k }, h('i', { style: 'width:' + Math.max(0, Math.min(100, pct)) + '%' })), h('span', { text: txt })); }
  function idCard(u, s) {
    const a = LO.xpForLevel(u.level), b = LO.xpForLevel(u.level + 1), capped = u.level >= LO.levelMods(999).level, xp = capped ? 100 : Math.round(100 * (u.xp - a) / Math.max(1, b - a));
    const L = S.learnable(u), jp = S.jpOf(u, u.primary), next = L.skills.concat(L.passives).reduce((m, x) => Math.min(m, x.cost), Infinity);
    const port = window.PORT && PORT.url ? PORT.url({ name: u.name, race: u.race, primary: u.primary }, 'P') : '';
    return frame('stv-id', port ? h('img', { class: 'stv-port', alt: '', src: port }) : h('div', { class: 'stv-port' }),
      h('div', { class: 'stv-bars' }, h('div', { class: 'stv-nm', role: 'button', title: 'Rename', onclick: () => unitSheet(u.id, 'class') }, h('span', { text: u.name }), h('small', { text: 'Lv ' + u.level }), h('em', { class: 'stv-pen', text: '✎' })),
        h('div', { class: 'stv-cl' }, (D.races[u.race] ? D.races[u.race].name + ' · ' : '') + cname(u.primary), u.secondary ? h('span', { class: 'sec', text: ' · ' + (D.classes[u.secondary].command || cname(u.secondary)) }) : null),
        bar('hp', 'HP', 100, s.hp + '/' + s.hp), bar('mp', 'MP', 100, s.mp + '/' + s.mp), bar('xp', 'EXP', xp, capped ? 'max' : xp + '%'), bar('jp', 'JP', next === Infinity ? 100 : 100 * jp / next, String(jp))));
  }
  function statGrid(s) {
    const c = (l, v) => h('div', {}, h('span', { text: l }), h('b', { text: v }));
    return frame('stv-stats', c('Move', s.mv), c('Jump', s.jump), c('Speed', s.spd), c('Armor', s.armor + '%'), c('Resist', s.res + '%'), c('Crit', s.crit + '%'), c('Weapon', s.wpn || '—'), c('Guard', s.guard ? 'Yes' : 'No'), c('Power', '×' + s.power.toFixed(2)));
  }
  function row(icon, small, name, sub, key, onTap, lpFn) {
    const sel = SV.sel === key;
    const r = h('div', { class: 'stv-row' + (sel ? ' sel' : ''), role: 'button', tabindex: '0', onclick: () => { if (SV.sel === key && onTap) onTap(); else { SV.sel = key; drawStatus(); } } },
      icon, h('span', { class: 't' }, small ? h('small', { text: small }) : null, h('b', { text: name }), sub ? h('i', { text: sub }) : null));
    return lpFn ? lp(r, lpFn) : r;
  }
  const abIcon = (ch, k) => h('span', { class: 'stv-ic ' + k, text: ch });
  function statusView(u) {
    const s = statsOf(u, u.gear), pc = D.classes[u.primary], sc = u.secondary && D.classes[u.secondary];
    const eq = frame('stv-col stv-eq', colHead('EQUIPMENT'), SLOTS.map(sl => { const g = u.gear[sl];
      return row(slotIcon(g), SLOT_NAME[sl], g ? iname(g) : '—', g ? itemLine(g) : 'Empty', 'eq:' + sl, () => openStatus(u.id, 'equip', sl), g ? () => itemDetail(g, u) : null); }));
    const ab = frame('stv-col stv-ab', colHead('ABILITIES'),
      row(abIcon('✦', 'k'), 'Primary', pc.command || cname(u.primary), cname(u.primary) + ' · ' + S.knownSkills(u, u.primary).length + ' of ' + pc.ab.length, 'primary', () => openStatus(u.id, 'classes'), () => kitDetail(u, u.primary, 'Primary')),
      row(abIcon('✧', 's'), 'Secondary', sc ? sc.command || cname(u.secondary) : 'None', sc ? cname(u.secondary) + (S.isMastered(u, u.secondary) ? ' · mastered' : ' · ' + S.knownSkills(u, u.secondary).length + ' learned') : 'Pick one in Classes', 'secondary', () => openStatus(u.id, 'classes'), sc ? () => kitDetail(u, u.secondary, 'Secondary') : null),
      [0, 1].map(i => { const p = u.passives[i]; return row(abIcon('◆', 'p'), 'Passive', p ? nm(D.passives, p) : 'Empty', null, 'pas' + i, () => unitSheet(u.id, 'passives'), p ? () => passiveDetail(p) : null); }),
      row(abIcon('+', 'k'), null, 'Learn skills', S.jpOf(u, u.primary) + ' JP', 'learn', () => unitSheet(u.id, 'skills')));
    const help = frame('stv-help', helpFor(u));
    const acts = h('div', { class: 'stv-acts' }, btn('Classes', () => openStatus(u.id, 'classes')), btn('Equip', () => openStatus(u.id, 'equip', 'MainHand'), 'pri'), btn('Learn', () => unitSheet(u.id, 'skills')));
    return h('div', { class: 'stv-screen' }, statusHeader('Status', u, true),
      h('div', { class: 'stv-a' }, idCard(u, s), statGrid(s), acts), h('div', { class: 'stv-b' }, eq), h('div', { class: 'stv-c' }, ab, help));
  }
  function helpFor(u) {
    const k = SV.sel || 'primary', hint = h('div', { class: 'dim stv-hint', text: 'Tap again to change it. Hold anything for details.' });
    const chips = (c) => { const k = S.knownSkills(u, c), n = 5; return h('div', { class: 'stv-chips' }, k.slice(0, k.length > n + 1 ? n : n + 1).map(a => lp(h('span', { text: aname(a) }), () => skillDetail(a, u))), k.length > n + 1 ? h('span', { class: 'more', text: '+' + (k.length - n) + ' more', onclick: e => { e.stopPropagation(); detail(kitDetail(u, c, c === u.primary ? 'Primary' : 'Secondary')); } }) : null); };
    if (k === 'primary' || k === 'secondary') { const c = k === 'primary' ? u.primary : u.secondary; if (!c) return [h('b', { class: 'stv-serif', text: 'No secondary' }), h('div', { text: 'A secondary brings the skills you learned in another class into battle. Choose one in Classes.' })];
      const C0 = D.classes[c]; return [h('div', {}, h('b', { class: 'stv-serif', text: C0.command || cname(c) }), h('span', { class: 'dim', text: ' · ' + (k === 'primary' ? 'Primary' : 'Secondary') + ', ' + cname(c) + (S.isMastered(u, c) ? ' (mastered)' : '') })),
        h('div', { class: 'stv-desc', text: C0.signature || '' }), chips(c)]; }
    if (k.startsWith('pas')) { const p = u.passives[+k.slice(3)]; return p ? [h('div', {}, h('b', { class: 'stv-serif', text: nm(D.passives, p) }), h('span', { class: 'dim', text: ' · Passive' })), h('div', { class: 'stv-desc', text: D.passives[p].desc }), hint] : [h('b', { class: 'stv-serif', text: 'Empty passive slot' }), h('div', { text: 'Tap again to choose a passive.' })]; }
    if (k === 'learn') return [h('b', { class: 'stv-serif', text: 'Learn skills' }), h('div', { class: 'stv-desc', text: S.jpOf(u, u.primary) + ' JP to spend in ' + cname(u.primary) + '. Tap again to learn skills and passives.' })];
    if (k.startsWith('eq:')) { const sl = k.slice(3), g = u.gear[sl]; return g ? [h('div', {}, h('b', { class: 'stv-serif', text: iname(g) }), h('span', { class: 'dim', text: ' · ' + SLOT_NAME[sl] })), h('div', { class: 'stv-desc', text: D.gear[g].desc || '' }), D.gear[g].effect ? h('div', { class: 'gold stv-desc', text: D.gear[g].effect }) : null, h('div', { class: 'dim stv-hint', text: 'Tap again to change it. Hold for details.' })] : [h('b', { class: 'stv-serif', text: SLOT_NAME[sl] + ': empty' }), h('div', { text: 'Tap again to pick something from the stash.' })]; }
    return null;
  }
  // ----- equip -----
  function wearable(u, sl) { return Object.keys(ST.inventory.items).filter(g => D.gear[g] && D.gear[g].slot === sl && LO.canEquip(u.primary, g, u.passives)); }
  function equipView(u) {
    const sl = SV.slot, cur = u.gear[sl], opts = wearable(u, sl), pick = SV.pick && (SV.pick === cur || opts.includes(SV.pick)) ? SV.pick : null;
    const sort = (a, b) => (II() ? II().tier(b) - II().tier(a) : 0) || iname(a).localeCompare(iname(b));
    const list = [].concat(cur ? [cur] : [], opts.filter(g => g !== cur).sort(sort));
    const strip = frame('stv-strip', SLOTS.map(x => h('button', { class: x === sl ? 'on' : '', onclick: () => { SV.slot = x; SV.pick = null; drawStatus(); } }, slotIcon(u.gear[x]), h('small', { text: SLOT_NAME[x] }))));
    const slotList = frame('stv-col stv-eq', colHead('EQUIPMENT'), SLOTS.map(x => { const g = u.gear[x]; const r = h('div', { class: 'stv-row' + (x === sl ? ' sel' : ''), role: 'button', onclick: () => { SV.slot = x; SV.pick = null; drawStatus(); } }, slotIcon(g), h('span', { class: 't' }, h('small', { text: SLOT_NAME[x] }), h('b', { text: g ? iname(g) : '—' }), h('i', { text: g ? itemLine(g) : 'Empty' }))); return g ? lp(r, () => itemDetail(g, u)) : r; }));
    const items = frame('stv-col stv-list', colHead(SLOT_NAME[sl].toUpperCase(), opts.length + ' in the stash'),
      list.length ? list.map(g => lp(h('div', { class: 'stv-row' + (g === pick ? ' sel' : ''), role: 'button', onclick: () => { SV.pick = g === pick ? null : g; drawStatus(); } }, slotIcon(g), h('span', { class: 't' }, h('b', { text: iname(g) }), h('i', { text: itemLine(g) })),
        g === cur ? h('span', { class: 'stv-e', text: 'E' }) : ST.inventory.items[g] > 1 ? h('span', { class: 'dim', text: '×' + ST.inventory.items[g] }) : null), () => itemDetail(g, u)))
        : h('div', { class: 'dim', style: 'padding:8px', text: 'Nothing in the stash that ' + cname(u.primary) + ' can use here. Shops and fights bring more.' }));
    const cmp = frame('stv-cmp', compare(u, sl, pick));
    const acts = h('div', { class: 'stv-acts' },
      btn('Remove', () => { const r = S.unequip(ST, u.id, sl); if (!r.ok) toast(r.reason, true); else { toast(iname(r.item) + ' went to the stash'); autosave(); } SV.pick = null; drawStatus(); }, '', !cur),
      btn('Best gear', () => bestGear(u)),
      btn('Equip', () => { const r = S.equip(ST, u.id, pick); if (!r.ok) toast(r.reason, true); else { toast('Equipped ' + iname(pick) + (r.returned && r.returned.length ? '; ' + r.returned.map(iname).join(', ') + ' went to the stash' : '')); autosave(); } SV.pick = null; drawStatus(); }, 'pri', !pick || pick === cur));
    const mini = frame('stv-mini', window.PORT && PORT.url ? h('img', { class: 'stv-port', alt: '', src: PORT.url({ name: u.name, race: u.race, primary: u.primary }, 'P') }) : null,
      h('div', {}, h('div', { class: 'stv-nm' }, h('span', { text: u.name }), h('small', { text: 'Lv ' + u.level })), h('div', { class: 'stv-cl', text: cname(u.primary) + ' · can use ' + canUse(u) })));
    return h('div', { class: 'stv-screen' }, statusHeader('Equip', u, true), h('div', { class: 'stv-a' }, mini, strip, slotList), h('div', { class: 'stv-b' }, items), h('div', { class: 'stv-c' }, cmp, acts));
  }
  function canUse(u) { const e = D.classes[u.primary].equip || {}; return [].concat(e.weapons || [], e.offhand || [], (e.armor || []).map(a => a + ' armour')).join(', ') || 'little'; }
  function compare(u, sl, pick) {
    const cur = u.gear[sl];
    if (!pick || pick === cur) return [colHead('IF EQUIPPED'), h('div', { class: 'dim', style: 'padding:4px 0', text: 'Tap an item to see what it would change. Hold it for its details.' })];
    const next = LO.cleanGear(u.primary, Object.assign({}, u.gear, { [sl]: pick }), u.passives), a = statsOf(u, u.gear), b = statsOf(u, next);
    const rows = [['Weapon', 'wpn'], ['Armor', 'armor', '%'], ['Resist', 'res', '%'], ['HP', 'hp'], ['MP', 'mp'], ['Speed', 'spd'], ['Move', 'mv'], ['Crit', 'crit', '%']];
    const lost = SLOTS.filter(x => x !== sl && u.gear[x] && next[x] !== u.gear[x]);
    return [colHead('IF EQUIPPED: ' + iname(pick).toUpperCase()), h('div', { class: 'stv-cg' },
      rows.map(([l, k, suf]) => { const x = a[k], y = b[k], cls = y > x ? 'up' : y < x ? 'dn' : ''; return h('div', {}, h('span', { text: l }), h('b', { class: cls, text: x === y ? x + (suf || '') : x + ' → ' + y + (suf || '') })); }),
      a.guard !== b.guard ? h('div', {}, h('span', { text: 'Guard' }), h('b', { class: b.guard ? 'up' : 'dn', text: (a.guard ? 'Yes' : 'No') + ' → ' + (b.guard ? 'Yes' : 'No') })) : null),
      lost.length ? h('div', { class: 'stv-warn', text: (D.gear[pick].weapon && D.gear[pick].weapon.hands === 2 ? 'Two-handed: ' : '') + lost.map(x => 'the ' + iname(u.gear[x])).join(' and ') + ' goes back to the stash.' }) : null];
  }
  // ----- class tree (UI pass phase 3) -----
  // Tiers of classes as sprites on pedestals. Unlocked classes show their sprite; locked ones are silhouettes, and a class whose requirements
  // are not all unlocked hides its name as ? ? ?. Tap a class to see what unlocks it (gold lines from its requirements) and to set it.
  const ROLE_NAME = { entry: 'Starting class', tank: 'Tank', melee: 'Melee', ranged: 'Ranged', healer: 'Healer', caster: 'Caster', support: 'Support' };
  const TIER_ROMAN = ['', 'I', 'II', 'III', 'IV'];
  function treeClasses() { return Object.keys(D.classes).filter(c => D.classes[c].selectable !== false); }
  function classState(u, c) {
    const C0 = D.classes[c], un = u.unlocked.includes(c), req = C0.requires || [];
    return { un, mastered: un && S.isMastered(u, c), known: un || req.every(r => u.unlocked.includes(r)), learned: S.knownSkills(u, c).length, size: C0.ab.length, req };
  }
  // the Google class art (sprites/gai, same 4x20 layout) unless ?gai=0 asks for the old chibi sprites
  const SPR_DIR = /[?&]gai=0/.test(location.search) ? 'sprites/ally/' : 'sprites/gai/ally/';
  const sprite = (c, cls) => h('i', { class: 'stv-spr ' + (SPR_DIR === 'sprites/ally/' ? '' : 'gai ') + (cls || ''), style: "background-image:url('" + SPR_DIR + c + ".png')" });
  function classesView(u) {
    const all = treeClasses(); if (!SV.cls || !D.classes[SV.cls]) SV.cls = u.primary;
    const sel = SV.cls, tiers = [...new Set(all.map(c => D.classes[c].tier))].sort();
    const cell = c => { const s = classState(u, c), C0 = D.classes[c];
      const el = h('button', { class: 'stv-cc' + (s.un ? '' : ' lock') + (s.known ? '' : ' unk') + (c === u.primary ? ' pri' : '') + (c === u.secondary ? ' sec' : '') + (c === sel ? ' sel' : ''), 'data-c': c, 'aria-label': s.known ? C0.name : 'Unknown class',
        onclick: () => { SV.cls = c; drawStatus(); } },
        c === u.primary ? h('span', { class: 'tag', text: 'P' }) : c === u.secondary ? h('span', { class: 'tag s', text: 'S' }) : null, s.mastered ? h('span', { class: 'star', text: '★' }) : null,
        h('span', { class: 'ped' }, sprite(c)), h('span', { class: 'n', text: s.known ? C0.name : '? ? ?' }),
        h('span', { class: 'p' }, s.un && !s.mastered ? h('i', { style: 'width:' + Math.round(100 * s.learned / s.size) + '%' }) : null));
      return s.known ? lp(el, () => kitDetail(u, c, 'Tier ' + TIER_ROMAN[C0.tier])) : el; };
    const body = h('div', { class: 'stv-tree' }, tiers.map(t => h('div', { class: 'stv-tier t' + t }, h('div', { class: 'tl', text: 'TIER ' + TIER_ROMAN[t] }), h('div', { class: 'g' }, all.filter(c => D.classes[c].tier === t).map(cell)))));
    const legend = h('div', { class: 'stv-legend' }, h('span', {}, h('b', { class: 'pri' }), 'Primary'), h('span', {}, h('b', { class: 'sec' }), 'Secondary'), h('span', { text: '★ Mastered' }), h('span', { class: 'unk', text: '? ? ? Not yet in reach' }));
    const tree = frame('stv-treef', body, legend);
    const wrap = h('div', { class: 'stv-screen' }, statusHeader('Classes', u, true), h('div', { class: 'stv-a' }, tree), h('div', { class: 'stv-c' }, frame('stv-cdet', classDetail(u, sel))));
    requestAnimationFrame(() => treeLines(body, u, sel));
    return wrap;
  }
  function treeLines(body, u, sel) {
    const old = body.querySelector('svg'); if (old) old.remove();
    const to = body.querySelector('[data-c="' + sel + '"]'), req = D.classes[sel].requires || []; if (!to || !req.length) return;
    const B = body.getBoundingClientRect(), c = el => { const r = el.getBoundingClientRect(); return { x: r.left - B.left + r.width / 2, y: r.top - B.top + r.height * .45, t: r.top - B.top, b: r.bottom - B.top, l: r.left - B.left, r: r.right - B.left }; };
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'stv-lines');
    const land = innerWidth > innerHeight, T = c(to);
    req.forEach(r => { const el = body.querySelector('[data-c="' + r + '"]'); if (!el) return; const F = c(el), done = S.isMastered(u, r);
      // an elbow line: out of the requirement, across, into the class
      const pts = land ? [[F.r, F.y], [(F.r + T.l) / 2, F.y], [(F.r + T.l) / 2, T.y], [T.l, T.y]] : [[F.x, F.b], [F.x, (F.b + T.t) / 2], [T.x, (F.b + T.t) / 2], [T.x, T.t]];
      const pl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline'); pl.setAttribute('points', pts.map(p => p.join(',')).join(' '));
      pl.setAttribute('class', done ? 'done' : 'todo'); svg.appendChild(pl); });
    body.appendChild(svg);
  }
  function classDetail(u, c) {
    const C0 = D.classes[c], s = classState(u, c), pips = (n, k) => h('span', { class: 'stv-pips' }, Array.from({ length: n }, (_, i) => h('i', { class: i < k ? 'on' : '' })));
    const status = s.mastered ? 'Mastered' : s.un ? 'Unlocked' : 'Locked';
    const reqRows = s.req.map(r => { const rs = classState(u, r); return [h('span', { text: rs.known ? cname(r) : '? ? ?' }), pips(rs.size, rs.learned), h('span', { class: 'dim', text: rs.learned + '/' + rs.size })]; });
    const sec = u.secondary === c;
    const acts = s.un ? h('div', { class: 'stv-acts' },
      btn(c === u.primary ? 'Primary' : 'Set primary', () => setClassFromTree(u, c, u.secondary === c ? null : u.secondary), 'pri', c === u.primary),
      btn(sec ? 'Remove secondary' : 'Set secondary', () => setClassFromTree(u, u.primary, sec ? null : c), '', c === u.primary)) : null;
    return [h('div', { class: 'stv-cdh' }, h('span', { class: 'big' + (s.un ? '' : ' lock') }, sprite(c)), h('div', {}, h('b', { class: 'stv-serif', text: s.known ? C0.name : '? ? ?' }),
        h('div', { class: 'dim', text: 'Tier ' + TIER_ROMAN[C0.tier] + (s.known ? ' · ' + (ROLE_NAME[C0.role] || C0.role) : '') + ' · ' + status }))),
      s.un ? h('div', { class: 'stv-req' }, h('span', { text: C0.command || 'Skills' }), pips(s.size, s.learned), h('span', { class: 'dim', text: s.learned + '/' + s.size })) : null,
      reqRows.length && !s.un ? h('div', { class: 'stv-req' }, reqRows) : null,
      h('div', { class: 'stv-blurb', text: s.known ? (C0.signature || '') + (s.un ? '' : ' Master ' + (s.req.length > 1 ? 'both classes' : cname(s.req[0])) + ' to unlock.') : 'Unlock ' + (s.req.length > 1 ? 'both of the classes it needs' : 'the class it needs') + ' to learn more.' }),
      s.known ? h('div', { class: 'dim stv-hint', text: 'Hold a class to see all of its skills.' }) : null, acts];
  }
  function setClassFromTree(u, p, s) {
    const r = S.setClass(ST, u.id, p, s || null); if (!r.ok) { toast(r.reason, true); return; }
    toast(r.needsWeapon ? 'No weapon this class can wield: buy or equip one' : r.returned.length ? 'Gear the class cannot use went to the stash' : p !== u.primary ? cname(p) + ' is now the primary' : s ? cname(s) + ' is now the secondary' : 'Secondary removed');
    autosave(); drawStatus();
  }
  // Best gear: every slot keeps its kind of item (a sword stays a sword, medium armour stays medium) and takes the strongest one in the stash. An empty slot takes the strongest anything.
  function gearScore(g) { const it = D.gear[g]; if (!it) return -1; const sm = it.statMods || {}, w = it.weapon; return (w ? LO.strike(Object.assign({}, w)) * 3 : 0) + (it.armor || 0) + (it.res || 0) * 0.8 + (sm.hp || 0) * 0.5 + (it.spellPow || 0) * 0.6 + (it.healPow || 0) * 0.5 + (sm.mana || 0) * 0.4 + (it.crit || 0) * 0.6 + (sm.spd || 0) * 6 + (sm.mv || 0) * 6 + (II() ? II().tier(g) * 0.01 : 0); }
  function kindOf(g) { const it = D.gear[g]; return it.weapon ? 'w:' + it.weapon.family + ':' + it.weapon.hands : it.offType ? 'o:' + it.offType : it.weight ? 'a:' + it.weight : 'x:' + g; }
  function bestGear(u) {
    const changed = [];
    for (const sl of SLOTS) {
      if (sl === 'Accessory' && u.gear[sl]) continue;   // accessories are a build choice: only an empty slot is filled
      if (sl === 'OffHand') { const m = u.gear.MainHand && D.gear[u.gear.MainHand].weapon; if (m && m.hands === 2) continue; }
      const cur = u.gear[sl], pool = wearable(u, sl).filter(g => !cur || kindOf(g) === kindOf(cur));
      const best = pool.sort((a, b) => gearScore(b) - gearScore(a))[0];
      if (best && (!cur || gearScore(best) > gearScore(cur))) { const r = S.equip(ST, u.id, best); if (r.ok) changed.push(iname(best)); }
    }
    if (changed.length) { toast('Best gear: ' + changed.join(', ')); autosave(); } else toast('Already wearing the best of each kind you have');
    SV.pick = null; drawStatus();
  }

  // ---------- factions ----------
  // ---------- ranks and offers ----------
  const RK = () => S.RANK;
  const attention = () => false;   // the Factions tab is status only; anything to act on shows in the Journal
  function acceptOffer(o) {
    const r = C.acceptOffer ? C.acceptOffer(ST, o.faction) : (o.kind === 'join' ? S.joinRank(ST, o.faction, { leave: true }) : S.promote(ST, o.faction));
    if (!r.ok) { toast(r.reason, true); return; }
    const next = C.rankHint && C.rankHint(ST, o.faction);
    autosave(); render();
    sheet(o.kind === 'join' ? 'You are one of them' : 'Promoted', () => [h('div', { class: 'card', style: 'border-color:' + D.factions[o.faction].color }, h('b', { style: 'color:' + D.factions[o.faction].color, text: S.getRank(ST, o.faction).title + ' of ' + fname(o.faction) }),
      r.left ? h('div', { class: 'dim', text: 'You have left the ' + fname(r.left) + '. If you ever go back, you start again at the bottom.' }) : null),
      next ? h('div', { class: 'gold', style: 'margin:6px 0', text: next }) : null, h('div', { style: 'height:6px' }), btn('Continue', () => { closeSheet(); render(); if (SS()) SS().tick(); }, 'pri full')]);
  }
  // an offer, made by someone at this place
  function placeOfferCard(o) {
    const F = D.factions[o.faction];
    return h('div', { class: 'card', style: 'border-color:' + F.color }, h('div', { class: 'row' }, h('b', { class: 'grow', style: 'color:' + F.color, text: o.kind === 'join' ? F.name + ' offer you a place' : F.name + ' offer you a promotion' }), h('span', { class: 'shchip', text: o.title })),
      h('div', { class: 'dim', style: 'margin:4px 0', text: (o.who ? o.who[0].toUpperCase() + o.who.slice(1) + ' waits for your answer. ' : '') + (o.leaves ? 'Saying yes means leaving the ' + fname(o.leaves) + ': you serve one faction at a time, and leaving costs you their regard.' : o.kind === 'join' ? 'Rank 1 of 4. Membership opens their orders, their deeper secrets and better work.' : 'More trust, harder orders.') }),
      h('div', { class: 'row' }, btn(o.leaves ? 'Leave and accept' : 'Accept', () => acceptOffer(o), 'pri grow'), btn('Not now', () => { toast('The offer stands. Come back when you are ready.'); closeSheet(); }, 'grow')));
  }
  function rankCard(r) {
    const f = r.faction, F = D.factions[f];
    return h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', { class: 'grow' }, h('b', { style: 'color:' + F.color, text: r.title }), h('div', { class: 'dim', text: F.name + ' · rank ' + r.rank + ' of 4' + (r.dormant ? ' · stepped back' : '') })),
      h('div', { class: 'row' }, btn(r.dormant ? 'Return' : 'Step back', () => { S.setDormant(ST, f, !r.dormant); autosave(); render(); }, 'sm'), btn('Leave', () => { const x = S.leaveRank(ST, f); toast('You left the ' + fname(f)); autosave(); render(); }, 'sm bad'))),
      C.rankHint && C.rankHint(ST, f) ? h('div', { class: 'gold', style: 'margin-top:6px;font-size:13px', text: C.rankHint(ST, f) }) : null);
  }
  function hearthCard() {
    const t = S.goodwillTier(ST), v = S.getGoodwill(ST), F = D.factions.hearthwatch, pct = Math.round(100 * (v - 15) / 85);
    const ht = C.hearthTitle && C.hearthTitle(ST), hint = (C.rankHint && C.rankHint(ST, 'hearthwatch')) || (!ht && C.FQ && C.jobActive(ST, C.FQ.hearthwatch.tryout) ? 'Carry the bread for a market day, then report at Millstream.' : null), dn = C.dossierCount ? C.dossierCount(ST, 'hearthwatch') : 0;
    return h('div', { class: 'card', onclick: () => factionSheet('hearthwatch') }, h('div', { class: 'row' }, h('div', { class: 'grow' }, h('b', { style: 'color:' + F.color, text: F.name + (ht ? ' \u00b7 ' + ht : '') }), h('div', { class: 'dim', text: 'Their chapels shelter anyone. No ranks, only goodwill.' }), dn ? h('div', { class: 'dim', style: 'font-size:12px;margin-top:2px', text: 'Dossier: ' + dn + ' entr' + (dn > 1 ? 'ies' : 'y') }) : null), h('b', { text: t.name })),
      hint ? h('div', { class: 'gold', style: 'margin-top:6px;font-size:13px', text: hint }) : null,
      h('div', { class: 'bar', style: 'margin-top:6px' }, h('i', { style: 'width:' + pct + '%;background:' + F.color })), t.id === 'trusted' ? h('div', { class: 'dim', style: 'margin-top:4px', text: 'Trusted: 10% off at their stalls.' }) : null);
  }

  // Factions are grouped under a dropdown per race. Your own race starts open; the rest start closed so a new player is not buried.
  const raceOpen = {};
  function raceGroups(list, cardFn) {
    const mine = ST.player && ST.player.race, order = Object.keys(D.races), by = {};
    list.forEach(f => { const r = D.factions[f].race || 'other'; (by[r] = by[r] || []).push(f); });
    return Object.keys(by).sort((a, b) => (a === mine ? -1 : b === mine ? 1 : (order.indexOf(a) + 99 * (order.indexOf(a) < 0)) - (order.indexOf(b) + 99 * (order.indexOf(b) < 0)))).map(r => {
      const fl = by[r], open = r in raceOpen ? raceOpen[r] : r === mine, nm = D.races[r] ? D.races[r].name : r.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
      const known = fl.length;
      return h('div', { class: 'rgroup' },
        h('button', { class: 'rhead' + (open ? ' on' : ''), 'aria-expanded': String(open), onclick: () => { raceOpen[r] = !open; render(); } }, h('span', { class: 'grow', text: (open ? '\u25be ' : '\u25b8 ') + nm + (r === mine ? ' (your people)' : '') }), h('span', { class: 'dim', text: known + (known === 1 ? ' faction known' : ' factions known') })),
        open ? fl.map(cardFn) : null);
    });
  }
  function factionScreen(main) {
    if (!ST.world.flags.g_factions) { C.guideFlag(ST, 'g_factions'); guideCheck(); }
    const gone = f => !!(C.absorbed && C.absorbed(ST, f)), un = C.union ? C.union(ST) : null;   // Phase 4: factions absorbed into the united realm leave the list
    const fs = Object.keys(D.factions).filter(f => f !== 'outlaws' && f !== 'hearthwatch' && !gone(f) && (S.isMet(ST, f) || S.getRank(ST, f)));
    const offers = S.invitations(ST), ranks = S.listRanks(ST), noticed = RK().factions.filter(f => !gone(f) && !S.getRank(ST, f) && S.getStanding(ST, f) >= 100 && S.getStanding(ST, f) < RK().standingNeeded[0] && !(C.factionNext && C.factionNext(ST).some(x => x.faction === f)) && !(C.FQ && C.FQ[f] && C.jobActive(ST, C.FQ[f].tryout)));
    main.appendChild(h('div', { class: 'pad' },
      C.proofs(ST).length ? [h('div', { class: 'sh-h', text: 'Proof you carry' }), proofCards()] : null,
      C.bounties(ST).length ? [h('div', { class: 'sh-h', text: 'Wanted' }), C.bounties(ST).map(b => h('div', { class: 'card badc' }, h('b', { text: fname(b.faction) + ' have put a price on you' }), h('div', { class: 'dim', text: 'Hunters can find you anywhere. It lapses in ' + b.daysLeft + ' days, or settle it at a Syndicate place or a Hearthwatch chapel.' })))] : null,
      un ? h('div', { class: 'card', style: 'border-color:' + D.factions.realm.color }, h('b', { style: 'color:' + D.factions.realm.color, text: 'The realm is one: the ' + D.factions.realm.name }), h('div', { class: 'dim', text: '"' + D.factions.realm.motto + '" ' + un.ruler.charAt(0).toUpperCase() + un.ruler.slice(1) + ' rules from Crown Keep.' }), C.policyWords ? C.policyWords(ST).map(t => h('div', { class: 'dim', style: 'font-size:12px;margin-top:3px', text: t })) : null, C.plotWords && C.plotWords(ST).length ? [h('div', { class: 'gold', style: 'font-size:12px;margin-top:6px', text: 'Plotters' }), C.plotWords(ST).map(t => h('div', { class: 'dim', style: 'font-size:12px;margin-top:3px', text: t }))] : null) : null,
      ranks.length ? [h('div', { class: 'sh-h', text: 'Your rank' }), ranks.map(rankCard)] : null,
      noticed.length ? [h('div', { class: 'sh-h', text: 'Noticed' }), noticed.map(f => h('div', { class: 'dim', text: fname(f) + ': they have noticed you. Keep helping them and someone will ask you to prove yourself.' }))] : null,
      C.relReport ? realmBlock() : null,
      hearthCard(),
      ranks.length ? null : h('div', { class: 'card' }, h('b', { text: 'You serve no faction' }), h('div', { class: 'dim', text: 'Do good work for a faction and they will notice you. Pass their try-out and someone of theirs will offer you a place. You serve one faction at a time.' })),
      fs.length ? null : h('div', { class: 'dim', style: 'margin:10px 0', text: 'You have not met any of the great powers yet. Walk the roads and they will find you.' }),
      raceGroups(fs, f => { const n = S.getStanding(ST, f), pct = Math.round(100 * (n + 1000) / 2000), F = D.factions[f];
        return h('div', { class: 'card', onclick: () => factionSheet(f) }, h('div', { class: 'row' }, h('div', { class: 'grow' }, h('b', { style: 'color:' + F.color, text: F.name }), h('div', { class: 'dim', text: F.desc }), C.dossierCount(ST, f) ? h('div', { class: 'dim', style: 'font-size:12px;margin-top:2px', text: 'Dossier: ' + C.dossierCount(ST, f) + ' entr' + (C.dossierCount(ST, f) > 1 ? 'ies' : 'y') }) : null), h('div', { style: 'text-align:right' }, h('b', { text: tierName(f) }), h('div', { class: 'dim', text: (n > 0 ? '+' : '') + n }))),
          h('div', { class: 'bar', style: 'margin-top:6px' }, h('i', { style: 'width:' + pct + '%;background:' + F.color })));
      }),
      SS() ? SS().you(ST) : null,
      h('div', { class: 'sh-h', text: 'Recent changes' }), ST.factions.history.filter(x => S.isMet(ST, x.faction) || x.faction === 'hearthwatch').slice(-8).reverse().map(x => h('div', { class: 'dim', text: 'Day ' + x.day + ' · ' + fname(x.faction) + (x.delta ? ' ' + (x.delta > 0 ? '+' : '') + x.delta : '') + ' · ' + x.reason })), ST.factions.history.length ? null : h('div', { class: 'dim', text: 'Nothing yet.' })));
  }
  // The realm: wars, alliances, truces, your faction's council, and arguing for peace or an alliance (Phase 3a). Words only, never numbers.
  const MOOD = { close: 'close', friendly: 'friendly', cool: 'cool', hostile: 'hostile', bitter: 'bitter' };
  function realmBlock() {
    const R = C.relReport(ST), met = f => f === 'hearthwatch' || S.isMet(ST, f) || S.getRank(ST, f), out = [];
    const p = R.pending;
    if (p) out.push(h('div', { class: 'card urg' }, h('b', { text: 'The ' + fname(p.faction) + ' has called its council' }),
      h('div', { class: 'dim', text: (p.kind === 'war' ? 'They mean to go to war with the ' : 'They have been offered an alliance with the ') + fname(p.with) + ', and will not do it without your word. Go to one of their halls. If you stay away, they will do nothing.' })));
    const lines = [].concat(R.wars.filter(x => met(x.a) || met(x.b)).map(x => 'At war: the ' + fname(x.a) + ' against the ' + fname(x.b) + ', since day ' + x.since),
      R.allies.filter(x => met(x.a) || met(x.b)).map(x => 'Allies: the ' + fname(x.a) + ' and the ' + fname(x.b)),
      R.truces.filter(x => met(x.a) || met(x.b)).map(x => 'Truce: the ' + fname(x.a) + ' and the ' + fname(x.b)));
    const mine = S.sworn && S.sworn(ST), moods = mine ? R.pairs.filter(x => (x.a === mine || x.b === mine) && !x.status).map(x => { const o = x.a === mine ? x.b : x.a; return met(o) ? 'The ' + fname(o) + ': ' + MOOD[x.mood] + ' toward the ' + fname(mine) : null; }).filter(Boolean) : [];
    if (lines.length || moods.length || R.news.length) out.push(h('div', { class: 'card' }, h('b', { text: 'The state of the realm' }),
      lines.length ? lines.map(t => h('div', { text: t })) : h('div', { class: 'dim', text: 'No wars and no alliances, for now.' }),
      moods.length ? [h('div', { class: 'dim', style: 'margin-top:6px;font-size:12px;text-transform:uppercase;letter-spacing:.04em', text: 'Toward your faction' }), moods.map(t => h('div', { class: 'dim', text: t }))] : null,
      R.news.length ? [h('div', { class: 'dim', style: 'margin-top:6px;font-size:12px;text-transform:uppercase;letter-spacing:.04em', text: 'Word on the roads' }), R.news.slice(0, 5).map(n => h('div', { class: 'dim', text: 'Day ' + n.day + ' · ' + n.text }))] : null));
    const opts = C.relArgueOptions(ST).filter(o => met(o.faction));
    if (opts.length) out.push(h('div', { class: 'card' }, h('b', { text: 'Speak in council' }), h('div', { class: 'dim', text: 'As one of their officers you can argue for peace or for an alliance. Your name counts for more with a faction whose ideals you share.' }),
      opts.map(o => h('div', { class: 'row', style: 'margin-top:6px' }, h('div', { class: 'grow', text: 'The ' + fname(o.faction) + (o.wait ? ' (heard you recently)' : '') }),
        o.peace ? btn('For peace', () => { const r = C.relArgue(ST, o.faction, 'peace'); toast(r.ok ? r.text : r.reason, !r.ok); autosave(); render(); }, 'sm', !!o.wait) : null,
        o.ally ? btn('For alliance', () => { const r = C.relArgue(ST, o.faction, 'ally'); toast(r.ok ? r.text : r.reason, !r.ok); autosave(); render(); }, 'sm', !!o.wait) : null))));
    if (C.leadOk) out.push(ordersBlock());
    return out.length ? [h('div', { class: 'sh-h', text: 'The realm' }), out] : null;
  }
  // Phase 4d: ordering an attack (rank 3) and moving against the Hearthwatch (rank 4), at a hall or the capital. Words only.
  const STAGES = { 1: 'a single fight', 2: 'a siege in two stages', 3: 'a siege in three stages', 4: 'a siege in four stages, ending at a last stand' };
  const CHANCE = { good: 'good odds', even: 'even odds', poor: 'poor odds' };
  function ordersBlock() {
    const L = C.leadOk(ST), out = [];
    if (L.ok) { const opts = C.leadOptions(ST).slice(0, 8);
      out.push(h('div', { class: 'card' }, h('b', { text: 'Order an attack' }), h('div', { class: 'dim', text: 'As a senior officer you can send the ' + fname(L.f) + ' against a place it can reach. The army gathers for a week. Be there to fight, or the day goes as it goes.' }),
        opts.length ? opts.map(o => h('div', { class: 'row', style: 'margin-top:6px' }, h('div', { class: 'grow' }, h('div', { text: C.NODES[o.target].name + ', held by the ' + fname(o.on) }), h('div', { class: 'dim', style: 'font-size:12px', text: 'From ' + C.NODES[o.from].name + ': ' + STAGES[o.stages] + ', ' + CHANCE[o.chance] })),
          btn('Order it', () => { const r = C.leadAttack(ST, o.target); toast(r.ok ? r.text : r.reason, !r.ok); autosave(); render(); }, 'sm')))
          : h('div', { class: 'dim', style: 'margin-top:6px', text: 'No enemy place is within marching reach of your faction just now.' }))); }
    else if (L.busy) out.push(h('div', { class: 'card' }, h('b', { text: 'Order an attack' }), h('div', { class: 'dim', text: 'Your last order is still under way. The council will hear another when it is settled.' })));
    const M = C.hearthMotionOk ? C.hearthMotionOk(ST) : { ok: false };
    if (M.ok) out.push(h('div', { class: 'card' }, h('b', { text: 'Move against the Hearthwatch' }), h('div', { class: 'dim', text: 'The Hearthwatch never makes war, and no one makes war on it. You could put it to the council. It would mean war at once' + (M.allied ? ', and the end of your alliance' : '') + '.' }),
      h('div', { style: 'height:6px' }), btn('Put it to the council', () => sheet('Move against the Hearthwatch', () => {
        const hurt = C.hearthMotionCost(ST);
        return [h('p', { text: 'If you ask, the council will vote for war on the Hearthwatch. The chapels would be fair game for your orders, and the Hearthstone Priory last of all.' }),
          h('p', { class: 'dim', text: 'Mother Agathe will not forgive it: you would lose all your goodwill with the Hearthwatch.' + (hurt.length ? ' Those who value mercy will think much less of you: the ' + hurt.map(fname).join(' and the ') + '.' : '') + ' If the Priory falls, the Hearthwatch is gone for good.' }),
          btn('Ask for war', () => { const r = C.hearthMotion(ST); closeSheet(); autosave(); render(); toast(r.ok ? r.text : r.reason, !r.ok); }, 'full bad'), h('div', { style: 'height:6px' }), btn('Not now', closeSheet, 'full')];
      }), 'full')));
    return out.length ? out : null;
  }
  const KIND_LABEL = { ideal: 'Ideals', strength: 'Strengths', weakness: 'Weaknesses', figure: 'Important figures', view: 'How others see them', secret: 'Secrets' };
  function dossierBlock(f) {
    const es = C.dossier(ST, f); if (!es.length) return null; const out = [h('div', { class: 'sh-h', text: 'What you know' })];
    Object.keys(KIND_LABEL).forEach(k => { const g = es.filter(e => e.kind === k); if (!g.length) return; out.push(h('div', { class: 'dim', style: 'margin:8px 0 2px;font-size:12px;text-transform:uppercase;letter-spacing:.04em', text: KIND_LABEL[k] }));
      g.forEach(e => { const tag = k === 'secret' ? (e.stage === 1 ? (e.state === 'false' ? 'Rumour \u00b7 false' : e.state === 'confirmed' ? 'Rumour \u00b7 confirmed' : 'Rumour \u00b7 unverified') : e.stage === 2 ? 'Evidence' : 'Proof') : (k === 'ideal' ? (e.depth === 2 ? 'What the leadership believes' : e.depth === 1 ? 'What members say' : 'What is said') : '');
        out.push(h('div', { class: 'card', style: e.state === 'false' ? 'opacity:.7' : '' }, tag ? h('span', { class: 'shchip' + (e.stage === 3 ? ' on' : ''), text: tag }) : null,
          h('div', { style: e.state === 'false' ? 'text-decoration:line-through;margin-top:4px' : 'margin-top:' + (tag ? 4 : 0) + 'px', text: e.text }), e.state === 'false' && e.falseText ? h('div', { class: 'good', style: 'margin-top:4px', text: e.falseText }) : null,
          h('div', { class: 'dim', style: 'font-size:12px;margin-top:4px', text: e.src + ' \u00b7 day ' + e.day }))); }); });
    return out;
  }
  // proof can be used only in the right place: the actions show in that place's sheet
  function proofHere() {
    return C.proofs(ST).map(p => { const acts = C.proofActions(ST, p.sid).filter(o => o.ok && o.id !== 'destroy'); if (!acts.length) return null;
      return h('div', { class: 'card', style: 'border-color:var(--gold)' }, h('b', { text: 'You carry: ' + p.name }), h('div', { class: 'dim', text: 'You can use it here.' }), h('div', { style: 'height:6px' }), acts.map(o => [btn(o.label, () => useProof(p.sid, o.id), 'full pri'), h('div', { style: 'height:6px' })])); });
  }
  function proofCards(filter) {
    return C.proofs(ST).filter(p => !filter || p.faction === filter).map(p => h('div', { class: 'card', style: 'border-color:var(--gold)' }, h('b', { text: 'You carry: ' + p.name }), h('div', { class: 'dim', text: p.secret + '. ' + (p.hunted ? fname(p.faction) + ' know you have it. Hunters will find you on the road.' : 'Word has not reached them yet.') + (p.defended ? ' You have held it through ' + p.defended + ' attack' + (p.defended > 1 ? 's' : '') + '.' : '') }),
      C.proofActions(ST, p.sid).filter(o => o.id !== 'destroy').map(o => h('div', { class: 'dim', style: 'font-size:12px;margin-top:4px', text: '\u2022 ' + o.label.replace(/ to .*/, '') + ': ' + (o.ok ? 'you can do it where you are now (see this place on the map).' : o.why) })),
      h('div', { style: 'height:6px' }), btn('Burn it', () => useProof(p.sid, 'destroy'), 'full')));
  }
  function useProof(sid, how) {
    const r = C.useProof(ST, sid, how); if (!r.ok) { toast(r.reason, true); return; } autosave(); render();
    sheet('The proof', () => [h('div', { text: r.text }), r.gold ? h('div', { class: 'good', style: 'margin-top:6px', text: '+' + r.gold + ' g' }) : null, S.visibleChanges(ST, r.changes || []).map(c => h('div', { class: 'dim', text: fname(c.faction) + ' ' + (c.delta > 0 ? '+' : '') + c.delta + ' (now ' + S.tierOf(c.to).name + ')' })), h('div', { style: 'height:8px' }), btn('Close', () => { closeSheet(); render(); }, 'full')]);
  }
  function factionSheet(f) {
    sheet(fname(f), () => { const act = Object.keys(D.factions).filter(g => g !== f && D.factions[g].active && g !== 'outlaws'); return [h('div', { class: 'dim', text: D.factions[f].desc }), proofCards(f), dossierBlock(f), h('div', { class: 'sh-h', text: 'How others react when your standing with them changes' }),
      act.map(g => { const r = S.getRelation(ST, f, g); return r ? h('div', { class: 'row' }, h('span', { class: 'grow', text: fname(g) }), h('span', { class: r > 0 ? 'good' : 'badc', text: r > 0 ? 'moves with them (' + r.toFixed(1) + ')' : 'opposes them (' + r.toFixed(1) + ')' })) : null; })]; });
  }

  // ---------- quests ----------
  let questOpen = {};
  function questCard(j) {
    return h('div', { class: 'card' }, h('div', { class: 'row' }, h('b', { class: 'grow', text: j.name }), h('span', { class: 'shchip', text: j.ready ? 'Report back' : 'Active' })),
      h('div', { class: 'dim', text: 'From ' + C.NODES[j.at].name }), j.steps.map(x => h('div', { class: x.done ? 'dim' : '', text: (x.done ? '✓ ' : '○ ') + x.text })),
      j.ready ? h('div', { class: 'good', style: 'margin-top:4px', text: 'Report back at ' + C.NODES[j.at].name + '.' }) : null);
  }
  // ---------- journal: everything you have taken on, in one place ----------
  // Jobs (from towns) and contracts (from faction boards) are both offered at places on the map and both listed here; story scenes that need you show at the top.
  let jTab = 'quests';
  const journalAttention = () => (C.offers && C.offers(ST).length > 0) || C.jobList(ST).some(j => j.ready) || (C.contracts && C.contracts(ST).some(c => c.ready)) || !!(SS() && SS().waiting(ST).filter(x => x !== 'can_call').length);
  function questCard(j) {
    const t = jobTarget(j.id);
    return h('div', { class: 'card' + (j.ready ? ' sel' : '') }, h('div', { class: 'row' }, h('b', { class: 'grow', text: j.name }), h('span', { class: 'shchip', text: j.giver === 'general' ? 'Side job' : fname(j.giver) })),
      h('div', { class: 'dim', text: 'From ' + C.NODES[j.at].name }), j.steps.map(x => h('div', { class: x.done ? 'dim' : '', text: (x.done ? '\u2713 ' : '\u25cb ') + x.text })),
      t ? goLine(t.at, t.kind === 'report' ? 'Report back at' : 'Next: go to') : null);
  }
  function journalScreen(main) {
    const ss = SS(), mootOn = !!(ss && ss.mootOn(ST)), beasts = Object.keys(C.BEASTS || {}).length;
    if (jTab === 'moot' && !mootOn) jTab = 'quests';
    const subs = [['quests', 'Quests'], ['leads', 'Leads'], mootOn ? ['moot', 'Moot'] : null, ['bestiary', 'Bestiary']].filter(Boolean);
    const body = [h('div', { class: 'sh-sub' }, subs.map(([k, l]) => btn(l, () => { jTab = k; render(); }, jTab === k ? 'on' : '')))];
    if (jTab === 'quests') body.push(journalQuests(ss));
    else if (jTab === 'leads') body.push(ss ? ss.threads(ST) : null, C.jobLeads(ST).length ? [h('div', { class: 'sh-h', text: 'Work you have heard of' }), C.jobLeads(ST).map(l => h('div', { class: 'card' }, h('b', { text: 'Work is going at ' + C.NODES[l.at].name }), h('div', { class: 'dim', text: l.giver === 'general' ? 'Ordinary folk need a hand.' : fname(l.giver) + ' are hiring.' }), goLine(l.at, 'Go to'))) ] : null);
    else if (jTab === 'moot') body.push(ss.moot(ST));
    else body.push(bestiaryBody(true));
    main.appendChild(h('div', { class: 'pad' }, body));
  }
  function factionStepCard(x) {
    const F = D.factions[x.faction];
    return h('div', { class: 'card' + (x.kind === 'offer' ? ' sel' : '') }, h('b', { style: 'color:' + F.color, text: F.name }), h('div', { class: x.kind === 'progress' ? 'dim' : '', text: x.text }),
      x.at ? goLine(x.at, x.kind === 'offer' ? 'Answer at' : 'Go to') : null);
  }
  function journalQuests(ss) {
    const out = [], urgent = ss ? ss.urgent(ST) : [];
    if (urgent.length) out.push(h('div', { class: 'sh-h', text: 'Needs you now' }), urgent);
    if (ss && ss.mootPlan) { const mp = ss.mootPlan(ST); if (mp) out.push(h('div', { class: 'sh-h', text: 'The Moot' }), mp); }
    const gs = C.guideState(ST);
    if (!gs.off) { const nx = gs.steps.find(x => !x.done); out.push(h('div', { class: 'sh-h', text: 'Getting started' }), h('div', { class: 'card' }, h('b', { text: 'Crossroads week' }),
      gs.steps.map(x => h('div', { class: x.done ? 'dim' : '', text: (x.done ? '\u2713 ' : (x === nx ? '\u25b6 ' : '\u25cb ')) + x.title })), nx ? h('div', { class: 'dim', style: 'margin-top:4px', text: nx.hint }) : null, nx && GUIDE_AT[nx.id] ? goLine(GUIDE_AT[nx.id], 'Next: go to') : null)); }
    const fx = C.factionNext ? C.factionNext(ST).filter(x => x.at || x.kind === 'progress') : [];
    if (fx.length) out.push(h('div', { class: 'sh-h', text: 'Your factions' }), fx.map(factionStepCard));
    const jobs = C.jobList(ST), act = jobs.filter(j => j.state === 'active').sort((a, b) => (b.ready ? 1 : 0) - (a.ready ? 1 : 0)), done = jobs.filter(j => j.state === 'done'), mine = C.contracts ? C.contracts(ST) : [];
    out.push(h('div', { class: 'sh-h', text: 'Active (' + (act.length + mine.length) + ')' }));
    if (!act.length && !mine.length) out.push(h('div', { class: 'card dim', text: 'Nothing taken on yet. A yellow ! on the map marks a place with work. Towns post jobs, and castles and halls post contracts for their own people. Tap one to see who is asking, and why.' }));
    out.push(act.map(questCard));
    if (ss && mine.length) out.push(ss.contracts(ST, (at, c) => goLine(at, c && c.ready ? 'Report back at' : 'Next: go to')));
    if (C.MAX_CONTRACTS && mine.length) out.push(h('div', { class: 'dim', style: 'font-size:12px', text: 'You can carry ' + C.MAX_CONTRACTS + ' contracts at a time; jobs have no limit.' }));
    if (done.length) out.push(h('details', { style: 'margin-top:10px' }, h('summary', { class: 'dim', text: 'Completed (' + done.length + ')' }), done.map(j => h('div', { class: 'dim', text: '\u2713 ' + j.name + ' (' + C.NODES[j.at].name + ')' }))));
    return out;
  }

  // ---------- menu ----------
  function bestiaryBody(all) {
    const l = C.bestiaryList(ST), total = Object.keys(C.BEASTS || {}).length, known = new Set(l.map(x => x.id)), out = [];
    out.push(h('div', { class: 'card' }, h('b', { text: l.length + ' of ' + total + ' creatures recorded' }), h('div', { class: 'dim', text: 'Every creature you fight is written down. Meet it once to learn what it is, twice to learn how it fights, three times to learn what hurts it.' })));
    l.forEach(x => { const n = x.note; out.push(h('div', { class: 'card' }, h('div', { class: 'row' }, h('b', { class: 'grow', text: n.name }), h('span', { class: 'shchip', text: n.family + (n.boss ? ' \u00b7 boss' : '') })), h('div', { class: 'dim', text: n.hab }),
      h('div', { class: 'dim', style: 'font-size:12px;margin-top:2px', text: ['', 'Known', 'Known \u00b7 how it fights', 'Fully studied'][x.tier] }),
      x.tier < 2 ? h('div', { class: 'dim', style: 'margin-top:4px', text: 'You do not yet know how it fights.' }) : [h('div', { class: 'sh-h', text: 'How it fights' }), n.moves.map(m => h('div', { text: '\u2022 ' + m })), n.views.length ? [h('div', { class: 'sh-h', text: 'What people say' }), n.views.map(v => h('div', { class: 'dim', text: fname(v.faction) + ': ' + v.text }))] : null],
      x.tier < 3 ? (x.tier === 2 ? h('div', { class: 'dim', style: 'margin-top:4px', text: 'Weaknesses unknown. Fight it again to learn them.' }) : null) : [h('div', { class: 'sh-h', text: 'What you have learned' }),
        n.weak.length ? h('div', { class: 'good', text: 'Weak to: ' + n.weak.join(', ') }) : null, n.resist.length ? h('div', { class: 'badc', text: 'Resists: ' + n.resist.join(', ') }) : null, n.tough.map(t => h('div', { class: 'dim', text: t })), !n.weak.length && !n.resist.length && !n.tough.length ? h('div', { class: 'dim', text: 'No particular weakness.' }) : null])); });
    if (all) { const unk = Object.values(C.BEASTS || {}).filter(B => !known.has(B.id)); if (unk.length) out.push(h('div', { class: 'sh-h', text: 'Not yet met (' + unk.length + ')' }), unk.map(B => h('div', { class: 'card', style: 'opacity:.75' }, h('div', { class: 'row' }, h('b', { class: 'grow', text: B.boss ? 'Something old and terrible' : 'Unknown ' + (B.famName || 'creature').toLowerCase() }), h('span', { class: 'shchip', text: (B.famName || '') + (B.boss ? ' \u00b7 boss' : '') })), h('div', { class: 'dim', text: 'Said to haunt: ' + (B.hab || 'nobody is sure where.') })))); }
    return out;
  }
  function bestiarySheet() { sheet('Bestiary', () => bestiaryBody(true)); }
  function menuScreen(main) {
    const slots = S.listSlots().filter(s => s.slot !== 'auto');
    main.appendChild(h('div', { class: 'pad' },
      h('div', { class: 'sh-h', text: 'Save slots' }),
      slots.map(s => h('div', { class: 'card' }, h('div', { class: 'row' }, h('div', { class: 'grow' }, h('b', { text: 'Slot ' + s.slot }), h('div', { class: 'dim', text: s.empty ? 'Empty' : s.error ? 'Unreadable' : s.name + ' · day ' + s.day })),
        btn('Save', () => { const r = S.saveSlot(s.slot, ST); toast(r.ok ? 'Saved to slot ' + s.slot : 'Save failed: ' + (r.error || ''), !r.ok); render(); }, 'sm pri'), btn('Load', () => loadSlot(s.slot), 'sm', s.empty || !!s.error)))),
      h('div', { class: 'sh-h', text: 'Backup' }), btn('Download save file', () => { try { S.download(ST, 'call-of-calamity-save.json'); } catch (e) { toast('Download failed', true); } }, 'full'), h('div', { style: 'height:8px' }), btn('Copy save to clipboard', copySave, 'full'), h('div', { style: 'height:8px' }), btn('Import save file', importFile, 'full'), h('div', { style: 'height:8px' }), btn('Paste a save', pasteSave, 'full'),
      h('div', { class: 'sh-h', text: 'Records' }), btn('Bestiary (' + C.bestiaryList(ST).length + ')', bestiarySheet, 'full'),
      h('div', { class: 'sh-h', text: 'Game' }), btn('Quit to title', () => { autosave(); view = 'title'; sheetFn = null; render(); }, 'full'),
      h('div', { class: 'dim', style: 'margin-top:14px', text: S.storageOk() ? 'Saves are kept in this browser. Download a file to keep a backup.' : 'Browser storage is blocked here: saves last only until you close this page. Download a file to keep your progress.' })));
  }

  window.GAME_SHELL = { state: () => ST, render, playScene, _ownerField: () => ({ builds: ownerField.builds, key: ownerField.key }), showOnMap, nodeSheet: id => nodeSheet(id), openJournal: sub => { if (window.GAME_STORY_SCREENS) window.GAME_STORY_SCREENS.close(); jTab = sub || 'quests'; tab = 'quests'; render(); }, pathTo, travelPath: p => travel(p), open: () => { showShell(true); }, _set: s => { ST = s; view = 'game'; } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount); else mount();
})();
