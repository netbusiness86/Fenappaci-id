import { Router, type IRouter, type Request, type Response } from "express";
import { sql, gte, eq, desc, isNotNull } from "drizzle-orm";
import { db, producteursTable, cooperativesTable, farmsTable, plotsTable, productionsTable, usersTable } from "@workspace/db";

const router: IRouter = Router();

// GET /stats/dashboard
router.get("/stats/dashboard", async (req: Request, res: Response): Promise<void> => {
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(producteursTable);

  const [{ actifs }] = await db
    .select({ actifs: sql<number>`count(*)::int` })
    .from(producteursTable)
    .where(sql`${producteursTable.status} = 'ACTIF'`);

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const [{ cette_semaine }] = await db
    .select({ cette_semaine: sql<number>`count(*)::int` })
    .from(producteursTable)
    .where(gte(producteursTable.created_at, oneWeekAgo));

  const [{ nb_cooperatives }] = await db
    .select({ nb_cooperatives: sql<number>`count(*)::int` })
    .from(cooperativesTable);

  // Exploitations & parcelles & productions
  const [{ nb_exploitations }] = await db
    .select({ nb_exploitations: sql<number>`count(*)::int` })
    .from(farmsTable);

  const [{ nb_parcelles }] = await db
    .select({ nb_parcelles: sql<number>`count(*)::int` })
    .from(plotsTable);

  const [{ production_totale }] = await db
    .select({ production_totale: sql<number | null>`coalesce(sum(${productionsTable.production_campagne_en_cours}::numeric),0)` })
    .from(productionsTable);

  const [{ quantite_vente_totale }] = await db
    .select({ quantite_vente_totale: sql<number | null>`coalesce(sum(${productionsTable.quantite_vente}::numeric),0)` })
    .from(productionsTable);

  const parRegionRows = await db
    .select({ region: producteursTable.region, count: sql<number>`count(*)::int` })
    .from(producteursTable)
    .where(sql`${producteursTable.region} IS NOT NULL`)
    .groupBy(producteursTable.region)
    .orderBy(sql`count(*) DESC`)
    .limit(8);

  const parSexeRows = await db
    .select({ sexe: producteursTable.sexe, count: sql<number>`count(*)::int` })
    .from(producteursTable)
    .groupBy(producteursTable.sexe)
    .orderBy(sql`count(*) DESC`);

  const [{ superficie_totale }] = await db
    .select({ superficie_totale: sql<number | null>`sum(${producteursTable.superficie_ha}::numeric)` })
    .from(producteursTable);

  const allFarmers = await db.select({ cultures: producteursTable.cultures }).from(producteursTable);
  const cultureCount: Record<string, number> = {};
  for (const f of allFarmers) {
    if (f.cultures) {
      for (const c of f.cultures.split(",").map((s) => s.trim()).filter(Boolean)) {
        cultureCount[c] = (cultureCount[c] || 0) + 1;
      }
    }
  }
  const parCulture = Object.entries(cultureCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, count]) => ({ label, count }));

  res.json({
    total_producteurs: total,
    producteurs_actifs: actifs,
    producteurs_cette_semaine: cette_semaine,
    cooperatives: nb_cooperatives,
    nb_exploitations: nb_exploitations,
    nb_parcelles: nb_parcelles,
    production_totale: production_totale ? Number(production_totale) : 0,
    quantite_vente_totale: quantite_vente_totale ? Number(quantite_vente_totale) : 0,
    par_region: parRegionRows.map((r) => ({ label: r.region ?? "Non renseigné", count: r.count })),
    par_culture: parCulture,
    par_sexe: parSexeRows.map((r) => ({
      label: r.sexe === "M" ? "Hommes" : r.sexe === "F" ? "Femmes" : "Non renseigné",
      count: r.count,
    })),
    superficie_totale: superficie_totale ? parseFloat(String(superficie_totale)) : null,
  });
});

