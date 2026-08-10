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

export const productionsTable = pgTable("productions", {
  id: serial("id").primaryKey(),
  plot_id: integer("plot_id").notNull().references(() => plotsTable.id, { onDelete: "cascade" }),
  culture: text("culture"),
  campagne: text("campagne"),
  superficie_concernee: numeric("superficie_concernee", { precision: 10, scale: 4 }),
  production_annuelle_estimee: numeric("production_annuelle_estimee", { precision: 12, scale: 2 }),
  production_campagne_en_cours: numeric("production_campagne_en_cours", { precision: 12, scale: 2 }),
  quantite_disponible: numeric("quantite_disponible", { precision: 12, scale: 2 }),
  quantite_vente: numeric("quantite_vente", { precision: 12, scale: 2 }),
  capacite_livraison: numeric("capacite_livraison", { precision: 12, scale: 2 }),
  unite: text("unite"),
  periode_recolte: text("periode_recolte"),
  periode_disponibilite: text("periode_disponibilite"),
  recherche_acheteur: text("recherche_acheteur").default("NON"),
  quantite_recherchee: numeric("quantite_recherchee", { precision: 12, scale: 2 }),
  prix_souhaite: numeric("prix_souhaite", { precision: 12, scale: 2 }),
  observations: text("observations"),
  created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
