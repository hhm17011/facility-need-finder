import {createReadStream,existsSync,statSync} from 'node:fs';
import {createServer,type IncomingMessage,type ServerResponse} from 'node:http';
import {extname,resolve,sep} from 'node:path';
import {createEvidenceMiddleware} from '../backend/evidence/api';
import {createRegionalDataMiddleware} from '../backend/dataProviders/api';

const root=process.cwd(),dist=resolve(root,'dist');
const evidence=createEvidenceMiddleware(process.env);
const regional=createRegionalDataMiddleware(process.env);
const mime:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.geojson':'application/geo+json; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon','.woff2':'font/woff2'};
const staticResponse=(req:IncomingMessage,res:ServerResponse)=>{if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}let pathname='/';try{pathname=decodeURIComponent(new URL(req.url??'/','http://localhost').pathname);}catch{res.writeHead(400);res.end();return;}let file=resolve(dist,`.${pathname}`);if(!file.startsWith(`${dist}${sep}`)&&file!==dist){res.writeHead(403);res.end();return;}if(!existsSync(file)||statSync(file).isDirectory())file=resolve(dist,'index.html');const headers={'Content-Type':mime[extname(file)]??'application/octet-stream','Cache-Control':file.endsWith('index.html')?'no-cache':'public, max-age=31536000, immutable'};res.writeHead(200,headers);if(req.method==='HEAD'){res.end();return;}createReadStream(file).pipe(res);};
const server=createServer((req,res)=>{if(req.url==='/healthz'){res.writeHead(200,{'Content-Type':'text/plain','Cache-Control':'no-store'});res.end('ok');return;}evidence(req,res,()=>regional(req,res,()=>staticResponse(req,res))).catch(()=>{if(!res.headersSent)res.writeHead(500);if(!res.writableEnded)res.end();});});
const port=Number(process.env.PORT??10000);
server.listen(port,'0.0.0.0',()=>console.log(`facility-need-finder listening on 0.0.0.0:${port}`));
