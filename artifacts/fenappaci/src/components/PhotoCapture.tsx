import { useState, useRef, useCallback } from 'react';
import { Camera, ImageIcon, RotateCcw, X, CheckCircle2, AlertTriangle, Loader2, ImageOff } from 'lucide-react';
import { useSignedPhotoUrl } from '@/hooks/use-signed-photo-url';

// ─── Utilitaire upload ────────────────────────────────────────────────────────
export async function uploadPhoto(file: File): Promise<string> {
  const metaRes = await fetch('/api/storage/uploads/request-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
  });
  if (!metaRes.ok) throw new Error("Impossible d'obtenir l'URL de téléversement");
  const { uploadURL, objectPath } = await metaRes.json();

  const uploadRes = await fetch(uploadURL, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!uploadRes.ok) throw new Error('Échec du téléversement de la photo');

  return objectPath as string;
}

// ─── Composant PhotoCapture ──────────────────────────────────────────────────
export interface PhotoCaptureProps {
  label: string;
  objectPath: string | null;
  /** 'user' = caméra frontale (selfie), 'environment' = caméra arrière */
  cameraFacing?: 'user' | 'environment';
  onUploaded: (objectPath: string) => void;
  onRemove: () => void;
}

/** Inner component that resolves the signed URL for an existing saved photo. */
function SavedPhotoPreview({
  objectPath,
  label,
  onReset,
}: {
  objectPath: string;
  label: string;
  onReset: () => void;
}) {
  const { signedUrl, isLoading, isError, invalidate } = useSignedPhotoUrl(objectPath);

  return (
    <div className="relative rounded-xl overflow-hidden border-2 border-[#2E7D32] bg-gray-50">
      {isLoading ? (
        <div className="w-full h-40 flex items-center justify-center bg-[#E8F5E9]">
          <Loader2 className="w-8 h-8 text-[#2E7D32] animate-spin" />
        </div>
      ) : isError || !signedUrl ? (
        <div className="w-full h-40 flex flex-col items-center justify-center bg-red-50 gap-2 px-4 text-center">
          <ImageOff className="w-8 h-8 text-red-400" />
          <p className="text-xs text-red-600 font-medium">Photo introuvable ou expirée</p>
          <p className="text-[10px] text-red-400">La photo a peut-être été supprimée.</p>
        </div>
      ) : (
        <img src={signedUrl} alt={label} className="w-full h-40 object-cover" onError={invalidate} />
      )}
      <div className="absolute top-2 right-2 flex gap-1.5">
        {!isError && (
          <div className="bg-[#2E7D32] text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Envoyé
          </div>
        )}
        <button
          type="button"
          onClick={onReset}
          className="bg-red-500 text-white rounded-full p-1"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

export function PhotoCapture({
  label,
  objectPath,
  cameraFacing = 'environment',
  onUploaded,
  onRemove,
}: PhotoCaptureProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target?.result as string);
      reader.readAsDataURL(file);
      setUploading(true);
      try {
        const path = await uploadPhoto(file);
        onUploaded(path);
      } catch {
        setError("Échec de l'envoi. Vérifiez votre connexion et réessayez.");
        setPreview(null);
      } finally {
        setUploading(false);
      }
    },
    [onUploaded],
  );

  const handleReset = () => {
    setPreview(null);
    setError(null);
    onRemove();
    if (cameraRef.current) cameraRef.current.value = '';
    if (galleryRef.current) galleryRef.current.value = '';
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>

      {(preview || objectPath) && !error ? (
        <>
          {preview ? (
            /* Newly captured — use local data URL directly */
            <div className="relative rounded-xl overflow-hidden border-2 border-[#2E7D32] bg-gray-50">
              <img src={preview} alt={label} className="w-full h-40 object-cover" />
              {uploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
              )}
              {!uploading && (
                <div className="absolute top-2 right-2 flex gap-1.5">
                  <div className="bg-[#2E7D32] text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Envoyé
                  </div>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="bg-red-500 text-white rounded-full p-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          ) : objectPath ? (
            /* Saved path — resolve via presigned URL so we can show the actual image */
            <SavedPhotoPreview objectPath={objectPath} label={label} onReset={handleReset} />
          ) : null}
        </>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              disabled={uploading}
              className="h-14 rounded-xl border-2 border-[#F57C00] text-[#E65100] bg-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#FFF3E0] transition-colors disabled:opacity-50"
            >
              <Camera className="w-4 h-4" />
              Caméra
            </button>
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              disabled={uploading}
              className="h-14 rounded-xl border-2 border-gray-200 text-gray-600 bg-white font-semibold text-sm flex items-center justify-center gap-2 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <ImageIcon className="w-4 h-4" />
              Galerie
            </button>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-red-700">{error}</p>
                <button type="button" onClick={handleReset} className="text-xs text-red-600 underline mt-0.5">
                  Réessayer
                </button>
              </div>
            </div>
          )}

          {uploading && (
            <div className="flex items-center gap-2 text-sm text-gray-500 justify-center py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Envoi en cours…
            </div>
          )}
        </div>
      )}

      {(preview || objectPath) && !uploading && !error && (
        <button type="button" onClick={handleReset} className="text-xs text-[#2E7D32] flex items-center gap-1 underline">
          <RotateCcw className="w-3 h-3" /> Reprendre la photo
        </button>
      )}

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture={cameraFacing}
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
    </div>
  );
}
