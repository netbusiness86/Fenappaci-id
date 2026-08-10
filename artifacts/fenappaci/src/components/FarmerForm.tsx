import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { farmerSchema, type FarmerFormValues } from "@/lib/schemas";
import { useRequestUploadUrl } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, UploadCloud, UserSquare2 } from "lucide-react";

interface FarmerFormProps {
  initialValues?: Partial<FarmerFormValues>;
  onSubmit: (values: FarmerFormValues) => void;
  isSubmitting?: boolean;
}

export function FarmerForm({ initialValues, onSubmit, isSubmitting }: FarmerFormProps) {
  const form = useForm<FarmerFormValues>({
    resolver: zodResolver(farmerSchema),
    defaultValues: {
      nom: initialValues?.nom || "",
      prenoms: initialValues?.prenoms || "",
      date_naissance: initialValues?.date_naissance || "",
      sexe: initialValues?.sexe || "",
      cin: initialValues?.cin || "",
      telephone: initialValues?.telephone || "",
      village: initialValues?.village || "",
      sous_prefecture: initialValues?.sous_prefecture || "",
      region: initialValues?.region || "",
      groupement: initialValues?.groupement || "",
      cooperative: initialValues?.cooperative || "",
      cultures: initialValues?.cultures || "",
      superficie_ha: initialValues?.superficie_ha || ("" as any),
      photo_path: initialValues?.photo_path || "",
    },
  });

  const { mutateAsync: requestUploadUrl } = useRequestUploadUrl();
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      const { uploadURL, objectPath } = await requestUploadUrl({
        data: {
          name: file.name,
          size: file.size,
          contentType: file.type,
        }
      });

      await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      form.setValue("photo_path", objectPath);
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setIsUploading(false);
    }
  };

  const photoPath = form.watch("photo_path");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        {/* Photo Section */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 p-6 border rounded-xl bg-card">
          <div className="relative h-24 w-24 rounded-full overflow-hidden border-4 border-muted bg-muted flex items-center justify-center shrink-0">
            {photoPath ? (
              <img 
                src={photoPath.startsWith('/objects/') ? `/api/storage${photoPath}` : `/api/storage/objects/${photoPath}`} 
                alt="Photo de profil" 
                className="w-full h-full object-cover"
              />
            ) : (
              <UserSquare2 className="h-10 w-10 text-muted-foreground" />
            )}
            {isUploading && (
              <div className="absolute inset-0 bg-background/50 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-medium">Photo du membre</h3>
            <p className="text-sm text-muted-foreground">Une photo claire et récente (passeport). Max 5MB.</p>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="sm" className="relative cursor-pointer">
                <UploadCloud className="h-4 w-4 mr-2" />
                Télécharger
                <input 
                  type="file" 
                  accept="image/*"
                  className="absolute inset-0 opacity-0 cursor-pointer" 
                  onChange={handleFileUpload}
                  disabled={isUploading}
                />
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Identité */}
          <div className="space-y-6 md:col-span-2">
            <h3 className="text-lg font-display font-semibold border-b pb-2">Identité Civile</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="nom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: KONE" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="prenoms"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Prénoms <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Moussa" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="date_naissance"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date de naissance</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sexe"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sexe</FormLabel>
                    <FormControl>
                      <RadioGroup
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        className="flex space-x-4 h-10 items-center"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="M" id="sexe-m" />
                          <label htmlFor="sexe-m" className="text-sm font-medium leading-none cursor-pointer">Masculin</label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="F" id="sexe-f" />
                          <label htmlFor="sexe-f" className="text-sm font-medium leading-none cursor-pointer">Féminin</label>
                        </div>
                      </RadioGroup>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>N° Carte d'Identité (CIN)</FormLabel>
                    <FormControl>
                      <Input placeholder="Numéro CNI" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="telephone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: 0102030405" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Localisation */}
          <div className="space-y-6 md:col-span-2">
            <h3 className="text-lg font-display font-semibold border-b pb-2">Localisation</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="region"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Région</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner une région" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Agnéby-Tiassa">Agnéby-Tiassa</SelectItem>
                        <SelectItem value="Bafing">Bafing</SelectItem>
                        <SelectItem value="Bélier">Bélier</SelectItem>
                        <SelectItem value="Cavally">Cavally</SelectItem>
                        <SelectItem value="Gbêkê">Gbêkê</SelectItem>
                        <SelectItem value="Gôh">Gôh</SelectItem>
                        <SelectItem value="Guémon">Guémon</SelectItem>
                        <SelectItem value="Hambol">Hambol</SelectItem>
                        <SelectItem value="Indénié-Djuablin">Indénié-Djuablin</SelectItem>
                        <SelectItem value="Lôh-Djiboua">Lôh-Djiboua</SelectItem>
                        <SelectItem value="Nawa">Nawa</SelectItem>
                        <SelectItem value="Poro">Poro</SelectItem>
                        <SelectItem value="San-Pédro">San-Pédro</SelectItem>
                        <SelectItem value="Tonkpi">Tonkpi</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="sous_prefecture"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sous-Préfecture</FormLabel>
                    <FormControl>
                      <Input placeholder="Nom de la sous-préfecture" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="village"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Village / Campement <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Input placeholder="Nom du village" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          {/* Activité Agricole */}
          <div className="space-y-6 md:col-span-2">
            <h3 className="text-lg font-display font-semibold border-b pb-2">Activité Agricole</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="groupement"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Groupement Agricole</FormLabel>
                    <FormControl>
                      <Input placeholder="Nom du groupement (Optionnel)" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cooperative"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Coopérative</FormLabel>
                    <FormControl>
                      <Input placeholder="Nom de la coopérative" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="cultures"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cultures (séparées par des virgules)</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Cacao, Café, Hévéa" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="superficie_ha"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Superficie Totale (Hectares)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="Ex: 5.5" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-6">
          <Button type="button" variant="outline" onClick={() => window.history.back()}>
            Annuler
          </Button>
          <Button type="submit" disabled={isSubmitting || isUploading}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enregistrement...
              </>
            ) : (
              "Enregistrer le membre"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}