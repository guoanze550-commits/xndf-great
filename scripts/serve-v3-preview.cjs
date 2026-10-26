// Dependency-free local server for the downloadable classroom web preview.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(process.argv[2]||path.join(__dirname,'game'));
const base='/xndf-great/preview/v3/';
const port=Number(process.env.PORT||4080);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.wasm':'application/wasm','.mp3':'audio/mpeg','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.task':'application/octet-stream'};
if(!fs.existsSync(path.join(root,'index.html')))throw new Error('Missing game/index.html. Extract the complete preview ZIP first.');
http.createServer((req,res)=>{
 try {
  const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);
  if(pathname==='/'){res.writeHead(302,{Location:base});res.end();return;}
  if(!pathname.startsWith(base)){res.writeHead(404);res.end('Not found');return;}
  const relative=pathname.slice(base.length)||'index.html';
  const file=path.resolve(root,relative);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end('Not found');return;}
  res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Content-Length':fs.statSync(file).size,'Cache-Control':'no-store'});
  if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
 }catch{res.writeHead(400);res.end('Bad request');}
}).listen(port,'127.0.0.1',()=>console.log(`V3 preview ready. Open http://127.0.0.1:${port}${base} in your browser. Ctrl+C to stop.`));
