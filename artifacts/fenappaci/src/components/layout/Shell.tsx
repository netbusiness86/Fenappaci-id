import { Link, useLocation } from 'wouter';
import { LayoutDashboard, Users, UserPlus, Search, UserCircle, ShoppingBasket } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

export function Shell({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [location] = useLocation();

  // If not authenticated, just render children (like Login page)
  if (!isAuthenticated) {
    return <div className="min-h-[100dvh] bg-background">{children}</div>;
  }

  const tabs = [
    { name: 'Tableau', href: '/tableau-de-bord', icon: LayoutDashboard },
    { name: 'Producteurs', href: '/mes-producteurs', icon: Users },
    { name: 'Identifier', href: '/identifier', icon: UserPlus },
    { name: 'Marchés', href: '/disponibilites', icon: ShoppingBasket },
    { name: 'Rechercher', href: '/rechercher', icon: Search },
    { name: 'Profil', href: '/profil', icon: UserCircle },
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background max-w-md mx-auto relative shadow-2xl overflow-hidden">
      {/* Top Header */}
      <header className="flex-none h-16 bg-[#1B5E20] text-white flex items-center justify-between px-4 z-10 shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-sm overflow-hidden">
            <img src="/logo-fenappaci.png" alt="FENAPPACI" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="font-display font-bold text-lg leading-tight tracking-wide">FENAPPACI</h1>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-[calc(4rem+env(safe-area-inset-bottom))] bg-[#f8f9f6]">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="flex-none fixed bottom-0 left-0 right-0 bg-white border-t border-border z-20 pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-md mx-auto flex justify-around items-center h-16">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = location === tab.href;
            return (
              <Link key={tab.href} href={tab.href} className="flex-1 flex flex-col items-center justify-center gap-1 h-full touch-manipulation">
                <div className={cn(
                  "flex flex-col items-center justify-center w-full h-full",
                  isActive ? "text-[#E65100]" : "text-[#1B5E20]/60"
                )}>
                  <div className={cn(
                    "p-1 rounded-full mb-0.5 transition-colors",
                    isActive ? "bg-[#FFF3E0]" : "bg-transparent"
                  )}>
                    <Icon className={cn("w-6 h-6", isActive ? "stroke-[2.5px]" : "stroke-2")} />
                  </div>
                  <span className="text-[10px] font-medium leading-none">{tab.name}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
