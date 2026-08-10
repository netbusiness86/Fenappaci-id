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
  if (!parsed.success) {
    res.status(400).json({ error: "Email et mot de passe requis" });
    return;
  }

  const { email, password } = parsed.data;

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase().trim()));

  if (!user || user.password !== password) {
    res.status(401).json({ error: "Email ou mot de passe incorrect" });
    return;
  }

  req.session.userId = user.id;

  res.json(LoginResponse.parse(serializeUser(user)));
});

// GET /auth/me
router.get("/auth/me", async (req: Request, res: Response): Promise<void> => {
  const userId = req.session?.userId;

  if (!userId) {
    res.status(401).json({ error: "Non authentifié" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));

  if (!user) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "Session invalide" });
    return;
  }

  res.json(GetMeResponse.parse(serializeUser(user)));
});

// POST /auth/logout
router.post("/auth/logout", async (req: Request, res: Response): Promise<void> => {
  req.session.destroy(() => {});
  res.json(LogoutResponse.parse({ success: true }));
});

export default router;
