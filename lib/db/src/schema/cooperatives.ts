import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const cooperativesTable = pgTable("cooperatives", {
  id: serial("id").primaryKey(),
  nom: text("nom").notNull(),
  region: text("region"),
  departement: text("departement"),
  created_at: timestamp("created_at").defaultNow().notNull(),
});

export type Cooperative = typeof cooperativesTable.$inferSelect;
