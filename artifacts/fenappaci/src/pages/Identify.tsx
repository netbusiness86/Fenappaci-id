import { useState } from 'react';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { useCreateProducteur, Producteur } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, AlertTriangle, UserPlus, CheckCircle2, MapPin, Loader2 } from 'lucide-react';

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
  // GPS
  latitude: number | null;
  longitude: number | null;
  gps_precision: number | null;
  gps_captured_at: string | null;
};

const initialState: FormData = {
  nom: '',
  prenoms: '',
  sexe: '',
  date_naissance: '',
  lieu_naissance: '',
  nationalite: 'Ivoirienne',
  situation_matrimoniale: '',
  telephone: '',
  telephone_secondaire: '',
  adresse: '',
  type_piece: '',
  numero_piece: '',
  date_delivrance: '',
  date_expiration: '',
  district: '',
  region: '',
  departement: '',
  sous_prefecture: '',
  commune: '',
  village: '',
  membre_cooperative: false,
  cooperative_nom_libre: '',
  cooperative_numero_libre: '',
  cooperative_fonction: '',
  latitude: null,
  longitude: null,
  gps_precision: null,
  gps_captured_at: null,
};

const districtRegions: Record<string, string> = {
  'Abidjan': 'Abidjan',
  'Bas-Sassandra': 'San-Pédro',
  'Comoé': 'Indénié-Djuablin',
  'Denguélé': 'Kabadougou',
  'Gôh-Djiboua': 'Gôh',
  'Lacs': 'Bélier',
  'Lagunes': 'Agnéby-Tiassa',
  'Montagnes': 'Tonkpi',
  'Sassandra-Marahoué': 'Haut-Sassandra',
  'Savanes': 'Poro',
  'Vallée du Bandama': 'Gbêkê',
  'Woroba': 'Béré',
  'Yamoussoukro': 'Yamoussoukro',
  'Zanzan': 'Gontougo',
};

const districts = Object.keys(districtRegions).sort();

const variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 50 : -50,
    opacity: 0
  }),
  center: {
    x: 0,
    opacity: 1
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 50 : -50,
    opacity: 0
  })
};

const FieldLabel = ({ children, required }: { children: React.ReactNode; required?: boolean }) => (
  <label className="text-xs uppercase font-semibold text-gray-500 mb-1.5 block">
    {children} {required && <span className="text-red-500 text-sm ml-0.5">*</span>}
  </label>
);

