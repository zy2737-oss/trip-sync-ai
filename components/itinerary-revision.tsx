"use client";
import { useState } from "react";
export function ItineraryRevision({busy,disabledReason,onRevise}:{busy:boolean;disabledReason?:string;onRevise:(request:string)=>Promise<boolean>}){
  const [request,setRequest]=useState(""),[message,setMessage]=useState("");
  async function submit(){if(disabledReason||busy||request.trim().length<3)return;setMessage("");if(await onRevise(request.trim())){setRequest("");setMessage("Updated for your group.");}else setMessage("Update failed. Previous plan kept.");}
  return <section aria-label="Request itinerary changes" className="rounded-2xl border border-[#c9d7db] bg-white p-5">
    <h2 className="font-semibold">Refine your trip</h2>
    <div className="mt-3 flex flex-wrap gap-2">{[["Less walking","Less walking, with more seated breaks"],["More food","More local food experiences within our budget"],["Slower mornings","A slower morning on Day 2"]].map(([label,text])=><button key={label} type="button" disabled={busy} onClick={()=>{setRequest(text);setMessage("");}} className="min-h-11 rounded-full border border-[#c9d7db] px-3 py-2 text-xs font-medium disabled:opacity-50">{label}</button>)}</div>
    <label htmlFor="revision-request" className="mt-4 block text-sm font-medium">What would you like to change?</label><textarea id="revision-request" maxLength={800} value={request} disabled={busy} onChange={e=>setRequest(e.target.value)} placeholder="e.g. Add a café break on Day 3" className="mt-2 min-h-32 w-full rounded-xl border border-[#c9d7db] bg-white p-3 text-sm"/>
    <p className="mt-2 text-xs text-muted-foreground">{request.length}/800 · Keeps your group's saved preferences.</p>
    {disabledReason&&<p className="mt-3 text-sm text-[#a44832]">{disabledReason}</p>}
    <button type="button" onClick={submit} disabled={busy||!!disabledReason||request.trim().length<3} className="mt-4 min-h-12 w-full rounded-full bg-[#17384d] px-4 py-3 text-sm font-semibold text-white disabled:opacity-45">{busy?"Revising your plan…":"Update group itinerary"}</button>
    <p role="status" aria-live="polite" className="mt-3 text-sm leading-6 text-[#315b7d]">{message}</p>
  </section>;
}
