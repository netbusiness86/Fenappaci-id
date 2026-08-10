/**
 * DISPONIBILITÉS AGRICOLES — Recherche de productions disponibles
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, ShoppingCart, MapPin, Phone, Filter, X, TrendingUp, Loader2 } from 'lucide-react';

interface DispoResult {
  production_id: number;
  culture: string | null;
  campagne: string | null;
  quantite_disponible: number | null;
  quantite_vente: number | null;
  unite: string | null;
  recherche_acheteur: string | null;
  prix_souhaite: number | null;
  periode_disponibilite: string | null;
  producteur: {
    id: number;
    nom: string;
    prenoms: string;
    numero_membre: string;
    region: string | null;
    departement: string | null;
    village: string | null;
    telephone: string | null;
    cooperative: string | null;
  };
}

async function fetchDispos(params: Record<string, string>) {
  const q = new URLSearchParams(Object.fromEntries(Object.entries(params).filter(([,v]) => v !== '')));
  const res = await fetch(`/api/disponibilites?${q}`, { credentials: 'include' });
  if (!res.ok) throw new Error('Erreur serveur');
  return res.json() as Promise<DispoResult[]>;
}

export default function Disponibilites() {
  const [filters, setFilters] = useState({ culture: '', region: '', departement: '', cooperative: '', quantite_min: '' });
  const [active, setActive] = useState(filters);
  const [showFilters, setShowFilters] = useState(false);

  const { data = [], isLoading, refetch } = useQuery<DispoResult[]>({
    queryKey: ['disponibilites', active],
    queryFn: () => fetchDispos(active),
  });

  const apply = () => { setActive(filters); setShowFilters(false); };
  const reset = () => { const empty = { culture: '', region: '', departement: '', cooperative: '', quantite_min: '' }; setFilters(empty); setActive(empty); setShowFilters(false); };
  const activeCount = Object.values(active).filter(v => v !== '').length;

  return (
    <div className="flex flex-col min-h-[calc(100dvh-4rem)] bg-[#f8f9f6]">
      {/* Header */}
      <div className="bg-[#1B5E20] px-4 py-4 text-white">
        <h1 className="text-xl font-black uppercase tracking-wide mb-1">Disponibilités Agricoles</h1>
        <p className="text-white/70 text-xs">Productions disponibles à la vente</p>
      </div>

      {/* Search bar */}
      <div className="bg-white border-b px-4 py-3 flex gap-2 items-center sticky top-0 z-10 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            className="pl-9 h-10 bg-gray-50/50 text-sm"
            placeholder="Rechercher une culture…"
            value={filters.culture}
            onChange={e => setFilters(p => ({ ...p, culture: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && apply()}
          />
        </div>
        <button
          type="button"
          onClick={() => setShowFilters(f => !f)}
          className={`relative h-10 w-10 flex items-center justify-center rounded-xl border transition-colors ${showFilters ? 'bg-[#1B5E20] text-white border-[#1B5E20]' : 'bg-white text-gray-600 border-gray-200'}`}
        >
          <Filter className="w-4 h-4" />
          {activeCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#F57C00] text-white text-[9px] font-bold rounded-full flex items-center justify-center">{activeCount}</span>
          )}
        </button>
        <Button className="h-10 px-4 bg-[#F57C00] hover:bg-[#E65100] text-white text-sm font-bold rounded-xl" onClick={apply}>Filtrer</Button>
      </div>

      {/* Filters panel */}
      {showFilters && (
        <div className="bg-white border-b px-4 py-4 space-y-3 shadow-sm">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-gray-400">Région</label>
              <Input className="h-9 text-sm" placeholder="ex: Gbêkê" value={filters.region} onChange={e => setFilters(p => ({ ...p, region: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-gray-400">Département</label>
              <Input className="h-9 text-sm" placeholder="ex: Bouaké" value={filters.departement} onChange={e => setFilters(p => ({ ...p, departement: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-gray-400">Coopérative</label>
              <Input className="h-9 text-sm" placeholder="Nom de la coop." value={filters.cooperative} onChange={e => setFilters(p => ({ ...p, cooperative: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-gray-400">Qté min. disponible</label>
              <Input type="number" min="0" className="h-9 text-sm" placeholder="ex: 100" value={filters.quantite_min} onChange={e => setFilters(p => ({ ...p, quantite_min: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 h-9 text-sm" onClick={reset}>
              <X className="w-3.5 h-3.5 mr-1" />Réinitialiser
            </Button>
            <Button className="flex-1 h-9 text-sm bg-[#1B5E20] hover:bg-[#2E7D32] text-white" onClick={apply}>Appliquer</Button>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="flex-1 p-4 space-y-3 pb-20">
        {isLoading && (
          <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Chargement…</span>
          </div>
        )}

        {!isLoading && data.length === 0 && (
          <div className="text-center py-16 text-gray-400">
            <TrendingUp className="w-12 h-12 mx-auto mb-3 text-gray-200" />
            <p className="text-sm font-medium">Aucune disponibilité trouvée</p>
            <p className="text-xs mt-1">Modifiez les filtres ou ajoutez des productions</p>
          </div>
        )}

        {!isLoading && data.length > 0 && (
          <p className="text-xs text-gray-500 font-medium">{data.length} résultat{data.length > 1 ? 's' : ''}</p>
        )}

        {data.map(item => (
          <div key={item.production_id} className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            {/* Culture header */}
            <div className="flex items-center justify-between px-4 py-3 bg-[#1B5E20] text-white">
              <div>
                <p className="font-black text-base uppercase tracking-wide">{item.culture ?? '—'}</p>
                {item.campagne && <p className="text-white/70 text-xs">Campagne {item.campagne}</p>}
              </div>
              <div className="text-right">
                <p className="font-black text-xl text-[#A5D6A7]">
                  {item.quantite_disponible != null ? item.quantite_disponible.toLocaleString('fr-FR') : '—'}
                </p>
                <p className="text-white/80 text-xs">{item.unite ?? 'Kg'} disponibles</p>
              </div>
            </div>

            {/* Producteur info */}
            <div className="px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-gray-900 text-sm">{item.producteur.nom} {item.producteur.prenoms}</p>
                  <p className="text-[10px] font-mono text-gray-400">{item.producteur.numero_membre}</p>
                </div>
                {item.recherche_acheteur === 'OUI' && (
                  <Badge className="bg-[#FFF3E0] text-[#E65100] border border-[#FFE0B2] text-[10px] flex items-center gap-1">
                    <ShoppingCart className="w-2.5 h-2.5" />Acheteur recherché
                  </Badge>
                )}
              </div>

              {(item.producteur.village || item.producteur.departement || item.producteur.region) && (
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <MapPin className="w-3.5 h-3.5 text-[#2E7D32] shrink-0" />
                  <span>{[item.producteur.village, item.producteur.departement, item.producteur.region].filter(Boolean).join(', ')}</span>
                </div>
              )}

              {/* Stats bar */}
              <div className="flex gap-3 text-xs mt-1 flex-wrap">
                {item.quantite_vente != null && (
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-400 uppercase font-semibold">À vendre</span>
                    <span className="font-bold text-[#F57C00]">{item.quantite_vente.toLocaleString('fr-FR')} {item.unite}</span>
                  </div>
                )}
                {item.prix_souhaite != null && (
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-400 uppercase font-semibold">Prix souhaité</span>
                    <span className="font-bold text-gray-700">{item.prix_souhaite.toLocaleString('fr-FR')} FCFA</span>
                  </div>
                )}
                {item.periode_disponibilite && (
                  <div className="flex flex-col">
                    <span className="text-[10px] text-gray-400 uppercase font-semibold">Disponible</span>
                    <span className="font-medium text-gray-600">📅 {item.periode_disponibilite}</span>
                  </div>
                )}
              </div>

              {item.producteur.cooperative && (
                <p className="text-[10px] text-gray-400">🏘️ {item.producteur.cooperative}</p>
              )}

              {item.producteur.telephone && (
                <a href={`tel:${item.producteur.telephone}`} className="flex items-center gap-1.5 text-xs text-[#1B5E20] font-semibold mt-1">
                  <Phone className="w-3.5 h-3.5" />{item.producteur.telephone}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
