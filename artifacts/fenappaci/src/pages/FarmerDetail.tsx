import { useRef } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useGetFarmer, useDeleteFarmer, getGetFarmerQueryKey, getListFarmersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { QRCodeSVG } from "qrcode.react";
import { Printer, Edit, Trash2, ArrowLeft, Tractor, MapPin, UserSquare2, ImageOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useSignedPhotoUrl } from "@/hooks/use-signed-photo-url";

/** Membership card photo backed by a presigned URL. */
function FarmerCardPhoto({ objectPath }: { objectPath: string | null | undefined }) {
  const { signedUrl, isLoading, isError, invalidate } = useSignedPhotoUrl(objectPath);

  if (!objectPath)
    return (
      <div className="w-full aspect-[3/4] rounded border bg-muted flex items-center justify-center text-muted-foreground">
        <UserSquare2 className="h-8 w-8 opacity-50" />
      </div>
    );
  if (isLoading)
    return (
      <div className="w-full aspect-[3/4] rounded border bg-muted flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  if (isError || !signedUrl)
    return (
      <div className="w-full aspect-[3/4] rounded border bg-red-50 flex flex-col items-center justify-center gap-1">
        <ImageOff className="h-6 w-6 text-red-300" />
        <span className="text-[8px] text-red-400 text-center leading-tight">Photo<br />introuvable</span>
      </div>
    );
  return <img src={signedUrl} alt="Photo" className="w-full aspect-[3/4] object-cover rounded border bg-muted" onError={invalidate} />;
}

export default function FarmerDetail() {
  const params = useParams();
  const id = Number(params.id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: farmer, isLoading } = useGetFarmer(id, {
    query: { enabled: !!id, queryKey: getGetFarmerQueryKey(id) }
  });

  const { mutateAsync: deleteFarmer, isPending: isDeleting } = useDeleteFarmer();

  const handleDelete = async () => {
    try {
      await deleteFarmer({ id });
      queryClient.invalidateQueries({ queryKey: getListFarmersQueryKey() });
      toast({
        title: "Membre supprimé",
        description: "Le membre a été retiré de la base de données.",
      });
      setLocation("/membres");
    } catch (err) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le membre.",
        variant: "destructive",
      });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!farmer) {
    return (
      <div className="p-6 lg:p-10 text-center space-y-4">
        <h2 className="text-xl font-bold">Membre introuvable</h2>
        <Button asChild><Link href="/membres">Retour à la liste</Link></Button>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild className="shrink-0">
            <Link href="/membres"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Fiche Membre</h1>
            <p className="text-muted-foreground">{farmer.numero_membre}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimer la carte
          </Button>
          <Button asChild>
            <Link href={`/membres/${farmer.id}/modifier`}>
              <Edit className="h-4 w-4 mr-2" />
              Modifier
            </Link>
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="icon">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
                <AlertDialogDescription>
                  Êtes-vous sûr de vouloir supprimer définitivement le membre {farmer.nom} {farmer.prenoms} ? Cette action est irréversible.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                  {isDeleting ? "Suppression..." : "Supprimer"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Printable Card Area */}
        <div className="lg:col-span-1 flex justify-center lg:justify-start">
          <div id="printable-card" className="w-[8.5cm] h-[5.4cm] bg-card border-2 border-primary/20 rounded-xl overflow-hidden shadow-lg relative flex flex-col print:border-black/30 print:shadow-none">
            {/* Background decorative elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full -z-10"></div>
            
            {/* Header */}
            <div className="bg-primary text-primary-foreground p-2 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Tractor className="h-4 w-4" />
                <span className="font-display font-bold text-xs tracking-tight">FENAPPACI</span>
              </div>
              <div className="text-[8px] font-medium opacity-90 text-right leading-tight">
                CARTE<br/>MEMBRE
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 p-3 flex gap-3">
              <div className="shrink-0 w-[2.2cm]">
                <FarmerCardPhoto objectPath={farmer.photo_path} />
                <div className="mt-1 text-[8px] text-center font-mono font-medium text-foreground bg-muted py-0.5 rounded">
                  {farmer.numero_membre.split('-').pop()}
                </div>
              </div>
              
              <div className="flex-1 flex flex-col justify-between py-0.5 min-w-0">
                <div>
                  <div className="text-[8px] text-muted-foreground uppercase mb-0.5">Nom & Prénoms</div>
                  <div className="font-bold text-sm leading-tight text-foreground truncate">{farmer.nom.toUpperCase()}</div>
                  <div className="font-medium text-xs leading-tight text-foreground/90 truncate">{farmer.prenoms}</div>
                </div>

                <div className="grid grid-cols-2 gap-1 mt-1">
                  <div>
                    <div className="text-[7px] text-muted-foreground uppercase">Village</div>
                    <div className="text-[9px] font-semibold truncate">{farmer.village}</div>
                  </div>
                  <div>
                    <div className="text-[7px] text-muted-foreground uppercase">Région</div>
                    <div className="text-[9px] font-semibold truncate">{farmer.region || '-'}</div>
                  </div>
                </div>
                
                <div className="mt-1">
                  <div className="text-[7px] text-muted-foreground uppercase">Cultures Principales</div>
                  <div className="text-[9px] font-medium leading-tight line-clamp-1">
                    {farmer.cultures || '-'}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer & QR */}
            <div className="px-3 pb-2 pt-1 flex items-end justify-between">
              <div className="text-[7px] text-muted-foreground">
                Délivrée le: {format(new Date(farmer.created_at), 'dd/MM/yyyy')}
              </div>
              <div className="bg-white p-0.5 rounded border">
                <QRCodeSVG 
                  value={farmer.numero_membre} 
                  size={32}
                  level="L"
                  includeMargin={false}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Details Data */}
        <div className="lg:col-span-2 space-y-6 no-print">
          <div className="bg-card border rounded-xl p-6 shadow-sm space-y-6">
            <h3 className="text-lg font-display font-semibold border-b pb-2">Informations Détaillées</h3>
            
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
              <div>
                <dt className="text-muted-foreground mb-1">N° Membre</dt>
                <dd className="font-mono font-medium">{farmer.numero_membre}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground mb-1">Date d'inscription</dt>
                <dd className="font-medium">{format(new Date(farmer.created_at), 'PPP', { locale: fr })}</dd>
              </div>
              
              <div className="col-span-1 sm:col-span-2 my-2 border-t"></div>

              <div>
                <dt className="text-muted-foreground mb-1">Nom complet</dt>
                <dd className="font-medium">{farmer.nom.toUpperCase()} {farmer.prenoms}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground mb-1">Date de naissance</dt>
                <dd className="font-medium">
                  {farmer.date_naissance ? format(new Date(farmer.date_naissance), 'PPP', { locale: fr }) : '-'}
                </dd>
              </div>

              <div>
                <dt className="text-muted-foreground mb-1">Sexe</dt>
                <dd className="font-medium">{farmer.sexe === 'M' ? 'Masculin' : farmer.sexe === 'F' ? 'Féminin' : '-'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground mb-1">N° Carte d'Identité (CIN)</dt>
                <dd className="font-medium">{farmer.cin || '-'}</dd>
              </div>

              <div>
                <dt className="text-muted-foreground mb-1">Téléphone</dt>
                <dd className="font-medium">{farmer.telephone || '-'}</dd>
              </div>
              
              <div className="col-span-1 sm:col-span-2 my-2 border-t"></div>

              <div>
                <dt className="text-muted-foreground mb-1">Village / Campement</dt>
                <dd className="font-medium flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-primary" />
                  {farmer.village}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground mb-1">Sous-Préfecture</dt>
                <dd className="font-medium">{farmer.sous_prefecture || '-'}</dd>
              </div>

              <div>
                <dt className="text-muted-foreground mb-1">Région</dt>
                <dd className="font-medium">{farmer.region || '-'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground mb-1">Coopérative</dt>
                <dd className="font-medium">{farmer.cooperative || '-'}</dd>
              </div>

              <div className="col-span-1 sm:col-span-2 my-2 border-t"></div>

              <div className="col-span-1 sm:col-span-2">
                <dt className="text-muted-foreground mb-2">Cultures Pratiquées</dt>
                <dd className="flex flex-wrap gap-2">
                  {farmer.cultures ? farmer.cultures.split(',').map((c, i) => (
                    <Badge key={i} variant="secondary" className="px-3 py-1 font-medium">{c.trim()}</Badge>
                  )) : '-'}
                </dd>
              </div>

              <div>
                <dt className="text-muted-foreground mb-1">Superficie Totale</dt>
                <dd className="font-medium text-lg">
                  {farmer.superficie_ha ? `${farmer.superficie_ha} ha` : '-'}
                </dd>
              </div>

            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}