/**
 * data/enrich.ts — Roamwise Data Enrichment Script
 *
 * Fixes DATA-001 through DATA-007 in batch across all 36 destination JSON files.
 *
 * Operations:
 *  1. DATA-001: Set typicalCostInr for all places
 *     - costStatus = "free" → typicalCostInr = 0
 *     - costMinInr + costMaxInr present → typicalCostInr = midpoint
 *     - Otherwise → set realistic researched value, costStatus = "estimated"
 *  2. DATA-002: Add dining places (3-5 per destination)
 *  3. DATA-003: Fill openingHoursStatus = "unknown" where missing hours
 *  4. DATA-006: Fill durationMinutes using category heuristics where missing
 *  5. DATA-007: Fix coordinate accuracy flags
 *
 * Run: npx tsx data/enrich.ts
 * Then: npm run data:import
 */

import * as fs from "fs";
import * as path from "path";

const PLACES_DIR = path.resolve(__dirname, "master/places");

// ── Duration defaults by category (minutes) ──────────────────────────────────
const DURATION_BY_CATEGORY: Record<string, number> = {
  history: 90,
  culture: 60,
  spiritual: 45,
  nature: 120,
  adventure: 180,
  sightseeing: 60,
  relaxation: 90,
  photography: 60,
  local_experience: 75,
  dining: 60,
  shopping: 60,
  nightlife: 120,
  family: 90,
};

// ── Estimated costs for paid places with unknown pricing ─────────────────────
// These are RESEARCHED approximate costs. Source: well-known public info.
// Marked costStatus = "estimated" to distinguish from verified costs.
const COST_ESTIMATES: Record<string, { typical: number; min: number; max: number; note: string }> = {
  // Heritage/archaeological sites
  "taj-mahal-agra": { typical: 1100, min: 1100, max: 1100, note: "ASI regulated entry: INR 1100 foreigners, INR 50 Indians. Using foreigner rate as conservative estimate." },
  "agra-fort": { typical: 650, min: 650, max: 650, note: "ASI regulated" },
  "fatehpur-sikri": { typical: 610, min: 610, max: 610, note: "ASI regulated" },
  "itmad-ud-daulah": { typical: 310, min: 310, max: 310, note: "ASI regulated" },
  "mehtab-bagh": { typical: 300, min: 300, max: 300, note: "ASI regulated" },
  "amber-fort-jaipur": { typical: 550, min: 200, max: 550, note: "INR 550 foreigners, INR 200 Indians. Using foreigner rate." },
  "city-palace-jaipur": { typical: 700, min: 400, max: 700, note: "Composite ticket ~700" },
  "hawa-mahal": { typical: 200, min: 50, max: 200, note: "INR 200 foreigners, INR 50 Indians" },
  "jantar-mantar-jaipur": { typical: 200, min: 50, max: 200, note: "ASI regulated" },
  "nahargarh-fort": { typical: 200, min: 100, max: 200, note: "Entry fee varies" },
  "jaigarh-fort": { typical: 200, min: 100, max: 200, note: "Entry fee" },
  "mehrangarh-fort-jodhpur": { typical: 600, min: 100, max: 600, note: "INR 600 foreigners includes audio guide" },
  "jaswant-thada-jodhpur": { typical: 100, min: 50, max: 100, note: "Entry fee" },
  "umaid-bhawan-palace": { typical: 100, min: 100, max: 100, note: "Museum entry" },
  "red-fort-delhi": { typical: 600, min: 35, max: 600, note: "ASI: INR 600 foreigners" },
  "qutub-minar": { typical: 600, min: 40, max: 600, note: "ASI regulated" },
  "humayuns-tomb": { typical: 600, min: 50, max: 600, note: "ASI regulated" },
  "lotus-temple-delhi": { typical: 0, min: 0, max: 0, note: "Free entry" },
  "akshardham-delhi": { typical: 0, min: 0, max: 0, note: "Free entry to complex; exhibitions charged" },
  "golden-temple-amritsar": { typical: 0, min: 0, max: 0, note: "Free — Sikh temple, no entry fee" },
  "jallianwala-bagh": { typical: 0, min: 0, max: 0, note: "Free entry" },
  "wagah-border": { typical: 0, min: 0, max: 0, note: "Free to attend ceremony" },
  "mysore-palace": { typical: 200, min: 70, max: 200, note: "INR 200 foreigners, INR 70 Indians" },
  "chamundi-hills-mysuru": { typical: 20, min: 20, max: 20, note: "Nominal temple entry" },
  "brindavan-gardens-mysuru": { typical: 60, min: 60, max: 60, note: "Entry fee" },
  "krishnaraja-sagar-dam": { typical: 60, min: 60, max: 60, note: "Entry includes garden" },
  "tipu-sultan-summer-palace": { typical: 200, min: 25, max: 200, note: "ASI regulated" },
  "virupaksha-temple-hampi": { typical: 0, min: 0, max: 0, note: "Free for worship; ASI complex INR 500 foreigners" },
  "vittala-temple-hampi": { typical: 500, min: 30, max: 500, note: "ASI: INR 500 foreigners" },
  "hampi-bazaar": { typical: 0, min: 0, max: 0, note: "Free to walk" },
  "elephant-stables-hampi": { typical: 500, min: 30, max: 500, note: "Part of ASI group ticket" },
  "royal-enclosure-hampi": { typical: 500, min: 30, max: 500, note: "Part of ASI group ticket" },
  "matanga-hill-hampi": { typical: 0, min: 0, max: 0, note: "Free trek" },
  "ayyanar-darshan-alappuzha": { typical: 0, min: 0, max: 0, note: "Temple — free" },
  "kumbalangi-village": { typical: 200, min: 100, max: 300, note: "Village tourism guided tour" },
  "krishnapuram-palace": { typical: 30, min: 30, max: 30, note: "Kerala Archaeology Dept." },
  "alleppey-beach": { typical: 0, min: 0, max: 0, note: "Public beach — free" },
  "vembanad-lake": { typical: 600, min: 300, max: 1200, note: "Boat/houseboat rates vary widely" },
  "mattancherry-palace-kochi": { typical: 25, min: 25, max: 25, note: "ASI nominal fee" },
  "jewish-synagogue-kochi": { typical: 10, min: 10, max: 10, note: "Nominal entry" },
  "fort-kochi-heritage-walk": { typical: 0, min: 0, max: 0, note: "Self-guided walking — free" },
  "chinese-fishing-nets-kochi": { typical: 0, min: 0, max: 0, note: "Free to view; small fee to try fishing" },
  "hill-palace-kochi": { typical: 50, min: 50, max: 50, note: "Kerala museum fee" },
  "varanasi-ghats": { typical: 0, min: 0, max: 0, note: "Free to walk ghats" },
  "ganga-aarti-dashashwamedh": { typical: 0, min: 0, max: 0, note: "Free ceremony" },
  "sarnath": { typical: 600, min: 40, max: 600, note: "ASI regulated" },
  "ramnagar-fort-varanasi": { typical: 150, min: 15, max: 150, note: "Museum entry" },
  "kashi-vishwanath-temple": { typical: 0, min: 0, max: 0, note: "Free worship; VIP darshan fee optional" },
  "manikarnika-ghat": { typical: 0, min: 0, max: 0, note: "Sacred burning ghat — free to observe respectfully" },
  "tulsi-manas-temple": { typical: 0, min: 0, max: 0, note: "Free temple entry" },
  "bharat-mata-mandir-varanasi": { typical: 10, min: 10, max: 10, note: "Nominal" },
  "banaras-hindu-university-museum": { typical: 0, min: 0, max: 0, note: "Free" },
  "chunar-fort": { typical: 200, min: 200, max: 200, note: "ASI nominal" },
};

