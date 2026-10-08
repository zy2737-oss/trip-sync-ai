export type AttractionDetail = {
  id: string;
  aliases: string[];
  description: string;
  highlights: string[];
  duration: string;
  walking: string;
  tip: string;
  source: string;
  photo: { alt: string; author: string; source: string; license: string; licenseUrl?: string };
};

export const attractionDetails: AttractionDetail[] = [
  {
    id: "sensoji", aliases: ["sensoji", "senso-ji", "浅草寺"],
    description: "Discover traditional Tokyo at this Buddhist temple in Asakusa. The approach leads past the giant lantern of Kaminarimon and the shops of Nakamise to the temple grounds. It is a good choice for travelers who enjoy historic architecture, local snacks, and a lively neighborhood atmosphere.",
    highlights: ["Kaminarimon gate", "Nakamise shopping street", "Temple grounds and pagoda"],
    duration: "1–2 hours", walking: "Mostly outdoor walking; the approach can get crowded.",
    tip: "Keep the visit compact by focusing on the main approach and temple grounds. Leave time for a seated café break in Asakusa.",
    source: "https://www.gotokyo.org/en/spot/15/index.html",
    photo: { alt: "Sensō-ji temple gate and five-story pagoda", author: "Asturio Cantabrio", source: "https://commons.wikimedia.org/wiki/File:Asakusa_Senso-ji_2021-12_ac_(2).jpg", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/" },
  },
  {
    id: "teamlab", aliases: ["teamlab borderless", "チームラボボーダレス"],
    description: "An immersive digital-art museum at Azabudai Hills where light, color, and moving artworks connect across rooms. Rather than following a fixed route, visitors explore and discover changing spaces. This is a strong pick for art lovers and friends looking for an unusual shared experience.",
    highlights: ["Immersive light installations", "Artworks that move between rooms", "Explore without a fixed route"],
    duration: "2–3 hours", walking: "Indoor walking and standing; some spaces are dark or visually intense.",
    tip: "Check timed admission before planning around it. For a gentler visit, explore fewer rooms and leave a buffer afterward.",
    source: "https://www.teamlab.art/e/tokyo/",
    photo: { alt: "Visitors in a light installation at teamLab Borderless, Azabudai Hills", author: "DannyWithLove", source: "https://commons.wikimedia.org/wiki/File:TeamLab_Borderless_Azabudai_Hills.jpg", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/" },
  },
  {
    id: "meiji", aliases: ["meiji jingu", "meiji shrine", "明治神宮"],
    description: "A forested Shinto shrine near Harajuku, dedicated to Emperor Meiji and Empress Shoken. Large torii gates and tree-lined approaches create a quieter contrast to the nearby shopping streets. Choose it for a calm cultural stop rather than a packed sightseeing sprint.",
    highlights: ["Tree-lined shrine approaches", "Torii gates", "Main shrine courtyard"],
    duration: "1–1.5 hours", walking: "A substantial approach on gravel paths; allow unhurried walking time.",
    tip: "Do not assume that a peaceful setting means little walking. Keep nearby shopping optional if anyone has a low walking limit.",
    source: "https://www.meijijingu.or.jp/en/",
    photo: { alt: "Torii gate at Meiji Shrine", author: "Daderot", source: "https://commons.wikimedia.org/wiki/File:Meiji_Shrine_-_DSC04867.JPG", license: "Public domain" },
  },
  {
    id: "museum", aliases: ["tokyo national museum", "東京国立博物館"],
    description: "Explore Japanese art and archaeology at this museum in Ueno Park. Its galleries include objects such as ceramics, swords, and Buddhist art, with displays changing over time. It is a good option for a focused cultural afternoon and for travelers who prefer indoor activities.",
    highlights: ["Japanese art in the Honkan", "Historic crafts and archaeology", "Ueno Park surroundings"],
    duration: "2–3 hours", walking: "Indoor gallery walking; covering multiple buildings adds distance.",
    tip: "Pick one building or a few galleries rather than trying to see everything. Check current exhibitions and closure days before visiting.",
    source: "https://www.gotokyo.org/en/spot/123/index.html",
    photo: { alt: "Honkan main building of the Tokyo National Museum", author: "Daderot", source: "https://commons.wikimedia.org/wiki/File:Tokyo_National_Museum_-_Ueno_Park,_Tokyo,_Japan_-_DSC08641.jpg", license: "CC0", licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/" },
  },
  {
    id: "shibuya", aliases: ["shibuya sky", "渋谷スカイ"],
    description: "See Tokyo from the observation spaces above Shibuya Scramble Square. The rooftop offers an open-air city-view experience, making it an appealing stop for skyline photography and a memorable group moment. Pair it with nearby shopping rather than a long cross-city sightseeing route.",
    highlights: ["Open-air rooftop", "Tokyo skyline views", "Nearby Shibuya shopping"],
    duration: "1–1.5 hours", walking: "Standing and short walks around viewing areas; queues may add time.",
    tip: "Check ticket slots and rooftop weather restrictions. Sunset is a planning preference, not a guaranteed view or available booking.",
    source: "https://www.shibuya-scramble-square.com/sky/",
    photo: { alt: "Tokyo skyline at night viewed from Shibuya Sky", author: "Wei-Te Wong", source: "https://commons.wikimedia.org/wiki/File:Shibuya_Sky_(49286865631).jpg", license: "CC BY-SA 2.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/2.0/" },
  },
  {
    id: "tsukiji", aliases: ["tsukiji outer market", "築地場外市場"],
    description: "A food-focused neighborhood of shops and restaurants, known for seafood, sushi, ingredients, and kitchen goods. The outer market remains in Tsukiji even though the wholesale market moved to Toyosu. It works well as a casual food stop for a group with different appetites.",
    highlights: ["Seafood and casual meals", "Ingredient shops", "Kitchenware browsing"],
    duration: "1–2 hours", walking: "Short market lanes, with crowds and standing while browsing.",
    tip: "Choose a seated restaurant for the main meal and keep browsing optional. Individual shop opening times vary; check before going.",
    source: "https://www.gotokyo.org/en/spot/65/",
    photo: { alt: "Shops and visitors in Tsukiji Outer Market", author: "Christophe95", source: "https://commons.wikimedia.org/wiki/File:Tsukiji_Outer_Market.jpg", license: "CC BY-SA 4.0", licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/" },
  },
];

export function getAttractionDetail(place: { id: string; name: string }) {
  const normalized = place.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return attractionDetails.find((detail) => detail.id === place.id || detail.aliases.some((alias) => normalized.includes(alias)));
}
