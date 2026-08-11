import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import farmersHero from '@/assets/farmers-hero.jpg';
import {
  User, Mail, Lock, Phone, MapPin, CheckCircle2, ArrowLeft, Eye, EyeOff, ChevronRight,
} from 'lucide-react';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

type Step = 'identity' | 'geography' | 'success';

export default function RegisterPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('identity');
  const [isLoading, setIsLoading] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);

  // Form fields
  const [nom, setNom] = useState('');
  const [prenoms, setPrenoms] = useState('');
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [region, setRegion] = useState('');
  const [departement, setDepartement] = useState('');
  const [sousPrefecture, setSousPrefecture] = useState('');

  // ── Step 1 validation ──────────────────────────────────────────────────────
  const handleStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nom.trim() || !prenoms.trim()) {
      toast({ title: 'Champs requis', description: 'Veuillez renseigner votre nom et prénoms.', variant: 'destructive' });
      return;
    }
    if (!email.includes('@')) {
      toast({ title: 'Email invalide', description: 'Veuillez saisir une adresse email valide.', variant: 'destructive' });
      return;
    }
    if (password.length < 6) {
      toast({ title: 'Mot de passe trop court', description: 'Le mot de passe doit contenir au moins 6 caractères.', variant: 'destructive' });
      return;
    }
    if (password !== password2) {
      toast({ title: 'Mots de passe différents', description: 'La confirmation ne correspond pas au mot de passe.', variant: 'destructive' });
      return;
    }
    setStep('geography');
  };

  // ── Final submit ───────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!region.trim() || !departement.trim()) {
      toast({ title: 'Champs requis', description: 'Veuillez renseigner votre région et département.', variant: 'destructive' });
      return;
    }
    setIsLoading(true);
    try {
      const r = await fetch(`${BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nom, prenoms, email, password, telephone, region, departement, sous_prefecture: sousPrefecture }),
      });
      const data = await r.json();
      if (!r.ok) {
        toast({ title: 'Erreur', description: data.error ?? 'Une erreur est survenue.', variant: 'destructive' });
        return;
      }
      setStep('success');
    } catch {
      toast({ title: 'Erreur réseau', description: 'Impossible de contacter le serveur. Vérifiez votre connexion.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] relative flex flex-col items-center justify-center overflow-hidden">
      {/* Background */}
      <img src={farmersHero} alt="FENAPPACI" className="absolute inset-0 w-full h-full object-cover object-center" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/50 to-black/25" />

      <div className="relative w-full max-w-sm px-5 py-8 space-y-5 animate-in fade-in slide-in-from-bottom-6 duration-500 overflow-y-auto max-h-[100dvh]">

        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-3">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-xl p-1 ring-2 ring-white/30">
            <img src="/logo-fenappaci.png" alt="FENAPPACI" className="w-full h-full object-contain rounded-full" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight text-white drop-shadow-lg">Créer un compte</h1>
            <p className="text-[#81C784] text-sm mt-0.5">Agent FENAPPACI</p>
          </div>
        </div>

        {/* ── SUCCESS ────────────────────────────────────────────────────── */}
        {step === 'success' && (
          <div className="bg-white rounded-2xl p-6 text-center space-y-4 shadow-2xl">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-9 h-9 text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Demande envoyée !</h2>
              <p className="text-sm text-gray-600 mt-2 leading-relaxed">
                Votre compte est en attente de validation par l'administrateur FENAPPACI.
                Vous pourrez vous connecter dès qu'il sera approuvé.
              </p>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs text-amber-800 font-medium">📬 Conservez vos identifiants</p>
              <p className="text-xs text-amber-700 mt-1">Email : <strong>{email}</strong></p>
            </div>
            <Button
              onClick={() => setLocation('/login')}
              className="w-full h-12 bg-[#1B5E20] hover:bg-[#2E7D32] text-white font-semibold"
            >
              Retour à la connexion
            </Button>
          </div>
        )}

        {/* ── STEP 1 : Identité ──────────────────────────────────────────── */}
        {step === 'identity' && (
          <form onSubmit={handleStep1} className="space-y-4">
            {/* Progress */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-[#F57C00] rounded-full" />
              <div className="flex-1 h-1.5 bg-white/30 rounded-full" />
              <p className="text-white/60 text-xs">Étape 1 / 2</p>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/25 rounded-2xl p-5 space-y-3 shadow-2xl">
              <p className="text-white font-semibold text-sm mb-1">Informations personnelles</p>

              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Nom *"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  className="bg-white text-black border-none h-12 pl-9 placeholder:text-gray-400"
                  required
                />
              </div>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Prénoms *"
                  value={prenoms}
                  onChange={(e) => setPrenoms(e.target.value)}
                  className="bg-white text-black border-none h-12 pl-9 placeholder:text-gray-400"
                  required
                />
              </div>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  type="email"
                  placeholder="Adresse email *"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-white text-black border-none h-12 pl-9 placeholder:text-gray-400"
                  required
                />
              </div>
              <div className="relative">
                <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  type="tel"
                  placeholder="Téléphone"
                  value={telephone}
                  onChange={(e) => setTelephone(e.target.value)}
                  className="bg-white text-black border-none h-12 pl-9 placeholder:text-gray-400"
                />
              </div>

              <div className="border-t border-white/20 pt-3 space-y-3">
                <p className="text-white/80 text-xs font-medium">Mot de passe (minimum 6 caractères)</p>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input
                    type={showPwd ? 'text' : 'password'}
                    placeholder="Mot de passe *"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="bg-white text-black border-none h-12 pl-9 pr-10 placeholder:text-gray-400"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <Input
                    type={showPwd2 ? 'text' : 'password'}
                    placeholder="Confirmer le mot de passe *"
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    className={`bg-white text-black border-none h-12 pl-9 pr-10 placeholder:text-gray-400 ${
                      password2 && password !== password2 ? 'ring-2 ring-red-400' : ''
                    }`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd2(!showPwd2)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPwd2 ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {password2 && password !== password2 && (
                  <p className="text-red-300 text-xs">Les mots de passe ne correspondent pas</p>
                )}
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-13 text-base font-bold bg-[#F57C00] hover:bg-[#E65100] text-white shadow-lg flex items-center justify-center gap-2"
            >
              Suivant <ChevronRight size={18} />
            </Button>
          </form>
        )}

        {/* ── STEP 2 : Zone géographique ─────────────────────────────────── */}
        {step === 'geography' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Progress */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-[#F57C00] rounded-full" />
              <div className="flex-1 h-1.5 bg-[#F57C00] rounded-full" />
              <p className="text-white/60 text-xs">Étape 2 / 2</p>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/25 rounded-2xl p-5 space-y-3 shadow-2xl">
              <div className="flex items-center gap-2 mb-2">
                <MapPin size={16} className="text-[#81C784]" />
                <p className="text-white font-semibold text-sm">Zone d'intervention</p>
              </div>
              <p className="text-white/60 text-xs -mt-1">Indiquez la zone géographique où vous exercez vos activités en tant qu'agent.</p>

              <div className="relative mt-2">
                <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Région *  (ex: Haut-Sassandra)"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="bg-white text-black border-none h-12 pl-9 placeholder:text-gray-400"
                  required
                />
              </div>
              <div className="relative">
                <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Département *  (ex: Daloa)"
                  value={departement}
                  onChange={(e) => setDepartement(e.target.value)}
                  className="bg-white text-black border-none h-12 pl-9 placeholder:text-gray-400"
                  required
                />
              </div>
              <div className="relative">
                <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Sous-préfecture  (optionnel)"
                  value={sousPrefecture}
                  onChange={(e) => setSousPrefecture(e.target.value)}
                  className="bg-white text-black border-none h-12 pl-9 placeholder:text-gray-400"
                />
              </div>

              <div className="bg-white/10 rounded-xl p-3 mt-1">
                <p className="text-white/70 text-xs leading-relaxed">
                  ℹ️ Ces informations permettent à l'administration FENAPPACI de vérifier votre affectation géographique avant de valider votre compte.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setStep('identity')}
                className="h-13 px-4 bg-white/20 hover:bg-white/30 text-white border-white/20 flex items-center gap-1"
              >
                <ArrowLeft size={16} /> Retour
              </Button>
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1 h-13 text-base font-bold bg-[#F57C00] hover:bg-[#E65100] text-white shadow-lg"
              >
                {isLoading ? 'Envoi en cours…' : 'Envoyer la demande'}
              </Button>
            </div>
          </form>
        )}

        {/* ── Footer link ────────────────────────────────────────────────── */}
        {step !== 'success' && (
          <div className="text-center pb-4">
            <Link href="/login" className="text-white/60 text-sm hover:text-white transition-colors inline-flex items-center gap-1">
              <ArrowLeft size={13} /> Retour à la connexion
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