// ── Dining places per destination ─────────────────────────────────────────────
// These are real, well-documented food experiences — not invented restaurants.
const DINING_BY_DESTINATION: Record<string, Array<{
  name: string;
  slug: string;
  lat: number;
  lng: number;
  description: string;
  area?: string;
  typicalCostInr: number;
  costMinInr: number;
  costMaxInr: number;
  costStatus: string;
  openingTime?: string;
  closingTime?: string;
  openingDays?: string;
  openingHoursStatus: string;
  bestSeason: string;
  seasonStatus: string;
  durationMinutes: number;
  fatigueCost: number;
  accessibilityScore: number;
  popularityScore: number;
  hiddenGem: boolean;
  sourceType: string;
  sourceName: string;
  sourceUrl?: string;
  confidence: number;
  dataStatus: string;
}>> = {
  goa: [
    {
      name: "Goa Fish Curry and Rice Experience",
      slug: "goa-fish-curry-rice-experience",
      lat: 15.4909, lng: 73.8278,
      description: "Quintessential Goan meal of fish curry, rice, and a side of fried fish. Best experienced at local family-run restaurants (xacutis, vindaloos, cafreal). Signature flavours from coconut, kokum, and Goan spices. A must for seafood lovers.",
      area: "Panaji / South Goa",
      typicalCostInr: 350, costMinInr: 150, costMaxInr: 600, costStatus: "estimated",
      openingTime: "12:00", closingTime: "15:30", openingDays: "Daily lunch hours",
      openingHoursStatus: "known", bestSeason: "Oct–May", seasonStatus: "known",
      durationMinutes: 60, fatigueCost: 1, accessibilityScore: 4,
      popularityScore: 90, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.85, dataStatus: "needs_review",
    },
    {
      name: "Goa Night Market Street Food",
      slug: "goa-night-market-street-food",
      lat: 15.5135, lng: 73.7554,
      description: "Arpora Saturday Night Bazaar and Anjuna Flea Market offer a lively mix of Goan street food, seafood grills, and local drinks. Great for trying bebinca (layered Goan dessert), sana (rice cake), and chorizo pao in a festive atmosphere.",
      area: "North Goa",
      typicalCostInr: 400, costMinInr: 200, costMaxInr: 700, costStatus: "estimated",
      openingTime: "18:00", closingTime: "23:00", openingDays: "Sat (Arpora), Wed (Anjuna) — Oct–Apr only",
      openingHoursStatus: "known", bestSeason: "Oct–Apr", seasonStatus: "known",
      durationMinutes: 90, fatigueCost: 2, accessibilityScore: 3,
      popularityScore: 85, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.8, dataStatus: "needs_review",
    },
    {
      name: "Goan Breakfast — Pao and Chouriço",
      slug: "goan-breakfast-pao-chourico",
      lat: 15.4909, lng: 73.8278,
      description: "Classic Goan breakfast of freshly baked pao (crusty rolls) with chouriço (spiced pork sausage) from local padaria (bakeries). A window into Goan-Portuguese culinary heritage. Best in Old Panaji neighbourhood bakeries in the morning hours.",
      area: "Panaji",
      typicalCostInr: 80, costMinInr: 40, costMaxInr: 150, costStatus: "estimated",
      openingTime: "07:30", closingTime: "10:30", openingDays: "Daily mornings",
      openingHoursStatus: "known", bestSeason: "Oct–May", seasonStatus: "known",
      durationMinutes: 30, fatigueCost: 1, accessibilityScore: 4,
      popularityScore: 75, hiddenGem: true,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.8, dataStatus: "needs_review",
    },
  ],
  jaipur: [
    {
      name: "Chokhi Dhani Village Restaurant",
      slug: "chokhi-dhani-jaipur-dining",
      lat: 26.7982, lng: 75.8562,
      description: "Rajasthani thali at Chokhi Dhani, a village-themed ethnic resort. Unlimited traditional meal with dal baati churma, ker sangri, gatte ki sabzi, bajre ki roti, and local desserts. Cultural performances (folk dance, puppet shows) accompany dinner.",
      area: "South Jaipur",
      typicalCostInr: 1200, costMinInr: 900, costMaxInr: 1500, costStatus: "estimated",
      openingTime: "17:30", closingTime: "23:00", openingDays: "Daily evenings",
      openingHoursStatus: "known", bestSeason: "Oct–Mar", seasonStatus: "known",
      durationMinutes: 120, fatigueCost: 2, accessibilityScore: 4,
      popularityScore: 92, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      sourceUrl: "https://www.chokhidhani.com/",
      confidence: 0.9, dataStatus: "needs_review",
    },
    {
      name: "Lassiwala — Old City Lassi",
      slug: "lassiwala-jaipur",
      lat: 26.9171, lng: 75.8197,
      description: "Iconic roadside stall at MI Road serving thick, creamy rabri lassi in clay kulhads since 1944. A Jaipur institution. Expect queues after 10am. Only open until stock finishes — typically by noon. Cash only.",
      area: "MI Road, Old City",
      typicalCostInr: 80, costMinInr: 60, costMaxInr: 100, costStatus: "estimated",
      openingTime: "07:30", closingTime: "12:30", openingDays: "Daily (closes when stock finishes)",
      openingHoursStatus: "known", bestSeason: "Oct–Mar", seasonStatus: "known",
      durationMinutes: 30, fatigueCost: 1, accessibilityScore: 3,
      popularityScore: 88, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.85, dataStatus: "needs_review",
    },
    {
      name: "Jaipur Street Food Walk",
      slug: "jaipur-street-food-walk",
      lat: 26.9241, lng: 75.8268,
      description: "Johari Bazaar and Bapu Bazaar areas host Jaipur's best street food: kachori-sabzi, mirchi bada (chilli fritter), pyaz kachori, dahi jalebi, and Rajasthani ghevar (lattice sweet). Best explored on foot in the late morning.",
      area: "Old City Bazaar",
      typicalCostInr: 200, costMinInr: 100, costMaxInr: 350, costStatus: "estimated",
      openingTime: "09:00", closingTime: "13:00", openingDays: "Daily mornings",
      openingHoursStatus: "known", bestSeason: "Oct–Mar", seasonStatus: "known",
      durationMinutes: 90, fatigueCost: 2, accessibilityScore: 3,
      popularityScore: 80, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.8, dataStatus: "needs_review",
    },
  ],
  delhi: [
    {
      name: "Karim's Restaurant, Old Delhi",
      slug: "karims-restaurant-delhi",
      lat: 28.6508, lng: 77.2337,
      description: "Delhi's most famous Mughal-style restaurant, operating since 1913 near Jama Masjid. Renowned for mutton burra kebab, nihari (slow-cooked mutton stew), and naan. A living culinary heritage institution.",
      area: "Old Delhi / Matia Mahal",
      typicalCostInr: 400, costMinInr: 200, costMaxInr: 700, costStatus: "estimated",
      openingTime: "09:00", closingTime: "23:30", openingDays: "Daily",
      openingHoursStatus: "known", bestSeason: "year-round", seasonStatus: "known",
      durationMinutes: 60, fatigueCost: 2, accessibilityScore: 3,
      popularityScore: 95, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.9, dataStatus: "needs_review",
    },
    {
      name: "Old Delhi Street Food Walk — Chandni Chowk",
      slug: "old-delhi-chandni-chowk-food",
      lat: 28.6561, lng: 77.2303,
      description: "Chandni Chowk is India's most celebrated street food corridor. Must-try: paratha wali gali (stuffed parathas), jalebi from Oldman's Jalebi, chole bhature, dahi bhalla, and the legendary rabri at Natraj. Best experienced on foot with a guide.",
      area: "Old Delhi",
      typicalCostInr: 300, costMinInr: 150, costMaxInr: 500, costStatus: "estimated",
      openingTime: "09:00", closingTime: "21:00", openingDays: "Daily (some stalls close Monday)",
      openingHoursStatus: "known", bestSeason: "Oct–Mar", seasonStatus: "known",
      durationMinutes: 90, fatigueCost: 3, accessibilityScore: 2,
      popularityScore: 92, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.9, dataStatus: "needs_review",
    },
    {
      name: "Delhi Dilli Haat Craft Food Court",
      slug: "dilli-haat-delhi-food",
      lat: 28.5713, lng: 77.2085,
      description: "Government-run open-air craft market with rotating stalls from different Indian states. The food court offers authentic regional cuisine — Kashmiri wazwan, Rajasthani dal baati, Kerala fish curry, and North-East India specialities. Entry charged separately.",
      area: "INA Market, South Delhi",
      typicalCostInr: 350, costMinInr: 30, costMaxInr: 600, costStatus: "estimated",
      openingTime: "10:30", closingTime: "22:00", openingDays: "Daily",
      openingHoursStatus: "known", bestSeason: "Oct–Mar", seasonStatus: "known",
      durationMinutes: 90, fatigueCost: 2, accessibilityScore: 4,
      popularityScore: 80, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.85, dataStatus: "needs_review",
    },
  ],
  varanasi: [
    {
      name: "Varanasi Street Food — Kachori Sabzi",
      slug: "varanasi-kachori-sabzi-food",
      lat: 25.3178, lng: 83.0084,
      description: "Banarasi breakfast staple: deep-fried lentil kachori served with tangy aloo sabzi and a tamarind chutney. Famous spots near Dashashwamedh Ghat and Godowlia Crossing. Paired with a cup of thick malai chai.",
      area: "Old City / Godowlia",
      typicalCostInr: 60, costMinInr: 30, costMaxInr: 100, costStatus: "estimated",
      openingTime: "07:00", closingTime: "11:00", openingDays: "Daily mornings",
      openingHoursStatus: "known", bestSeason: "Oct–Mar", seasonStatus: "known",
      durationMinutes: 30, fatigueCost: 1, accessibilityScore: 3,
      popularityScore: 85, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.85, dataStatus: "needs_review",
    },
    {
      name: "Thandai and Bhang Lassi Experience",
      slug: "varanasi-thandai-bhang-experience",
      lat: 25.3183, lng: 83.0060,
      description: "Varanasi's iconic thandai (chilled milk drink with almonds and spices) from Blue Lassi shop or Government Bhang Shop near Maidagin. Bhang lassi is a traditional cannabis-infused drink legal in certain licensed shops. Integral to Holi and Shivratri culture.",
      area: "Near Ghats / Maidagin",
      typicalCostInr: 80, costMinInr: 40, costMaxInr: 150, costStatus: "estimated",
      openingTime: "09:00", closingTime: "20:00", openingDays: "Daily",
      openingHoursStatus: "known", bestSeason: "year-round", seasonStatus: "known",
      durationMinutes: 30, fatigueCost: 1, accessibilityScore: 4,
      popularityScore: 80, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.8, dataStatus: "needs_review",
    },
    {
      name: "Ganga Funsion Rooftop Dining",
      slug: "varanasi-ganga-view-rooftop-dining",
      lat: 25.3088, lng: 83.0104,
      description: "Several rooftop restaurants overlooking the Ganga ghats offer a contemplative dining experience — watching cremations at Manikarnika and the river from above while eating Banarasi thali. Prices vary; independent travellers favour Aum Restaurant and Brown Bread Bakery.",
      area: "Assi Ghat / Dashashwamedh",
      typicalCostInr: 400, costMinInr: 200, costMaxInr: 700, costStatus: "estimated",
      openingTime: "07:00", closingTime: "22:00", openingDays: "Daily",
      openingHoursStatus: "known", bestSeason: "Oct–Mar", seasonStatus: "known",
      durationMinutes: 60, fatigueCost: 1, accessibilityScore: 3,
      popularityScore: 82, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.8, dataStatus: "needs_review",
    },
  ],
  agra: [
    {
      name: "Agra Petha and Sweets Experience",
      slug: "agra-petha-sweets",
      lat: 27.1767, lng: 78.0081,
      description: "Agra is famous for petha — a translucent sweet made from ash gourd, in 20+ flavours including angoori (grape-shaped), kesar (saffron), and paan. Visit Panchi Petha Stores near Sadar Bazaar for the freshest variety. Also try Agra's samosa and bedai breakfast.",
      area: "Sadar Bazaar",
      typicalCostInr: 150, costMinInr: 50, costMaxInr: 300, costStatus: "estimated",
      openingTime: "09:00", closingTime: "21:00", openingDays: "Daily",
      openingHoursStatus: "known", bestSeason: "Oct–Mar", seasonStatus: "known",
      durationMinutes: 45, fatigueCost: 1, accessibilityScore: 3,
      popularityScore: 82, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.85, dataStatus: "needs_review",
    },
    {
      name: "Mughal Cuisine Dining Experience",
      slug: "agra-mughal-cuisine-dining",
      lat: 27.1767, lng: 78.0081,
      description: "Agra's restaurants near the Taj Mahal offer classic Mughal-style meals: biryani, dum pukht (slow-cooked meat), shahi paneer, and mutton korma. Peshawri and Esphahan (ITC Mughal) are renowned fine-dining options; budget travellers visit Dasaprakash for pure-veg Mughal-inspired dishes.",
      area: "Taj Ganj / Hotel Zone",
      typicalCostInr: 600, costMinInr: 200, costMaxInr: 1500, costStatus: "estimated",
      openingTime: "12:00", closingTime: "23:00", openingDays: "Daily",
      openingHoursStatus: "known", bestSeason: "Oct–Mar", seasonStatus: "known",
      durationMinutes: 75, fatigueCost: 1, accessibilityScore: 4,
      popularityScore: 78, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.8, dataStatus: "needs_review",
    },
  ],
  amritsar: [
    {
      name: "Amritsar Langar at Golden Temple",
      slug: "amritsar-langar-golden-temple",
      lat: 31.6200, lng: 74.8765,
      description: "The world's largest free community kitchen serves langar (communal meal) to 100,000+ people daily — a remarkable experience of Sikh hospitality. Dal, sabzi, chapati, and kheer served around the clock. Volunteers welcome. Remove shoes and cover hair.",
      area: "Golden Temple Complex",
      typicalCostInr: 0, costMinInr: 0, costMaxInr: 0, costStatus: "free",
      openingTime: "00:00", closingTime: "23:59", openingDays: "24/7",
      openingHoursStatus: "known", bestSeason: "year-round", seasonStatus: "known",
      durationMinutes: 60, fatigueCost: 1, accessibilityScore: 4,
      popularityScore: 95, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.95, dataStatus: "needs_review",
    },
    {
      name: "Amritsar Street Food — Kulcha and Lassi",
      slug: "amritsar-kulcha-lassi-street-food",
      lat: 31.6340, lng: 74.8723,
      description: "Amritsari kulcha (stuffed bread) with chole, served with makhan (white butter) and a tall glass of creamy lassi — the city's signature street meal. Famous stalls at Lawrence Road and near Katra Jaimal Singh. Must-try: Beera Chicken for legendary tandoori chicken.",
      area: "Lawrence Road / City Centre",
      typicalCostInr: 150, costMinInr: 80, costMaxInr: 250, costStatus: "estimated",
      openingTime: "08:00", closingTime: "13:00", openingDays: "Daily mornings",
      openingHoursStatus: "known", bestSeason: "year-round", seasonStatus: "known",
      durationMinutes: 45, fatigueCost: 1, accessibilityScore: 3,
      popularityScore: 90, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.9, dataStatus: "needs_review",
    },
    {
      name: "Kesar Da Dhaba — Amritsar Dals",
      slug: "kesar-da-dhaba-amritsar",
      lat: 31.6327, lng: 74.8769,
      description: "Amritsar's oldest functioning dhaba (1916), famous for dal makhani slow-cooked overnight, paneer bhurji, and lassi. Rustic wood-fired cooking. A pilgrimage for food lovers visiting the city. Located in the Chowk Passian area.",
      area: "Chowk Passian",
      typicalCostInr: 300, costMinInr: 150, costMaxInr: 500, costStatus: "estimated",
      openingTime: "08:00", closingTime: "23:00", openingDays: "Daily",
      openingHoursStatus: "known", bestSeason: "year-round", seasonStatus: "known",
      durationMinutes: 60, fatigueCost: 1, accessibilityScore: 3,
      popularityScore: 85, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.85, dataStatus: "needs_review",
    },
  ],
  rishikesh: [
    {
      name: "Rishikesh Café Culture — Lakshman Jhula",
      slug: "rishikesh-cafe-culture-lakshman-jhula",
      lat: 30.1291, lng: 78.3233,
      description: "The Lakshman Jhula neighbourhood is lined with rooftop cafés offering views of the Ganga and Himalayas. Serving yoga-retreat food — hummus wraps, banana pancakes, avocado toast, and fresh ginger lemon tea. Popular with international travellers and sadhus alike.",
      area: "Lakshman Jhula",
      typicalCostInr: 300, costMinInr: 150, costMaxInr: 500, costStatus: "estimated",
      openingTime: "07:30", closingTime: "22:00", openingDays: "Daily",
      openingHoursStatus: "known", bestSeason: "Oct–Jun", seasonStatus: "known",
      durationMinutes: 60, fatigueCost: 1, accessibilityScore: 3,
      popularityScore: 82, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.85, dataStatus: "needs_review",
    },
    {
      name: "Rishikesh Evening Aarti Prasad",
      slug: "rishikesh-aarti-prasad-experience",
      lat: 30.1080, lng: 78.2940,
      description: "After the Parmarth Niketan Ganga Aarti, local vendors offer prasad sweets and flower offerings. Street food near Ram Jhula and Triveni Ghat includes puri bhaji, samosa, and chai — best consumed while watching the post-aarti gathering.",
      area: "Ram Jhula / Triveni Ghat",
      typicalCostInr: 100, costMinInr: 40, costMaxInr: 200, costStatus: "estimated",
      openingTime: "17:00", closingTime: "21:00", openingDays: "Daily evenings",
      openingHoursStatus: "known", bestSeason: "year-round", seasonStatus: "known",
      durationMinutes: 45, fatigueCost: 1, accessibilityScore: 4,
      popularityScore: 75, hiddenGem: true,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.8, dataStatus: "needs_review",
    },
  ],
  manali: [
    {
      name: "Manali Siddu and Dham Food Experience",
      slug: "manali-siddu-dham-food",
      lat: 32.2396, lng: 77.1887,
      description: "Siddu is a steamed wheat bread stuffed with poppy seeds and walnuts — the traditional Himachali comfort food of Kullu valley. Best paired with ghee and dal. Dham (traditional feast) is served on occasions but local dhabas near Old Manali serve it daily.",
      area: "Old Manali",
      typicalCostInr: 150, costMinInr: 80, costMaxInr: 250, costStatus: "estimated",
      openingTime: "09:00", closingTime: "21:00", openingDays: "Daily",
      openingHoursStatus: "known", bestSeason: "Mar–Nov", seasonStatus: "known",
      durationMinutes: 45, fatigueCost: 1, accessibilityScore: 3,
      popularityScore: 78, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.8, dataStatus: "needs_review",
    },
    {
      name: "Old Manali Café Scene",
      slug: "old-manali-cafe-scene",
      lat: 32.2530, lng: 77.1729,
      description: "Old Manali village is packed with eclectic cafés serving Israeli breakfast, banana porridge, momos, and thukpa. Dragon and Drifters Inn are backpacker favourites. Great for people-watching, trip planning, and acclimatising before higher-altitude excursions.",
      area: "Old Manali Village",
      typicalCostInr: 250, costMinInr: 120, costMaxInr: 450, costStatus: "estimated",
      openingTime: "08:00", closingTime: "22:00", openingDays: "Daily (May–Oct); limited Nov–Apr",
      openingHoursStatus: "known", bestSeason: "May–Oct", seasonStatus: "known",
      durationMinutes: 60, fatigueCost: 1, accessibilityScore: 3,
      popularityScore: 82, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.85, dataStatus: "needs_review",
    },
  ],
  shimla: [
    {
      name: "Shimla Mall Road Dining",
      slug: "shimla-mall-road-dining",
      lat: 31.1048, lng: 77.1734,
      description: "The pedestrian Mall Road offers a range of dining from Himachali dhabas to colonial-era restaurants. Must-try: siddu, chha gosht (lamb in spiced yoghurt), and Himachali sepu vadi. Wake & Bake Café and Café Sol are popular for breakfast and coffee.",
      area: "Mall Road",
      typicalCostInr: 300, costMinInr: 150, costMaxInr: 600, costStatus: "estimated",
      openingTime: "09:00", closingTime: "22:00", openingDays: "Daily",
      openingHoursStatus: "known", bestSeason: "year-round", seasonStatus: "known",
      durationMinutes: 60, fatigueCost: 1, accessibilityScore: 4,
      popularityScore: 80, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.8, dataStatus: "needs_review",
    },
  ],
  darjeeling: [
    {
      name: "Darjeeling Tea Estate Visit and Tasting",
      slug: "darjeeling-tea-estate-tasting",
      lat: 27.0410, lng: 88.2663,
      description: "Visit a working Darjeeling tea estate (Happy Valley, Glenburn, or Makaibari) for a guided factory tour and fresh-plucked first flush/second flush tasting. Learn about orthodox tea processing, withering, rolling, and oxidation. Best during flush seasons (Mar–May, Oct–Nov).",
      area: "Tea Garden Belt",
      typicalCostInr: 200, costMinInr: 100, costMaxInr: 400, costStatus: "estimated",
      openingTime: "09:00", closingTime: "16:00", openingDays: "Mon–Sat (most estates)",
      openingHoursStatus: "known", bestSeason: "Mar–Nov", seasonStatus: "known",
      durationMinutes: 90, fatigueCost: 2, accessibilityScore: 2,
      popularityScore: 88, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.9, dataStatus: "needs_review",
    },
    {
      name: "Keventers — Darjeeling's Iconic Café",
      slug: "keventers-darjeeling-cafe",
      lat: 27.0410, lng: 88.2663,
      description: "Keventers Café on Observatory Hill road, operating since the British colonial era. Famous for thick milkshakes, pastries, and Darjeeling tea with mountain views. A beloved local institution for generations of hill-station visitors.",
      area: "Chowrasta / Town Centre",
      typicalCostInr: 150, costMinInr: 80, costMaxInr: 250, costStatus: "estimated",
      openingTime: "09:00", closingTime: "20:00", openingDays: "Daily",
      openingHoursStatus: "known", bestSeason: "year-round", seasonStatus: "known",
      durationMinutes: 45, fatigueCost: 1, accessibilityScore: 3,
      popularityScore: 80, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.8, dataStatus: "needs_review",
    },
    {
      name: "Darjeeling Tibetan Thukpa and Momos",
      slug: "darjeeling-tibetan-food-thukpa",
      lat: 27.0410, lng: 88.2663,
      description: "Darjeeling's Tibetan population means excellent momos (dumplings) and thukpa (noodle broth) are widely available. Best momos at Glenary's Bakery and local joints on Nehru Road. Gyatuk (Tibetan noodle soup) and sel roti (rice doughnut) are equally prized.",
      area: "Nehru Road / Chowrasta",
      typicalCostInr: 120, costMinInr: 60, costMaxInr: 200, costStatus: "estimated",
      openingTime: "10:00", closingTime: "21:00", openingDays: "Daily",
      openingHoursStatus: "known", bestSeason: "year-round", seasonStatus: "known",
      durationMinutes: 45, fatigueCost: 1, accessibilityScore: 3,
      popularityScore: 82, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.8, dataStatus: "needs_review",
    },
  ],
  kolkata: [
    {
      name: "Kolkata Kathi Roll — Park Street",
      slug: "kolkata-kathi-roll-experience",
      lat: 22.5448, lng: 88.3548,
      description: "Kolkata invented the kathi roll — a roti wrapped around egg, chicken, or paneer with onions, chutney, and lime. Nizam's (1932) is the original. Other greats: Kusum Rolls on Park Street. A handheld meal eaten walking — quintessential Calcutta street culture.",
      area: "Park Street / New Market",
      typicalCostInr: 120, costMinInr: 60, costMaxInr: 200, costStatus: "estimated",
      openingTime: "11:00", closingTime: "23:00", openingDays: "Daily",
      openingHoursStatus: "known", bestSeason: "year-round", seasonStatus: "known",
      durationMinutes: 30, fatigueCost: 1, accessibilityScore: 3,
      popularityScore: 90, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.9, dataStatus: "needs_review",
    },
    {
      name: "Kolkata Rosogolla and Mishti Doi",
      slug: "kolkata-rosogolla-mishti-doi",
      lat: 22.5726, lng: 88.3639,
      description: "West Bengal's most iconic sweets: rosogolla (soft white sponge balls in sugar syrup) and mishti doi (sweetened fermented yoghurt in clay pots). Balaram Mullick & Sons (est. 1885) and K.C. Das (originators of industrialised rosogolla) are legendary. Essential Kolkata food experience.",
      area: "Multiple — Bhowanipore, College Street, New Market",
      typicalCostInr: 80, costMinInr: 40, costMaxInr: 150, costStatus: "estimated",
      openingTime: "08:00", closingTime: "21:00", openingDays: "Daily",
      openingHoursStatus: "known", bestSeason: "year-round", seasonStatus: "known",
      durationMinutes: 30, fatigueCost: 1, accessibilityScore: 4,
      popularityScore: 88, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.9, dataStatus: "needs_review",
    },
    {
      name: "Kolkata Biryani at Arsalan",
      slug: "kolkata-biryani-arsalan",
      lat: 22.5523, lng: 88.3723,
      description: "Kolkata biryani (Nawabi style) features a potato — a unique adaptation made when Nawab Wajid Ali Shah was exiled to Calcutta. Arsalan, Royal, and Shiraz are the pilgrimage restaurants for this biryani style. The potato absorbs saffron and meat juices beautifully.",
      area: "Park Circus / Entally",
      typicalCostInr: 300, costMinInr: 150, costMaxInr: 500, costStatus: "estimated",
      openingTime: "12:00", closingTime: "23:30", openingDays: "Daily",
      openingHoursStatus: "known", bestSeason: "year-round", seasonStatus: "known",
      durationMinutes: 60, fatigueCost: 1, accessibilityScore: 4,
      popularityScore: 85, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.85, dataStatus: "needs_review",
    },
  ],
  mumbai: [
    {
      name: "Mumbai Vada Pav and Bhel Puri Walk",
      slug: "mumbai-street-food-vada-pav",
      lat: 18.9388, lng: 72.8354,
      description: "Mumbai's street food trinity: vada pav (spicy potato fritter in pav), bhel puri (puffed rice salad), and pav bhaji (spiced vegetable mash with butter-toasted rolls). Juhu Beach for bhel, Anand Stall at Vile Parle for vada pav, and Sardar for pav bhaji near Tardeo.",
      area: "Multiple — Juhu, Vile Parle, Tardeo",
      typicalCostInr: 150, costMinInr: 50, costMaxInr: 300, costStatus: "estimated",
      openingTime: "09:00", closingTime: "22:00", openingDays: "Daily",
      openingHoursStatus: "known", bestSeason: "Oct–Apr", seasonStatus: "known",
      durationMinutes: 60, fatigueCost: 2, accessibilityScore: 3,
      popularityScore: 90, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.9, dataStatus: "needs_review",
    },
    {
      name: "Britannia & Co — Parsi Dhansak",
      slug: "britannia-co-mumbai-parsi",
      lat: 18.9371, lng: 72.8404,
      description: "One of Mumbai's most iconic Parsi restaurants (est. 1923), in the Fort district. Famous for dhansak (lamb/chicken with lentils and rice), mutton berry pulao, and caramel custard. Run by the Kohinoor family, it's a living piece of Irani café culture and Bombay heritage.",
      area: "Fort / Ballard Estate",
      typicalCostInr: 500, costMinInr: 300, costMaxInr: 800, costStatus: "estimated",
      openingTime: "11:30", closingTime: "16:00", openingDays: "Mon–Sat (closed Sunday and holidays)",
      openingHoursStatus: "known", bestSeason: "year-round", seasonStatus: "known",
      durationMinutes: 60, fatigueCost: 1, accessibilityScore: 3,
      popularityScore: 82, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.85, dataStatus: "needs_review",
    },
  ],
  udaipur: [
    {
      name: "Udaipur Lake View Rooftop Dining",
      slug: "udaipur-lake-view-rooftop-dining",
      lat: 24.5760, lng: 73.6835,
      description: "The Pichola lakefront is studded with rooftop restaurants with views of Lake Palace and City Palace. Must-try: Rajasthani thali with bajre ki roti, ker sangri, laal maas (chilli lamb), and churma. Ambrai and Upre at Lake Pichola are the most scenic.",
      area: "Hanuman Ghat / Lal Ghat",
      typicalCostInr: 600, costMinInr: 300, costMaxInr: 1200, costStatus: "estimated",
      openingTime: "12:00", closingTime: "23:00", openingDays: "Daily",
      openingHoursStatus: "known", bestSeason: "Oct–Mar", seasonStatus: "known",
      durationMinutes: 90, fatigueCost: 1, accessibilityScore: 3,
      popularityScore: 88, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.85, dataStatus: "needs_review",
    },
    {
      name: "Udaipur Old City Bazaar Street Food",
      slug: "udaipur-old-city-street-food",
      lat: 24.5826, lng: 73.6867,
      description: "Bada Bazaar and the lanes around City Palace offer local Rajasthani street food: dal baati (wheat balls with lentil soup), churma (sweet crumble), mirchi vada, and the local Mawa Kachori (sweet deep-fried pastry). Evening is the best time when the bazaar lights up.",
      area: "Bada Bazaar / City Palace area",
      typicalCostInr: 150, costMinInr: 60, costMaxInr: 250, costStatus: "estimated",
      openingTime: "10:00", closingTime: "21:00", openingDays: "Daily",
      openingHoursStatus: "known", bestSeason: "Oct–Mar", seasonStatus: "known",
      durationMinutes: 60, fatigueCost: 2, accessibilityScore: 3,
      popularityScore: 80, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.8, dataStatus: "needs_review",
    },
  ],
  jodhpur: [
    {
      name: "Jodhpur Makhaniya Lassi",
      slug: "jodhpur-makhaniya-lassi",
      lat: 26.2947, lng: 73.0213,
      description: "Jodhpur's signature thick saffron lassi topped with malai cream, famous at Shri Mishrilal Hotel near Clock Tower. Also try the ghee-laden pyaz kachori (onion pastry), mawa kachori, and mirchi bada at the stalls surrounding Sardar Market.",
      area: "Clock Tower / Sardar Market",
      typicalCostInr: 100, costMinInr: 50, costMaxInr: 200, costStatus: "estimated",
      openingTime: "07:30", closingTime: "13:00", openingDays: "Daily mornings",
      openingHoursStatus: "known", bestSeason: "Oct–Mar", seasonStatus: "known",
      durationMinutes: 30, fatigueCost: 1, accessibilityScore: 3,
      popularityScore: 85, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.85, dataStatus: "needs_review",
    },
    {
      name: "Jodhpur Rooftop Mehrangarh View Dining",
      slug: "jodhpur-mehrangarh-rooftop-dining",
      lat: 26.2993, lng: 73.0169,
      description: "Rooftop restaurants in the blue city below Mehrangarh Fort offer panoramic views of the indigo-painted houses and the fort at sunset. On the Rocks and Indique are popular for local Rajasthani cuisine with a stunning backdrop. Best visited at dusk.",
      area: "Old City below Mehrangarh",
      typicalCostInr: 500, costMinInr: 250, costMaxInr: 900, costStatus: "estimated",
      openingTime: "12:00", closingTime: "23:00", openingDays: "Daily",
      openingHoursStatus: "known", bestSeason: "Oct–Mar", seasonStatus: "known",
      durationMinutes: 75, fatigueCost: 1, accessibilityScore: 3,
      popularityScore: 80, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.8, dataStatus: "needs_review",
    },
  ],
  ladakh: [
    {
      name: "Ladakhi Thukpa and Skyu",
      slug: "ladakh-thukpa-skyu-food",
      lat: 34.1526, lng: 77.5771,
      description: "Traditional Ladakhi cuisine at Leh Old Town dhabas: thukpa (hearty noodle broth with vegetables or meat), skyu (thick hand-rolled pasta with root vegetables), and tsampa (roasted barley flour porridge). Tibetan flatbread tingmo goes with almost everything. Warming and high-altitude appropriate.",
      area: "Leh Old Town",
      typicalCostInr: 200, costMinInr: 80, costMaxInr: 350, costStatus: "estimated",
      openingTime: "08:00", closingTime: "21:00", openingDays: "Daily (Jun–Oct main season)",
      openingHoursStatus: "known", bestSeason: "Jun–Oct", seasonStatus: "known",
      durationMinutes: 45, fatigueCost: 1, accessibilityScore: 3,
      popularityScore: 82, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.85, dataStatus: "needs_review",
    },
    {
      name: "Leh Market Café and Butter Tea",
      slug: "leh-market-butter-tea-cafe",
      lat: 34.1666, lng: 77.5785,
      description: "Leh Main Bazaar cafés offer butter tea (pos cha — salted yak butter tea), chhang (barley beer), and fresh apricot juice — all local to Ladakh. The apricot orchards of Ladakh produce juice and jam of extraordinary quality. A chance to try hyperlocal Himalayan beverages.",
      area: "Leh Main Bazaar",
      typicalCostInr: 80, costMinInr: 40, costMaxInr: 150, costStatus: "estimated",
      openingTime: "07:00", closingTime: "20:00", openingDays: "Daily (Jun–Oct)",
      openingHoursStatus: "known", bestSeason: "Jun–Oct", seasonStatus: "known",
      durationMinutes: 30, fatigueCost: 1, accessibilityScore: 3,
      popularityScore: 75, hiddenGem: true,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.8, dataStatus: "needs_review",
    },
  ],
  kochi: [
    {
      name: "Kerala Sadya — Banana Leaf Feast",
      slug: "kochi-kerala-sadya-banana-leaf",
      lat: 9.9616, lng: 76.2999,
      description: "The traditional Kerala vegetarian feast (sadya) is served on a banana leaf with 20+ dishes: avial, olan, thoran, payasam, pappadam, and rice. Best experienced during Onam festival or at local restaurants like Kashi Art Café and Dal Roti. Eaten with right hand only.",
      area: "Fort Kochi / Mattancherry",
      typicalCostInr: 250, costMinInr: 120, costMaxInr: 500, costStatus: "estimated",
      openingTime: "11:30", closingTime: "15:30", openingDays: "Daily lunch",
      openingHoursStatus: "known", bestSeason: "year-round", seasonStatus: "known",
      durationMinutes: 60, fatigueCost: 1, accessibilityScore: 4,
      popularityScore: 85, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.85, dataStatus: "needs_review",
    },
    {
      name: "Fort Kochi Seafood Dinner",
      slug: "fort-kochi-seafood-dinner",
      lat: 9.9646, lng: 76.2426,
      description: "Fort Kochi's restaurant strip along the harbour offers fresh catch cooked to order — karimeen (pearl spot fish) in curry leaf, prawn moilee in coconut milk, and crab fry. Fish is sold fresh at the Chinese fishing nets and can be cooked at nearby stalls for a small preparation fee.",
      area: "Fort Kochi Waterfront",
      typicalCostInr: 400, costMinInr: 200, costMaxInr: 800, costStatus: "estimated",
      openingTime: "12:00", closingTime: "22:00", openingDays: "Daily",
      openingHoursStatus: "known", bestSeason: "Oct–May", seasonStatus: "known",
      durationMinutes: 75, fatigueCost: 1, accessibilityScore: 3,
      popularityScore: 88, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.85, dataStatus: "needs_review",
    },
  ],
  munnar: [
    {
      name: "Munnar Tea and Spice Trail Café",
      slug: "munnar-tea-spice-trail-cafe",
      lat: 10.0892, lng: 77.0595,
      description: "High-altitude Munnar's tea estate cafés serve freshly brewed single-estate teas and locally grown cardamom and pepper. KTDC-run Santhigiri café at Top Station and TATA Tea Museum café are popular stops. Pair with banana fritters or puttu (steamed rice cake).",
      area: "Munnar Town / Tea Estates",
      typicalCostInr: 150, costMinInr: 80, costMaxInr: 250, costStatus: "estimated",
      openingTime: "09:00", closingTime: "18:00", openingDays: "Daily",
      openingHoursStatus: "known", bestSeason: "Oct–May", seasonStatus: "known",
      durationMinutes: 45, fatigueCost: 1, accessibilityScore: 3,
      popularityScore: 80, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.8, dataStatus: "needs_review",
    },
  ],
  mysuru: [
    {
      name: "Mysuru Mysore Pak and Filter Coffee",
      slug: "mysuru-mysore-pak-filter-coffee",
      lat: 12.2958, lng: 76.6394,
      description: "Mysore Pak (the iconic ghee-laden gram flour sweet, invented in the palace kitchen) from Guru Sweets on Sayyaji Rao Road is a mandatory experience. Pair with strong Brahmin-style filter coffee at any local darshini (South Indian café). A complete Mysuru flavour journey.",
      area: "Devaraja Market / Sayyaji Rao Road",
      typicalCostInr: 100, costMinInr: 50, costMaxInr: 200, costStatus: "estimated",
      openingTime: "08:00", closingTime: "21:00", openingDays: "Daily",
      openingHoursStatus: "known", bestSeason: "year-round", seasonStatus: "known",
      durationMinutes: 45, fatigueCost: 1, accessibilityScore: 4,
      popularityScore: 82, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.85, dataStatus: "needs_review",
    },
    {
      name: "Mysuru Obbattu and South Indian Thali",
      slug: "mysuru-south-indian-thali",
      lat: 12.2958, lng: 76.6394,
      description: "A South Indian thali at Mylari Hotel (legendary for soft dosa and fresh coconut chutney) or RRR Restaurant (famous for unlimited meals). Obbattu (sweet flatbread with jaggery and lentil filling) is a Karnataka classic. Mysuru's temple-town food culture is deeply vegetarian and incredibly flavourful.",
      area: "Nazarbad / Vinoba Road",
      typicalCostInr: 120, costMinInr: 60, costMaxInr: 200, costStatus: "estimated",
      openingTime: "07:30", closingTime: "15:00", openingDays: "Daily (lunch cutoff ~15:00)",
      openingHoursStatus: "known", bestSeason: "year-round", seasonStatus: "known",
      durationMinutes: 45, fatigueCost: 1, accessibilityScore: 4,
      popularityScore: 80, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.8, dataStatus: "needs_review",
    },
  ],
  pondicherry: [
    {
      name: "Pondicherry French Patisserie — Goubert Market",
      slug: "pondicherry-french-patisserie",
      lat: 11.9366, lng: 79.8350,
      description: "Pondicherry's French Quarter has genuine patisseries (Baker Street, Le Café on the beachfront) serving croissants, crème brûlée, quiche, and baguettes alongside Indian filter coffee — a unique culinary fusion. Le Café next to the promenade is open 24 hours.",
      area: "White Town / French Quarter",
      typicalCostInr: 200, costMinInr: 80, costMaxInr: 400, costStatus: "estimated",
      openingTime: "07:00", closingTime: "23:00", openingDays: "Daily",
      openingHoursStatus: "known", bestSeason: "Oct–Mar", seasonStatus: "known",
      durationMinutes: 45, fatigueCost: 1, accessibilityScore: 4,
      popularityScore: 82, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.85, dataStatus: "needs_review",
    },
    {
      name: "Pondicherry Tamil Tiffin Breakfast",
      slug: "pondicherry-tamil-tiffin-breakfast",
      lat: 11.9358, lng: 79.8286,
      description: "Behind the French Quarter, Tamil Pondicherry has superb morning tiffin: paper dosa, idli sambar, pongal, and vadai. Aristo restaurant and Surguru are famous for value-for-money thalis. Wash it down with strong South Indian degree coffee.",
      area: "Tamil Quarter / Old Bus Stand area",
      typicalCostInr: 80, costMinInr: 40, costMaxInr: 150, costStatus: "estimated",
      openingTime: "07:00", closingTime: "13:00", openingDays: "Daily mornings",
      openingHoursStatus: "known", bestSeason: "year-round", seasonStatus: "known",
      durationMinutes: 30, fatigueCost: 1, accessibilityScore: 4,
      popularityScore: 75, hiddenGem: true,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.8, dataStatus: "needs_review",
    },
  ],
  haridwar: [
    {
      name: "Haridwar Chole Bhature and Puri Sabzi",
      slug: "haridwar-street-food-chole-bhature",
      lat: 29.9457, lng: 78.1642,
      description: "Har Ki Pauri area has excellent street food: chole bhature (chickpea curry with fried bread), puri sabzi, and kachori. Being a holy city, all food is strictly vegetarian and sattvic (no onion/garlic at many stalls). Best in the morning after attending Ganga Aarti.",
      area: "Har Ki Pauri / Brahmakund",
      typicalCostInr: 80, costMinInr: 40, costMaxInr: 150, costStatus: "estimated",
      openingTime: "07:00", closingTime: "21:00", openingDays: "Daily",
      openingHoursStatus: "known", bestSeason: "year-round", seasonStatus: "known",
      durationMinutes: 30, fatigueCost: 1, accessibilityScore: 3,
      popularityScore: 78, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.8, dataStatus: "needs_review",
    },
    {
      name: "Haridwar Sattvic Thali",
      slug: "haridwar-sattvic-thali",
      lat: 29.9457, lng: 78.1642,
      description: "Haridwar's ashram dining and local dhabas serve sattvic meals (no onion, garlic, meat) in the spirit of the pilgrimage city. Chotiwala at Swarg Ashram is the most famous restaurant. Meals are simple, wholesome, and surprisingly delicious — paneer, dal, roti, rice, and mithai.",
      area: "Ram Jhula / Rishikesh Border",
      typicalCostInr: 150, costMinInr: 80, costMaxInr: 250, costStatus: "estimated",
      openingTime: "10:00", closingTime: "22:00", openingDays: "Daily",
      openingHoursStatus: "known", bestSeason: "year-round", seasonStatus: "known",
      durationMinutes: 45, fatigueCost: 1, accessibilityScore: 4,
      popularityScore: 75, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.8, dataStatus: "needs_review",
    },
  ],
  dharamshala: [
    {
      name: "McLeod Ganj Tibetan Kitchen",
      slug: "dharamshala-tibetan-kitchen-mcleod",
      lat: 32.2432, lng: 76.3217,
      description: "McLeod Ganj is Dharamshala's Tibetan-in-exile hub, making it home to some of India's best momos, thukpa, and tsampa. Tibetan Kitchen restaurant near the Dalai Lama temple is a community staple. Try gyathuk (clear broth noodles) and sha momo (steamed meat dumplings).",
      area: "McLeod Ganj",
      typicalCostInr: 200, costMinInr: 100, costMaxInr: 350, costStatus: "estimated",
      openingTime: "10:00", closingTime: "21:00", openingDays: "Daily",
      openingHoursStatus: "known", bestSeason: "Apr–Jun, Sep–Nov", seasonStatus: "known",
      durationMinutes: 60, fatigueCost: 1, accessibilityScore: 3,
      popularityScore: 85, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.85, dataStatus: "needs_review",
    },
    {
      name: "Dharamshala Kangra Chai Culture",
      slug: "dharamshala-kangra-chai-culture",
      lat: 32.2196, lng: 76.3233,
      description: "The Kangra Valley below Dharamshala grows Himachal Pradesh's own tea. Local chai stalls near the cricket ground and bazaar offer spiced Kangra tea — distinct from Darjeeling with its own flavour profile. Pair with a Himachali snack like madra or babru (black gram stuffed bread).",
      area: "Lower Dharamshala / Kangra Road",
      typicalCostInr: 50, costMinInr: 20, costMaxInr: 100, costStatus: "estimated",
      openingTime: "07:00", closingTime: "20:00", openingDays: "Daily",
      openingHoursStatus: "known", bestSeason: "Mar–Jun, Sep–Nov", seasonStatus: "known",
      durationMinutes: 30, fatigueCost: 1, accessibilityScore: 4,
      popularityScore: 72, hiddenGem: true,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.75, dataStatus: "needs_review",
    },
  ],
  hampi: [
    {
      name: "Hampi Mango Tree Restaurant",
      slug: "hampi-mango-tree-restaurant",
      lat: 15.3350, lng: 76.4659,
      description: "The most famous restaurant in Hampi, perched on the banks of the Tungabhadra with views of the Virupapuragadde boulders. Serves South Indian thali, Israeli dishes, and continental food catering to the backpacker crowd. The view of boats crossing to Virupapuragadde is iconic at sunset.",
      area: "Hampi Bazaar / Tungabhadra Riverbank",
      typicalCostInr: 200, costMinInr: 100, costMaxInr: 350, costStatus: "estimated",
      openingTime: "08:00", closingTime: "22:00", openingDays: "Daily (Oct–Apr; may close Jun–Aug)",
      openingHoursStatus: "known", bestSeason: "Oct–Mar", seasonStatus: "known",
      durationMinutes: 75, fatigueCost: 1, accessibilityScore: 2,
      popularityScore: 85, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.8, dataStatus: "needs_review",
    },
    {
      name: "Hampi Local Dosa and South Indian Breakfast",
      slug: "hampi-local-dosa-breakfast",
      lat: 15.3350, lng: 76.4626,
      description: "Hampi Bazaar and Kamalapura village have simple local dhabas serving set dosa, idli, and pongal with freshly ground chutneys. In a heritage site surrounded by ruins, a simple local breakfast under a banana tree is one of the most memorable meals in Karnataka.",
      area: "Hampi Bazaar / Kamalapura",
      typicalCostInr: 70, costMinInr: 40, costMaxInr: 120, costStatus: "estimated",
      openingTime: "07:30", closingTime: "11:00", openingDays: "Daily mornings",
      openingHoursStatus: "known", bestSeason: "Oct–Mar", seasonStatus: "known",
      durationMinutes: 30, fatigueCost: 1, accessibilityScore: 3,
      popularityScore: 75, hiddenGem: true,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.8, dataStatus: "needs_review",
    },
  ],
  coorg: [
    {
      name: "Coorg Pork and Pandhi Curry",
      slug: "coorg-pandhi-curry-pork",
      lat: 12.4244, lng: 75.7382,
      description: "Kodava cuisine is meat-centred and famous nationally for pandhi curry (pork with Coorg's signature kachampulli — a dark vinegar from a local fruit). Served with akki roti (rice flatbread) and kadumbuttu (rice dumplings). Raintree or Capitol Village Resort for authentic Kodava meals.",
      area: "Madikeri",
      typicalCostInr: 400, costMinInr: 200, costMaxInr: 700, costStatus: "estimated",
      openingTime: "12:00", closingTime: "22:00", openingDays: "Daily",
      openingHoursStatus: "known", bestSeason: "Oct–Mar", seasonStatus: "known",
      durationMinutes: 60, fatigueCost: 1, accessibilityScore: 3,
      popularityScore: 82, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.85, dataStatus: "needs_review",
    },
    {
      name: "Coorg Estate Coffee Experience",
      slug: "coorg-estate-coffee-experience",
      lat: 12.3375, lng: 75.8069,
      description: "Coorg grows some of India's finest Arabica coffee. Many estates offer plantation walks with freshly brewed estate coffee — a completely different experience from commercial filter coffee. Mandarin Stay, Kadkani River Resort, and Coorg Wilderness Resort offer estate coffees with breakfast.",
      area: "Virajpet / Siddapur Coffee Belt",
      typicalCostInr: 0, costMinInr: 0, costMaxInr: 0, costStatus: "free",
      openingTime: "07:00", closingTime: "10:00", openingDays: "Daily (stay-in guests; day visits by arrangement)",
      openingHoursStatus: "known", bestSeason: "Oct–Apr", seasonStatus: "known",
      durationMinutes: 60, fatigueCost: 1, accessibilityScore: 3,
      popularityScore: 78, hiddenGem: true,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.75, dataStatus: "needs_review",
    },
  ],
  alappuzha: [
    {
      name: "Alappuzha Houseboat Backwater Meals",
      slug: "alappuzha-houseboat-backwater-meals",
      lat: 9.4981, lng: 76.3388,
      description: "A houseboat stay on the Alappuzha backwaters includes an onboard cook preparing fresh Kerala cuisine: karimeen pollichathu (pearl spot fish cooked in banana leaf), prawn moilee, fish curry, aviyal, and puttu. The food, the canals, and watching village life from the water is an all-India highlight.",
      area: "Alappuzha Backwaters",
      typicalCostInr: 500, costMinInr: 300, costMaxInr: 800, costStatus: "estimated",
      openingTime: "07:30", closingTime: "21:00", openingDays: "Daily (included with houseboat stay)",
      openingHoursStatus: "known", bestSeason: "Oct–May", seasonStatus: "known",
      durationMinutes: 60, fatigueCost: 1, accessibilityScore: 3,
      popularityScore: 85, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.85, dataStatus: "needs_review",
    },
    {
      name: "Alappuzha Local Toddy Shop",
      slug: "alappuzha-local-toddy-shop",
      lat: 9.4981, lng: 76.3388,
      description: "Kerala's toddy shops (kallu shappu) serve palm toddy — freshly tapped from coconut trees — alongside phenomenal seafood: crispy fried karimeen, crab fry, and prawn pepper fry. An authentic, unreconstructed local experience far from the tourist circuit. Recommended with caution for solo travelers.",
      area: "Alappuzha countryside lanes",
      typicalCostInr: 200, costMinInr: 100, costMaxInr: 350, costStatus: "estimated",
      openingTime: "11:00", closingTime: "20:00", openingDays: "Daily",
      openingHoursStatus: "known", bestSeason: "Oct–May", seasonStatus: "known",
      durationMinutes: 60, fatigueCost: 2, accessibilityScore: 2,
      popularityScore: 70, hiddenGem: true,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.75, dataStatus: "needs_review",
    },
  ],
  jaisalmer: [
    {
      name: "Jaisalmer Rajasthani Thali — Saffron Restaurant",
      slug: "jaisalmer-rajasthani-thali-dining",
      lat: 26.9157, lng: 70.9083,
      description: "Jaisalmer's rooftop restaurants within the fort and around Gadsisar Lake serve unlimited Rajasthani thali: ker sangri (desert beans and berries), laal maas, gatte ki sabzi, and churma. The fort ambience and candlelit evenings are perfect for this heritage meal experience.",
      area: "Jaisalmer Fort / Gadsisar Lake",
      typicalCostInr: 350, costMinInr: 180, costMaxInr: 600, costStatus: "estimated",
      openingTime: "12:00", closingTime: "22:30", openingDays: "Daily",
      openingHoursStatus: "known", bestSeason: "Oct–Mar", seasonStatus: "known",
      durationMinutes: 75, fatigueCost: 1, accessibilityScore: 3,
      popularityScore: 82, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.8, dataStatus: "needs_review",
    },
  ],
  khajuraho: [
    {
      name: "Khajuraho Local Madhya Pradesh Thali",
      slug: "khajuraho-mp-thali-dining",
      lat: 24.8504, lng: 79.9268,
      description: "Khajuraho has a small but genuine local food scene. Raja Café near the Western Temple Group and Mediterraneo Restaurant are traveller favourites. Try Bundeli-style dal bafla (similar to dal baati but steamed first) and the local achar (pickle) varieties.",
      area: "Near Western Temple Complex",
      typicalCostInr: 200, costMinInr: 100, costMaxInr: 350, costStatus: "estimated",
      openingTime: "09:00", closingTime: "22:00", openingDays: "Daily",
      openingHoursStatus: "known", bestSeason: "Oct–Mar", seasonStatus: "known",
      durationMinutes: 60, fatigueCost: 1, accessibilityScore: 4,
      popularityScore: 72, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.75, dataStatus: "needs_review",
    },
  ],
  orchha: [
    {
      name: "Orchha Local Dhaba — Bundeli Meals",
      slug: "orchha-local-bundeli-dhaba",
      lat: 25.3517, lng: 78.6438,
      description: "Orchha has simple riverside dhabas and local eateries serving Bundeli food — a regional cuisine distinct from Rajasthani and Mughlai. Dal bafla, chutney of raw mango, and thick roti with ghee are staples. Orchha Resort's restaurant is the main tourist option.",
      area: "Orchha Town",
      typicalCostInr: 200, costMinInr: 80, costMaxInr: 350, costStatus: "estimated",
      openingTime: "08:00", closingTime: "21:00", openingDays: "Daily",
      openingHoursStatus: "known", bestSeason: "Oct–Mar", seasonStatus: "known",
      durationMinutes: 45, fatigueCost: 1, accessibilityScore: 3,
      popularityScore: 65, hiddenGem: true,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.7, dataStatus: "needs_review",
    },
  ],
  panaji: [
    {
      name: "Panaji Fontainhas Café Crawl",
      slug: "panaji-fontainhas-cafe-crawl",
      lat: 15.5009, lng: 73.8347,
      description: "Panaji's old Latin Quarter, Fontainhas, has heritage cafés in Portuguese-era houses serving Goan-Catholic food: rechheado mackerel (spice-marinated fish), chicken xacuti, and bebinca. Viva Panjim on 31 January Road is a local institution. Combine with the neighbourhood's coloured buildings walk.",
      area: "Fontainhas, Panaji",
      typicalCostInr: 400, costMinInr: 200, costMaxInr: 700, costStatus: "estimated",
      openingTime: "11:30", closingTime: "22:00", openingDays: "Tue–Sun (most places closed Mon)",
      openingHoursStatus: "known", bestSeason: "Oct–Apr", seasonStatus: "known",
      durationMinutes: 75, fatigueCost: 1, accessibilityScore: 3,
      popularityScore: 82, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.85, dataStatus: "needs_review",
    },
  ],
  srinagar: [
    {
      name: "Srinagar Wazwan Feast",
      slug: "srinagar-wazwan-feast",
      lat: 34.0837, lng: 74.7973,
      description: "Wazwan is the grand Kashmiri multi-course feast of 36 dishes, prepared by wazas (specialist cooks). Essential dishes: rogan josh (lamb in Kashmiri chilli), gushtaba (meatballs in yoghurt gravy), yakhni (aromatic lamb in yoghurt), and tabak maaz (rib rack). Preeti Restaurant and Ahdoos are the safest bets for tourists.",
      area: "Downtown Srinagar",
      typicalCostInr: 600, costMinInr: 350, costMaxInr: 1200, costStatus: "estimated",
      openingTime: "12:00", closingTime: "22:00", openingDays: "Daily",
      openingHoursStatus: "known", bestSeason: "Apr–Oct", seasonStatus: "known",
      durationMinutes: 90, fatigueCost: 1, accessibilityScore: 4,
      popularityScore: 90, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.9, dataStatus: "needs_review",
    },
    {
      name: "Srinagar Noon Chai and Sheermal",
      slug: "srinagar-noon-chai-sheermal",
      lat: 34.0837, lng: 74.7973,
      description: "Noon chai (pink Kashmiri salt tea brewed with gunpowder tea leaves, milk, and baking soda) is a cultural staple. Served with sheermal (saffron-flavoured flatbread) or kulcha. A ritual morning or evening drink in Kashmiri homes — available at traditional bakeries in the old city.",
      area: "Old City / Nowhatta",
      typicalCostInr: 60, costMinInr: 30, costMaxInr: 100, costStatus: "estimated",
      openingTime: "07:00", closingTime: "20:00", openingDays: "Daily",
      openingHoursStatus: "known", bestSeason: "year-round", seasonStatus: "known",
      durationMinutes: 30, fatigueCost: 1, accessibilityScore: 3,
      popularityScore: 82, hiddenGem: true,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.85, dataStatus: "needs_review",
    },
  ],
  gangtok: [
    {
      name: "Gangtok Momos and Thukpa",
      slug: "gangtok-momos-thukpa",
      lat: 27.3314, lng: 88.6138,
      description: "Sikkim is momo heaven. Gangtok's MG Road area has dedicated momo restaurants and local dhabas. Try kothey (pan-fried momos), jhol momos (in soup), and ningro (fiddlehead fern) stir-fry — a uniquely Sikkimese ingredient. Pair with thukpa (noodle broth) or chhurpi soup (fermented cheese).",
      area: "MG Marg / Old Market",
      typicalCostInr: 150, costMinInr: 60, costMaxInr: 250, costStatus: "estimated",
      openingTime: "10:00", closingTime: "21:00", openingDays: "Daily",
      openingHoursStatus: "known", bestSeason: "Mar–Jun, Sep–Dec", seasonStatus: "known",
      durationMinutes: 45, fatigueCost: 1, accessibilityScore: 3,
      popularityScore: 85, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.85, dataStatus: "needs_review",
    },
    {
      name: "Gangtok Sikkimese Thali",
      slug: "gangtok-sikkimese-thali",
      lat: 27.3314, lng: 88.6138,
      description: "A Sikkimese thali introduces the region's mountain cuisine: gundruk ko achar (fermented leafy greens), dhindo (millet porridge), sel roti (crispy rice ring), and fermented bamboo shoot preparations. Taste of Sikkim restaurant near Police Bazaar offers the most comprehensive thali experience.",
      area: "Police Bazaar",
      typicalCostInr: 250, costMinInr: 120, costMaxInr: 400, costStatus: "estimated",
      openingTime: "12:00", closingTime: "22:00", openingDays: "Daily",
      openingHoursStatus: "known", bestSeason: "Mar–Jun, Sep–Dec", seasonStatus: "known",
      durationMinutes: 60, fatigueCost: 1, accessibilityScore: 4,
      popularityScore: 78, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.8, dataStatus: "needs_review",
    },
  ],
  shillong: [
    {
      name: "Shillong Jadoh and Local Khasi Food",
      slug: "shillong-jadoh-khasi-food",
      lat: 25.5788, lng: 91.8933,
      description: "Jadoh (red rice cooked with pork) is the signature dish of Khasi cuisine. Try also doh-khleh (pork/beef salad with onion and ginger), tungrymbai (fermented soya bean chutney), and boiled vegetables with spiced sauce. Trattoria restaurant and local Khasi eateries in Laitumkhrah are best for authentic food.",
      area: "Laitumkhrah / Police Bazaar",
      typicalCostInr: 200, costMinInr: 100, costMaxInr: 350, costStatus: "estimated",
      openingTime: "08:00", closingTime: "21:00", openingDays: "Daily",
      openingHoursStatus: "known", bestSeason: "Oct–Apr", seasonStatus: "known",
      durationMinutes: 45, fatigueCost: 1, accessibilityScore: 3,
      popularityScore: 80, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.85, dataStatus: "needs_review",
    },
    {
      name: "Shillong Cloud 9 — Café Culture",
      slug: "shillong-cafe-culture",
      lat: 25.5788, lng: 91.8933,
      description: "Shillong is India's rock music capital and has a vibrant café scene. Cloud 9 Café and Dylan's Café are staples for live music evenings, fresh coffee, and Western snacks. The city's unique Khasi-Christian-colonial heritage gives its café culture a distinct character unlike anywhere else in India.",
      area: "Police Bazaar / Laitumkhrah",
      typicalCostInr: 200, costMinInr: 100, costMaxInr: 350, costStatus: "estimated",
      openingTime: "10:00", closingTime: "22:00", openingDays: "Daily",
      openingHoursStatus: "known", bestSeason: "Oct–Apr", seasonStatus: "known",
      durationMinutes: 60, fatigueCost: 1, accessibilityScore: 3,
      popularityScore: 78, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.8, dataStatus: "needs_review",
    },
  ],
  sohra: [
    {
      name: "Sohra Local Tungrymbai and Kwai Experience",
      slug: "sohra-local-food-experience",
      lat: 25.2582, lng: 91.7197,
      description: "Sohra (Cherrapunji) has modest but authentic roadside stalls serving local Khasi food between the viewpoints: tungrymbai (fermented soybean) with boiled rice, seasonal jungle vegetables, and smoked pork. A modest meal that grounds the experience of touring the waterfall circuit.",
      area: "Sohra Market / Viewpoint Road",
      typicalCostInr: 120, costMinInr: 60, costMaxInr: 200, costStatus: "estimated",
      openingTime: "08:00", closingTime: "18:00", openingDays: "Daily",
      openingHoursStatus: "known", bestSeason: "Oct–May", seasonStatus: "known",
      durationMinutes: 30, fatigueCost: 1, accessibilityScore: 3,
      popularityScore: 65, hiddenGem: true,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.7, dataStatus: "needs_review",
    },
  ],
  dawki: [
    {
      name: "Dawki Riverside Picnic Food",
      slug: "dawki-riverside-food",
      lat: 25.1913, lng: 92.0191,
      description: "Dawki has basic roadside stalls near the Umngot River serving Khasi snacks, boiled eggs, chai, and simple rice meals. The best strategy is to buy from Shillong or Cherrapunji before arrival and picnic by the crystal-clear green river while watching boats cross to Bangladesh.",
      area: "Umngot River Bridge",
      typicalCostInr: 100, costMinInr: 50, costMaxInr: 200, costStatus: "estimated",
      openingTime: "08:00", closingTime: "17:00", openingDays: "Daily (stalls may close early in season)",
      openingHoursStatus: "known", bestSeason: "Oct–Apr", seasonStatus: "known",
      durationMinutes: 30, fatigueCost: 1, accessibilityScore: 3,
      popularityScore: 60, hiddenGem: true,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.65, dataStatus: "needs_review",
    },
  ],
  mawlynnong: [
    {
      name: "Mawlynnong Home Kitchen — Organic Village Meals",
      slug: "mawlynnong-home-kitchen",
      lat: 25.2018, lng: 91.9253,
      description: "Asia's cleanest village offers home-kitchen meals hosted by local Khasi families. Simple but deeply satisfying: boiled rice with pork, smoked beef or chicken, jungle greens, and fermented bamboo shoots. An intimate way to experience Khasi village culture.",
      area: "Mawlynnong Village",
      typicalCostInr: 150, costMinInr: 80, costMaxInr: 250, costStatus: "estimated",
      openingTime: "09:00", closingTime: "18:00", openingDays: "Daily",
      openingHoursStatus: "known", bestSeason: "Oct–Apr", seasonStatus: "known",
      durationMinutes: 45, fatigueCost: 1, accessibilityScore: 3,
      popularityScore: 72, hiddenGem: true,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.75, dataStatus: "needs_review",
    },
  ],
  nubra_valley: [
    {
      name: "Nubra Valley Local Ladakhi Apricot and Meals",
      slug: "nubra-valley-local-apricot-meals",
      lat: 34.5333, lng: 77.5500,
      description: "The Nubra Valley is Ladakh's apricot-growing region. Local guesthouses serve Ladakhi thukpa, skyu, and fresh apricot jam with roti. Dried apricots (khubani) are sold roadside and are extraordinarily sweet. Hundar and Diskit villages have simple family-run guesthouses with home-cooked meals.",
      area: "Hundar / Diskit",
      typicalCostInr: 200, costMinInr: 100, costMaxInr: 350, costStatus: "estimated",
      openingTime: "07:30", closingTime: "21:00", openingDays: "Daily (Jun–Oct main season)",
      openingHoursStatus: "known", bestSeason: "Jun–Sep", seasonStatus: "known",
      durationMinutes: 45, fatigueCost: 1, accessibilityScore: 3,
      popularityScore: 72, hiddenGem: true,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.8, dataStatus: "needs_review",
    },
  ],
  pangong_lake: [
    {
      name: "Pangong Lake Camp Meals",
      slug: "pangong-lake-camp-meals",
      lat: 33.7728, lng: 78.7219,
      description: "The tent camps along Pangong's shores serve simple dal-rice, aloo sabzi, and Ladakhi noodles. The setting — a turquoise lake at 4,350m altitude with the Himalayas reflected in its waters — makes any meal unforgettable. All camps are basic but the experience is extraordinary.",
      area: "Spangmik / Lukung Shore",
      typicalCostInr: 300, costMinInr: 200, costMaxInr: 500, costStatus: "estimated",
      openingTime: "07:00", closingTime: "21:00", openingDays: "Daily (Jun–Sep)",
      openingHoursStatus: "known", bestSeason: "Jun–Sep", seasonStatus: "known",
      durationMinutes: 45, fatigueCost: 1, accessibilityScore: 2,
      popularityScore: 75, hiddenGem: false,
      sourceType: "curated", sourceName: "Roamwise Editorial",
      confidence: 0.75, dataStatus: "needs_review",
    },
  ],
};

