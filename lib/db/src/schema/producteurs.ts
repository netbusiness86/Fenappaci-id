import { pgTable, serial, text, decimal, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const producteursTable = pgTable("producteurs", {
  id: serial("id").primaryKey(),
  numero_membre: text("numero_membre").notNull().unique(),
  nom: text("nom").notNull(),
  prenoms: text("prenoms").notNull(),
  date_naissance: text("date_naissance"),
  sexe: text("sexe"),
  cin: text("cin"),
  telephone: text("telephone"),
  village: text("village").notNull(),
  sous_prefecture: text("sous_prefecture"),
  region: text("region"),
  cooperative_id: integer("cooperative_id"),
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
