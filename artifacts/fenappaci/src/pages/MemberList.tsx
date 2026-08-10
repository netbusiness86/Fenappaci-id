import { useState } from "react";
import { useListFarmers } from "@workspace/api-client-react";
import { Link } from "wouter";
import { 
  Search, 
  Plus, 
  Filter,
  Eye,
  FileEdit,
  UserSquare2,
  ImageOff,
  Loader2,
} from "lucide-react";
import { useSignedPhotoUrl } from "@/hooks/use-signed-photo-url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

/** Small circular avatar backed by a presigned URL for the member list. */
function MemberThumbnail({ photoPath }: { photoPath: string | null | undefined }) {
  const { signedUrl, isLoading, isError, invalidate } = useSignedPhotoUrl(photoPath);
  if (!photoPath)
    return (
      <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
        <UserSquare2 className="h-5 w-5" />
      </div>
    );
  if (isLoading)
    return (
      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  if (isError || !signedUrl)
    return (
      <div className="h-10 w-10 rounded-full bg-red-50 flex items-center justify-center">
        <ImageOff className="h-4 w-4 text-red-300" aria-label="Photo introuvable" />
      </div>
    );
  return (
    <img
      src={signedUrl}
      alt="Photo"
      className="h-10 w-10 rounded-full object-cover border bg-muted"
      onError={invalidate}
    />
  );
}

export default function MemberList() {
  const [search, setSearch] = useState("");
  const [regionFilter, setRegionFilter] = useState("all");
  
  // Create a debounced search value to prevent too many API calls
  // In a real app we'd use useDebounce, but here we can just pass the state
  // Or we can apply the search on form submit
  const [appliedSearch, setAppliedSearch] = useState("");

  const { data: farmers, isLoading } = useListFarmers({
    search: appliedSearch || undefined,
    region: regionFilter !== "all" ? regionFilter : undefined,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearch(search);
  };

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Annuaire des Membres</h1>
          <p className="text-muted-foreground mt-1">Gérez et recherchez les paysans enregistrés.</p>
        </div>
        <Button asChild className="gap-2 shrink-0">
          <Link href="/membres/nouveau">
            <Plus className="h-4 w-4" />
            Nouvelle Inscription
          </Link>
        </Button>
      </div>

      <div className="bg-card border rounded-xl p-4 shadow-sm space-y-4">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Rechercher par nom, n° membre ou CIN..." 
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2 sm:w-1/3">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select value={regionFilter} onValueChange={setRegionFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Toutes les régions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les régions</SelectItem>
                <SelectItem value="Agnéby-Tiassa">Agnéby-Tiassa</SelectItem>
                <SelectItem value="Bafing">Bafing</SelectItem>
                <SelectItem value="Bagoué">Bagoué</SelectItem>
                <SelectItem value="Bélier">Bélier</SelectItem>
                <SelectItem value="Béré">Béré</SelectItem>
                <SelectItem value="Bounkani">Bounkani</SelectItem>
                <SelectItem value="Cavally">Cavally</SelectItem>
                <SelectItem value="Folon">Folon</SelectItem>
                <SelectItem value="Gbêkê">Gbêkê</SelectItem>
                <SelectItem value="Gôh">Gôh</SelectItem>
                <SelectItem value="Guémon">Guémon</SelectItem>
                <SelectItem value="Hambol">Hambol</SelectItem>
                <SelectItem value="Indénié-Djuablin">Indénié-Djuablin</SelectItem>
                <SelectItem value="Kabadougou">Kabadougou</SelectItem>
                <SelectItem value="La Mé">La Mé</SelectItem>
                <SelectItem value="Lôh-Djiboua">Lôh-Djiboua</SelectItem>
                <SelectItem value="N'Zi">N'Zi</SelectItem>
                <SelectItem value="Nawa">Nawa</SelectItem>
                <SelectItem value="Poro">Poro</SelectItem>
                <SelectItem value="San-Pédro">San-Pédro</SelectItem>
                <SelectItem value="Sud-Comoé">Sud-Comoé</SelectItem>
                <SelectItem value="Tchologo">Tchologo</SelectItem>
                <SelectItem value="Tonkpi">Tonkpi</SelectItem>
                <SelectItem value="Worodougou">Worodougou</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" variant="secondary" className="shrink-0">Rechercher</Button>
        </form>
      </div>

      <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[120px]">N° Membre</TableHead>
              <TableHead>Nom & Prénoms</TableHead>
              <TableHead>Village / Région</TableHead>
              <TableHead>Cultures</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                  <TableCell>
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                  </TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : farmers && farmers.length > 0 ? (
              farmers.map((farmer) => (
                <TableRow key={farmer.id} className="hover:bg-muted/30">
                  <TableCell className="font-mono text-xs font-medium">{farmer.numero_membre}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <MemberThumbnail photoPath={farmer.photo_path} />
                      <div>
                        <div className="font-semibold text-foreground">{farmer.nom.toUpperCase()} {farmer.prenoms}</div>
                        {farmer.telephone && <div className="text-xs text-muted-foreground">{farmer.telephone}</div>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{farmer.village}</div>
                    <div className="text-xs text-muted-foreground">{farmer.region || '-'}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {farmer.cultures ? farmer.cultures.split(',').slice(0, 2).map(c => (
                        <Badge key={c} variant="secondary" className="text-[10px] px-1.5 py-0">{c.trim()}</Badge>
                      )) : <span className="text-muted-foreground text-xs">-</span>}
                      {farmer.cultures && farmer.cultures.split(',').length > 2 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">+{farmer.cultures.split(',').length - 2}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="icon" asChild>
                        <Link href={`/membres/${farmer.id}/modifier`}>
                          <FileEdit className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button variant="outline" size="sm" asChild className="gap-1">
                        <Link href={`/membres/${farmer.id}`}>
                          <Eye className="h-4 w-4" />
                          <span className="hidden sm:inline">Fiche</span>
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  Aucun membre trouvé.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}