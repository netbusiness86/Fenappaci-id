import { Router, type IRouter, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { LoginBody, LoginResponse, LogoutResponse, GetMeResponse } from "@workspace/api-zod";

const router: IRouter = Router();

function serializeUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    nom: user.nom,
    prenoms: user.prenoms,
    email: user.email,
    role: user.role,
    status: (user as any).status ?? "ACTIVE",
    telephone: (user as any).telephone ?? null,
    region: user.region ?? null,
    departement: user.departement ?? null,
    sous_prefecture: user.sous_prefecture ?? null,
    avatar_path: user.avatar_path ?? null,
    created_at: user.created_at.toISOString(),
  };
}

// POST /auth/login
router.post("/auth/login", async (req: Request, res: Response): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Email et mot de passe requis" }); return; }
  const { email, password } = parsed.data;

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase().trim()));
  if (!user || user.password !== password) {
    res.status(401).json({ error: "Email ou mot de passe incorrect" });
    return;
  }

  const status = (user as any).status ?? "ACTIVE";
  if (status === "PENDING") {
    res.status(403).json({ error: "Votre compte est en attente de validation par l'administrateur FENAPPACI. Vous recevrez une confirmation dès l'approbation." });
    return;
  }
  if (status === "REJECTED") {
    res.status(403).json({ error: "Votre demande d'enregistrement a été refusée. Contactez l'administration FENAPPACI pour plus d'informations." });
    return;
  }

  req.session.userId = user.id;
  (req.session as any).role = user.role;
  res.json(LoginResponse.parse(serializeUser(user)));
});

// POST /auth/register  (public — agent self-registration)
router.post("/auth/register", async (req: Request, res: Response): Promise<void> => {
  const { nom, prenoms, email, password, telephone, region, departement, sous_prefecture } = req.body ?? {};

  const errors: string[] = [];
  if (!nom || String(nom).trim().length < 2) errors.push("Nom requis (minimum 2 caractères)");
  if (!prenoms || String(prenoms).trim().length < 2) errors.push("Prénoms requis");
  if (!email || !String(email).includes("@")) errors.push("Email invalide");
  if (!password || String(password).length < 6) errors.push("Mot de passe minimum 6 caractères");
  if (!region || String(region).trim().length < 2) errors.push("Région requise");
  if (!departement || String(departement).trim().length < 2) errors.push("Département requis");
  if (errors.length > 0) { res.status(400).json({ error: errors.join(". ") }); return; }
  const normalizedEmail = email.toLowerCase().trim();

  // Check email uniqueness
  const [existing] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, normalizedEmail));
  if (existing) {
    res.status(409).json({ error: "Un compte existe déjà avec cet email." });
    return;
  }

  await (db.insert(usersTable) as any).values({
    nom: nom.trim(),
    prenoms: prenoms.trim(),
    email: normalizedEmail,
    password,
    role: "AGENT",
    status: "PENDING",
    telephone: telephone?.trim() || null,
    region: region.trim(),
    departement: departement.trim(),
    sous_prefecture: sous_prefecture?.trim() || null,
  });

  res.status(201).json({ message: "Votre demande d'enregistrement a été soumise. L'administrateur FENAPPACI validera votre compte prochainement." });
});

// GET /auth/me
router.get("/auth/me", async (req: Request, res: Response): Promise<void> => {
  const userId = req.session?.userId;
  if (!userId) { res.status(401).json({ error: "Non authentifié" }); return; }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) { req.session.destroy(() => {}); res.status(401).json({ error: "Session invalide" }); return; }
  res.json(GetMeResponse.parse(serializeUser(user)));
});

// POST /auth/logout
router.post("/auth/logout", async (req: Request, res: Response): Promise<void> => {
  req.session.destroy(() => {});
  res.json(LogoutResponse.parse({ success: true }));
});

export default router;
