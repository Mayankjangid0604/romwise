import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import {
  SAMPLE_HOTEL_ARCHETYPES,
  getSampleHotelsForDestination,
  findSampleHotel,
  hotelSettingsFor,
  type SampleHotelDestination,
} from "../sample-hotels";
import { haversineKm } from "../route-optimizer";

type MasterDestination = { slug: string; name: string; lat: number; lng: number; destinationType?: string };
const MASTER: MasterDestination[] = (() => {
  const raw = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../../../data/master/destinations.json"), "utf-8"));
  return Array.isArray(raw) ? raw : raw.destinations;
})();

const dest = (slug: string): SampleHotelDestination => {
  const d = MASTER.find((m) => m.slug === slug);
  if (!d) throw new Error(`no master destination ${slug}`);
  return d;
};

const typesAt = (slug: string) => new Set(getSampleHotelsForDestination(dest(slug)).map((h) => h.propertyType));

describe("sample hotel catalogue — breadth", () => {
  it("has real variety, not just a few more rows (vs. the original 10)", () => {
    expect(SAMPLE_HOTEL_ARCHETYPES.length).toBeGreaterThanOrEqual(50);
    expect(new Set(SAMPLE_HOTEL_ARCHETYPES.map((a) => a.type)).size).toBeGreaterThanOrEqual(18);
    const prices = SAMPLE_HOTEL_ARCHETYPES.map((a) => a.costPerNightInr);
    expect(Math.min(...prices)).toBeLessThan(700);
    expect(Math.max(...prices)).toBeGreaterThan(15000);
    expect(new Set(SAMPLE_HOTEL_ARCHETYPES.map((a) => a.id)).size).toBe(SAMPLE_HOTEL_ARCHETYPES.length);
  });

  it("gives every curated destination at least 20 stays across several property types", () => {
    let total = 0;
    for (const d of MASTER) {
      const hotels = getSampleHotelsForDestination(d);
      total += hotels.length;
      expect(hotels.length, d.slug).toBeGreaterThanOrEqual(20);
      expect(new Set(hotels.map((h) => h.propertyType)).size, d.slug).toBeGreaterThanOrEqual(8);
      expect(new Set(hotels.map((h) => h.id)).size, d.slug).toBe(hotels.length);
    }
    expect(total).toBeGreaterThanOrEqual(1000);
  });
});

describe("sample hotels fit the destination", () => {
  it.each([
    ["goa", "beach_hut"],
    ["alappuzha", "houseboat"],
    ["jaisalmer", "camp"],
    ["manali", "cottage"],
    ["varanasi", "ashram"],
    ["jaipur", "heritage"],
  ])("%s includes %s stays", (slug, type) => {
    expect(typesAt(slug).has(type as never)).toBe(true);
  });

  it("does not put houseboats or desert camps in a plain metro", () => {
    const mumbai = getSampleHotelsForDestination(dest("mumbai"));
    expect(mumbai.some((h) => h.propertyType === "houseboat")).toBe(false);
    expect(mumbai.some((h) => h.name.includes("Dune") || h.name.includes("Desert"))).toBe(false);
  });

  it("maps settings from destinationType for destinations without an override", () => {
    expect(hotelSettingsFor({ slug: "some-hill-town", destinationType: "hill_station" })).toContain("mountain");
    expect(hotelSettingsFor({ slug: "some-park", destinationType: "national_park" })).toContain("wildlife");
    expect(hotelSettingsFor({ slug: "unknown", destinationType: null })).toEqual(["any"]);
  });
});

describe("sample hotels — data sanity", () => {
  it("are all labelled as sample data with sane prices, ratings and review counts", () => {
    for (const d of MASTER) {
      for (const h of getSampleHotelsForDestination(d)) {
        expect(h.isSample).toBe(true);
        expect(h.id.startsWith(`sample:${d.slug}:`)).toBe(true);
        expect(h.costPerNightInr).toBeGreaterThan(0);
        expect(h.rating).toBeGreaterThanOrEqual(2.8);
        expect(h.rating).toBeLessThanOrEqual(4.9);
        expect(h.reviewCount).toBeGreaterThan(0);
      }
    }
  });

  it("are placed around the destination (desert camps sit out at the dunes)", () => {
    for (const d of MASTER) {
      for (const h of getSampleHotelsForDestination(d)) {
        const km = haversineKm(d.lat, d.lng, h.lat, h.lng);
        expect(km, `${d.slug} ${h.name}`).toBeLessThanOrEqual(46);
      }
    }
  });

  it("use generic names, never hotel-chain brands", () => {
    const brands = /\b(taj|oberoi|trident|leela|itc|marriott|courtyard|hyatt|hilton|radisson|novotel|ibis|lemon tree|ginger|treebo|oyo|zostel|holiday inn|vivanta|fabhotel|sterling|club mahindra)\b/i;
    for (const a of SAMPLE_HOTEL_ARCHETYPES) expect(a.name, a.id).not.toMatch(brands);
  });

  it("is deterministic per destination and differs between destinations", () => {
    expect(getSampleHotelsForDestination(dest("goa"))).toEqual(getSampleHotelsForDestination(dest("goa")));
    const goa = getSampleHotelsForDestination(dest("goa")).find((h) => h.id.endsWith(":comfort-suites"))!;
    const agra = getSampleHotelsForDestination(dest("agra")).find((h) => h.id.endsWith(":comfort-suites"))!;
    expect([goa.lat, goa.lng]).not.toEqual([agra.lat, agra.lng]);
  });
});

describe("findSampleHotel", () => {
  it("finds a hotel by id for its own destination only", () => {
    const [first] = getSampleHotelsForDestination(dest("udaipur"));
    expect(findSampleHotel(dest("udaipur"), first.id)).toEqual(first);
    expect(findSampleHotel(dest("jaipur"), first.id)).toBeNull();
    expect(findSampleHotel(dest("udaipur"), "sample:udaipur:not-a-hotel")).toBeNull();
  });
});