// ── GET /stats/national — ADMIN / DIRECTION only ────────────────────────────
router.get("/stats/national", async (req: Request, res: Response): Promise<void> => {
  if (!req.session?.userId) { res.status(401).json({ error: "Non authentifié" }); return; }
  const [me] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, req.session.userId));
  if (!me || !["ADMIN", "DIRECTION"].includes(me.role)) { res.status(403).json({ error: "Accès interdit" }); return; }

  // ── KPIs globaux ────────────────────────────────────────────────────────────
  const [{ total_producteurs }] = await db.select({ total_producteurs: sql<number>`count(*)::int` }).from(producteursTable);
  const [{ total_cooperatives }] = await db.select({ total_cooperatives: sql<number>`count(*)::int` }).from(cooperativesTable);
  const [{ total_exploitations }] = await db.select({ total_exploitations: sql<number>`count(*)::int` }).from(farmsTable);
  const [{ total_parcelles }] = await db.select({ total_parcelles: sql<number>`count(*)::int` }).from(plotsTable);
  const [{ total_agents }] = await db.select({ total_agents: sql<number>`count(*)::int` }).from(usersTable).where(sql`${usersTable.role} = 'AGENT'`);
  const [{ superficie_totale }] = await db.select({ superficie_totale: sql<number>`coalesce(sum(${producteursTable.superficie_ha}::numeric),0)::float` }).from(producteursTable);
  const [{ production_totale }] = await db.select({ production_totale: sql<number>`coalesce(sum(${productionsTable.production_campagne_en_cours}::numeric),0)::float` }).from(productionsTable);
  const [{ production_disponible }] = await db.select({ production_disponible: sql<number>`coalesce(sum(${productionsTable.quantite_vente}::numeric),0)::float` }).from(productionsTable);

  // ── Répartition par région ───────────────────────────────────────────────
  const prodParRegion = await db
    .select({ region: producteursTable.region, count: sql<number>`count(*)::int` })
    .from(producteursTable).where(sql`${producteursTable.region} IS NOT NULL`)
    .groupBy(producteursTable.region).orderBy(sql`count(*) DESC`);

  const coopParRegion = await db
    .select({ region: cooperativesTable.region, count: sql<number>`count(*)::int` })
    .from(cooperativesTable).where(sql`${cooperativesTable.region} IS NOT NULL`)
    .groupBy(cooperativesTable.region).orderBy(sql`count(*) DESC`);

  const exploParRegionResult = await db.execute(sql`
    SELECT p.region, count(f.id)::int AS count
    FROM farms f JOIN producteurs p ON p.id = f.producteur_id
    WHERE p.region IS NOT NULL
    GROUP BY p.region ORDER BY count DESC
  `);
  const exploParRegion = ((exploParRegionResult as any).rows ?? exploParRegionResult) as { region: string; count: number }[];

  // ── Répartition par filière ──────────────────────────────────────────────
  const filiereResult = await db.execute(sql`
    SELECT
      COALESCE(prod.culture, pl.culture_principale, 'Autres') AS culture,
      COUNT(DISTINCT p.id)::int                                AS nombre_producteurs,
      COALESCE(SUM(CAST(pl.superficie AS numeric)), 0)::float  AS superficie_totale,
      COALESCE(SUM(CAST(prod.production_campagne_en_cours AS numeric)), 0)::float AS production_estimee,
      COALESCE(SUM(CAST(prod.quantite_vente AS numeric)), 0)::float               AS production_disponible
    FROM producteurs p
    LEFT JOIN farms f    ON f.producteur_id = p.id
    LEFT JOIN plots pl   ON pl.farm_id = f.id
    LEFT JOIN productions prod ON prod.plot_id = pl.id
    WHERE pl.culture_principale IS NOT NULL OR prod.culture IS NOT NULL
    GROUP BY 1 ORDER BY nombre_producteurs DESC
  `);
  const parFiliere = ((filiereResult as any).rows ?? filiereResult) as {
    culture: string; nombre_producteurs: number;
    superficie_totale: number; production_estimee: number; production_disponible: number;
  }[];

  // ── Répartition par sexe ─────────────────────────────────────────────────
  const parSexe = await db
    .select({ sexe: producteursTable.sexe, count: sql<number>`count(*)::int` })
    .from(producteursTable).groupBy(producteursTable.sexe).orderBy(sql`count(*) DESC`);

  res.json({
    kpis: { total_producteurs, total_cooperatives, total_exploitations, total_parcelles, total_agents, superficie_totale, production_totale, production_disponible },
    par_region: {
      producteurs: prodParRegion.map(r => ({ region: r.region ?? "", count: r.count })),
      cooperatives: coopParRegion.map(r => ({ region: r.region ?? "", count: r.count })),
      exploitations: exploParRegion.map(r => ({ region: r.region, count: r.count })),
    },
    par_filiere: parFiliere,
    par_sexe: parSexe.map(r => ({ label: r.sexe === "M" ? "Hommes" : r.sexe === "F" ? "Femmes" : "N/R", count: r.count })),
  });
});

