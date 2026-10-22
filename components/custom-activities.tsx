"use client";
import { useEffect, useRef, useState } from "react";
import { candidateUrl, customActivitySchema, type ActivityCandidate, type ActivitySearchResult, type CustomActivity } from "@/lib/custom-activities";
import { evidenceTime, type EvidenceAccess } from "@/components/route-check-panel";

type Props={value:CustomActivity[];access?:EvidenceAccess;topPick?:string;mustCount:number;onChange:(value:CustomActivity[])=>void;onTopPick:(id:string)=>void;onPendingChange:(pending:boolean)=>void};
const inputClass="min-h-11 w-full rounded-xl border border-[#c9d7db] bg-white px-3 py-2 text-sm disabled:bg-[#f3f6f6]";
const buttonClass="min-h-11 rounded-full border border-[#c9d7db] px-4 py-2 text-sm font-medium disabled:opacity-45";

export function CustomActivities({value,access,topPick,mustCount,onChange,onTopPick,onPendingChange}:Props){
  const [pending,setPending]=useState<Record<number,boolean>>({});
  const [slots,setSlots]=useState<(string|undefined)[]>(()=>[0,1,2].map(i=>value[i]?.id));
  const hasPending=Object.values(pending).some(Boolean);
  useEffect(()=>{onPendingChange(hasPending);},[hasPending,onPendingChange]);
  return <section aria-label="Custom activities" className="mt-8 rounded-3xl border border-[#c9d7db] bg-[#edf4f7] p-4 sm:p-6">
    <p className="text-xs font-semibold tracking-widest text-[#d9513f]">MAKE IT YOUR TRIP</p>
    <h2 className="mt-2 text-2xl font-semibold">Missing your kind of Tokyo?</h2>
    <p className="mt-3 text-sm leading-6 text-muted-foreground">Add up to three places or activities. Search, then tell us “Yes, this is the place.” If none match, describe when, where and what you want to do. Listed and custom picks share the same three must-visit limit.</p>
    <p className="mt-2 text-xs leading-5 text-muted-foreground">Search covers Tokyo and nearby areas, not event listings or bookings. Only the place-name query is sent to Photon / OpenStreetMap. Do not search private addresses or personal information. Details are saved with your profile when you submit.</p>
    <div className="mt-5 space-y-4">{slots.map((id,index)=>{const saved=value.find(a=>a.id===id);return <ActivitySlot key={`${index}:${id??"new"}`} index={index} activity={saved} access={access} isTop={!!id&&topPick===id} canMust={mustCount<3||saved?.priority==="must"} onPending={flag=>setPending(p=>p[index]===flag?p:{...p,[index]:flag})} onSave={activity=>{
      if(activity.match&&value.some(a=>a.id!==id&&a.match?.id===activity.match?.id))return "This place is already in your custom picks.";
      const next=value.some(a=>a.id===id)?value.map(a=>a.id===id?activity:a):[...value,activity];
      setSlots(current=>current.map((v,i)=>i===index?activity.id:v));onChange(next);return "";
    }} onRemove={()=>{onChange(value.filter(a=>a.id!==id));setSlots(current=>current.map((v,i)=>i===index?undefined:v));setPending(p=>({...p,[index]:false}));}} onTop={()=>id&&onTopPick(id)} />;})}</div>
    {hasPending&&<p role="status" className="mt-4 text-sm font-medium text-[#a44832]">Save or clear your unfinished custom activity before continuing.</p>}
    <p className="mt-4 text-xs leading-5 text-muted-foreground">Source: <a href="https://photon.komoot.io/" target="_blank" rel="noopener noreferrer" className="underline">Photon</a> / © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">OpenStreetMap contributors</a>. A confirmed match identifies a place, not its opening hours, tickets or availability. Custom stops are not yet included in the daily map or distance checker.</p>
  </section>;
}

