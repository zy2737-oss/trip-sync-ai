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
  return <details className="mt-2">
    <summary className="min-h-11 cursor-pointer py-3 text-xs font-medium text-[#315b7d]">Details &amp; sources</summary>
    <div className="mt-3 space-y-3 text-xs leading-5 text-muted-foreground">
      {showPlanningClaim&&<p>{generated?"AI planning estimate":"Sample estimate"} · Not a reservation.</p>}
      {customActivityId&&<p>Custom activity · Details unverified · Not mapped.</p>}
      {id&&Object.hasOwn(factSources,id)?<>
        <p><a href={factSources[id].url} target="_blank" rel="noopener noreferrer" className="underline">{factSources[id].provider}</a>{title.includes(factSources[id].name)?"":" · Nearby attraction reference"}</p>
        <button type="button" disabled={loading||!access} onClick={lookup} className="min-h-11 rounded-full border border-[#c9d7db] px-4 text-sm font-medium text-[#17384d] disabled:opacity-50">{loading?"Reading official source…":data?"Check official source again":"Check official hours & admission"}</button>
        {message&&<p role="alert" className="text-[#a44832]">{message}</p>}
        <div className="space-y-2"><p><strong>Hours:</strong> {data?.hours??(data?"Unavailable":"Not checked")}</p><p><strong>Admission:</strong> {data?.admission??(data?"Unavailable":"Not checked")}</p>{data?.closure&&<p><strong>Closures:</strong> {data.closure}</p>}</div>
        {data&&<p className="font-medium text-[#315b7d]">{data.status==="unavailable"?"Query failed":data.cached?"Cached query":"Queried"}: {evidenceTime(data.queriedAt)}</p>}
      </>:<p>Venue hours and prices unverified.</p>}
    </div>
  </details>;
}
