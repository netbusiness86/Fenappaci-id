import { Router, type IRouter, type Request, type Response } from "express";
import { sql, gte } from "drizzle-orm";
import { db, producteursTable, cooperativesTable } from "@workspace/db";
import { GetDashboardStatsResponse } from "@workspace/api-zod";

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

  // Cultures (comma-separated field)
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

  const stats = {
    total_producteurs: total,
    producteurs_actifs: actifs,
    producteurs_cette_semaine: cette_semaine,
    cooperatives: nb_cooperatives,
    par_region: parRegionRows.map((r) => ({ label: r.region ?? "Non renseigné", count: r.count })),
    par_culture: parCulture,
    par_sexe: parSexeRows.map((r) => ({
      label: r.sexe === "M" ? "Hommes" : r.sexe === "F" ? "Femmes" : "Non renseigné",
      count: r.count,
    })),
    superficie_totale: superficie_totale ? parseFloat(String(superficie_totale)) : null,
  };

  res.json(GetDashboardStatsResponse.parse(stats));
});

export default router;
