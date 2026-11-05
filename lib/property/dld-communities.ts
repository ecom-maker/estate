/**
 * Our community names -> DLD community labels in the D1 transactions database.
 *
 * The D1 file (Happy Endpoint, 2016-08 to 2026-08) stores Bayut's label in
 * `emirate_community`, which often differs from `communities.name`:
 * "JVC (Jumeirah Village Circle)" vs "Jumeirah Village Circle (JVC)", "&" vs
 * "and", "Damac" vs "DAMAC". Some areas are split across two labels in DLD
 * ("Dubai Investment Park (DIP)" and "Dubai Investments Park (DIP)").
 *
 * `OVERRIDES` covers names that can't be matched by spelling; every other name
 * is matched against `DLD_LABELS` ignoring case, punctuation, "&"/"and" and
 * bracket order. A name with no match returns null and the page hides the
 * market section, exactly as before.
 */

export type DldScope = { labels: string[]; sub?: string };

const OVERRIDES: Record<string, DldScope> = {
  "Al Jaddaf Waterfront": { labels: ["Culture Village (Jaddaf Waterfront)"] },
  "Dubai Design District": { labels: ["Dubai Design District (D3)", "Dubai Design District"] },
  "Dubai Hills": { labels: ["Dubai Hills Estate"] },
  "Dubai Investment Park (DIP)": { labels: ["Dubai Investments Park (DIP)", "Dubai Investment Park (DIP)"] },
  "Dubailand Residence Complex": { labels: ["Dubai Land Residence Complex (DLRC)", "Dubai Land Residence Complex"] },
  "Maritime City": { labels: ["Dubai Maritime City"] },
  "MBR District 11 (Meydan South)": {
    labels: ["Mohammed Bin Rashid City (MBR City)", "Mohammed Bin Rashid City"],
    sub: "District 11",
  },
  "Mohammed Bin Rashid City": { labels: ["Mohammed Bin Rashid City (MBR City)", "Mohammed Bin Rashid City"] },
  "The Valley": { labels: ["The Valley by Emaar"] },
  "The Wilds by Aldar": { labels: ["The Wilds"] },
};

/** Every distinct `emirate_community` in D1 (snapshot of 2026-11-05). */
export const DLD_LABELS: readonly string[] = [
  "Academic City",
  "Al Athbah",
  "Al Awir",
  "Al Badaa",
  "Al Barari",
  "Al Barsha",
  "Al Fagaa",
  "Al Furjan",
  "Al Garhoud",
  "Al Hudaiba",
  "Al Jaddaf",
  "Al Jafiliya",
  "Al Karama",
  "Al Khail Gate",
  "Al Khail Heights",
  "Al Khawaneej",
  "Al Kifaf",
  "Al Layan",
  "Al Lisaili",
  "Al Maha",
  "Al Mamzar",
  "Al Manara",
  "Al Mina",
  "Al Mizhar",
  "Al Nahda (Dubai)",
  "Al Quoz",
  "Al Qusais",
  "Al Rashidiya",
  "Al Ruwayyah",
  "Al Safa",
  "Al Satwa",
  "Al Sufouh",
  "Al Thanyah 2",
  "Al Ttay",
  "Al Twar",
  "Al Waha",
  "Al Warqaa",
  "Al Warsan",
  "Al Wasl",
  "Arabian Ranches",
  "Arabian Ranches 2",
  "Arabian Ranches 3",
  "Arjan",
  "Athlon by Aldar",
  "Azizi Milan",
  "Azizi Riviera",
  "Barsha Heights (Tecom)",
  "Bianca",
  "Bluewaters Island",
  "Bur Dubai",
  "Business Bay",
  "California Village",
  "Cherrywoods",
  "City Walk",
  "City of Arabia",
  "Culture Village (Jaddaf Waterfront)",
  "DAMAC Hills",
  "DAMAC Hills 2 (Akoya by DAMAC)",
  "DAMAC Islands",
  "DAMAC Islands 2",
  "DAMAC Lagoons",
  "DAMAC Riverside",
  "DAMAC Sun City",
  "Deira",
  "Discovery Gardens",
  "Downtown Dubai",
  "Downtown Jebel Ali",
  "Dragon City",
  "Dubai Airport Freezone (DAFZA)",
  "Dubai Creek Golf And Yacht Club Residences",
  "Dubai Creek Harbour",
  "Dubai Design District",
  "Dubai Design District (D3)",
  "Dubai Festival City",
  "Dubai Harbour",
  "Dubai Healthcare City",
  "Dubai Healthcare City Phase 2",
  "Dubai Hills Estate",
  "Dubai Industrial City",
  "Dubai International Airport",
  "Dubai Internet City",
  "Dubai Investment Park (DIP)",
  "Dubai Investments Park (DIP)",
  "Dubai Islands",
  "Dubai Land Residence Complex",
  "Dubai Land Residence Complex (DLRC)",
  "Dubai Lifestyle City",
  "Dubai Marina",
  "Dubai Maritime City",
  "Dubai Media City",
  "Dubai Production City (IMPZ)",
  "Dubai Science Park",
  "Dubai Silicon Oasis (DSO)",
  "Dubai South",
  "Dubai Sports City",
  "Dubai Studio City",
  "Dubai Waterfront",
  "Dubai World Trade Centre (DWTC)",
  "Dubailand",
  "Emirates Golf Club",
  "Emirates Hills",
  "Expo City",
  "Falcon City of Wonders",
  "Ghadeer Barashy",
  "Ghaf Woods",
  "Global Village",
  "Grayteesah",
  "Green Community",
  "Hadaeq Sheikh Mohammed Bin Rashid",
  "Hatta",
  "Haven by Aldar",
  "International City",
  "International City Phase 2 (Warsan 4)",
  "Jebel Ali",
  "Jebel Ali Hills",
  "Jebel Ali Village",
  "Jumeirah",
  "Jumeirah Beach Residence (JBR)",
  "Jumeirah Garden City",
  "Jumeirah Golf Estates",
  "Jumeirah Heights",
  "Jumeirah Islands",
  "Jumeirah Lake Towers (JLT)",
  "Jumeirah Park",
  "Jumeirah Village Circle (JVC)",
  "Jumeirah Village Triangle (JVT)",
  "Knowledge Village",
  "La Mer",
  "Layan",
  "Le Hemaira",
  "Lehbab",
  "Living Legends",
  "Liwan",
  "Liwan 2",
  "Lunaya",
  "Madinat Badr",
  "Madinat Jumeirah Living",
  "Majan",
  "Margham",
  "Mercedes-Benz Places Binghatti City",
  "Meydan",
  "Meydan Horizon",
  "Mina Rashid",
  "Mirdif",
  "Mohammed Bin Rashid City",
  "Mohammed Bin Rashid City (MBR City)",
  "Motor City",
  "Mudon",
  "Mugatrah",
  "Muhaisnah",
  "Murqquab",
  "Mushraif",
  "Nad Al Hamar",
  "Nad Al Sheba",
  "Nad Al Sheba Gardens",
  "Nad Shamma",
  "National Industries Park",
  "Nazwah",
  "Oud Al Muteena",
  "Palm Jebel Ali",
  "Palm Jumeirah",
  "Paradise Hills",
  "Pearl Jumeirah",
  "R. Hills",
  "Ras Al Khor",
  "Reem",
  "Remraam",
  "Reportage Village",
  "Rukan",
  "Saih Al Danal",
  "Serena",
  "Sheikh Zayed Road",
  "Sobha Central",
  "Sobha Elwood",
  "Sobha Hartland",
  "Sobha Hartland 2",
  "Sobha Reserve",
  "Sobha Sanctuary",
  "The Acres",
  "The Gardens",
  "The Greens",
  "The Heights Country Club and Wellness",
  "The Hills",
  "The Lakes",
  "The Meadows",
  "The Oasis by Emaar",
  "The Palmarosa",
  "The Springs",
  "The Sustainable City",
  "The Valley by Emaar",
  "The Views",
  "The Villa",
  "The Wilds",
  "The World Islands",
  "Tilal Al Ghaf",
  "Town Square",
  "Umm Al Daman",
  "Umm Al Sheif",
  "Umm Eselay",
  "Umm Ramool",
  "Umm Suqeim",
  "Villanova",
  "Wadi Al Amardi",
  "Wasl 1",
  "Wasl Gate",
  "World Trade Centre",
  "Yaraah",
  "Za'abeel",
];

