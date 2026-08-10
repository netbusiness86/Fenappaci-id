import { useState } from 'react';
import { useListProducteurs } from '@workspace/api-client-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Plus, User, MapPin, Pencil } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';

export default function MyProducers() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data: producteurs, isLoading } = useListProducteurs({
    search: debouncedSearch,
    status: statusFilter || undefined,
  });

  const filters = [
    { label: 'Tous', value: '' },
    { label: 'Actifs', value: 'ACTIF' },
    { label: 'En attente', value: 'EN_ATTENTE' },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="bg-[#1B5E20] p-4 text-white space-y-4 shadow-md z-10 sticky top-0">
        <h2 className="text-xl font-display font-bold">Mes Producteurs</h2>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, CIN, tel..." 
            className="pl-10 bg-white border-none text-black h-12 rounded-xl w-full"
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {filters.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={cn(
                "px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap transition-colors",
                statusFilter === f.value 
                  ? "bg-[#F57C00] text-white shadow-sm" 
                  : "bg-white/20 text-white hover:bg-white/30"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 space-y-3 pb-24">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 bg-white border rounded-2xl animate-pulse"></div>
          ))
        ) : producteurs?.length === 0 ? (
          <div className="text-center text-muted-foreground py-12 flex flex-col items-center">
            <User className="w-12 h-12 mb-3 text-muted-foreground/50" />
            <p className="font-medium">Aucun producteur trouvé</p>
          </div>
        ) : (
          producteurs?.map(p => (
            <div key={p.id} className="bg-white p-4 rounded-2xl border shadow-sm flex items-start gap-4 active:scale-[0.98] transition-transform">
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
                  <Badge className={cn(
                    "text-[10px] px-1.5 py-0",
                    p.status === 'ACTIF' ? "bg-[#4CAF50]" : 
                    p.status === 'EN_ATTENTE' ? "bg-[#F57C00]" : "bg-gray-400"
                  )}>
                    {p.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-1 font-mono">{p.numero_membre}</p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5" />
                  <span className="truncate">{p.village}, {p.region}</span>
                </div>
                {p.cultures && (
                  <p className="text-xs text-[#2E7D32] font-medium mt-1 truncate">
                    {p.cultures}
                  </p>
                )}
                <div className="mt-3 pt-2 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setLocation(`/producteurs/${p.id}/modifier`)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-[#1B5E20] hover:text-[#2E7D32] transition-colors bg-[#E8F5E9] hover:bg-[#C8E6C9] px-3 py-1.5 rounded-full"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    Modifier le dossier
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <Link href="/identifier">
        <Button className="fixed bottom-20 right-4 w-14 h-14 rounded-full shadow-xl bg-[#F57C00] hover:bg-[#E65100] p-0 z-30 touch-manipulation">
          <Plus className="w-6 h-6 text-white" />
        </Button>
      </Link>
    </div>
  );
}
