import { useState } from 'react';
import { useListProducteurs, useListCooperatives } from '@workspace/api-client-react';
import { Input } from '@/components/ui/input';
import { Search as SearchIcon, MapPin, Building2, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';

export default function SearchPage() {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const [regionFilter, setRegionFilter] = useState('');
  const [coopFilter, setCoopFilter] = useState('');

  const { data: cooperatives } = useListCooperatives();
  
  // Only search if there's input or filters
  const hasFilters = debouncedSearch || regionFilter || coopFilter;
  
  const { data: producteurs, isLoading } = useListProducteurs({
    search: debouncedSearch,
    region: regionFilter || undefined,
    cooperative_id: coopFilter || undefined,
  }, {
    query: {
      enabled: !!hasFilters,
    }
  });

  return (
    <div className="h-full flex flex-col">
      <div className="bg-[#1B5E20] p-4 pt-6 text-white space-y-4 shadow-md z-10 sticky top-0">
        <div className="relative">
          <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-[#1B5E20]" />
          <Input 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un producteur..." 
            className="pl-12 bg-white border-none text-black h-14 rounded-2xl w-full text-lg shadow-inner"
            autoFocus
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          <select 
            className="bg-white/20 text-white border-none rounded-xl px-3 py-2 text-sm font-medium outline-none appearance-none"
            value={regionFilter}
            onChange={e => setRegionFilter(e.target.value)}
          >
            <option value="" className="text-black">Toutes les régions</option>
            <option value="Agneby-Tiassa" className="text-black">Agneby-Tiassa</option>
            <option value="Bafing" className="text-black">Bafing</option>
            <option value="Indenie-Djuablin" className="text-black">Indenie-Djuablin</option>
          </select>

          <select 
            className="bg-white/20 text-white border-none rounded-xl px-3 py-2 text-sm font-medium outline-none appearance-none max-w-[150px]"
            value={coopFilter}
            onChange={e => setCoopFilter(e.target.value)}
          >
            <option value="" className="text-black">Toutes les coop.</option>
            {cooperatives?.map(c => (
              <option key={c.id} value={c.id} className="text-black">{c.nom}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="p-4 space-y-3 pb-24">
        {!hasFilters ? (
          <div className="text-center text-muted-foreground py-16 flex flex-col items-center">
            <SearchIcon className="w-16 h-16 mb-4 text-[#1B5E20]/20" />
            <p className="font-medium text-lg text-[#1B5E20]/60">Recherche globale</p>
            <p className="text-sm mt-1">Saisissez un nom, numéro CIN, ou téléphone</p>
          </div>
        ) : isLoading ? (
          <div className="flex justify-center p-8">
            <div className="w-8 h-8 border-4 border-[#F57C00] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : producteurs?.length === 0 ? (
          <div className="text-center text-muted-foreground py-12 flex flex-col items-center">
            <User className="w-12 h-12 mb-3 text-muted-foreground/50" />
            <p className="font-medium">Aucun résultat trouvé</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-medium text-muted-foreground mb-2">
              {producteurs?.length} résultat{producteurs?.length !== 1 ? 's' : ''}
            </p>
            {producteurs?.map(p => (
              <div key={p.id} className="bg-white p-4 rounded-2xl border shadow-sm flex flex-col gap-3 active:scale-[0.98] transition-transform">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-muted rounded-full flex-none flex items-center justify-center overflow-hidden">
                    {p.photo_path ? (
                      <img src={p.photo_path} alt={p.nom} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-6 h-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h3 className="font-bold text-[15px] truncate pr-2">
                        {p.nom} {p.prenoms}
                      </h3>
                    </div>
                    <p className="text-xs text-muted-foreground mb-1 font-mono">{p.numero_membre}</p>
                    <Badge className={cn(
                      "text-[10px] px-1.5 py-0 mt-1",
                      p.status === 'ACTIF' ? "bg-[#4CAF50]" : 
                      p.status === 'EN_ATTENTE' ? "bg-[#F57C00]" : "bg-gray-400"
                    )}>
                      {p.status}
                    </Badge>
                  </div>
                </div>
                
                <div className="flex gap-4 pt-3 border-t text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5 truncate max-w-[50%]">
                    <MapPin className="w-3.5 h-3.5 text-[#F57C00] flex-none" />
                    <span className="truncate">{p.village}</span>
                  </div>
                  {p.cooperative_nom && (
                    <div className="flex items-center gap-1.5 truncate max-w-[50%]">
                      <Building2 className="w-3.5 h-3.5 text-[#2E7D32] flex-none" />
                      <span className="truncate">{p.cooperative_nom}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
