import { z } from "zod";

export const customActivityId = z.string().regex(/^custom-[a-f0-9-]{36}$/);
export const activityCandidateSchema = z.object({
  id:z.string().regex(/^(node|way|relation)-\d{1,16}$/),
  name:z.string().trim().min(1).max(100),address:z.string().trim().min(1).max(200),
  lat:z.number().finite().min(34.8).max(36.5),lng:z.number().finite().min(138.5).max(141),
  provider:z.literal("Photon / OpenStreetMap"),queriedAt:z.string().datetime(),
});
export type ActivityCandidate=z.infer<typeof activityCandidateSchema>;
export const customActivitySchema=z.object({
  id:customActivityId,name:z.string().trim().min(1).max(100),priority:z.enum(["must","interested"]),
  timing:z.string().trim().min(1).max(120),location:z.string().trim().min(1).max(200),
  description:z.string().trim().min(1).max(400),match:activityCandidateSchema.optional(),
});
export type CustomActivity=z.infer<typeof customActivitySchema>;
export function candidateUrl(candidate:Pick<ActivityCandidate,"id">){const [kind,id]=candidate.id.split("-");return `https://www.openstreetmap.org/${kind}/${id}`;}
export function sameCandidate(a:ActivityCandidate,b:ActivityCandidate){return (Object.keys(activityCandidateSchema.shape) as (keyof ActivityCandidate)[]).every(key=>a[key]===b[key]);}
export function candidateCacheKey(candidate:ActivityCandidate){return `activity-candidate:v1:${candidate.id}:${candidate.queriedAt}`;}

export const activitySearchSchema=z.object({query:z.string().trim().min(2).max(100)});
export type ActivitySearchResult={candidates:ActivityCandidate[];queriedAt:string;cached:boolean};
// Only a user-initiated place-name search. No autocomplete, private descriptions or arbitrary URLs.
export async function searchActivityPlaces(query:string,fetcher:typeof fetch=fetch):Promise<ActivitySearchResult>{
  const url=new URL("https://photon.komoot.io/api/");
  Object.entries({q:activitySearchSchema.parse({query}).query,limit:"3",lang:"en",lat:"35.68",lon:"139.76",bbox:"138.5,34.8,141,36.5"}).forEach(([key,value])=>url.searchParams.set(key,value));
  const response=await fetcher(url,{signal:AbortSignal.timeout(15000),headers:{Accept:"application/json","User-Agent":"TripSyncAI-coursework/1.0 (+https://tripsync-ai-tokyo.yannnnnzj.chatgpt.site)"}});
  if(!response.ok)throw new Error("Place search is unavailable");
  const reader=response.body?.getReader();if(!reader)throw new Error("Empty search response");
  let size=0,raw="";const decoder=new TextDecoder();
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>200000){await reader.cancel();throw new Error("Search response too large");}raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();
  const data=JSON.parse(raw) as {features?:{properties?:Record<string,unknown>;geometry?:{type?:string;coordinates?:number[]}}[]};
  if(!Array.isArray(data.features))throw new Error("Invalid search response");
  const queriedAt=new Date().toISOString(),candidates:ActivityCandidate[]=[];
  for(const feature of data.features.slice(0,20)){
    const p=feature.properties??{},coordinates=feature.geometry?.coordinates??[];
    const kind={N:"node",W:"way",R:"relation"}[String(p.osm_type)];
    if(feature.geometry?.type!=="Point"||!kind||!Number.isSafeInteger(p.osm_id)||typeof p.name!=="string"||p.countrycode!=="JP")continue;
    const address=[p.housenumber,p.street,p.locality,p.district,p.city,p.state,p.postcode,p.country].filter(v=>typeof v==="string"&&v.trim()).join(", ").slice(0,200);
    const parsed=activityCandidateSchema.safeParse({id:`${kind}-${p.osm_id}`,name:p.name.slice(0,100),address,lat:coordinates[1],lng:coordinates[0],provider:"Photon / OpenStreetMap",queriedAt});
    if(parsed.success&&!candidates.some(c=>c.id===parsed.data.id))candidates.push(parsed.data);
    if(candidates.length===3)break;
  }
  return {candidates,queriedAt,cached:false};
}
