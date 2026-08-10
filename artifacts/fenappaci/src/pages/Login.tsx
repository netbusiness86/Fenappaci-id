import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import farmersHero from '@/assets/farmers-hero.jpg';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await login({ email, password });
    } catch (err) {
      toast({
        title: "Erreur de connexion",
        description: "Email ou mot de passe incorrect.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fillDemo = (role: string) => {
    setEmail(`${role}@fenappaci.ci`);
    setPassword('demo2026');
  };

  return (
    <div className="min-h-[100dvh] relative flex flex-col items-center justify-center overflow-hidden">
      {/* Background photo */}
      <img
        src={farmersHero}
        alt="Paysans FENAPPACI"
        className="absolute inset-0 w-full h-full object-cover object-center"
      />
      {/* Gradient overlay — bottom-heavy for readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />

      {/* Content */}
      <div className="relative w-full max-w-sm px-6 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
        {/* Logo + title */}
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-2xl p-1.5 ring-4 ring-white/30">
            <img src="/logo-fenappaci.png" alt="Logo FENAPPACI" className="w-full h-full object-contain rounded-full" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight text-white drop-shadow-lg">FENAPPACI</h1>
            <p className="text-[#81C784] font-medium mt-1 drop-shadow">La recherche de la qualité, notre affaire.</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4 bg-white/10 p-6 rounded-2xl backdrop-blur-md border border-white/25 shadow-2xl">
          <div className="space-y-4">
            <Input
              type="email"
              placeholder="Adresse email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-white text-black border-none h-14 placeholder:text-gray-400"
              required
            />
            <Input
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="bg-white text-black border-none h-14 placeholder:text-gray-400"
              required
            />
          </div>
          <Button
            type="submit"
            className="w-full h-14 text-lg font-bold shadow-lg bg-[#F57C00] hover:bg-[#E65100] text-white"
            disabled={isLoading}
          >
            {isLoading ? "Connexion…" : "Se connecter"}
          </Button>
        </form>

        {/* Demo shortcuts */}
        <div className="space-y-3 pt-2 border-t border-white/20">
          <p className="text-center text-sm font-medium text-white/80">Accès Démo</p>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="secondary" size="sm" onClick={() => fillDemo('admin')} type="button" className="text-xs h-10 bg-white/20 hover:bg-white/30 text-white border-white/20">Admin</Button>
            <Button variant="secondary" size="sm" onClick={() => fillDemo('direction')} type="button" className="text-xs h-10 bg-white/20 hover:bg-white/30 text-white border-white/20">Direction</Button>
            <Button variant="secondary" size="sm" onClick={() => fillDemo('agent')} type="button" className="text-xs h-10 bg-white/20 hover:bg-white/30 text-white border-white/20">Agent</Button>
          </div>
        </div>

        <p className="text-center text-xs text-white/40 pb-4">
          <a href="https://fenappaci.com" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors">
            fenappaci.com
          </a>
        </p>
      </div>
    </div>
  );
}