export default function Identify() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createProducteur = useCreateProducteur();
  
  const [formData, setFormData] = useState<FormData>(initialState);
  const [step, setStep] = useState<Step>(1);
  const [direction, setDirection] = useState(1);
  const [createdProducteur, setCreatedProducteur] = useState<Producteur | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const captureGPS = () => {
    if (!navigator.geolocation) {
      setGpsError("La géolocalisation n'est pas supportée par cet appareil.");
      return;
    }
    setGpsLoading(true);
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const now = new Date().toISOString();
        setFormData(prev => ({
          ...prev,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          gps_precision: pos.coords.accuracy,
          gps_captured_at: now,
        }));
        setGpsLoading(false);
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsError("Accès à la localisation refusé. Veuillez autoriser l'accès dans les paramètres de votre appareil.");
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          setGpsError("Position GPS indisponible. Vérifiez que le GPS est activé et réessayez.");
        } else {
          setGpsError("Impossible d'obtenir la position. Vérifiez votre signal GPS et réessayez.");
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleNext = () => {
    setDirection(1);
    if (step === 1) {
      if (!formData.nom || !formData.prenoms || !formData.sexe || !formData.telephone) {
        toast({ title: 'Erreur', description: 'Veuillez remplir les champs obligatoires.', variant: 'destructive' });
        return;
      }
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      if (!formData.village) {
        toast({ title: 'Erreur', description: 'Le village est obligatoire.', variant: 'destructive' });
        return;
      }
      setStep(4);
    } else if (step === 4) {
      setStep('summary');
    }
  };

  const handlePrev = () => {
    setDirection(-1);
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
    else if (step === 4) setStep(3);
  };

  const handleCancel = () => {
    if (confirm('Voulez-vous vraiment annuler ? Les données saisies seront perdues.')) {
      setLocation('/tableau-de-bord');
    }
  };

  const handleSubmit = () => {
    createProducteur.mutate(
      { data: formData as any },
      {
        onSuccess: (res) => {
          setCreatedProducteur(res);
          setStep('success');
        },
        onError: () => {
          toast({
            title: 'Erreur',
            description: "Une erreur est survenue lors de l'enregistrement.",
            variant: 'destructive'
          });
        }
      }
    );
  };

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
        ]
      },
      {
        title: "Pièce d'identité",
        fields: [
          { label: 'Type de pièce', value: formData.type_piece },
          { label: 'Numéro de pièce', value: formData.numero_piece },
          { label: 'Date de délivrance', value: formData.date_delivrance },
          { label: "Date d'expiration", value: formData.date_expiration },
        ]
      },
      {
        title: "Localisation",
        fields: [
          { label: 'District', value: formData.district },
          { label: 'Région', value: formData.region },
          { label: 'Département', value: formData.departement },
          { label: 'Sous-préfecture', value: formData.sous_prefecture },
          { label: 'Commune', value: formData.commune },
          { label: 'Village', value: formData.village },
          {
            label: 'GPS',
            value: formData.latitude !== null && formData.longitude !== null
              ? `${formData.latitude.toFixed(6)}°, ${formData.longitude.toFixed(6)}° (±${Math.round(formData.gps_precision ?? 0)} m)`
              : null
          },
        ]
      },
      {
        title: "Coopérative",
        fields: formData.membre_cooperative ? [
          { label: 'Membre', value: 'OUI' },
          { label: 'Nom de la coopérative', value: formData.cooperative_nom_libre },
          { label: "Numéro d'identification", value: formData.cooperative_numero_libre },
          { label: 'Fonction', value: formData.cooperative_fonction },
        ] : [
          { label: 'Membre', value: 'NON' },
        ]
      }
    ];

    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-[#E8F5E9] p-2 rounded-full text-[#1B5E20]">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold text-gray-800">Récapitulatif</h2>
        </div>
        
        <p className="text-sm text-gray-500 mb-4">
          Veuillez vérifier les informations ci-dessous avant d'enregistrer.
        </p>

        {groups.map((g, idx) => {
          const filledFields = g.fields.filter(f => !!f.value);
          return (
            <div key={idx} className="border rounded-xl overflow-hidden">
              <div className="bg-[#1B5E20] text-white px-4 py-2 font-semibold text-sm">
                {g.title}
              </div>
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

  if (step === 'success') {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-6 text-center animate-in zoom-in-95 duration-300">
        <div className="w-24 h-24 bg-[#E8F5E9] text-[#2E7D32] rounded-full flex items-center justify-center mb-6 shadow-sm">
          <CheckCircle className="w-12 h-12" />
        </div>
        <h2 className="text-xl font-bold text-[#1B5E20] tracking-wide mb-1">PRODUCTEUR FENAPPACI</h2>
        <h3 className="text-2xl font-black text-[#1B5E20] mb-8 uppercase">Enregistré avec succès</h3>
        
        <p className="text-gray-500 font-semibold mb-2 uppercase text-sm tracking-widest">Numéro attribué</p>
        <div className="bg-[#F57C00] text-white px-8 py-5 rounded-xl text-3xl font-bold mb-8 w-full shadow-lg border-b-4 border-[#E65100]">
          {createdProducteur?.numero_membre || 'FEN-CI-2026-000001'}
        </div>
        
        <p className="text-lg font-medium text-gray-800 mb-12">
          Nom : <span className="font-bold">{formData.nom} {formData.prenoms}</span>
        </p>
        
        <div className="w-full space-y-4 max-w-sm mt-auto sm:mt-0">
          <Button 
            className="w-full h-14 text-lg bg-[#1B5E20] hover:bg-[#2E7D32] text-white rounded-xl shadow-md" 
            onClick={() => {
              setFormData(initialState);
              setStep(1);
              setCreatedProducteur(null);
              setDirection(1);
            }}
          >
            Nouveau producteur
          </Button>
          <Button 
            variant="outline"
            className="w-full h-14 text-lg border-2 border-[#1B5E20] text-[#1B5E20] rounded-xl hover:bg-[#E8F5E9]"
            onClick={() => setLocation('/mes-producteurs')}
          >
            Voir la liste
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100dvh-4rem)] flex flex-col">
      <div className="flex-1 p-4 pb-0">
        <Card className="bg-white rounded-2xl shadow-sm border-gray-100 overflow-hidden mb-6">
          <CardContent className="p-5">
            {typeof step === 'number' && (
              <div className="mb-6 flex items-center justify-between">
                <span className="text-sm font-bold text-[#2E7D32] tracking-wider uppercase">
                  Étape {step} / 4
                </span>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 4].map(i => (
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
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="space-y-4"
              >
                {step === 1 && (
                  <div className="space-y-5">
                    <div className="space-y-1.5">
                      <FieldLabel required>Nom</FieldLabel>
                      <Input 
                        className="h-12 bg-gray-50/50" 
                        value={formData.nom} 
                        onChange={e => setFormData({ ...formData, nom: e.target.value })} 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel required>Prénoms</FieldLabel>
                      <Input 
                        className="h-12 bg-gray-50/50" 
                        value={formData.prenoms} 
                        onChange={e => setFormData({ ...formData, prenoms: e.target.value })} 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel required>Sexe</FieldLabel>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, sexe: 'Masculin' })}
                          className={`h-12 rounded-xl text-sm font-semibold transition-all border flex items-center justify-center ${
                            formData.sexe === 'Masculin' 
                              ? 'bg-[#2E7D32] text-white border-[#2E7D32] shadow-sm' 
                              : 'bg-white text-gray-500 border-gray-200'
                          }`}
                        >
                          Masculin
                        </button>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, sexe: 'Féminin' })}
                          className={`h-12 rounded-xl text-sm font-semibold transition-all border flex items-center justify-center ${
                            formData.sexe === 'Féminin' 
                              ? 'bg-[#2E7D32] text-white border-[#2E7D32] shadow-sm' 
                              : 'bg-white text-gray-500 border-gray-200'
                          }`}
                        >
                          Féminin
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel>Date de naissance</FieldLabel>
                      <Input 
                        type="date"
                        className="h-12 block w-full bg-gray-50/50" 
                        value={formData.date_naissance} 
                        onChange={e => setFormData({ ...formData, date_naissance: e.target.value })} 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel>Lieu de naissance</FieldLabel>
                      <Input 
                        className="h-12 bg-gray-50/50" 
                        value={formData.lieu_naissance} 
                        onChange={e => setFormData({ ...formData, lieu_naissance: e.target.value })} 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel>Nationalité</FieldLabel>
                      <Input 
                        className="h-12 bg-gray-50/50" 
                        value={formData.nationalite} 
                        onChange={e => setFormData({ ...formData, nationalite: e.target.value })} 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel>Situation matrimoniale</FieldLabel>
                      <Select 
                        value={formData.situation_matrimoniale || undefined} 
                        onValueChange={v => setFormData({ ...formData, situation_matrimoniale: v })}
                      >
                        <SelectTrigger className="h-12 bg-gray-50/50">
                          <SelectValue placeholder="Sélectionner..." />
                        </SelectTrigger>
                        <SelectContent>
                          {['Célibataire', 'Marié(e)', 'Divorcé(e)', 'Veuf', 'Veuve'].map(opt => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel required>Téléphone principal</FieldLabel>
                      <Input 
                        type="tel"
                        className="h-12 bg-gray-50/50" 
                        value={formData.telephone} 
                        onChange={e => setFormData({ ...formData, telephone: e.target.value })} 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel>Téléphone secondaire</FieldLabel>
                      <Input 
                        type="tel"
                        className="h-12 bg-gray-50/50" 
                        value={formData.telephone_secondaire} 
                        onChange={e => setFormData({ ...formData, telephone_secondaire: e.target.value })} 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel>Adresse</FieldLabel>
                      <Textarea 
                        rows={2}
                        className="resize-none min-h-[80px] bg-gray-50/50" 
                        value={formData.adresse} 
                        onChange={e => setFormData({ ...formData, adresse: e.target.value })} 
                      />
                    </div>
                  </div>
                )}

                {step === 2 && (
                  <div className="space-y-5">
                    <div className="space-y-1.5">
                      <FieldLabel>Type de pièce</FieldLabel>
                      <Select 
                        value={formData.type_piece || undefined} 
                        onValueChange={v => setFormData({ ...formData, type_piece: v })}
                      >
                        <SelectTrigger className="h-12 bg-gray-50/50">
                          <SelectValue placeholder="Sélectionner..." />
                        </SelectTrigger>
                        <SelectContent>
                          {['CNI', 'Passeport', 'Permis de conduire', 'Titre de séjour', 'Carte consulaire', 'Autre'].map(opt => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel>Numéro de pièce</FieldLabel>
                      <Input 
                        className="h-12 bg-gray-50/50" 
                        value={formData.numero_piece} 
                        onChange={e => setFormData({ ...formData, numero_piece: e.target.value })} 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel>Date de délivrance</FieldLabel>
                      <Input 
                        type="date"
                        className="h-12 block w-full bg-gray-50/50" 
                        value={formData.date_delivrance} 
                        onChange={e => setFormData({ ...formData, date_delivrance: e.target.value })} 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel>Date d'expiration</FieldLabel>
                      <Input 
                        type="date"
                        className="h-12 block w-full bg-gray-50/50" 
                        value={formData.date_expiration} 
                        onChange={e => setFormData({ ...formData, date_expiration: e.target.value })} 
                      />
                    </div>
                  </div>
                )}

                {step === 3 && (
                  <div className="space-y-5">
                    <div className="space-y-1.5">
                      <FieldLabel>District</FieldLabel>
                      <Select 
                        value={formData.district || undefined} 
                        onValueChange={(v) => {
                          const newRegion = districtRegions[v] || '';
                          setFormData({ ...formData, district: v, region: newRegion });
                        }}
                      >
                        <SelectTrigger className="h-12 bg-gray-50/50">
                          <SelectValue placeholder="Sélectionner..." />
                        </SelectTrigger>
                        <SelectContent>
                          {districts.map(opt => (
                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel>Région</FieldLabel>
                      <Input 
                        className="h-12 bg-gray-50/50" 
                        value={formData.region} 
                        onChange={e => setFormData({ ...formData, region: e.target.value })} 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel>Département</FieldLabel>
                      <Input 
                        className="h-12 bg-gray-50/50" 
                        value={formData.departement} 
                        onChange={e => setFormData({ ...formData, departement: e.target.value })} 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel>Sous-préfecture</FieldLabel>
                      <Input 
                        className="h-12 bg-gray-50/50" 
                        value={formData.sous_prefecture} 
                        onChange={e => setFormData({ ...formData, sous_prefecture: e.target.value })} 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel>Commune</FieldLabel>
                      <Input 
                        className="h-12 bg-gray-50/50" 
                        value={formData.commune} 
                        onChange={e => setFormData({ ...formData, commune: e.target.value })} 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <FieldLabel required>Village / Localité</FieldLabel>
                      <Input 
                        className="h-12 bg-gray-50/50" 
                        value={formData.village} 
                        onChange={e => setFormData({ ...formData, village: e.target.value })} 
                      />
                    </div>

                    {/* GPS Capture */}
                    <div className="pt-2 space-y-3">
                      <div className="border-t border-dashed border-gray-200 pt-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                          Géolocalisation GPS
                        </p>
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
                            <>
                              <Loader2 className="w-5 h-5 animate-spin" />
                              Localisation en cours…
                            </>
                          ) : formData.latitude !== null ? (
                            <>
                              <CheckCircle2 className="w-5 h-5" />
                              Position GPS capturée ✓
                            </>
                          ) : (
                            <>
                              <MapPin className="w-5 h-5" />
                              📍 CAPTURER MA POSITION GPS
                            </>
                          )}
                        </button>

                        {/* GPS error */}
                        {gpsError && (
                          <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-sm text-red-700 font-medium">{gpsError}</p>
                              <button
                                type="button"
                                onClick={captureGPS}
                                className="text-xs text-red-600 underline mt-1"
                              >
                                Réessayer
                              </button>
                            </div>
                          </div>
                        )}

                        {/* GPS success display */}
                        {formData.latitude !== null && formData.longitude !== null && (
                          <div className="mt-3 p-4 rounded-xl bg-[#E8F5E9] border border-[#A5D6A7] space-y-2">
                            <div className="flex items-center gap-2 mb-2">
                              <MapPin className="w-4 h-4 text-[#2E7D32]" />
                              <span className="text-sm font-bold text-[#1B5E20]">Coordonnées enregistrées</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              <div>
                                <span className="text-gray-500 text-xs block">Latitude</span>
                                <span className="font-mono font-semibold text-[#1B5E20]">
                                  {formData.latitude.toFixed(6)}°
                                </span>
                              </div>
                              <div>
                                <span className="text-gray-500 text-xs block">Longitude</span>
                                <span className="font-mono font-semibold text-[#1B5E20]">
                                  {formData.longitude.toFixed(6)}°
                                </span>
                              </div>
                            </div>
                            {formData.gps_precision !== null && (
                              <p className="text-xs text-gray-600">
                                Précision : ±{Math.round(formData.gps_precision)} m
                              </p>
                            )}
                            {formData.gps_captured_at && (
                              <p className="text-xs text-gray-500">
                                Capturé le {new Date(formData.gps_captured_at).toLocaleString('fr-FR')}
                              </p>
                            )}
                            <button
                              type="button"
                              onClick={captureGPS}
                              className="text-xs text-[#2E7D32] underline"
                            >
                              Recapturer
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {step === 4 && (
                  <div className="space-y-6">
                    <div className="bg-gray-50 p-4 rounded-xl text-center border">
                      <h3 className="font-bold text-gray-800">
                        Le producteur appartient-il à une coopérative ?
                      </h3>
                    </div>

                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, membre_cooperative: true })}
                        className={`w-full p-5 rounded-xl border-2 text-left transition-all flex items-center justify-between ${
                          formData.membre_cooperative === true
                            ? 'bg-[#F57C00]/10 border-[#F57C00] text-[#E65100]'
                            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <span className="font-bold text-lg">OUI</span>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          formData.membre_cooperative ? 'border-[#F57C00] bg-[#F57C00]' : 'border-gray-300'
                        }`}>
                          {formData.membre_cooperative && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, membre_cooperative: false })}
                        className={`w-full p-5 rounded-xl border-2 text-left transition-all flex items-center justify-between ${
                          formData.membre_cooperative === false
                            ? 'bg-[#F57C00]/10 border-[#F57C00] text-[#E65100]'
                            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                        }`}
                      >
                        <span className="font-bold text-lg">NON</span>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                          formData.membre_cooperative === false ? 'border-[#F57C00] bg-[#F57C00]' : 'border-gray-300'
                        }`}>
                          {formData.membre_cooperative === false && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
                        </div>
                      </button>
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
                            <Input 
                              className="h-12 bg-gray-50/50" 
                              value={formData.cooperative_nom_libre} 
                              onChange={e => setFormData({ ...formData, cooperative_nom_libre: e.target.value })} 
                            />
                          </div>
                          <div className="space-y-1.5">
                            <FieldLabel>Numéro d'identification</FieldLabel>
                            <Input 
                              className="h-12 bg-gray-50/50" 
                              value={formData.cooperative_numero_libre} 
                              onChange={e => setFormData({ ...formData, cooperative_numero_libre: e.target.value })} 
                            />
                          </div>
                          <div className="space-y-1.5">
                            <FieldLabel>Fonction du producteur</FieldLabel>
                            <Input 
                              className="h-12 bg-gray-50/50" 
                              placeholder="Ex: Secrétaire, Trésorier, Membre..."
                              value={formData.cooperative_fonction} 
                              onChange={e => setFormData({ ...formData, cooperative_fonction: e.target.value })} 
                            />
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
      
      <div className="sticky bottom-0 bg-white border-t p-4 flex gap-3 z-10 shadow-[0_-4px_10px_rgba(0,0,0,0.05)] mt-4">
        <Button variant="ghost" className="flex-1 text-gray-500 font-semibold h-12" onClick={handleCancel}>
          Annuler
        </Button>
        {typeof step === 'number' && step > 1 && (
          <Button variant="outline" className="flex-1 border-[#2E7D32] text-[#2E7D32] font-semibold h-12" onClick={handlePrev}>
            Précédent
          </Button>
        )}
        {step === 'summary' ? (
          <>
            <Button variant="outline" className="flex-1 border-[#2E7D32] text-[#2E7D32] font-semibold h-12" onClick={() => { setDirection(-1); setStep(1); }}>
              Modifier
            </Button>
            <Button 
              className="flex-[2] bg-[#F57C00] hover:bg-[#E65100] text-white font-bold h-12" 
              onClick={handleSubmit} 
              disabled={createProducteur.isPending}
            >
              Enregistrer
            </Button>
          </>
        ) : (
          <Button 
            className="flex-[2] bg-[#F57C00] hover:bg-[#E65100] text-white font-bold h-12" 
            onClick={handleNext}
          >
            {step === 4 ? 'Récapitulatif' : 'Continuer'}
          </Button>
        )}
      </div>
    </div>
  );
}
