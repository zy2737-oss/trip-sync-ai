"use client";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Clock3, Footprints, Route } from "lucide-react";
import type { RouteCheck, RouteCheckInput } from "@/lib/route-check";
import type { RouteStopInput } from "@/lib/daily-route";

export type EvidenceAccess={code:string;token:string};
export function evidenceTime(value:string){return new Date(value).toLocaleString("en-US",{timeZone:"Asia/Tokyo",year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})+" JST";}
function distance(value:number){return value>=1000?`${(value/1000).toFixed(1)} km`:`${Math.round(value)} m`;}
export function RouteCheckPanel({day,stops,access}:{day:string;stops:RouteStopInput[];access?:EvidenceAccess}){
  const [mode,setMode]=useState<RouteCheckInput["mode"]>("walking");
  const payload={day,mode,stops:stops.map(s=>({time:s.time,title:s.title,detail:s.detail,...(s.meal?{meal:s.meal}:{}),...(s.locationId?{locationId:s.locationId}:{}),...(s.customActivityId?{customActivityId:s.customActivityId}:{})}))};
  const signature=JSON.stringify(payload);
  const [report,setReport]=useState<{key:string;data:RouteCheck & {message?:string;attemptedAt?:string}}>();
  const [loading,setLoading]=useState(false),[message,setMessage]=useState("");
  const version=useRef(0),controller=useRef<AbortController|null>(null);
  useEffect(()=>{version.current++;controller.current?.abort();setLoading(false);setMessage("");return()=>controller.current?.abort();},[signature,access?.code]);
  async function check(){
    if(!access){setMessage("Join a group to check actual route estimates.");return;}
    const id=++version.current;controller.current?.abort();const local=new AbortController();controller.current=local;
    setLoading(true);setMessage("");
    try{
      const response=await fetch(`/api/groups/${access.code}/routes`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${access.token}`},body:signature,signal:local.signal});
      const data=await response.json() as RouteCheck & {message?:string};
      if(!response.ok)throw new Error(data.message??"Could not check route estimates.");
      if(id===version.current){setReport({key:signature,data});setMessage(data.message??"");}
    }catch(error){if(!local.signal.aborted&&id===version.current)setMessage(error instanceof Error?error.message:"Route check failed. Previous results, if any, remain dated estimates.");}
    finally{if(id===version.current)setLoading(false);}
  }
  const result=report?.key===signature?report.data:undefined;
  return <section aria-label={`Day ${day} travel-time check`} className="mt-4 rounded-2xl border border-[#c9d7db] bg-white p-4 sm:p-5">
    <h4 className="flex items-center gap-2 font-semibold"><Route className="h-4 w-4" />Route distance &amp; time check</h4>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">Calculated road/path estimates between the map's reference pins—not straight-line distances, live traffic or train timetables.</p>
    <div className="mt-3 flex flex-wrap gap-2">{(["walking","driving"] as const).map(value=><button key={value} type="button" disabled={loading} aria-pressed={mode===value} onClick={()=>setMode(value)} className={`min-h-11 rounded-full border px-4 text-sm font-medium ${mode===value?"border-[#17384d] bg-[#17384d] text-white":"border-[#c9d7db] bg-white text-[#17384d]"}`}>{value==="walking"?"Walking":"Car estimate"}</button>)}<button type="button" disabled={loading||!access} onClick={check} className="min-h-11 rounded-full bg-[#ef6a53] px-4 text-sm font-semibold text-white disabled:opacity-50">{loading?"Checking route…":result?"Check again":"Check route estimates"}</button></div>
    <p role="status" aria-live="polite" className="mt-3 text-sm leading-6 text-[#a44832]">{message}</p>
    {result&&<div className="mt-3 space-y-4">
      <div className="rounded-xl bg-[#edf4f7] p-3"><p className="flex items-center gap-2 text-sm font-semibold"><Footprints className="h-4 w-4" />{result.checkedLegs?`${distance(result.knownDistanceMeters)} across ${result.checkedLegs} of ${result.totalLegs} inter-stop legs`:"No inter-stop distances verified"}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{mode==="walking"?"Walking scenario: assumes every checked leg is walked, even if the draft suggests a train. Excludes movement inside venues, restaurants, hotels and unconfirmed stops. This is not your expected full-day walking total; your walking limit is NOT verified.":"Car scenario: excludes live traffic, parking, queues and access walking. It does not validate your public-transport plan or daily walking limit."}</p></div>
      <ol className="space-y-3">{result.legs.map(leg=><li key={`${leg.from}-${leg.to}`} className={`rounded-xl border p-3 ${leg.status==="too_short"?"border-[#edb4a8] bg-[#fff3ed]":"border-[#dce4e7]"}`}>
        <p className="text-sm font-semibold">{leg.from} → {leg.to} · {leg.fromTitle} → {leg.toTitle}</p>
        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">{leg.distanceMeters!==undefined&&<span>{distance(leg.distanceMeters)}</span>}{leg.durationSeconds!==undefined&&<span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{Math.ceil(leg.durationSeconds/60)} min {mode==="walking"?"walk estimate":"car estimate"}</span>}<span>Schedule gap: {leg.gapMinutes} min</span></p>
        <p className={`mt-2 text-xs font-semibold ${leg.status==="too_short"?"text-[#a44832]":"text-[#65777e]"}`}>{leg.status==="too_short"?"⚠ Not enough time for this mode":leg.status==="estimated_gap"?"Estimated travel fits gap · not a full feasibility pass":leg.status==="same_anchor"?"Same pin · local movement unknown":leg.status==="unknown"?"Unverified leg":"Manual review needed"}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{leg.note}</p>
      </li>)}</ol>
      <p className="text-xs leading-5 text-muted-foreground">Source: <a href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noopener noreferrer" className="underline">FOSSGIS OSRM</a>, © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">OpenStreetMap contributors</a>. {result.queriedAt?`${result.cached?"Cached query":"Queried"}: ${evidenceTime(result.queriedAt)}.`:"No successful provider query for this result."} {result.dataVersion?`Provider data version: ${result.dataVersion}.`:"Provider map-update date not supplied."} <a href="https://www.openstreetmap.org/" target="_blank" rel="noopener noreferrer" className="underline">Fix the map</a>.</p>
    </div>}
    <p className="mt-3 text-xs leading-5 text-muted-foreground"><AlertTriangle className="mr-1 inline h-3.5 w-3.5" />No travel date is recorded. This check does not verify opening on your exact day, reservations, accessibility or public-transport schedules. Map connectors remain visit-order lines, not these calculated routes.</p>
  </section>;
}
