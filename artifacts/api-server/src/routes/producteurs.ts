import { Router, type IRouter, type Request, type Response } from "express";
import { eq, ilike, or, sql, desc } from "drizzle-orm";
import { db, producteursTable, usersTable, cooperativesTable } from "@workspace/db";
import {
  ListProducteursQueryParams,
  CreateProducteurBody,
  GetProducteurParams,
  UpdateProducteurBody,
  UpdateProducteurParams,
  DeleteProducteurParams,
  ListProducteursResponse,
  CreateProducteurResponse,
  GetProducteurResponse,
  UpdateProducteurResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

function generateNumeroMembre(id: number): string {
  const year = new Date().getFullYear();
  return `FENA-${year}-${String(id).padStart(5, "0")}`;
}

async function serializeProducteur(p: typeof producteursTable.$inferSelect) {
  let cooperative_nom: string | null = null;
  let agent_nom: string | null = null;

  if (p.cooperative_id) {
    const [coop] = await db.select().from(cooperativesTable).where(eq(cooperativesTable.id, p.cooperative_id));
    cooperative_nom = coop?.nom ?? null;
  }
  if (p.agent_id) {
    const [agent] = await db.select().from(usersTable).where(eq(usersTable.id, p.agent_id));
    agent_nom = agent ? `${agent.prenoms} ${agent.nom}` : null;
  }

  return {
    id: p.id,
    numero_membre: p.numero_membre,
    nom: p.nom,
    prenoms: p.prenoms,
    date_naissance: p.date_naissance ?? null,
    sexe: p.sexe ?? null,
    cin: p.cin ?? null,
    telephone: p.telephone ?? null,
    village: p.village,
    sous_prefecture: p.sous_prefecture ?? null,
    region: p.region ?? null,
    cooperative_id: p.cooperative_id ?? null,
    cooperative_nom,
    cultures: p.cultures ?? null,
    superficie_ha: p.superficie_ha ? parseFloat(p.superficie_ha) : null,
    photo_path: p.photo_path ?? null,
    status: p.status,
    agent_id: p.agent_id ?? null,
    agent_nom,
    created_at: p.created_at.toISOString(),
  };
}

// GET /producteurs
router.get("/producteurs", async (req: Request, res: Response): Promise<void> => {
  const parsed = ListProducteursQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { search, region, status } = parsed.data;

  let rows = await db.select().from(producteursTable).orderBy(desc(producteursTable.created_at));

  if (search) {
    const s = search.toLowerCase();
    rows = rows.filter(
      (p) =>
        p.nom.toLowerCase().includes(s) ||
        p.prenoms.toLowerCase().includes(s) ||
        p.numero_membre.toLowerCase().includes(s) ||
        (p.cin && p.cin.toLowerCase().includes(s)),
    );
  }
  if (region) rows = rows.filter((p) => p.region?.toLowerCase().includes(region.toLowerCase()));
  if (status) rows = rows.filter((p) => p.status === status);

  const serialized = await Promise.all(rows.map(serializeProducteur));
  res.json(ListProducteursResponse.parse(serialized));
});

// POST /producteurs
router.post("/producteurs", async (req: Request, res: Response): Promise<void> => {
  const parsed = CreateProducteurBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;
  const agentId = req.session?.userId ?? null;

  const [inserted] = await db
    .insert(producteursTable)
    .values({
      ...data,
      cooperative_id: data.cooperative_id ?? null,
      superficie_ha: data.superficie_ha !== undefined ? String(data.superficie_ha) : null,
      numero_membre: "TEMP",
      agent_id: agentId,
    })
    .returning();

  const numero_membre = generateNumeroMembre(inserted.id);
  const [updated] = await db
    .update(producteursTable)
    .set({ numero_membre })
    .where(eq(producteursTable.id, inserted.id))
    .returning();

  res.status(201).json(CreateProducteurResponse.parse(await serializeProducteur(updated)));
});

// GET /producteurs/:id
router.get("/producteurs/:id", async (req: Request, res: Response): Promise<void> => {
  const parsed = GetProducteurParams.safeParse({ id: req.params.id });
  if (!parsed.success) {
    res.status(400).json({ error: "ID invalide" });
    return;
  }

  const id = parseInt(parsed.data.id, 10);
  const [p] = await db.select().from(producteursTable).where(eq(producteursTable.id, id));

  if (!p) {
    res.status(404).json({ error: "Producteur non trouvé" });
    return;
  }

  res.json(GetProducteurResponse.parse(await serializeProducteur(p)));
});

// PATCH /producteurs/:id
router.patch("/producteurs/:id", async (req: Request, res: Response): Promise<void> => {
  const parsedParams = UpdateProducteurParams.safeParse({ id: req.params.id });
  if (!parsedParams.success) {
    res.status(400).json({ error: "ID invalide" });
    return;
  }

  const id = parseInt(parsedParams.data.id, 10);
  const parsedBody = UpdateProducteurBody.safeParse(req.body);
  if (!parsedBody.success) {
    res.status(400).json({ error: parsedBody.error.message });
    return;
  }

  const data = parsedBody.data;
  const [updated] = await db
    .update(producteursTable)
    .set({
      ...data,
      cooperative_id: data.cooperative_id !== undefined ? data.cooperative_id : undefined,
      superficie_ha: data.superficie_ha !== undefined ? String(data.superficie_ha) : undefined,
      updated_at: new Date(),
    })
    .where(eq(producteursTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Producteur non trouvé" });
    return;
  }

  res.json(UpdateProducteurResponse.parse(await serializeProducteur(updated)));
});

// DELETE /producteurs/:id
router.delete("/producteurs/:id", async (req: Request, res: Response): Promise<void> => {
  const parsed = DeleteProducteurParams.safeParse({ id: req.params.id });
  if (!parsed.success) {
    res.status(400).json({ error: "ID invalide" });
    return;
  }

  const id = parseInt(parsed.data.id, 10);
  await db.delete(producteursTable).where(eq(producteursTable.id, id));
  res.status(204).send();
});

export default router;
