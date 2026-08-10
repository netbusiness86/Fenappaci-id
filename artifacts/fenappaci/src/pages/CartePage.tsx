import { useRef, useState } from 'react';
import { useParams, useLocation } from 'wouter';
import { useGetProducteur } from '@workspace/api-client-react';
import { useSignedPhotoUrl } from '@/hooks/use-signed-photo-url';
import CarteProducteur, { CARTE_W, CARTE_H } from '@/components/CarteProducteur';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, Printer, CreditCard, Loader2, AlertTriangle } from 'lucide-react';

export default function CartePage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const cardRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);

  const { data: producteur, isLoading, isError } = useGetProducteur({ id: id! });
  const { signedUrl: photoUrl } = useSignedPhotoUrl(producteur?.photo_path);

  // URL sécurisée encodée dans le QR — pointe vers la fiche protégée, pas de données exposées
  const qrUrl = `${window.location.origin}${import.meta.env.BASE_URL}producteurs/${id}`.replace(/\/\//g, '/').replace('https:/', 'https://').replace('http:/', 'http://');

  // ── PDF ──────────────────────────────────────────────────────────────────
  const handleDownloadPDF = async () => {
    if (!cardRef.current || !producteur) return;
    setGenerating(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        logging: false,
      });

      // Dimensions carte bancaire en mm
      const CARD_W_MM = 85.6;
      const CARD_H_MM = 54;

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: [CARD_W_MM, CARD_H_MM],
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.97);
      pdf.addImage(imgData, 'JPEG', 0, 0, CARD_W_MM, CARD_H_MM);
      pdf.save(`carte-${producteur.numero_membre}.pdf`);
    } catch (e) {
      console.error('PDF error:', e);
    } finally {
      setGenerating(false);
    }
  };

  // ── Impression ───────────────────────────────────────────────────────────
  const handlePrint = () => {
    window.print();
  };

  // ── États ────────────────────────────────────────────────────────────────
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

  return (
    <>
      {/* ── CSS impression — masque tout sauf la carte ── */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #carte-print-root { display: flex !important; }
          @page {
            size: 85.6mm 54mm landscape;
            margin: 0;
          }
        }
      `}</style>

      {/* ── Interface principale (masquée à l'impression) ── */}
      <div className="min-h-screen bg-gray-50 print:hidden">
        {/* En-tête */}
        <div className="bg-[#1B5E20] text-white px-4 py-4 flex items-center gap-3 safe-top">
          <button onClick={() => setLocation(`/producteurs/${id}`)} className="p-2 rounded-full hover:bg-white/20 transition-colors">
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
          {/* ── Titre ── */}
          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold text-[#1B5E20]">Aperçu de la carte</h2>
            <p className="text-sm text-gray-500">{producteur.numero_membre}</p>
          </div>

          {/* ── Carte — aperçu centré, scalé pour écran mobile ── */}
          <div className="flex justify-center">
            <div
              style={{
                transform: `scale(${Math.min(1, (window.innerWidth - 48) / CARTE_W)})`,
                transformOrigin: 'top center',
                marginBottom: `${-(CARTE_H * (1 - Math.min(1, (window.innerWidth - 48) / CARTE_W)))}px`,
              }}
            >
              <CarteProducteur
                ref={cardRef}
                id={id!}
                numeroMembre={producteur.numero_membre}
                nom={producteur.nom}
                prenoms={producteur.prenoms}
                region={producteur.region}
                departement={producteur.departement}
                village={producteur.village}
                telephone={producteur.telephone}
                cooperative={cooperative}
                createdAt={producteur.created_at}
                photoUrl={photoUrl}
                qrUrl={qrUrl}
              />
            </div>
          </div>

          {/* ── Infos QR Code ── */}
          <div className="bg-white rounded-2xl border shadow-sm p-4 space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-[#2E7D32]" />
              <span className="text-sm font-bold text-gray-700">QR Code sécurisé</span>
            </div>
            <p className="text-xs text-gray-500">
              Le QR code redirige vers la fiche du producteur. L'authentification est requise pour consulter les données.
            </p>
            <div className="bg-gray-50 rounded-lg px-3 py-2 font-mono text-xs text-gray-400 break-all">
              {qrUrl}
            </div>
          </div>

          {/* ── Boutons action ── */}
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
          </div>

          {/* ── Note ── */}
          <p className="text-center text-xs text-gray-400 pb-4">
            La carte peut être rééditée à tout moment depuis la fiche du producteur.
          </p>
        </div>
      </div>

      {/* ── Zone impression uniquement ── */}
      <div
        id="carte-print-root"
        style={{
          display: 'none',
          width: '85.6mm',
          height: '54mm',
          overflow: 'hidden',
        }}
      >
        <div style={{ transform: `scale(${85.6 / (CARTE_W / 3.7795275591)})`, transformOrigin: 'top left' }}>
          <CarteProducteur
            id={id!}
            numeroMembre={producteur.numero_membre}
            nom={producteur.nom}
            prenoms={producteur.prenoms}
            region={producteur.region}
            departement={producteur.departement}
            village={producteur.village}
            telephone={producteur.telephone}
            cooperative={cooperative}
            createdAt={producteur.created_at}
            photoUrl={photoUrl}
            qrUrl={qrUrl}
          />
        </div>
      </div>
    </>
  );
}
