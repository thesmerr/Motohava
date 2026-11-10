import express from 'express';
import webpush from 'web-push';
import cron from 'node-cron';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const app=express();app.use(express.json({limit:'32kb'}));
const {VAPID_PUBLIC_KEY,VAPID_PRIVATE_KEY,VAPID_SUBJECT,DATA_FILE=path.join(root,'server','subscriptions.json'),PORT=3000}=process.env;
if(!VAPID_PUBLIC_KEY||!VAPID_PRIVATE_KEY||!VAPID_SUBJECT)throw Error('VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY ve VAPID_SUBJECT gerekli');
webpush.setVapidDetails(VAPID_SUBJECT,VAPID_PUBLIC_KEY,VAPID_PRIVATE_KEY);
function read(){try{return JSON.parse(fs.readFileSync(DATA_FILE,'utf8'))}catch{return []}}
function write(data){fs.mkdirSync(path.dirname(DATA_FILE),{recursive:true});fs.writeFileSync(DATA_FILE,JSON.stringify(data,null,2),{mode:0o600})}
app.get('/api/public-key',(_req,res)=>res.json({key:VAPID_PUBLIC_KEY}));
app.post('/api/subscribe',(req,res)=>{const s=req.body;if(!s?.endpoint?.startsWith('https://')||!s.keys?.p256dh||!s.keys?.auth)return res.status(400).json({error:'Geçersiz abonelik'});let all=read().filter(x=>x.endpoint!==s.endpoint);all.push(s);write(all);res.json({ok:true})});
app.post('/api/unsubscribe',(req,res)=>{const endpoint=req.body?.endpoint;write(read().filter(s=>s.endpoint!==endpoint));res.json({ok:true})});
app.use(express.static(root));
const sites=[{name:'Çamlıca',lat:41.024,lon:29.063},{name:'15 Temmuz Köprüsü',lat:41.045,lon:29.034},{name:'Hadımköy',lat:41.157,lon:28.619}];
function istanbulDate(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
async function assess(){const date=istanbulDate();const all=await Promise.all(sites.map(async p=>{const u=new URL('https://api.open-meteo.com/v1/forecast');Object.entries({latitude:p.lat,longitude:p.lon,hourly:'temperature_2m,precipitation_probability,wind_gusts_10m',timezone:'Europe/Istanbul',forecast_days:2}).forEach(([k,v])=>u.searchParams.set(k,v));const response=await fetch(u,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Hava verisi alınamadı');return (await response.json()).hourly}));const rows=[];for(const h of all)for(let i=0;i<h.time.length;i++){const t=h.time[i],hour=Number(t.slice(11,13));if(t.startsWith(date)&&((hour>=7&&hour<=9)||(hour>=18&&hour<=20)))rows.push({rain:h.precipitation_probability[i],gust:h.wind_gusts_10m[i],temp:h.temperature_2m[i]})}if(!rows.length||rows.some(r=>Object.values(r).some(v=>!Number.isFinite(v))))throw Error('Eksik hava tahmini');const rain=Math.max(...rows.map(r=>r.rain)),gust=Math.max(...rows.map(r=>r.gust)),temp=Math.min(...rows.map(r=>r.temp));return {good:rain<=20&&gust<=40&&temp>=8,rain,gust,temp}}
async function checkAndSend(){try{const result=await assess();if(!result.good){console.log('Uygun değil, bildirim yok',result);return}const payload=JSON.stringify({title:'🏍️ MotoHava: Bugün sürüşe uygun',body:`Yağış en çok %${Math.round(result.rain)}, rüzgâr hamlesi ${Math.round(result.gust)} km/sa, en düşük ${Math.round(result.temp)}°C. Yola çıkmadan koşulları kontrol et.`});const subs=read();const invalid=new Set();await Promise.all(subs.map(async s=>{try{await webpush.sendNotification(s,payload)}catch(e){console.error('Push hatası',e.statusCode||e.message);if(e.statusCode===404||e.statusCode===410)invalid.add(s.endpoint)}}));if(invalid.size)write(read().filter(s=>!invalid.has(s.endpoint)));console.log('Gönderim tamamlandı',subs.length)}catch(e){console.error('Kontrol başarısız:',e.message)}}
cron.schedule('0 6 * * *',checkAndSend,{timezone:'Europe/Istanbul'});
app.listen(PORT,()=>console.log(`MotoHava ${PORT} portunda; günlük kontrol 06:00 Europe/Istanbul`));
