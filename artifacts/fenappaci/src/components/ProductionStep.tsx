/**
 * ProductionStep — Étape 6 : Productions agricoles
 * Parcourt toutes les exploitations/parcelles du draft et permet
 * d'ajouter des productions à chaque parcelle avant la soumission.
 */
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  Plus, Trash2, Leaf, TrendingUp, Building2, ArrowLeft,
  ShoppingCart, ChevronDown, ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FarmDraft } from './FarmsStep';

// ── Types ──────────────────────────────────────────────────────────────────────
export type ProductionDraft = {
  id: string;
  culture: string;
  campagne: string;
  superficie_concernee: string;
  production_annuelle_estimee: string;
  production_campagne_en_cours: string;
  quantite_disponible: string;
  quantite_vente: string;
  capacite_livraison: string;
  unite: string;
  periode_recolte: string;
  periode_disponibilite: string;
  recherche_acheteur: 'OUI' | 'NON';
  quantite_recherchee: string;
  prix_souhaite: string;
  observations: string;
};

export const emptyProduction = (): ProductionDraft => ({
  id: crypto.randomUUID(),
  culture: '', campagne: '', superficie_concernee: '',
  production_annuelle_estimee: '', production_campagne_en_cours: '',
  quantite_disponible: '', quantite_vente: '', capacite_livraison: '',
  unite: 'Kg', periode_recolte: '', periode_disponibilite: '',
  recherche_acheteur: 'NON', quantite_recherchee: '', prix_souhaite: '', observations: '',
});

const UNITES = ['Kg', 'Tonnes', 'Sacs', 'Litres', 'Autre'];

const FL = ({ children }: { children: React.ReactNode }) => (
  <label className="text-xs uppercase font-semibold text-gray-500 mb-1 block">{children}</label>
);

