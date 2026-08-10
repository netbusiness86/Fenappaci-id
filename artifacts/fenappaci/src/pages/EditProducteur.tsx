import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { useGetProducteur, useUpdateProducteur } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, AlertTriangle, CheckCircle2, MapPin, Loader2, ArrowLeft } from 'lucide-react';
import { PhotoCapture } from '@/components/PhotoCapture';

type Step = 1 | 2 | 3 | 4 | 'summary' | 'success';

type FormData = {
  nom: string;
  prenoms: string;
  sexe: string;
  date_naissance: string;
  lieu_naissance: string;
  nationalite: string;
  situation_matrimoniale: string;
  telephone: string;
  telephone_secondaire: string;
  adresse: string;
  type_piece: string;
  numero_piece: string;
  date_delivrance: string;
  date_expiration: string;
  district: string;
  region: string;
  departement: string;
  sous_prefecture: string;
  commune: string;
  village: string;
  membre_cooperative: boolean;
  cooperative_nom_libre: string;
  cooperative_numero_libre: string;
  cooperative_fonction: string;
  latitude: number | null;
  longitude: number | null;
  gps_precision: number | null;
  gps_captured_at: string | null;
  photo_path: string | null;
  piece_recto: string | null;
  piece_verso: string | null;
};

const emptyForm: FormData = {
  nom: '', prenoms: '', sexe: '', date_naissance: '', lieu_naissance: '',
  nationalite: 'Ivoirienne', situation_matrimoniale: '', telephone: '',
  telephone_secondaire: '', adresse: '', type_piece: '', numero_piece: '',
  date_delivrance: '', date_expiration: '', district: '', region: '',
  departement: '', sous_prefecture: '', commune: '', village: '',
  membre_cooperative: false, cooperative_nom_libre: '', cooperative_numero_libre: '',
  cooperative_fonction: '', latitude: null, longitude: null, gps_precision: null,
  gps_captured_at: null, photo_path: null, piece_recto: null, piece_verso: null,
};

const districtRegions: Record<string, string> = {
  'Abidjan': 'Abidjan', 'Bas-Sassandra': 'San-Pédro', 'Comoé': 'Indénié-Djuablin',
  'Denguélé': 'Kabadougou', 'Gôh-Djiboua': 'Gôh', 'Lacs': 'Bélier',
  'Lagunes': 'Agnéby-Tiassa', 'Montagnes': 'Tonkpi', 'Sassandra-Marahoué': 'Haut-Sassandra',
  'Savanes': 'Poro', 'Vallée du Bandama': 'Gbêkê', 'Woroba': 'Béré',
  'Yamoussoukro': 'Yamoussoukro', 'Zanzan': 'Gontougo',
};
const districts = Object.keys(districtRegions).sort();

const variants = {
  enter: (d: number) => ({ x: d > 0 ? 50 : -50, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: d < 0 ? 50 : -50, opacity: 0 }),
};

const FieldLabel = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
  <label className="text-xs uppercase font-semibold text-gray-500 mb-1.5 block">
    {children} {required && <span className="text-red-500 text-sm ml-0.5">*</span>}
  </label>
);

function str(v: unknown): string {
  if (v == null) return '';
  return String(v);
}

