import { useState, useRef } from 'react';
import { useParams, useLocation } from 'wouter';
import {
  useGetCooperative, useGetCooperativeMembres, useGetCooperativeStats,
  useUpdateCooperative, useDeleteCooperative,
  useAddCooperativeMembre, useRemoveCooperativeMembre,
  useListProducteurs,
} from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Building2, Users, BarChart3, Pencil, Printer, Download,
  Loader2, AlertTriangle, MapPin, Phone, Mail, Calendar, UserCheck,
  Plus, X, Search, Tractor, Leaf, TrendingUp, Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

type Tab = 'infos' | 'membres' | 'stats';

export default function DetailCooperativePage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const printRef = useRef<HTMLDivElement>(null);

  const [tab, setTab] = useState<Tab>('infos');
  const [membreSearch, setMembreSearch] = useState('');
  const [showAddMembre, setShowAddMembre] = useState(false);
  const [prodSearch, setProdSearch] = useState('');

  const { data: coop, isLoading, isError } = useGetCooperative(id!);
  const { data: membres, refetch: refetchMembres } = useGetCooperativeMembres(id!);
  const { data: stats } = useGetCooperativeStats(id!);
  const { data: allProducteurs } = useListProducteurs();

  const { mutateAsync: addMembre, isPending: addingMembre } = useAddCooperativeMembre(id!);
  const { mutateAsync: removeMembre } = useRemoveCooperativeMembre(id!);
  const { mutateAsync: deleteCoop, isPending: deletingCoop } = useDeleteCooperative();

  const membresIds = new Set((membres ?? []).map((m) => m.id));

  const filteredMembres = (membres ?? []).filter((m) =>
    !membreSearch ||
    `${m.nom} ${m.prenoms} ${m.numero_membre}`.toLowerCase().includes(membreSearch.toLowerCase())
  );

  const candidats = (allProducteurs ?? []).filter(
    (p) => !membresIds.has(p.id) &&
      (!prodSearch || `${p.nom} ${p.prenoms}`.toLowerCase().includes(prodSearch.toLowerCase()))
  ).slice(0, 20);

  const handleAddMembre = async (producteurId: number) => {
    await addMembre(producteurId);
    await queryClient.invalidateQueries({ queryKey: [`/api/cooperatives/${id}/membres`] });
    await queryClient.invalidateQueries({ queryKey: [`/api/cooperatives/${id}`] });
    await refetchMembres();
    toast({ title: 'Membre ajouté !' });
  };

  const handleRemoveMembre = async (producteurId: number) => {
    await removeMembre(producteurId);
    await queryClient.invalidateQueries({ queryKey: [`/api/cooperatives/${id}/membres`] });
    await queryClient.invalidateQueries({ queryKey: [`/api/cooperatives/${id}`] });
    await refetchMembres();
    toast({ title: 'Membre retiré' });
  };

  const handleDelete = async () => {
    if (!confirm(`Supprimer la coopérative "${coop?.nom}" ?`)) return;
    await deleteCoop(id!);
    await queryClient.invalidateQueries({ queryKey: ['/api/cooperatives'] });
    toast({ title: 'Coopérative supprimée' });
    setLocation('/cooperatives');
  };

  const handlePrint = () => window.print();

  const handleExportPDF = async () => {
    if (!printRef.current) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');
      const canvas = await html2canvas(printRef.current, { scale: 2, useCORS: true, logging: false });
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const imgW = 210;
      const imgH = (canvas.height * imgW) / canvas.width;
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, imgW, Math.min(imgH, 297));
      pdf.save(`fiche-cooperative-${coop?.nom?.replace(/\s+/g, '-')}.pdf`);
    } catch { toast({ title: 'Erreur export PDF', variant: 'destructive' }); }
  };

  if (isLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[#2E7D32]" /></div>;
  if (isError || !coop) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8">
      <AlertTriangle className="w-12 h-12 text-[#F57C00]" />
      <p className="text-gray-600">Coopérative introuvable.</p>
      <Button variant="outline" onClick={() => setLocation('/cooperatives')}>Retour</Button>
    </div>
  );

  const dateCreation = coop.date_creation
    ? new Date(coop.date_creation).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
    : null;

  const nbH = (membres ?? []).filter((m) => m.sexe === 'M').length;
  const nbF = (membres ?? []).filter((m) => m.sexe === 'F').length;

  return (
    <>
      <style>{`@media print { body > * { display:none!important } #coop-print { display:block!important } @page { margin: 15mm } }`}</style>

      <div className="min-h-screen bg-[#f8f9f6] pb-28 print:hidden">
        {/* En-tête */}
        <div className="bg-[#1B5E20] text-white px-4 pt-4 pb-0">
          <div className="flex items-center gap-3 mb-3">
            <button onClick={() => setLocation('/cooperatives')} className="p-2 rounded-full hover:bg-white/20">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="font-bold text-lg truncate">{coop.nom}</h1>
              <p className="text-white/60 text-xs">{coop.sigle ?? ''} · {coop.nombre_membres} membre{coop.nombre_membres !== 1 ? 's' : ''}</p>
            </div>
            <button
              onClick={handleDelete}
              disabled={deletingCoop}
              className="p-2 rounded-full hover:bg-red-500/30 transition-colors disabled:opacity-50"
              title="Supprimer la coopérative"
            >
              {deletingCoop ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5 text-red-300" />}
            </button>
          </div>

          {/* Onglets */}
          <div className="flex">
            {(['infos', 'membres', 'stats'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'flex-1 py-2.5 text-xs font-semibold border-b-2 capitalize transition-colors',
                  tab === t ? 'border-[#F57C00] text-white' : 'border-transparent text-white/50'
                )}
              >
                {t === 'infos' ? 'Infos' : t === 'membres' ? 'Membres' : 'Statistiques'}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab INFOS ── */}
        {tab === 'infos' && (
          <div className="p-4 space-y-4">
            {/* Identité */}
            <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b">
                <Building2 className="w-4 h-4 text-[#2E7D32]" />
                <span className="font-bold text-[#1B5E20] text-sm">Informations générales</span>
              </div>
              {coop.numero_identification && <InfoRow label="N° identification" value={coop.numero_identification} />}
              {dateCreation && <InfoRow label="Créée le" value={dateCreation} icon={<Calendar className="w-3.5 h-3.5 text-gray-400" />} />}
              {coop.telephone && <InfoRow label="Téléphone" value={coop.telephone} icon={<Phone className="w-3.5 h-3.5 text-gray-400" />} />}
              {coop.email && <InfoRow label="Email" value={coop.email} icon={<Mail className="w-3.5 h-3.5 text-gray-400" />} />}
              {coop.adresse && <InfoRow label="Adresse" value={coop.adresse} />}
              {(coop.region || coop.departement) && (
                <InfoRow label="Localisation" value={[coop.region, coop.departement, coop.sous_prefecture, coop.village].filter(Boolean).join(', ')}
                  icon={<MapPin className="w-3.5 h-3.5 text-gray-400" />} />
              )}
            </div>

            {/* Responsables */}
            {(coop.president || coop.vice_president || coop.secretaire || coop.tresorier) && (
              <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <UserCheck className="w-4 h-4 text-[#2E7D32]" />
                  <span className="font-bold text-[#1B5E20] text-sm">Responsables</span>
                </div>
                {coop.president && <InfoRow label="Président" value={coop.president} />}
                {coop.vice_president && <InfoRow label="Vice-président" value={coop.vice_president} />}
                {coop.secretaire && <InfoRow label="Secrétaire" value={coop.secretaire} />}
                {coop.tresorier && <InfoRow label="Trésorier" value={coop.tresorier} />}
              </div>
            )}

            {/* Membres résumé */}
            <div className="bg-white rounded-2xl shadow-sm p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#2E7D32]" />
                  <span className="font-bold text-[#1B5E20] text-sm">Membres</span>
                </div>
                <button onClick={() => setTab('membres')} className="text-xs text-[#F57C00] font-semibold">Voir tous →</button>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <MiniStat label="Total" value={coop.nombre_membres} color="green" />
                <MiniStat label="Hommes" value={nbH} color="blue" />
                <MiniStat label="Femmes" value={nbF} color="orange" />
              </div>
            </div>
          </div>
        )}

        {/* ── Tab MEMBRES ── */}
        {tab === 'membres' && (
          <div className="p-4 space-y-4">
            {/* Compteurs genre */}
            <div className="grid grid-cols-3 gap-2">
              <MiniStat label="Total" value={coop.nombre_membres} color="green" />
              <MiniStat label="Hommes" value={nbH} color="blue" />
              <MiniStat label="Femmes" value={nbF} color="orange" />
            </div>

            {/* Barre recherche + bouton ajouter */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input value={membreSearch} onChange={(e) => setMembreSearch(e.target.value)}
                  placeholder="Rechercher un membre…" className="pl-9 rounded-xl" />
              </div>
              <Button size="sm" className="bg-[#1B5E20] text-white rounded-xl px-3"
                onClick={() => setShowAddMembre((v) => !v)}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {/* Panel ajouter un membre */}
            {showAddMembre && (
              <div className="bg-white rounded-2xl shadow-sm border p-4 space-y-3">
                <p className="font-semibold text-sm text-[#1B5E20]">Ajouter un producteur existant</p>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input value={prodSearch} onChange={(e) => setProdSearch(e.target.value)}
                    placeholder="Nom du producteur…" className="pl-9 rounded-xl" />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {candidats.length === 0 && (
                    <p className="text-xs text-gray-400 text-center py-4">
                      {prodSearch ? 'Aucun résultat' : 'Saisissez un nom pour rechercher'}
                    </p>
                  )}
                  {candidats.map((p) => (
                    <button key={p.id}
                      className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-[#E8F5E9] text-left"
                      onClick={() => handleAddMembre(p.id)}
                      disabled={addingMembre}
                    >
                      <div className="w-8 h-8 bg-[#E8F5E9] rounded-full flex items-center justify-center text-xs font-bold text-[#2E7D32]">
                        {p.nom[0]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{p.nom} {p.prenoms}</p>
                        <p className="text-xs text-gray-400">{p.numero_membre}</p>
                      </div>
                      <Plus className="w-4 h-4 text-[#2E7D32]" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Liste membres */}
            <div className="space-y-2">
              {filteredMembres.map((m) => (
                <div key={m.id} className="bg-white rounded-xl shadow-sm border p-3 flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#E8F5E9] rounded-full flex items-center justify-center font-bold text-[#2E7D32] text-sm flex-shrink-0">
                    {m.nom[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{m.nom} {m.prenoms}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">{m.numero_membre}</span>
                      {m.cooperative_fonction && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{m.cooperative_fonction}</Badge>
                      )}
                    </div>
                  </div>
                  <button onClick={() => handleRemoveMembre(m.id)}
                    className="p-1.5 rounded-full hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {filteredMembres.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-8">
                  {membreSearch ? 'Aucun membre trouvé' : 'Aucun membre enregistré'}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Tab STATISTIQUES ── */}
        {tab === 'stats' && (
          <div className="p-4 space-y-4">
            {!stats ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-[#2E7D32]" /></div>
            ) : (
              <>
                {/* KPIs */}
                <div className="grid grid-cols-2 gap-3">
                  <StatCard icon={<Users className="w-5 h-5 text-[#2E7D32]" />} label="Producteurs" value={stats.nombre_producteurs} bg="bg-[#E8F5E9]" />
                  <StatCard icon={<Tractor className="w-5 h-5 text-blue-600" />} label="Exploitations" value={stats.nombre_exploitations} bg="bg-blue-50" />
                  <StatCard icon={<Leaf className="w-5 h-5 text-[#F57C00]" />} label="Parcelles" value={stats.nombre_parcelles} bg="bg-[#FFF3E0]" />
                  <StatCard icon={<TrendingUp className="w-5 h-5 text-purple-600" />} label="Superficie (ha)" value={stats.superficie_totale.toFixed(1)} bg="bg-purple-50" />
                </div>

                {/* Production */}
                <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
                  <p className="font-bold text-sm text-[#1B5E20]">Production</p>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Production totale estimée</span>
                      <span className="font-bold text-gray-800">{stats.production_totale.toFixed(1)} T</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Disponible à la vente</span>
                      <span className="font-bold text-[#2E7D32]">{stats.production_disponible.toFixed(1)} T</span>
                    </div>
                  </div>
                </div>

                {/* Par culture */}
                {stats.par_culture.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
                    <p className="font-bold text-sm text-[#1B5E20]">Répartition par culture</p>
                    {stats.par_culture.map((c) => (
                      <div key={c.culture} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="font-semibold text-gray-700">{c.culture}</span>
                          <span className="text-gray-400">{c.count} producteur{c.count > 1 ? 's' : ''} · {c.superficie.toFixed(1)} ha</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#2E7D32] rounded-full"
                            style={{ width: `${Math.min(100, (c.production / Math.max(stats.production_totale, 1)) * 100)}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Barre d'actions fixe */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t px-4 py-3 flex gap-2 z-30 print:hidden">
        <Button variant="outline" size="sm" className="flex-1 rounded-xl border-gray-200 text-gray-600" onClick={handlePrint}>
          <Printer className="w-4 h-4 mr-1" /> Imprimer
        </Button>
        <Button variant="outline" size="sm" className="flex-1 rounded-xl border-gray-200 text-gray-600" onClick={handleExportPDF}>
          <Download className="w-4 h-4 mr-1" /> PDF
        </Button>
        <Button size="sm" className="flex-1 bg-[#F57C00] hover:bg-[#E65100] text-white rounded-xl"
          onClick={() => setLocation(`/cooperatives/${id}/modifier`)}>
          <Pencil className="w-4 h-4 mr-1" /> Modifier
        </Button>
      </div>

      {/* Fiche imprimable — hors-écran pour html2canvas (display:none bloque la capture) */}
      <div
        id="coop-print"
        ref={printRef}
        style={{
          position: 'absolute', left: '-9999px', top: 0,
          width: 794, padding: 40, fontFamily: 'Arial, sans-serif',
          background: '#fff', color: '#1a1a1a',
        }}
      >
        {/* En-tête vert */}
        <div style={{ background: '#1B5E20', color: '#fff', padding: '20px 24px', borderRadius: 8, marginBottom: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 'bold' }}>{coop.nom}</div>
          {coop.sigle && <div style={{ fontSize: 13, opacity: 0.75, marginTop: 2 }}>{coop.sigle}</div>}
          {coop.numero_identification && (
            <div style={{ fontSize: 12, opacity: 0.65, marginTop: 4 }}>N° {coop.numero_identification}</div>
          )}
        </div>

        {/* Infos générales */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          {[
            ['Région', coop.region],
            ['Département', coop.departement],
            ['Sous-préfecture', coop.sous_prefecture],
            ['Village', coop.village],
            ['Date de création', coop.date_creation ? new Date(coop.date_creation).toLocaleDateString('fr-FR') : null],
            ['Téléphone', coop.telephone],
            ['Email', coop.email],
            ['Adresse', coop.adresse],
          ].filter(([, v]) => v).map(([label, value]) => (
            <div key={label as string} style={{ background: '#f5f5f5', borderRadius: 6, padding: '8px 12px' }}>
              <div style={{ fontSize: 10, color: '#666', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: 2 }}>{label}</div>
              <div style={{ fontSize: 13 }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Responsables */}
        {(coop.president || coop.vice_president || coop.secretaire || coop.tresorier) && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 'bold', color: '#1B5E20', borderBottom: '2px solid #1B5E20', paddingBottom: 4, marginBottom: 10 }}>
              Responsables
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                ['Président', coop.president],
                ['Vice-président', coop.vice_president],
                ['Secrétaire', coop.secretaire],
                ['Trésorier', coop.tresorier],
              ].filter(([, v]) => v).map(([role, nom]) => (
                <div key={role as string}>
                  <span style={{ fontSize: 11, color: '#666' }}>{role} : </span>
                  <span style={{ fontSize: 13, fontWeight: 'bold' }}>{nom}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Statistiques membres */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            ['Membres', coop.nombre_membres],
            ['Hommes', (membres ?? []).filter(m => m.sexe === 'M').length],
            ['Femmes', (membres ?? []).filter(m => m.sexe === 'F').length],
          ].map(([label, val]) => (
            <div key={label as string} style={{ background: '#E8F5E9', borderRadius: 8, padding: 12, textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 'bold', color: '#1B5E20' }}>{val}</div>
              <div style={{ fontSize: 11, color: '#555' }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 32, fontSize: 10, color: '#aaa', textAlign: 'right' }}>
          Document généré le {new Date().toLocaleDateString('fr-FR')} — FENAPPACI
        </div>
      </div>
    </>
  );
}

function InfoRow({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      {icon && <span className="mt-0.5 flex-shrink-0">{icon}</span>}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase font-semibold text-gray-400 tracking-wide">{label}</p>
        <p className="text-sm text-gray-800">{value}</p>
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color: 'green' | 'blue' | 'orange' }) {
  const cls = {
    green: 'bg-[#E8F5E9] text-[#2E7D32]',
    blue: 'bg-blue-50 text-blue-700',
    orange: 'bg-[#FFF3E0] text-[#F57C00]',
  }[color];
  return (
    <div className={`${cls} rounded-xl p-3 text-center`}>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-[10px] font-semibold uppercase tracking-wide opacity-70">{label}</p>
    </div>
  );
}

function StatCard({ icon, label, value, bg }: { icon: React.ReactNode; label: string; value: number | string; bg: string }) {
  return (
    <div className={`${bg} rounded-2xl p-4 flex items-center gap-3`}>
      <div className="bg-white rounded-xl p-2 shadow-sm">{icon}</div>
      <div>
        <p className="text-xl font-bold text-gray-800">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}
