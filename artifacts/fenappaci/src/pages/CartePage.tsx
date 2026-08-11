import { useRef, useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useGetProducteur } from '@workspace/api-client-react';
import { useSignedPhotoUrl } from '@/hooks/use-signed-photo-url';
import CarteProducteur, { CARTE_W, CARTE_H } from '@/components/CarteProducteur';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, Printer, CreditCard, Loader2, AlertTriangle, Share2, Copy, Check } from 'lucide-react';

export default function CartePage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  // Ref sur la carte hors-écran (taille réelle) — c'est elle qu'html2canvas capture
  const captureRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Échelle de la carte visible (adaptée à la largeur mobile)
  const [scale, setScale] = useState(1);
  useEffect(() => {
    const update = () => setScale(Math.min(1, (window.innerWidth - 48) / CARTE_W));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const { data: producteur, isLoading, isError } = useGetProducteur(id!);
  const { signedUrl: photoUrl } = useSignedPhotoUrl(producteur?.photo_path);

  // URL dans le QR — pointe vers la fiche protégée (auth requise)
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  const qrUrl = `${window.location.origin}${base}/producteurs/${id}`;

  // ── Téléchargement PDF ───────────────────────────────────────────────────
  const handleDownloadPDF = async () => {
    if (!captureRef.current || !producteur) return;
    setGenerating(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      // Capturer la carte hors-écran (pleine taille, sans transform)
      const canvas = await html2canvas(captureRef.current, {
        scale: 2,            // ×2 pour qualité impression
        useCORS: true,
        allowTaint: true,
        logging: false,
        width: CARTE_W,
        height: CARTE_H,
        windowWidth: CARTE_W,
        windowHeight: CARTE_H,
      });

      const CARD_W_MM = 85.6;
      const CARD_H_MM = 54;

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [CARD_W_MM, CARD_H_MM],
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      pdf.addImage(imgData, 'JPEG', 0, 0, CARD_W_MM, CARD_H_MM);
      pdf.save(`carte-${producteur.numero_membre}.pdf`);
    } catch (e) {
      console.error('PDF error:', e);
    } finally {
      setGenerating(false);
    }
  };

  // ── Partage (Web Share API) ──────────────────────────────────────────────
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const handleShare = async () => {
    if (canShare) {
      try {
        await navigator.share({
          title: `Carte producteur — ${producteur?.nom} ${producteur?.prenoms}`,
          text: `Fiche FENAPPACI de ${producteur?.nom} ${producteur?.prenoms} (${producteur?.numero_membre})`,
          url: qrUrl,
        });
      } catch (e) {
        // L'utilisateur a annulé ou le partage a échoué — on n'affiche rien
        if ((e as DOMException).name !== 'AbortError') {
          console.error('Share error:', e);
        }
      }
    } else {
      // Fallback desktop : copier le lien
      try {
        await navigator.clipboard.writeText(qrUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (e) {
        console.error('Clipboard error:', e);
      }
    }
  };

  // ── Impression ───────────────────────────────────────────────────────────
  const handlePrint = () => window.print();

  // ── États de chargement ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[#2E7D32]" />
      </div>
    );
  }

  if (isError || !producteur) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-8">
        <AlertTriangle className="w-12 h-12 text-[#F57C00]" />
        <p className="text-gray-600 text-center">Producteur introuvable.</p>
        <Button variant="outline" onClick={() => setLocation('/mes-producteurs')}>Retour</Button>
      </div>
    );
  }

  const cooperative = producteur.cooperative_nom_libre || producteur.cooperative_nom || null;

  const carteProps = {
    id: id!,
    numeroMembre: producteur.numero_membre,
    nom: producteur.nom,
    prenoms: producteur.prenoms,
    region: producteur.region,
    departement: producteur.departement,
    village: producteur.village,
    telephone: producteur.telephone,
    cooperative,
    createdAt: producteur.created_at,
    photoUrl,
    qrUrl,
  };

  return (
    <>
      {/* ── CSS impression — masque tout sauf la carte ── */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #carte-print-root { display: flex !important; }
          @page { size: 85.6mm 54mm landscape; margin: 0; }
        }
      `}</style>

      {/* ── Carte hors-écran pour capture html2canvas (taille réelle, pas de transform) ── */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: '-9999px',
          width: CARTE_W,
          height: CARTE_H,
          overflow: 'hidden',
          pointerEvents: 'none',
          zIndex: -1,
        }}
      >
        <CarteProducteur ref={captureRef} {...carteProps} />
      </div>

      {/* ── Interface principale ── */}
      <div className="min-h-screen bg-gray-50 print:hidden">
        {/* En-tête */}
        <div className="bg-[#1B5E20] text-white px-4 py-4 flex items-center gap-3 safe-top">
          <button
            onClick={() => setLocation(`/producteurs/${id}`)}
            className="p-2 rounded-full hover:bg-white/20 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-bold text-lg leading-tight">Carte Producteur</h1>
            <p className="text-white/70 text-xs">{producteur.nom} {producteur.prenoms}</p>
          </div>
          <div className="ml-auto">
            <CreditCard className="w-7 h-7 text-white/40" />
          </div>
        </div>

        <div className="p-6 space-y-8 pb-32">
          {/* Titre */}
          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold text-[#1B5E20]">Aperçu de la carte</h2>
            <p className="text-sm text-gray-500">{producteur.numero_membre}</p>
          </div>

          {/* Aperçu visuel (carte scalée pour l'écran) */}
          <div className="flex justify-center overflow-hidden">
            <div
              style={{
                width: CARTE_W * scale,
                height: CARTE_H * scale,
                flexShrink: 0,
              }}
            >
              <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                <CarteProducteur {...carteProps} />
              </div>
            </div>
          </div>

          {/* Infos QR Code */}
          <div className="bg-white rounded-2xl border shadow-sm p-4 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-[#2E7D32]" />
              <span className="text-sm font-bold text-gray-700">QR Code sécurisé</span>
            </div>
            <p className="text-xs text-gray-500">
              Le QR code redirige vers la fiche du producteur. L'authentification est requise.
            </p>
            <div className="bg-gray-50 rounded-lg px-3 py-2 font-mono text-xs text-gray-400 break-all">
              {qrUrl}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <Button
              className="w-full h-14 bg-[#1B5E20] hover:bg-[#2E7D32] text-white font-bold rounded-xl text-base shadow-md flex items-center gap-2"
              onClick={handleDownloadPDF}
              disabled={generating}
            >
              {generating ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> Génération en cours…</>
              ) : (
                <><Download className="w-5 h-5" /> Télécharger PDF</>
              )}
            </Button>

            <Button
              variant="outline"
              className="w-full h-14 border-[#1B5E20] text-[#1B5E20] font-bold rounded-xl text-base flex items-center gap-2 hover:bg-[#E8F5E9]"
              onClick={handlePrint}
            >
              <Printer className="w-5 h-5" />
              Imprimer
            </Button>

            <Button
              variant="outline"
              className="w-full h-14 border-[#1565C0] text-[#1565C0] font-bold rounded-xl text-base flex items-center gap-2 hover:bg-[#E3F2FD]"
              onClick={handleShare}
            >
              {canShare ? (
                <>
                  <Share2 className="w-5 h-5" />
                  Partager (WhatsApp / SMS…)
                </>
              ) : copied ? (
                <>
                  <Check className="w-5 h-5 text-green-600" />
                  <span className="text-green-600">Lien copié !</span>
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5" />
                  Copier le lien
                </>
              )}
            </Button>
          </div>

          <p className="text-center text-xs text-gray-400 pb-4">
            La carte peut être rééditée à tout moment depuis la fiche du producteur.
          </p>
        </div>
      </div>

      {/* ── Zone impression uniquement ── */}
      <div
        id="carte-print-root"
        style={{ display: 'none', width: '85.6mm', height: '54mm', overflow: 'hidden' }}
      >
        <CarteProducteur {...carteProps} />
      </div>
    </>
  );
}
