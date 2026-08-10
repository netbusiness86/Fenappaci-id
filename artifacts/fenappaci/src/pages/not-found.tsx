import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6 text-center space-y-6">
      <div className="w-20 h-20 bg-[#FFF3E0] rounded-full flex items-center justify-center">
        <AlertTriangle className="w-10 h-10 text-[#E65100]" />
      </div>
      <div>
        <h1 className="text-2xl font-display font-bold text-[#1B5E20] mb-2">Page introuvable</h1>
        <p className="text-muted-foreground text-sm max-w-xs mx-auto">
          La page que vous recherchez n'existe pas ou a été déplacée.
        </p>
      </div>
      <Link href="/">
        <Button className="w-full max-w-[200px] h-12">
          Retour à l'accueil
        </Button>
      </Link>
    </div>
  );
}
