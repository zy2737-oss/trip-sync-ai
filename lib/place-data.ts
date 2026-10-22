import { getAttractionDetail } from "./attraction-details.ts";
export type CatalogPlace={id:string;name:string;area:string;rating?:number;priceLevel?:string;status?:string;source:"demo"|"google_places";checkedAt:string|null};
export const demoPlaces:CatalogPlace[]=[
  {id:"sensoji",name:"Sensō-ji",area:"Asakusa",rating:4.5,priceLevel:"Free",status:"Unverified",source:"demo",checkedAt:null},
  {id:"teamlab",name:"teamLab Borderless",area:"Azabudai Hills",rating:4.6,priceLevel:"$$",status:"Unverified",source:"demo",checkedAt:null},
  {id:"meiji",name:"Meiji Jingu",area:"Harajuku",rating:4.6,priceLevel:"Free",status:"Unverified",source:"demo",checkedAt:null},
  {id:"museum",name:"Tokyo National Museum",area:"Ueno",rating:4.5,priceLevel:"$",status:"Unverified",source:"demo",checkedAt:null},
  {id:"shibuya",name:"Shibuya Sky",area:"Shibuya",rating:4.6,priceLevel:"$$",status:"Unverified",source:"demo",checkedAt:null},
  {id:"tsukiji",name:"Tsukiji Outer Market",area:"Tsukiji",rating:4.2,priceLevel:"$",status:"Unverified",source:"demo",checkedAt:null},
];
export async function fetchPlaceCatalog(apiKey:string,fetcher:typeof fetch=fetch):Promise<CatalogPlace[]>{
  const response=await fetcher("https://places.googleapis.com/v1/places:searchText",{method:"POST",signal:AbortSignal.timeout(12000),headers:{"Content-Type":"application/json","X-Goog-Api-Key":apiKey,"X-Goog-FieldMask":"places.id,places.displayName,places.rating,places.priceLevel,places.businessStatus"},body:JSON.stringify({textQuery:"top tourist attractions in Tokyo Japan",pageSize:10,languageCode:"en"})});
  if(!response.ok)throw new Error("Place provider unavailable");
  const data=await response.json() as {places?:{id?:string;displayName?:{text?:string};rating?:number;priceLevel?:string;businessStatus?:string}[]};
  const checkedAt=new Date().toISOString();
  return demoPlaces.map(place=>{
    const match=data.places?.find(candidate=>candidate.id&&getAttractionDetail({id:candidate.id,name:candidate.displayName?.text??""})?.id===place.id);
    // Keep stable attraction IDs. Arbitrary provider IDs cannot enter saved profiles or route lookup.
    if(!match)return {...place};
    return {...place,rating:typeof match.rating==="number"&&match.rating>=0&&match.rating<=5?match.rating:undefined,priceLevel:match.priceLevel?.replace("PRICE_LEVEL_", ""),status:match.businessStatus??"Unknown",source:"google_places",checkedAt};
  });
}
