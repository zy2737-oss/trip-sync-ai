export const factSources={
  sensoji:{name:"Sensō-ji",provider:"Sensō-ji official website",url:"https://www.senso-ji.jp/english/"},
  museum:{name:"Tokyo National Museum",provider:"Tokyo National Museum",url:"https://www.tnm.jp/modules/r_free_page/index.php?id=113&lang=en"},
  meiji:{name:"Meiji Jingu",provider:"Meiji Jingu",url:"https://www.meijijingu.or.jp/en/visit/"},
  teamlab:{name:"teamLab Borderless",provider:"teamLab",url:"https://www.teamlab.art/e/tokyo/"},
  shibuya:{name:"Shibuya Sky",provider:"Shibuya Scramble Square",url:"https://www.shibuya-scramble-square.com/sky/"},
  tsukiji:{name:"Tsukiji Outer Market",provider:"Tsukiji Outer Market association",url:"https://www.tsukiji.or.jp/english/"},
} as const;
export type FactId=keyof typeof factSources;
export type AttractionFacts={id:FactId;queriedAt:string;source:typeof factSources[FactId];hours:string|null;admission:string|null;closure:string|null;cached:boolean;status:"partial"|"retrieved"|"unavailable";note:string};
function plainText(html:string){return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ").replace(/<[^>]+>/g," ").replace(/&#(?:x([a-f0-9]+)|(\d+));/gi,(_,hex,decimal)=>{const n=parseInt(hex??decimal,hex?16:10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):" ";}).replace(/&nbsp;|&#160;/gi," ").replace(/&amp;/g,"&").replace(/&ndash;/g,"–").replace(/&mdash;/g,"—").replace(/\s+/g," ").trim();}
export function parseOfficialFacts(id:FactId,html:string,queriedAt:string):AttractionFacts{
  const text=plainText(html);let hours:string|null=null,admission:string|null=null,closure:string|null=null;
  if(id==="museum"){
    const times=text.match(/\bHours\s+(\d{1,2}:\d{2}\s*a\.?m\.?)\s*[–—-]\s*(\d{1,2}:\d{2}\s*p\.?m\.?)/i);
    if(times)hours=`Listed regular hours: ${times[1]}–${times[2].replace(/\.$/,"")}. Extended days and special exhibitions may differ; check the full calendar.`;
    const price=text.match(/Adults\s+([\d,]+)\s*yen\s+University Students\s+([\d,]+)\s*yen/i);
    if(price)admission=`Collection exhibitions: adult JPY ${price[1]}; university student JPY ${price[2]}. Special exhibitions and eligibility rules differ.`;
    if(/\bClosed\s+Mondays\b/i.test(text))closure="Normally closed Mondays, with holiday exceptions and additional dated closures. No trip-date calendar check has been performed.";
  }else if(id==="meiji"){
    const month="January|February|March|April|May|June|July|August|September|October|November|December";
    const rows=[...text.matchAll(new RegExp(`(${month})\\s+(\\d{1,2}:\\d{2}\\s*[ap]m)\\s+(\\d{1,2}:\\d{2}\\s*[ap]m)`,"gi"))];
    if(rows.length)hours="Seasonal gate hours: "+rows.map(r=>`${r[1]} ${r[2]}–${r[3]}`).join("; ")+". Inner facilities may have shorter hours.";
    if(/Meiji Jingu is open every day throughout the year with free of charge/i.test(text))admission="Main shrine access is listed as free. Separate facilities or exhibitions may charge admission.";
  }else if(id==="teamlab"){
    const times=text.match(/\bHours\s+(\d{1,2}:\d{2})\s*[–—-]\s*(\d{1,2}:\d{2})/i);
    if(times)hours=`Listed standard hours: ${times[1]}–${times[2]}. Dated extensions and closures apply; this is not a check for your travel date.`;
    const price=text.match(/Adults\s+18\s+and\s+above\s+JPY\s+([\d,]+)/i);
    if(price && /subject to a dynamic pricing system/i.test(text))admission=`Listed adult reference: JPY ${price[1]}. Dynamic date/time pricing applies; not a ticket quote or availability check.`;
  }
  return {id,queriedAt,source:factSources[id],hours,admission,closure,cached:false,status:hours&&admission?"retrieved":"partial",note:"Extracted fields are a dated source snapshot, not a guarantee. Unavailable fields stay unverified. The app has no travel dates, so opening on your exact day and ticket availability are not checked."};
}
export async function fetchOfficialFacts(id:FactId,fetcher:typeof fetch=fetch):Promise<AttractionFacts>{
  if(!Object.hasOwn(factSources,id))throw new Error("Unknown attraction");
  const response=await fetcher(factSources[id].url,{redirect:"follow",signal:AbortSignal.timeout(15000),headers:{"User-Agent":"TripSyncAI-coursework/1.0 (+https://tripsync-ai-tokyo.yannnnnzj.chatgpt.site)",Accept:"text/html"}});
  if(!response.ok)throw new Error(`Official source unavailable (HTTP ${response.status})`);
  // Do not turn unbounded remote pages into application state.
  const reader=response.body?.getReader();if(!reader)throw new Error("Empty official page");
  const decoder=new TextDecoder();let html="",size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>2500000){await reader.cancel();throw new Error("Source page too large");}html+=decoder.decode(value,{stream:true});}
  html+=decoder.decode();return parseOfficialFacts(id,html,new Date().toISOString());
}
