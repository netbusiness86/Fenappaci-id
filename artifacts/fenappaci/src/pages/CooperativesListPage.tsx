import { useState } from 'react';
import { useLocation } from 'wouter';
import { useListCooperatives } from '@workspace/api-client-react';
import { Search, Plus, Users, MapPin, Building2, ChevronRight, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function CooperativesListPage() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState('');
  const { data: cooperatives, isLoading } = useListCooperatives();

  const filtered = (cooperatives ?? []).filter((c) =>
    !search || c.nom.toLowerCase().includes(search.toLowerCase()) ||
    (c.region ?? '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#f8f9f6] pb-24">
      {/* En-tête */}
      <div className="bg-[#1B5E20] text-white px-4 pt-4 pb-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold">Coopératives</h1>
            <p className="text-white/60 text-xs">{(cooperatives ?? []).length} enregistrée{(cooperatives ?? []).length > 1 ? 's' : ''}</p>
          </div>
          <Button
            size="sm"
            className="bg-[#F57C00] hover:bg-[#E65100] text-white rounded-full h-10 w-10 p-0 shadow-lg"
            onClick={() => setLocation('/cooperatives/nouvelle')}
          >
            <Plus className="w-5 h-5" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une coopérative…"
            className="pl-9 bg-white/10 border-white/20 text-white placeholder:text-white/40 rounded-xl"
          />
        </div>
      </div>

      <div className="p-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-[#2E7D32]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
            <div className="w-16 h-16 bg-[#E8F5E9] rounded-full flex items-center justify-center">
              <Building2 className="w-8 h-8 text-[#2E7D32]" />
            </div>
            <p className="font-semibold text-gray-700">
              {search ? 'Aucun résultat' : 'Aucune coopérative'}
            </p>
            <p className="text-sm text-gray-400">
              {search ? 'Essayez un autre terme.' : 'Créez la première coopérative.'}
            </p>
            {!search && (
              <Button
                className="bg-[#1B5E20] text-white rounded-xl"
                onClick={() => setLocation('/cooperatives/nouvelle')}
              >
                <Plus className="w-4 h-4 mr-2" /> Nouvelle coopérative
              </Button>
            )}
          </div>
        ) : (
          filtered.map((coop) => (
            <button
              key={coop.id}
              className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 p-4 text-left flex items-center gap-3 hover:shadow-md transition-shadow active:scale-[0.99]"
              onClick={() => setLocation(`/cooperatives/${coop.id}`)}
            >
              <div className="w-12 h-12 bg-[#E8F5E9] rounded-xl flex items-center justify-center flex-shrink-0">
                <Building2 className="w-6 h-6 text-[#2E7D32]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 truncate">{coop.nom}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {coop.region && (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <MapPin className="w-3 h-3" />{coop.region}
                    </span>
                  )}
                  <Badge variant="outline" className="text-[10px] px-2 py-0 border-[#2E7D32]/30 text-[#2E7D32]">
                    <Users className="w-3 h-3 mr-1" />
                    {coop.nombre_membres ?? 0} membre{(coop.nombre_membres ?? 0) > 1 ? 's' : ''}
                  </Badge>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
            </button>
          ))
        )}
      </div>
    </div>
  );
}
