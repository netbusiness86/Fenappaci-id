import { type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, 
  Users, 
  UserPlus, 
  Tractor,
  Menu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Tableau de Bord", href: "/", icon: LayoutDashboard },
  { name: "Annuaire des Membres", href: "/membres", icon: Users },
  { name: "Nouvelle Inscription", href: "/membres/nouveau", icon: UserPlus },
];

function NavItems({ className }: { className?: string }) {
  const [location] = useLocation();

  return (
    <div className={cn("flex flex-col gap-2 p-4", className)}>
      {navigation.map((item) => {
        const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
        return (
          <Link key={item.name} href={item.href} className="w-full">
            <div
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors",
                "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                isActive 
                  ? "bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-sm hover:bg-sidebar-primary/90" 
                  : "text-sidebar-foreground/80 font-medium"
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </div>
          </Link>
        );
      })}
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-72 flex-col bg-sidebar border-r border-sidebar-border">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
          <div className="flex items-center gap-3 text-sidebar-foreground font-display font-bold text-xl tracking-tight">
            <div className="bg-sidebar-primary p-1.5 rounded-md">
              <Tractor className="h-5 w-5 text-sidebar-primary-foreground" />
            </div>
            FENAPPACI
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavItems />
        </div>
        <div className="p-4 border-t border-sidebar-border text-sidebar-foreground/60 text-xs">
          Système d'Identification<br/>
          v1.0.0
        </div>
      </aside>

      {/* Mobile Header & Sidebar */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden h-16 flex items-center justify-between px-4 border-b bg-card">
          <div className="flex items-center gap-3 font-display font-bold text-lg text-foreground">
            <Tractor className="h-5 w-5 text-primary" />
            FENAPPACI
          </div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="-mr-2">
                <Menu className="h-6 w-6" />
                <span className="sr-only">Toggle navigation</span>
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="bg-sidebar p-0 w-72 border-r-0">
              <div className="h-16 flex items-center px-6 border-b border-sidebar-border">
                <div className="flex items-center gap-3 text-sidebar-foreground font-display font-bold text-xl tracking-tight">
                  <div className="bg-sidebar-primary p-1.5 rounded-md">
                    <Tractor className="h-5 w-5 text-sidebar-primary-foreground" />
                  </div>
                  FENAPPACI
                </div>
              </div>
              <NavItems />
            </SheetContent>
          </Sheet>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
