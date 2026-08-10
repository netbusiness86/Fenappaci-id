import { useParams, useLocation } from 'wouter';
import { useGetProducteur, useDeleteProducteur } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  AlertTriangle,
  ArrowLeft,
  Pencil,
  Trash2,
  User,
  MapPin,
  Phone,
  CheckCircle2,
  Clock,
  Ban,
  ImageOff,
  Loader2,
  CreditCard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSignedPhotoUrl } from '@/hooks/use-signed-photo-url';
import { useToast } from '@/hooks/use-toast';
import { FarmsManager } from '@/components/FarmsManager';

/** Renders a photo from a signed object-storage URL with loading/error states. */
function ObjectPhoto({
  objectPath,
  alt,
  className,
}: {
  objectPath: string | null | undefined;
  alt: string;
  className?: string;
}) {
  const { signedUrl, isLoading, isError, invalidate } = useSignedPhotoUrl(objectPath);
  if (!objectPath) return null;
  if (isLoading)
    return (
      <div className={`flex items-center justify-center bg-gray-100 ${className}`}>
        <Loader2 className="w-5 h-5 text-gray-400 animate-spin" />
      </div>
    );
  if (isError || !signedUrl)
    return (
      <div className={`flex flex-col items-center justify-center bg-red-50 gap-1 ${className}`}>
        <ImageOff className="w-5 h-5 text-red-300" />
        <span className="text-[10px] text-red-400">Introuvable</span>
      </div>
    );
  return <img src={signedUrl} alt={alt} className={`object-cover ${className}`} onError={invalidate} />;
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
  const { toast } = useToast();

  const { data: producteur, isLoading, isError } = useGetProducteur(id!);
  const deleteProducteur = useDeleteProducteur();

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

  return (
    <div className="flex flex-col min-h-[calc(100dvh-4rem)] bg-gray-50 pb-28">
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
            {producteur.photo_path ? (
              <ObjectPhoto objectPath={producteur.photo_path} alt={producteur.nom} className="w-full h-full" />
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
            <span className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider mb-2">
              Photo d'identité
            </span>
            {producteur.photo_path ? (
              <ObjectPhoto
                objectPath={producteur.photo_path}
                alt={`${producteur.nom} ${producteur.prenoms}`}
                className="w-28 h-36 rounded-xl border"
              />
            ) : (
              <span className="text-xs text-gray-400 italic">Non fournie</span>
            )}
          </div>
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
          {(producteur.piece_recto || producteur.piece_verso) && (
            <div className="py-3 space-y-3">
              <p className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider">
                Scan de la pièce
              </p>
              <div className="grid grid-cols-2 gap-3">
                {producteur.piece_recto && (
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 font-medium">Recto</p>
                    <ObjectPhoto
                      objectPath={producteur.piece_recto}
                      alt="Recto pièce d'identité"
                      className="w-full rounded-xl border aspect-[3/2]"
                    />
                  </div>
                )}
                {producteur.piece_verso && (
                  <div className="space-y-1">
                    <p className="text-xs text-gray-500 font-medium">Verso</p>
                    <ObjectPhoto
                      objectPath={producteur.piece_verso}
                      alt="Verso pièce d'identité"
                      className="w-full rounded-xl border aspect-[3/2]"
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

      {/* Exploitations & Parcelles */}
      <div className="px-4 pb-4">
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 bg-[#1B5E20] text-white px-4 py-3">
            <span className="text-sm">🌱</span>
            <h3 className="font-bold text-sm uppercase tracking-wider">Exploitations agricoles</h3>
          </div>
          <div className="p-4">
            <FarmsManager producteurId={id!} />
          </div>
        </div>
      </div>

      {/* Fixed bottom action bar — au-dessus de la barre de navigation (bottom-16 = 64px) */}
      <div className="fixed bottom-16 left-0 right-0 bg-white border-t shadow-[0_-4px_10px_rgba(0,0,0,0.06)] p-4 z-30 flex gap-3">
        {/* Supprimer */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              className="h-14 px-4 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 rounded-xl flex items-center gap-2 shrink-0"
            >
              <Trash2 className="w-5 h-5" />
              Supprimer
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer ce dossier ?</AlertDialogTitle>
              <AlertDialogDescription>
                Le dossier de <strong>{producteur.nom} {producteur.prenoms}</strong> ({producteur.numero_membre}) sera
                définitivement supprimé. Cette action est irréversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() => {
                  deleteProducteur.mutate(
                    { id: id! },
                    {
                      onSuccess: () => {
                        toast({ title: 'Dossier supprimé', description: `${producteur.nom} ${producteur.prenoms} a été retiré du registre.` });
                        setLocation('/mes-producteurs');
                      },
                      onError: () => {
                        toast({ title: 'Erreur', description: 'Impossible de supprimer ce dossier.', variant: 'destructive' });
                      },
                    }
                  );
                }}
              >
                {deleteProducteur.isPending
                  ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Suppression…</>
                  : 'Oui, supprimer'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Carte */}
        <Button
          variant="outline"
          className="h-14 px-4 border-[#1B5E20] text-[#1B5E20] hover:bg-[#E8F5E9] rounded-xl flex items-center gap-2 shrink-0"
          onClick={() => setLocation(`/producteurs/${id}/carte`)}
        >
          <CreditCard className="w-5 h-5" />
          Carte
        </Button>

        {/* Modifier */}
        <Button
          className="flex-1 h-14 text-base bg-[#F57C00] hover:bg-[#E65100] text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2"
          onClick={() => setLocation(`/producteurs/${id}/modifier`)}
        >
          <Pencil className="w-5 h-5" />
          Modifier
        </Button>
      </div>
    </div>
  );
}
