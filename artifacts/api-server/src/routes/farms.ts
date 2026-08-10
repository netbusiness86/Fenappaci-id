import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, farmsTable, plotsTable } from "@workspace/db";

const router = Router();

// ── Serialize ──────────────────────────────────────────────────────────────────
function sf(f: typeof farmsTable.$inferSelect) {
  return {
    id: f.id, producteur_id: f.producteur_id,
    nom: f.nom, localite: f.localite,
    superficie_ha: f.superficie_ha != null ? Number(f.superficie_ha) : null,
    statut_foncier: f.statut_foncier, annee_creation: f.annee_creation,
    latitude: f.latitude, longitude: f.longitude, observations: f.observations,
    created_at: f.created_at, updated_at: f.updated_at,
  };
}

function sp(p: typeof plotsTable.$inferSelect) {
  return {
    id: p.id, farm_id: p.farm_id, reference: p.reference,
    culture_principale: p.culture_principale,
    superficie: p.superficie != null ? Number(p.superficie) : null,
    annee_plantation: p.annee_plantation, age_plantation: p.age_plantation,
    etat: p.etat, latitude: p.latitude, longitude: p.longitude,
    created_at: p.created_at, updated_at: p.updated_at,
  };
}

// ── FARMS ──────────────────────────────────────────────────────────────────────

// GET /producteurs/:id/farms — liste avec parcelles
router.get("/producteurs/:id/farms", async (req: Request, res: Response): Promise<void> => {
  const producteurId = parseInt(req.params.id, 10);
  if (isNaN(producteurId)) { res.status(400).json({ error: "ID invalide" }); return; }

  const farms = await db.select().from(farmsTable).where(eq(farmsTable.producteur_id, producteurId));
  const allPlots = farms.length
    ? await db.select().from(plotsTable)
    : [];

  const byFarm = new Map<number, ReturnType<typeof sp>[]>();
  for (const p of allPlots) {
    if (!byFarm.has(p.farm_id)) byFarm.set(p.farm_id, []);
    byFarm.get(p.farm_id)!.push(sp(p));
  }

  res.json(farms.map(f => ({ ...sf(f), plots: byFarm.get(f.id) ?? [] })));
});

// POST /producteurs/:id/farms
router.post("/producteurs/:id/farms", async (req: Request, res: Response): Promise<void> => {
  const producteurId = parseInt(req.params.id, 10);
  if (isNaN(producteurId)) { res.status(400).json({ error: "ID invalide" }); return; }

  const b = req.body ?? {};
  const [farm] = await db.insert(farmsTable).values({
    producteur_id: producteurId,
    nom: b.nom ?? null,
    localite: b.localite ?? null,
    superficie_ha: b.superficie_ha != null ? String(b.superficie_ha) : null,
    statut_foncier: b.statut_foncier ?? null,
    annee_creation: b.annee_creation != null ? parseInt(b.annee_creation) : null,
    latitude: b.latitude ?? null,
    longitude: b.longitude ?? null,
    observations: b.observations ?? null,
  }).returning();

  res.status(201).json({ ...sf(farm), plots: [] });
});

// PATCH /farms/:id
router.patch("/farms/:id", async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID invalide" }); return; }

  const b = req.body ?? {};
  const u: Record<string, unknown> = { updated_at: new Date() };
  if (b.nom !== undefined)          u.nom = b.nom;
  if (b.localite !== undefined)     u.localite = b.localite;
  if (b.superficie_ha !== undefined) u.superficie_ha = String(b.superficie_ha);
  if (b.statut_foncier !== undefined) u.statut_foncier = b.statut_foncier;
  if (b.annee_creation !== undefined) u.annee_creation = b.annee_creation ? parseInt(b.annee_creation) : null;
  if (b.latitude !== undefined)     u.latitude = b.latitude;
  if (b.longitude !== undefined)    u.longitude = b.longitude;
  if (b.observations !== undefined) u.observations = b.observations;

  const [updated] = await db.update(farmsTable).set(u as any).where(eq(farmsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Exploitation non trouvée" }); return; }

  const plots = await db.select().from(plotsTable).where(eq(plotsTable.farm_id, id));
  res.json({ ...sf(updated), plots: plots.map(sp) });
});

// DELETE /farms/:id
router.delete("/farms/:id", async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID invalide" }); return; }
  await db.delete(farmsTable).where(eq(farmsTable.id, id));
  res.status(204).send();
});

// ── PLOTS ──────────────────────────────────────────────────────────────────────

// POST /farms/:id/plots
router.post("/farms/:id/plots", async (req: Request, res: Response): Promise<void> => {
  const farmId = parseInt(req.params.id, 10);
  if (isNaN(farmId)) { res.status(400).json({ error: "ID invalide" }); return; }

  const b = req.body ?? {};
  const [plot] = await db.insert(plotsTable).values({
    farm_id: farmId,
    reference: b.reference ?? null,
    culture_principale: b.culture_principale ?? null,
    superficie: b.superficie != null ? String(b.superficie) : null,
    annee_plantation: b.annee_plantation != null ? parseInt(b.annee_plantation) : null,
    age_plantation: b.age_plantation != null ? parseInt(b.age_plantation) : null,
    etat: b.etat ?? null,
    latitude: b.latitude ?? null,
    longitude: b.longitude ?? null,
  }).returning();

  res.status(201).json(sp(plot));
});

// PATCH /plots/:id
router.patch("/plots/:id", async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID invalide" }); return; }

  const b = req.body ?? {};
  const u: Record<string, unknown> = { updated_at: new Date() };
  if (b.reference !== undefined)         u.reference = b.reference;
  if (b.culture_principale !== undefined) u.culture_principale = b.culture_principale;
  if (b.superficie !== undefined)        u.superficie = String(b.superficie);
  if (b.annee_plantation !== undefined)  u.annee_plantation = b.annee_plantation ? parseInt(b.annee_plantation) : null;
  if (b.age_plantation !== undefined)    u.age_plantation = b.age_plantation ? parseInt(b.age_plantation) : null;
  if (b.etat !== undefined)              u.etat = b.etat;
  if (b.latitude !== undefined)          u.latitude = b.latitude;
  if (b.longitude !== undefined)         u.longitude = b.longitude;

  const [updated] = await db.update(plotsTable).set(u as any).where(eq(plotsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Parcelle non trouvée" }); return; }
  res.json(sp(updated));
});

// DELETE /plots/:id
router.delete("/plots/:id", async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID invalide" }); return; }
  await db.delete(plotsTable).where(eq(plotsTable.id, id));
  res.status(204).send();
});

export default router;
