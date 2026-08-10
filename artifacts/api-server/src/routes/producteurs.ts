import { Router, type IRouter, type Request, type Response } from "express";
import { eq, sql, desc } from "drizzle-orm";
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
  return `FEN-CI-${year}-${String(id).padStart(6, "0")}`;
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
    // Identité
    nom: p.nom,
    prenoms: p.prenoms,
    sexe: p.sexe ?? null,
    date_naissance: p.date_naissance ?? null,
    lieu_naissance: (p as any).lieu_naissance ?? null,
    nationalite: (p as any).nationalite ?? null,
    situation_matrimoniale: (p as any).situation_matrimoniale ?? null,
    telephone: p.telephone ?? null,
    telephone_secondaire: (p as any).telephone_secondaire ?? null,
    adresse: (p as any).adresse ?? null,
    // Pièce d'identité
    cin: p.cin ?? null,
    type_piece: (p as any).type_piece ?? null,
    numero_piece: (p as any).numero_piece ?? null,
    date_delivrance: (p as any).date_delivrance ?? null,
    date_expiration: (p as any).date_expiration ?? null,
    // Localisation
    district: (p as any).district ?? null,
    region: p.region ?? null,
    departement: p.departement ?? null,
    sous_prefecture: p.sous_prefecture ?? null,
    commune: (p as any).commune ?? null,
    village: p.village ?? null,
    // GPS
    latitude: (p as any).latitude ?? null,
    longitude: (p as any).longitude ?? null,
    gps_precision: (p as any).gps_precision ?? null,
    gps_captured_at: (p as any).gps_captured_at ?? null,
    // Coopérative
    cooperative_id: p.cooperative_id ?? null,
    cooperative_nom,
    membre_cooperative: (p as any).membre_cooperative ?? null,
    cooperative_nom_libre: (p as any).cooperative_nom_libre ?? null,
    cooperative_numero_libre: (p as any).cooperative_numero_libre ?? null,
    cooperative_fonction: (p as any).cooperative_fonction ?? null,
    // Meta
    cultures: p.cultures ?? null,
    superficie_ha: p.superficie_ha ? parseFloat(p.superficie_ha) : null,
    photo_path: p.photo_path ?? null,
    piece_recto: (p as any).piece_recto ?? null,
    piece_verso: (p as any).piece_verso ?? null,
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
        (p.cin && p.cin.toLowerCase().includes(s)) ||
        ((p as any).numero_piece && (p as any).numero_piece.toLowerCase().includes(s)),
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

  const insertData: any = {
    nom: data.nom,
    prenoms: data.prenoms,
    sexe: data.sexe ?? null,
    date_naissance: data.date_naissance ?? null,
    lieu_naissance: data.lieu_naissance ?? null,
    nationalite: data.nationalite ?? "Ivoirienne",
    situation_matrimoniale: data.situation_matrimoniale ?? null,
    telephone: data.telephone ?? null,
    telephone_secondaire: data.telephone_secondaire ?? null,
    adresse: data.adresse ?? null,
    type_piece: data.type_piece ?? null,
    numero_piece: data.numero_piece ?? null,
    date_delivrance: data.date_delivrance ?? null,
    date_expiration: data.date_expiration ?? null,
    district: data.district ?? null,
    region: data.region ?? null,
    departement: data.departement ?? null,
    sous_prefecture: data.sous_prefecture ?? null,
    commune: data.commune ?? null,
    village: data.village ?? "",
    cooperative_id: data.cooperative_id ?? null,
    membre_cooperative: data.membre_cooperative ?? false,
    cooperative_nom_libre: data.cooperative_nom_libre ?? null,
    cooperative_numero_libre: data.cooperative_numero_libre ?? null,
    cooperative_fonction: data.cooperative_fonction ?? null,
    cultures: data.cultures ?? null,
    superficie_ha: data.superficie_ha !== undefined ? String(data.superficie_ha) : null,
    photo_path: (data as any).photo_path ?? null,
    piece_recto: (data as any).piece_recto ?? null,
    piece_verso: (data as any).piece_verso ?? null,
    latitude: (data as any).latitude ?? null,
    longitude: (data as any).longitude ?? null,
    gps_precision: (data as any).gps_precision ?? null,
    gps_captured_at: (data as any).gps_captured_at ?? null,
    numero_membre: "TEMP",
    agent_id: agentId,
  };

  const [inserted] = await db.insert(producteursTable).values(insertData).returning();

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

  const data = parsedBody.data as any;
  const updateData: any = { updated_at: new Date() };

  const fields = [
    "nom", "prenoms", "sexe", "date_naissance", "lieu_naissance", "nationalite",
    "situation_matrimoniale", "telephone", "telephone_secondaire", "adresse",
    "type_piece", "numero_piece", "date_delivrance", "date_expiration",
    "district", "region", "departement", "sous_prefecture", "commune", "village",
    "cooperative_id", "membre_cooperative", "cooperative_nom_libre",
    "cooperative_numero_libre", "cooperative_fonction", "cultures",
    "superficie_ha", "photo_path", "piece_recto", "piece_verso", "status",
  ];

  for (const field of fields) {
    if (data[field] !== undefined) {
      updateData[field] = field === "superficie_ha" ? String(data[field]) : data[field];
    }
  }

  const [updated] = await db
    .update(producteursTable)
    .set(updateData)
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
