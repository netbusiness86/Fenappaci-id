import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Construction, UserPlus } from 'lucide-react';

export default function Identify() {
  return (
    <div className="p-4 space-y-6 pb-24">
      <div className="flex items-center gap-3 text-[#1B5E20]">
        <div className="p-2 bg-[#E8F5E9] rounded-full">
          <UserPlus className="w-6 h-6" />
        </div>
        <h2 className="text-2xl font-display font-bold">Identifier</h2>
      </div>

      <div className="bg-[#FFF3E0] text-[#E65100] p-4 rounded-xl flex gap-3 border border-[#F57C00]/30 shadow-sm">
        <Construction className="w-6 h-6 flex-none" />
        <div className="text-sm font-medium">
          <p className="font-bold mb-1">Formulaire en développement</p>
          <p>Cette fonctionnalité sera disponible prochainement. Vous pouvez prévisualiser la structure ci-dessous.</p>
        </div>
      </div>

      <Card className="border-none shadow-md overflow-hidden">
        <div className="bg-[#1B5E20] h-2"></div>
        <CardContent className="p-5 space-y-4">
          <div className="space-y-4 opacity-60 pointer-events-none">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Nom</label>
              <Input placeholder="Ex: KONE" disabled />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Prénoms</label>
              <Input placeholder="Ex: Seydou" disabled />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Numéro CIN</label>
              <Input placeholder="C000000000" disabled />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold">Région</label>
                <Input placeholder="Sélectionner..." disabled />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold">Village</label>
                <Input placeholder="Nom du village" disabled />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t mt-6">
            <Button className="w-full bg-[#1B5E20] text-white h-14 text-lg" disabled>
              Enregistrer
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