export default function EditProducteur() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const updateProducteur = useUpdateProducteur();

  const { data: producteur, isLoading, isError } = useGetProducteur(id!);

  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [initialized, setInitialized] = useState(false);
  const [step, setStep] = useState<Step>(1);
  const [direction, setDirection] = useState(1);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Pre-fill form when data loads
  useEffect(() => {
    if (producteur && !initialized) {
      setFormData({
        nom: str(producteur.nom),
        prenoms: str(producteur.prenoms),
        sexe: str(producteur.sexe),
        date_naissance: str(producteur.date_naissance),
        lieu_naissance: str(producteur.lieu_naissance),
        nationalite: str(producteur.nationalite) || 'Ivoirienne',
        situation_matrimoniale: str(producteur.situation_matrimoniale),
        telephone: str(producteur.telephone),
        telephone_secondaire: str(producteur.telephone_secondaire),
        adresse: str(producteur.adresse),
        type_piece: str(producteur.type_piece),
        numero_piece: str(producteur.numero_piece),
        date_delivrance: str(producteur.date_delivrance),
        date_expiration: str(producteur.date_expiration),
        district: str(producteur.district),
        region: str(producteur.region),
        departement: str(producteur.departement),
        sous_prefecture: str(producteur.sous_prefecture),
        commune: str(producteur.commune),
        village: str(producteur.village),
        membre_cooperative: producteur.membre_cooperative ?? false,
        cooperative_nom_libre: str(producteur.cooperative_nom_libre),
        cooperative_numero_libre: str(producteur.cooperative_numero_libre),
        cooperative_fonction: str(producteur.cooperative_fonction),
        latitude: producteur.latitude ?? null,
        longitude: producteur.longitude ?? null,
        gps_precision: producteur.gps_precision ?? null,
        gps_captured_at: str(producteur.gps_captured_at) || null,
        photo_path: str(producteur.photo_path) || null,
        piece_recto: str(producteur.piece_recto) || null,
        piece_verso: str(producteur.piece_verso) || null,
      });
      setInitialized(true);
    }
  }, [producteur, initialized]);

  const captureGPS = () => {
    if (!navigator.geolocation) {
      setGpsError("La géolocalisation n'est pas supportée par cet appareil.");
      return;
    }
    setGpsLoading(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData(prev => ({
          ...prev,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          gps_precision: pos.coords.accuracy,
          gps_captured_at: new Date().toISOString(),
        }));
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsError("Accès à la localisation refusé.");
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGpsError("Position GPS indisponible.");
        } else {
          setGpsError("Impossible d'obtenir la position.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const goTo = (s: Step, dir: number) => { setDirection(dir); setStep(s); };

  const handleNext = () => {
    if (step === 1) {
      if (!formData.nom || !formData.prenoms || !formData.sexe || !formData.telephone) {
        toast({ title: 'Erreur', description: 'Veuillez remplir les champs obligatoires.', variant: 'destructive' });
        return;
      }
      goTo(2, 1);
    } else if (step === 2) goTo(3, 1);
    else if (step === 3) {
      if (!formData.village) {
        toast({ title: 'Erreur', description: 'Le village est obligatoire.', variant: 'destructive' });
        return;
      }
      goTo(4, 1);
    } else if (step === 4) goTo('summary', 1);
  };

  const handlePrev = () => {
    if (step === 2) goTo(1, -1);
    else if (step === 3) goTo(2, -1);
    else if (step === 4) goTo(3, -1);
  };

  const handleSubmit = () => {
    updateProducteur.mutate(
      { id: id!, data: formData as any },
      {
        onSuccess: () => {
          setStep('success');
        },
        onError: () => {
          toast({
            title: 'Erreur',
            description: "Une erreur est survenue lors de la mise à jour.",
            variant: 'destructive',
          });
        },
      }
    );
  };

  // ─── Loading / Error states ───────────────────────────────────────────────
  if (isLoading || !initialized) {
    return (
      <div className="p-4 space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded-lg animate-pulse" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (isError || !producteur) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <AlertTriangle className="w-12 h-12 text-red-400" />
        <p className="text-gray-600 font-medium">Producteur introuvable</p>
        <Button variant="outline" onClick={() => setLocation('/mes-producteurs')}>
          Retour à la liste
        </Button>
      </div>
    );
  }

  // ─── Success ──────────────────────────────────────────────────────────────
  if (step === 'success') {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-6 text-center animate-in zoom-in-95 duration-300">
        <div className="w-28 h-28 bg-white rounded-full flex items-center justify-center mb-4 shadow-lg border-2 border-[#E8F5E9]">
          <img src="/logo-fenappaci.png" alt="FENAPPACI" className="w-24 h-24 object-contain" />
        </div>
        <div className="w-10 h-10 bg-[#E8F5E9] rounded-full flex items-center justify-center mb-4">
          <CheckCircle className="w-6 h-6 text-[#2E7D32]" />
        </div>
        <h2 className="text-xl font-bold text-[#1B5E20] tracking-wide mb-1">DOSSIER FENAPPACI</h2>
        <h3 className="text-2xl font-black text-[#1B5E20] mb-8 uppercase">Mis à jour avec succès</h3>

        <p className="text-gray-500 font-semibold mb-2 uppercase text-sm tracking-widest">Numéro membre</p>
        <div className="bg-[#F57C00] text-white px-8 py-5 rounded-xl text-3xl font-bold mb-8 w-full shadow-lg border-b-4 border-[#E65100]">
          {producteur.numero_membre}
        </div>
        <p className="text-lg font-medium text-gray-800 mb-12">
          {formData.nom} {formData.prenoms}
        </p>

        <div className="w-full space-y-4 max-w-sm mt-auto sm:mt-0">
          <Button
            className="w-full h-14 text-lg bg-[#1B5E20] hover:bg-[#2E7D32] text-white rounded-xl shadow-md"
            onClick={() => setLocation('/mes-producteurs')}
          >
            Retour à la liste
          </Button>
        </div>
      </div>
    );
  }

  // ─── Summary ──────────────────────────────────────────────────────────────
  const renderSummary = () => {
    const groups = [
      {
        title: 'Identité',
        fields: [
          { label: 'Nom', value: formData.nom },
          { label: 'Prénoms', value: formData.prenoms },
          { label: 'Sexe', value: formData.sexe },
          { label: 'Date de naissance', value: formData.date_naissance },
          { label: 'Lieu de naissance', value: formData.lieu_naissance },
          { label: 'Nationalité', value: formData.nationalite },
          { label: 'Situation matrimoniale', value: formData.situation_matrimoniale },
          { label: 'Téléphone principal', value: formData.telephone },
          { label: 'Téléphone secondaire', value: formData.telephone_secondaire },
          { label: 'Adresse', value: formData.adresse },
          { label: "Photo d'identité", value: formData.photo_path ? '✓ Photo enregistrée' : null },
        ],
      },
      {
        title: "Pièce d'identité",
        fields: [
          { label: 'Type de pièce', value: formData.type_piece },
          { label: 'Numéro de pièce', value: formData.numero_piece },
          { label: 'Date de délivrance', value: formData.date_delivrance },
          { label: "Date d'expiration", value: formData.date_expiration },
          { label: 'Recto', value: formData.piece_recto ? '✓ Photo enregistrée' : null },
          { label: 'Verso', value: formData.piece_verso ? '✓ Photo enregistrée' : null },
        ],
      },
      {
        title: 'Localisation',
        fields: [
          { label: 'District', value: formData.district },
          { label: 'Région', value: formData.region },
          { label: 'Département', value: formData.departement },
          { label: 'Sous-préfecture', value: formData.sous_prefecture },
          { label: 'Commune', value: formData.commune },
          { label: 'Village', value: formData.village },
          {
            label: 'GPS',
            value:
              formData.latitude !== null && formData.longitude !== null
                ? `${formData.latitude.toFixed(6)}°, ${formData.longitude.toFixed(6)}° (±${Math.round(formData.gps_precision ?? 0)} m)`
                : null,
          },
        ],
      },
      {
        title: 'Coopérative',
        fields: formData.membre_cooperative
          ? [
              { label: 'Membre', value: 'OUI' },
              { label: 'Nom de la coopérative', value: formData.cooperative_nom_libre },
              { label: "Numéro d'identification", value: formData.cooperative_numero_libre },
              { label: 'Fonction', value: formData.cooperative_fonction },
            ]
          : [{ label: 'Membre', value: 'NON' }],
      },
    ];

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-[#E8F5E9] p-2 rounded-full text-[#1B5E20]">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-gray-800">Récapitulatif</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">Vérifiez les modifications avant de sauvegarder.</p>
        {groups.map((g, idx) => {
          const filledFields = g.fields.filter((f) => !!f.value);
          return (
            <div key={idx} className="border rounded-xl overflow-hidden">
              <div className="bg-[#1B5E20] text-white px-4 py-2 font-semibold text-sm">{g.title}</div>
              <div className="p-4 bg-gray-50 space-y-3">
                {filledFields.length > 0 ? (
                  filledFields.map((f, i) => (
                    <div key={i} className="flex flex-col sm:flex-row sm:justify-between border-b border-gray-200 pb-2 last:border-0 last:pb-0">
                      <span className="text-xs font-semibold text-gray-500 uppercase">{f.label}</span>
                      <span className="text-sm font-medium text-gray-900">{f.value}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-gray-400 italic">Non renseigné</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // ─── Main form ────────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-[calc(100dvh-4rem)] flex flex-col">
      {/* Header */}
      <div className="bg-[#1B5E20] px-4 py-3 text-white flex items-center gap-3 sticky top-0 z-10 shadow-md">
        <button type="button" onClick={() => setLocation('/mes-producteurs')} className="p-1 rounded-full hover:bg-white/20 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-bold truncate">{producteur.nom} {producteur.prenoms}</p>
          <p className="text-xs text-white/70 font-mono">{producteur.numero_membre}</p>
        </div>
        <span className="text-xs bg-[#F57C00] text-white font-bold px-2 py-1 rounded-full">Modifier</span>
      </div>

      <div className="flex-1 p-4 pb-0">
        <Card className="bg-white rounded-2xl shadow-sm border-gray-100 overflow-hidden mb-6">
          <CardContent className="p-5">
            {typeof step === 'number' && (
              <div className="mb-6 flex items-center justify-between">
                <span className="text-sm font-bold text-[#2E7D32] tracking-wider uppercase">
                  Étape {step} / 4
                </span>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`w-2.5 h-2.5 rounded-full transition-colors ${i <= step ? 'bg-[#2E7D32]' : 'bg-gray-200'}`}
                    />
                  ))}
                </div>
              </div>
            )}

            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={step}
                custom={direction}
                variants={variants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="space-y-4"
              >
                {/* ── ÉTAPE 1 : IDENTITÉ ─────────────────────────────── */}
                {step === 1 && (
                  <div className="space-y-5">
                    <div className="space-y-1.5">
                      <FieldLabel required>Nom</FieldLabel>
                      <Input className="h-12 bg-gray-50/50" value={formData.nom} onChange={e => setFormData({ ...formData, nom: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel required>Prénoms</FieldLabel>
                      <Input className="h-12 bg-gray-50/50" value={formData.prenoms} onChange={e => setFormData({ ...formData, prenoms: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel required>Sexe</FieldLabel>
                      <div className="grid grid-cols-2 gap-3">
                        {['Masculin', 'Féminin'].map(opt => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setFormData({ ...formData, sexe: opt })}
                            className={`h-12 rounded-xl text-sm font-semibold transition-all border flex items-center justify-center ${
                              formData.sexe === opt
                                ? 'bg-[#2E7D32] text-white border-[#2E7D32] shadow-sm'
                                : 'bg-white text-gray-500 border-gray-200'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel>Date de naissance</FieldLabel>
                      <Input type="date" className="h-12 block w-full bg-gray-50/50" value={formData.date_naissance} onChange={e => setFormData({ ...formData, date_naissance: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel>Lieu de naissance</FieldLabel>
                      <Input className="h-12 bg-gray-50/50" value={formData.lieu_naissance} onChange={e => setFormData({ ...formData, lieu_naissance: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel>Nationalité</FieldLabel>
                      <Input className="h-12 bg-gray-50/50" value={formData.nationalite} onChange={e => setFormData({ ...formData, nationalite: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel>Situation matrimoniale</FieldLabel>
                      <Select value={formData.situation_matrimoniale || undefined} onValueChange={v => setFormData({ ...formData, situation_matrimoniale: v })}>
                        <SelectTrigger className="h-12 bg-gray-50/50"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                        <SelectContent>
                          {['Célibataire', 'Marié(e)', 'Divorcé(e)', 'Veuf', 'Veuve'].map(opt => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel required>Téléphone principal</FieldLabel>
                      <Input type="tel" className="h-12 bg-gray-50/50" value={formData.telephone} onChange={e => setFormData({ ...formData, telephone: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel>Téléphone secondaire</FieldLabel>
                      <Input type="tel" className="h-12 bg-gray-50/50" value={formData.telephone_secondaire} onChange={e => setFormData({ ...formData, telephone_secondaire: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel>Adresse</FieldLabel>
                      <Textarea rows={2} className="resize-none min-h-[80px] bg-gray-50/50" value={formData.adresse} onChange={e => setFormData({ ...formData, adresse: e.target.value })} />
                    </div>
                    <div className="pt-2">
                      <div className="border-t border-dashed border-gray-200 pt-4">
                        <PhotoCapture
                          label="📷 Photo d'identité"
                          objectPath={formData.photo_path}
                          cameraFacing="user"
                          onUploaded={path => setFormData(prev => ({ ...prev, photo_path: path }))}
                          onRemove={() => setFormData(prev => ({ ...prev, photo_path: null }))}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── ÉTAPE 2 : PIÈCE D'IDENTITÉ ────────────────────── */}
                {step === 2 && (
                  <div className="space-y-5">
                    <div className="space-y-1.5">
                      <FieldLabel>Type de pièce</FieldLabel>
                      <Select value={formData.type_piece || undefined} onValueChange={v => setFormData({ ...formData, type_piece: v })}>
                        <SelectTrigger className="h-12 bg-gray-50/50"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                        <SelectContent>
                          {['CNI', 'Passeport', 'Permis de conduire', 'Titre de séjour', 'Carte consulaire', 'Autre'].map(opt => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel>Numéro de pièce</FieldLabel>
                      <Input className="h-12 bg-gray-50/50" value={formData.numero_piece} onChange={e => setFormData({ ...formData, numero_piece: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel>Date de délivrance</FieldLabel>
                      <Input type="date" className="h-12 block w-full bg-gray-50/50" value={formData.date_delivrance} onChange={e => setFormData({ ...formData, date_delivrance: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel>Date d'expiration</FieldLabel>
                      <Input type="date" className="h-12 block w-full bg-gray-50/50" value={formData.date_expiration} onChange={e => setFormData({ ...formData, date_expiration: e.target.value })} />
                    </div>
                    <div className="pt-2">
                      <div className="border-t border-dashed border-gray-200 pt-4 space-y-5">
                        <p className="text-xs font-bold text-gray-600 uppercase tracking-wider">🪪 Scan de la pièce d'identité</p>
                        <PhotoCapture
                          label="Recto (face avant)"
                          objectPath={formData.piece_recto}
                          cameraFacing="environment"
                          onUploaded={path => setFormData(prev => ({ ...prev, piece_recto: path }))}
                          onRemove={() => setFormData(prev => ({ ...prev, piece_recto: null }))}
                        />
                        <PhotoCapture
                          label="Verso (face arrière)"
                          objectPath={formData.piece_verso}
                          cameraFacing="environment"
                          onUploaded={path => setFormData(prev => ({ ...prev, piece_verso: path }))}
                          onRemove={() => setFormData(prev => ({ ...prev, piece_verso: null }))}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── ÉTAPE 3 : LOCALISATION ────────────────────────── */}
                {step === 3 && (
                  <div className="space-y-5">
                    <div className="space-y-1.5">
                      <FieldLabel>District</FieldLabel>
                      <Select
                        value={formData.district || undefined}
                        onValueChange={v => setFormData({ ...formData, district: v, region: districtRegions[v] || formData.region })}
                      >
                        <SelectTrigger className="h-12 bg-gray-50/50"><SelectValue placeholder="Sélectionner..." /></SelectTrigger>
                        <SelectContent>
                          {districts.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel>Région</FieldLabel>
                      <Input className="h-12 bg-gray-50/50" value={formData.region} onChange={e => setFormData({ ...formData, region: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel>Département</FieldLabel>
                      <Input className="h-12 bg-gray-50/50" value={formData.departement} onChange={e => setFormData({ ...formData, departement: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel>Sous-préfecture</FieldLabel>
                      <Input className="h-12 bg-gray-50/50" value={formData.sous_prefecture} onChange={e => setFormData({ ...formData, sous_prefecture: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel>Commune</FieldLabel>
                      <Input className="h-12 bg-gray-50/50" value={formData.commune} onChange={e => setFormData({ ...formData, commune: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel required>Village / Localité</FieldLabel>
                      <Input className="h-12 bg-gray-50/50" value={formData.village} onChange={e => setFormData({ ...formData, village: e.target.value })} />
                    </div>

                    {/* GPS */}
                    <div className="pt-2 space-y-3">
                      <div className="border-t border-dashed border-gray-200 pt-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Géolocalisation GPS</p>
                        <button
                          type="button"
                          onClick={captureGPS}
                          disabled={gpsLoading}
                          className={`w-full h-14 rounded-xl border-2 font-bold text-base flex items-center justify-center gap-3 transition-all ${
                            formData.latitude !== null
                              ? 'bg-[#E8F5E9] border-[#2E7D32] text-[#1B5E20]'
                              : 'bg-white border-[#F57C00] text-[#E65100] hover:bg-[#FFF3E0]'
                          } ${gpsLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                        >
                          {gpsLoading ? (
                            <><Loader2 className="w-5 h-5 animate-spin" /> Localisation en cours…</>
                          ) : formData.latitude !== null ? (
                            <><CheckCircle2 className="w-5 h-5" /> Position GPS capturée ✓</>
                          ) : (
                            <><MapPin className="w-5 h-5" /> 📍 CAPTURER MA POSITION GPS</>
                          )}
                        </button>
                        {gpsError && (
                          <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-sm text-red-700 font-medium">{gpsError}</p>
                              <button type="button" onClick={captureGPS} className="text-xs text-red-600 underline mt-1">Réessayer</button>
                            </div>
                          </div>
                        )}
                        {formData.latitude !== null && formData.longitude !== null && (
                          <div className="mt-3 p-4 rounded-xl bg-[#E8F5E9] border border-[#A5D6A7] space-y-2">
                            <div className="flex items-center gap-2 mb-2">
                              <MapPin className="w-4 h-4 text-[#2E7D32]" />
                              <span className="text-sm font-bold text-[#1B5E20]">Coordonnées enregistrées</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-gray-500 text-xs block">Latitude</span>
                                <span className="font-mono font-semibold text-[#1B5E20]">{formData.latitude.toFixed(6)}°</span>
                              </div>
                              <div>
                                <span className="text-gray-500 text-xs block">Longitude</span>
                                <span className="font-mono font-semibold text-[#1B5E20]">{formData.longitude.toFixed(6)}°</span>
                              </div>
                            </div>
                            {formData.gps_precision !== null && (
                              <p className="text-xs text-gray-600">Précision : ±{Math.round(formData.gps_precision)} m</p>
                            )}
                            {formData.gps_captured_at && (
                              <p className="text-xs text-gray-500">
                                Capturé le {new Date(formData.gps_captured_at).toLocaleString('fr-FR')}
                              </p>
                            )}
                            <button type="button" onClick={captureGPS} className="text-xs text-[#2E7D32] underline">Recapturer</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── ÉTAPE 4 : COOPÉRATIVE ─────────────────────────── */}
                {step === 4 && (
                  <div className="space-y-6">
                    <div className="bg-gray-50 p-4 rounded-xl text-center border">
                      <h3 className="font-bold text-gray-800">Le producteur appartient-il à une coopérative ?</h3>
                    </div>
                    <div className="space-y-3">
                      {[true, false].map(val => (
                        <button
                          key={String(val)}
                          type="button"
                          onClick={() => setFormData({ ...formData, membre_cooperative: val })}
                          className={`w-full p-5 rounded-xl border-2 text-left transition-all flex items-center justify-between ${
                            formData.membre_cooperative === val
                              ? 'bg-[#F57C00]/10 border-[#F57C00] text-[#E65100]'
                              : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          <span className="font-bold text-lg">{val ? 'OUI' : 'NON'}</span>
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                            formData.membre_cooperative === val ? 'border-[#F57C00] bg-[#F57C00]' : 'border-gray-300'
                          }`}>
                            {formData.membre_cooperative === val && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
                          </div>
                        </button>
                      ))}
                    </div>
                    <AnimatePresence>
                      {formData.membre_cooperative && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden space-y-5 pt-2"
                        >
                          <div className="space-y-1.5 mt-2">
                            <FieldLabel>Nom de la coopérative</FieldLabel>
                            <Input className="h-12 bg-gray-50/50" value={formData.cooperative_nom_libre} onChange={e => setFormData({ ...formData, cooperative_nom_libre: e.target.value })} />
                          </div>
                          <div className="space-y-1.5">
                            <FieldLabel>Numéro d'identification</FieldLabel>
                            <Input className="h-12 bg-gray-50/50" value={formData.cooperative_numero_libre} onChange={e => setFormData({ ...formData, cooperative_numero_libre: e.target.value })} />
                          </div>
                          <div className="space-y-1.5">
                            <FieldLabel>Fonction du producteur</FieldLabel>
                            <Input className="h-12 bg-gray-50/50" placeholder="Ex: Secrétaire, Trésorier, Membre..." value={formData.cooperative_fonction} onChange={e => setFormData({ ...formData, cooperative_fonction: e.target.value })} />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {step === 'summary' && renderSummary()}
              </motion.div>
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>

      {/* Bottom bar */}
      <div className="sticky bottom-0 bg-white border-t p-4 flex gap-3 z-10 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] mt-4">
        <Button variant="ghost" className="flex-1 text-gray-500 font-semibold h-12" onClick={() => setLocation('/mes-producteurs')}>
          Annuler
        </Button>
        {typeof step === 'number' && step > 1 && (
          <Button variant="outline" className="flex-1 border-[#2E7D32] text-[#2E7D32] font-semibold h-12" onClick={handlePrev}>
            Précédent
          </Button>
        )}
        {step === 'summary' ? (
          <>
            <Button variant="outline" className="flex-1 border-[#2E7D32] text-[#2E7D32] font-semibold h-12" onClick={() => goTo(1, -1)}>
              Modifier
            </Button>
            <Button
              className="flex-[2] bg-[#F57C00] hover:bg-[#E65100] text-white font-bold h-12"
              onClick={handleSubmit}
              disabled={updateProducteur.isPending}
            >
              {updateProducteur.isPending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enregistrement…</> : 'Sauvegarder'}
            </Button>
          </>
        ) : (
          <Button className="flex-[2] bg-[#F57C00] hover:bg-[#E65100] text-white font-bold h-12" onClick={handleNext}>
            {step === 4 ? 'Récapitulatif' : 'Continuer'}
          </Button>
        )}
      </div>
    </div>
  );
}