// ── Single production form ─────────────────────────────────────────────────────
function ProductionForm({
  prod,
  onChange,
  onDelete,
}: {
  prod: ProductionDraft;
  onChange: (p: ProductionDraft) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(true);
  const s = (k: keyof ProductionDraft, v: string) => onChange({ ...prod, [k]: v });

  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#F57C00]/10 border-b">
        <button type="button" onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 flex-1 min-w-0">
          <TrendingUp className="w-4 h-4 text-[#F57C00] shrink-0" />
          <span className="text-sm font-bold text-gray-800 truncate">
            {prod.culture || 'Nouvelle production'}
            {prod.campagne ? ` · ${prod.campagne}` : ''}
          </span>
          {open ? <ChevronUp className="w-3.5 h-3.5 text-gray-400 ml-auto shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400 ml-auto shrink-0" />}
        </button>
        <button type="button" onClick={onDelete} className="ml-2 p-1 rounded hover:bg-red-100 shrink-0">
          <Trash2 className="w-3.5 h-3.5 text-red-500" />
        </button>
      </div>

      {open && (
        <div className="p-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1 col-span-2">
              <FL>Culture <span className="text-red-400">*</span></FL>
              <Input className="h-10 bg-gray-50/50 text-sm" placeholder="Cacao, Café, Hévéa…"
                value={prod.culture} onChange={e => s('culture', e.target.value)} />
            </div>
            <div className="space-y-1">
              <FL>Campagne</FL>
              <Input className="h-10 bg-gray-50/50 text-sm" placeholder="2025-2026"
                value={prod.campagne} onChange={e => s('campagne', e.target.value)} />
            </div>
            <div className="space-y-1">
              <FL>Superficie (ha)</FL>
              <Input type="number" min="0" step="0.01" className="h-10 bg-gray-50/50 text-sm"
                value={prod.superficie_concernee} onChange={e => s('superficie_concernee', e.target.value)} />
            </div>
          </div>

          <div className="border-t pt-2">
            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2">Production</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <FL>Prod. annuelle estimée</FL>
                <Input type="number" min="0" className="h-10 bg-gray-50/50 text-sm"
                  value={prod.production_annuelle_estimee} onChange={e => s('production_annuelle_estimee', e.target.value)} />
              </div>
              <div className="space-y-1">
                <FL>Prod. campagne en cours</FL>
                <Input type="number" min="0" className="h-10 bg-gray-50/50 text-sm"
                  value={prod.production_campagne_en_cours} onChange={e => s('production_campagne_en_cours', e.target.value)} />
              </div>
              <div className="space-y-1">
                <FL>Qté disponible</FL>
                <Input type="number" min="0" className="h-10 bg-gray-50/50 text-sm"
                  value={prod.quantite_disponible} onChange={e => s('quantite_disponible', e.target.value)} />
              </div>
              <div className="space-y-1">
                <FL>Qté à vendre</FL>
                <Input type="number" min="0" className="h-10 bg-gray-50/50 text-sm"
                  value={prod.quantite_vente} onChange={e => s('quantite_vente', e.target.value)} />
              </div>
              <div className="space-y-1">
                <FL>Capacité livraison</FL>
                <Input type="number" min="0" className="h-10 bg-gray-50/50 text-sm"
                  value={prod.capacite_livraison} onChange={e => s('capacite_livraison', e.target.value)} />
              </div>
              <div className="space-y-1">
                <FL>Unité</FL>
                <Select value={prod.unite} onValueChange={v => s('unite', v)}>
                  <SelectTrigger className="h-10 bg-gray-50/50 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{UNITES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <FL>Période de récolte</FL>
                <Input className="h-10 bg-gray-50/50 text-sm" placeholder="Oct–Déc"
                  value={prod.periode_recolte} onChange={e => s('periode_recolte', e.target.value)} />
              </div>
              <div className="space-y-1">
                <FL>Période disponibilité</FL>
                <Input className="h-10 bg-gray-50/50 text-sm" placeholder="Jan–Mar"
                  value={prod.periode_disponibilite} onChange={e => s('periode_disponibilite', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="border-t pt-2">
            <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2">Recherche d'acheteur</p>
            <div className="grid grid-cols-2 gap-2">
              {(['OUI', 'NON'] as const).map(opt => (
                <button key={opt} type="button" onClick={() => s('recherche_acheteur', opt)}
                  className={cn("h-10 rounded-xl font-bold text-sm border transition-all",
                    prod.recherche_acheteur === opt
                      ? opt === 'OUI' ? 'bg-[#F57C00] text-white border-[#F57C00]' : 'bg-gray-700 text-white border-gray-700'
                      : 'bg-white text-gray-500 border-gray-200')}>
                  {opt}
                </button>
              ))}
            </div>
            {prod.recherche_acheteur === 'OUI' && (
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="space-y-1">
                  <FL>Qté recherchée</FL>
                  <Input type="number" min="0" className="h-10 bg-gray-50/50 text-sm"
                    value={prod.quantite_recherchee} onChange={e => s('quantite_recherchee', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <FL>Prix souhaité (FCFA)</FL>
                  <Input type="number" min="0" className="h-10 bg-gray-50/50 text-sm"
                    value={prod.prix_souhaite} onChange={e => s('prix_souhaite', e.target.value)} />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <FL>Observations</FL>
            <Textarea rows={2} className="resize-none bg-gray-50/50 text-sm"
              value={prod.observations} onChange={e => s('observations', e.target.value)} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────
export function ProductionStep({
  farms,
  onChange,
}: {
  farms: FarmDraft[];
  onChange: (farms: FarmDraft[]) => void;
}) {
  const [openFarms, setOpenFarms] = useState<Set<string>>(new Set(farms.map(f => f.id)));

  const toggleFarm = (id: string) => setOpenFarms(p => {
    const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n;
  });

  const updateFarm = (fi: number, updated: FarmDraft) => {
    const next = [...farms]; next[fi] = updated; onChange(next);
  };

  const addProduction = (fi: number, pi: number) => {
    const farm = { ...farms[fi] };
    const plot = { ...farm.plots[pi] };
    plot.productions = [...(plot.productions ?? []), emptyProduction()];
    farm.plots = [...farm.plots]; farm.plots[pi] = plot;
    updateFarm(fi, farm);
  };

  const updateProduction = (fi: number, pi: number, pri: number, prod: ProductionDraft) => {
    const farm = { ...farms[fi] };
    const plot = { ...farm.plots[pi] };
    const prods = [...(plot.productions ?? [])]; prods[pri] = prod;
    plot.productions = prods;
    farm.plots = [...farm.plots]; farm.plots[pi] = plot;
    updateFarm(fi, farm);
  };

  const deleteProduction = (fi: number, pi: number, pri: number) => {
    const farm = { ...farms[fi] };
    const plot = { ...farm.plots[pi] };
    plot.productions = (plot.productions ?? []).filter((_, i) => i !== pri);
    farm.plots = [...farm.plots]; farm.plots[pi] = plot;
    updateFarm(fi, farm);
  };

  if (farms.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <TrendingUp className="w-10 h-10 mx-auto mb-3 text-gray-200" />
        <p className="font-medium text-sm">Aucune exploitation enregistrée</p>
        <p className="text-xs mt-1">Retournez à l'étape 5 pour ajouter des exploitations et parcelles.</p>
      </div>
    );
  }

  const totalPlots = farms.reduce((s, f) => s + f.plots.length, 0);
  const totalProds = farms.reduce((s, f) =>
    s + f.plots.reduce((ps, p) => ps + (p.productions?.length ?? 0), 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="bg-[#FFF3E0] p-2 rounded-full">
          <TrendingUp className="w-5 h-5 text-[#F57C00]" />
        </div>
        <div>
          <h2 className="text-base font-bold text-gray-800">Productions agricoles</h2>
          <p className="text-xs text-gray-500">{totalPlots} parcelle{totalPlots > 1 ? 's' : ''} · {totalProds} production{totalProds > 1 ? 's' : ''} saisie{totalProds > 1 ? 's' : ''}</p>
        </div>
      </div>

      {farms.map((farm, fi) => (
        <div key={farm.id} className="bg-gray-50 border rounded-2xl overflow-hidden">
          {/* Farm header */}
          <button type="button" onClick={() => toggleFarm(farm.id)}
            className="w-full flex items-center gap-2 px-4 py-3 bg-[#1B5E20] text-white">
            <Building2 className="w-4 h-4 shrink-0" />
            <span className="font-bold text-sm flex-1 text-left truncate">
              {farm.nom || `Exploitation ${fi + 1}`}
              {farm.localite ? ` — ${farm.localite}` : ''}
            </span>
            <span className="text-white/70 text-xs shrink-0">{farm.plots.length} parcelle{farm.plots.length > 1 ? 's' : ''}</span>
            {openFarms.has(farm.id) ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
          </button>

          {openFarms.has(farm.id) && (
            <div className="divide-y divide-gray-200">
              {farm.plots.length === 0 && (
                <p className="px-4 py-3 text-xs text-gray-400 italic">Aucune parcelle dans cette exploitation.</p>
              )}
              {farm.plots.map((plot, pi) => (
                <div key={plot.id} className="px-4 py-3 space-y-2">
                  {/* Plot header */}
                  <div className="flex items-center gap-2">
                    <Leaf className="w-3.5 h-3.5 text-[#2E7D32] shrink-0" />
                    <span className="text-xs font-bold text-gray-700">
                      {plot.reference || `Parcelle ${pi + 1}`}
                      {plot.culture_principale ? ` — ${plot.culture_principale}` : ''}
                      {plot.superficie ? ` · ${plot.superficie} ha` : ''}
                    </span>
                  </div>

                  {/* Productions list */}
                  <div className="space-y-2 pl-4">
                    {(plot.productions ?? []).map((prod, pri) => (
                      <ProductionForm
                        key={prod.id}
                        prod={prod}
                        onChange={p => updateProduction(fi, pi, pri, p)}
                        onDelete={() => deleteProduction(fi, pi, pri)}
                      />
                    ))}

                    <button
                      type="button"
                      onClick={() => addProduction(fi, pi)}
                      className="w-full h-9 rounded-xl border border-dashed border-[#F57C00] text-[#E65100] text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-[#FFF3E0] transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> AJOUTER UNE PRODUCTION
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
