"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { GroupSnapshot, Profile } from "@/lib/group-contract";

type Session={code:string;token:string};
const key="tripsync.shared-session.v1";
async function api(path:string,session:Session|null,method="GET",body?:unknown) {
  const response=await fetch(path,{method,cache:"no-store",signal:AbortSignal.timeout(method==="GET"?12000:85000),headers:{...(body?{"Content-Type":"application/json"}:{}),...(session?{Authorization:`Bearer ${session.token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const data=await response.json() as {message?:string}; if(!response.ok) throw new Error(data.message??"Could not connect to the group."); return data;
}
export function useTripGroup() {
  const [session,setSession]=useState<Session|null>(null);
  const [snapshot,setSnapshot]=useState<GroupSnapshot|null>(null);
  const [invite,setInvite]=useState(""); const [busy,setBusy]=useState(false);
  const [hydrated,setHydrated]=useState(false); const [error,setError]=useState("");
  const lock=useRef(false); const sequence=useRef(0);
  useEffect(()=>{
    const params=new URLSearchParams(window.location.hash.slice(1));
    const code=params.get("join"),resume=params.get("resume");
    let saved:Session|null=null;
    try { saved=JSON.parse(localStorage.getItem(key)??"null"); } catch {}
    if(resume) { const [c,t]=resume.split("."); if(/^TS-[A-F0-9]{24}$/.test(c??"")&&/^[a-f0-9]{64}$/.test(t??"")) {saved={code:c,token:t};try{localStorage.setItem(key,JSON.stringify(saved));}catch{}} }
    if(code && /^TS-[A-F0-9]{24}$/.test(code)) { setInvite(code); if(saved?.code!==code) saved=null; }
    if(code||resume) window.history.replaceState(null,"",window.location.pathname+window.location.search);
    if(saved && /^TS-[A-F0-9]{24}$/.test(saved.code??"") && /^[a-f0-9]{64}$/.test(saved.token??"")) setSession(saved);
    setHydrated(true);
  },[]);
  const refresh=useCallback(async()=>{
    if(!session) return;
    const seq=++sequence.current;
    try { const data=await api(`/api/groups/${session.code}`,session) as GroupSnapshot; if(seq===sequence.current) {setSnapshot(data);setError("");} }
    catch(e) {if(seq===sequence.current)setError(e instanceof Error?e.message:"Could not refresh the group.");}
  },[session]);
  useEffect(()=>{
    if(!session)return;
    void refresh(); const timer=setInterval(()=>{if(!lock.current&&document.visibilityState==="visible")void refresh();},8000);
    return ()=>{clearInterval(timer);sequence.current++;};
  },[session,refresh]);
  async function run<T>(fn:()=>Promise<T>) {
    if(lock.current) return;
    lock.current=true;setBusy(true);setError("");sequence.current++;
    try {return await fn();}catch(e){setError(e instanceof Error?e.message:"Could not update the group.");return undefined;}
    finally{lock.current=false;setBusy(false);}
  }
  async function enter(mode:"create"|"join",name:string,nickname:string) {
    return run(async()=>{
      const data=await api(mode==="create"?"/api/groups":"/api/groups/join",null,"POST",mode==="create"?{name,nickname}:{code:name,nickname}) as Session;
      // Credentials never go into query strings, the invitation, or the database in plaintext.
      try{localStorage.setItem(key,JSON.stringify(data));}catch{setError("Browser storage is unavailable. Keep this tab open and copy your private recovery link.");}
      setSession(data);
      const snap=await api(`/api/groups/${data.code}`,data) as GroupSnapshot;
      setSnapshot(snap);setSession(data);setInvite("");return snap;
    });
  }
  async function update(action:"profile"|"itinerary"|"accept",body:unknown) {
    if(!session)return;
    return run(async()=>{const data=await api(`/api/groups/${session.code}/${action}`,session,action==="profile"?"PUT":"POST",body) as GroupSnapshot;setSnapshot(data);return data;});
  }
  function leave(){sequence.current++;setSession(null);setSnapshot(null);setError("");try{localStorage.removeItem(key);}catch{}}
  async function remove(){if(!session)return;return run(async()=>{await api(`/api/groups/${session.code}`,session,"DELETE");leave();return true;});}
  function invitation(){return session?`${window.location.origin}/#join=${session.code}`:"";}
  function recovery(){return session?`${window.location.origin}/#resume=${session.code}.${session.token}`:"";}
  return {snapshot,session,invite,busy,hydrated,error,setError,refresh,enter,update,leave,remove,invitation,recovery,save:(profile:Profile)=>update("profile",profile)};
}
