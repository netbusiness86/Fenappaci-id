import { pgTable, serial, text, decimal, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const farmersTable = pgTable("farmers", {
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
  groupement: text("groupement"),
  cooperative: text("cooperative"),
  cultures: text("cultures"),
  superficie_ha: decimal("superficie_ha", { precision: 10, scale: 2 }),
  photo_path: text("photo_path"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const insertFarmerSchema = createInsertSchema(farmersTable).omit({
  id: true,
  numero_membre: true,
  created_at: true,
  updated_at: true,
});

export const selectFarmerSchema = createSelectSchema(farmersTable);

export type InsertFarmer = z.infer<typeof insertFarmerSchema>;
export type Farmer = typeof farmersTable.$inferSelect;
