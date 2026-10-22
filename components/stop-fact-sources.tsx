"use client";
import { useRef, useState } from "react";
import { getAttractionDetail } from "@/lib/attraction-details";
import { factSources, type AttractionFacts, type FactId } from "@/lib/attraction-facts";
import { evidenceTime, type EvidenceAccess } from "@/components/route-check-panel";

export function StopFactSources({title,locationId,meal,generated,access,showPlanningClaim=true,customActivityId}:{title:string;locationId?:string;meal?:string;generated:boolean;access?:EvidenceAccess;showPlanningClaim?:boolean;customActivityId?:string}){
  const detail=meal||customActivityId?undefined:getAttractionDetail({id:locationId==="shibuyaSky"?"shibuya":locationId??"",name:title});
  const id=detail?.id as FactId|undefined;
  const [result,setResult]=useState<{id:string;data:AttractionFacts}>(),[loading,setLoading]=useState(false),[message,setMessage]=useState("");
  const version=useRef(0);
  async function lookup(){
    if(!access||!id)return;const local=++version.current;setLoading(true);setMessage("");
    try{
      const response=await fetch(`/api/groups/${access.code}/facts`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${access.token}`},body:JSON.stringify({id}),signal:AbortSignal.timeout(20000)});
      const data=await response.json() as AttractionFacts & {message?:string};if(!response.ok)throw new Error(data.message??"Official-source lookup failed.");
      if(local===version.current)setResult({id,data});
    }catch(error){if(local===version.current)setMessage(error instanceof Error?error.message:"Could not check the official page. No fact is verified by a failed lookup.");}
    finally{if(local===version.current)setLoading(false);}
  }
  const data=result&&result.id===id?result.data:undefined;
  return <details className="mt-3 rounded-xl border border-[#dce4e7] bg-white/80 p-3">
    <summary className="min-h-8 cursor-pointer text-sm font-medium text-[#315b7d]">Sources &amp; fact status</summary>
    <div className="mt-3 space-y-3 text-xs leading-5 text-muted-foreground">
      {showPlanningClaim&&<p><span className="font-semibold text-[#17384d]">Schedule / meal estimate:</span> {generated?"DeepSeek-generated planning suggestion":"Team-authored sample suggestion"}. Not a verified opening time, menu quote or reservation.</p>}
      {customActivityId&&<p>Custom request from a traveler. Search matches identify a place only; timing and activity details remain unverified. This custom stop is not plotted or measured by the route checker. Review the original request in the group summary and check directions externally.</p>}
      {id&&Object.hasOwn(factSources,id)?<>
        <p><span className="font-semibold text-[#17384d]">Attraction reference:</span> {factSources[id].name}. {title.includes(factSources[id].name)?"":"This is the nearby attraction reference, not proof that an alternative café or activity has been checked."} <a href={factSources[id].url} target="_blank" rel="noopener noreferrer" className="underline">{factSources[id].provider}</a>.</p>
        <button type="button" disabled={loading||!access} onClick={lookup} className="min-h-11 rounded-full border border-[#c9d7db] px-4 text-sm font-medium text-[#17384d] disabled:opacity-50">{loading?"Reading official source…":data?"Check official source again":"Check official hours & admission"}</button>
        {message&&<p role="alert" className="text-[#a44832]">{message}</p>}
        <div className="space-y-2"><p><strong>Opening hours:</strong> {data?.hours??"Unverified — not retrieved from the official page."}</p><p><strong>Admission:</strong> {data?.admission??"Unverified — no current ticket quote retrieved."}</p>{data?.closure&&<p><strong>Closure rules:</strong> {data.closure}</p>}</div>
        {data?<><p className="font-medium text-[#315b7d]">{data.status==="unavailable"?"Source unavailable · last attempt":data.cached?"Cached source check":"Source retrieved"}: {evidenceTime(data.queriedAt)}. {data.status==="partial"?"Some fields could not be extracted.":""}</p><p>{data.note}</p></>:<p>No source-query date yet. A link alone does not mean its contents were verified.</p>}
      </>:<p><strong>Venue facts:</strong> No confirmed venue-specific hours or price source for this stop. Restaurant candidates have their own Google Maps source and query timestamp when live lookup is available.</p>}
    </div>
  </details>;
}
