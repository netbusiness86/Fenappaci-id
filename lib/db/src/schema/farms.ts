import { pgTable, serial, text, numeric, doublePrecision, integer, timestamp } from "drizzle-orm/pg-core";
import { producteursTable } from "./producteurs";

export const farmsTable = pgTable("farms", {
  id: serial("id").primaryKey(),
  producteur_id: integer("producteur_id").notNull().references(() => producteursTable.id, { onDelete: "cascade" }),
  nom: text("nom"),
  localite: text("localite"),
  superficie_ha: numeric("superficie_ha", { precision: 10, scale: 4 }),
  statut_foncier: text("statut_foncier"),
  annee_creation: integer("annee_creation"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  observations: text("observations"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const plotsTable = pgTable("plots", {
  id: serial("id").primaryKey(),
  farm_id: integer("farm_id").notNull().references(() => farmsTable.id, { onDelete: "cascade" }),
  reference: text("reference"),
  culture_principale: text("culture_principale"),
  superficie: numeric("superficie", { precision: 10, scale: 4 }),
  annee_plantation: integer("annee_plantation"),
  age_plantation: integer("age_plantation"),
  etat: text("etat"),
  latitude: doublePrecision("latitude"),
  longitude: doublePrecision("longitude"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
