import { Router, type Request, type Response } from "express";
import { sql, and, isNotNull } from "drizzle-orm";
import { db, producteursTable, farmsTable, plotsTable, productionsTable } from "@workspace/db";

const router = Router();

// GET /disponibilites?culture=&region=&departement=&cooperative=&quantite_min=
router.get("/disponibilites", async (req: Request, res: Response): Promise<void> => {
  const { culture, region, departement, cooperative, quantite_min } = req.query as Record<string, string>;

  const conditions = [
    isNotNull(productionsTable.quantite_disponible),
    sql`${productionsTable.quantite_disponible}::numeric > 0`,
  ] as any[];

  if (culture) {
    conditions.push(sql`unaccent(lower(${productionsTable.culture})) LIKE unaccent(lower(${'%' + culture + '%'}))`);
  }
  if (region) {
    conditions.push(sql`unaccent(lower(${producteursTable.region})) LIKE unaccent(lower(${'%' + region + '%'}))`);
  }
  if (departement) {
    conditions.push(sql`unaccent(lower(${producteursTable.departement})) LIKE unaccent(lower(${'%' + departement + '%'}))`);
  }
  if (cooperative) {
    conditions.push(sql`unaccent(lower(${producteursTable.cooperative_nom_libre})) LIKE unaccent(lower(${'%' + cooperative + '%'}))`);
  }
  if (quantite_min && !isNaN(Number(quantite_min))) {
    conditions.push(sql`${productionsTable.quantite_disponible}::numeric >= ${Number(quantite_min)}`);
  }

  const rows = await db
    .select({
      production_id: productionsTable.id,
      culture: productionsTable.culture,
      campagne: productionsTable.campagne,
      quantite_disponible: productionsTable.quantite_disponible,
      quantite_vente: productionsTable.quantite_vente,
      unite: productionsTable.unite,
      recherche_acheteur: productionsTable.recherche_acheteur,
      prix_souhaite: productionsTable.prix_souhaite,
      periode_disponibilite: productionsTable.periode_disponibilite,
      // Producteur
      producteur_id: producteursTable.id,
      nom: producteursTable.nom,
      prenoms: producteursTable.prenoms,
      numero_membre: producteursTable.numero_membre,
      region: producteursTable.region,
      departement: producteursTable.departement,
      village: producteursTable.village,
      telephone: producteursTable.telephone,
      cooperative_nom_libre: producteursTable.cooperative_nom_libre,
      // Parcelle
      plot_id: plotsTable.id,
      plot_reference: plotsTable.reference,
      // Exploitation
      farm_localite: farmsTable.localite,
    })
    .from(productionsTable)
    .innerJoin(plotsTable, sql`${productionsTable.plot_id} = ${plotsTable.id}`)
    .innerJoin(farmsTable, sql`${plotsTable.farm_id} = ${farmsTable.id}`)
    .innerJoin(producteursTable, sql`${farmsTable.producteur_id} = ${producteursTable.id}`)
    .where(and(...conditions))
    .orderBy(sql`${productionsTable.quantite_disponible}::numeric DESC`)
    .limit(200);

  res.json(rows.map(r => ({
    production_id: r.production_id,
    culture: r.culture,
    campagne: r.campagne,
    quantite_disponible: r.quantite_disponible != null ? Number(r.quantite_disponible) : null,
    quantite_vente: r.quantite_vente != null ? Number(r.quantite_vente) : null,
    unite: r.unite ?? 'Kg',
    recherche_acheteur: r.recherche_acheteur,
    prix_souhaite: r.prix_souhaite != null ? Number(r.prix_souhaite) : null,
    periode_disponibilite: r.periode_disponibilite,
    producteur: {
      id: r.producteur_id,
      nom: r.nom, prenoms: r.prenoms,
      numero_membre: r.numero_membre,
      region: r.region, departement: r.departement,
      village: r.village ?? r.farm_localite,
      telephone: r.telephone,
      cooperative: r.cooperative_nom_libre,
    },
  })));
});

export default router;
