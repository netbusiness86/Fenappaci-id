/**
 * FarmsStep — Étape 5 du formulaire d'identification
 * Gestion locale des exploitations et parcelles avant soumission.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  Plus, Pencil, Trash2, Leaf, MapPin, ChevronDown, ChevronUp,
  CheckCircle2, Loader2, X, ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ──────────────────────────────────────────────────────────────────────
export type PlotDraft = {
  id: string; // local UUID
  reference: string;
  culture_principale: string;
  superficie: string;
  annee_plantation: string;
  age_plantation: string;
  etat: string;
  latitude: number | null;
  longitude: number | null;
};

export type FarmDraft = {
  id: string; // local UUID
  nom: string;
  localite: string;
  superficie_ha: string;
  statut_foncier: string;
  annee_creation: string;
  latitude: number | null;
  longitude: number | null;
  observations: string;
  plots: PlotDraft[];
};

const emptyPlot = (): PlotDraft => ({
  id: crypto.randomUUID(),
  reference: '', culture_principale: '', superficie: '',
  annee_plantation: '', age_plantation: '', etat: '',
  latitude: null, longitude: null,
});

const emptyFarm = (): FarmDraft => ({
  id: crypto.randomUUID(),
  nom: '', localite: '', superficie_ha: '', statut_foncier: '',
  annee_creation: '', latitude: null, longitude: null, observations: '',
  plots: [],
});

const STATUTS_FONCIERS = ['Propriétaire', 'Héritage', 'Location', 'Mise à disposition', 'Autre'];
const ETATS_PARCELLE = ['Très bon', 'Bon', 'Moyen', 'Mauvais'];

// ── FieldLabel ─────────────────────────────────────────────────────────────────
const FL = ({ children }: { children: React.ReactNode }) => (
  <label className="text-xs uppercase font-semibold text-gray-500 mb-1 block">{children}</label>
);

// ── GPS Button ─────────────────────────────────────────────────────────────────
function GpsCapture({
  lat, lon,
  onCaptured,
}: { lat: number | null; lon: number | null; onCaptured: (lat: number, lon: number) => void }) {
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const capture = () => {
    if (!navigator.geolocation) { setErr("GPS non supporté"); return; }
    setLoading(true); setErr(null);
    navigator.geolocation.getCurrentPosition(
      p => { onCaptured(p.coords.latitude, p.coords.longitude); setLoading(false); },
      () => { setErr("Position indisponible"); setLoading(false); },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={capture}
        disabled={loading}
        className={cn(
          "w-full h-11 rounded-xl border-2 font-semibold text-sm flex items-center justify-center gap-2 transition-all",
          lat !== null
            ? "bg-[#E8F5E9] border-[#2E7D32] text-[#1B5E20]"
            : "bg-white border-[#F57C00] text-[#E65100] hover:bg-[#FFF3E0]",
          loading && "opacity-60 cursor-not-allowed"
        )}
      >
        {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Localisation…</>
          : lat !== null ? <><CheckCircle2 className="w-4 h-4" /> GPS capturé ({lat.toFixed(4)}°, {lon!.toFixed(4)}°)</>
          : <><MapPin className="w-4 h-4" /> 📍 Capturer la position GPS</>}
      </button>
      {err && <p className="text-xs text-red-600">{err}</p>}
    </div>
  );
}

// ── PlotForm ───────────────────────────────────────────────────────────────────
function PlotForm({
  plot,
  onSave,
  onCancel,
}: { plot: PlotDraft; onSave: (p: PlotDraft) => void; onCancel: () => void }) {
  const [d, setD] = useState<PlotDraft>(plot);
  const set = (k: keyof PlotDraft, v: unknown) => setD(prev => ({ ...prev, [k]: v }));

  return (
    <div className="space-y-4 pt-2">
      <div className="space-y-1.5">
        <FL>Référence de la parcelle</FL>
        <Input className="h-11 bg-gray-50/50" value={d.reference} onChange={e => set('reference', e.target.value)} placeholder="P-01" />
      </div>
      <div className="space-y-1.5">
        <FL>Culture principale</FL>
        <Input className="h-11 bg-gray-50/50" value={d.culture_principale} onChange={e => set('culture_principale', e.target.value)} placeholder="Cacao, Café, Maïs…" />
      </div>
      <div className="space-y-1.5">
        <FL>Superficie (ha)</FL>
        <Input type="number" min="0" step="0.01" className="h-11 bg-gray-50/50" value={d.superficie} onChange={e => set('superficie', e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <FL>Année de plantation</FL>
          <Input type="number" className="h-11 bg-gray-50/50" value={d.annee_plantation} onChange={e => set('annee_plantation', e.target.value)} placeholder="2018" />
        </div>
        <div className="space-y-1.5">
          <FL>Âge (ans)</FL>
          <Input type="number" min="0" className="h-11 bg-gray-50/50" value={d.age_plantation} onChange={e => set('age_plantation', e.target.value)} />
        </div>
      </div>
      <div className="space-y-1.5">
        <FL>État de la parcelle</FL>
        <div className="grid grid-cols-2 gap-2">
          {ETATS_PARCELLE.map(opt => (
            <button
              key={opt}
              type="button"
              onClick={() => set('etat', opt)}
              className={cn(
                "h-11 rounded-xl text-sm font-semibold border transition-all",
                d.etat === opt
                  ? "bg-[#2E7D32] text-white border-[#2E7D32]"
                  : "bg-white text-gray-500 border-gray-200 hover:border-gray-300"
              )}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1.5">
        <FL>Localisation GPS</FL>
        <GpsCapture lat={d.latitude} lon={d.longitude} onCaptured={(lat, lon) => setD(prev => ({ ...prev, latitude: lat, longitude: lon }))} />
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" className="flex-1 h-11" onClick={onCancel}>Annuler</Button>
        <Button type="button" className="flex-1 h-11 bg-[#2E7D32] hover:bg-[#1B5E20] text-white" onClick={() => onSave(d)}>
          Enregistrer la parcelle
        </Button>
      </div>
    </div>
  );
}

// ── FarmForm ───────────────────────────────────────────────────────────────────
function FarmForm({
  farm,
  onSave,
  onCancel,
}: { farm: FarmDraft; onSave: (f: FarmDraft) => void; onCancel: () => void }) {
  const [d, setD] = useState<FarmDraft>(farm);
  const [addingPlot, setAddingPlot] = useState(false);
  const [editingPlotId, setEditingPlotId] = useState<string | null>(null);

  const set = (k: keyof FarmDraft, v: unknown) => setD(prev => ({ ...prev, [k]: v }));

  const savePlot = (plot: PlotDraft) => {
    setD(prev => ({
      ...prev,
      plots: editingPlotId
        ? prev.plots.map(p => p.id === editingPlotId ? plot : p)
        : [...prev.plots, plot],
    }));
    setAddingPlot(false);
    setEditingPlotId(null);
  };

  const deletePlot = (plotId: string) =>
    setD(prev => ({ ...prev, plots: prev.plots.filter(p => p.id !== plotId) }));

  const editingPlot = editingPlotId ? d.plots.find(p => p.id === editingPlotId) : null;

  if (addingPlot || editingPlot) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <button type="button" onClick={() => { setAddingPlot(false); setEditingPlotId(null); }}
            className="p-1 rounded-full hover:bg-gray-100">
            <ArrowLeft className="w-4 h-4 text-gray-500" />
          </button>
          <span className="font-bold text-gray-700 text-sm">{editingPlot ? 'Modifier la parcelle' : 'Nouvelle parcelle'}</span>
        </div>
        <PlotForm
          plot={editingPlot ?? emptyPlot()}
          onSave={savePlot}
          onCancel={() => { setAddingPlot(false); setEditingPlotId(null); }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-2">
      <div className="space-y-1.5">
        <FL>Nom ou référence de l'exploitation</FL>
        <Input className="h-11 bg-gray-50/50" value={d.nom} onChange={e => set('nom', e.target.value)} placeholder="Exploitation du Nord…" />
      </div>
      <div className="space-y-1.5">
        <FL>Localité</FL>
        <Input className="h-11 bg-gray-50/50" value={d.localite} onChange={e => set('localite', e.target.value)} placeholder="Village, Sous-préfecture…" />
      </div>
      <div className="space-y-1.5">
        <FL>Superficie totale (ha)</FL>
        <Input type="number" min="0" step="0.01" className="h-11 bg-gray-50/50" value={d.superficie_ha} onChange={e => set('superficie_ha', e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <FL>Statut foncier</FL>
        <Select value={d.statut_foncier || undefined} onValueChange={v => set('statut_foncier', v)}>
          <SelectTrigger className="h-11 bg-gray-50/50"><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
          <SelectContent>
            {STATUTS_FONCIERS.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <FL>Année de création</FL>
        <Input type="number" className="h-11 bg-gray-50/50" value={d.annee_creation} onChange={e => set('annee_creation', e.target.value)} placeholder="2010" />
      </div>
      <div className="space-y-1.5">
        <FL>Localisation GPS</FL>
        <GpsCapture lat={d.latitude} lon={d.longitude} onCaptured={(lat, lon) => setD(prev => ({ ...prev, latitude: lat, longitude: lon }))} />
      </div>
      <div className="space-y-1.5">
        <FL>Observations</FL>
        <Textarea rows={2} className="resize-none bg-gray-50/50" value={d.observations} onChange={e => set('observations', e.target.value)} />
      </div>

      {/* Parcelles */}
      <div className="pt-2 border-t border-dashed border-gray-200">
        <p className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3">🌿 Parcelles ({d.plots.length})</p>
        {d.plots.map((p, i) => (
          <div key={p.id} className="flex items-center justify-between bg-[#E8F5E9] rounded-xl px-3 py-2 mb-2 gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#1B5E20] truncate">{p.reference || `Parcelle ${i + 1}`}</p>
              <p className="text-xs text-gray-500 truncate">{p.culture_principale || '—'} · {p.superficie || '?'} ha</p>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button type="button" onClick={() => setEditingPlotId(p.id)} className="p-1.5 rounded-lg bg-white border hover:bg-gray-50">
                <Pencil className="w-3.5 h-3.5 text-[#1B5E20]" />
              </button>
              <button type="button" onClick={() => deletePlot(p.id)} className="p-1.5 rounded-lg bg-white border hover:bg-red-50">
                <Trash2 className="w-3.5 h-3.5 text-red-500" />
              </button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setAddingPlot(true)}
          className="w-full h-11 rounded-xl border-2 border-dashed border-[#2E7D32] text-[#2E7D32] font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#E8F5E9] transition-colors"
        >
          <Plus className="w-4 h-4" /> + AJOUTER UNE PARCELLE
        </button>
      </div>

      <div className="flex gap-2 pt-2">
        <Button type="button" variant="outline" className="flex-1 h-11" onClick={onCancel}>Annuler</Button>
        <Button type="button" className="flex-1 h-11 bg-[#F57C00] hover:bg-[#E65100] text-white font-bold" onClick={() => onSave(d)}>
          Enregistrer l'exploitation
        </Button>
      </div>
    </div>
  );
}

