import { Router, type Request, type Response } from "express";
import { eq, sql } from "drizzle-orm";
import { db, plotsTable, farmsTable, producteursTable, productionsTable, usersTable } from "@workspace/db";

const router = Router();

const PRIVILEGED_ROLES = ['DIRECTION', 'ADMIN'];

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

// ── Auth helpers ───────────────────────────────────────────────────────────────

/** Returns the authenticated userId or sends 401 and returns null. */
function requireSession(req: Request, res: Response): number | null {
  const userId = (req.session as any)?.userId as number | undefined;
  if (!userId) { res.status(401).json({ error: "Non authentifié" }); return null; }
  return userId;
}

/**
 * Fetches the producteur that owns the given plot (via plot → farm → producteur).
 * Returns null and sends 404 if the chain is broken.
 */
async function getProducteurForPlot(plotId: number, req: Request, res: Response): Promise<{ agent_id: number | null; producteur_id: number } | null> {
  const [row] = await db
    .select({ agent_id: producteursTable.agent_id, producteur_id: producteursTable.id })
    .from(plotsTable)
    .innerJoin(farmsTable, eq(plotsTable.farm_id, farmsTable.id))
    .innerJoin(producteursTable, eq(farmsTable.producteur_id, producteursTable.id))
    .where(eq(plotsTable.id, plotId));

  if (!row) { res.status(404).json({ error: "Parcelle ou producteur non trouvé" }); return null; }
  return row;
}

/**
 * Fetches the producteur that owns the given production (via production → plot → farm → producteur).
 * Returns null and sends 404 if not found.
 */
async function getProducteurForProduction(productionId: number, req: Request, res: Response): Promise<{ agent_id: number | null; producteur_id: number } | null> {
  const [row] = await db
    .select({ agent_id: producteursTable.agent_id, producteur_id: producteursTable.id })
    .from(productionsTable)
    .innerJoin(plotsTable, eq(productionsTable.plot_id, plotsTable.id))
    .innerJoin(farmsTable, eq(plotsTable.farm_id, farmsTable.id))
    .innerJoin(producteursTable, eq(farmsTable.producteur_id, producteursTable.id))
    .where(eq(productionsTable.id, productionId));

  if (!row) { res.status(404).json({ error: "Production non trouvée" }); return null; }
  return row;
}

/**
 * Checks that the caller is allowed to mutate the given producer's record.
 * Privileged roles (DIRECTION, ADMIN) can always mutate.
 * Non-privileged users (AGENT, etc.) may only mutate producers where
 * agent_id matches their own userId. Legacy producers with agent_id = null
 * are explicitly denied to non-privileged users pending a formal policy review
 * (see task: "Decide and test whether legacy producers should be editable by anyone").
 * Returns true on success; sends 403 and returns false on denial.
 */
async function canMutate(userId: number, agentId: number | null, res: Response): Promise<boolean> {
  const [user] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { res.status(403).json({ error: "Utilisateur inconnu" }); return false; }
  if (PRIVILEGED_ROLES.includes(user.role)) return true;
  // Non-privileged users: must own the producer (exact match required).
  // Legacy producers (agent_id === null) are not editable by non-privileged users.
  if (agentId === null || agentId !== userId) {
    res.status(403).json({ error: "Accès refusé : vous ne pouvez pas modifier ce dossier." });
    return false;
  }
  return true;
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /plots/:id/productions  (read — no auth required)
router.get("/plots/:id/productions", async (req: Request, res: Response): Promise<void> => {
  const plotId = int(req.params.id);
  if (plotId == null) { res.status(400).json({ error: "ID invalide" }); return; }
  const rows = await db.select().from(productionsTable).where(eq(productionsTable.plot_id, plotId));
  res.json(rows.map(sp));
});

// POST /plots/:id/productions  (write — requires auth + ownership)
router.post("/plots/:id/productions", async (req: Request, res: Response): Promise<void> => {
  const plotId = int(req.params.id);
  if (plotId == null) { res.status(400).json({ error: "ID invalide" }); return; }

  const userId = requireSession(req, res);
  if (userId == null) return;

  const owner = await getProducteurForPlot(plotId, req, res);
  if (!owner) return;

  const allowed = await canMutate(userId, owner.agent_id, res);
  if (!allowed) return;

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

// PATCH /productions/:id  (write — requires auth + ownership)
router.patch("/productions/:id", async (req: Request, res: Response): Promise<void> => {
  const id = int(req.params.id);
  if (id == null) { res.status(400).json({ error: "ID invalide" }); return; }

  const userId = requireSession(req, res);
  if (userId == null) return;

  const owner = await getProducteurForProduction(id, req, res);
  if (!owner) return;

  const allowed = await canMutate(userId, owner.agent_id, res);
  if (!allowed) return;

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

// DELETE /productions/:id  (write — requires auth + ownership)
router.delete("/productions/:id", async (req: Request, res: Response): Promise<void> => {
  const id = int(req.params.id);
  if (id == null) { res.status(400).json({ error: "ID invalide" }); return; }

  const userId = requireSession(req, res);
  if (userId == null) return;

  const owner = await getProducteurForProduction(id, req, res);
  if (!owner) return;

  const allowed = await canMutate(userId, owner.agent_id, res);
  if (!allowed) return;

  await db.delete(productionsTable).where(eq(productionsTable.id, id));
  res.status(204).send();
});

export default router;
