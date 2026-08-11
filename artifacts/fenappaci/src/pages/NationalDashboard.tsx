import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation, Link } from 'wouter';
import {
  Users, Building2, Tractor, Leaf, TrendingUp, ShoppingBasket,
  UserCog, Sprout, MapPin, BarChart3, Search, Download, Globe,
  Loader2, AlertTriangle, X, Database, ChevronRight,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ── Leaflet (dynamique pour éviter SSR) ─────────────────────────────────────
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix icônes Leaflet dans Vite
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({ iconUrl: markerIcon, iconRetinaUrl: markerIcon2x, shadowUrl: markerShadow });

// ── Types ────────────────────────────────────────────────────────────────────
interface NationalStats {
  kpis: {
    total_producteurs: number; total_cooperatives: number;
    total_exploitations: number; total_parcelles: number;
    total_agents: number; superficie_totale: number;
    production_totale: number; production_disponible: number;
  };
  par_region: {
    producteurs: { region: string; count: number }[];
    cooperatives: { region: string; count: number }[];
    exploitations: { region: string; count: number }[];
  };
  par_filiere: {
    culture: string; nombre_producteurs: number;
    superficie_totale: number; production_estimee: number; production_disponible: number;
  }[];
  par_sexe: { label: string; count: number }[];
}

interface MapData {
  producteurs: { id: number; nom: string; prenoms: string; numero_membre: string; telephone: string; village: string; cultures: string; region: string; lat: number; lng: number }[];
  farms: { id: number; nom_exploitation: string; lat: number; lng: number; nom: string; prenoms: string; numero_membre: string }[];
}

type Tab = 'kpis' | 'geo' | 'filieres' | 'carte' | 'recherche' | 'exports';

const COLORS = ['#1B5E20', '#F57C00', '#2196F3', '#9C27B0', '#FF5722', '#009688', '#795548', '#607D8B', '#E91E63', '#3F51B5'];

async function apiFetch<T>(path: string): Promise<T> {
  const r = await fetch(path, { credentials: 'include' });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function NationalDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState<Tab>('kpis');
  const [stats, setStats] = useState<NationalStats | null>(null);
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingMap, setLoadingMap] = useState(false);
  const [error, setError] = useState('');
  const [geoView, setGeoView] = useState<'producteurs' | 'cooperatives' | 'exploitations'>('producteurs');

  // Recherche
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Garde rôle
  const role = user?.role;
  useEffect(() => {
    if (user !== undefined && role && !['ADMIN', 'DIRECTION'].includes(role)) {
      setLocation('/tableau-de-bord');
    }
  }, [user, role, setLocation]);

  // Charger stats
  useEffect(() => {
    apiFetch<NationalStats>('/api/stats/national')
      .then(d => { setStats(d); setLoadingStats(false); })
      .catch(e => { setError(e.message); setLoadingStats(false); });
  }, []);

  // Charger map data à la demande
  useEffect(() => {
    if (tab === 'carte' && !mapData) {
      setLoadingMap(true);
      apiFetch<MapData>('/api/stats/map')
        .then(d => { setMapData(d); setLoadingMap(false); })
        .catch(() => setLoadingMap(false));
    }
  }, [tab, mapData]);

  // Recherche
  useEffect(() => {
    if (!searchQ.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const [prods, coops] = await Promise.all([
          apiFetch<any[]>(`/api/producteurs?search=${encodeURIComponent(searchQ)}`),
          apiFetch<any[]>(`/api/cooperatives?search=${encodeURIComponent(searchQ)}`),
        ]);
        setSearchResults([
          ...prods.slice(0, 5).map((p: any) => ({ ...p, _type: 'producteur' })),
          ...coops.slice(0, 3).map((c: any) => ({ ...c, _type: 'cooperative' })),
        ]);
      } catch { /* silence */ }
      setSearchLoading(false);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQ]);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'kpis', label: 'KPIs', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'geo', label: 'Géo.', icon: <MapPin className="w-4 h-4" /> },
    { id: 'filieres', label: 'Filières', icon: <Sprout className="w-4 h-4" /> },
    { id: 'carte', label: 'Carte', icon: <Globe className="w-4 h-4" /> },
    { id: 'recherche', label: 'Rech.', icon: <Search className="w-4 h-4" /> },
    { id: 'exports', label: 'Exports', icon: <Download className="w-4 h-4" /> },
  ];

  if (loadingStats) return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8f9f6]">
      <div className="text-center space-y-3">
        <Loader2 className="w-10 h-10 animate-spin text-[#1B5E20] mx-auto" />
        <p className="text-sm text-gray-500">Chargement des statistiques nationales…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 bg-[#f8f9f6]">
      <AlertTriangle className="w-12 h-12 text-[#F57C00]" />
      <p className="text-gray-700 text-center">{error}</p>
      <Button onClick={() => window.location.reload()} variant="outline">Réessayer</Button>
    </div>
  );

  if (!stats) return null;

  const { kpis, par_region, par_filiere } = stats;

  // Données géo fusionnées pour le graphique
  const allRegions = Array.from(new Set([
    ...par_region.producteurs.map(r => r.region),
    ...par_region.cooperatives.map(r => r.region),
    ...par_region.exploitations.map(r => r.region),
  ])).slice(0, 10);

  const geoChartData = allRegions.map(region => ({
    region: region.length > 12 ? region.slice(0, 12) + '…' : region,
    Producteurs: par_region.producteurs.find(r => r.region === region)?.count ?? 0,
    Coopératives: par_region.cooperatives.find(r => r.region === region)?.count ?? 0,
    Exploitations: par_region.exploitations.find(r => r.region === region)?.count ?? 0,
  }));

  return (
    <div className="min-h-screen bg-[#f8f9f6] pb-6">
      {/* En-tête */}
      <div className="bg-[#1B5E20] text-white px-4 pt-4 pb-0">
        <div className="mb-3">
          <h1 className="text-xl font-bold">Tableau de Bord National</h1>
          <p className="text-white/60 text-xs">FENAPPACI — Vue Direction Générale</p>
        </div>
        {/* Onglets */}
        <div className="flex overflow-x-auto gap-1 pb-0 scrollbar-hide">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors flex-shrink-0',
                tab === t.id ? 'border-[#F57C00] text-white' : 'border-transparent text-white/50'
              )}
            >
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* ── KPIs ──────────────────────────────────────────────────────────── */}
        {tab === 'kpis' && (
          <>
            <SectionTitle>Indicateurs Principaux</SectionTitle>
            <div className="grid grid-cols-2 gap-3">
              <KpiCard icon={<Users className="w-5 h-5 text-[#2E7D32]" />} label="Producteurs" value={kpis.total_producteurs} bg="bg-[#E8F5E9]" />
              <KpiCard icon={<Building2 className="w-5 h-5 text-purple-600" />} label="Coopératives" value={kpis.total_cooperatives} bg="bg-purple-50" />
              <KpiCard icon={<Tractor className="w-5 h-5 text-[#1B5E20]" />} label="Exploitations" value={kpis.total_exploitations} bg="bg-[#E8F5E9]" />
              <KpiCard icon={<Leaf className="w-5 h-5 text-[#2E7D32]" />} label="Parcelles" value={kpis.total_parcelles} bg="bg-[#E8F5E9]" />
              <KpiCard icon={<Sprout className="w-5 h-5 text-[#F57C00]" />} label="Superficie (ha)" value={kpis.superficie_totale} decimals={1} bg="bg-[#FFF3E0]" />
              <KpiCard icon={<TrendingUp className="w-5 h-5 text-[#E65100]" />} label="Production (T)" value={kpis.production_totale} decimals={1} bg="bg-[#FFF3E0]" />
              <KpiCard icon={<ShoppingBasket className="w-5 h-5 text-blue-600" />} label="Dispo. vente (T)" value={kpis.production_disponible} decimals={1} bg="bg-blue-50" />
              <KpiCard icon={<UserCog className="w-5 h-5 text-gray-600" />} label="Agents actifs" value={kpis.total_agents} bg="bg-gray-50" />
            </div>

            {/* Répartition sexe */}
            {stats.par_sexe.length > 0 && (
              <>
                <SectionTitle>Répartition Hommes / Femmes</SectionTitle>
                <div className="bg-white rounded-2xl p-4 shadow-sm border">
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={stats.par_sexe} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={70} label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`}>
                        {stats.par_sexe.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </>
        )}

        {/* ── GÉO ───────────────────────────────────────────────────────────── */}
        {tab === 'geo' && (
          <>
            <SectionTitle>Répartition Géographique</SectionTitle>
            {/* Sélecteur de vue */}
            <div className="flex bg-white rounded-xl border overflow-hidden shadow-sm">
              {(['producteurs', 'cooperatives', 'exploitations'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => setGeoView(v)}
                  className={cn('flex-1 py-2 text-xs font-semibold capitalize transition-colors',
                    geoView === v ? 'bg-[#1B5E20] text-white' : 'text-gray-500')}
                >
                  {v === 'producteurs' ? 'Producteurs' : v === 'cooperatives' ? 'Coopératives' : 'Exploitations'}
                </button>
              ))}
            </div>

            <div className="bg-white rounded-2xl p-3 shadow-sm border">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={par_region[geoView].slice(0, 10).map(r => ({ name: r.region.length > 10 ? r.region.slice(0, 10) + '…' : r.region, Nombre: r.count }))}
                  margin={{ top: 5, right: 10, left: -10, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-40} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="Nombre" fill="#1B5E20" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Vue comparative */}
            {geoChartData.length > 0 && (
              <>
                <SectionTitle>Comparatif par Région</SectionTitle>
                <div className="bg-white rounded-2xl p-3 shadow-sm border overflow-x-auto">
                  <div style={{ minWidth: Math.max(geoChartData.length * 60, 320) }}>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={geoChartData} margin={{ top: 5, right: 10, left: -10, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="region" tick={{ fontSize: 9 }} angle={-40} textAnchor="end" interval={0} />
                        <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                        <Tooltip />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                        <Bar dataKey="Producteurs" fill="#1B5E20" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="Coopératives" fill="#9C27B0" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="Exploitations" fill="#F57C00" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ── FILIÈRES ──────────────────────────────────────────────────────── */}
        {tab === 'filieres' && (
          <>
            <SectionTitle>Répartition par Filière</SectionTitle>
            {par_filiere.length === 0 ? (
              <EmptyState icon={<Sprout />} message="Aucune donnée de production enregistrée." />
            ) : (
              <>
                {/* Graphique nombre de producteurs par culture */}
                <div className="bg-white rounded-2xl p-3 shadow-sm border">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Producteurs par culture</p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={par_filiere.slice(0, 10).map(f => ({ name: f.culture.length > 12 ? f.culture.slice(0, 12) + '…' : f.culture, Producteurs: f.nombre_producteurs }))}
                      layout="vertical" margin={{ top: 0, right: 20, left: 50, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={50} />
                      <Tooltip />
                      <Bar dataKey="Producteurs" fill="#1B5E20" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Tableau filière */}
                <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">
                  <div className="grid grid-cols-4 bg-[#1B5E20] text-white text-[10px] font-bold uppercase tracking-wide px-3 py-2">
                    <span>Culture</span><span className="text-right">Prod.</span><span className="text-right">Sup. ha</span><span className="text-right">Dispo T</span>
                  </div>
                  {par_filiere.map((f, i) => (
                    <div key={i} className={cn('grid grid-cols-4 px-3 py-2.5 text-xs border-b last:border-0', i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50')}>
                      <span className="font-semibold text-gray-800 truncate">{f.culture}</span>
                      <span className="text-right text-gray-600">{f.nombre_producteurs}</span>
                      <span className="text-right text-gray-600">{f.superficie_totale.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}</span>
                      <span className="text-right font-semibold text-[#F57C00]">{f.production_disponible.toLocaleString('fr-FR', { maximumFractionDigits: 1 })}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* ── CARTE ─────────────────────────────────────────────────────────── */}
        {tab === 'carte' && (
          <>
            <SectionTitle>Carte FENAPPACI</SectionTitle>
            {loadingMap ? (
              <div className="bg-white rounded-2xl flex items-center justify-center h-64 shadow-sm border">
                <div className="text-center space-y-2">
                  <Loader2 className="w-8 h-8 animate-spin text-[#1B5E20] mx-auto" />
                  <p className="text-sm text-gray-500">Chargement de la carte…</p>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl overflow-hidden shadow-sm border" style={{ height: 380 }}>
                <MapContainer
                  center={[7.5399, -5.5471]} zoom={6}
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom={false}
                >
                  <TileLayer
                    attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {(mapData?.producteurs ?? []).map(p => (
                    <Marker key={`p-${p.id}`} position={[p.lat, p.lng]}>
                      <Popup>
                        <div className="text-xs space-y-1" style={{ minWidth: 160 }}>
                          <p className="font-bold text-sm">{p.nom} {p.prenoms}</p>
                          <p className="text-gray-500">{p.numero_membre}</p>
                          {p.telephone && <p>📞 {p.telephone}</p>}
                          {p.village && <p>📍 {p.village}</p>}
                          {p.cultures && <p>🌱 {p.cultures}</p>}
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                  {(mapData?.farms ?? []).map((f: any) => (
                    <Marker key={`f-${f.id}`} position={[f.lat, f.lng]}>
                      <Popup>
                        <div className="text-xs space-y-1">
                          <p className="font-bold">🚜 {f.nom_exploitation || 'Exploitation'}</p>
                          <p className="text-gray-500">{f.nom} {f.prenoms}</p>
                          <p>{f.numero_membre}</p>
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </div>
            )}

            {/* Légende */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Légende</p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-blue-500 flex-shrink-0" />
                  <span className="text-gray-700">{mapData?.producteurs?.length ?? 0} producteur(s) géolocalisé(s)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full bg-orange-500 flex-shrink-0" />
                  <span className="text-gray-700">{mapData?.farms?.length ?? 0} exploitation(s) géolocalisée(s)</span>
                </div>
              </div>
              {(!mapData?.producteurs?.length && !mapData?.farms?.length) && (
                <p className="text-xs text-gray-400 mt-3">Aucun point GPS enregistré pour le moment. Activez la géolocalisation lors de l'identification des producteurs.</p>
              )}
            </div>
          </>
        )}

        {/* ── RECHERCHE ─────────────────────────────────────────────────────── */}
        {tab === 'recherche' && (
          <>
            <SectionTitle>Recherche Avancée</SectionTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="Producteur, coopérative, région, culture…"
                className="pl-10 rounded-xl"
              />
              {searchQ && (
                <button onClick={() => setSearchQ('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>

            {searchLoading && (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-[#1B5E20]" />
              </div>
            )}

            {!searchLoading && searchResults.length > 0 && (
              <div className="space-y-2">
                {searchResults.map((r, i) => (
                  <button
                    key={i}
                    className="w-full bg-white rounded-xl border shadow-sm p-3 text-left flex items-center gap-3 active:scale-[0.99] transition-transform"
                    onClick={() => setLocation(r._type === 'producteur' ? `/producteurs/${r.id}` : `/cooperatives/${r.id}`)}
                  >
                    <div className={cn('w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0', r._type === 'producteur' ? 'bg-[#E8F5E9]' : 'bg-purple-50')}>
                      {r._type === 'producteur' ? <Users className="w-4 h-4 text-[#2E7D32]" /> : <Building2 className="w-4 h-4 text-purple-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{r._type === 'producteur' ? `${r.nom} ${r.prenoms}` : r.nom}</p>
                      <p className="text-xs text-gray-400 truncate">
                        {r._type === 'producteur' ? `${r.numero_membre ?? ''} · ${r.region ?? ''}` : `Coopérative · ${r.region ?? ''}`}
                      </p>
                    </div>
                    <Badge variant="outline" className={r._type === 'producteur' ? 'border-[#2E7D32]/30 text-[#2E7D32]' : 'border-purple-300 text-purple-600'} style={{ fontSize: 10 }}>
                      {r._type === 'producteur' ? 'Producteur' : 'Coopérative'}
                    </Badge>
                  </button>
                ))}
              </div>
            )}

            {!searchLoading && searchQ.trim() && searchResults.length === 0 && (
              <EmptyState icon={<Search />} message={`Aucun résultat pour "${searchQ}"`} />
            )}

            {!searchQ && (
              <div className="bg-white rounded-2xl p-5 border shadow-sm text-center space-y-2">
                <Search className="w-8 h-8 text-gray-300 mx-auto" />
                <p className="text-sm text-gray-500">Recherchez par nom, numéro de membre, région, culture ou coopérative.</p>
              </div>
            )}
          </>
        )}

        {/* ── EXPORTS ───────────────────────────────────────────────────────── */}
        {tab === 'exports' && (
          <>
            <SectionTitle>Exports CSV / Excel</SectionTitle>
            <p className="text-xs text-gray-500">Les fichiers CSV s'ouvrent directement dans Excel, Numbers ou LibreOffice. L'encodage UTF-8 BOM préserve les accents.</p>

            <div className="space-y-3">
              <ExportCard
                icon={<Users className="w-5 h-5 text-[#2E7D32]" />}
                title="Producteurs"
                description={`${kpis.total_producteurs} enregistrés · Nom, région, cultures, statut, superficie`}
                href="/api/exports/producteurs"
                color="bg-[#E8F5E9]"
              />
              <ExportCard
                icon={<Building2 className="w-5 h-5 text-purple-600" />}
                title="Coopératives"
                description={`${kpis.total_cooperatives} enregistrées · Nom, région, responsables, membres`}
                href="/api/exports/cooperatives"
                color="bg-purple-50"
              />
              <ExportCard
                icon={<TrendingUp className="w-5 h-5 text-[#F57C00]" />}
                title="Productions"
                description="Toutes les productions · Culture, superficie, production estimée, disponible"
                href="/api/exports/productions"
                color="bg-[#FFF3E0]"
              />
            </div>

            <div className="bg-[#E8F5E9] rounded-2xl p-4 border border-[#2E7D32]/20">
              <p className="text-xs font-semibold text-[#1B5E20] mb-1">Export PDF</p>
              <p className="text-xs text-[#1B5E20]/70">
                Pour générer un rapport PDF complet, utilisez la fonction impression du navigateur (Ctrl+P / Cmd+P) depuis cette page — les graphiques et tableaux sont optimisés pour l'impression.
              </p>
            </div>

            {/* Base de données ADMIN */}
            <div className="mt-2">
              <SectionTitle>Base de données</SectionTitle>
              <p className="text-xs text-gray-500 mb-3">Explorez, filtrez et regroupez l'intégralité des données producteurs et coopératives, puis exportez en Excel ou PDF.</p>
              <Link href="/admin/base-de-donnees">
                <div className="flex items-center gap-4 bg-[#1B5E20] text-white rounded-2xl p-4 shadow-md cursor-pointer hover:bg-[#2E7D32] transition-colors">
                  <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Database className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">Base de données complète</p>
                    <p className="text-xs text-green-200 mt-0.5">Producteurs · Coopératives · Filtres · Regroupements · Excel / PDF</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-green-300 flex-shrink-0" />
                </div>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Sous-composants ──────────────────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wide">{children}</h2>;
}

function KpiCard({ icon, label, value, bg, decimals = 0 }: {
  icon: React.ReactNode; label: string; value: number; bg: string; decimals?: number;
}) {
  const display = decimals > 0
    ? value.toLocaleString('fr-FR', { maximumFractionDigits: decimals })
    : Math.round(value).toLocaleString('fr-FR');
  return (
    <div className={cn('rounded-2xl p-4 shadow-sm border-none', bg)}>
      <div className="w-8 h-8 rounded-full bg-white/60 flex items-center justify-center mb-2">{icon}</div>
      <p className="text-2xl font-bold leading-none mb-1">{display}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</p>
    </div>
  );
}

function ExportCard({ icon, title, description, href, color }: {
  icon: React.ReactNode; title: string; description: string; href: string; color: string;
}) {
  return (
    <div className={cn('rounded-2xl p-4 shadow-sm border flex items-center gap-4', color, 'border-transparent')}>
      <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-800">{title}</p>
        <p className="text-xs text-gray-500 truncate">{description}</p>
      </div>
      <a
        href={href}
        download
        className="flex-shrink-0 bg-white rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm border flex items-center gap-1.5 hover:bg-gray-50 active:scale-95 transition-transform"
      >
        <Download className="w-3.5 h-3.5" /> CSV
      </a>
    </div>
  );
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="bg-white rounded-2xl p-8 text-center shadow-sm border space-y-3">
      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto text-gray-300">
        {icon}
      </div>
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
}
