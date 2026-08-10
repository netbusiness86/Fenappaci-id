/**
 * Integration tests for GET /disponibilites — accent-insensitive search.
 *
 * These tests run against a real PostgreSQL database with the unaccent
 * extension enabled. They insert test data via raw SQL, make HTTP requests,
 * and assert that unaccented search terms match accented values in the DB.
 *
 * Requires DATABASE_URL to point to a running PostgreSQL instance.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import express, { type Request, type Response, type NextFunction } from "express";
import { pool } from "@workspace/db";

// ---------------------------------------------------------------------------
// App factory
// ---------------------------------------------------------------------------

async function buildApp() {
  const { default: disponibilitesRouter } = await import("./disponibilites.js");
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    (req as any).log = { error: () => {}, warn: () => {}, info: () => {} };
    next();
  });
  app.use("/api", disponibilitesRouter);
  return app;
}

// ---------------------------------------------------------------------------
// Test fixtures — raw SQL to stay type-safe regardless of ORM schema drift
// ---------------------------------------------------------------------------

const TEST_NUMERO_MEMBRE = "TEST-UNACCENT-9999";
let producteurId: number;

beforeAll(async () => {
  // Ensure unaccent extension exists
  await pool.query("CREATE EXTENSION IF NOT EXISTS unaccent");

  // Producteur
  const pRes = await pool.query<{ id: number }>(
    `INSERT INTO producteurs
       (numero_membre, nom, prenoms, village, region, departement,
        cooperative_nom_libre, status, created_at, updated_at)
     VALUES ($1, 'TestNom', 'TestPrenoms', 'TestVillage', 'Lacs', 'Dimbokro',
             'Coopérative Durable', 'ACTIF', NOW(), NOW())
     RETURNING id`,
    [TEST_NUMERO_MEMBRE],
  );
  producteurId = pRes.rows[0].id;

  // Farm
  const fRes = await pool.query<{ id: number }>(
    `INSERT INTO farms (producteur_id, localite, created_at, updated_at)
     VALUES ($1, 'Ferme Test', NOW(), NOW()) RETURNING id`,
    [producteurId],
  );
  const farmId = fRes.rows[0].id;

  // Plot 1 → Hévéa
  const pl1Res = await pool.query<{ id: number }>(
    `INSERT INTO plots (farm_id, reference, created_at, updated_at)
     VALUES ($1, 'P-TEST-HEVEA', NOW(), NOW()) RETURNING id`,
    [farmId],
  );
  const plotHeveaId = pl1Res.rows[0].id;

  // Plot 2 → Maïs
  const pl2Res = await pool.query<{ id: number }>(
    `INSERT INTO plots (farm_id, reference, created_at, updated_at)
     VALUES ($1, 'P-TEST-MAIS', NOW(), NOW()) RETURNING id`,
    [farmId],
  );
  const plotMaisId = pl2Res.rows[0].id;

  // Production Hévéa
  await pool.query(
    `INSERT INTO productions
       (plot_id, culture, campagne, quantite_disponible, recherche_acheteur, created_at, updated_at)
     VALUES ($1, 'Hévéa', '2025', 500, 'OUI', NOW(), NOW())`,
    [plotHeveaId],
  );

  // Production Maïs
  await pool.query(
    `INSERT INTO productions
       (plot_id, culture, campagne, quantite_disponible, recherche_acheteur, created_at, updated_at)
     VALUES ($1, 'Maïs', '2025', 300, 'OUI', NOW(), NOW())`,
    [plotMaisId],
  );
});

afterAll(async () => {
  // Cascade delete cleans up farms, plots, productions
  if (producteurId) {
    await pool.query("DELETE FROM producteurs WHERE id = $1", [producteurId]);
  }
  await pool.end();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/disponibilites — real PostgreSQL accent-insensitive search", () => {
  it("finds Hévéa when searching with the unaccented term 'hevea'", async () => {
    const app = await buildApp();
    const res = await request(app)
      .get("/api/disponibilites")
      .query({ culture: "hevea" });

    expect(res.status).toBe(200);
    const cultures: string[] = res.body.map((r: { culture: string }) => r.culture);
    expect(cultures).toContain("Hévéa");
  });

  it("finds Maïs when searching with the unaccented term 'mais'", async () => {
    const app = await buildApp();
    const res = await request(app)
      .get("/api/disponibilites")
      .query({ culture: "mais" });

    expect(res.status).toBe(200);
    const cultures: string[] = res.body.map((r: { culture: string }) => r.culture);
    expect(cultures).toContain("Maïs");
  });

  it("finds Hévéa when searching with the partial unaccented term 'hev'", async () => {
    const app = await buildApp();
    const res = await request(app)
      .get("/api/disponibilites")
      .query({ culture: "hev" });

    expect(res.status).toBe(200);
    const cultures: string[] = res.body.map((r: { culture: string }) => r.culture);
    expect(cultures).toContain("Hévéa");
  });

  it("does not return Maïs when searching culture='hevea'", async () => {
    const app = await buildApp();
    const res = await request(app)
      .get("/api/disponibilites")
      .query({ culture: "hevea" });

    expect(res.status).toBe(200);
    const cultures: string[] = res.body.map((r: { culture: string }) => r.culture);
    expect(cultures).not.toContain("Maïs");
  });

  it("finds test producteur when searching region='lacs' (unaccented)", async () => {
    const app = await buildApp();
    const res = await request(app)
      .get("/api/disponibilites")
      .query({ region: "lacs" });

    expect(res.status).toBe(200);
    const ids: number[] = res.body.map((r: { producteur: { id: number } }) => r.producteur.id);
    expect(ids).toContain(producteurId);
  });

  it("finds test producteur when searching departement='dimbokro' (unaccented)", async () => {
    const app = await buildApp();
    const res = await request(app)
      .get("/api/disponibilites")
      .query({ departement: "dimbokro" });

    expect(res.status).toBe(200);
    const ids: number[] = res.body.map((r: { producteur: { id: number } }) => r.producteur.id);
    expect(ids).toContain(producteurId);
  });

  it("finds test producteur when searching cooperative='cooperative durable' (unaccented)", async () => {
    const app = await buildApp();
    const res = await request(app)
      .get("/api/disponibilites")
      .query({ cooperative: "cooperative durable" });

    expect(res.status).toBe(200);
    const ids: number[] = res.body.map((r: { producteur: { id: number } }) => r.producteur.id);
    expect(ids).toContain(producteurId);
  });
});
