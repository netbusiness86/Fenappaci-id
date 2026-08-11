import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const cooperativesTable = pgTable("cooperatives", {
  id: serial("id").primaryKey(),
  nom: text("nom").notNull(),
  sigle: text("sigle"),
  numero_identification: text("numero_identification"),
  date_creation: text("date_creation"),
  telephone: text("telephone"),
  email: text("email"),
  adresse: text("adresse"),
  region: text("region"),
  departement: text("departement"),
  sous_prefecture: text("sous_prefecture"),
  village: text("village"),
  president: text("president"),
  vice_president: text("vice_president"),
  secretaire: text("secretaire"),
  tresorier: text("tresorier"),
  created_at: timestamp("created_at").defaultNow().notNull(),
  updated_at: timestamp("updated_at").defaultNow().notNull(),
});

export const cooperativeDocumentsTable = pgTable("cooperative_documents", {
  id: serial("id").primaryKey(),
  cooperative_id: serial("cooperative_id").notNull(),
  type: text("type").notNull(), // recepisse | statuts | autres
  path: text("path").notNull(),
  nom_fichier: text("nom_fichier"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export type Cooperative = typeof cooperativesTable.$inferSelect;
export type CooperativeDocument = typeof cooperativeDocumentsTable.$inferSelect;
