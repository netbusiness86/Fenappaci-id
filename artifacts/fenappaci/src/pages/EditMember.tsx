import { useGetFarmer, useUpdateFarmer, getGetFarmerQueryKey, getListFarmersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation, useParams } from "wouter";
import { FarmerForm } from "@/components/FarmerForm";
import { useToast } from "@/hooks/use-toast";
import type { FarmerFormValues } from "@/lib/schemas";
import { Skeleton } from "@/components/ui/skeleton";

export default function EditMember() {
  const params = useParams();
  const id = Number(params.id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: farmer, isLoading } = useGetFarmer(id, {
    query: { enabled: !!id, queryKey: getGetFarmerQueryKey(id) }
  });

  const { mutateAsync: updateFarmer, isPending } = useUpdateFarmer();

  const handleSubmit = async (values: FarmerFormValues) => {
    try {
      await updateFarmer({ id, data: values });
      
      // Update local cache directly for immediate feedback
      queryClient.setQueryData(getGetFarmerQueryKey(id), (old: any) => 
        old ? { ...old, ...values } : old
      );
      queryClient.invalidateQueries({ queryKey: getListFarmersQueryKey() });
      
      toast({
        title: "Modifications enregistrées",
        description: "Les informations du membre ont été mises à jour.",
      });
      setLocation(`/membres/${id}`);
    } catch (err) {
      toast({
        title: "Erreur",
        description: "Impossible de modifier les informations.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Modifier les informations</h1>
        <p className="text-muted-foreground mt-1">Mise à jour de la fiche membre.</p>
      </div>

      <div className="bg-card border rounded-xl p-6 shadow-sm">
        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-24 w-24 rounded-full" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
        ) : farmer ? (
          <FarmerForm 
            initialValues={{
              ...farmer,
              date_naissance: farmer.date_naissance || "",
              sexe: farmer.sexe || "",
              cin: farmer.cin || "",
              telephone: farmer.telephone || "",
              sous_prefecture: farmer.sous_prefecture || "",
              region: farmer.region || "",
              groupement: farmer.groupement || "",
              cooperative: farmer.cooperative || "",
              cultures: farmer.cultures || "",
              superficie_ha: farmer.superficie_ha ?? ("" as any),
              photo_path: farmer.photo_path || "",
            }} 
            onSubmit={handleSubmit} 
            isSubmitting={isPending} 
          />
        ) : (
          <div className="text-center py-8 text-muted-foreground">Membre introuvable.</div>
        )}
      </div>
    </div>
  );
}