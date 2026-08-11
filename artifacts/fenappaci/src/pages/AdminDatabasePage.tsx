import { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {
  FileSpreadsheet, FileText, Search, Users, Building2,
  ChevronDown, ChevronUp, AlertCircle, Loader2, ArrowLeft,
  UserCheck, UserX, Clock, CheckCircle2, XCircle,
} from 'lucide-react';
import { Link } from 'wouter';
import { useToast } from '@/hooks/use-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdminProducteur {
  id: number;
  numero_membre: string;
  nom: string;
  prenoms: string;
  sexe: string | null;
  date_naissance: string | null;
  telephone: string | null;
  telephone_secondaire: string | null;
  region: string | null;
  departement: string | null;
  sous_prefecture: string | null;
  village: string | null;
  cooperative_nom: string | null;
  cooperative_fonction: string | null;
  cultures: string[] | null;
  superficie_ha: number | null;
  status: string;
  agent_nom: string | null;
  created_at: string;
}

interface AdminCooperative {
  id: number;
  nom: string;
  sigle: string | null;
  numero_identification: string | null;
  region: string | null;
  departement: string | null;
  sous_prefecture: string | null;
  village: string | null;
  president: string | null;
  vice_president: string | null;
  secretaire: string | null;
  tresorier: string | null;
  telephone: string | null;
  email: string | null;
  date_creation: string | null;
  nombre_membres: number;
  production_totale: number;
  quantite_disponible: number;
}

interface AdminAgent {
  id: number;
  nom: string;
  prenoms: string;
  email: string;
  role: string;
  status: 'PENDING' | 'ACTIVE' | 'REJECTED';
  telephone: string | null;
  region: string | null;
  departement: string | null;
  sous_prefecture: string | null;
  created_at: string;
}

type GroupBy = 'none' | 'region' | 'culture' | 'cooperative' | 'status';
type ActiveTab = 'producteurs' | 'cooperatives' | 'agents';

// ─── Column definitions ───────────────────────────────────────────────────────

const PROD_COLS = [
  { key: 'numero_membre',     label: 'N° Membre',      wch: 18 },
  { key: 'nom',               label: 'Nom',             wch: 16 },
  { key: 'prenoms',           label: 'Prénoms',         wch: 20 },
  { key: 'sexe',              label: 'Sexe',            wch: 8  },
  { key: 'telephone',         label: 'Téléphone',       wch: 16 },
  { key: 'region',            label: 'Région',          wch: 18 },
  { key: 'departement',       label: 'Département',     wch: 18 },
  { key: 'sous_prefecture',   label: 'Sous-préfecture', wch: 18 },
  { key: 'village',           label: 'Village',         wch: 16 },
  { key: 'cooperative_nom',   label: 'Coopérative',     wch: 24 },
  { key: 'cooperative_fonction', label: 'Fonction',     wch: 14 },
  { key: 'cultures',          label: 'Cultures',        wch: 18 },
  { key: 'superficie_ha',     label: 'Superficie (ha)', wch: 14 },
  { key: 'status',            label: 'Statut',          wch: 10 },
  { key: 'agent_nom',         label: 'Agent',           wch: 20 },
  { key: 'created_at',        label: 'Inscription',     wch: 14 },
];

const COOP_COLS = [
  { key: 'nom',                  label: 'Nom',               wch: 28 },
  { key: 'sigle',                label: 'Sigle',             wch: 10 },
  { key: 'numero_identification',label: 'N° Identification', wch: 18 },
  { key: 'region',               label: 'Région',            wch: 18 },
  { key: 'departement',          label: 'Département',       wch: 18 },
  { key: 'sous_prefecture',      label: 'Sous-préfecture',   wch: 18 },
  { key: 'village',              label: 'Village',           wch: 16 },
  { key: 'president',            label: 'Président',         wch: 20 },
  { key: 'vice_president',       label: 'Vice-Président',    wch: 20 },
  { key: 'secretaire',           label: 'Secrétaire',        wch: 20 },
  { key: 'tresorier',            label: 'Trésorier',         wch: 20 },
  { key: 'nombre_membres',       label: 'Membres',           wch: 10 },
  { key: 'production_totale',    label: 'Production (T)',    wch: 14 },
  { key: 'quantite_disponible',  label: 'Disponible (T)',    wch: 14 },
  { key: 'telephone',            label: 'Téléphone',         wch: 16 },
  { key: 'email',                label: 'Email',             wch: 24 },
  { key: 'date_creation',        label: 'Date création',     wch: 14 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('fr-FR'); } catch { return String(iso); }
}