// ── GET /stats/map — producteurs + exploitations géolocalisés ────────────────
router.get("/stats/map", async (req: Request, res: Response): Promise<void> => {
  if (!req.session?.userId) { res.status(401).json({ error: "Non authentifié" }); return; }
  const [me] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, req.session.userId));
  if (!me || !["ADMIN", "DIRECTION"].includes(me.role)) { res.status(403).json({ error: "Accès interdit" }); return; }

  const producteurs = await db
    .select({
      id: producteursTable.id, nom: producteursTable.nom, prenoms: producteursTable.prenoms,
      numero_membre: producteursTable.numero_membre, telephone: producteursTable.telephone,
      village: producteursTable.village, cultures: producteursTable.cultures,
      region: producteursTable.region,
      lat: producteursTable.latitude, lng: producteursTable.longitude,
    })
    .from(producteursTable)
    .where(sql`${producteursTable.latitude} IS NOT NULL AND ${producteursTable.longitude} IS NOT NULL`)
    .limit(500);

  const farms = await db.execute(sql`
    SELECT f.id, f.nom AS nom_exploitation, f.latitude AS lat, f.longitude AS lng,
           p.nom AS producteur_nom, p.prenoms, p.numero_membre
    FROM farms f JOIN producteurs p ON p.id = f.producteur_id
    WHERE f.latitude IS NOT NULL AND f.longitude IS NOT NULL LIMIT 200
  `);

  res.json({
    producteurs: producteurs.map(p => ({ ...p, lat: p.lat ? parseFloat(String(p.lat)) : null, lng: p.lng ? parseFloat(String(p.lng)) : null })),
    farms: ((farms as any).rows ?? farms),
  });
});

