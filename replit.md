# FENAPPACI — Identification des Membres

Application web de gestion et d'identification des membres de la Fédération Nationale des Producteurs et Promoteurs Agricoles de Côte d'Ivoire (FENAPPACI).

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — serveur API (port 8080)
- `pnpm --filter @workspace/fenappaci run dev` — frontend React (port 26251)
- `pnpm run typecheck` — vérification TypeScript complète
- `pnpm run build` — build complet
- `pnpm --filter @workspace/api-spec run codegen` — régénérer hooks et schémas Zod depuis l'OpenAPI spec
- `pnpm --filter @workspace/db run push` — appliquer les changements de schéma DB (dev seulement)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, wouter (routing), TanStack Query, shadcn/ui, Tailwind CSS, framer-motion
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (zod/v4), drizzle-zod
- API codegen: Orval (depuis OpenAPI spec)
- Stockage photos: Replit Object Storage (GCS)
- QR Code: qrcode.react

## Where things live

- `lib/api-spec/openapi.yaml` — contrat API (source de vérité)
- `lib/db/src/schema/farmers.ts` — schéma de la table farmers
- `artifacts/api-server/src/routes/farmers.ts` — routes API paysans
- `artifacts/api-server/src/routes/storage.ts` — routes upload/serve photos
- `artifacts/fenappaci/src/` — frontend React

## Architecture decisions

- Numéro de membre généré automatiquement: `FENA-{année}-{id:05d}` (ex: FENA-2026-00001)
- Photos stockées dans Replit Object Storage (GCS), chemin sauvegardé en DB
- QR code généré côté client depuis le numero_membre (qrcode.react)
- Superficie stockée en `decimal(10,2)` dans PostgreSQL
- Cultures stockées comme texte CSV (ex: "Cacao, Igname") pour simplicité

## Product

- Tableau de bord avec statistiques globales (total, superficie, répartition)
- Annuaire des membres avec recherche et filtres (groupement, culture, région, sexe)
- Inscription de nouveaux paysans avec upload de photo
- Fiche détaillée + carte membre imprimable avec QR code
- Édition et suppression des membres

## User preferences

- Interface en français
- Pas d'authentification (accès ouvert)

## Gotchas

- Les imports Google Fonts dans index.css doivent être en PREMIERE ligne (avant @import 'tailwindcss')
- Zod v3 n'a pas `zod.int()` — utiliser `type: number` dans l'OpenAPI spec pour les entiers
- Le numero_membre est généré après insertion en DB (utilise l'id auto-incrémenté)
- Pour upload: POST /api/storage/uploads/request-url → PUT vers presigned URL → sauvegarder objectPath

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- See the `object-storage` skill for upload flow details