// ── FarmCard ───────────────────────────────────────────────────────────────────
function FarmCard({
  farm,
  index,
  onEdit,
  onDelete,
}: { farm: FarmDraft; index: number; onEdit: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-9 h-9 rounded-full bg-[#1B5E20] text-white flex items-center justify-center font-bold text-sm shrink-0">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-800 text-sm truncate">{farm.nom || `Exploitation ${index + 1}`}</p>
          <p className="text-xs text-gray-500 truncate">
            {farm.localite || '—'}{farm.superficie_ha ? ` · ${farm.superficie_ha} ha` : ''}
            {farm.statut_foncier ? ` · ${farm.statut_foncier}` : ''}
          </p>
        </div>
        <div className="flex gap-1.5 shrink-0">
          <button type="button" onClick={onEdit} className="p-1.5 rounded-lg border hover:bg-gray-50">
            <Pencil className="w-3.5 h-3.5 text-[#1B5E20]" />
          </button>
          <button type="button" onClick={onDelete} className="p-1.5 rounded-lg border hover:bg-red-50">
            <Trash2 className="w-3.5 h-3.5 text-red-500" />
          </button>
          <button type="button" onClick={() => setOpen(o => !o)} className="p-1.5 rounded-lg border hover:bg-gray-50">
            {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open && farm.plots.length > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t bg-[#F9FBE7]"
          >
            <div className="px-4 py-2 space-y-1.5">
              {farm.plots.map((p, i) => (
                <div key={p.id} className="flex items-center gap-2 text-xs">
                  <Leaf className="w-3 h-3 text-[#2E7D32] shrink-0" />
                  <span className="font-semibold text-gray-700">{p.reference || `Parcelle ${i + 1}`}</span>
                  <span className="text-gray-500">{p.culture_principale && `· ${p.culture_principale}`} {p.superficie && `· ${p.superficie} ha`}</span>
                  {p.etat && <span className={cn(
                    "ml-auto px-1.5 py-0.5 rounded-full font-semibold",
                    p.etat === 'Très bon' || p.etat === 'Bon' ? 'bg-green-100 text-green-700' :
                    p.etat === 'Moyen' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                  )}>{p.etat}</span>}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── FarmsStep (main export) ────────────────────────────────────────────────────
export interface FarmsStepProps {
  farms: FarmDraft[];
  onChange: (farms: FarmDraft[]) => void;
}

export function FarmsStep({ farms, onChange }: FarmsStepProps) {
  const [mode, setMode] = useState<'list' | 'add' | 'edit'>('list');
  const [editingId, setEditingId] = useState<string | null>(null);

  const editingFarm = editingId ? farms.find(f => f.id === editingId) : null;

  const saveFarm = (farm: FarmDraft) => {
    if (mode === 'edit' && editingId) {
      onChange(farms.map(f => f.id === editingId ? farm : f));
    } else {
      onChange([...farms, farm]);
    }
    setMode('list');
    setEditingId(null);
  };

  const deleteFarm = (id: string) => onChange(farms.filter(f => f.id !== id));

  if (mode === 'add' || mode === 'edit') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <button type="button" onClick={() => { setMode('list'); setEditingId(null); }}
            className="p-1 rounded-full hover:bg-gray-100">
            <ArrowLeft className="w-4 h-4 text-gray-500" />
          </button>
          <span className="font-bold text-gray-700 text-sm">
            {mode === 'edit' ? 'Modifier l\'exploitation' : 'Nouvelle exploitation'}
          </span>
        </div>
        <FarmForm
          farm={editingFarm ?? emptyFarm()}
          onSave={saveFarm}
          onCancel={() => { setMode('list'); setEditingId(null); }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-gray-800">
          Exploitations agricoles <span className="text-[#F57C00]">({farms.length})</span>
        </h3>
      </div>

      {farms.length === 0 && (
        <div className="text-center py-8 text-gray-400 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
          <Leaf className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm font-medium">Aucune exploitation enregistrée</p>
          <p className="text-xs mt-1">Appuyez sur le bouton ci-dessous pour en ajouter une</p>
        </div>
      )}

      {farms.map((farm, i) => (
        <FarmCard
          key={farm.id}
          farm={farm}
          index={i}
          onEdit={() => { setEditingId(farm.id); setMode('edit'); }}
          onDelete={() => deleteFarm(farm.id)}
        />
      ))}

      <button
        type="button"
        onClick={() => setMode('add')}
        className="w-full h-14 rounded-2xl border-2 border-dashed border-[#F57C00] text-[#E65100] font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#FFF3E0] transition-colors mt-2"
      >
        <Plus className="w-5 h-5" /> + AJOUTER UNE EXPLOITATION
      </button>

      {farms.length > 0 && (
        <div className="mt-4 p-4 bg-[#E8F5E9] rounded-2xl border border-[#A5D6A7]">
          <p className="text-xs font-bold text-[#1B5E20] uppercase tracking-wider mb-3">Récapitulatif</p>
          {farms.map((f, fi) => (
            <div key={f.id} className="mb-2">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 bg-[#1B5E20] text-white rounded-full text-xs flex items-center justify-center font-bold">{fi + 1}</span>
                <span className="text-sm font-semibold text-[#1B5E20]">{f.nom || `Exploitation ${fi + 1}`}</span>
                {f.superficie_ha && <span className="text-xs text-gray-500">{f.superficie_ha} ha</span>}
              </div>
              {f.plots.map((p, pi) => (
                <div key={p.id} className="flex items-center gap-2 ml-7 mt-1">
                  <Leaf className="w-3 h-3 text-[#2E7D32]" />
                  <span className="text-xs text-gray-600">{p.reference || `Parcelle ${pi + 1}`}{p.culture_principale ? ` — ${p.culture_principale}` : ''}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