// ── GET /exports/:type — CSV exports ─────────────────────────────────────────
router.get("/exports/:type", async (req: Request, res: Response): Promise<void> => {
  if (!req.session?.userId) { res.status(401).json({ error: "Non authentifié" }); return; }
  const [me] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, req.session.userId));
  if (!me || !["ADMIN", "DIRECTION"].includes(me.role)) { res.status(403).json({ error: "Accès interdit" }); return; }

  const { type } = req.params;

  if (type === "producteurs") {
    const rows = await db.select({
      id: producteursTable.id, nom: producteursTable.nom, prenoms: producteursTable.prenoms,
      numero_membre: producteursTable.numero_membre, sexe: producteursTable.sexe,
      telephone: producteursTable.telephone, region: producteursTable.region,
      departement: producteursTable.departement, village: producteursTable.village,
      cultures: producteursTable.cultures, status: producteursTable.status,
      superficie_ha: producteursTable.superficie_ha,
    }).from(producteursTable).orderBy(producteursTable.nom);
    const header = "ID,Nom,Prénoms,Numéro,Sexe,Téléphone,Région,Département,Village,Cultures,Statut,Superficie (ha)\n";
    const body = rows.map(r =>
      [r.id, r.nom, r.prenoms, r.numero_membre, r.sexe, r.telephone, r.region, r.departement, r.village, r.cultures, r.status, r.superficie_ha]
        .map(v => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",")
    ).join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="producteurs-${new Date().toISOString().slice(0,10)}.csv"`);
    res.send("\uFEFF" + header + body); return;
  }

  if (type === "cooperatives") {
    const rows = await db.select().from(cooperativesTable).orderBy(cooperativesTable.nom);
    const header = "ID,Nom,Sigle,N° Identification,Région,Département,Président,Membres,Date création\n";
    const body = rows.map((r: any) =>
      [r.id, r.nom, r.sigle, r.numero_identification, r.region, r.departement, r.president, r.nombre_membres, r.date_creation]
        .map(v => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",")
    ).join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="cooperatives-${new Date().toISOString().slice(0,10)}.csv"`);
    res.send("\uFEFF" + header + body); return;
  }

  if (type === "productions") {
    const result = await db.execute(sql`
      SELECT prod.id, p.nom, p.prenoms, p.numero_membre, p.region, pl.culture_principale AS culture,
             pl.superficie, prod.culture AS culture_prod,
             prod.production_campagne_en_cours AS production, prod.quantite_vente AS disponible
      FROM productions prod
      JOIN plots pl ON pl.id = prod.plot_id
      JOIN farms f ON f.id = pl.farm_id
      JOIN producteurs p ON p.id = f.producteur_id
      ORDER BY p.nom
    `);
    const prodRows = ((result as any).rows ?? result) as any[];
    const header = "ID,Nom,Prénoms,Numéro,Région,Culture,Superficie (ha),Production (T),Disponible (T)\n";
    const body = prodRows.map(r =>
      [r.id, r.nom, r.prenoms, r.numero_membre, r.region, r.culture || r.culture_prod, r.superficie, r.production, r.disponible]
        .map(v => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",")
    ).join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="productions-${new Date().toISOString().slice(0,10)}.csv"`);
    res.send("\uFEFF" + header + body); return;
  }

  res.status(404).json({ error: "Type d'export inconnu" });
});

// ── helpers ──────────────────────────────────────────────────────────────────

async function requirePrivileged(req: Request, res: Response): Promise<boolean> {
  const session = req.session as any;
  if (!session?.userId) { res.status(401).json({ error: "Non authentifié" }); return false; }
  const [me] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, session.userId));
  if (!me || !["ADMIN", "DIRECTION"].includes(me.role)) { res.status(403).json({ error: "Accès interdit" }); return false; }
  return true;
}

// GET /admin/database/producteurs ─────────────────────────────────────────────
router.get("/admin/database/producteurs", async (req: Request, res: Response): Promise<void> => {
  if (!(await requirePrivileged(req, res))) return;

  const rows = await db.select().from(producteursTable).orderBy(desc(producteursTable.created_at));

  const coops = await db.select({ id: cooperativesTable.id, nom: cooperativesTable.nom }).from(cooperativesTable);
  const coopMap = new Map(coops.map((c) => [c.id, c.nom]));

  const agents = await db
    .select({ id: usersTable.id, nom: usersTable.nom, prenoms: usersTable.prenoms })
    .from(usersTable);
  const agentMap = new Map(agents.map((a) => [a.id, `${a.prenoms ?? ""} ${a.nom ?? ""}`.trim()]));

  const result = rows.map((p) => ({
    id: p.id,
    numero_membre: p.numero_membre,
    nom: p.nom,
    prenoms: p.prenoms,
    sexe: p.sexe ?? null,
    date_naissance: p.date_naissance ?? null,
    telephone: p.telephone ?? null,
    telephone_secondaire: (p as any).telephone_secondaire ?? null,
    region: p.region ?? null,
    departement: p.departement ?? null,
    sous_prefecture: (p as any).sous_prefecture ?? null,
    village: p.village ?? null,
    cooperative_nom: p.cooperative_id ? (coopMap.get(p.cooperative_id) ?? null) : null,
    cooperative_fonction: (p as any).cooperative_fonction ?? null,
    cultures: p.cultures ?? null,
    superficie_ha: p.superficie_ha ? parseFloat(p.superficie_ha as string) : null,
    status: p.status ?? "ACTIF",
    agent_nom: p.agent_id ? (agentMap.get(p.agent_id) ?? null) : null,
    created_at: p.created_at.toISOString(),
  }));

  res.json(result);
});

// GET /admin/database/cooperatives ────────────────────────────────────────────
router.get("/admin/database/cooperatives", async (req: Request, res: Response): Promise<void> => {
  if (!(await requirePrivileged(req, res))) return;

  const rows = await db.select().from(cooperativesTable).orderBy(cooperativesTable.nom);

  const counts = await db
    .select({ cooperative_id: producteursTable.cooperative_id, count: sql<number>`count(*)::int` })
    .from(producteursTable)
    .where(isNotNull(producteursTable.cooperative_id))
    .groupBy(producteursTable.cooperative_id);
  const countMap = new Map(counts.map((c) => [c.cooperative_id, c.count]));

  const prodResult = await db.execute(sql`
    SELECT p.cooperative_id,
           COALESCE(SUM(pr.production_campagne_en_cours::numeric), 0)::float AS production_totale,
           COALESCE(SUM(pr.quantite_disponible::numeric), 0)::float AS quantite_disponible
    FROM producteurs p
    JOIN farms f ON f.producteur_id = p.id
    JOIN plots pl ON pl.farm_id = f.id
    JOIN productions pr ON pr.plot_id = pl.id
    WHERE p.cooperative_id IS NOT NULL
    GROUP BY p.cooperative_id
  `);
  const prodRows = ((prodResult as any).rows ?? prodResult) as any[];
  const prodMap = new Map(prodRows.map((r) => [Number(r.cooperative_id), { prod: Number(r.production_totale), dispo: Number(r.quantite_disponible) }]));

  const result = rows.map((c) => ({
    id: c.id,
    nom: c.nom,
    sigle: c.sigle ?? null,
    numero_identification: c.numero_identification ?? null,
    region: c.region ?? null,
    departement: c.departement ?? null,
    sous_prefecture: c.sous_prefecture ?? null,
    village: c.village ?? null,
    president: c.president ?? null,
    vice_president: c.vice_president ?? null,
    secretaire: c.secretaire ?? null,
    tresorier: c.tresorier ?? null,
    telephone: c.telephone ?? null,
    email: c.email ?? null,
    date_creation: c.date_creation ?? null,
    nombre_membres: countMap.get(c.id) ?? 0,
    production_totale: prodMap.get(c.id)?.prod ?? 0,
    quantite_disponible: prodMap.get(c.id)?.dispo ?? 0,
    created_at: c.created_at.toISOString(),
  }));

  res.json(result);
});

export default router;
