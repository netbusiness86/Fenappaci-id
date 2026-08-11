/**
 * CarteProducteur — carte numérique officielle FENAPPACI
 * Format carte bancaire (85,6 mm × 54 mm, horizontal)
 * Rendu optimisé pour html2canvas + impression
 */
import { forwardRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

// Dimensions de rendu (px à 96 dpi — ×2 pour qualité d'impression)
export const CARTE_W = 680;
export const CARTE_H = 428;

export interface CarteProducteurProps {
  id: string | number;
  numeroMembre: string;
  nom: string;
  prenoms: string;
  region?: string | null;
  departement?: string | null;
  village?: string | null;
  telephone?: string | null;
  cooperative?: string | null;
  createdAt?: string | null;
  photoUrl?: string | null;
  /** URL encodée dans le QR code — doit pointer vers la fiche protégée */
  qrUrl: string;
}

const CarteProducteur = forwardRef<HTMLDivElement, CarteProducteurProps>(
  function CarteProducteur(
    { id, numeroMembre, nom, prenoms, region, departement, village, telephone, cooperative, createdAt, photoUrl, qrUrl },
    ref
  ) {
    const dateStr = createdAt
      ? new Date(createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : '—';

    return (
      <div
        ref={ref}
        style={{
          width: CARTE_W,
          height: CARTE_H,
          background: '#2E7D32',       /* solid — html2canvas gère mal les gradients sur mobile */
          borderRadius: 24,
          overflow: 'hidden',
          position: 'relative',
          fontFamily: 'Arial, Helvetica, sans-serif',  /* police sûre html2canvas */
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
          flexShrink: 0,
        }}
      >
        {/* ── Bande décorative orange haut ───────────────────────── */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 8, background: '#F57C00' }} />

        {/* ── En-tête ─────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '20px 28px 0 28px', marginTop: 8,
        }}>
          {/* Logo */}
          <img
            src="/logo-fenappaci.png"
            alt="FENAPPACI"
            style={{ width: 48, height: 48, borderRadius: '50%', background: 'white', objectFit: 'contain', padding: 3 }}
          />
          <div>
            <div style={{ color: 'white', fontWeight: 800, fontSize: 20, letterSpacing: 2, lineHeight: 1 }}>
              FENAPPACI
            </div>
            <div style={{ color: '#A5D6A7', fontSize: 9, fontWeight: 600, letterSpacing: 1.5, marginTop: 3 }}>
              CARTE OFFICIELLE DE MEMBRE
            </div>
          </div>
          {/* Séparateur */}
          <div style={{ flex: 1 }} />
          <div style={{
            background: 'rgba(255,255,255,0.12)', borderRadius: 8, padding: '4px 10px',
            color: '#FFD54F', fontSize: 9, fontWeight: 700, letterSpacing: 1,
          }}>
            ACTIF
          </div>
        </div>

        {/* ── Séparateur vert clair ─────────────────────────────── */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.15)', margin: '14px 28px 0' }} />

        {/* ── Corps principal ──────────────────────────────────── */}
        <div style={{ display: 'flex', padding: '16px 28px 0', gap: 20, alignItems: 'flex-start' }}>

          {/* Photo ------------------------------------------------ */}
          <div style={{ flexShrink: 0 }}>
            <div style={{
              width: 110, height: 136,
              borderRadius: 12,
              overflow: 'hidden',
              border: '3px solid rgba(255,255,255,0.3)',
              background: 'rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {photoUrl ? (
                <img src={photoUrl} alt="Photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <svg width="40" height="40" viewBox="0 0 24 24" fill="rgba(255,255,255,0.4)">
                  <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
                </svg>
              )}
            </div>
          </div>

          {/* Infos producteur ------------------------------------- */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Nom */}
            <div style={{ color: 'white', fontWeight: 800, fontSize: 18, lineHeight: 1.2, marginBottom: 2 }}>
              {nom.toUpperCase()}
            </div>
            <div style={{ color: '#C8E6C9', fontWeight: 600, fontSize: 13, marginBottom: 10 }}>
              {prenoms}
            </div>

            {/* Numéro membre */}
            <div style={{
              display: 'inline-block',
              background: '#F57C00',
              color: 'white', fontWeight: 800, fontSize: 11,
              padding: '3px 10px', borderRadius: 20, letterSpacing: 0.5, marginBottom: 12,
            }}>
              {numeroMembre}
            </div>

            {/* Champs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {region && <InfoLine label="Région" value={region} />}
              {departement && <InfoLine label="Dépt" value={departement} />}
              {village && <InfoLine label="Localité" value={village} />}
              {telephone && <InfoLine label="Tél" value={telephone} />}
              {cooperative && <InfoLine label="Coopérative" value={cooperative} />}
              <InfoLine label="Inscrit" value={dateStr} />
            </div>
          </div>

          {/* QR Code --------------------------------------------- */}
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div style={{
              background: 'white', borderRadius: 10, padding: 8,
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}>
              <QRCodeSVG
                value={qrUrl}
                size={88}
                level="M"
                bgColor="#ffffff"
                fgColor="#1B5E20"
              />
            </div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 8, textAlign: 'center', maxWidth: 88 }}>
              Scanner pour voir la fiche
            </div>
          </div>
        </div>

        {/* ── Bande slogan bas ─────────────────────────────────── */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: '#F57C00',
          padding: '8px 28px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ color: 'white', fontSize: 10, fontWeight: 700, letterSpacing: 0.8, fontStyle: 'italic' }}>
            « La recherche de la qualité, notre affaire. »
          </span>
        </div>
      </div>
    );
  }
);

export default CarteProducteur;

// ── Sous-composant ligne d'info ──────────────────────────────────────────────
function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
      <span style={{
        display: 'inline-block', width: 5, height: 5,
        borderRadius: '50%', background: '#F57C00', flexShrink: 0,
        marginBottom: 1,
      }} />
      <span style={{ color: '#A5D6A7', fontSize: 9, fontWeight: 700, minWidth: 58, flexShrink: 0, letterSpacing: 0.3 }}>{label} :</span>
      <span style={{ color: 'white', fontSize: 10, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );
}
