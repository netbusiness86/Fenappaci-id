import { Router, type IRouter, type Request, type Response } from "express";
import { eq, sql, desc, or, and, isNotNull } from "drizzle-orm";
import { db, producteursTable, usersTable, cooperativesTable, farmsTable, plotsTable, productionsTable } from "@workspace/db";
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
import { ObjectStorageService } from "../lib/objectStorage";
import { getObjectAclPolicy } from "../lib/objectAcl";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/** Roles that bypass photo-path ownership checks. */
const PRIVILEGED_ROLES = ["ADMIN", "DIRECTION"];

/**
 * Verify that `agentId` is allowed to claim `objectPath` as a photo asset,
 * then stamp the object's ACL with this agent as owner.
 *
 * Rules (checked in order):
 * 1. ACL present, owner == agentId → already claimed; no-op.
 * 2. ACL present, owner != agentId → 403 (belongs to another agent).
 * 3. No ACL (legacy/fresh) → check DB references:
 *    a. Path referenced in another agent's producteur → 403 (takeover blocked).
 *    b. Path unreferenced (fresh upload) or referenced only by this agent → claim it.
 *
 * Throws `{ status: 403 }` when the path belongs to another agent.
 * Throws `{ status: 404 }` when the object does not exist in storage.
 */
async function verifyAndClaimObjectPath(objectPath: string, agentId: number): Promise<void> {
  let objectFile;
  try {
    objectFile = await objectStorageService.getObjectEntityFile(objectPath);
  } catch {
    throw { status: 404, message: `Fichier introuvable : ${objectPath}` };
  }

  const aclPolicy = await getObjectAclPolicy(objectFile);

  if (aclPolicy?.owner) {
    // ACL is authoritative — trust it unconditionally.
    if (aclPolicy.owner !== String(agentId)) {
      throw { status: 403, message: `Accès refusé : ce fichier appartient à un autre agent.` };
    }
    return; // Already claimed by this agent; nothing to do.
  }

  // No ACL yet. Before claiming, check that no other agent's producteur
  // already references this path in the database (legacy path takeover guard).
  const existingRefs = await db
    .select({ agent_id: producteursTable.agent_id })
    .from(producteursTable)
    .where(
      or(
        eq(producteursTable.photo_path, objectPath),
        eq(producteursTable.piece_recto, objectPath),
        eq(producteursTable.piece_verso, objectPath),
      ),
    );

  for (const ref of existingRefs) {
    if (ref.agent_id !== null && ref.agent_id !== agentId) {
      throw {
        status: 403,
        message: `Accès refusé : ce fichier est déjà associé à un autre dossier.`,
      };
    }
  }

  // Path is either a fresh upload (no references) or already belongs to this
  // agent in the DB → safe to stamp ACL ownership now.
  await objectStorageService.trySetObjectEntityAclPolicy(objectPath, {
    owner: String(agentId),
    visibility: "private",
  });
}

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

  const session = req.session as any;
  const sessionUserId = session?.userId as number | undefined;
  const sessionRole = session?.role as string | undefined;

  let rows = await db.select().from(producteursTable).orderBy(desc(producteursTable.created_at));

  // AGENT : uniquement ses propres producteurs
  if (sessionRole === 'AGENT' && sessionUserId) {
    rows = rows.filter((p) => p.agent_id === sessionUserId);
  }

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

  // Single batch query — find all producteur IDs that have at least one production
  // with quantite_disponible > 0. No N+1 queries.
  const disponiblesRows = await db
    .selectDistinct({ producteur_id: farmsTable.producteur_id })
    .from(productionsTable)
    .innerJoin(plotsTable, eq(plotsTable.id, productionsTable.plot_id))
    .innerJoin(farmsTable, eq(farmsTable.id, plotsTable.farm_id))
    .where(
      and(
        isNotNull(productionsTable.quantite_disponible),
        sql`${productionsTable.quantite_disponible}::numeric > 0`,
      ),
    );
  const disponiblesSet = new Set(disponiblesRows.map((r) => r.producteur_id));

  const serialized = await Promise.all(rows.map(serializeProducteur));
  const withFlags = serialized.map((p) => ({
    ...p,
    has_disponibilites: disponiblesSet.has(p.id),
  }));

  res.json(ListProducteursResponse.parse(withFlags));
});

