import { useState } from 'react';
import { useListProducteurs } from '@workspace/api-client-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Plus, User, MapPin, ChevronRight, ImageOff, FileDown } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/use-debounce';
import { useSignedPhotoUrls } from '@/hooks/use-signed-photo-url';
import { useAuth } from '@/contexts/AuthContext';
import ExportLotPDF from '@/components/ExportLotPDF';

/** Rôles autorisés à lancer l'export PDF en lot */
const EXPORT_ROLES = ['ADMIN', 'DIRECTION', 'COORDINATION_REGIONALE'] as const;

/** Resolves a producer's photo via a batch presigned URL map. */
function ProducerAvatar({
  photoPath,
  nom,
  signedUrl,
  isLoading,
  isError,
  onError,
}: {
  photoPath: string | null | undefined;
  nom: string;
  signedUrl: string | null;
  isLoading: boolean;
  isError: boolean;
  onError: () => void;
}) {
  if (!photoPath) {
    return <User className="w-6 h-6 text-muted-foreground" />;
  }

  if (isLoading) {
    return <div className="w-6 h-6 rounded-full bg-gray-200 animate-pulse" />;
  }

  if (isError || !signedUrl) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full gap-0.5" title="Photo introuvable">
        <ImageOff className="w-5 h-5 text-red-300" />
      </div>
    );
  }

  return (
    <img
      src={signedUrl}
      alt={nom}
      className="w-full h-full object-cover"
      onError={onError}
    />
  );
}

export default function MyProducers() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showExport, setShowExport] = useState(false);

  const { user } = useAuth();
  const canExport = !!user && EXPORT_ROLES.includes(user.role as typeof EXPORT_ROLES[number]);

  const { data: producteurs, isLoading } = useListProducteurs({
    search: debouncedSearch,
    status: statusFilter || undefined,
  });

  // Batch-resolve all photo URLs in one request instead of N individual calls.
  const photoPaths = producteurs?.map(p => p.photo_path) ?? [];
  const { getUrl } = useSignedPhotoUrls(photoPaths);

  const filters = [
    { label: 'Tous', value: '' },
    { label: 'Actifs', value: 'ACTIF' },
    { label: 'En attente', value: 'EN_ATTENTE' },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="bg-[#1B5E20] p-4 text-white space-y-4 shadow-md z-10 sticky top-0">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xl font-display font-bold">Mes Producteurs</h2>

          {/* Bouton Export lot — Direction / Admin / Coordination uniquement */}
          {canExport && producteurs && producteurs.length > 0 && (
            <button
              onClick={() => setShowExport(true)}
              title={`Exporter ${producteurs.length} carte${producteurs.length > 1 ? 's' : ''} en PDF`}
              className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 active:bg-white/40 transition-colors text-white text-xs font-semibold px-3 py-1.5 rounded-full flex-none"
            >
              <FileDown className="w-4 h-4" />
              <span>Export lot</span>
            </button>
          )}
        </div>

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
            <button
              key={p.id}
              type="button"
              onClick={() => setLocation(`/producteurs/${p.id}`)}
              className="w-full text-left bg-white p-4 rounded-2xl border shadow-sm flex items-start gap-4 active:scale-[0.98] transition-transform"
            >
              <div className="w-12 h-12 bg-muted rounded-full flex-none flex items-center justify-center overflow-hidden">
                <ProducerAvatar
                  photoPath={p.photo_path}
                  nom={p.nom}
                  {...getUrl(p.photo_path)}
                  onError={() => getUrl(p.photo_path).invalidate()}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-bold text-[15px] truncate pr-2">
                    {p.nom} {p.prenoms}
                  </h3>
                  <div className="flex items-center gap-1 flex-none">
                    <Badge className={cn(
                      "text-[10px] px-1.5 py-0",
                      p.status === 'ACTIF' ? "bg-[#4CAF50]" :
                      p.status === 'EN_ATTENTE' ? "bg-[#F57C00]" : "bg-gray-400"
                    )}>
                      {p.status}
                    </Badge>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
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
              </div>
            </button>
          ))
        )}
      </div>

      <Link href="/identifier">
        <Button className="fixed bottom-20 right-4 w-14 h-14 rounded-full shadow-xl bg-[#F57C00] hover:bg-[#E65100] p-0 z-30 touch-manipulation">
          <Plus className="w-6 h-6 text-white" />
        </Button>
      </Link>

      {/* Modal export PDF en lot */}
      {showExport && producteurs && producteurs.length > 0 && (
        <ExportLotPDF
          producers={producteurs}
          getPhotoUrl={(path) => getUrl(path)}
          onDone={() => setShowExport(false)}
        />
      )}
    </div>
  );
}
