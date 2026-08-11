import { Router, type IRouter, type Request, type Response } from "express";
import { eq, sql, desc, ilike, and, isNotNull } from "drizzle-orm";
import { db, cooperativesTable, producteursTable, farmsTable, plotsTable, productionsTable } from "@workspace/db";
import {
  ListCooperativesResponse,
  GetCooperativeResponse,
  GetCooperativeMembresResponse,
  GetCooperativeStatsResponse,
  CreateCooperativeBody,
  UpdateCooperativeBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

// ── helpers ─────────────────────────────────────────────────────────────────
function requireAuth(req: Request, res: Response): number | null {
  const session = req.session as any;
  if (!session?.userId) { res.status(401).json({ error: "Non authentifié" }); return null; }
  return session.userId as number;
}

async function memberCount(id: number): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(producteursTable)
    .where(eq(producteursTable.cooperative_id, id));
  return row?.count ?? 0;
}

// ── GET /cooperatives ────────────────────────────────────────────────────────
router.get("/cooperatives", async (req: Request, res: Response): Promise<void> => {
  const { search, region } = req.query as Record<string, string>;
  const session = req.session as any;
  const sessionUserId = session?.userId as number | undefined;
  const sessionRole = session?.role as string | undefined;

  const conditions = [];
  if (search) conditions.push(ilike(cooperativesTable.nom, `%${search}%`));
  if (region) conditions.push(ilike(cooperativesTable.region, `%${region}%`));

  // AGENT : restreindre aux coopératives contenant au moins un de ses producteurs
  if (sessionRole === 'AGENT' && sessionUserId) {
    const agentCoopRows = await db
      .selectDistinct({ cooperative_id: producteursTable.cooperative_id })
      .from(producteursTable)
      .where(and(eq(producteursTable.agent_id, sessionUserId), isNotNull(producteursTable.cooperative_id)));
    const agentCoopIds = agentCoopRows.map((r) => r.cooperative_id).filter((id): id is number => id != null);
    if (agentCoopIds.length === 0) {
      res.json(ListCooperativesResponse.parse([]));
      return;
    }
    conditions.push(sql`${cooperativesTable.id} = ANY(ARRAY[${sql.join(agentCoopIds.map((id) => sql`${id}`), sql`, `)}]::int[])`);
  }

  const rows = await db
    .select()
    .from(cooperativesTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(cooperativesTable.nom);

  // Pour les AGENT : compte uniquement leurs propres membres dans chaque coopérative
  let countMap: Map<number | null, number>;
  if (sessionRole === 'AGENT' && sessionUserId) {
    const counts = await db
      .select({ cooperative_id: producteursTable.cooperative_id, count: sql<number>`count(*)::int` })
      .from(producteursTable)
      .where(and(isNotNull(producteursTable.cooperative_id), eq(producteursTable.agent_id, sessionUserId)))
      .groupBy(producteursTable.cooperative_id);
    countMap = new Map(counts.map((c) => [c.cooperative_id, c.count]));
  } else {
    const counts = await db
      .select({ cooperative_id: producteursTable.cooperative_id, count: sql<number>`count(*)::int` })
      .from(producteursTable)
      .where(isNotNull(producteursTable.cooperative_id))
      .groupBy(producteursTable.cooperative_id);
    countMap = new Map(counts.map((c) => [c.cooperative_id, c.count]));
  }

  const result = rows.map((c) => ({
    id: c.id,
    nom: c.nom,
    region: c.region ?? null,
    departement: c.departement ?? null,
    nombre_membres: countMap.get(c.id) ?? 0,
    created_at: c.created_at.toISOString(),
  }));

  res.json(ListCooperativesResponse.parse(result));
});

// ── POST /cooperatives ───────────────────────────────────────────────────────
router.post("/cooperatives", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;

  const parsed = CreateCooperativeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }
  const data = parsed.data;

  const [created] = await db
    .insert(cooperativesTable)
    .values({
      nom: data.nom,
      sigle: data.sigle ?? null,
      numero_identification: data.numero_identification ?? null,
      date_creation: data.date_creation ?? null,
      telephone: data.telephone ?? null,
      email: data.email ?? null,
      adresse: data.adresse ?? null,
      region: data.region ?? null,
      departement: data.departement ?? null,
      sous_prefecture: data.sous_prefecture ?? null,
      village: data.village ?? null,
      president: data.president ?? null,
      vice_president: data.vice_president ?? null,
      secretaire: data.secretaire ?? null,
      tresorier: data.tresorier ?? null,
    })
    .returning();

  res.status(201).json(
    GetCooperativeResponse.parse({
      ...created,
      nombre_membres: 0,
      created_at: created.created_at.toISOString(),
      updated_at: created.updated_at.toISOString(),
    })
  );
});