function norm(s: string): string {
  return s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").trim();
}

/** "A (B)" -> ["a b", "a", "b"]; anything else -> [itself]. */
function variants(s: string): string[] {
  const out = [norm(s)];
  const m = s.match(/^(.*?)\s*\((.*?)\)\s*$/);
  if (m) out.push(norm(m[1]), norm(m[2]));
  return out.filter(Boolean);
}

const INDEX = (() => {
  const map = new Map<string, Set<string>>();
  for (const label of DLD_LABELS) {
    for (const v of variants(label)) {
      if (!map.has(v)) map.set(v, new Set());
      map.get(v)!.add(label);
    }
  }
  return map;
})();

export function dldScopeFor(communityName: string | null | undefined): DldScope | null {
  const name = communityName?.trim();
  if (!name) return null;
  if (OVERRIDES[name]) return OVERRIDES[name];
  // Exact full-name match first, so "Dubai Marina" never picks up a bracket alias.
  const exact = INDEX.get(norm(name));
  if (exact?.size) return { labels: [...exact] };
  const hits = new Set<string>();
  for (const v of variants(name)) for (const l of INDEX.get(v) ?? []) hits.add(l);
  return hits.size ? { labels: [...hits].sort() } : null;
}

/**
 * Candidate names for a project's own DLD records. DLD names villa clusters by
 * `sub_community` ("Salva") and towers by `building`, usually shorter than our
 * title ("Salva The Heights"), so try the title and its leading words.
 * Single words shorter than 4 letters and common words are skipped.
 */
const COMMON = new Set(["the", "by", "at", "of", "and", "in", "on", "villas", "villa", "residences", "residence",
  "tower", "towers", "apartments", "park", "city", "island", "islands", "hills", "heights", "bay", "gardens", "phase"]);

export function projectNameCandidates(title: string | null | undefined): string[] {
  const t = title?.replace(/\s+by\s+.*$/i, "").replace(/\s+at\s+.*$/i, "").trim();
  if (!t) return [];
  const words = t.split(/\s+/);
  const out: string[] = [];
  for (let n = words.length; n >= 1; n--) {
    const cand = words.slice(0, n).join(" ");
    if (n === 1 && (cand.length < 4 || COMMON.has(cand.toLowerCase()))) continue;
    out.push(cand);
  }
  const full = title!.trim();
  if (!out.includes(full)) out.unshift(full);
  return [...new Set(out)].slice(0, 6);
}
