import { useParams, useLocation } from 'wouter';
import { useGetProducteur } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertTriangle,
  ArrowLeft,
  Pencil,
  User,
  MapPin,
  Phone,
  CheckCircle2,
  Clock,
  Ban,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Build a URL to display an object-storage photo
function photoUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('/objects/')) return `/api/storage${path}`;
  return `/api/storage/objects/${path}`;
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-col py-2 border-b border-gray-100 last:border-0">
      <span className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider mb-0.5">
        {label}
      </span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
      <div className="bg-[#1B5E20] text-white px-4 py-2.5 font-bold text-sm">{title}</div>
      <div className="px-4 py-2">{children}</div>
    </div>
  );
}

type Status = 'ACTIF' | 'EN_ATTENTE' | 'SUSPENDU';

const STATUS_CONFIG: Record<Status, { label: string; color: string; icon: React.ReactNode }> = {
  ACTIF: {
    label: 'Actif',
    color: 'bg-[#4CAF50]',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  EN_ATTENTE: {
    label: 'En attente',
    color: 'bg-[#F57C00]',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  SUSPENDU: {
    label: 'Suspendu',
    color: 'bg-gray-400',
    icon: <Ban className="w-3.5 h-3.5" />,
  },
};

export default function DetailProducteur() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const { data: producteur, isLoading, isError } = useGetProducteur(id!);

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <div className="h-14 bg-[#1B5E20] rounded-none animate-pulse" />
        <div className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
        <div className="h-48 bg-gray-100 rounded-2xl animate-pulse" />
        <div className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  // ─── Error ────────────────────────────────────────────────────────────────
  if (isError || !producteur) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 p-4">
        <AlertTriangle className="w-12 h-12 text-red-400" />
        <p className="text-gray-600 font-medium">Producteur introuvable</p>
        <Button variant="outline" onClick={() => setLocation('/mes-producteurs')}>
          Retour à la liste
        </Button>
      </div>
    );
  }

  const status = producteur.status as Status;
  const statusCfg = STATUS_CONFIG[status] ?? { label: status, color: 'bg-gray-400', icon: null };
  const photo = photoUrl(producteur.photo_path);
  const recto = photoUrl(producteur.piece_recto);
  const verso = photoUrl(producteur.piece_verso);

  return (
    <div className="flex flex-col min-h-[calc(100dvh-4rem)] bg-gray-50">
      {/* Header */}
      <div className="bg-[#1B5E20] px-4 py-3 text-white flex items-center gap-3 sticky top-0 z-10 shadow-md">
        <button
          type="button"
          onClick={() => setLocation('/mes-producteurs')}
          className="p-1 rounded-full hover:bg-white/20 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-bold truncate">
            {producteur.nom} {producteur.prenoms}
          </p>
          <p className="text-xs text-white/70 font-mono">{producteur.numero_membre}</p>
        </div>
        <Badge className={cn('text-[11px] px-2 py-0.5 flex items-center gap-1', statusCfg.color)}>
          {statusCfg.icon}
          {statusCfg.label}
        </Badge>
      </div>

      <div className="p-4 space-y-4 pb-28">
        {/* Photo + identité rapide */}
        <div className="bg-white rounded-2xl border shadow-sm p-4 flex items-center gap-4">
          <div className="w-20 h-20 rounded-xl overflow-hidden border bg-gray-100 flex-none flex items-center justify-center">
            {photo ? (
              <img src={photo} alt={producteur.nom} className="w-full h-full object-cover" />
            ) : (
              <User className="w-8 h-8 text-gray-300" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-black text-gray-900 leading-tight">
              {producteur.nom.toUpperCase()}
            </p>
            <p className="text-base font-medium text-gray-700">{producteur.prenoms}</p>
            <p className="text-xs font-mono text-[#F57C00] font-bold mt-1">
              {producteur.numero_membre}
            </p>
            {producteur.cultures && (
              <p className="text-xs text-[#2E7D32] font-medium mt-1 truncate">
                {producteur.cultures}
              </p>
            )}
          </div>
        </div>

        {/* Identité */}
        <Section title="👤 Identité">
          <InfoRow label="Sexe" value={producteur.sexe} />
          <InfoRow label="Date de naissance" value={producteur.date_naissance} />
          <InfoRow label="Lieu de naissance" value={producteur.lieu_naissance} />
          <InfoRow label="Nationalité" value={producteur.nationalite} />
          <InfoRow label="Situation matrimoniale" value={producteur.situation_matrimoniale} />
          <div className="flex flex-col py-2 border-b border-gray-100">
            <span className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider mb-0.5">
              Téléphone
            </span>
            {producteur.telephone ? (
              <a
                href={`tel:${producteur.telephone}`}
                className="text-sm font-medium text-[#1B5E20] flex items-center gap-1"
              >
                <Phone className="w-3.5 h-3.5" />
                {producteur.telephone}
              </a>
            ) : (
              <span className="text-sm text-gray-400 italic">Non renseigné</span>
            )}
          </div>
          {producteur.telephone_secondaire && (
            <div className="flex flex-col py-2 border-b border-gray-100">
              <span className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider mb-0.5">
                Téléphone secondaire
              </span>
              <a
                href={`tel:${producteur.telephone_secondaire}`}
                className="text-sm font-medium text-[#1B5E20] flex items-center gap-1"
              >
                <Phone className="w-3.5 h-3.5" />
                {producteur.telephone_secondaire}
              </a>
            </div>
          )}
          <InfoRow label="Adresse" value={producteur.adresse} />
        </Section>

        {/* Pièce d'identité */}
        <Section title="🪪 Pièce d'identité">
          <InfoRow label="Type de pièce" value={producteur.type_piece} />
          <InfoRow label="Numéro de pièce" value={producteur.numero_piece} />
          <InfoRow label="Date de délivrance" value={producteur.date_delivrance} />
          <InfoRow label="Date d'expiration" value={producteur.date_expiration} />
          {(recto || verso) && (
            <div className="py-3 space-y-3">
              <p className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider">
                Scan de la pièce
              </p>
              <div className="grid grid-cols-2 gap-3">
                {recto && (
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 font-medium">Recto</p>
                    <img
                      src={recto}
                      alt="Recto pièce d'identité"
                      className="w-full rounded-xl border object-cover aspect-[3/2]"
                    />
                  </div>
                )}
                {verso && (
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 font-medium">Verso</p>
                    <img
                      src={verso}
                      alt="Verso pièce d'identité"
                      className="w-full rounded-xl border object-cover aspect-[3/2]"
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </Section>

        {/* Localisation */}
        <Section title="📍 Localisation">
          <InfoRow label="District" value={producteur.district} />
          <InfoRow label="Région" value={producteur.region} />
          <InfoRow label="Département" value={producteur.departement} />
          <InfoRow label="Sous-préfecture" value={producteur.sous_prefecture} />
          <InfoRow label="Commune" value={producteur.commune} />
          <InfoRow label="Village / Localité" value={producteur.village} />
          {producteur.latitude != null && producteur.longitude != null && (
            <div className="flex flex-col py-2 border-b border-gray-100 last:border-0">
              <span className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider mb-0.5">
                GPS
              </span>
              <a
                href={`https://maps.google.com/?q=${producteur.latitude},${producteur.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-[#1B5E20] flex items-center gap-1"
              >
                <MapPin className="w-3.5 h-3.5" />
                {producteur.latitude.toFixed(6)}°, {producteur.longitude.toFixed(6)}°
                {producteur.gps_precision != null &&
                  ` (±${Math.round(producteur.gps_precision)} m)`}
              </a>
            </div>
          )}
        </Section>

        {/* Coopérative */}
        <Section title="🏘️ Coopérative">
          <InfoRow
            label="Membre d'une coopérative"
            value={producteur.membre_cooperative ? 'OUI' : 'NON'}
          />
          {producteur.membre_cooperative && (
            <>
              <InfoRow
                label="Nom de la coopérative"
                value={producteur.cooperative_nom_libre ?? producteur.cooperative_nom}
              />
              <InfoRow
                label="Numéro d'identification"
                value={producteur.cooperative_numero_libre}
              />
              <InfoRow label="Fonction" value={producteur.cooperative_fonction} />
            </>
          )}
        </Section>

        {/* Cultures */}
        {(producteur.cultures || producteur.superficie_ha != null) && (
          <Section title="🌱 Cultures">
            <InfoRow label="Cultures pratiquées" value={producteur.cultures} />
            {producteur.superficie_ha != null && (
              <InfoRow label="Superficie totale" value={`${producteur.superficie_ha} ha`} />
            )}
          </Section>
        )}

        {/* Informations du dossier */}
        <Section title="ℹ️ Informations du dossier">
          <InfoRow label="Numéro de membre" value={producteur.numero_membre} />
          <InfoRow label="Statut" value={statusCfg.label} />
          <InfoRow label="Agent enregistreur" value={producteur.agent_nom} />
          <InfoRow
            label="Date d'enregistrement"
            value={new Date(producteur.created_at).toLocaleDateString('fr-FR', {
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            })}
          />
        </Section>
      </div>

      {/* Fixed bottom action */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t p-4 z-20">
        <Button
          className="w-full h-12 text-sm bg-[#1B5E20] hover:bg-[#2E7D32] text-white rounded-xl font-bold shadow"
          onClick={() => setLocation(`/producteurs/${id}/modifier`)}
        >
          <Pencil className="w-4 h-4 mr-2" />
          Modifier le dossier
        </Button>
      </div>
    </div>
  );
}
