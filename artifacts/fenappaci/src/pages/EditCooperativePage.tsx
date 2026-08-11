import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useGetCooperative, useUpdateCooperative } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Building2, Users, Loader2, AlertTriangle } from 'lucide-react';
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

export default function EditCooperativePage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: coop, isLoading, isError } = useGetCooperative(id!);
  const { mutateAsync: updateCoop, isPending } = useUpdateCooperative(id!);

  const [form, setForm] = useState({
    nom: '', sigle: '', numero_identification: '', date_creation: '',
    telephone: '', email: '', adresse: '',
    region: '', departement: '', sous_prefecture: '', village: '',
    president: '', vice_president: '', secretaire: '', tresorier: '',
  });

  useEffect(() => {
    if (coop) {
      setForm({
        nom: coop.nom ?? '',
        sigle: coop.sigle ?? '',
        numero_identification: coop.numero_identification ?? '',
        date_creation: coop.date_creation ?? '',
        telephone: coop.telephone ?? '',
        email: coop.email ?? '',
        adresse: coop.adresse ?? '',
        region: coop.region ?? '',
        departement: coop.departement ?? '',
        sous_prefecture: coop.sous_prefecture ?? '',
        village: coop.village ?? '',
        president: coop.president ?? '',
        vice_president: coop.vice_president ?? '',
        secretaire: coop.secretaire ?? '',
        tresorier: coop.tresorier ?? '',
      });
    }
  }, [coop]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.nom.trim()) { toast({ title: 'Nom requis', variant: 'destructive' }); return; }
    const body: Record<string, string | null> = {};
    for (const [k, v] of Object.entries(form)) {
      body[k] = v.trim() || null;
    }
    try {
      await updateCoop({ data: body as any });
      await queryClient.invalidateQueries({ queryKey: [`/api/cooperatives/${id}`] });
      await queryClient.invalidateQueries({ queryKey: ['/api/cooperatives'] });
      toast({ title: 'Modifications enregistrées !' });
      setLocation(`/cooperatives/${id}`);
    } catch {
      toast({ title: 'Erreur', variant: 'destructive' });
    }
  };

  const inputCls = "rounded-xl border-gray-200 bg-gray-50 focus:bg-white h-11";

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#2E7D32]" /></div>;
  if (isError || !coop) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8">
      <AlertTriangle className="w-12 h-12 text-[#F57C00]" />
      <p className="text-gray-600">Coopérative introuvable.</p>
      <Button variant="outline" onClick={() => setLocation('/cooperatives')}>Retour</Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f8f9f6] pb-32">
      <div className="bg-[#1B5E20] text-white px-4 py-4 flex items-center gap-3">
        <button onClick={() => setLocation(`/cooperatives/${id}`)} className="p-2 rounded-full hover:bg-white/20">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="font-bold text-lg">Modifier la coopérative</h1>
          <p className="text-white/60 text-xs">{coop.nom}</p>
        </div>
      </div>

      <div className="p-4 space-y-6">
        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#2E7D32]/20">
            <Building2 className="w-4 h-4 text-[#2E7D32]" />
            <h2 className="font-bold text-[#1B5E20]">Informations générales</h2>
          </div>
          <FormField label="Nom *"><Input value={form.nom} onChange={set('nom')} className={inputCls} /></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Sigle"><Input value={form.sigle} onChange={set('sigle')} className={inputCls} /></FormField>
            <FormField label="N° identification"><Input value={form.numero_identification} onChange={set('numero_identification')} className={inputCls} /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Date création"><Input type="date" value={form.date_creation} onChange={set('date_creation')} className={inputCls} /></FormField>
            <FormField label="Téléphone"><Input value={form.telephone} onChange={set('telephone')} className={inputCls} /></FormField>
          </div>
          <FormField label="Email"><Input type="email" value={form.email} onChange={set('email')} className={inputCls} /></FormField>
          <FormField label="Adresse"><Input value={form.adresse} onChange={set('adresse')} className={inputCls} /></FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Région">
              <select value={form.region} onChange={set('region')} className="w-full h-11 rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm focus:outline-none">
                <option value="">— Région —</option>
                {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </FormField>
            <FormField label="Département"><Input value={form.departement} onChange={set('departement')} className={inputCls} /></FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Sous-préfecture"><Input value={form.sous_prefecture} onChange={set('sous_prefecture')} className={inputCls} /></FormField>
            <FormField label="Village"><Input value={form.village} onChange={set('village')} className={inputCls} /></FormField>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-4 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#2E7D32]/20">
            <Users className="w-4 h-4 text-[#2E7D32]" />
            <h2 className="font-bold text-[#1B5E20]">Responsables</h2>
          </div>
          <FormField label="Président"><Input value={form.president} onChange={set('president')} className={inputCls} /></FormField>
          <FormField label="Vice-président"><Input value={form.vice_president} onChange={set('vice_president')} className={inputCls} /></FormField>
          <FormField label="Secrétaire"><Input value={form.secretaire} onChange={set('secretaire')} className={inputCls} /></FormField>
          <FormField label="Trésorier"><Input value={form.tresorier} onChange={set('tresorier')} className={inputCls} /></FormField>
        </div>

        <Button className="w-full h-14 bg-[#1B5E20] hover:bg-[#2E7D32] text-white font-bold rounded-xl text-base" onClick={handleSubmit} disabled={isPending}>
          {isPending ? <><Loader2 className="w-5 h-5 animate-spin mr-2" />Enregistrement…</> : 'Enregistrer les modifications'}
        </Button>
      </div>
    </div>
  );
}
