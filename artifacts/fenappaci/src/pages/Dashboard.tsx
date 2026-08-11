import { useQuery } from '@tanstack/react-query';
import { useGetDashboardStats, useListProducteurs } from '@workspace/api-client-react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import {
  Users, UserCheck, CalendarPlus, Building2, MapPin, Sprout,
  ChevronRight, TrendingUp, ShoppingBasket, Tractor, Leaf,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Link } from 'wouter';
import { getRoleBadgeColor } from '@/lib/utils';

async function fetchStats() {
  const res = await fetch('/api/stats/dashboard', { credentials: 'include' });
  if (!res.ok) throw new Error('Erreur stats');
  return res.json();
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: stats, isLoading } = useQuery({ queryKey: ['stats-dashboard'], queryFn: fetchStats });
  const { data: recentProducteurs } = useListProducteurs();

  if (isLoading || !stats) {
    return (
      <div className="p-4 space-y-4 animate-pulse">
        <div className="h-16 bg-muted rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 bg-muted rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const recent = recentProducteurs?.slice(0, 5) || [];

  return (
    <div className="p-4 space-y-6 pb-24 animate-in fade-in duration-500">
      {/* Greeting */}
      <div className="flex flex-col space-y-1">
        <h2 className="text-2xl font-display font-bold text-[#1B5E20]">
          Bonjour, {user?.prenoms}
        </h2>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Badge className={`${getRoleBadgeColor(user?.role || '')} border-none`}>
            {user?.role.replace(/_/g, ' ')}
          </Badge>
          {user?.region && <span>• {user.region}</span>}
        </div>
      </div>

      {/* Producteurs KPIs */}
      <div>
        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2">Producteurs</p>
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={<Users className="w-5 h-5 text-[#2E7D32]" />} label="Total" value={stats.total_producteurs} bg="bg-[#E8F5E9]" />
          <StatCard icon={<UserCheck className="w-5 h-5 text-[#F57C00]" />} label="Actifs" value={stats.producteurs_actifs} bg="bg-[#FFF3E0]" />
          <StatCard icon={<CalendarPlus className="w-5 h-5 text-blue-600" />} label="Cette sem." value={stats.producteurs_cette_semaine} bg="bg-blue-50" />
          <StatCard icon={<Building2 className="w-5 h-5 text-purple-600" />} label="Coopératives" value={stats.cooperatives} bg="bg-purple-50" />
        </div>
      </div>

      {/* Exploitations & Parcelles KPIs */}
      <div>
        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2">Exploitations & Parcelles</p>
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={<Tractor className="w-5 h-5 text-[#1B5E20]" />} label="Exploitations" value={stats.nb_exploitations ?? 0} bg="bg-[#E8F5E9]" />
          <StatCard icon={<Leaf className="w-5 h-5 text-[#2E7D32]" />} label="Parcelles" value={stats.nb_parcelles ?? 0} bg="bg-[#E8F5E9]" />
        </div>
      </div>

      {/* Production KPIs */}
      <div>
        <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-2">Production</p>
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={<TrendingUp className="w-5 h-5 text-[#F57C00]" />} label="Prod. campagne" value={stats.production_totale ?? 0} suffix=" t" bg="bg-[#FFF3E0]" />
          <StatCard icon={<ShoppingBasket className="w-5 h-5 text-[#E65100]" />} label="Dispo. à vendre" value={stats.quantite_vente_totale ?? 0} suffix="" bg="bg-[#FFF3E0]" />
        </div>
      </div>

      {/* Coopératives CTA */}
      <Link href="/cooperatives">
        <div className="bg-[#33691E] rounded-2xl p-4 flex items-center justify-between shadow-md active:scale-[0.98] transition-transform touch-manipulation">
          <div>
            <p className="text-white font-black text-base">Coopératives</p>
            <p className="text-white/70 text-xs mt-0.5">{stats.cooperatives} coopérative{stats.cooperatives !== 1 ? 's' : ''} enregistrée{stats.cooperatives !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" />
            </div>
            <ChevronRight className="w-5 h-5 text-white/60" />
          </div>
        </div>
      </Link>

      {/* Disponibilités CTA */}
      <Link href="/disponibilites">
        <div className="bg-[#1B5E20] rounded-2xl p-4 flex items-center justify-between shadow-md active:scale-[0.98] transition-transform touch-manipulation">
          <div>
            <p className="text-white font-black text-base">Disponibilités Agricoles</p>
            <p className="text-white/70 text-xs mt-0.5">Productions disponibles à la vente</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <ShoppingBasket className="w-5 h-5 text-white" />
            </div>
            <ChevronRight className="w-5 h-5 text-white/60" />
          </div>
        </div>
      </Link>

      {stats.superficie_totale != null && stats.superficie_totale > 0 && (
        <Card className="bg-[#2E7D32] text-white border-none shadow-md">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm font-medium">Superficie Totale</p>
              <p className="text-2xl font-bold font-display">{stats.superficie_totale} ha</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <Sprout className="w-6 h-6 text-white" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Régions */}
      {stats.par_region?.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <MapPin className="w-4 h-4 text-[#F57C00]" /> Top Régions
          </h3>
          <div className="space-y-2">
            {stats.par_region.slice(0, 5).map((r: { label: string; count: number }, i: number) => (
              <div key={i} className="flex items-center justify-between bg-white p-3 rounded-xl border shadow-sm">
                <span className="font-medium text-sm">{r.label}</span>
                <span className="font-bold text-[#2E7D32]">{r.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Principales Cultures */}
      {stats.par_culture?.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <Sprout className="w-4 h-4 text-[#2E7D32]" /> Principales Cultures
          </h3>
          <div className="space-y-2">
            {stats.par_culture.slice(0, 5).map((c: { label: string; count: number }, i: number) => (
              <div key={i} className="flex items-center justify-between bg-white p-3 rounded-xl border shadow-sm">
                <span className="font-medium text-sm">{c.label}</span>
                <span className="font-bold text-[#F57C00]">{c.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Récents */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-base">Récents</h3>
          <Link href="/mes-producteurs" className="text-sm text-[#F57C00] font-medium flex items-center">
            Voir tout <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="space-y-3">
          {recent.map(p => (
            <Link key={p.id} href={`/producteurs/${p.id}`}>
              <div className="bg-white p-3 rounded-xl border shadow-sm flex items-center justify-between active:scale-95 transition-transform touch-manipulation">
                <div>
                  <p className="font-bold text-sm">{p.nom} {p.prenoms}</p>
                  <p className="text-xs text-muted-foreground">{p.village} {p.cultures ? `• ${p.cultures}` : ''}</p>
                </div>
                <Badge className={p.status === 'ACTIF' ? 'bg-[#4CAF50]' : 'bg-gray-400'}>
                  {p.status}
                </Badge>
              </div>
            </Link>
          ))}
          {recent.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">Aucun producteur</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon, label, value, bg, suffix = '',
}: {
  icon: React.ReactNode; label: string; value: number; bg: string; suffix?: string;
}) {
  return (
    <Card className="border-none shadow-sm overflow-hidden">
      <CardContent className={`p-4 ${bg} h-full flex flex-col justify-between`}>
        <div className="w-8 h-8 rounded-full bg-white/50 flex items-center justify-center mb-2">
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold font-display leading-none mb-1">
            {typeof value === 'number' && !Number.isInteger(value) ? value.toLocaleString('fr-FR', { maximumFractionDigits: 1 }) : value.toLocaleString('fr-FR')}{suffix}
          </p>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
