// Serves the game folder on port 8766 for the browser tests. Run: node serve.js &   (GAME_DIR=<game folder> to override)
const http=require('http'),fs=require('fs'),path=require('path');
const root=process.env.GAME_DIR||path.join(__dirname,'..','game'),T={'.html':'text/html','.js':'text/javascript','.png':'image/png','.jpg':'image/jpeg','.css':'text/css','.json':'application/json'};
http.createServer((q,r)=>{const f=path.join(root,decodeURIComponent(q.url.split('?')[0]));if(!f.startsWith(root)){r.writeHead(403);return r.end()}fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end()}r.writeHead(200,{'content-type':T[path.extname(f)]||'text/plain'});r.end(d)})}).listen(+process.env.PORT||8766,()=>console.log('serving '+root+' on '+(+process.env.PORT||8766)));
