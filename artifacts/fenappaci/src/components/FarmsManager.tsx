/**
 * FarmsManager — Gestion des exploitations/parcelles dans la fiche producteur
 * Affichage en arbre + CRUD complet en ligne.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Plus, Pencil, Trash2, Leaf, MapPin, ChevronDown, ChevronUp,
  CheckCircle2, Loader2, ArrowLeft, Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// ── Types ──────────────────────────────────────────────────────────────────────
interface Plot {
  id: number; farm_id: number; reference: string | null;
  culture_principale: string | null; superficie: number | null;
  annee_plantation: number | null; age_plantation: number | null;
  etat: string | null; latitude: number | null; longitude: number | null;
}

interface Farm {
  id: number; producteur_id: number; nom: string | null; localite: string | null;
  superficie_ha: number | null; statut_foncier: string | null;
  annee_creation: number | null; latitude: number | null; longitude: number | null;
  observations: string | null; plots: Plot[];
}

const STATUTS = ['Propriétaire', 'Héritage', 'Location', 'Mise à disposition', 'Autre'];
const ETATS = ['Très bon', 'Bon', 'Moyen', 'Mauvais'];

// ── API helpers ────────────────────────────────────────────────────────────────
async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...opts });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Erreur serveur');
  return data;
}

// ── GPS ────────────────────────────────────────────────────────────────────────
function GpsBtn({ lat, lon, onCaptured }: { lat: number | null; lon: number | null; onCaptured: (lat: number, lon: number) => void }) {
  const [loading, setLoading] = useState(false);
  const capture = () => {
    if (!navigator.geolocation) return;
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      p => { onCaptured(p.coords.latitude, p.coords.longitude); setLoading(false); },
      () => setLoading(false),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };
  return (
    <button type="button" onClick={capture} disabled={loading}
      className={cn("w-full h-10 rounded-xl border-2 font-semibold text-xs flex items-center justify-center gap-2 transition-all",
        lat !== null ? "bg-[#E8F5E9] border-[#2E7D32] text-[#1B5E20]" : "bg-white border-[#F57C00] text-[#E65100] hover:bg-[#FFF3E0]",
        loading && "opacity-60 cursor-not-allowed")}>
      {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Localisation…</>
        : lat !== null ? <><CheckCircle2 className="w-3.5 h-3.5" /> GPS capturé ({lat.toFixed(4)}°, {lon!.toFixed(4)}°)</>
        : <><MapPin className="w-3.5 h-3.5" /> Capturer la position GPS</>}
    </button>
  );
}

const FL = ({ children }: { children: React.ReactNode }) => (
  <label className="text-xs uppercase font-semibold text-gray-500 mb-1 block">{children}</label>
);

// ── PlotForm ───────────────────────────────────────────────────────────────────
function PlotForm({ init, onSave, onCancel, saving }: {
  init: Partial<Plot>; onSave: (d: Record<string, unknown>) => void; onCancel: () => void; saving: boolean;
}) {
  const [d, setD] = useState({
    reference: init.reference ?? '', culture_principale: init.culture_principale ?? '',
    superficie: init.superficie != null ? String(init.superficie) : '',
    annee_plantation: init.annee_plantation != null ? String(init.annee_plantation) : '',
    age_plantation: init.age_plantation != null ? String(init.age_plantation) : '',
    etat: init.etat ?? '', latitude: init.latitude ?? null, longitude: init.longitude ?? null,
  });
  const s = (k: string, v: unknown) => setD(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-3 pt-2">
      <div className="space-y-1"><FL>Référence</FL>
        <Input className="h-10 bg-gray-50/50 text-sm" value={d.reference} onChange={e => s('reference', e.target.value)} placeholder="P-01" />
      </div>
      <div className="space-y-1"><FL>Culture principale</FL>
        <Input className="h-10 bg-gray-50/50 text-sm" value={d.culture_principale} onChange={e => s('culture_principale', e.target.value)} placeholder="Cacao, Café, Maïs…" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1"><FL>Superficie (ha)</FL>
          <Input type="number" min="0" step="0.01" className="h-10 bg-gray-50/50 text-sm" value={d.superficie} onChange={e => s('superficie', e.target.value)} />
        </div>
        <div className="space-y-1"><FL>Année plant.</FL>
          <Input type="number" className="h-10 bg-gray-50/50 text-sm" value={d.annee_plantation} onChange={e => s('annee_plantation', e.target.value)} placeholder="2018" />
        </div>
      </div>
      <div className="space-y-1"><FL>Âge de la plantation (ans)</FL>
        <Input type="number" min="0" className="h-10 bg-gray-50/50 text-sm" value={d.age_plantation} onChange={e => s('age_plantation', e.target.value)} />
      </div>
      <div className="space-y-1"><FL>État de la parcelle</FL>
        <div className="grid grid-cols-2 gap-2">
          {ETATS.map(opt => (
            <button key={opt} type="button" onClick={() => s('etat', opt)}
              className={cn("h-10 rounded-xl text-xs font-semibold border transition-all",
                d.etat === opt ? "bg-[#2E7D32] text-white border-[#2E7D32]" : "bg-white text-gray-500 border-gray-200")}>
              {opt}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1"><FL>GPS</FL>
        <GpsBtn lat={d.latitude} lon={d.longitude} onCaptured={(lat, lon) => setD(p => ({ ...p, latitude: lat, longitude: lon }))} />
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="flex-1 h-10 text-sm" onClick={onCancel} disabled={saving}>Annuler</Button>
        <Button type="button" className="flex-1 h-10 text-sm bg-[#2E7D32] hover:bg-[#1B5E20] text-white" disabled={saving}
          onClick={() => onSave({
            reference: d.reference || undefined,
            culture_principale: d.culture_principale || undefined,
            superficie: d.superficie ? parseFloat(d.superficie) : undefined,
            annee_plantation: d.annee_plantation ? parseInt(d.annee_plantation) : undefined,
            age_plantation: d.age_plantation ? parseInt(d.age_plantation) : undefined,
            etat: d.etat || undefined,
            latitude: d.latitude ?? undefined,
            longitude: d.longitude ?? undefined,
          })}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enregistrer'}
        </Button>
      </div>
    </div>
  );
}

// ── FarmForm ───────────────────────────────────────────────────────────────────
function FarmForm({ init, onSave, onCancel, saving }: {
  init: Partial<Farm>; onSave: (d: Record<string, unknown>) => void; onCancel: () => void; saving: boolean;
}) {
  const [d, setD] = useState({
    nom: init.nom ?? '', localite: init.localite ?? '',
    superficie_ha: init.superficie_ha != null ? String(init.superficie_ha) : '',
    statut_foncier: init.statut_foncier ?? '',
    annee_creation: init.annee_creation != null ? String(init.annee_creation) : '',
    observations: init.observations ?? '',
    latitude: init.latitude ?? null, longitude: init.longitude ?? null,
  });
  const s = (k: string, v: unknown) => setD(p => ({ ...p, [k]: v }));

  return (
    <div className="space-y-3 pt-2">
      <div className="space-y-1"><FL>Nom / référence de l'exploitation</FL>
        <Input className="h-10 bg-gray-50/50 text-sm" value={d.nom} onChange={e => s('nom', e.target.value)} placeholder="Exploitation du Nord…" />
      </div>
      <div className="space-y-1"><FL>Localité</FL>
        <Input className="h-10 bg-gray-50/50 text-sm" value={d.localite} onChange={e => s('localite', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1"><FL>Superficie (ha)</FL>
          <Input type="number" min="0" step="0.01" className="h-10 bg-gray-50/50 text-sm" value={d.superficie_ha} onChange={e => s('superficie_ha', e.target.value)} />
        </div>
        <div className="space-y-1"><FL>Année de création</FL>
          <Input type="number" className="h-10 bg-gray-50/50 text-sm" value={d.annee_creation} onChange={e => s('annee_creation', e.target.value)} placeholder="2010" />
        </div>
      </div>
      <div className="space-y-1"><FL>Statut foncier</FL>
        <Select value={d.statut_foncier || undefined} onValueChange={v => s('statut_foncier', v)}>
          <SelectTrigger className="h-10 bg-gray-50/50 text-sm"><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
          <SelectContent>{STATUTS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1"><FL>GPS de l'exploitation</FL>
        <GpsBtn lat={d.latitude} lon={d.longitude} onCaptured={(lat, lon) => setD(p => ({ ...p, latitude: lat, longitude: lon }))} />
      </div>
      <div className="space-y-1"><FL>Observations</FL>
        <Textarea rows={2} className="resize-none bg-gray-50/50 text-sm" value={d.observations} onChange={e => s('observations', e.target.value)} />
      </div>
      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="flex-1 h-10 text-sm" onClick={onCancel} disabled={saving}>Annuler</Button>
        <Button type="button" className="flex-1 h-10 text-sm bg-[#F57C00] hover:bg-[#E65100] text-white font-bold" disabled={saving}
          onClick={() => onSave({
            nom: d.nom || undefined, localite: d.localite || undefined,
            superficie_ha: d.superficie_ha ? parseFloat(d.superficie_ha) : undefined,
            statut_foncier: d.statut_foncier || undefined,
            annee_creation: d.annee_creation ? parseInt(d.annee_creation) : undefined,
            observations: d.observations || undefined,
            latitude: d.latitude ?? undefined,
            longitude: d.longitude ?? undefined,
          })}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enregistrer l\'exploitation'}
        </Button>
      </div>
    </div>
  );
}

// ── PlotRow ────────────────────────────────────────────────────────────────────
function PlotRow({ plot, farmId, qc }: { plot: Plot; farmId: number; qc: ReturnType<typeof useQueryClient> }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);

  const update = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiFetch(`/api/plots/${plot.id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['farms'] }); setEditing(false); },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  const del = useMutation({
    mutationFn: () => apiFetch(`/api/plots/${plot.id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['farms'] }),
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  if (editing) {
    return (
      <div className="ml-6 mt-2 bg-white border rounded-xl p-3">
        <div className="flex items-center gap-2 mb-2">
          <button type="button" onClick={() => setEditing(false)} className="p-0.5 rounded hover:bg-gray-100">
            <ArrowLeft className="w-3.5 h-3.5 text-gray-500" />
          </button>
          <span className="text-xs font-bold text-gray-600">Modifier la parcelle</span>
        </div>
        <PlotForm init={plot} onSave={d => update.mutate(d)} onCancel={() => setEditing(false)} saving={update.isPending} />
      </div>
    );
  }

  return (
    <div className="ml-6 flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0">
      <Leaf className="w-3 h-3 text-[#2E7D32] shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-xs font-semibold text-gray-700">{plot.reference || 'Parcelle'}</span>
        {plot.culture_principale && <span className="text-xs text-gray-500 ml-1">· {plot.culture_principale}</span>}
        {plot.superficie != null && <span className="text-xs text-gray-400 ml-1">· {plot.superficie} ha</span>}
        {plot.etat && <span className={cn("ml-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
          plot.etat === 'Très bon' || plot.etat === 'Bon' ? 'bg-green-100 text-green-700' :
          plot.etat === 'Moyen' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700')}>
          {plot.etat}
        </span>}
      </div>
      <button type="button" onClick={() => setEditing(true)} className="p-1 rounded hover:bg-gray-100 shrink-0">
        <Pencil className="w-3 h-3 text-[#1B5E20]" />
      </button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <button type="button" className="p-1 rounded hover:bg-red-50 shrink-0">
            <Trash2 className="w-3 h-3 text-red-500" />
          </button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette parcelle ?</AlertDialogTitle>
            <AlertDialogDescription>La parcelle « {plot.reference || 'sans référence'} » sera définitivement supprimée.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => del.mutate()}>
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── FarmCard ───────────────────────────────────────────────────────────────────
function FarmCard({ farm, producteurId, qc }: { farm: Farm; producteurId: string; qc: ReturnType<typeof useQueryClient> }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [addingPlot, setAddingPlot] = useState(false);

  const update = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiFetch(`/api/farms/${farm.id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['farms'] }); setEditing(false); },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  const del = useMutation({
    mutationFn: () => apiFetch(`/api/farms/${farm.id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['farms'] }),
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  const addPlot = useMutation({
    mutationFn: (data: Record<string, unknown>) => apiFetch(`/api/farms/${farm.id}/plots`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['farms'] }); setAddingPlot(false); },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-9 h-9 rounded-full bg-[#1B5E20] text-white flex items-center justify-center shrink-0">
          <Building2 className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-800 text-sm truncate">{farm.nom || 'Exploitation sans nom'}</p>
          <p className="text-xs text-gray-500 truncate">
            {farm.localite || '—'}{farm.superficie_ha != null ? ` · ${farm.superficie_ha} ha` : ''}
            {farm.statut_foncier ? ` · ${farm.statut_foncier}` : ''}
          </p>
          <p className="text-xs text-gray-400">{farm.plots.length} parcelle{farm.plots.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-1 shrink-0">
          <button type="button" onClick={() => { setEditing(true); setOpen(true); }} className="p-1.5 rounded-lg border hover:bg-gray-50">
            <Pencil className="w-3.5 h-3.5 text-[#1B5E20]" />
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button type="button" className="p-1.5 rounded-lg border hover:bg-red-50">
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer l'exploitation ?</AlertDialogTitle>
                <AlertDialogDescription>
                  « {farm.nom || 'Exploitation sans nom'} » et ses {farm.plots.length} parcelle{farm.plots.length !== 1 ? 's' : ''} seront supprimées définitivement.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => del.mutate()}>Supprimer</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <button type="button" onClick={() => setOpen(o => !o)} className="p-1.5 rounded-lg border hover:bg-gray-50">
            {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded body */}
      {open && (
        <div className="border-t bg-gray-50 px-4 py-3 space-y-3">
          {editing ? (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <button type="button" onClick={() => setEditing(false)} className="p-0.5 rounded hover:bg-gray-200">
                  <ArrowLeft className="w-3.5 h-3.5 text-gray-500" />
                </button>
                <span className="text-xs font-bold text-gray-600">Modifier l'exploitation</span>
              </div>
              <FarmForm init={farm} onSave={d => update.mutate(d)} onCancel={() => setEditing(false)} saving={update.isPending} />
            </div>
          ) : (
            <>
              {/* Details */}
              {farm.observations && (
                <p className="text-xs text-gray-600 italic bg-white rounded-xl p-2 border">📝 {farm.observations}</p>
              )}
              {farm.latitude != null && farm.longitude != null && (
                <p className="text-xs text-[#1B5E20] font-mono">
                  📍 {farm.latitude.toFixed(5)}°, {farm.longitude.toFixed(5)}°
                </p>
              )}

              {/* Plots */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Parcelles ({farm.plots.length})
                </p>
                {farm.plots.map(p => (
                  <PlotRow key={p.id} plot={p} farmId={farm.id} qc={qc} />
                ))}

                {addingPlot ? (
                  <div className="mt-2 bg-white border rounded-xl p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <button type="button" onClick={() => setAddingPlot(false)} className="p-0.5 rounded hover:bg-gray-100">
                        <ArrowLeft className="w-3.5 h-3.5 text-gray-500" />
                      </button>
                      <span className="text-xs font-bold text-gray-600">Nouvelle parcelle</span>
                    </div>
                    <PlotForm init={{}} onSave={d => addPlot.mutate(d)} onCancel={() => setAddingPlot(false)} saving={addPlot.isPending} />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddingPlot(true)}
                    className="mt-2 w-full h-9 rounded-xl border border-dashed border-[#2E7D32] text-[#2E7D32] text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-[#E8F5E9] transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> + AJOUTER UNE PARCELLE
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────
export function FarmsManager({ producteurId }: { producteurId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [addingFarm, setAddingFarm] = useState(false);

  const { data: farms = [], isLoading } = useQuery<Farm[]>({
    queryKey: ['farms', producteurId],
    queryFn: () => apiFetch(`/api/producteurs/${producteurId}/farms`),
  });

  const addFarm = useMutation({
    mutationFn: (data: Record<string, unknown>) =>
      apiFetch(`/api/producteurs/${producteurId}/farms`, { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['farms'] }); setAddingFarm(false); },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  return (
    <div className="space-y-3">
      {isLoading && (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-[#1B5E20]" />
        </div>
      )}

      {!isLoading && farms.length === 0 && !addingFarm && (
        <div className="text-center py-6 text-gray-400 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <Leaf className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm font-medium">Aucune exploitation enregistrée</p>
        </div>
      )}

      {farms.map(f => <FarmCard key={f.id} farm={f} producteurId={producteurId} qc={qc} />)}

      {addingFarm ? (
        <div className="bg-white border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <button type="button" onClick={() => setAddingFarm(false)} className="p-1 rounded-full hover:bg-gray-100">
              <ArrowLeft className="w-4 h-4 text-gray-500" />
            </button>
            <span className="font-bold text-gray-700 text-sm">Nouvelle exploitation</span>
          </div>
          <FarmForm init={{}} onSave={d => addFarm.mutate(d)} onCancel={() => setAddingFarm(false)} saving={addFarm.isPending} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAddingFarm(true)}
          className="w-full h-12 rounded-2xl border-2 border-dashed border-[#F57C00] text-[#E65100] font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#FFF3E0] transition-colors"
        >
          <Plus className="w-4 h-4" /> + AJOUTER UNE EXPLOITATION
        </button>
      )}
    </div>
  );
}
