import { useState } from 'react';
import { useLocation } from 'wouter';
import { useCreateCooperative } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Building2, Users, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

const REGIONS = [
  'Abidjan','Agnéby-Tiassa','Bafing','Bagoué','Bélier','Béré','Bounkani',
  'Cavally','Folon','Gbêkê','Gbôklé','Gôh','Gontougo','Grand-Ponts',
  'Guémon','Hambol','Haut-Sassandra','Iffou','Indénié-Djuablin',
  'Kabadougou','La Mé','Loh-Djiboua','Marahoué','Moronou','Nawa',
  'N\'Zi','Poro','San-Pédro','Tchologo','Tonkpi','Worodougou',
  'Bafing','Yamoussoukro','Lacs'
].sort();

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-semibold text-gray-700">{label}</Label>
      {children}
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 pb-2 border-b border-[#2E7D32]/20">
      <div className="w-8 h-8 bg-[#E8F5E9] rounded-lg flex items-center justify-center">
        <Icon className="w-4 h-4 text-[#2E7D32]" />
      </div>
      <h2 className="font-bold text-[#1B5E20]">{title}</h2>
    </div>
  );
}

export default function CreateCooperativePage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { mutateAsync: createCooperative, isPending } = useCreateCooperative();

  const [form, setForm] = useState({
    nom: '', sigle: '', numero_identification: '', date_creation: '',
    telephone: '', email: '', adresse: '',
    region: '', departement: '', sous_prefecture: '', village: '',
    president: '', vice_president: '', secretaire: '', tresorier: '',
  });

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.nom.trim()) { toast({ title: 'Nom requis', variant: 'destructive' }); return; }

    // Strip empty strings
    const body: Record<string, string> = {};
    for (const [k, v] of Object.entries(form)) {
      if (v.trim()) body[k] = v.trim();
    }

    try {
      const created = await createCooperative({ data: body as any });
      await queryClient.invalidateQueries({ queryKey: ['/api/cooperatives'] });
      toast({ title: 'Coopérative créée !' });
      setLocation(`/cooperatives/${created.id}`);
    } catch {
      toast({ title: 'Erreur lors de la création', variant: 'destructive' });
    }
  };

  const inputCls = "rounded-xl border-gray-200 bg-gray-50 focus:bg-white h-11";

  return (
    <div className="min-h-screen bg-[#f8f9f6] pb-32">
      {/* En-tête */}
      <div className="bg-[#1B5E20] text-white px-4 py-4 flex items-center gap-3">
        <button onClick={() => setLocation('/cooperatives')} className="p-2 rounded-full hover:bg-white/20">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="font-bold text-lg">Nouvelle coopérative</h1>
          <p className="text-white/60 text-xs">Remplissez les informations</p>
        </div>
      </div>

      <div className="p-4 space-y-6">
        {/* Informations générales */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
          <SectionTitle icon={Building2} title="Informations générales" />

          <FormField label="Nom de la coopérative *">
            <Input value={form.nom} onChange={set('nom')} placeholder="Ex: COOPAVENIR" className={inputCls} />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Sigle">
              <Input value={form.sigle} onChange={set('sigle')} placeholder="Ex: CAVN" className={inputCls} />
            </FormField>
            <FormField label="Numéro d'identification">
              <Input value={form.numero_identification} onChange={set('numero_identification')} placeholder="N° officiel" className={inputCls} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Date de création">
              <Input type="date" value={form.date_creation} onChange={set('date_creation')} className={inputCls} />
            </FormField>
            <FormField label="Téléphone">
              <Input value={form.telephone} onChange={set('telephone')} placeholder="07 XX XX XX XX" className={inputCls} />
            </FormField>
          </div>
          <FormField label="Email">
            <Input type="email" value={form.email} onChange={set('email')} placeholder="contact@coopérative.ci" className={inputCls} />
          </FormField>
          <FormField label="Adresse">
            <Input value={form.adresse} onChange={set('adresse')} placeholder="Adresse physique" className={inputCls} />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Région">
              <select
                value={form.region}
                onChange={set('region')}
                className="w-full h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
              >
                <option value="">— Région —</option>
                {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </FormField>
            <FormField label="Département">
              <Input value={form.departement} onChange={set('departement')} placeholder="Département" className={inputCls} />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Sous-préfecture">
              <Input value={form.sous_prefecture} onChange={set('sous_prefecture')} placeholder="Sous-préfecture" className={inputCls} />
            </FormField>
            <FormField label="Village / Localité">
              <Input value={form.village} onChange={set('village')} placeholder="Village" className={inputCls} />
            </FormField>
          </div>
        </div>

        {/* Responsables */}
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
          <SectionTitle icon={Users} title="Responsables" />

          <FormField label="Président">
            <Input value={form.president} onChange={set('president')} placeholder="Nom du président" className={inputCls} />
          </FormField>
          <FormField label="Vice-président">
            <Input value={form.vice_president} onChange={set('vice_president')} placeholder="Nom du vice-président" className={inputCls} />
          </FormField>
          <FormField label="Secrétaire">
            <Input value={form.secretaire} onChange={set('secretaire')} placeholder="Nom du secrétaire" className={inputCls} />
          </FormField>
          <FormField label="Trésorier">
            <Input value={form.tresorier} onChange={set('tresorier')} placeholder="Nom du trésorier" className={inputCls} />
          </FormField>
        </div>

        {/* Actions */}
        <Button
          className="w-full h-14 bg-[#1B5E20] hover:bg-[#2E7D32] text-white font-bold rounded-xl text-base shadow-md"
          onClick={handleSubmit}
          disabled={isPending}
        >
          {isPending ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Enregistrement…</> : 'Créer la coopérative'}
        </Button>
      </div>
    </div>
  );
}