// ── GET /cooperatives/:id ────────────────────────────────────────────────────
router.get("/cooperatives/:id", async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID invalide" }); return; }

  // AGENT : vérifier qu'il a au moins un producteur dans cette coopérative
  const session = req.session as any;
  const sessionUserId = session?.userId as number | undefined;
  const sessionRole = session?.role as string | undefined;
  if (sessionRole === 'AGENT' && sessionUserId) {
    const [check] = await db
      .select({ id: producteursTable.id })
      .from(producteursTable)
      .where(and(eq(producteursTable.cooperative_id, id), eq(producteursTable.agent_id, sessionUserId)))
      .limit(1);
    if (!check) {
      res.status(403).json({ error: "Accès refusé — aucun de vos producteurs n'appartient à cette coopérative." });
      return;
    }
  }

  const [coop] = await db.select().from(cooperativesTable).where(eq(cooperativesTable.id, id));
  if (!coop) { res.status(404).json({ error: "Coopérative introuvable" }); return; }

  const count = await memberCount(id);

  res.json(
    GetCooperativeResponse.parse({
      ...coop,
      nombre_membres: count,
      created_at: coop.created_at.toISOString(),
      updated_at: coop.updated_at.toISOString(),
    })
  );
});

// ── PATCH /cooperatives/:id ──────────────────────────────────────────────────
router.patch("/cooperatives/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID invalide" }); return; }

  const parsed = UpdateCooperativeBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.flatten() }); return; }

  const data = parsed.data;
  const updates: Record<string, unknown> = {};
  if (data.nom !== undefined) updates.nom = data.nom;
  if (data.sigle !== undefined) updates.sigle = data.sigle;
  if (data.numero_identification !== undefined) updates.numero_identification = data.numero_identification;
  if (data.date_creation !== undefined) updates.date_creation = data.date_creation;
  if (data.telephone !== undefined) updates.telephone = data.telephone;
  if (data.email !== undefined) updates.email = data.email;
  if (data.adresse !== undefined) updates.adresse = data.adresse;
  if (data.region !== undefined) updates.region = data.region;
  if (data.departement !== undefined) updates.departement = data.departement;
  if (data.sous_prefecture !== undefined) updates.sous_prefecture = data.sous_prefecture;
  if (data.village !== undefined) updates.village = data.village;
  if (data.president !== undefined) updates.president = data.president;
  if (data.vice_president !== undefined) updates.vice_president = data.vice_president;
  if (data.secretaire !== undefined) updates.secretaire = data.secretaire;
  if (data.tresorier !== undefined) updates.tresorier = data.tresorier;
  updates.updated_at = new Date();

  const [updated] = await db
    .update(cooperativesTable)
    .set(updates)
    .where(eq(cooperativesTable.id, id))
    .returning();

  if (!updated) { res.status(404).json({ error: "Coopérative introuvable" }); return; }

  const count = await memberCount(id);
  res.json(
    GetCooperativeResponse.parse({
      ...updated,
      nombre_membres: count,
      created_at: updated.created_at.toISOString(),
      updated_at: updated.updated_at.toISOString(),
    })
  );
});

// ── DELETE /cooperatives/:id ─────────────────────────────────────────────────
router.delete("/cooperatives/:id", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID invalide" }); return; }

  // Détacher les producteurs membres avant suppression
  await db
    .update(producteursTable)
    .set({ cooperative_id: null })
    .where(eq(producteursTable.cooperative_id, id));

  await db.delete(cooperativesTable).where(eq(cooperativesTable.id, id));
  res.status(204).send();
});

// ── GET /cooperatives/:id/membres ────────────────────────────────────────────
router.get("/cooperatives/:id/membres", async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID invalide" }); return; }

  const session2 = req.session as any;
  const sessionUserId2 = session2?.userId as number | undefined;
  const sessionRole2 = session2?.role as string | undefined;

  const membresConditions: any[] = [eq(producteursTable.cooperative_id, id)];
  // AGENT : ne voir que ses propres membres dans cette coopérative
  if (sessionRole2 === 'AGENT' && sessionUserId2) {
    membresConditions.push(eq(producteursTable.agent_id, sessionUserId2));
  }

  const membres = await db
    .select({
      id: producteursTable.id,
      numero_membre: producteursTable.numero_membre,
      nom: producteursTable.nom,
      prenoms: producteursTable.prenoms,
      sexe: producteursTable.sexe,
      telephone: producteursTable.telephone,
      region: producteursTable.region,
      village: producteursTable.village,
      status: producteursTable.status,
      cooperative_fonction: producteursTable.cooperative_fonction,
    })
    .from(producteursTable)
    .where(and(...membresConditions))
    .orderBy(producteursTable.nom);

  res.json(GetCooperativeMembresResponse.parse(membres));
});

