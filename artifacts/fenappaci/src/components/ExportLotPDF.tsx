/**
 * ExportLotPDF — génère un PDF multi-pages contenant une carte par producteur.
 * Chaque page est au format carte bancaire (85,6 mm × 54 mm, paysage).
 * Affiche une barre de progression pendant la génération.
 */
import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X, FileDown, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CarteProducteur, { CARTE_W, CARTE_H } from '@/components/CarteProducteur';

export interface ProducerExportData {
  id: string | number;
  numero_membre: string;
  nom: string;
  prenoms: string;
  region?: string | null;
  departement?: string | null;
  village?: string | null;
  telephone?: string | null;
  cooperative_nom?: string | null;
  cooperative_nom_libre?: string | null;
  created_at?: string | null;
  photo_path?: string | null;
}

interface ExportLotPDFProps {
  producers: ProducerExportData[];
  /** Résoudre l'URL signée d'une photo depuis le chemin objet */
  getPhotoUrl: (path: string | null | undefined) => { signedUrl: string | null };
  onDone: () => void;
}

type Status = 'generating' | 'done' | 'error';

export default function ExportLotPDF({ producers, getPhotoUrl, onDone }: ExportLotPDFProps) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<Status>('generating');
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const hasStarted = useRef(false);

  const base = import.meta.env.BASE_URL.replace(/\/$/, '');

  // Initialize the refs array to the correct length
  cardRefs.current = new Array(producers.length).fill(null);

  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    const generate = async () => {
      try {
        const html2canvas = (await import('html2canvas')).default;
        const { jsPDF } = await import('jspdf');

        const CARD_W_MM = 85.6;
        const CARD_H_MM = 54;

        const pdf = new jsPDF({
          orientation: 'landscape',
          unit: 'mm',
          format: [CARD_W_MM, CARD_H_MM],
        });

        for (let i = 0; i < producers.length; i++) {
          const el = cardRefs.current[i];
          if (!el) continue;

          const canvas = await html2canvas(el, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            logging: false,
            width: CARTE_W,
            height: CARTE_H,
            windowWidth: CARTE_W,
            windowHeight: CARTE_H,
          });

          if (i > 0) pdf.addPage([CARD_W_MM, CARD_H_MM], 'landscape');
          const imgData = canvas.toDataURL('image/jpeg', 0.95);
          pdf.addImage(imgData, 'JPEG', 0, 0, CARD_W_MM, CARD_H_MM);

          setProgress(i + 1);
        }

        const dateStr = new Date().toISOString().slice(0, 10);
        pdf.save(`cartes-producteurs-${dateStr}.pdf`);
        setStatus('done');
      } catch (e) {
        console.error('Erreur export PDF lot:', e);
        setStatus('error');
      }
    };

    // Attendre un tick pour que les refs soient bien peuplées
    const timer = setTimeout(generate, 150);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pct = producers.length > 0 ? Math.round((progress / producers.length) * 100) : 0;

  const content = (
    <>
      {/* ── Cartes hors-écran (taille réelle, jamais transformées) ── */}
      <div
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: '-99999px',
          pointerEvents: 'none',
          zIndex: -1,
        }}
      >
        {producers.map((p, i) => {
          const qrUrl = `${window.location.origin}${base}/producteurs/${p.id}`;
          const cooperative = p.cooperative_nom_libre || p.cooperative_nom || null;
          const { signedUrl: photoUrl } = getPhotoUrl(p.photo_path);
          return (
            <CarteProducteur
              key={p.id}
              ref={(el) => { cardRefs.current[i] = el; }}
              id={p.id}
              numeroMembre={p.numero_membre}
              nom={p.nom}
              prenoms={p.prenoms}
              region={p.region}
              departement={p.departement}
              village={p.village}
              telephone={p.telephone}
              cooperative={cooperative}
              createdAt={p.created_at}
              photoUrl={photoUrl}
              qrUrl={qrUrl}
            />
          );
        })}
      </div>

      {/* ── Overlay de progression ── */}
      <div
        className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4 sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-label="Export PDF en lot"
      >
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5">
          {/* En-tête */}
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg text-[#1B5E20]">Export PDF en lot</h2>
            {status !== 'generating' && (
              <button
                onClick={onDone}
                className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Fermer"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            )}
          </div>

          {/* Génération en cours */}
          {status === 'generating' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-[#1B5E20] flex-none" />
                <p className="text-sm text-gray-600">
                  Génération en cours…{' '}
                  <span className="font-bold text-[#1B5E20]">{progress}</span>
                  {' / '}
                  {producers.length} carte{producers.length > 1 ? 's' : ''}
                </p>
              </div>

              {/* Barre de progression */}
              <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-[#1B5E20] h-3 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${pct}%` }}
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={producers.length}
                />
              </div>

              <p className="text-xs text-gray-400 text-center">
                Ne fermez pas cette fenêtre pendant la génération.
              </p>
            </div>
          )}

          {/* Succès */}
          {status === 'done' && (
            <div className="space-y-4">
              <div className="text-center space-y-2 py-2">
                <FileDown className="w-10 h-10 text-[#4CAF50] mx-auto" />
                <p className="font-semibold text-gray-700">PDF téléchargé avec succès !</p>
                <p className="text-sm text-gray-500">
                  {producers.length} carte{producers.length > 1 ? 's' : ''} générée{producers.length > 1 ? 's' : ''}
                </p>
              </div>
              <Button
                className="w-full bg-[#1B5E20] hover:bg-[#2E7D32] text-white rounded-xl h-12 font-bold"
                onClick={onDone}
              >
                Fermer
              </Button>
            </div>
          )}

          {/* Erreur */}
          {status === 'error' && (
            <div className="space-y-4">
              <div className="text-center space-y-2 py-2">
                <AlertTriangle className="w-10 h-10 text-[#F57C00] mx-auto" />
                <p className="text-sm text-red-600 font-medium">
                  Une erreur est survenue lors de la génération.
                </p>
                <p className="text-xs text-gray-400">
                  Vérifiez votre connexion et réessayez.
                </p>
              </div>
              <Button
                variant="outline"
                className="w-full rounded-xl h-12 font-bold border-[#1B5E20] text-[#1B5E20] hover:bg-[#E8F5E9]"
                onClick={onDone}
              >
                Fermer
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );

  return createPortal(content, document.body);
}
