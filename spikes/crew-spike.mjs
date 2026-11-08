const K = process.env.HELIUS_API_KEY;
const W = process.argv[2];
const SKIP = new Set(['So11111111111111111111111111111111111111112','EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v','Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB']);
const sleep = ms=>new Promise(s=>setTimeout(s,ms));
const get = async u => { for (let i=0;i<5;i++){ const r = await fetch(u); if (r.status===429){await sleep(1200);continue;} const j=await r.json().catch(()=>null); return j; } };
const isBuyBy = (t,w) => t.feePayer===w && (t.tokenTransfers||[]).some(x=>x.toUserAccount===w && !SKIP.has(x.mint));
let txs=[], before='';
for (let p=0;p<3;p++){ const a=await get(`https://api.helius.xyz/v0/addresses/${W}/transactions?api-key=${K}&limit=100${before?`&before=${before}`:''}`); if(!Array.isArray(a)||!a.length)break; txs.push(...a); before=a[a.length-1].signature; }
const buys=[];
for (const t of txs) if (isBuyBy(t,W)) { const m=t.tokenTransfers.find(x=>x.toUserAccount===W&&!SKIP.has(x.mint)).mint; if(!buys.find(b=>b.mint===m)) buys.push({mint:m,ts:t.timestamp}); }
console.log('txs',txs.length,'distinct tokens bought',buys.length);
const co=new Map(); let scanned=0;
for (const b of buys.slice(0,12)) {
  let bf='', near=[], pages=0;
  while (pages<8) { const a=await get(`https://api.helius.xyz/v0/addresses/${b.mint}/transactions?api-key=${K}&limit=100${bf?`&before=${bf}`:''}`); pages++;
    if(!Array.isArray(a)||!a.length)break; for(const t of a) if(Math.abs(t.timestamp-b.ts)<=20) near.push(t);
    bf=a[a.length-1].signature; if(a[a.length-1].timestamp<b.ts-30)break; }
  const buyers=new Set(); for(const t of near) if(t.feePayer!==W&&isBuyBy(t,t.feePayer)&&t.tokenTransfers.some(x=>x.mint===b.mint&&x.toUserAccount===t.feePayer)) buyers.add(t.feePayer);
  for(const w of buyers) co.set(w,(co.get(w)||0)+1); scanned++;
  console.log(b.mint.slice(0,8),new Date(b.ts*1000).toISOString(),'pages',pages,'co-buyers within 20s',buyers.size);
}
const crew=[...co].filter(([,n])=>n>=2).sort((a,b)=>b[1]-a[1]).slice(0,12);
console.log(`tokens scanned ${scanned}; wallets co-buying within 20s on 2+ tokens:`); console.log(crew);