// ── PUT /cooperatives/:id/membres/:producteurId ──────────────────────────────
router.put("/cooperatives/:id/membres/:producteurId", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const coopId = parseInt(req.params.id);
  const prodId = parseInt(req.params.producteurId);
  if (isNaN(coopId) || isNaN(prodId)) { res.status(400).json({ error: "ID invalide" }); return; }

  const [coop] = await db.select().from(cooperativesTable).where(eq(cooperativesTable.id, coopId));
  if (!coop) { res.status(404).json({ error: "Coopérative introuvable" }); return; }

  await db
    .update(producteursTable)
    .set({ cooperative_id: coopId, membre_cooperative: true })
    .where(eq(producteursTable.id, prodId));

  res.json({ success: true });
});

// ── DELETE /cooperatives/:id/membres/:producteurId ───────────────────────────
router.delete("/cooperatives/:id/membres/:producteurId", async (req: Request, res: Response): Promise<void> => {
  if (!requireAuth(req, res)) return;
  const coopId = parseInt(req.params.id);
  const prodId = parseInt(req.params.producteurId);
  if (isNaN(coopId) || isNaN(prodId)) { res.status(400).json({ error: "ID invalide" }); return; }

  await db
    .update(producteursTable)
    .set({ cooperative_id: null, membre_cooperative: false })
    .where(and(eq(producteursTable.id, prodId), eq(producteursTable.cooperative_id, coopId)));

  res.json({ success: true });
});

// ── GET /cooperatives/:id/stats ──────────────────────────────────────────────
router.get("/cooperatives/:id/stats", async (req: Request, res: Response): Promise<void> => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) { res.status(400).json({ error: "ID invalide" }); return; }

  // KPIs globaux — db.execute retourne { rows: [...] } en drizzle-orm/pg-core
  const kpiResult = await db.execute(sql`
    SELECT
      COUNT(DISTINCT p.id)::int                                                   AS nombre_producteurs,
      COUNT(DISTINCT p.id) FILTER (WHERE p.sexe = 'M')::int                      AS nombre_hommes,
      COUNT(DISTINCT p.id) FILTER (WHERE p.sexe = 'F')::int                      AS nombre_femmes,
      COUNT(DISTINCT f.id)::int                                                   AS nombre_exploitations,
      COUNT(DISTINCT pl.id)::int                                                  AS nombre_parcelles,
      COALESCE(SUM(CAST(f.superficie_ha AS numeric)), 0)::float                  AS superficie_totale,
      COALESCE(SUM(CAST(prod.production_annuelle_estimee AS numeric)), 0)::float  AS production_totale,
      COALESCE(SUM(CAST(prod.quantite_disponible AS numeric)), 0)::float          AS production_disponible
    FROM producteurs p
    LEFT JOIN farms f    ON f.producteur_id = p.id
    LEFT JOIN plots pl   ON pl.farm_id = f.id
    LEFT JOIN productions prod ON prod.plot_id = pl.id
    WHERE p.cooperative_id = ${id}
  `);

  // Répartition par culture
  const culturesResult = await db.execute(sql`
    SELECT
      COALESCE(prod.culture, pl.culture_principale, 'Non précisé') AS culture,
      COUNT(DISTINCT p.id)::int                                     AS count,
      COALESCE(SUM(CAST(pl.superficie AS numeric)), 0)::float       AS superficie,
      COALESCE(SUM(CAST(prod.production_annuelle_estimee AS numeric)), 0)::float AS production
    FROM producteurs p
    LEFT JOIN farms f    ON f.producteur_id = p.id
    LEFT JOIN plots pl   ON pl.farm_id = f.id
    LEFT JOIN productions prod ON prod.plot_id = pl.id
    WHERE p.cooperative_id = ${id}
      AND (pl.culture_principale IS NOT NULL OR prod.culture IS NOT NULL)
    GROUP BY 1
    ORDER BY production DESC
  `);

  // drizzle-orm pg returns QueryResult with .rows array
  const kpiRows = (kpiResult as any).rows ?? kpiResult;
  const culturesRows = (culturesResult as any).rows ?? culturesResult;
  const row = (Array.isArray(kpiRows) ? kpiRows[0] : kpiRows) ?? {};
  res.json(
    GetCooperativeStatsResponse.parse({
      nombre_producteurs: row.nombre_producteurs ?? 0,
      nombre_hommes: row.nombre_hommes ?? 0,
      nombre_femmes: row.nombre_femmes ?? 0,
      nombre_exploitations: row.nombre_exploitations ?? 0,
      nombre_parcelles: row.nombre_parcelles ?? 0,
      superficie_totale: parseFloat(row.superficie_totale ?? "0"),
      production_totale: parseFloat(row.production_totale ?? "0"),
      production_disponible: parseFloat(row.production_disponible ?? "0"),
      par_culture: (Array.isArray(culturesRows) ? culturesRows : []).map((c: any) => ({
        culture: c.culture,
        count: c.count,
        superficie: parseFloat(c.superficie ?? "0"),
        production: parseFloat(c.production ?? "0"),
      })),
    })
  );
});

export default router;