// POST /producteurs
router.post("/producteurs", async (req: Request, res: Response): Promise<void> => {
  const parsed = CreateProducteurBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const data = parsed.data;
  const agentId = req.session?.userId as number | undefined ?? null;

  // For agents: verify ownership of any photo/piece paths before saving.
  if (agentId) {
    const [sessionUser] = await db
      .select({ role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.id, agentId));

    if (sessionUser && !PRIVILEGED_ROLES.includes(sessionUser.role)) {
      const pathsToCheck: string[] = [
        (data as any).photo_path,
        (data as any).piece_recto,
        (data as any).piece_verso,
      ].filter(Boolean);

      for (const objectPath of pathsToCheck) {
        try {
          await verifyAndClaimObjectPath(objectPath, agentId);
        } catch (err: any) {
          res.status(err?.status ?? 403).json({ error: err?.message ?? "Accès refusé" });
          return;
        }
      }
    }
  }

  // Determine the agent_id to record on the new producteur.
  // Privileged users (Direction / Admin) may supply a specific agent_id in the
  // body to create a record on behalf of another agent.
  // Regular agents always get their own session ID — any agent_id in the body
  // is silently ignored so they cannot self-reassign to someone else.
  let resolvedAgentId: number | null = agentId;
  if (agentId) {
    const [sessionUserForPost] = await db
      .select({ role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.id, agentId));

    if (sessionUserForPost && PRIVILEGED_ROLES.includes(sessionUserForPost.role)) {
      // Privileged: honour the caller-supplied agent_id if present.
      resolvedAgentId = (data as any).agent_id ?? agentId;
    }
    // Non-privileged: resolvedAgentId stays as agentId (their own ID).
  }

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
    agent_id: resolvedAgentId,
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

  // AGENT : vérifier que ce producteur lui appartient
  const session = req.session as any;
  const sessionUserId = session?.userId as number | undefined;
  const sessionRole = session?.role as string | undefined;
  if (sessionRole === 'AGENT' && sessionUserId && p.agent_id !== sessionUserId) {
    res.status(403).json({ error: "Accès refusé — ce producteur ne vous est pas assigné." });
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

  // Fetch the existing producteur first (needed for ownership check).
  const [existing] = await db
    .select({ agent_id: producteursTable.agent_id })
    .from(producteursTable)
    .where(eq(producteursTable.id, id));

  if (!existing) {
    res.status(404).json({ error: "Producteur non trouvé" });
    return;
  }

  // Require an authenticated session for any mutation.
  const sessionUserId = req.session?.userId as number | undefined;
  if (!sessionUserId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  {
    const [sessionUser] = await db
      .select({ role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.id, sessionUserId));

    if (sessionUser && !PRIVILEGED_ROLES.includes(sessionUser.role)) {
      // Ownership check: agent may only edit their own producteurs.
      // agent_id === null means the record pre-dates ownership tracking → allow any agent.
      if (existing.agent_id !== null && existing.agent_id !== sessionUserId) {
        res.status(403).json({ error: "Accès refusé : ce dossier appartient à un autre agent." });
        return;
      }

      const pathsToCheck: string[] = [
        data.photo_path,
        data.piece_recto,
        data.piece_verso,
      ].filter(Boolean);

      for (const objectPath of pathsToCheck) {
        try {
          await verifyAndClaimObjectPath(objectPath, sessionUserId);
        } catch (err: any) {
          res.status(err?.status ?? 403).json({ error: err?.message ?? "Accès refusé" });
          return;
        }
      }
    }
  }

  const updateData: any = { updated_at: new Date() };

  const fields = [
    "nom", "prenoms", "sexe", "date_naissance", "lieu_naissance", "nationalite",
    "situation_matrimoniale", "telephone", "telephone_secondaire", "adresse",
    "type_piece", "numero_piece", "date_delivrance", "date_expiration",
    "district", "region", "departement", "sous_prefecture", "commune", "village",
    "cooperative_id", "membre_cooperative", "cooperative_nom_libre",
    "cooperative_numero_libre", "cooperative_fonction", "cultures",
    "superficie_ha", "photo_path", "piece_recto", "piece_verso", "status",
    "latitude", "longitude", "gps_precision", "gps_captured_at",
  ];

  for (const field of fields) {
    if (data[field] !== undefined) {
      updateData[field] = field === "superficie_ha" ? String(data[field]) : data[field];
    }
  }

  // Allow Direction / Admin to reassign the producteur to a different agent.
  // Regular agents are never allowed to change agent_id (field is not in the
  // list above and this block is guarded by the privilege check already done).
  if (sessionUserId && data.agent_id !== undefined) {
    const [sessionUserForPatch] = await db
      .select({ role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.id, sessionUserId));

    if (sessionUserForPatch && PRIVILEGED_ROLES.includes(sessionUserForPatch.role)) {
      updateData.agent_id = data.agent_id;
    }
    // Non-privileged users: silently drop any agent_id supplied in the body.
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

  // Fetch the existing producteur for ownership check.
  const [existing] = await db
    .select({ agent_id: producteursTable.agent_id })
    .from(producteursTable)
    .where(eq(producteursTable.id, id));

  if (!existing) {
    res.status(404).json({ error: "Producteur non trouvé" });
    return;
  }

  // Require an authenticated session for any mutation.
  const sessionUserId = req.session?.userId as number | undefined;
  if (!sessionUserId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  {
    const [sessionUser] = await db
      .select({ role: usersTable.role })
      .from(usersTable)
      .where(eq(usersTable.id, sessionUserId));

    if (sessionUser && !PRIVILEGED_ROLES.includes(sessionUser.role)) {
      // agent_id === null means the record pre-dates ownership tracking → allow any agent.
      if (existing.agent_id !== null && existing.agent_id !== sessionUserId) {
        res.status(403).json({ error: "Accès refusé : ce dossier appartient à un autre agent." });
        return;
      }
    }
  }

  await db.delete(producteursTable).where(eq(producteursTable.id, id));
  res.status(204).send();
});

export default router;