function ActivitySlot({index,activity,access,isTop,canMust,onSave,onRemove,onTop,onPending}:{index:number;activity?:CustomActivity;access?:EvidenceAccess;isTop:boolean;canMust:boolean;onSave:(activity:CustomActivity)=>string;onRemove:()=>void;onTop:()=>void;onPending:(flag:boolean)=>void}){
  const [editing,setEditing]=useState(!activity),[query,setQuery]=useState(activity?.name??"");
  const [match,setMatch]=useState<ActivityCandidate|undefined>(activity?.match),[manual,setManual]=useState(!!activity&&!activity.match);
  const [timing,setTiming]=useState(activity?.timing??""),[location,setLocation]=useState(activity?.location??""),[description,setDescription]=useState(activity?.description??"");
  const [priority,setPriority]=useState<CustomActivity["priority"]>(activity?.priority??"interested");
  const [result,setResult]=useState<ActivitySearchResult>(),[loading,setLoading]=useState(false),[error,setError]=useState("");
  const version=useRef(0),controller=useRef<AbortController|null>(null),notify=useRef(onPending);notify.current=onPending;
  const pending=editing&&!!(query.trim()||timing.trim()||location.trim()||description.trim());
  useEffect(()=>{notify.current(pending);return()=>notify.current(false);},[pending]);
  useEffect(()=>()=>controller.current?.abort(),[]);
  function rename(value:string){version.current++;controller.current?.abort();setLoading(false);setQuery(value);setMatch(undefined);setResult(undefined);setManual(false);setError("");}
  function clear(){version.current++;controller.current?.abort();setLoading(false);setQuery("");setMatch(undefined);setResult(undefined);setManual(false);setTiming("");setLocation("");setDescription("");setError("");if(activity)setEditing(false);}
  async function search(){
    if(!access)return;const current=++version.current;controller.current?.abort();const local=new AbortController();controller.current=local;setLoading(true);setError("");setResult(undefined);setMatch(undefined);setManual(false);
    try{
      const response=await fetch(`/api/groups/${access.code}/activities/search`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${access.token}`},body:JSON.stringify({query:query.trim()}),signal:local.signal});
      const data=await response.json() as ActivitySearchResult & {message?:string};if(!response.ok)throw new Error(data.message??"Search failed. Describe the activity manually instead.");
      if(current===version.current)setResult(data);
    }catch(e){if(!local.signal.aborted&&current===version.current)setError(e instanceof Error?e.message:"Search failed.");}
    finally{if(current===version.current)setLoading(false);}
  }
  function confirm(candidate:ActivityCandidate){setMatch(candidate);setManual(false);setTiming(timing||"Flexible day and time");setLocation(candidate.address);setDescription(description||`Visit ${candidate.name}.`);setError("");}
  function describe(){setManual(true);setMatch(undefined);setError("");}
  function save(){
    if(!match&&!manual){setError("Confirm a search result, or choose to describe this activity manually.");return;}
    if(priority==="must"&&!canMust){setError("You already have three must-visits. Change another pick first.");return;}
    const parsed=customActivitySchema.safeParse({id:activity?.id??`custom-${crypto.randomUUID()}`,name:match?.name??query,priority,timing,location:match?.address??location,description,...(match?{match}:{})});
    if(!parsed.success){setError("Please fill in the activity name, when, where and what. “Flexible” or “Not sure yet” is fine; details stay unverified.");return;}
    const message=onSave(parsed.data);if(message){setError(message);return;}if(!activity)clear();setEditing(false);notify.current(false);
  }
  return <article aria-label={`Custom activity ${index+1}`} className="rounded-2xl border border-[#dce4e7] bg-white p-4 sm:p-5">
    <p className="text-xs font-semibold text-muted-foreground">CUSTOM PICK {index+1}{isTop?" · YOUR #1":""}</p>
    {activity&&!editing?<>
      <h3 className="mt-2 text-lg font-semibold">{activity.name}</h3>
      <p className="mt-2 text-xs font-medium text-[#315b7d]">{activity.match?"Place identity confirmed by you · Photon / OpenStreetMap":"User-described activity · details unverified"}</p>
      <p className="mt-2 text-sm leading-6">When: {activity.timing}<br/>Where: {activity.location}<br/>What: {activity.description}</p>
      {activity.match&&<p className="mt-2 text-xs text-muted-foreground"><a href={candidateUrl(activity.match)} target="_blank" rel="noopener noreferrer" className="underline">View matched place</a> · Queried {evidenceTime(activity.match.queriedAt)}</p>}
      <div className="mt-4 flex flex-wrap gap-2"><span className="self-center text-sm font-medium">{activity.priority==="must"?"Must-visit":"Interested"}</span><button type="button" disabled={!canMust&&!isTop} onClick={onTop} aria-pressed={isTop} className={buttonClass}>{isTop?"Your #1 pick":"Make my #1"}</button><button type="button" className={buttonClass} onClick={()=>{setQuery(activity.name);setMatch(activity.match);setManual(!activity.match);setTiming(activity.timing);setLocation(activity.location);setDescription(activity.description);setPriority(activity.priority);setEditing(true);}}>Edit</button><button type="button" className={buttonClass} onClick={onRemove}>Remove</button></div>
    </>:<>
      <label className="mt-3 block text-sm font-medium" htmlFor={`custom-name-${index}`}>Place or activity name</label>
      <div className="mt-2 flex flex-wrap gap-2"><input id={`custom-name-${index}`} className={`${inputClass} flex-1 basis-48`} maxLength={100} value={query} onChange={e=>rename(e.target.value)} placeholder={index===0?"e.g. Tokyo Tower":index===1?"e.g. a pottery workshop":"e.g. a local food tour"}/><button type="button" className={`${buttonClass} bg-[#17384d] text-white`} disabled={loading||query.trim().length<2||!access} onClick={search}>{loading?"Searching…":"Search places"}</button></div>
      {result&&!match&&!manual&&<div className="mt-4 space-y-3"><p className="text-sm font-semibold">{result.candidates.length?"Is one of these the place you mean?":"No matching place found. Tell us about the activity below."}</p>{result.candidates.map(candidate=><div key={candidate.id} className="rounded-xl bg-[#f3f6f6] p-3"><p className="font-medium">{candidate.name}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{candidate.address}</p><div className="mt-2 flex flex-wrap items-center gap-3"><button type="button" className={buttonClass} onClick={()=>confirm(candidate)}>Yes, this is the place</button><a href={candidateUrl(candidate)} target="_blank" rel="noopener noreferrer" className="text-xs underline">View on OpenStreetMap</a></div></div>)}<p className="text-xs text-muted-foreground">{result.cached?"Cached query":"Queried"}: {evidenceTime(result.queriedAt)}</p></div>}
      {match&&<div className="mt-4 rounded-xl bg-[#eef7f2] p-3"><p className="text-sm font-semibold">✓ You confirmed {match.name}</p><p className="mt-1 text-xs leading-5">{match.address}</p><p className="mt-2 text-xs text-muted-foreground">Source: Photon / OpenStreetMap · {evidenceTime(match.queriedAt)}. No opening hours or booking verified.</p></div>}
      <button type="button" className="mt-3 min-h-11 text-sm font-medium text-[#315b7d] underline" onClick={describe}>{match?"Not this place — describe my activity":result?.candidates.length?"None of these — describe my activity":"Can't find it? Describe the activity manually"}</button>
      {(match||manual)&&<div className="mt-3 space-y-3 rounded-xl bg-[#f7f9f9] p-3">
        {manual&&<p className="text-sm font-medium">What activity did you have in mind? Details below are your description, not verified travel facts.</p>}
        <label className="block text-sm">When / approximate duration<input className={`${inputClass} mt-1`} value={timing} maxLength={120} onChange={e=>setTiming(e.target.value)} placeholder="e.g. Day 2 afternoon, about 2 hours; or Flexible"/></label>
        <label className="block text-sm">Where / meeting area<input className={`${inputClass} mt-1`} value={match?.address??location} disabled={!!match} maxLength={200} onChange={e=>setLocation(e.target.value)} placeholder="e.g. Asakusa, exact venue not decided"/></label>
        <label className="block text-sm">What would you like to do?<textarea className={`${inputClass} mt-1 min-h-20`} value={description} maxLength={400} onChange={e=>setDescription(e.target.value)} placeholder="e.g. Beginner pottery class, preferably seated"/></label>
        <label className="block text-sm">Priority<select value={priority} onChange={e=>setPriority(e.target.value as CustomActivity["priority"])} className={`${inputClass} mt-1`}><option value="interested">Interested / optional</option><option value="must" disabled={!canMust}>Must-visit (counts toward your three)</option></select></label>
        <p className="text-xs leading-5 text-muted-foreground">Don't include personal contact details or private addresses. These notes go to the organizer and, on generation, DeepSeek.</p>
        <button type="button" className={`${buttonClass} bg-[#17384d] text-white`} onClick={save}>Save custom activity</button>
      </div>}
      {error&&<p role="alert" className="mt-3 text-sm text-[#a44832]">{error}</p>}
      {(pending||activity)&&<button type="button" className={`${buttonClass} mt-3`} onClick={clear}>{activity?"Cancel editing":"Clear this draft"}</button>}
    </>}
  </article>;
}
