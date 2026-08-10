/**
 * Unit tests for GET /disponibilites — accent-insensitive search.
 *
 * Strategy: mock @workspace/db and drizzle-orm to capture the WHERE
 * conditions and verify they use the unaccent() SQL function.
 */

import { describe, it, expect, vi, beforeEach, type MockInstance } from "vitest";
import request from "supertest";
import express, { type Request, type Response, type NextFunction } from "express";

// ---------------------------------------------------------------------------
// Hoisted mock state
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => {
  const capturedSqlFragments: string[] = [];
  let _resolvedRows: object[] = [];

  // Chainable query builder mock
  const queryBuilder = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockImplementation(() => Promise.resolve(_resolvedRows)),
  };

  const mockDb = {
    ...queryBuilder,
    _setRows(rows: object[]) { _resolvedRows = rows; },
    _getCapturedSql() { return capturedSqlFragments; },
    _clearCapturedSql() { capturedSqlFragments.length = 0; },
  };

  // sql tag mock — kept as vi.fn() so .mockImplementation() remains available
  const mockSql = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
    const fragment = strings.join("?");
    capturedSqlFragments.push(fragment);
    return { _sql: fragment, _values: values };
  });

  const productionsTableSentinel = { _name: "productionsTable" } as any;
  const producteursTableSentinel = { _name: "producteursTable" } as any;
  const farmsTableSentinel = { _name: "farmsTable" } as any;
  const plotsTableSentinel = { _name: "plotsTable" } as any;

  return {
    mockDb,
    mockSql,
    productionsTableSentinel,
    producteursTableSentinel,
    farmsTableSentinel,
    plotsTableSentinel,
  };
});

// ---------------------------------------------------------------------------
// vi.mock factories
// ---------------------------------------------------------------------------

vi.mock("@workspace/db", () => ({
  db: mocks.mockDb,
  productionsTable: mocks.productionsTableSentinel,
  producteursTable: mocks.producteursTableSentinel,
  farmsTable: mocks.farmsTableSentinel,
  plotsTable: mocks.plotsTableSentinel,
}));

vi.mock("drizzle-orm", async (importOriginal) => {
  const real = await importOriginal<typeof import("drizzle-orm")>();
  return { ...real, sql: mocks.mockSql };
});

// ---------------------------------------------------------------------------
// Import router after mocks
// ---------------------------------------------------------------------------

const { default: disponibilitesRouter } = await import("./disponibilites.js");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).log = { error: vi.fn(), warn: vi.fn(), info: vi.fn() };
    next();
  });
  app.use("/api", disponibilitesRouter);
  return app;
}

function makeProductionRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    production_id: 1,
    culture: "Hévéa",
    campagne: "2025",
    quantite_disponible: "500",
    quantite_vente: "400",
    unite: "Kg",
    recherche_acheteur: true,
    prix_souhaite: "1200",
    periode_disponibilite: "Jan–Mar",
    producteur_id: 10,
    nom: "Kouassi",
    prenoms: "Ama",
    numero_membre: "MBR-001",
    region: "Lacs",
    departement: "Dimbokro",
    village: "Village A",
    telephone: "0700000000",
    cooperative_nom_libre: "Coopérative ABC",
    plot_id: 5,
    plot_reference: "P-001",
    farm_localite: "Ferme Est",
    ...overrides,
  };
}

async function getWithRows(rows: object[], query: Record<string, string>) {
  mocks.mockDb.limit.mockImplementation(() => Promise.resolve(rows));
  return request(createTestApp()).get("/api/disponibilites").query(query);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/disponibilites — accent-insensitive search (unit)", () => {
  beforeEach(() => {
    mocks.mockDb._clearCapturedSql();
    vi.clearAllMocks();
    // Re-wire chainable mocks after clearAllMocks
    mocks.mockDb.select.mockReturnThis();
    mocks.mockDb.from.mockReturnThis();
    mocks.mockDb.innerJoin.mockReturnThis();
    mocks.mockDb.where.mockReturnThis();
    mocks.mockDb.orderBy.mockReturnThis();
    mocks.mockDb.limit.mockImplementation(() => Promise.resolve([]));
    (mocks.mockSql as MockInstance).mockImplementation(
      (strings: TemplateStringsArray, ...values: unknown[]) => {
        const fragment = strings.join("?");
        mocks.mockDb._getCapturedSql().push(fragment);
        return { _sql: fragment, _values: values };
      },
    );
  });

  it("returns Hévéa rows when culture query is the unaccented term 'hevea'", async () => {
    const row = makeProductionRow({ culture: "Hévéa" });
    const res = await getWithRows([row], { culture: "hevea" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].culture).toBe("Hévéa");
  });

  it("returns Maïs rows when culture query is the unaccented term 'mais'", async () => {
    const row = makeProductionRow({ culture: "Maïs" });
    const res = await getWithRows([row], { culture: "mais" });
    expect(res.status).toBe(200);
    expect(res.body[0].culture).toBe("Maïs");
  });

  it("returns Hévéa rows when culture query is the partial term 'Hev'", async () => {
    const row = makeProductionRow({ culture: "Hévéa" });
    const res = await getWithRows([row], { culture: "Hev" });
    expect(res.status).toBe(200);
    expect(res.body[0].culture).toBe("Hévéa");
  });

  it("uses unaccent() in the SQL condition for the culture filter", async () => {
    await getWithRows([], { culture: "hevea" });
    const fragments = mocks.mockDb._getCapturedSql();
    expect(fragments.some((f) => f.toLowerCase().includes("unaccent"))).toBe(true);
  });

  it("uses unaccent() in the SQL condition for the region filter", async () => {
    await getWithRows([], { region: "lacs" });
    const fragments = mocks.mockDb._getCapturedSql();
    expect(fragments.some((f) => f.toLowerCase().includes("unaccent"))).toBe(true);
  });

  it("uses unaccent() in the SQL condition for the departement filter", async () => {
    await getWithRows([], { departement: "dimbokro" });
    const fragments = mocks.mockDb._getCapturedSql();
    expect(fragments.some((f) => f.toLowerCase().includes("unaccent"))).toBe(true);
  });

  it("uses unaccent() in the SQL condition for the cooperative filter", async () => {
    await getWithRows([], { cooperative: "cooperative" });
    const fragments = mocks.mockDb._getCapturedSql();
    expect(fragments.some((f) => f.toLowerCase().includes("unaccent"))).toBe(true);
  });

  it("returns 200 with empty array when no productions match", async () => {
    const res = await getWithRows([], { culture: "palmier" });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns 200 with all rows when no filter is provided", async () => {
    const rows = [
      makeProductionRow({ production_id: 1, culture: "Hévéa" }),
      makeProductionRow({ production_id: 2, culture: "Maïs" }),
    ];
    const res = await getWithRows(rows, {});
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });
});
