import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LogOut, MapPin, ChevronRight, Info, Globe } from 'lucide-react';
import { getRoleBadgeColor } from '@/lib/utils';
import { useState } from 'react';

export default function Profile() {
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (window.confirm("Êtes-vous sûr de vouloir vous déconnecter ?")) {
      setIsLoggingOut(true);
      try {
        await logout();
      } catch (e) {
        setIsLoggingOut(false);
      }
    }
  };

  if (!user) return null;

  const getInitials = (nom: string, prenoms: string) => {
    return `${nom?.[0] || ''}${prenoms?.[0] || ''}`.toUpperCase();
  };

  return (
    <div className="p-4 space-y-6 pb-24">
      <h2 className="text-2xl font-display font-bold text-[#1B5E20] mb-2">Mon Profil</h2>

      <Card className="border-none shadow-md overflow-hidden bg-white">
        <div className="bg-[#1B5E20] h-24 relative flex items-center justify-center">
          <img src="/logo-fenappaci.png" alt="FENAPPACI" className="h-14 object-contain opacity-20" />
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-20 h-20 bg-white rounded-full p-1 shadow-lg">
            <div className="w-full h-full bg-[#E8F5E9] rounded-full flex items-center justify-center">
              <span className="text-2xl font-display font-bold text-[#1B5E20]">
                {getInitials(user.nom, user.prenoms)}
              </span>
            </div>
          </div>
        </div>
        <CardContent className="pt-14 pb-6 px-4 text-center">
          <h3 className="text-xl font-bold font-display">{user.nom} {user.prenoms}</h3>
          <p className="text-muted-foreground text-sm mb-3">{user.email}</p>
          <Badge className={`${getRoleBadgeColor(user.role)} border-none text-xs px-3 py-1`}>
            {user.role.replace(/_/g, ' ')}
          </Badge>
        </CardContent>
      </Card>

      <div className="space-y-3">
        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider pl-2">Informations Géographiques</h4>
        <Card className="border-none shadow-sm">
          <CardContent className="p-0 divide-y">
            {user.region && (
              <div className="flex items-center gap-3 p-4">
                <MapPin className="w-5 h-5 text-[#2E7D32]" />
                <div>
                  <p className="text-sm font-medium">Région</p>
                  <p className="text-xs text-muted-foreground">{user.region}</p>
                </div>
              </div>
            )}
            {user.departement && (
              <div className="flex items-center gap-3 p-4">
                <MapPin className="w-5 h-5 text-[#2E7D32]" />
                <div>
                  <p className="text-sm font-medium">Département</p>
                  <p className="text-xs text-muted-foreground">{user.departement}</p>
                </div>
              </div>
            )}
            {user.sous_prefecture && (
              <div className="flex items-center gap-3 p-4">
                <MapPin className="w-5 h-5 text-[#2E7D32]" />
                <div>
                  <p className="text-sm font-medium">Sous-préfecture</p>
                  <p className="text-xs text-muted-foreground">{user.sous_prefecture}</p>
                </div>
              </div>
            )}
            {!user.region && !user.departement && !user.sous_prefecture && (
              <div className="p-4 text-sm text-muted-foreground text-center">
                Aucune affectation géographique
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider pl-2">Application</h4>
        <Card className="border-none shadow-sm">
          <CardContent className="p-0 divide-y">
            <div className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Info className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm font-medium">Version</span>
              </div>
              <span className="text-sm text-muted-foreground">v1.0.0</span>
            </div>
            <a
              href="https://fenappaci.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors active:bg-muted touch-manipulation"
            >
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-[#2E7D32]" />
                <span className="text-sm font-medium">Site officiel</span>
              </div>
              <span className="text-sm text-[#2E7D32]">fenappaci.com</span>
            </a>
            <button 
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full flex items-center justify-between p-4 text-destructive hover:bg-destructive/5 transition-colors active:bg-destructive/10 touch-manipulation"
            >
              <div className="flex items-center gap-3">
                <LogOut className="w-5 h-5" />
                <span className="text-sm font-medium">{isLoggingOut ? "Déconnexion..." : "Se déconnecter"}</span>
              </div>
              <ChevronRight className="w-4 h-4 opacity-50" />
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
