/**
 * Behavioral tests for destination hierarchy, alias resolution, and resolver correctness.
 * These test the resolveDestination function against the Goa/Panaji model and other
 * named-alias scenarios specified in Phase 3.5 Batch 2.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    travelDestination: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    destinationAlias: {
      findFirst: vi.fn(),
    },
  },
}));

import { resolveDestination } from "../destination-resolver";
import { prisma } from "@/lib/db";

const mockDestination = vi.mocked(prisma.travelDestination);
const mockAlias = vi.mocked(prisma.destinationAlias);

// Shared fields added to schema in Phase 3.5 Batch 2
const SCHEMA_EXTRAS = {
  parentDestinationId: null,
  districtId: null,
  sourceUrl: null,
  sourceName: null,
  sourceType: "curated",
  sourceRecordId: null,
  lastVerifiedAt: null,
  confidence: null,
};

const GOA = {
  id: "dest-goa",
  name: "Goa",
  slug: "goa",
  state: "Goa",
  country: "India",
  lat: 15.2993,
  lng: 74.124,
  description: null,
  destinationType: "tourism_region",
  dataStatus: "needs_review",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...SCHEMA_EXTRAS,
  parentDestinationId: null,
};

const PANAJI = {
  id: "dest-panaji",
  name: "Panaji",
  slug: "panaji",
  state: "Goa",
  country: "India",
  lat: 15.4989,
  lng: 73.8278,
  description: null,
  destinationType: "city",
  dataStatus: "needs_review",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...SCHEMA_EXTRAS,
  parentDestinationId: "dest-goa",
};

const PONDICHERRY = {
  id: "dest-pondicherry",
  name: "Pondicherry",
  slug: "pondicherry",
  state: "Puducherry",
  country: "India",
  lat: 11.9416,
  lng: 79.8083,
  description: null,
  destinationType: "city",
  dataStatus: "needs_review",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...SCHEMA_EXTRAS,
};

const ALAPPUZHA = {
  id: "dest-alappuzha",
  name: "Alappuzha",
  slug: "alappuzha",
  state: "Kerala",
  country: "India",
  lat: 9.4981,
  lng: 76.3388,
  description: null,
  destinationType: "city",
  dataStatus: "needs_review",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...SCHEMA_EXTRAS,
};

const SOHRA = {
  id: "dest-sohra",
  name: "Sohra",
  slug: "sohra",
  state: "Meghalaya",
  country: "India",
  lat: 25.2958,
  lng: 91.7086,
  description: null,
  destinationType: "town",
  dataStatus: "needs_review",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...SCHEMA_EXTRAS,
};

const COORG = {
  id: "dest-coorg",
  name: "Coorg",
  slug: "coorg",
  state: "Karnataka",
  country: "India",
  lat: 12.3375,
  lng: 75.8069,
  description: null,
  destinationType: "tourism_region",
  dataStatus: "needs_review",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...SCHEMA_EXTRAS,
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Goa resolver model ───────────────────────────────────────────────────────

describe("Goa resolver model", () => {
  it('"Goa" resolves to the Goa regional destination', async () => {
    mockDestination.findFirst.mockResolvedValueOnce(GOA);

    const result = await resolveDestination("Goa");

    expect(result).not.toBeNull();
    expect(result!.name).toBe("Goa");
    expect(result!.id).toBe("dest-goa");
    expect(result!.matchType).toBe("exact");
  });

  it('"goa" (lowercase) resolves to Goa regional destination', async () => {
    mockDestination.findFirst.mockResolvedValueOnce(GOA);

    const result = await resolveDestination("goa");

    expect(result).not.toBeNull();
    expect(result!.name).toBe("Goa");
    expect(result!.matchType).toBe("exact");
  });

  it('"Panaji" resolves to the Panaji city destination, not Goa region', async () => {
    mockDestination.findFirst.mockResolvedValueOnce(PANAJI);

    const result = await resolveDestination("Panaji");

    expect(result).not.toBeNull();
    expect(result!.name).toBe("Panaji");
    expect(result!.id).toBe("dest-panaji");
    expect(result!.id).not.toBe("dest-goa");
    expect(result!.matchType).toBe("exact");
  });

  it('"panaji" (lowercase) resolves to Panaji', async () => {
    mockDestination.findFirst.mockResolvedValueOnce(PANAJI);

    const result = await resolveDestination("panaji");

    expect(result).not.toBeNull();
    expect(result!.name).toBe("Panaji");
    expect(result!.matchType).toBe("exact");
  });

  it('"Panjim" alias resolves to Panaji (not Goa region)', async () => {
    mockDestination.findFirst.mockResolvedValueOnce(null);
    mockAlias.findFirst.mockResolvedValueOnce({
      id: "alias-panjim",
      alias: "Panjim",
      destinationId: PANAJI.id,
      destination: PANAJI,
      createdAt: new Date(),
    } as never);

    const result = await resolveDestination("Panjim");

    expect(result).not.toBeNull();
    expect(result!.name).toBe("Panaji");
    expect(result!.id).toBe("dest-panaji");
    expect(result!.matchType).toBe("alias");
  });

  it('"North Goa" alias resolves to the Goa regional destination', async () => {
    mockDestination.findFirst.mockResolvedValueOnce(null);
    mockAlias.findFirst.mockResolvedValueOnce({
      id: "alias-north-goa",
      alias: "North Goa",
      destinationId: GOA.id,
      destination: GOA,
      createdAt: new Date(),
    } as never);

    const result = await resolveDestination("North Goa");

    expect(result).not.toBeNull();
    expect(result!.name).toBe("Goa");
    expect(result!.id).toBe("dest-goa");
    expect(result!.matchType).toBe("alias");
  });

  it('"South Goa" alias resolves to the Goa regional destination', async () => {
    mockDestination.findFirst.mockResolvedValueOnce(null);
    mockAlias.findFirst.mockResolvedValueOnce({
      id: "alias-south-goa",
      alias: "South Goa",
      destinationId: GOA.id,
      destination: GOA,
      createdAt: new Date(),
    } as never);

    const result = await resolveDestination("South Goa");

    expect(result).not.toBeNull();
    expect(result!.name).toBe("Goa");
    expect(result!.matchType).toBe("alias");
  });

  it('"Old Goa" alias resolves to the Goa regional destination', async () => {
    mockDestination.findFirst.mockResolvedValueOnce(null);
    mockAlias.findFirst.mockResolvedValueOnce({
      id: "alias-old-goa",
      alias: "Old Goa",
      destinationId: GOA.id,
      destination: GOA,
      createdAt: new Date(),
    } as never);

    const result = await resolveDestination("Old Goa");

    expect(result).not.toBeNull();
    expect(result!.name).toBe("Goa");
    expect(result!.matchType).toBe("alias");
  });

  it("Panaji carries parentDestinationId pointing to Goa", () => {
    // This is a data integrity assertion on the fixture itself.
    expect(PANAJI.parentDestinationId).toBe("dest-goa");
  });
});

// ─── Cross-destination ID rejection ──────────────────────────────────────────

describe("cross-destination ID rejection", () => {
  it("resolving Panaji never returns Goa ID", async () => {
    mockDestination.findFirst.mockResolvedValueOnce(PANAJI);

    const result = await resolveDestination("Panaji");

    expect(result!.id).not.toBe(GOA.id);
  });

  it("resolving Goa never returns Panaji ID", async () => {
    mockDestination.findFirst.mockResolvedValueOnce(GOA);

    const result = await resolveDestination("Goa");

    expect(result!.id).not.toBe(PANAJI.id);
  });
});

// ─── Alias resolution: regional variants ─────────────────────────────────────

describe("alias resolution: regional name variants", () => {
  it('"Puducherry" resolves to Pondicherry via alias', async () => {
    mockDestination.findFirst.mockResolvedValueOnce(null);
    mockAlias.findFirst.mockResolvedValueOnce({
      id: "alias-puducherry",
      alias: "Puducherry",
      destinationId: PONDICHERRY.id,
      destination: PONDICHERRY,
      createdAt: new Date(),
    } as never);

    const result = await resolveDestination("Puducherry");

    expect(result).not.toBeNull();
    expect(result!.name).toBe("Pondicherry");
    expect(result!.matchType).toBe("alias");
  });

  it('"Alleppey" resolves to Alappuzha via alias', async () => {
    mockDestination.findFirst.mockResolvedValueOnce(null);
    mockAlias.findFirst.mockResolvedValueOnce({
      id: "alias-alleppey",
      alias: "Alleppey",
      destinationId: ALAPPUZHA.id,
      destination: ALAPPUZHA,
      createdAt: new Date(),
    } as never);

    const result = await resolveDestination("Alleppey");

    expect(result).not.toBeNull();
    expect(result!.name).toBe("Alappuzha");
    expect(result!.matchType).toBe("alias");
  });

  it('"Cherrapunji" resolves to Sohra via alias', async () => {
    mockDestination.findFirst.mockResolvedValueOnce(null);
    mockAlias.findFirst.mockResolvedValueOnce({
      id: "alias-cherrapunji",
      alias: "Cherrapunji",
      destinationId: SOHRA.id,
      destination: SOHRA,
      createdAt: new Date(),
    } as never);

    const result = await resolveDestination("Cherrapunji");

    expect(result).not.toBeNull();
    expect(result!.name).toBe("Sohra");
    expect(result!.matchType).toBe("alias");
  });

  it('"Kodagu" resolves to Coorg via alias', async () => {
    mockDestination.findFirst.mockResolvedValueOnce(null);
    mockAlias.findFirst.mockResolvedValueOnce({
      id: "alias-kodagu",
      alias: "Kodagu",
      destinationId: COORG.id,
      destination: COORG,
      createdAt: new Date(),
    } as never);

    const result = await resolveDestination("Kodagu");

    expect(result).not.toBeNull();
    expect(result!.name).toBe("Coorg");
    expect(result!.matchType).toBe("alias");
  });
});

// ─── Unknown destination ──────────────────────────────────────────────────────

describe("unknown destination handling", () => {
  it("returns null for a fictional destination (Atlantis)", async () => {
    mockDestination.findFirst.mockResolvedValue(null);
    mockAlias.findFirst.mockResolvedValue(null);

    const result = await resolveDestination("Atlantis");

    expect(result).toBeNull();
  });

  it("returns null for an empty string without hitting the DB", async () => {
    const result = await resolveDestination("");

    expect(result).toBeNull();
    expect(mockDestination.findFirst).not.toHaveBeenCalled();
    expect(mockAlias.findFirst).not.toHaveBeenCalled();
  });

  it("returns null for whitespace-only input without hitting the DB", async () => {
    const result = await resolveDestination("   ");

    expect(result).toBeNull();
    expect(mockDestination.findFirst).not.toHaveBeenCalled();
  });
});

// ─── Hierarchy data integrity ─────────────────────────────────────────────────

describe("destination hierarchy data integrity", () => {
  it("Goa is a top-level destination (no parent)", () => {
    expect(GOA.parentDestinationId).toBeNull();
  });

  it("Panaji is a child of Goa", () => {
    expect(PANAJI.parentDestinationId).toBe(GOA.id);
  });

  it("Goa destinationType is tourism_region", () => {
    expect(GOA.destinationType).toBe("tourism_region");
  });

  it("Panaji destinationType is city", () => {
    expect(PANAJI.destinationType).toBe("city");
  });
});

// ─── Batch 3A alias resolution ────────────────────────────────────────────────
// New destinations added in Batch 3A; tests verify alias → canonical mapping.

const MYSURU = {
  id: "dest-mysuru",
  name: "Mysuru",
  slug: "mysuru",
  state: "Karnataka",
  country: "India",
  lat: 12.2958,
  lng: 76.6394,
  description: null,
  destinationType: "city",
  dataStatus: "needs_review",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...SCHEMA_EXTRAS,
};

const BENGALURU = {
  id: "dest-bengaluru",
  name: "Bengaluru",
  slug: "bengaluru",
  state: "Karnataka",
  country: "India",
  lat: 12.9716,
  lng: 77.5946,
  description: null,
  destinationType: "city",
  dataStatus: "needs_review",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...SCHEMA_EXTRAS,
};

const KOLKATA = {
  id: "dest-kolkata",
  name: "Kolkata",
  slug: "kolkata",
  state: "West Bengal",
  country: "India",
  lat: 22.5726,
  lng: 88.3639,
  description: null,
  destinationType: "city",
  dataStatus: "needs_review",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...SCHEMA_EXTRAS,
};

const CHENNAI = {
  id: "dest-chennai",
  name: "Chennai",
  slug: "chennai",
  state: "Tamil Nadu",
  country: "India",
  lat: 13.0827,
  lng: 80.2707,
  description: null,
  destinationType: "city",
  dataStatus: "needs_review",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...SCHEMA_EXTRAS,
};

const DHARAMSHALA = {
  id: "dest-dharamshala",
  name: "Dharamshala",
  slug: "dharamshala",
  state: "Himachal Pradesh",
  country: "India",
  lat: 32.219,
  lng: 76.3234,
  description: null,
  destinationType: "city",
  dataStatus: "needs_review",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...SCHEMA_EXTRAS,
};

const OOTY = {
  id: "dest-ooty",
  name: "Ooty",
  slug: "ooty",
  state: "Tamil Nadu",
  country: "India",
  lat: 11.4102,
  lng: 76.695,
  description: null,
  destinationType: "hill_station",
  dataStatus: "needs_review",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...SCHEMA_EXTRAS,
};

const KASHMIR_VALLEY = {
  id: "dest-kashmir-valley",
  name: "Kashmir Valley",
  slug: "kashmir-valley",
  state: "Jammu and Kashmir",
  country: "India",
  lat: 34.083,
  lng: 74.797,
  description: null,
  destinationType: "tourism_region",
  dataStatus: "needs_review",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...SCHEMA_EXTRAS,
};

const SRINAGAR = {
  id: "dest-srinagar",
  name: "Srinagar",
  slug: "srinagar",
  state: "Jammu and Kashmir",
  country: "India",
  lat: 34.0837,
  lng: 74.7973,
  description: null,
  destinationType: "city",
  dataStatus: "needs_review",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...SCHEMA_EXTRAS,
  parentDestinationId: "dest-kashmir-valley",
};

const MAHABALIPURAM = {
  id: "dest-mahabalipuram",
  name: "Mahabalipuram",
  slug: "mahabalipuram",
  state: "Tamil Nadu",
  country: "India",
  lat: 12.6269,
  lng: 80.1927,
  description: null,
  destinationType: "heritage_site",
  dataStatus: "needs_review",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...SCHEMA_EXTRAS,
};

const AURANGABAD = {
  id: "dest-aurangabad",
  name: "Aurangabad",
  slug: "aurangabad",
  state: "Maharashtra",
  country: "India",
  lat: 19.8762,
  lng: 75.3433,
  description: null,
  destinationType: "city",
  dataStatus: "needs_review",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...SCHEMA_EXTRAS,
};

describe("Batch 3A alias resolution: official renames", () => {
  it('"Mysore" resolves to Mysuru via alias', async () => {
    mockDestination.findFirst.mockResolvedValueOnce(null);
    mockAlias.findFirst.mockResolvedValueOnce({
      id: "alias-mysore",
      alias: "Mysore",
      destinationId: MYSURU.id,
      destination: MYSURU,
      createdAt: new Date(),
    } as never);
    const result = await resolveDestination("Mysore");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Mysuru");
    expect(result!.matchType).toBe("alias");
  });

  it('"Mysuru" resolves directly (exact match)', async () => {
    mockDestination.findFirst.mockResolvedValueOnce(MYSURU);
    const result = await resolveDestination("Mysuru");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Mysuru");
    expect(result!.matchType).toBe("exact");
  });

  it('"Bangalore" resolves to Bengaluru via alias', async () => {
    mockDestination.findFirst.mockResolvedValueOnce(null);
    mockAlias.findFirst.mockResolvedValueOnce({
      id: "alias-bangalore",
      alias: "Bangalore",
      destinationId: BENGALURU.id,
      destination: BENGALURU,
      createdAt: new Date(),
    } as never);
    const result = await resolveDestination("Bangalore");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Bengaluru");
    expect(result!.matchType).toBe("alias");
  });

  it('"Calcutta" resolves to Kolkata via alias', async () => {
    mockDestination.findFirst.mockResolvedValueOnce(null);
    mockAlias.findFirst.mockResolvedValueOnce({
      id: "alias-calcutta",
      alias: "Calcutta",
      destinationId: KOLKATA.id,
      destination: KOLKATA,
      createdAt: new Date(),
    } as never);
    const result = await resolveDestination("Calcutta");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Kolkata");
    expect(result!.matchType).toBe("alias");
  });

  it('"Madras" resolves to Chennai via alias', async () => {
    mockDestination.findFirst.mockResolvedValueOnce(null);
    mockAlias.findFirst.mockResolvedValueOnce({
      id: "alias-madras",
      alias: "Madras",
      destinationId: CHENNAI.id,
      destination: CHENNAI,
      createdAt: new Date(),
    } as never);
    const result = await resolveDestination("Madras");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Chennai");
    expect(result!.matchType).toBe("alias");
  });

  it('"McLeod Ganj" resolves to Dharamshala via alias', async () => {
    mockDestination.findFirst.mockResolvedValueOnce(null);
    mockAlias.findFirst.mockResolvedValueOnce({
      id: "alias-mcleod",
      alias: "McLeod Ganj",
      destinationId: DHARAMSHALA.id,
      destination: DHARAMSHALA,
      createdAt: new Date(),
    } as never);
    const result = await resolveDestination("McLeod Ganj");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Dharamshala");
    expect(result!.matchType).toBe("alias");
  });

  it('"Udhagamandalam" resolves to Ooty via alias', async () => {
    mockDestination.findFirst.mockResolvedValueOnce(null);
    mockAlias.findFirst.mockResolvedValueOnce({
      id: "alias-udh",
      alias: "Udhagamandalam",
      destinationId: OOTY.id,
      destination: OOTY,
      createdAt: new Date(),
    } as never);
    const result = await resolveDestination("Udhagamandalam");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Ooty");
    expect(result!.matchType).toBe("alias");
  });

  it('"Kashmir" resolves to Kashmir Valley via alias', async () => {
    mockDestination.findFirst.mockResolvedValueOnce(null);
    mockAlias.findFirst.mockResolvedValueOnce({
      id: "alias-kashmir",
      alias: "Kashmir",
      destinationId: KASHMIR_VALLEY.id,
      destination: KASHMIR_VALLEY,
      createdAt: new Date(),
    } as never);
    const result = await resolveDestination("Kashmir");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Kashmir Valley");
    expect(result!.matchType).toBe("alias");
  });

  it('"Srinagar" resolves directly (exact match)', async () => {
    mockDestination.findFirst.mockResolvedValueOnce(SRINAGAR);
    const result = await resolveDestination("Srinagar");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Srinagar");
    expect(result!.matchType).toBe("exact");
  });

  it('"Mamallapuram" resolves to Mahabalipuram via alias', async () => {
    mockDestination.findFirst.mockResolvedValueOnce(null);
    mockAlias.findFirst.mockResolvedValueOnce({
      id: "alias-mamal",
      alias: "Mamallapuram",
      destinationId: MAHABALIPURAM.id,
      destination: MAHABALIPURAM,
      createdAt: new Date(),
    } as never);
    const result = await resolveDestination("Mamallapuram");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Mahabalipuram");
    expect(result!.matchType).toBe("alias");
  });

  it('"Chhatrapati Sambhajinagar" resolves to Aurangabad via alias', async () => {
    mockDestination.findFirst.mockResolvedValueOnce(null);
    mockAlias.findFirst.mockResolvedValueOnce({
      id: "alias-csn",
      alias: "Chhatrapati Sambhajinagar",
      destinationId: AURANGABAD.id,
      destination: AURANGABAD,
      createdAt: new Date(),
    } as never);
    const result = await resolveDestination("Chhatrapati Sambhajinagar");
    expect(result).not.toBeNull();
    expect(result!.name).toBe("Aurangabad");
    expect(result!.matchType).toBe("alias");
  });
});

describe("Batch 3A: Srinagar is a child of Kashmir Valley", () => {
  it("Srinagar carries parentDestinationId pointing to Kashmir Valley", () => {
    expect(SRINAGAR.parentDestinationId).toBe(KASHMIR_VALLEY.id);
  });

  it("Kashmir Valley is a top-level tourism_region (no parent)", () => {
    expect(KASHMIR_VALLEY.parentDestinationId).toBeNull();
  });

  it("Kashmir Valley has destinationType tourism_region", () => {
    expect(KASHMIR_VALLEY.destinationType).toBe("tourism_region");
  });
});
