/**
 * ProductionManager — Gestion des productions agricoles d'une parcelle
 * Affiché sous chaque plot dans FarmsManager (fiche détail producteur).
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, Loader2, ChevronDown, ChevronUp, ArrowLeft, ShoppingCart, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// ── Types ──────────────────────────────────────────────────────────────────────
export interface Production {
  id: number; plot_id: number;
  culture: string | null; campagne: string | null;
  superficie_concernee: number | null;
  production_annuelle_estimee: number | null;
  production_campagne_en_cours: number | null;
  quantite_disponible: number | null;
  quantite_vente: number | null;
  capacite_livraison: number | null;
  unite: string | null;
  periode_recolte: string | null;
  periode_disponibilite: string | null;
  recherche_acheteur: string | null;
  quantite_recherchee: number | null;
  prix_souhaite: number | null;
  observations: string | null;
}

const UNITES = ['Kg', 'Tonnes', 'Sacs', 'Litres', 'Autre'];

async function apiFetch(url: string, opts?: RequestInit) {
  const res = await fetch(url, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...opts });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Erreur serveur');
  return data;
}

const FL = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
  <label className="text-xs uppercase font-semibold text-gray-500 mb-1 block">
    {children}{required && <span className="text-red-400 ml-0.5">*</span>}
  </label>
);

// ── ProductionForm ─────────────────────────────────────────────────────────────
function ProductionForm({ init, onSave, onCancel, saving }: {
  init: Partial<Production>;
  onSave: (d: Record<string, unknown>) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [d, setD] = useState({
    culture: init.culture ?? '',
    campagne: init.campagne ?? '',
    superficie_concernee: init.superficie_concernee != null ? String(init.superficie_concernee) : '',
    production_annuelle_estimee: init.production_annuelle_estimee != null ? String(init.production_annuelle_estimee) : '',
    production_campagne_en_cours: init.production_campagne_en_cours != null ? String(init.production_campagne_en_cours) : '',
    quantite_disponible: init.quantite_disponible != null ? String(init.quantite_disponible) : '',
    quantite_vente: init.quantite_vente != null ? String(init.quantite_vente) : '',
    capacite_livraison: init.capacite_livraison != null ? String(init.capacite_livraison) : '',
    unite: init.unite ?? 'Kg',
    periode_recolte: init.periode_recolte ?? '',
    periode_disponibilite: init.periode_disponibilite ?? '',
    recherche_acheteur: init.recherche_acheteur ?? 'NON',
    quantite_recherchee: init.quantite_recherchee != null ? String(init.quantite_recherchee) : '',
    prix_souhaite: init.prix_souhaite != null ? String(init.prix_souhaite) : '',
    observations: init.observations ?? '',
  });

  const s = (k: string, v: string) => setD(p => ({ ...p, [k]: v }));
  const num = (v: string) => v !== '' ? parseFloat(v) : undefined;

  return (
    <div className="space-y-3 pt-1">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1 col-span-2">
          <FL required>Culture</FL>
          <Input className="h-10 bg-gray-50/50 text-sm" placeholder="Cacao, Café, Hévéa…" value={d.culture} onChange={e => s('culture', e.target.value)} />
        </div>
        <div className="space-y-1">
          <FL>Campagne</FL>
          <Input className="h-10 bg-gray-50/50 text-sm" placeholder="2025-2026" value={d.campagne} onChange={e => s('campagne', e.target.value)} />
        </div>
        <div className="space-y-1">
          <FL>Superficie (ha)</FL>
          <Input type="number" min="0" step="0.01" className="h-10 bg-gray-50/50 text-sm" value={d.superficie_concernee} onChange={e => s('superficie_concernee', e.target.value)} />
        </div>
      </div>

      <div className="border-t pt-3">
        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2">Production</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <FL>Prod. annuelle estimée</FL>
            <Input type="number" min="0" step="0.01" className="h-10 bg-gray-50/50 text-sm" value={d.production_annuelle_estimee} onChange={e => s('production_annuelle_estimee', e.target.value)} />
          </div>
          <div className="space-y-1">
            <FL>Prod. campagne en cours</FL>
            <Input type="number" min="0" step="0.01" className="h-10 bg-gray-50/50 text-sm" value={d.production_campagne_en_cours} onChange={e => s('production_campagne_en_cours', e.target.value)} />
          </div>
          <div className="space-y-1">
            <FL>Qté disponible</FL>
            <Input type="number" min="0" step="0.01" className="h-10 bg-gray-50/50 text-sm" value={d.quantite_disponible} onChange={e => s('quantite_disponible', e.target.value)} />
          </div>
          <div className="space-y-1">
            <FL>Qté à vendre</FL>
            <Input type="number" min="0" step="0.01" className="h-10 bg-gray-50/50 text-sm" value={d.quantite_vente} onChange={e => s('quantite_vente', e.target.value)} />
          </div>
          <div className="space-y-1">
            <FL>Capacité livraison</FL>
            <Input type="number" min="0" step="0.01" className="h-10 bg-gray-50/50 text-sm" value={d.capacite_livraison} onChange={e => s('capacite_livraison', e.target.value)} />
          </div>
          <div className="space-y-1">
            <FL>Unité</FL>
            <Select value={d.unite} onValueChange={v => s('unite', v)}>
              <SelectTrigger className="h-10 bg-gray-50/50 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{UNITES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="border-t pt-3">
        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2">Calendrier</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <FL>Période de récolte</FL>
            <Input className="h-10 bg-gray-50/50 text-sm" placeholder="Oct–Déc" value={d.periode_recolte} onChange={e => s('periode_recolte', e.target.value)} />
          </div>
          <div className="space-y-1">
            <FL>Période de disponibilité</FL>
            <Input className="h-10 bg-gray-50/50 text-sm" placeholder="Jan–Mar" value={d.periode_disponibilite} onChange={e => s('periode_disponibilite', e.target.value)} />
          </div>
        </div>
      </div>

      <div className="border-t pt-3">
        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2">Recherche d'acheteur</p>
        <div className="grid grid-cols-2 gap-2">
          {['OUI', 'NON'].map(opt => (
            <button key={opt} type="button" onClick={() => s('recherche_acheteur', opt)}
              className={cn("h-10 rounded-xl font-bold text-sm border transition-all",
                d.recherche_acheteur === opt
                  ? opt === 'OUI' ? 'bg-[#F57C00] text-white border-[#F57C00]' : 'bg-gray-700 text-white border-gray-700'
                  : 'bg-white text-gray-500 border-gray-200')}>
              {opt}
            </button>
          ))}
        </div>
        {d.recherche_acheteur === 'OUI' && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="space-y-1">
              <FL>Qté recherchée</FL>
              <Input type="number" min="0" step="0.01" className="h-10 bg-gray-50/50 text-sm" value={d.quantite_recherchee} onChange={e => s('quantite_recherchee', e.target.value)} />
            </div>
            <div className="space-y-1">
              <FL>Prix souhaité (FCFA)</FL>
              <Input type="number" min="0" step="1" className="h-10 bg-gray-50/50 text-sm" value={d.prix_souhaite} onChange={e => s('prix_souhaite', e.target.value)} />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <FL>Observations</FL>
        <Textarea rows={2} className="resize-none bg-gray-50/50 text-sm" value={d.observations} onChange={e => s('observations', e.target.value)} />
      </div>

      <div className="flex gap-2 pt-1">
        <Button type="button" variant="outline" className="flex-1 h-10 text-sm" onClick={onCancel} disabled={saving}>Annuler</Button>
        <Button type="button" disabled={saving || !d.culture}
          className="flex-1 h-10 text-sm bg-[#1B5E20] hover:bg-[#2E7D32] text-white"
          onClick={() => onSave({
            culture: d.culture || undefined,
            campagne: d.campagne || undefined,
            superficie_concernee: num(d.superficie_concernee),
            production_annuelle_estimee: num(d.production_annuelle_estimee),
            production_campagne_en_cours: num(d.production_campagne_en_cours),
            quantite_disponible: num(d.quantite_disponible),
            quantite_vente: num(d.quantite_vente),
            capacite_livraison: num(d.capacite_livraison),
            unite: d.unite,
            periode_recolte: d.periode_recolte || undefined,
            periode_disponibilite: d.periode_disponibilite || undefined,
            recherche_acheteur: d.recherche_acheteur,
            quantite_recherchee: num(d.quantite_recherchee),
            prix_souhaite: num(d.prix_souhaite),
            observations: d.observations || undefined,
          })}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Enregistrer'}
        </Button>
      </div>
    </div>
  );
}

// ── ProductionCard ─────────────────────────────────────────────────────────────
function ProductionCard({ prod, qc }: { prod: Production; qc: ReturnType<typeof useQueryClient> }) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);

  const update = useMutation({
    mutationFn: (d: Record<string, unknown>) => apiFetch(`/api/productions/${prod.id}`, { method: 'PATCH', body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['productions'] }); setEditing(false); },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  const del = useMutation({
    mutationFn: () => apiFetch(`/api/productions/${prod.id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['productions'] }),
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  if (editing) {
    return (
      <div className="bg-white border rounded-xl p-3 mt-1">
        <div className="flex items-center gap-2 mb-2">
          <button type="button" onClick={() => setEditing(false)} className="p-0.5 rounded hover:bg-gray-100"><ArrowLeft className="w-3.5 h-3.5 text-gray-500" /></button>
          <span className="text-xs font-bold text-gray-600">Modifier la production</span>
        </div>
        <ProductionForm init={prod} onSave={d => update.mutate(d)} onCancel={() => setEditing(false)} saving={update.isPending} />
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 py-2 border-b border-gray-100 last:border-0">
      <TrendingUp className="w-3.5 h-3.5 text-[#F57C00] shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-bold text-gray-800">{prod.culture ?? '—'}</span>
          {prod.campagne && <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">{prod.campagne}</span>}
          {prod.recherche_acheteur === 'OUI' && (
            <span className="text-[10px] bg-[#FFF3E0] text-[#E65100] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
              <ShoppingCart className="w-2.5 h-2.5" />Acheteur
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-[11px] text-gray-500">
          {prod.production_campagne_en_cours != null && <span>Prod: <b className="text-gray-700">{prod.production_campagne_en_cours} {prod.unite}</b></span>}
          {prod.quantite_disponible != null && <span>Dispo: <b className="text-[#2E7D32]">{prod.quantite_disponible} {prod.unite}</b></span>}
          {prod.quantite_vente != null && <span>Vente: <b className="text-[#F57C00]">{prod.quantite_vente} {prod.unite}</b></span>}
        </div>
        {prod.periode_disponibilite && <p className="text-[10px] text-gray-400 mt-0.5">📅 {prod.periode_disponibilite}</p>}
      </div>
      <div className="flex gap-1 shrink-0">
        <button type="button" onClick={() => setEditing(true)} className="p-1 rounded hover:bg-gray-100"><Pencil className="w-3 h-3 text-[#1B5E20]" /></button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button type="button" className="p-1 rounded hover:bg-red-50"><Trash2 className="w-3 h-3 text-red-500" /></button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer cette production ?</AlertDialogTitle>
              <AlertDialogDescription>La production «{prod.culture}» sera définitivement supprimée.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction className="bg-red-600 hover:bg-red-700 text-white" onClick={() => del.mutate()}>Supprimer</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────
export function ProductionManager({ plotId }: { plotId: number }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);

  const { data: productions = [], isLoading } = useQuery<Production[]>({
    queryKey: ['productions', plotId],
    queryFn: () => apiFetch(`/api/plots/${plotId}/productions`),
  });

  const add = useMutation({
    mutationFn: (d: Record<string, unknown>) => apiFetch(`/api/plots/${plotId}/productions`, { method: 'POST', body: JSON.stringify(d) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['productions'] }); setAdding(false); },
    onError: (e: Error) => toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  if (isLoading) return <div className="py-1 flex items-center gap-1.5 text-xs text-gray-400"><Loader2 className="w-3 h-3 animate-spin" />Chargement…</div>;

  return (
    <div className="mt-1 space-y-1">
      {productions.map(p => <ProductionCard key={p.id} prod={p} qc={qc} />)}

      {adding ? (
        <div className="bg-[#FFFDE7] border border-[#FFF176] rounded-xl p-3 mt-1">
          <div className="flex items-center gap-2 mb-2">
            <button type="button" onClick={() => setAdding(false)} className="p-0.5 rounded hover:bg-yellow-100"><ArrowLeft className="w-3.5 h-3.5 text-gray-500" /></button>
            <span className="text-xs font-bold text-gray-600">Nouvelle production</span>
          </div>
          <ProductionForm init={{}} onSave={d => add.mutate(d)} onCancel={() => setAdding(false)} saving={add.isPending} />
        </div>
      ) : (
        <button type="button" onClick={() => setAdding(true)}
          className="w-full h-8 rounded-lg border border-dashed border-[#F57C00] text-[#E65100] text-[11px] font-bold flex items-center justify-center gap-1 hover:bg-[#FFF3E0] transition-colors mt-1">
          <Plus className="w-3 h-3" /> AJOUTER UNE PRODUCTION
        </button>
      )}
    </div>
  );
}
