import { z } from "zod";
import { buildDailyRoute, routeLocations, type RouteStopInput, type LocationId } from "./daily-route.ts";
import { customActivityId } from "./custom-activities.ts";

const ids=Object.keys(routeLocations) as [LocationId,...LocationId[]];
export const routeCheckSchema=z.object({
  day:z.enum(["01","02","03","04","05"]),mode:z.enum(["walking","driving"]),
  stops:z.array(z.object({time:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d[–-]([01]\d|2[0-3]):[0-5]\d$/),title:z.string().min(1).max(160),detail:z.string().max(700).default(""),meal:z.enum(["Lunch","Dinner"]).optional(),locationId:z.enum(ids).optional(),customActivityId:customActivityId.optional()})).min(2).max(8),
});
export type RouteCheckInput=z.infer<typeof routeCheckSchema>;
export type RoutingMatrix={ids:LocationId[];distances:(number|null)[][];durations:(number|null)[][];snapDistances:(number|null)[];queriedAt:string;dataVersion?:string};
export type RouteLeg={from:number;to:number;fromTitle:string;toTitle:string;status:"estimated_gap"|"too_short"|"review"|"unknown"|"same_anchor";approximate:boolean;gapMinutes:number;distanceMeters?:number;durationSeconds?:number;note:string};
export type RouteCheck={mode:RouteCheckInput["mode"];legs:RouteLeg[];knownDistanceMeters:number;knownDurationSeconds:number;checkedLegs:number;totalLegs:number;queriedAt:string|null;dataVersion?:string;cached:boolean;provider:"FOSSGIS OSRM / OpenStreetMap"};
export function routingIds(day:string,stops:RouteStopInput[]):LocationId[]{
  return [...new Set(buildDailyRoute(day,stops).flatMap(s=>s.locationId?[s.locationId]:[]))].sort();
}
export function routingCacheKey(ids:LocationId[],mode:RouteCheckInput["mode"]){return `routing:v1:${mode}:${ids.join(",")}`;}
export async function fetchRoutingMatrix(ids:LocationId[],mode:RouteCheckInput["mode"],fetcher:typeof fetch=fetch):Promise<RoutingMatrix>{
  if(ids.length<2||ids.length>8||ids.some(id=>!Object.hasOwn(routeLocations,id)))throw new Error("Unsupported route points");
  const coordinates=ids.map(id=>`${routeLocations[id].lng},${routeLocations[id].lat}`).join(";");
  const profile=mode==="walking"?"foot":"car";
  const response=await fetcher(`https://routing.openstreetmap.de/routed-${profile}/table/v1/${profile}/${coordinates}?annotations=distance,duration&generate_hints=false`,{signal:AbortSignal.timeout(18000),headers:{"User-Agent":"TripSyncAI-coursework/1.0 (+https://tripsync-ai-tokyo.yannnnnzj.chatgpt.site)",Accept:"application/json"}});
  if(!response.ok)throw new Error("Routing provider unavailable");
  const raw=await response.json() as {code?:string;distances?:unknown;durations?:unknown;sources?:{distance?:unknown}[];data_version?:string};
  function matrix(value:unknown,max:number){if(!Array.isArray(value)||value.length!==ids.length)throw new Error("Incomplete routing matrix");return value.map(row=>{if(!Array.isArray(row)||row.length!==ids.length)throw new Error("Incomplete routing row");return row.map(v=>v===null?null:typeof v==="number"&&Number.isFinite(v)&&v>=0&&v<=max?v:null);});}
  if(raw.code!=="Ok")throw new Error("No routed path");
  return {ids,distances:matrix(raw.distances,100000),durations:matrix(raw.durations,86400),snapDistances:ids.map((_,i)=>typeof raw.sources?.[i]?.distance==="number"?raw.sources[i].distance as number:null),queriedAt:new Date().toISOString(),...(raw.data_version && Number.isFinite(Date.parse(raw.data_version))?{dataVersion:raw.data_version}:{})};
}
const minutes=(value:string)=>{const [h,m]=value.split(":").map(Number);return h*60+m;};
export function assessRoute(input:RouteCheckInput,matrix:RoutingMatrix|null,cached=false):RouteCheck{
  const route=buildDailyRoute(input.day,input.stops);const legs:RouteLeg[]=[];
  for(let i=1;i<route.length;i++){
    const from=route[i-1],to=route[i],gap=minutes(to.time.split(/[–-]/)[0])-minutes(from.time.split(/[–-]/)[1]);
    const base={from:from.number,to:to.number,fromTitle:from.title,toTitle:to.title,approximate:from.approximate||to.approximate,gapMinutes:gap};
    if(!from.locationId||!to.locationId){legs.push({...base,status:"unknown",note:"An endpoint is unconfirmed. No distance or time has been invented."});continue;}
    if(from.locationId===to.locationId){legs.push({...base,status:"same_anchor",note:"Same reference pin. Movement within the venue or neighborhood is not measured; this does not mean zero walking."});continue;}
    const a=matrix?.ids.indexOf(from.locationId)??-1,b=matrix?.ids.indexOf(to.locationId)??-1;
    const distance=matrix?.distances[a]?.[b],duration=matrix?.durations[a]?.[b];
    if(distance==null||duration==null){legs.push({...base,status:"unknown",note:"No provider route was returned. This leg remains unverified."});continue;}
    const snapped=(matrix?.snapDistances[a]??Infinity)>250||(matrix?.snapDistances[b]??Infinity)>250;
    const mixed=/\b(transfer|train|subway|taxi|bus|ride)\b/i.test(from.title+" "+to.title);
    const short=Math.ceil(duration/60)>gap;
    let status:RouteLeg["status"]=short&&!mixed?"too_short":"estimated_gap";
    let note=short?"Estimated travel exceeds the gap between these scheduled blocks. Adjust the plan or check another mode.":"Provider travel estimate fits the displayed gap only; queues, access walks and venue time are not validated.";
    if(mixed){status="review";note="Travel appears inside a transfer/activity block. Allocate the shown travel time within that block; it has not been counted as free time.";}
    if(snapped){status="review";note="The provider snapped a reference point more than 250 m onto its network, or did not report snapping distance. Confirm the actual entrances.";}
    if(base.approximate)note+=" At least one endpoint is an approximate area, not a confirmed entrance or restaurant.";
    legs.push({...base,status,note,distanceMeters:distance,durationSeconds:duration});
  }
  const checked=legs.filter(l=>l.distanceMeters!==undefined);
  return {mode:input.mode,legs,knownDistanceMeters:checked.reduce((s,l)=>s+l.distanceMeters!,0),knownDurationSeconds:checked.reduce((s,l)=>s+l.durationSeconds!,0),checkedLegs:checked.length,totalLegs:legs.length,queriedAt:matrix?.queriedAt??null,...(matrix?.dataVersion?{dataVersion:matrix.dataVersion}:{}),cached,provider:"FOSSGIS OSRM / OpenStreetMap"};
}
