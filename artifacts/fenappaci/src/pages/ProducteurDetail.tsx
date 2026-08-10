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
  ArrowLeft, Pencil, Trash2, User, Phone, MapPin, FileText,
  Building2, Leaf, CheckCircle2, AlertTriangle,
  Navigation, Loader2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function val(v: unknown): string | null {
  if (v == null || v === '') return null;
  return String(v);
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex flex-col py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider">{label}</span>
      <span className="text-sm font-medium text-gray-900 mt-0.5">{value}</span>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 bg-[#1B5E20] text-white px-4 py-3">
        {icon}
        <h3 className="font-bold text-sm uppercase tracking-wider">{title}</h3>
      </div>
      <div className="px-4">{children}</div>
    </div>
  );
}

function PhotoBadge({ objectPath, label }: { objectPath: string | null | undefined; label: string }) {
  if (!objectPath) return (
    <div className="flex items-center gap-2 py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider w-24">{label}</span>
      <span className="text-xs text-gray-400 italic">Non fourni</span>
    </div>
  );
  return (
    <div className="flex items-center gap-2 py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider w-24">{label}</span>
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#2E7D32] bg-[#E8F5E9] px-2 py-1 rounded-full">
        <CheckCircle2 className="w-3 h-3" /> Photo enregistrée
      </span>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
const statusConfig: Record<string, { label: string; color: string }> = {
  ACTIF:      { label: 'Actif',      color: 'bg-[#4CAF50]' },
  EN_ATTENTE: { label: 'En attente', color: 'bg-[#F57C00]' },
  SUSPENDU:   { label: 'Suspendu',   color: 'bg-gray-400'  },
};

export default function ProducteurDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const { data: p, isLoading, isError } = useGetProducteur(id!);
  const deleteProducteur = useDeleteProducteur();

  // ─── Loading ───────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        <div className="h-32 bg-gray-200 rounded-2xl animate-pulse" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  // ─── Error ─────────────────────────────────────────────────────────────────
  if (isError || !p) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 p-6">
        <AlertTriangle className="w-12 h-12 text-red-400" />
        <p className="text-gray-600 font-medium text-center">Producteur introuvable</p>
        <Button variant="outline" onClick={() => setLocation('/mes-producteurs')}>
          Retour à la liste
        </Button>
      </div>
    );
  }

  const status = statusConfig[p.status ?? ''] ?? { label: p.status ?? '—', color: 'bg-gray-400' };

  return (
    <div className="min-h-[calc(100dvh-4rem)] flex flex-col pb-28">

      {/* ── Hero header ──────────────────────────────────────────────────── */}
      <div className="bg-[#1B5E20] px-4 pt-4 pb-6 text-white relative">
        <button
          type="button"
          onClick={() => setLocation('/mes-producteurs')}
          className="flex items-center gap-1.5 text-white/80 hover:text-white mb-4 text-sm font-medium transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Retour à la liste
        </button>

        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-white/10 border-2 border-white/30 flex-none flex items-center justify-center overflow-hidden shadow-lg">
            {p.photo_path ? (
              <img src={`/api/storage/objects${p.photo_path}`} alt={p.nom} className="w-full h-full object-cover" />
            ) : (
              <User className="w-10 h-10 text-white/60" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-black leading-tight uppercase tracking-wide">
              {p.nom}<br />
              <span className="font-semibold normal-case">{p.prenoms}</span>
            </h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="font-mono text-xs bg-white/20 px-2 py-1 rounded-full">{p.numero_membre}</span>
              <Badge className={cn('text-[10px] px-2 py-0.5', status.color)}>{status.label}</Badge>
            </div>
          </div>
        </div>

        {/* Watermark */}
        <img src="/logo-fenappaci.png" alt="" aria-hidden className="absolute bottom-2 right-4 w-12 h-12 object-contain opacity-10 pointer-events-none" />
      </div>

      {/* ── Sections ─────────────────────────────────────────────────────── */}
      <div className="p-4 space-y-4 flex-1">

        {/* IDENTITÉ */}
        <Section icon={<User className="w-4 h-4" />} title="Identité">
          <InfoRow label="Sexe" value={val(p.sexe)} />
          <InfoRow label="Date de naissance" value={val(p.date_naissance)} />
          <InfoRow label="Lieu de naissance" value={val(p.lieu_naissance)} />
          <InfoRow label="Nationalité" value={val(p.nationalite)} />
          <InfoRow label="Situation matrimoniale" value={val(p.situation_matrimoniale)} />
        </Section>

        {/* CONTACT */}
        <Section icon={<Phone className="w-4 h-4" />} title="Contact">
          <InfoRow label="Téléphone principal" value={val(p.telephone)} />
          <InfoRow label="Téléphone secondaire" value={val(p.telephone_secondaire)} />
          <InfoRow label="Adresse" value={val(p.adresse)} />
        </Section>

        {/* PIÈCE D'IDENTITÉ */}
        <Section icon={<FileText className="w-4 h-4" />} title="Pièce d'identité">
          <InfoRow label="Type" value={val(p.type_piece)} />
          <InfoRow label="Numéro" value={val(p.numero_piece)} />
          <InfoRow label="Délivrance" value={val(p.date_delivrance)} />
          <InfoRow label="Expiration" value={val(p.date_expiration)} />
          <PhotoBadge objectPath={p.piece_recto} label="Recto" />
          <PhotoBadge objectPath={p.piece_verso} label="Verso" />
        </Section>

        {/* LOCALISATION */}
        <Section icon={<MapPin className="w-4 h-4" />} title="Localisation">
          <InfoRow label="Village / Localité" value={val(p.village)} />
          <InfoRow label="Commune" value={val(p.commune)} />
          <InfoRow label="Sous-préfecture" value={val(p.sous_prefecture)} />
          <InfoRow label="Département" value={val(p.departement)} />
          <InfoRow label="Région" value={val(p.region)} />
          <InfoRow label="District" value={val(p.district)} />
          {p.latitude != null && p.longitude != null && (
            <div className="flex flex-col py-2.5 border-b border-gray-100 last:border-0">
              <span className="text-[10px] uppercase font-semibold text-gray-400 tracking-wider">GPS</span>
              <a
                href={`https://maps.google.com/?q=${p.latitude},${p.longitude}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-mono text-[#1B5E20] mt-0.5 hover:underline"
              >
                <Navigation className="w-3.5 h-3.5" />
                {Number(p.latitude).toFixed(6)}°, {Number(p.longitude).toFixed(6)}°
                {p.gps_precision != null && (
                  <span className="text-xs text-gray-500 font-sans">(±{Math.round(Number(p.gps_precision))} m)</span>
                )}
              </a>
            </div>
          )}
        </Section>

        {/* COOPÉRATIVE */}
        {(p.membre_cooperative || p.cooperative_nom || p.cooperative_nom_libre) && (
          <Section icon={<Building2 className="w-4 h-4" />} title="Coopérative">
            <InfoRow label="Membre" value={p.membre_cooperative ? 'Oui' : 'Non'} />
            <InfoRow label="Coopérative" value={val(p.cooperative_nom) ?? val(p.cooperative_nom_libre)} />
            <InfoRow label="Numéro d'identification" value={val(p.cooperative_numero_libre)} />
            <InfoRow label="Fonction" value={val(p.cooperative_fonction)} />
          </Section>
        )}

        {/* ACTIVITÉ AGRICOLE */}
        {(p.cultures || p.superficie_ha) && (
          <Section icon={<Leaf className="w-4 h-4" />} title="Activité agricole">
            <InfoRow label="Cultures" value={val(p.cultures)} />
            <InfoRow label="Superficie (ha)" value={val(p.superficie_ha)} />
          </Section>
        )}

        {/* Photos — placeholder si présentes */}
        {p.photo_path && (
          <div className="bg-[#E8F5E9] border border-[#A5D6A7] rounded-2xl px-4 py-3 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-[#2E7D32] flex-none" />
            <p className="text-sm font-medium text-[#1B5E20]">Photo d'identité enregistrée</p>
          </div>
        )}
      </div>

      {/* ── Boutons fixés en bas ─────────────────────────────────────────── */}
      <div className="fixed bottom-16 left-0 right-0 p-4 bg-white border-t shadow-[0_-4px_10px_rgba(0,0,0,0.06)] z-20 flex gap-3">
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
                Le dossier de <strong>{p?.nom} {p?.prenoms}</strong> ({p?.numero_membre}) sera
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
                        toast({ title: 'Dossier supprimé', description: `${p?.nom} ${p?.prenoms} a été retiré du registre.` });
                        setLocation('/mes-producteurs');
                      },
                      onError: () => {
                        toast({ title: 'Erreur', description: 'Impossible de supprimer ce dossier.', variant: 'destructive' });
                      },
                    }
                  );
                }}
              >
                {deleteProducteur.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Suppression…</> : 'Oui, supprimer'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Modifier */}
        <Button
          className="flex-1 h-14 text-base bg-[#F57C00] hover:bg-[#E65100] text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2"
          onClick={() => setLocation(`/producteurs/${id}/modifier`)}
        >
          <Pencil className="w-5 h-5" />
          Modifier le dossier
        </Button>
      </div>
    </div>
  );
}