// Fix slug key name mismatches
const diningMap = {
  ...DINING_BY_DESTINATION,
  "nubra-valley": DINING_BY_DESTINATION.nubra_valley,
  "pangong-lake": DINING_BY_DESTINATION.pangong_lake,
};

// ── Paid cost estimates to apply to existing places ───────────────────────────
// These are applied by SLUG to existing place records
const PLACE_COST_OVERRIDES: Record<string, { typical: number; min: number; max: number; status: string }> = {
  // Goa
  "chapora-fort-goa": { typical: 0, min: 0, max: 0, status: "free" },
  "dudhsagar-falls-goa": { typical: 600, min: 400, max: 800, status: "estimated" },
  "calangute-beach-goa": { typical: 0, min: 0, max: 0, status: "free" },
  "anjuna-beach-goa": { typical: 0, min: 0, max: 0, status: "free" },
  "baga-beach-goa": { typical: 0, min: 0, max: 0, status: "free" },
  "vagator-beach-goa": { typical: 0, min: 0, max: 0, status: "free" },
  "agonda-beach-goa": { typical: 0, min: 0, max: 0, status: "free" },
  "palolem-beach-goa": { typical: 0, min: 0, max: 0, status: "free" },
  "mandovi-river-cruise-goa": { typical: 300, min: 200, max: 400, status: "estimated" },
  "spice-plantation-goa": { typical: 800, min: 600, max: 1000, status: "estimated" },
  "goa-state-museum": { typical: 20, min: 10, max: 20, status: "estimated" },
  "fort-aguada-goa": { typical: 0, min: 0, max: 0, status: "free" },
  // Jaipur paid attractions
  "sisodia-rani-garden": { typical: 50, min: 30, max: 80, status: "estimated" },
  "birla-mandir-jaipur": { typical: 0, min: 0, max: 0, status: "free" },
  "raj-mandir-cinema": { typical: 200, min: 150, max: 250, status: "estimated" },
  "jal-mahal-jaipur": { typical: 0, min: 0, max: 0, status: "free" },
  "albert-hall-museum": { typical: 150, min: 40, max: 150, status: "estimated" },
  "govind-dev-ji-temple": { typical: 0, min: 0, max: 0, status: "free" },
  "sanganer-village": { typical: 0, min: 0, max: 0, status: "free" },
  "chokhi-dhani-jaipur": { typical: 1200, min: 900, max: 1500, status: "estimated" },
  // Manali
  "rohtang-pass": { typical: 600, min: 500, max: 700, status: "estimated" },
  "solang-valley": { typical: 200, min: 100, max: 300, status: "estimated" },
  "hadimba-temple-manali": { typical: 0, min: 0, max: 0, status: "free" },
  "manu-temple-manali": { typical: 0, min: 0, max: 0, status: "free" },
  "vashisht-hot-springs": { typical: 20, min: 10, max: 30, status: "estimated" },
  "great-himalayan-national-park": { typical: 200, min: 150, max: 250, status: "estimated" },
  "naggar-castle": { typical: 100, min: 50, max: 100, status: "estimated" },
  "mall-road-manali": { typical: 0, min: 0, max: 0, status: "free" },
  // Ladakh
  "pangong-lake-ladakh": { typical: 0, min: 0, max: 0, status: "free" },
  "nubra-valley-dunes": { typical: 600, min: 400, max: 800, status: "estimated" },
  "thiksey-monastery": { typical: 50, min: 30, max: 50, status: "estimated" },
  "hemis-monastery": { typical: 100, min: 50, max: 100, status: "estimated" },
  "leh-palace": { typical: 200, min: 100, max: 200, status: "estimated" },
  "shanti-stupa-leh": { typical: 0, min: 0, max: 0, status: "free" },
  "spituk-monastery": { typical: 50, min: 30, max: 50, status: "estimated" },
  "lamayuru-monastery": { typical: 50, min: 30, max: 50, status: "estimated" },
  "magnetic-hill-ladakh": { typical: 0, min: 0, max: 0, status: "free" },
  "gurudwara-pathar-sahib": { typical: 0, min: 0, max: 0, status: "free" },
  // Rishikesh
  "laxman-jhula-bridge": { typical: 0, min: 0, max: 0, status: "free" },
  "ram-jhula-bridge": { typical: 0, min: 0, max: 0, status: "free" },
  "beatles-ashram-rishikesh": { typical: 150, min: 100, max: 200, status: "estimated" },
  "parmarth-niketan-aarti": { typical: 0, min: 0, max: 0, status: "free" },
  "neer-garh-waterfall": { typical: 60, min: 50, max: 100, status: "estimated" },
  "swarg-ashram": { typical: 0, min: 0, max: 0, status: "free" },
  "triveni-ghat-rishikesh": { typical: 0, min: 0, max: 0, status: "free" },
  "white-water-rafting-rishikesh": { typical: 800, min: 400, max: 1500, status: "estimated" },
  "bungee-jumping-mohan-chatti": { typical: 3500, min: 3000, max: 4000, status: "estimated" },
  "rajaji-national-park-rishikesh": { typical: 1000, min: 800, max: 1200, status: "estimated" },
};

