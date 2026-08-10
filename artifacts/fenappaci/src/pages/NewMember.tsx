import { useCreateFarmer, getListFarmersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { FarmerForm } from "@/components/FarmerForm";
import { useToast } from "@/hooks/use-toast";
import type { FarmerFormValues } from "@/lib/schemas";

export default function NewMember() {
  const { mutateAsync: createFarmer, isPending } = useCreateFarmer();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleSubmit = async (values: FarmerFormValues) => {
    try {
      const result = await createFarmer({ data: values });
      queryClient.invalidateQueries({ queryKey: getListFarmersQueryKey() });
      toast({
        title: "Membre enregistré",
        description: `Le membre a été enregistré avec succès (N° ${result.numero_membre}).`,
      });
      setLocation(`/membres/${result.id}`);
    } catch (err) {
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer le membre. Veuillez réessayer.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Nouvelle Inscription</h1>
        <p className="text-muted-foreground mt-1">Enregistrement d'un nouveau membre dans la base FENAPPACI.</p>
      </div>

      <div className="bg-card border rounded-xl p-6 shadow-sm">
        <FarmerForm onSubmit={handleSubmit} isSubmitting={isPending} />
      </div>
    </div>
  );
}