function cellValue(row: Record<string, unknown>, key: string): string {
  const val = row[key];
  if (val === null || val === undefined) return '';
  if (Array.isArray(val)) return val.join(', ');
  if (key === 'created_at' || key === 'date_creation') return formatDate(String(val));
  if (key === 'status') return val === 'ACTIF' ? 'Actif' : 'Inactif';
  if ((key === 'superficie_ha') && typeof val === 'number') return val.toFixed(2);
  if ((key === 'production_totale' || key === 'quantite_disponible') && typeof val === 'number')
    return val.toFixed(1);
  return String(val);
}

function buildGroups<T extends Record<string, unknown>>(
  data: T[],
  groupBy: GroupBy,
): Map<string, T[]> {
  if (groupBy === 'none') return new Map([['__all__', data]]);

  const map = new Map<string, T[]>();
  const push = (key: string, row: T) => {
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(row);
  };

  for (const row of data) {
    if (groupBy === 'culture') {
      const cultures = (row.cultures as string[] | null) ?? [];
      if (cultures.length === 0) push('Non renseigné', row);
      else cultures.forEach((c) => push(c, row));
    } else if (groupBy === 'cooperative') {
      push((row.cooperative_nom as string | null) ?? 'Sans coopérative', row);
    } else if (groupBy === 'status') {
      push((row.status as string) === 'ACTIF' ? 'Actif' : 'Inactif', row);
    } else {
      // region
      push((row.region as string | null) ?? 'Non renseigné', row);
    }
  }

  return new Map([...map.entries()].sort(([a], [b]) => a.localeCompare(b, 'fr')));
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

async function fetchAdmin<T>(path: string): Promise<T> {
  const r = await fetch(`${BASE}${path}`, { credentials: 'include' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2.5">
      <p className="text-[11px] text-gray-500 leading-tight">{label}</p>
      <p className="text-xl font-bold text-gray-900 leading-tight mt-0.5">{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AdminDatabasePage() {
  const [tab, setTab] = useState<ActiveTab>('producteurs');
  const [search, setSearch] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [filterCulture, setFilterCulture] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterAgentStatus, setFilterAgentStatus] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState<'xlsx' | 'pdf' | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── Data fetching ──────────────────────────────────────────────────────────

  const { data: producteurs = [], isLoading: loadP, error: errP } = useQuery<AdminProducteur[]>({
    queryKey: ['admin-db-producteurs'],
    queryFn: () => fetchAdmin('/api/admin/database/producteurs'),
    retry: false,
  });

  const { data: cooperatives = [], isLoading: loadC, error: errC } = useQuery<AdminCooperative[]>({
    queryKey: ['admin-db-cooperatives'],
    queryFn: () => fetchAdmin('/api/admin/database/cooperatives'),
    retry: false,
  });

  const { data: agents = [], isLoading: loadA, error: errA } = useQuery<AdminAgent[]>({
    queryKey: ['admin-db-agents'],
    queryFn: () => fetchAdmin('/api/admin/agents'),
    retry: false,
    refetchInterval: tab === 'agents' ? 30000 : false,
  });

  const pendingCount = agents.filter((a) => a.status === 'PENDING').length;

  // ── Agent mutations ────────────────────────────────────────────────────────

  const approveMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`${BASE}/api/admin/agents/${id}/approve`, { method: 'POST', credentials: 'include' }).then((r) => r.json()),
    onSuccess: (_, id) => {
      queryClient.setQueryData<AdminAgent[]>(['admin-db-agents'], (prev) =>
        prev?.map((a) => (a.id === id ? { ...a, status: 'ACTIVE' } : a)) ?? [],
      );
      toast({ title: 'Compte approuvé', description: 'L\'agent peut maintenant se connecter.' });
    },
    onError: () => toast({ title: 'Erreur', description: 'Impossible d\'approuver.', variant: 'destructive' }),
  });

  const rejectMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`${BASE}/api/admin/agents/${id}/reject`, { method: 'POST', credentials: 'include' }).then((r) => r.json()),
    onSuccess: (_, id) => {
      queryClient.setQueryData<AdminAgent[]>(['admin-db-agents'], (prev) =>
        prev?.map((a) => (a.id === id ? { ...a, status: 'REJECTED' } : a)) ?? [],
      );
      toast({ title: 'Demande refusée', description: 'L\'agent a été informé du refus.' });
    },
    onError: () => toast({ title: 'Erreur', description: 'Impossible de refuser.', variant: 'destructive' }),
  });

  const isLoading = tab === 'producteurs' ? loadP : tab === 'cooperatives' ? loadC : loadA;
  const error = tab === 'producteurs' ? errP : tab === 'cooperatives' ? errC : errA;
  const cols = tab === 'producteurs' ? PROD_COLS : COOP_COLS;

  // ── Filter options derived from data ──────────────────────────────────────

  const allRegions = useMemo(() => {
    const src = tab === 'producteurs' ? producteurs : cooperatives;
    return [...new Set(src.map((r) => r.region).filter(Boolean) as string[])].sort((a, b) =>
      a.localeCompare(b, 'fr'),
    );
  }, [producteurs, cooperatives, tab]);

  const allCultures = useMemo(
    () =>
      [...new Set(producteurs.flatMap((p) => p.cultures ?? []))].sort((a, b) =>
        a.localeCompare(b, 'fr'),
      ),
    [producteurs],
  );

  // ── Filtering ─────────────────────────────────────────────────────────────

  const filteredP = useMemo(() => {
    let rows = producteurs;
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter(
        (p) =>
          p.nom.toLowerCase().includes(s) ||
          p.prenoms.toLowerCase().includes(s) ||
          p.numero_membre.toLowerCase().includes(s) ||
          (p.telephone ?? '').includes(s) ||
          (p.village ?? '').toLowerCase().includes(s) ||
          (p.cooperative_nom ?? '').toLowerCase().includes(s),
      );
    }
    if (filterRegion) rows = rows.filter((p) => p.region === filterRegion);
    if (filterCulture) rows = rows.filter((p) => (p.cultures ?? []).includes(filterCulture));
    if (filterStatus) rows = rows.filter((p) => p.status === filterStatus);
    return rows;
  }, [producteurs, search, filterRegion, filterCulture, filterStatus]);

  const filteredC = useMemo(() => {
    let rows = cooperatives;
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter(
        (c) =>
          c.nom.toLowerCase().includes(s) ||
          (c.sigle ?? '').toLowerCase().includes(s) ||
          (c.president ?? '').toLowerCase().includes(s) ||
          (c.village ?? '').toLowerCase().includes(s),
      );
    }
    if (filterRegion) rows = rows.filter((c) => c.region === filterRegion);
    return rows;
  }, [cooperatives, search, filterRegion]);

  // ── Filtered agents ───────────────────────────────────────────────────────

  const filteredA = useMemo(() => {
    let rows = agents;
    if (search) {
      const s = search.toLowerCase();
      rows = rows.filter(
        (a) =>
          a.nom.toLowerCase().includes(s) ||
          a.prenoms.toLowerCase().includes(s) ||
          a.email.toLowerCase().includes(s) ||
          (a.region ?? '').toLowerCase().includes(s),
      );
    }
    if (filterAgentStatus) rows = rows.filter((a) => a.status === filterAgentStatus);
    return rows;
  }, [agents, search, filterAgentStatus]);

  const pendingAgents = filteredA.filter((a) => a.status === 'PENDING');

  const filtered = (tab === 'producteurs' ? filteredP : tab === 'cooperatives' ? filteredC : filteredA) as Record<string, unknown>[];

  // ── Grouping ──────────────────────────────────────────────────────────────

  const coopGroupBy: GroupBy =
    tab === 'cooperatives' && (groupBy === 'culture' || groupBy === 'cooperative' || groupBy === 'status')
      ? 'none'
      : groupBy;

  const groups = useMemo(
    () => buildGroups(filtered, coopGroupBy),
    [filtered, coopGroupBy],
  );

  // ── Summary stats ─────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    if (tab === 'producteurs') {
      const superficie = filteredP.reduce((s, p) => s + (p.superficie_ha ?? 0), 0);
      const hommes = filteredP.filter((p) => p.sexe === 'M').length;
      const femmes = filteredP.filter((p) => p.sexe === 'F').length;
      return [
        { label: 'Total', value: String(filteredP.length) },
        { label: 'Superficie', value: `${superficie.toFixed(1)} ha` },
        { label: 'Hommes', value: String(hommes), sub: `${filteredP.length ? Math.round((hommes / filteredP.length) * 100) : 0}%` },
        { label: 'Femmes', value: String(femmes), sub: `${filteredP.length ? Math.round((femmes / filteredP.length) * 100) : 0}%` },
      ];
    } else if (tab === 'cooperatives') {
      const membres = filteredC.reduce((s, c) => s + c.nombre_membres, 0);
      const prod = filteredC.reduce((s, c) => s + c.production_totale, 0);
      const dispo = filteredC.reduce((s, c) => s + c.quantite_disponible, 0);
      return [
        { label: 'Total', value: String(filteredC.length) },
        { label: 'Membres', value: String(membres) },
        { label: 'Production', value: `${prod.toFixed(1)} T` },
        { label: 'Disponible', value: `${dispo.toFixed(1)} T` },
      ];
    } else {
      const active = agents.filter((a) => a.status === 'ACTIVE').length;
      const pending = agents.filter((a) => a.status === 'PENDING').length;
      const rejected = agents.filter((a) => a.status === 'REJECTED').length;
      return [
        { label: 'Total agents', value: String(agents.length) },
        { label: 'Actifs', value: String(active) },
        { label: 'En attente', value: String(pending), sub: pending > 0 ? '⚠ validation requise' : undefined },
        { label: 'Refusés', value: String(rejected) },
      ];
    }
  }, [filteredP, filteredC, agents, tab]);

  // ── Toggle group collapse ─────────────────────────────────────────────────

  const toggleGroup = useCallback((key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  // ── Tab reset ─────────────────────────────────────────────────────────────

  const switchTab = (t: ActiveTab) => {
    setTab(t);
    setSearch('');
    setFilterRegion('');
    setFilterCulture('');
    setFilterStatus('');
    setFilterAgentStatus('');
    setGroupBy('none');
    setCollapsed(new Set());
  };

  // ── Totals row helper for a group ─────────────────────────────────────────

  function totalsRow(rows: Record<string, unknown>[]) {
    if (tab === 'producteurs') {
      const sup = rows.reduce((s, r) => s + ((r.superficie_ha as number | null) ?? 0), 0);
      return cols.map((c) =>
        c.key === 'numero_membre' ? `${rows.length} producteur${rows.length > 1 ? 's' : ''}` :
        c.key === 'superficie_ha' ? sup.toFixed(2) : '',
      );
    } else {
      const mb = rows.reduce((s, r) => s + ((r.nombre_membres as number) ?? 0), 0);
      const prod = rows.reduce((s, r) => s + ((r.production_totale as number) ?? 0), 0);
      const disp = rows.reduce((s, r) => s + ((r.quantite_disponible as number) ?? 0), 0);
      return cols.map((c) =>
        c.key === 'nom' ? `${rows.length} coopérative${rows.length > 1 ? 's' : ''}` :
        c.key === 'nombre_membres' ? String(mb) :
        c.key === 'production_totale' ? prod.toFixed(1) :
        c.key === 'quantite_disponible' ? disp.toFixed(1) : '',
      );
    }
  }

  // ── Excel export ──────────────────────────────────────────────────────────

  const exportXLSX = useCallback(async () => {
    setExporting('xlsx');
    try {
      const wb = XLSX.utils.book_new();
      const date = new Date().toISOString().split('T')[0];

      for (const [groupKey, rows] of groups.entries()) {
        const sheetData = rows.map((row) => {
          const obj: Record<string, string> = {};
          for (const col of cols) obj[col.label] = cellValue(row, col.key);
          return obj;
        });
        const ws = XLSX.utils.json_to_sheet(sheetData);
        ws['!cols'] = cols.map((c) => ({ wch: c.wch }));

        const rawName = groupBy === 'none'
          ? (tab === 'producteurs' ? 'Producteurs' : 'Coopératives')
          : groupKey;
        const sheetName = rawName.replace(/[\\/:*?[\]]/g, '_').substring(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, sheetName);
      }

      // Summary sheet
      const summaryData = stats.map((s) => ({ Indicateur: s.label, Valeur: s.value }));
      const wsSum = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSum, 'Résumé');

      XLSX.writeFile(wb, `FENAPPACI-${tab === 'producteurs' ? 'Producteurs' : 'Cooperatives'}-${date}.xlsx`);
    } finally {
      setExporting(null);
    }
  }, [groups, cols, tab, groupBy, stats]);

  // ── PDF export ────────────────────────────────────────────────────────────

  const exportPDF = useCallback(async () => {
    setExporting('pdf');
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const date = new Date().toLocaleDateString('fr-FR');
      const title = tab === 'producteurs' ? 'Base de données — Producteurs' : 'Base de données — Coopératives';

      const head = [cols.map((c) => c.label)];
      let firstGroup = true;

      for (const [groupKey, rows] of groups.entries()) {
        const body = rows.map((row) => cols.map((c) => cellValue(row, c.key)));

        // Subtitle row if grouped
        const groupTitle = groupBy !== 'none' ? `${groupKey}  (${rows.length})` : undefined;

        autoTable(doc, {
          startY: firstGroup ? undefined : (doc as any).lastAutoTable?.finalY + (groupBy !== 'none' ? 12 : 6),
          head,
          body,
          styles: { fontSize: 6.5, cellPadding: 1.5 },
          headStyles: { fillColor: [27, 94, 32], textColor: 255, fontStyle: 'bold', fontSize: 7 },
          alternateRowStyles: { fillColor: [240, 248, 240] },
          margin: { left: 8, right: 8, top: 14 },
          tableWidth: 'auto',
          didDrawPage: (data) => {
            // Page header
            doc.setFontSize(7.5);
            doc.setTextColor(80);
            doc.text(`FENAPPACI — ${title} — Généré le ${date}`, 8, 8);
            doc.setFont('helvetica', 'bold');
            doc.text(`Page ${data.pageNumber}`, 289, 8, { align: 'right' });
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(0);

            // Group title on first page of a group
            if (groupTitle && data.pageNumber === (doc as any).internal.getCurrentPageInfo().pageNumber) {
              const y = data.cursor?.y ?? 14;
              doc.setFillColor(27, 94, 32);
              doc.rect(8, y - 5, 281, 7, 'F');
              doc.setTextColor(255);
              doc.setFontSize(8);
              doc.setFont('helvetica', 'bold');
              doc.text(groupTitle, 11, y - 0.5);
              doc.setTextColor(0);
              doc.setFont('helvetica', 'normal');
            }
          },
        });

        firstGroup = false;
      }

      doc.save(`FENAPPACI-${tab === 'producteurs' ? 'Producteurs' : 'Cooperatives'}-${new Date().toISOString().split('T')[0]}.pdf`);
    } finally {
      setExporting(null);
    }
  }, [groups, cols, tab, groupBy]);

  // ── Group options ─────────────────────────────────────────────────────────

  const groupByOptions =
    tab === 'producteurs'
      ? [
          { value: 'none', label: 'Sans regroupement' },
          { value: 'region', label: 'Par région' },
          { value: 'culture', label: 'Par culture' },
          { value: 'cooperative', label: 'Par coopérative' },
          { value: 'status', label: 'Par statut' },
        ]
      : [
          { value: 'none', label: 'Sans regroupement' },
          { value: 'region', label: 'Par région' },
        ];

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#f8f9f6] pb-28">
      {/* ── Header ── */}
      <div className="sticky top-0 z-20 bg-[#1B5E20] text-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/national" className="p-1 rounded-full hover:bg-white/10 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-base font-bold leading-tight">Base de données</h1>
              <p className="text-[11px] text-green-200">Espace ADMIN — {filtered.length} enregistrement{filtered.length > 1 ? 's' : ''}</p>
            </div>
          </div>
          {tab !== 'agents' && (
            <div className="flex gap-2">
              <button
                onClick={exportXLSX}
                disabled={!!exporting || filtered.length === 0}
                title="Exporter Excel"
                className="flex items-center gap-1.5 bg-green-700 hover:bg-green-600 disabled:opacity-40 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
              >
                {exporting === 'xlsx' ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
                <span>Excel</span>
              </button>
              <button
                onClick={exportPDF}
                disabled={!!exporting || filtered.length === 0}
                title="Exporter PDF"
                className="flex items-center gap-1.5 bg-green-700 hover:bg-green-600 disabled:opacity-40 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
              >
                {exporting === 'pdf' ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                <span>PDF</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="px-3 py-3 space-y-3 max-w-screen-xl mx-auto">
        {/* ── Tabs ── */}
        <div className="flex bg-white rounded-lg border border-gray-200 p-1 gap-1">
          {([
            { id: 'producteurs', label: 'Producteurs', icon: <Users size={15} />, count: producteurs.length },
            { id: 'cooperatives', label: 'Coopératives', icon: <Building2 size={15} />, count: cooperatives.length },
            { id: 'agents', label: 'Agents', icon: <UserCheck size={15} />, count: agents.length, badge: pendingCount },
          ] as { id: ActiveTab; label: string; icon: React.ReactNode; count: number; badge?: number }[]).map((t) => (
            <button
              key={t.id}
              onClick={() => switchTab(t.id)}
              className={`flex-1 relative flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-colors ${
                tab === t.id ? 'bg-[#1B5E20] text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t.icon}
              <span className="hidden sm:inline">{t.label}</span>
              <span className={`text-[10px] ${tab === t.id ? 'text-green-200' : 'text-gray-400'}`}>({t.count})</span>
              {t.badge != null && t.badge > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Filters ── */}
        <div className="bg-white rounded-lg border border-gray-200 p-3 space-y-2">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder={
                tab === 'producteurs' ? 'Rechercher un producteur…' :
                tab === 'cooperatives' ? 'Rechercher une coopérative…' :
                'Rechercher un agent…'
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {tab === 'agents' ? (
            <select
              value={filterAgentStatus}
              onChange={(e) => setFilterAgentStatus(e.target.value)}
              className="w-full border border-gray-200 rounded-md text-sm px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
            >
              <option value="">Tous les statuts</option>
              <option value="PENDING">En attente de validation</option>
              <option value="ACTIVE">Actifs</option>
              <option value="REJECTED">Refusés</option>
            </select>
          ) : (
            <div className={`grid gap-2 ${tab === 'producteurs' ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-2'}`}>
              <select
                value={filterRegion}
                onChange={(e) => setFilterRegion(e.target.value)}
                className="border border-gray-200 rounded-md text-sm px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              >
                <option value="">Toutes régions</option>
                {allRegions.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              {tab === 'producteurs' && (
                <select
                  value={filterCulture}
                  onChange={(e) => setFilterCulture(e.target.value)}
                  className="border border-gray-200 rounded-md text-sm px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                >
                  <option value="">Toutes cultures</option>
                  {allCultures.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
              {tab === 'producteurs' && (
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="border border-gray-200 rounded-md text-sm px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
                >
                  <option value="">Tous statuts</option>
                  <option value="ACTIF">Actif</option>
                  <option value="INACTIF">Inactif</option>
                </select>
              )}
              <select
                value={groupBy}
                onChange={(e) => { setGroupBy(e.target.value as GroupBy); setCollapsed(new Set()); }}
                className="border border-gray-200 rounded-md text-sm px-2.5 py-2 focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
              >
                {groupByOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* ── Stats ── */}
        {!isLoading && !error && (
          <div className="grid grid-cols-4 gap-2">
            {stats.map((s) => <StatCard key={s.label} {...s} />)}
          </div>
        )}

        {/* ── Content ── */}
        {isLoading ? (
          <div className="flex items-center justify-center h-48 bg-white rounded-lg border border-gray-200">
            <Loader2 size={32} className="animate-spin text-green-600" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-48 bg-white rounded-lg border border-red-200 text-red-600 gap-2">
            <AlertCircle size={28} />
            <p className="text-sm font-medium">Accès interdit ou erreur serveur</p>
            <p className="text-xs text-red-400">Cette page est réservée aux rôles ADMIN et DIRECTION.</p>
          </div>

        ) : tab === 'agents' ? (
          /* ── AGENTS TAB ───────────────────────────────────────────────── */
          <div className="space-y-4">
            {/* Pending agents — action cards */}
            {pendingAgents.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <Clock size={14} className="text-amber-500" />
                  <p className="text-sm font-semibold text-amber-700">
                    {pendingAgents.length} demande{pendingAgents.length > 1 ? 's' : ''} en attente de validation
                  </p>
                </div>
                {pendingAgents.map((a) => (
                  <div key={a.id} className="bg-white border-2 border-amber-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-sm">{a.prenoms} {a.nom}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{a.email}</p>
                        {a.telephone && <p className="text-xs text-gray-500">{a.telephone}</p>}
                      </div>
                      <span className="flex-shrink-0 bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                        En attente
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-600">
                      {a.region && <span className="bg-gray-100 px-2 py-0.5 rounded">📍 {a.region}</span>}
                      {a.departement && <span className="bg-gray-100 px-2 py-0.5 rounded">{a.departement}</span>}
                      {a.sous_prefecture && <span className="bg-gray-100 px-2 py-0.5 rounded">{a.sous_prefecture}</span>}
                      <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-400">
                        Inscrit le {new Date(a.created_at).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => approveMutation.mutate(a.id)}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-lg transition-colors"
                      >
                        {approveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                        Approuver
                      </button>
                      <button
                        onClick={() => rejectMutation.mutate(a.id)}
                        disabled={approveMutation.isPending || rejectMutation.isPending}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-red-50 hover:bg-red-100 disabled:opacity-50 text-red-600 border border-red-200 text-sm font-semibold py-2.5 rounded-lg transition-colors"
                      >
                        {rejectMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                        Refuser
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* All agents table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-gray-100 bg-gray-50">
                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  Tous les agents ({filteredA.length})
                </p>
              </div>
              <div className="divide-y divide-gray-100">
                {filteredA.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-8">Aucun agent trouvé</p>
                ) : filteredA.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-green-700">
                        {a.prenoms[0]}{a.nom[0]}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{a.prenoms} {a.nom}</p>
                      <p className="text-xs text-gray-500 truncate">{a.email}</p>
                      {(a.region || a.departement) && (
                        <p className="text-xs text-gray-400 truncate">
                          {[a.region, a.departement, a.sous_prefecture].filter(Boolean).join(' · ')}
                        </p>
                      )}
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        a.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                        a.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-600'
                      }`}>
                        {a.status === 'ACTIVE' ? 'Actif' : a.status === 'PENDING' ? 'En attente' : 'Refusé'}
                      </span>
                      {a.status === 'PENDING' && (
                        <div className="flex gap-1 mt-1.5 justify-end">
                          <button
                            onClick={() => approveMutation.mutate(a.id)}
                            disabled={approveMutation.isPending}
                            title="Approuver"
                            className="p-1 rounded-full bg-green-100 hover:bg-green-200 text-green-700 transition-colors disabled:opacity-50"
                          >
                            <UserCheck size={12} />
                          </button>
                          <button
                            onClick={() => rejectMutation.mutate(a.id)}
                            disabled={rejectMutation.isPending}
                            title="Refuser"
                            className="p-1 rounded-full bg-red-100 hover:bg-red-200 text-red-600 transition-colors disabled:opacity-50"
                          >
                            <UserX size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 bg-white rounded-lg border border-gray-200 text-gray-400 gap-2">
            <AlertCircle size={28} />
            <p className="text-sm">Aucun résultat</p>
          </div>
        ) : (
          <div className="space-y-2">
            {[...groups.entries()].map(([gkey, rows]) => (
              <div key={gkey} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {groupBy !== 'none' && (
                  <button
                    onClick={() => toggleGroup(gkey)}
                    className="w-full flex items-center justify-between px-4 py-2.5 bg-green-50 border-b border-green-200 hover:bg-green-100 transition-colors text-left"
                  >
                    <span className="font-semibold text-green-900 text-sm">
                      {gkey}{' '}
                      <span className="font-normal text-green-700 text-xs">({rows.length})</span>
                    </span>
                    {collapsed.has(gkey)
                      ? <ChevronDown size={15} className="text-green-700 flex-shrink-0" />
                      : <ChevronUp size={15} className="text-green-700 flex-shrink-0" />}
                  </button>
                )}
                {!collapsed.has(gkey) && (
                  <div className="overflow-x-auto">
                    <table className="text-xs border-collapse" style={{ minWidth: 'max-content', width: '100%' }}>
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="px-3 py-2 text-left font-semibold text-gray-500 sticky left-0 bg-gray-50 z-10 border-r border-gray-100 w-8">#</th>
                          {cols.map((c) => (
                            <th key={c.key} className="px-3 py-2 text-left font-semibold text-gray-700 whitespace-nowrap">{c.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, i) => {
                          const bg = i % 2 === 0 ? '#ffffff' : '#f9fafb';
                          return (
                            <tr key={row.id as number}>
                              <td className="px-3 py-1.5 text-gray-400 sticky left-0 border-r border-gray-100 z-10 w-8" style={{ background: bg }}>{i + 1}</td>
                              {cols.map((c) => {
                                const val = cellValue(row, c.key);
                                return (
                                  <td
                                    key={c.key}
                                    className={`px-3 py-1.5 whitespace-nowrap ${
                                      c.key === 'status'
                                        ? row.status === 'ACTIF' ? 'text-green-700 font-medium' : 'text-red-500 font-medium'
                                        : 'text-gray-700'
                                    }`}
                                    style={{ background: bg }}
                                  >
                                    {val || <span className="text-gray-300">—</span>}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                      {rows.length > 1 && (
                        <tfoot>
                          <tr className="border-t-2 border-green-300 bg-green-50 font-semibold text-green-800">
                            <td className="px-3 py-2 sticky left-0 bg-green-50 border-r border-green-200 z-10">∑</td>
                            {totalsRow(rows).map((val, i) => (
                              <td key={i} className="px-3 py-2 whitespace-nowrap">{val}</td>
                            ))}
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