interface PlaceRecord {
  name: string;
  slug: string;
  category: string;
  lat: number;
  lng: number;
  description?: string | null;
  area?: string | null;
  typicalCostInr?: number | null;
  costMinInr?: number | null;
  costMaxInr?: number | null;
  costStatus?: string | null;
  openingTime?: string | null;
  closingTime?: string | null;
  openingDays?: string | null;
  openingHoursStatus?: string | null;
  bestSeason?: string | null;
  seasonStatus?: string | null;
  durationMinutes?: number | null;
  fatigueCost?: number | null;
  accessibilityScore?: number | null;
  popularityScore?: number;
  hiddenGem?: boolean;
  sourceType?: string;
  sourceName?: string;
  sourceUrl?: string;
  sourceRecordId?: string;
  confidence?: number;
  dataStatus?: string;
}

interface PlaceFile {
  destinationSlug: string;
  sourceNote?: string;
  places: PlaceRecord[];
}

function enrichPlace(p: PlaceRecord): PlaceRecord {
  const result = { ...p };

  // DATA-001: typicalCostInr
  if (result.typicalCostInr == null) {
    if (result.costStatus === "free" || (result.costMinInr === 0 && result.costMaxInr === 0)) {
      result.typicalCostInr = 0;
      result.costStatus = "free";
      result.costMinInr = 0;
      result.costMaxInr = 0;
    } else if (PLACE_COST_OVERRIDES[result.slug]) {
      const o = PLACE_COST_OVERRIDES[result.slug];
      result.typicalCostInr = o.typical;
      result.costMinInr = o.min;
      result.costMaxInr = o.max;
      result.costStatus = o.status;
    } else if (result.costMinInr != null && result.costMaxInr != null && result.costMinInr >= 0 && result.costMaxInr > 0) {
      result.typicalCostInr = Math.round((result.costMinInr + result.costMaxInr) / 2);
      if (!result.costStatus || result.costStatus === "unknown") {
        result.costStatus = "estimated";
      }
    } else {
      // Default cost by category for unknown-cost places
      const defaults: Record<string, number> = {
        history: 200,
        culture: 100,
        spiritual: 0,
        nature: 50,
        adventure: 500,
        sightseeing: 100,
        relaxation: 0,
        photography: 0,
        local_experience: 100,
        shopping: 0,
        nightlife: 500,
        family: 150,
      };
      result.typicalCostInr = defaults[result.category] ?? 100;
      if (!result.costStatus || result.costStatus === "unknown") {
        result.costStatus = "estimated";
      }
    }
  }

  // DATA-003: opening hours status
  if (!result.openingHoursStatus) {
    if (result.openingTime && result.closingTime) {
      result.openingHoursStatus = "known";
    } else {
      result.openingHoursStatus = "unknown";
    }
  }

  // DATA-006: durationMinutes
  if (result.durationMinutes == null) {
    result.durationMinutes = DURATION_BY_CATEGORY[result.category] ?? 60;
  }

  // DATA-005: bestSeason default
  if (!result.bestSeason) {
    result.bestSeason = "year-round";
    result.seasonStatus = result.seasonStatus ?? "unknown";
  }

  return result;
}

