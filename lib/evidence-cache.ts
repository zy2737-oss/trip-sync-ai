import { GroupError } from "./group-store.ts";

export async function cachedEvidence<T>(db:D1Database,key:string):Promise<T|null>{
  const row=await db.prepare("SELECT payload FROM evidence_cache WHERE key = ? AND expires_at > ?").bind(key,Date.now()).first<{payload:string}>();
  if(!row)return null;
  try{return JSON.parse(row.payload) as T;}catch{return null;}
}
export async function saveEvidence(db:D1Database,key:string,payload:unknown,ttlMs=21600000){
  await db.prepare("INSERT INTO evidence_cache (key,payload,expires_at) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, expires_at = excluded.expires_at").bind(key,JSON.stringify(payload),Date.now()+ttlMs).run();
}
// Shared across isolates/users. FOSSGIS permits at most one request per second.
export async function providerSlot(db:D1Database,key:string,intervalMs=1100){
  const stamp=Date.now();
  const slot=await db.prepare("INSERT INTO provider_slots (key,next_allowed_at) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET next_allowed_at = excluded.next_allowed_at WHERE next_allowed_at <= ? RETURNING key").bind(key,stamp+intervalMs,stamp).first();
  if(!slot)throw new GroupError(429,"The shared data provider is busy. Wait a moment and try again; no extra request was sent.");
}
