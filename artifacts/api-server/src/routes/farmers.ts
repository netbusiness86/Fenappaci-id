import { Router, type IRouter, type Request, type Response } from "express";
import { eq, ilike, or, sql, desc } from "drizzle-orm";
import { db, farmersTable } from "@workspace/db";
import {
  ListFarmersQueryParams,
  CreateFarmerBody,
  GetFarmerParams,
  UpdateFarmerBody,
  UpdateFarmerParams,
  DeleteFarmerParams,
  ListFarmersResponse,
  CreateFarmerResponse,
  GetFarmerResponse,
  UpdateFarmerResponse,
  GetFarmerStatsResponse,
  GetRecentFarmersQueryParams,
  GetRecentFarmersResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function generateNumeroMembre(id: number): string {
  const year = new Date().getFullYear();
  const padded = String(id).padStart(5, "0");
  return `FENA-${year}-${padded}`;
}

function serializeFarmer(farmer: typeof farmersTable.$inferSelect) {
  return {
    ...farmer,
    superficie_ha: farmer.superficie_ha ? parseFloat(farmer.superficie_ha) : null,
    created_at: farmer.created_at.toISOString(),
    updated_at: farmer.updated_at.toISOString(),
  };
}

// GET /farmers
router.get("/farmers", async (req: Request, res: Response): Promise<void> => {
  const parsed = ListFarmersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { search, groupement, culture, region, sexe } = parsed.data;

  const conditions = [];

  if (search) {
    conditions.push(
      or(
        ilike(farmersTable.nom, `%${search}%`),
        ilike(farmersTable.prenoms, `%${search}%`),
        ilike(farmersTable.cin, `%${search}%`),
        ilike(farmersTable.numero_membre, `%${search}%`),
      )!,
    );
  }
  if (groupement) conditions.push(ilike(farmersTable.groupement, `%${groupement}%`));
  if (culture) conditions.push(ilike(farmersTable.cultures, `%${culture}%`));
  if (region) conditions.push(ilike(farmersTable.region, `%${region}%`));
  if (sexe) conditions.push(eq(farmersTable.sexe, sexe));

  const rows = conditions.length
    ? await db.select().from(farmersTable).where(sql`${conditions.reduce((a, b) => sql`${a} AND ${b}`)}`)
    : await db.select().from(farmersTable).orderBy(desc(farmersTable.created_at));

  res.json(ListFarmersResponse.parse(rows.map(serializeFarmer)));
});

// POST /farmers
router.post("/farmers", async (req: Request, res: Response): Promise<void> => {
  const parsed = CreateFarmerBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;

  // Insert without numero_membre first to get the id
  const [inserted] = await db
    .insert(farmersTable)
    .values({
      ...data,
      superficie_ha: data.superficie_ha ? String(data.superficie_ha) : null,
      numero_membre: "TEMP",
    })
    .returning();

  // Update with generated numero_membre
  const numero_membre = generateNumeroMembre(inserted.id);
  const [updated] = await db
    .update(farmersTable)
    .set({ numero_membre })
    .where(eq(farmersTable.id, inserted.id))
    .returning();

  res.status(201).json(CreateFarmerResponse.parse(serializeFarmer(updated)));
});

// GET /farmers/stats
router.get("/farmers/stats", async (req: Request, res: Response): Promise<void> => {
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(farmersTable);

  const parSexeRows = await db
    .select({ label: farmersTable.sexe, count: sql<number>`count(*)::int` })
    .from(farmersTable)
    .groupBy(farmersTable.sexe);

  const parGroupementRows = await db
    .select({ label: farmersTable.groupement, count: sql<number>`count(*)::int` })
    .from(farmersTable)
    .where(sql`${farmersTable.groupement} IS NOT NULL AND ${farmersTable.groupement} != ''`)
    .groupBy(farmersTable.groupement)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  const parRegionRows = await db
    .select({ label: farmersTable.region, count: sql<number>`count(*)::int` })
    .from(farmersTable)
    .where(sql`${farmersTable.region} IS NOT NULL AND ${farmersTable.region} != ''`)
    .groupBy(farmersTable.region)
    .orderBy(desc(sql`count(*)`))
    .limit(10);

  // For cultures, we need to handle the comma-separated field
  const allFarmers = await db.select({ cultures: farmersTable.cultures }).from(farmersTable);
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
    .slice(0, 10)
    .map(([label, count]) => ({ label, count }));

  const [{ superficie_totale }] = await db
    .select({ superficie_totale: sql<number | null>`sum(${farmersTable.superficie_ha}::numeric)` })
    .from(farmersTable);

  const stats = {
    total,
    par_sexe: parSexeRows.map((r) => ({ label: r.label ?? "Non renseigné", count: r.count })),
    par_culture: parCulture,
    par_region: parRegionRows.map((r) => ({ label: r.label ?? "Non renseigné", count: r.count })),
    par_groupement: parGroupementRows.map((r) => ({ label: r.label ?? "Non renseigné", count: r.count })),
    superficie_totale: superficie_totale ? parseFloat(String(superficie_totale)) : null,
  };

  res.json(GetFarmerStatsResponse.parse(stats));
});

// GET /farmers/recent
router.get("/farmers/recent", async (req: Request, res: Response): Promise<void> => {
  const parsed = GetRecentFarmersQueryParams.safeParse(req.query);
  const limit = parsed.success && parsed.data.limit ? Math.min(Number(parsed.data.limit), 50) : 10;

  const rows = await db
    .select()
    .from(farmersTable)
    .orderBy(desc(farmersTable.created_at))
    .limit(limit);

  res.json(GetRecentFarmersResponse.parse(rows.map(serializeFarmer)));
});

// GET /farmers/:id
router.get("/farmers/:id", async (req: Request, res: Response): Promise<void> => {
  const parsed = GetFarmerParams.safeParse({ id: req.params.id });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const id = Number(parsed.data.id);
  const [farmer] = await db.select().from(farmersTable).where(eq(farmersTable.id, id));

  if (!farmer) {
    res.status(404).json({ error: "Paysan non trouvé" });
    return;
  }

  res.json(GetFarmerResponse.parse(serializeFarmer(farmer)));
});

// PATCH /farmers/:id
router.patch("/farmers/:id", async (req: Request, res: Response): Promise<void> => {
  const parsedParams = UpdateFarmerParams.safeParse({ id: req.params.id });
  if (!parsedParams.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const id = Number(parsedParams.data.id);
  const parsedBody = UpdateFarmerBody.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ error: parsedBody.error.message });
    return;
  }

  const data = parsedBody.data;
  const updateData: Partial<typeof farmersTable.$inferInsert> = {
    ...data,
    superficie_ha: data.superficie_ha !== undefined ? String(data.superficie_ha) : undefined,
    updated_at: new Date(),
  };

  const [updated] = await db
    .update(farmersTable)
    .set(updateData)
    .where(eq(farmersTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Paysan non trouvé" });
    return;
  }

  res.json(UpdateFarmerResponse.parse(serializeFarmer(updated)));
});

// DELETE /farmers/:id
router.delete("/farmers/:id", async (req: Request, res: Response): Promise<void> => {
  const parsed = DeleteFarmerParams.safeParse({ id: req.params.id });
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const id = Number(parsed.data.id);
  await db.delete(farmersTable).where(eq(farmersTable.id, id));
  res.status(204).send();
});

export default router;