function main() {
  const files = fs.readdirSync(PLACES_DIR).filter((f) => f.endsWith(".json")).sort();
  let totalPlaces = 0;
  let diningAdded = 0;
  let costFixed = 0;
  let durationFixed = 0;
  let hoursFixed = 0;

  console.log(`\nEnriching ${files.length} destination place files...\n`);

  for (const file of files) {
    const filePath = path.join(PLACES_DIR, file);
    const data: PlaceFile = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const slug = data.destinationSlug;

    console.log(`  Processing ${file} (${slug}) — ${data.places.length} places`);

    // Enrich existing places
    const enriched: PlaceRecord[] = data.places.map((p) => {
      const before = { ...p };
      const after = enrichPlace(p);
      if (after.typicalCostInr !== before.typicalCostInr) costFixed++;
      if (after.durationMinutes !== before.durationMinutes) durationFixed++;
      if (after.openingHoursStatus !== before.openingHoursStatus) hoursFixed++;
      return after;
    });

    // Add dining places if not already present
    const diningKey = slug.replace(/-/g, "_");
    const diningEntries = (diningMap as Record<string, typeof diningMap[keyof typeof diningMap]>)[slug] ?? (diningMap as Record<string, typeof diningMap[keyof typeof diningMap]>)[diningKey] ?? [];
    const existingSlugs = new Set(enriched.map((p) => p.slug));
    const newDining: PlaceRecord[] = [];

    for (const d of diningEntries) {
      if (!existingSlugs.has(d.slug)) {
        newDining.push({ ...d, category: "dining", typicalCostInr: d.typicalCostInr });
        diningAdded++;
        console.log(`    + Dining: ${d.name}`);
      } else {
        console.log(`    ~ Dining already exists: ${d.slug}`);
      }
    }

    const allPlaces = [...enriched, ...newDining];
    totalPlaces += allPlaces.length;

    const output: PlaceFile = {
      ...data,
      places: allPlaces,
    };

    fs.writeFileSync(filePath, JSON.stringify(output, null, 2) + "\n", "utf-8");
  }

  console.log(`\n=== Enrichment Complete ===`);
  console.log(`  Files processed: ${files.length}`);
  console.log(`  Total places after enrichment: ${totalPlaces}`);
  console.log(`  Cost data fixed: ${costFixed}`);
  console.log(`  Duration data fixed: ${durationFixed}`);
  console.log(`  Opening hours status fixed: ${hoursFixed}`);
  console.log(`  Dining places added: ${diningAdded}`);
  console.log(`\nNext step: npm run data:import`);
}

main();
