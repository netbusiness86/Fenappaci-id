import { useGetDashboardStats, useListProducteurs } from '@workspace/api-client-react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserCheck, CalendarPlus, Building2, MapPin, Sprout, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Link } from 'wouter';
import { getRoleBadgeColor } from '@/lib/utils';

export default function Dashboard() {
  const { user } = useAuth();
  const { data: stats, isLoading } = useGetDashboardStats();
  const { data: recentProducteurs } = useListProducteurs();

  if (isLoading || !stats) {
    return (
      <div className="p-4 space-y-4 animate-pulse">
        <div className="h-16 bg-muted rounded-2xl"></div>
        <div className="grid grid-cols-2 gap-3">
          <div className="h-28 bg-muted rounded-2xl"></div>
          <div className="h-28 bg-muted rounded-2xl"></div>
          <div className="h-28 bg-muted rounded-2xl"></div>
          <div className="h-28 bg-muted rounded-2xl"></div>
        </div>
      </div>
    );
  }

  // Get only top 5 recent (assuming the list returns newest first, or we just slice it)
  const recent = recentProducteurs?.slice(0, 5) || [];

  return (
    <div className="p-4 space-y-6 pb-20 animate-in fade-in duration-500">
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

      <div className="grid grid-cols-2 gap-3">
        <StatCard 
          icon={<Users className="w-5 h-5 text-[#2E7D32]" />} 
          label="Total" 
          value={stats.total_producteurs} 
          bg="bg-[#E8F5E9]" 
        />
        <StatCard 
          icon={<UserCheck className="w-5 h-5 text-[#F57C00]" />} 
          label="Actifs" 
          value={stats.producteurs_actifs} 
          bg="bg-[#FFF3E0]" 
        />
        <StatCard 
          icon={<CalendarPlus className="w-5 h-5 text-blue-600" />} 
          label="Cette sem." 
          value={stats.producteurs_cette_semaine} 
          bg="bg-blue-50" 
        />
        <StatCard 
          icon={<Building2 className="w-5 h-5 text-purple-600" />} 
          label="Coopératives" 
          value={stats.cooperatives} 
          bg="bg-purple-50" 
        />
      </div>

      {stats.superficie_totale != null && (
        <Card className="bg-[#1B5E20] text-white border-none shadow-md">
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

      <div className="space-y-4">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <MapPin className="w-5 h-5 text-[#F57C00]" />
          Top 5 Régions
        </h3>
        <div className="space-y-2">
          {stats.par_region.slice(0, 5).map((r, i) => (
            <div key={i} className="flex items-center justify-between bg-white p-3 rounded-xl border shadow-sm">
              <span className="font-medium text-sm">{r.label}</span>
              <span className="font-bold text-[#2E7D32]">{r.count}</span>
            </div>
          ))}
          {stats.par_region.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">Aucune donnée</p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Sprout className="w-5 h-5 text-[#2E7D32]" />
          Principales Cultures
        </h3>
        <div className="space-y-2">
          {stats.par_culture.slice(0, 5).map((c, i) => (
            <div key={i} className="flex items-center justify-between bg-white p-3 rounded-xl border shadow-sm">
              <span className="font-medium text-sm">{c.label}</span>
              <span className="font-bold text-[#F57C00]">{c.count}</span>
            </div>
          ))}
          {stats.par_culture.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-2">Aucune donnée</p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">Récents</h3>
          <Link href="/mes-producteurs" className="text-sm text-[#F57C00] font-medium flex items-center">
            Voir tout <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
        <div className="space-y-3">
          {recent.map(p => (
            <Link key={p.id} href={`/mes-producteurs`}>
              <div className="bg-white p-3 rounded-xl border shadow-sm flex items-center justify-between active:scale-95 transition-transform touch-manipulation">
                <div>
                  <p className="font-bold text-sm">{p.nom} {p.prenoms}</p>
                  <p className="text-xs text-muted-foreground">{p.village} • {p.cultures}</p>
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

function StatCard({ icon, label, value, bg }: { icon: React.ReactNode, label: string, value: number, bg: string }) {
  return (
    <Card className="border-none shadow-sm overflow-hidden">
      <CardContent className={`p-4 ${bg} h-full flex flex-col justify-between`}>
        <div className="w-8 h-8 rounded-full bg-white/50 flex items-center justify-center mb-2">
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold font-display leading-none mb-1">{value}</p>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
