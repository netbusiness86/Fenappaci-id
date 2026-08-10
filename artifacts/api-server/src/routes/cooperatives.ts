import { Router, type IRouter, type Request, type Response } from "express";
import { desc, sql } from "drizzle-orm";
import { db, cooperativesTable, producteursTable } from "@workspace/db";
import { ListCooperativesResponse } from "@workspace/api-zod";

const router: IRouter = Router();

// GET /cooperatives
router.get("/cooperatives", async (req: Request, res: Response): Promise<void> => {
  const rows = await db.select().from(cooperativesTable).orderBy(cooperativesTable.nom);

  // Count members per cooperative
  const counts = await db
    .select({
      cooperative_id: producteursTable.cooperative_id,
      count: sql<number>`count(*)::int`,
    })
    .from(producteursTable)
    .groupBy(producteursTable.cooperative_id);

  const countMap = new Map(counts.map((c) => [c.cooperative_id, c.count]));

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

export default router;
