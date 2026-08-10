import { pgTable, serial, text, decimal, doublePrecision, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const producteursTable = pgTable("producteurs", {
  id: serial("id").primaryKey(),
  numero_membre: text("numero_membre").notNull().unique(),

  // Étape 1 — Identité
  nom: text("nom").notNull(),
  prenoms: text("prenoms").notNull(),
  sexe: text("sexe"),
  date_naissance: text("date_naissance"),
  lieu_naissance: text("lieu_naissance"),
  nationalite: text("nationalite").default("Ivoirienne"),
  situation_matrimoniale: text("situation_matrimoniale"),
  telephone: text("telephone"),
  telephone_secondaire: text("telephone_secondaire"),
  adresse: text("adresse"),

  // Étape 2 — Pièce d'identité
  cin: text("cin"), // kept for backward compat (= numero_piece)
  type_piece: text("type_piece"),
  numero_piece: text("numero_piece"),
  date_delivrance: text("date_delivrance"),
  date_expiration: text("date_expiration"),

  // Étape 3 — Localisation
  district: text("district"),
  region: text("region"),
  departement: text("departement"),
  sous_prefecture: text("sous_prefecture"),
  commune: text("commune"),
  village: text("village").notNull().default(""),
  // GPS
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  gps_precision: doublePrecision("gps_precision"),
  gps_captured_at: text("gps_captured_at"),

  // Étape 4 — Coopérative
  cooperative_id: integer("cooperative_id"),
  membre_cooperative: boolean("membre_cooperative").default(false),
  cooperative_nom_libre: text("cooperative_nom_libre"),
  cooperative_numero_libre: text("cooperative_numero_libre"),
  cooperative_fonction: text("cooperative_fonction"),

  // Meta
  cultures: text("cultures"),
  superficie_ha: decimal("superficie_ha", { precision: 10, scale: 2 }),
  photo_path: text("photo_path"),
  status: text("status").notNull().default("ACTIF"),
  agent_id: integer("agent_id"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const insertProducteurSchema = createInsertSchema(producteursTable).omit({
  id: true,
  numero_membre: true,
  created_at: true,
  updated_at: true,
});

export type InsertProducteur = z.infer<typeof insertProducteurSchema>;
export type Producteur = typeof producteursTable.$inferSelect;
