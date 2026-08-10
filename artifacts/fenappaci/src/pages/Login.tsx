import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

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
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 bg-[#1B5E20] text-white">
      <div className="w-full max-w-sm space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-xl p-1.5">
            <img src="/logo-fenappaci.png" alt="Logo FENAPPACI" className="w-full h-full object-contain rounded-full" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold tracking-tight">FENAPPACI</h1>
            <p className="text-[#4CAF50] font-medium mt-1">La recherche de la qualité, notre affaire.</p>
          </div>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 bg-white/10 p-6 rounded-2xl backdrop-blur-sm border border-white/20">
          <div className="space-y-4">
            <div>
              <Input
                type="email"
                placeholder="Adresse email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-white text-black border-none h-14"
                required
              />
            </div>
            <div>
              <Input
                type="password"
                placeholder="Mot de passe"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-white text-black border-none h-14"
                required
              />
            </div>
          </div>
          
          <Button 
            type="submit" 
            className="w-full h-14 text-lg font-bold shadow-lg"
            disabled={isLoading}
          >
            {isLoading ? "Connexion..." : "Se connecter"}
          </Button>
        </form>

        <div className="space-y-3 pt-6 border-t border-white/20">
          <p className="text-center text-sm font-medium text-white/80">Accès Démo</p>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="secondary" size="sm" onClick={() => fillDemo('admin')} type="button" className="text-xs h-10">Admin</Button>
            <Button variant="secondary" size="sm" onClick={() => fillDemo('direction')} type="button" className="text-xs h-10">Direction</Button>
            <Button variant="secondary" size="sm" onClick={() => fillDemo('agent')} type="button" className="text-xs h-10">Agent</Button>
          </div>
        </div>

        <p className="text-center text-xs text-white/40 pt-2">
          <a href="https://fenappaci.com" target="_blank" rel="noopener noreferrer" className="hover:text-white/70 transition-colors">
            fenappaci.com
          </a>
        </p>
      </div>
    </div>
  );
}
