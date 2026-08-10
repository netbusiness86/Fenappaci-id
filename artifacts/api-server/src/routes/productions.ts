import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, plotsTable, productionsTable } from "@workspace/db";

const router = Router();

function sp(r: typeof productionsTable.$inferSelect) {
  return {
    id: r.id, plot_id: r.plot_id,
    culture: r.culture, campagne: r.campagne,
    superficie_concernee: r.superficie_concernee != null ? Number(r.superficie_concernee) : null,
    production_annuelle_estimee: r.production_annuelle_estimee != null ? Number(r.production_annuelle_estimee) : null,
    production_campagne_en_cours: r.production_campagne_en_cours != null ? Number(r.production_campagne_en_cours) : null,
    quantite_disponible: r.quantite_disponible != null ? Number(r.quantite_disponible) : null,
    quantite_vente: r.quantite_vente != null ? Number(r.quantite_vente) : null,
    capacite_livraison: r.capacite_livraison != null ? Number(r.capacite_livraison) : null,
    unite: r.unite,
    periode_recolte: r.periode_recolte,
    periode_disponibilite: r.periode_disponibilite,
    recherche_acheteur: r.recherche_acheteur,
    quantite_recherchee: r.quantite_recherchee != null ? Number(r.quantite_recherchee) : null,
    prix_souhaite: r.prix_souhaite != null ? Number(r.prix_souhaite) : null,
    observations: r.observations,
    created_at: r.created_at, updated_at: r.updated_at,
  };
}

function num(v: unknown) { return v != null && v !== '' ? String(v) : null; }
function int(v: unknown) { return v != null && v !== '' ? parseInt(String(v)) : null; }

// GET /plots/:id/productions
router.get("/plots/:id/productions", async (req: Request, res: Response): Promise<void> => {
  const plotId = int(req.params.id);
  if (plotId == null) { res.status(400).json({ error: "ID invalide" }); return; }
  const rows = await db.select().from(productionsTable).where(eq(productionsTable.plot_id, plotId));
  res.json(rows.map(sp));
});

// POST /plots/:id/productions
router.post("/plots/:id/productions", async (req: Request, res: Response): Promise<void> => {
  const plotId = int(req.params.id);
  if (plotId == null) { res.status(400).json({ error: "ID invalide" }); return; }

  // Verify plot exists
  const [plot] = await db.select().from(plotsTable).where(eq(plotsTable.id, plotId));
  if (!plot) { res.status(404).json({ error: "Parcelle non trouvée" }); return; }

  const b = req.body ?? {};
  const [row] = await db.insert(productionsTable).values({
    plot_id: plotId,
    culture: b.culture ?? null,
    campagne: b.campagne ?? null,
    superficie_concernee: num(b.superficie_concernee),
    production_annuelle_estimee: num(b.production_annuelle_estimee),
    production_campagne_en_cours: num(b.production_campagne_en_cours),
    quantite_disponible: num(b.quantite_disponible),
    quantite_vente: num(b.quantite_vente),
    capacite_livraison: num(b.capacite_livraison),
    unite: b.unite ?? null,
    periode_recolte: b.periode_recolte ?? null,
    periode_disponibilite: b.periode_disponibilite ?? null,
    recherche_acheteur: b.recherche_acheteur ?? 'NON',
    quantite_recherchee: num(b.quantite_recherchee),
    prix_souhaite: num(b.prix_souhaite),
    observations: b.observations ?? null,
  }).returning();
  res.status(201).json(sp(row));
});

// PATCH /productions/:id
router.patch("/productions/:id", async (req: Request, res: Response): Promise<void> => {
  const id = int(req.params.id);
  if (id == null) { res.status(400).json({ error: "ID invalide" }); return; }

  const b = req.body ?? {};
  const u: Record<string, unknown> = { updated_at: new Date() };
  const fields = ['culture','campagne','unite','periode_recolte','periode_disponibilite','recherche_acheteur','observations'];
  const numFields = ['superficie_concernee','production_annuelle_estimee','production_campagne_en_cours','quantite_disponible','quantite_vente','capacite_livraison','quantite_recherchee','prix_souhaite'];
  for (const f of fields) if (b[f] !== undefined) u[f] = b[f];
  for (const f of numFields) if (b[f] !== undefined) u[f] = num(b[f]);

  const [updated] = await db.update(productionsTable).set(u as any).where(eq(productionsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Production non trouvée" }); return; }
  res.json(sp(updated));
});

// DELETE /productions/:id
router.delete("/productions/:id", async (req: Request, res: Response): Promise<void> => {
  const id = int(req.params.id);
  if (id == null) { res.status(400).json({ error: "ID invalide" }); return; }
  await db.delete(productionsTable).where(eq(productionsTable.id, id));
  res.status(204).send();
});

export default router;
