/* Export injects a code-only version and exact asset URLs. Public GET data only. */
const VERSION='__STOCKROOM_VERSION__';
const PREFIX='stockroom-app-',SHELL=PREFIX+'shell-'+VERSION,DATA=PREFIX+'public-data';
const FILES=__STOCKROOM_PRECACHE__;
const BASE=new URL('./',self.location.href),PUBLIC=['quotes.json','full-market.json','catalog.json','fundamentals.json','ai.json','news.json'].map(x=>new URL('data/'+x,BASE).href);
const CRITICAL=new Set(['quotes.json','full-market.json']);
async function tell(type,path){const clients=await self.clients.matchAll({type:'window'});for(const client of clients)client.postMessage({type,path});}
async function storeData(cache,request,response){
 if(!response.ok||!(response.headers.get('Content-Type')||'').includes('application/json'))return false;
 try{const value=await response.clone().json(),url=typeof request==='string'?request:request.url,name=new URL(url).pathname.split('/').at(-1),key=['quotes.json','full-market.json'].includes(name)?'quotes':['fundamentals.json','ai.json'].includes(name)?'reports':'items';if(!value||!Array.isArray(value[key]))return false;}catch{return false;}
 await cache.put(request,response.clone());return true;
}
self.addEventListener('install',event=>{event.waitUntil((async()=>{const cache=await caches.open(SHELL);await cache.addAll(FILES.map(x=>new Request(new URL(x,BASE),{cache:'reload'})));const data=await caches.open(DATA);await Promise.allSettled(PUBLIC.map(async url=>{const r=await fetch(new Request(url,{cache:'no-store'}));await storeData(data,url,r);}));})());});
self.addEventListener('activate',event=>{event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith(PREFIX)&&key!==SHELL&&key!==DATA)await caches.delete(key);await self.clients.claim();})());});
self.addEventListener('message',event=>{if(event.data?.type==='APPLY_UPDATE')self.skipWaiting();});
self.addEventListener('fetch',event=>{
 const r=event.request,u=new URL(r.url);if(r.method!=='GET'||u.origin!==BASE.origin||!u.pathname.startsWith(BASE.pathname))return;
 if(r.mode==='navigate'&&(u.pathname===BASE.pathname||u.pathname===BASE.pathname+'index.html')){event.respondWith((async()=>{try{const response=await fetch(r);if(response.ok)return response;throw Error('navigation unavailable');}catch{return await (await caches.open(SHELL)).match(new URL('./',BASE).href)||await (await caches.open(SHELL)).match(new URL('index.html',BASE).href)||Response.error();}})());return;}
 if(PUBLIC.includes(u.href)){event.respondWith((async()=>{const cache=await caches.open(DATA),path=u.pathname.split('/').at(-1);try{const response=await fetch(new Request(r,{cache:'no-store'}));if(!response.ok)throw Error('data unavailable');if(!await storeData(cache,r,response))throw Error('invalid public dataset');if(CRITICAL.has(path))await tell('DATA_ONLINE',path);return response;}catch(error){if(CRITICAL.has(path))await tell('DATA_OFFLINE',path);const cached=await cache.match(r);if(!cached)throw error;const headers=new Headers(cached.headers);headers.set('X-Stockroom-Offline','1');return new Response(await cached.arrayBuffer(),{status:cached.status,headers});}})());return;}
 if(FILES.some(file=>new URL(file,BASE).href===u.href)){event.respondWith((async()=>await (await caches.open(SHELL)).match(r)||fetch(r))());}
});
