import { z } from "zod";

export const farmerSchema = z.object({
  nom: z.string().min(1, "Le nom est requis"),
  prenoms: z.string().min(1, "Les prénoms sont requis"),
  date_naissance: z.string().optional().or(z.literal("")),
  sexe: z.string().optional().or(z.literal("")),
  cin: z.string().optional().or(z.literal("")),
  telephone: z.string().optional().or(z.literal("")),
  village: z.string().min(1, "Le village est requis"),
  sous_prefecture: z.string().optional().or(z.literal("")),
  region: z.string().optional().or(z.literal("")),
  groupement: z.string().optional().or(z.literal("")),
  cooperative: z.string().optional().or(z.literal("")),
  cultures: z.string().optional().or(z.literal("")),
  superficie_ha: z.coerce.number().optional().or(z.literal("").transform(() => undefined)),
  photo_path: z.string().optional().or(z.literal("")),
});

export type FarmerFormValues = z.infer<typeof farmerSchema>;
