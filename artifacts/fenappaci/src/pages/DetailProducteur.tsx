import { useCallback, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useGetProducteur, useDeleteProducteur } from '@workspace/api-client-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  ShoppingCart,
  Download,
  Printer,
  Plus,
  Archive,
} from 'lucide-react';
import JSZip from 'jszip';
import { cn } from '@/lib/utils';
import { useSignedPhotoUrl } from '@/hooks/use-signed-photo-url';
import { useToast } from '@/hooks/use-toast';
import { FarmsManager } from '@/components/FarmsManager';
import { useAuth } from '@/contexts/AuthContext';

/** Download an image via its signed URL by fetching it as a blob (works cross-origin). */
async function downloadSignedImage(signedUrl: string, filename: string) {
  try {
    const res = await fetch(signedUrl);
    if (!res.ok) return;
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
  } catch {
    // Silently ignore — the signed URL may have expired; the user can retry.
  }
}

/**
 * Fetch a fresh signed URL for one object path from the API.
 * Returns null when the object is missing or access is denied.
 */
async function fetchSignedUrl(objectPath: string): Promise<string | null> {
  try {
    const res = await fetch(
      `/api/storage/signed-url?path=${encodeURIComponent(objectPath)}`,
      { credentials: 'include' },
    );
    if (!res.ok) return null;
    const { signedUrl } = await res.json();
    return signedUrl as string;
  } catch {
    return null;
  }
}

/**
 * Download all available photos for a producer as a single ZIP archive.
 * `photos` is an array of `{ objectPath, filename }` entries; entries whose
 * objectPath is null/undefined are silently skipped.
 */
async function downloadPhotosAsZip(
  photos: Array<{ objectPath: string | null | undefined; filename: string }>,
  zipFilename: string,
): Promise<void> {
  const zip = new JSZip();

  await Promise.all(
    photos.map(async ({ objectPath, filename }) => {
      if (!objectPath) return;
      const signedUrl = await fetchSignedUrl(objectPath);
      if (!signedUrl) return;
      try {
        const res = await fetch(signedUrl);
        if (!res.ok) return;
        const blob = await res.blob();
        zip.file(filename, blob);
      } catch {
        // Skip unavailable photos silently.
      }
    }),
  );

  const content = await zip.generateAsync({ type: 'blob' });
  const objectUrl = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = zipFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}

interface DispoItem {
  production_id: number;
  culture: string | null;
  campagne: string | null;
  quantite_disponible: number | null;
  quantite_vente: number | null;
  unite: string | null;
  recherche_acheteur: string | null;
  prix_souhaite: number | null;
  periode_disponibilite: string | null;
  producteur: { id: number; telephone: string | null; [key: string]: unknown };
}

async function fetchDisposByProducteur(producteurId: string): Promise<DispoItem[]> {
  const res = await fetch(`/api/disponibilites?producteur_id=${producteurId}`, { credentials: 'include' });
  if (!res.ok) throw new Error('Erreur serveur');
  return res.json();
}

// ── Types for Add-Dispo form ───────────────────────────────────────────────────
interface PlotOption { id: number; label: string; }

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...opts });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Erreur serveur');
  return data;
}

const UNITES = ['Kg', 'Tonnes', 'Sacs', 'Litres', 'Autre'];
const FL = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
  <label className="text-xs uppercase font-semibold text-gray-500 mb-1 block">
    {children}{required && <span className="text-red-400 ml-0.5">*</span>}
  </label>
);

/**
 * Formulaire simplifié d'ajout d'une disponibilité, affiché inline dans le bloc
 * "Disponibilités à la vente" de la fiche producteur.
 */
