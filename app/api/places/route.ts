import { env } from "cloudflare:workers";
import { demoPlaces, fetchPlaceCatalog } from "@/lib/place-data";

export async function GET(){
  if(!env.GOOGLE_PLACES_API_KEY)return Response.json({places:demoPlaces,source:"demo",checkedAt:null,message:"Curated demo data. No live Google Places query has been made."},{headers:{"Cache-Control":"no-store"}});
  try{
    const places=await fetchPlaceCatalog(env.GOOGLE_PLACES_API_KEY);
    const live=places.filter(p=>p.source==="google_places");
    return Response.json({places,source:live.length?"google_places":"demo",checkedAt:live[0]?.checkedAt??null},{headers:{"Cache-Control":"public, max-age=1800"}});
  }catch{return Response.json({places:demoPlaces,source:"demo",checkedAt:null,message:"Live place data unavailable. Demo references have not been verified."},{headers:{"Cache-Control":"no-store"}});}
}