function AddDispoForm({ producteurId, onClose, onSuccess }: {
  producteurId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { toast } = useToast();
  const [plotId, setPlotId] = useState<string>('');
  const [d, setD] = useState({
    culture: '',
    quantite_disponible: '',
    quantite_vente: '',
    unite: 'Kg',
    prix_souhaite: '',
    periode_disponibilite: '',
    recherche_acheteur: 'NON',
  });

  // Fetch farms with plots for this producer
  const { data: farms = [], isLoading: farmsLoading } = useQuery<Array<{ id: number; nom: string | null; localite: string | null; plots: Array<{ id: number; reference: string | null; culture_principale: string | null }> }>>({
    queryKey: ['farms', producteurId],
    queryFn: () => apiFetch(`/api/producteurs/${producteurId}/farms`),
    enabled: !!producteurId,
  });

  // Flatten to plot options with human-readable labels
  const plotOptions: PlotOption[] = farms.flatMap(farm =>
    farm.plots.map(plot => ({
      id: plot.id,
      label: [
        farm.nom ?? farm.localite ?? `Exploitation #${farm.id}`,
        plot.reference ?? plot.culture_principale ?? `Parcelle #${plot.id}`,
      ].join(' › '),
    }))
  );

  const s = (k: string, v: string) => setD(p => ({ ...p, [k]: v }));
  const num = (v: string) => v !== '' ? parseFloat(v) : undefined;

  const addMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiFetch(`/api/plots/${plotId}/productions`, { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => {
      toast({ title: 'Disponibilité ajoutée', description: `La disponibilité en ${d.culture} a été enregistrée.` });
      onSuccess();
    },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  const handleSubmit = () => {
    if (!plotId) {
      toast({ title: 'Parcelle requise', description: 'Veuillez sélectionner une parcelle.', variant: 'destructive' });
      return;
    }
    if (!d.culture.trim()) {
      toast({ title: 'Culture requise', description: 'Veuillez indiquer la culture.', variant: 'destructive' });
      return;
    }
    const qte = parseFloat(d.quantite_disponible);
    if (!d.quantite_disponible || isNaN(qte) || qte <= 0) {
      toast({ title: 'Quantité invalide', description: 'La quantité disponible doit être supérieure à zéro.', variant: 'destructive' });
      return;
    }
    addMutation.mutate({
      culture: d.culture.trim(),
      quantite_disponible: num(d.quantite_disponible),
      quantite_vente: num(d.quantite_vente),
      unite: d.unite,
      prix_souhaite: num(d.prix_souhaite),
      periode_disponibilite: d.periode_disponibilite.trim() || undefined,
      recherche_acheteur: d.recherche_acheteur,
    });
  };

  if (farmsLoading) {
    return (
      <div className="px-4 py-4 flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        Chargement des parcelles…
      </div>
    );
  }

  if (plotOptions.length === 0) {
    return (
      <div className="px-4 py-4 space-y-3">
        <p className="text-sm text-gray-600">
          Ce producteur n'a pas encore de parcelle. Ajoutez d'abord une exploitation et une parcelle dans le bloc <strong>Exploitations agricoles</strong>.
        </p>
        <Button type="button" variant="outline" className="h-9 text-sm w-full" onClick={onClose}>
          Fermer
        </Button>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 bg-[#FFF8F0] border-t border-[#FFE0B2] space-y-3">
      {/* Header with back button */}
      <div className="flex items-center gap-2">
        <button type="button" onClick={onClose} className="p-1 rounded hover:bg-orange-100">
          <ArrowLeft className="w-4 h-4 text-gray-600" />
        </button>
        <span className="text-sm font-bold text-gray-700">Nouvelle disponibilité</span>
      </div>

      {/* Parcelle selector */}
      <div className="space-y-1">
        <FL required>Parcelle</FL>
        <Select value={plotId} onValueChange={setPlotId}>
          <SelectTrigger className="h-10 bg-white text-sm">
            <SelectValue placeholder="Choisir une parcelle…" />
          </SelectTrigger>
          <SelectContent>
            {plotOptions.map(p => (
              <SelectItem key={p.id} value={String(p.id)}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Culture */}
      <div className="space-y-1">
        <FL required>Culture</FL>
        <Input
          className="h-10 bg-white text-sm"
          placeholder="Cacao, Café, Hévéa…"
          value={d.culture}
          onChange={e => s('culture', e.target.value)}
        />
      </div>

      {/* Quantité + unité */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <FL>Qté disponible</FL>
          <Input
            type="number" min="0" step="0.01"
            className="h-10 bg-white text-sm"
            placeholder="0"
            value={d.quantite_disponible}
            onChange={e => s('quantite_disponible', e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <FL>Unité</FL>
          <Select value={d.unite} onValueChange={v => s('unite', v)}>
            <SelectTrigger className="h-10 bg-white text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {UNITES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Qté à vendre + prix */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <FL>Qté à vendre</FL>
          <Input
            type="number" min="0" step="0.01"
            className="h-10 bg-white text-sm"
            placeholder="0"
            value={d.quantite_vente}
            onChange={e => s('quantite_vente', e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <FL>Prix souhaité (FCFA)</FL>
          <Input
            type="number" min="0" step="1"
            className="h-10 bg-white text-sm"
            placeholder="0"
            value={d.prix_souhaite}
            onChange={e => s('prix_souhaite', e.target.value)}
          />
        </div>
      </div>

      {/* Période */}
      <div className="space-y-1">
        <FL>Période de disponibilité</FL>
        <Input
          className="h-10 bg-white text-sm"
          placeholder="Jan–Mar"
          value={d.periode_disponibilite}
          onChange={e => s('periode_disponibilite', e.target.value)}
        />
      </div>

      {/* Recherche acheteur */}
      <div className="space-y-1">
        <FL>Recherche acheteur</FL>
        <div className="grid grid-cols-2 gap-2">
          {['OUI', 'NON'].map(opt => (
            <button key={opt} type="button" onClick={() => s('recherche_acheteur', opt)}
              className={cn('h-10 rounded-xl font-bold text-sm border transition-all',
                d.recherche_acheteur === opt
                  ? opt === 'OUI' ? 'bg-[#F57C00] text-white border-[#F57C00]' : 'bg-gray-700 text-white border-gray-700'
                  : 'bg-white text-gray-500 border-gray-200')}>
              {opt}
            </button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="flex-1 h-10 text-sm" onClick={onClose} disabled={addMutation.isPending}>
          Annuler
        </Button>
        <Button
          type="button"
          disabled={addMutation.isPending || !d.culture.trim() || !plotId || !d.quantite_disponible || parseFloat(d.quantite_disponible) <= 0}
          className="flex-1 h-10 text-sm bg-[#F57C00] hover:bg-[#E65100] text-white"
          onClick={handleSubmit}
        >
          {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enregistrer'}
        </Button>
      </div>
    </div>
  );
}

/**
 * Renders a photo from a signed object-storage URL with loading/error states.
 * When `downloadFilename` is provided, shows a "Télécharger" button beneath
 * the image once it has loaded (hidden during printing).
 */
function ObjectPhoto({
  objectPath,
  alt,
  className,
  downloadFilename,
}: {
  objectPath: string | null | undefined;
  alt: string;
  className?: string;
  downloadFilename?: string;
}) {
  const { signedUrl, isLoading, isError, invalidate } = useSignedPhotoUrl(objectPath);

  const handleDownload = useCallback(() => {
    if (!signedUrl || !downloadFilename) return;
    downloadSignedImage(signedUrl, downloadFilename);
  }, [signedUrl, downloadFilename]);

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
  return (
    <div className="flex flex-col gap-1.5">
      <img src={signedUrl} alt={alt} className={`object-cover ${className}`} onError={invalidate} />
      {downloadFilename && (
        <button
          type="button"
          onClick={handleDownload}
          className="print:hidden self-start flex items-center gap-1 text-[11px] text-[#1B5E20] font-semibold hover:underline focus:outline-none"
        >
          <Download className="w-3 h-3" />
          Télécharger
        </button>
      )}
    </div>
  );
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

const PRIVILEGED_ROLES = ['DIRECTION', 'ADMIN'] as const;

export default function DetailProducteur() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: producteur, isLoading, isError } = useGetProducteur(id!);
  const deleteProducteur = useDeleteProducteur();
  const qc = useQueryClient();

  /** Direction and Admin can download/print sensitive documents. */
  const isPrivileged = !!user && PRIVILEGED_ROLES.includes(user.role as typeof PRIVILEGED_ROLES[number]);

  const [addingDispo, setAddingDispo] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

  const { data: dispos = [] } = useQuery<DispoItem[]>({
    queryKey: ['disponibilites', id],
    queryFn: () => fetchDisposByProducteur(id!),
    enabled: !!id,
  });

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

  /** Sanitised producer name used as part of download filenames. */
  const safeName = `${producteur.nom ?? ''}_${producteur.prenoms ?? ''}`
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-ZÀ-ÿ0-9_-]/g, '');

  return (
    <>
      {/* ── Print-only styles ─────────────────────────────────────────────── */}
      <style>{`
        @media print {
          @page { margin: 1.5cm; size: A4 portrait; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

    <div className="flex flex-col min-h-[calc(100dvh-4rem)] bg-gray-50 pb-28">
      {/* Header */}
      <div className="print:hidden bg-[#1B5E20] px-4 py-3 text-white flex items-center gap-3 sticky top-0 z-10 shadow-md">
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
                downloadFilename={isPrivileged ? `photo_${safeName}.jpg` : undefined}
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
                      downloadFilename={isPrivileged ? `piece_recto_${safeName}.jpg` : undefined}
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
                      downloadFilename={isPrivileged ? `piece_verso_${safeName}.jpg` : undefined}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
          {isPrivileged && (producteur.photo_path || producteur.piece_recto || producteur.piece_verso) && (
            <div className="py-3 border-t border-gray-100 print:hidden">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isZipping}
                className="flex items-center gap-2 text-[#1B5E20] border-[#1B5E20]/30 hover:bg-[#1B5E20]/5 hover:border-[#1B5E20]/60"
                onClick={async () => {
                  setIsZipping(true);
                  try {
                    await downloadPhotosAsZip(
                      [
                        { objectPath: producteur.photo_path,  filename: `photo_identite_${safeName}.jpg` },
                        { objectPath: producteur.piece_recto, filename: `piece_recto_${safeName}.jpg` },
                        { objectPath: producteur.piece_verso, filename: `piece_verso_${safeName}.jpg` },
                      ],
                      `dossier_${safeName}.zip`,
                    );
                  } finally {
                    setIsZipping(false);
                  }
                }}
              >
                {isZipping
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Préparation…</>
                  : <><Archive className="w-4 h-4" /> Télécharger tout</>
                }
              </Button>
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

      {/* Disponibilités à la vente */}
      <div className="px-4">
        <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between bg-[#F57C00] text-white px-4 py-2.5">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              <span className="font-bold text-sm uppercase tracking-wider">Disponibilités à la vente</span>
            </div>
            <div className="flex items-center gap-2">
              {dispos.length > 0 && (
                <span className="text-white/80 text-xs font-medium">{dispos.length} production{dispos.length > 1 ? 's' : ''}</span>
              )}
              {user && !addingDispo && (
                <button
                  type="button"
                  onClick={() => setAddingDispo(true)}
                  className="flex items-center gap-1 bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-2 py-1 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Ajouter
                </button>
              )}
            </div>
          </div>

          {/* Add form — only for authenticated users */}
          {addingDispo && user && (
            <AddDispoForm
              producteurId={id!}
              onClose={() => setAddingDispo(false)}
              onSuccess={() => {
                setAddingDispo(false);
                qc.invalidateQueries({ queryKey: ['disponibilites', id] });
              }}
            />
          )}

          {/* List of existing dispos */}
          {dispos.length > 0 ? (
            <div className="divide-y divide-gray-100">
              {dispos.map(item => (
                <div key={item.production_id} className="px-4 py-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-gray-900 text-sm uppercase tracking-wide">
                      {item.culture ?? '—'}
                    </p>
                    <div className="text-right shrink-0">
                      <span className="font-black text-[#F57C00] text-base">
                        {item.quantite_disponible != null ? item.quantite_disponible.toLocaleString('fr-FR') : '—'}
                      </span>
                      <span className="text-xs text-gray-500 ml-1">{item.unite ?? 'Kg'}</span>
                    </div>
                  </div>
                  <div className="flex gap-3 flex-wrap text-xs">
                    {item.prix_souhaite != null && (
                      <span className="text-gray-700 font-semibold">
                        💰 {item.prix_souhaite.toLocaleString('fr-FR')} FCFA/{item.unite ?? 'Kg'}
                      </span>
                    )}
                    {item.periode_disponibilite && (
                      <span className="text-gray-500">📅 {item.periode_disponibilite}</span>
                    )}
                    {item.campagne && (
                      <span className="text-gray-400">Campagne {item.campagne}</span>
                    )}
                  </div>
                  {item.recherche_acheteur === 'OUI' && (
                    <Badge className="bg-[#FFF3E0] text-[#E65100] border border-[#FFE0B2] text-[10px] flex items-center gap-1 w-fit">
                      <ShoppingCart className="w-2.5 h-2.5" />
                      Recherche acheteur
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          ) : (
            !addingDispo && (
              <div className="px-4 py-4 text-sm text-gray-400 italic text-center">
                Aucune disponibilité enregistrée
              </div>
            )
          )}

          {/* Call CTA */}
          {producteur.telephone && (
            <div className="px-4 py-3 border-t border-gray-100 bg-[#F1F8E9]">
              <a
                href={`tel:${producteur.telephone}`}
                className="flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-[#1B5E20] text-white font-bold text-sm hover:bg-[#2E7D32] transition-colors"
              >
                <Phone className="w-4 h-4" />
                Appeler ce producteur
              </a>
            </div>
          )}
        </div>
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
      <div className="print:hidden fixed bottom-16 left-0 right-0 bg-white border-t shadow-[0_-4px_10px_rgba(0,0,0,0.06)] p-4 z-30 flex gap-3">
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

        {/* Imprimer — Direction / Admin uniquement */}
        {isPrivileged && (
          <Button
            variant="outline"
            className="h-14 px-4 border-gray-200 text-gray-700 hover:bg-gray-50 rounded-xl flex items-center gap-2 shrink-0"
            onClick={() => window.print()}
          >
            <Printer className="w-5 h-5" />
            Imprimer
          </Button>
        )}

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
    </>
  );
}
