import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import type {  TherapyType  } from "@/types";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const therapyTypeSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich"),
  description: z.string().optional(),
  duration_minutes: z.coerce.number().min(5, "Dauer muss mindestens 5 Minuten betragen"),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, "Gültige Hex-Farbe erforderlich (z.B. #FF0000)").optional(),
});

type TherapyTypeFormValues = z.infer<typeof therapyTypeSchema>;

export default function TherapyTypesPage() {
  const { activeClinicId } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<TherapyType | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<TherapyTypeFormValues>({
    resolver: zodResolver(therapyTypeSchema),
    defaultValues: {
      name: "",
      description: "",
      duration_minutes: 60,
      color: "#10b981",
    }
  });

  // Fetch Therapy Types
  const { data: therapyTypes, isLoading } = useQuery({
    queryKey: ["therapyTypes", activeClinicId],
    queryFn: async () => {
      if (!activeClinicId) return [];
      const { data, error } = await supabase
        .from("therapy_types")
        .select("*")
        .eq("clinic_id", activeClinicId)
        .order("name");
      if (error) throw error;
      return data as TherapyType[];
    },
    enabled: !!activeClinicId,
  });

  // Create/Update Mutation
  const saveMutation = useMutation({
    mutationFn: async (values: TherapyTypeFormValues) => {
      if (!activeClinicId) throw new Error("Keine Klinik ausgewählt");
      
      const therapyData = {
        clinic_id: activeClinicId,
        name: values.name,
        description: values.description || null,
        duration_minutes: values.duration_minutes,
        color: values.color || "#10b981",
      };

      if (editingType) {
        const { error } = await supabase
          .from("therapy_types")
          .update(therapyData)
          .eq("id", editingType.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("therapy_types")
          .insert([therapyData]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["therapyTypes"] });
      toast.success(editingType ? "Therapieart aktualisiert!" : "Therapieart erstellt!");
      setIsDialogOpen(false);
      reset();
      setEditingType(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Ein Fehler ist aufgetreten.");
    }
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("therapy_types").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["therapyTypes"] });
      toast.success("Therapieart gelöscht!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Fehler beim Löschen.");
    }
  });

  const onSubmit = (data: TherapyTypeFormValues) => {
    saveMutation.mutate(data);
  };

  const openEditDialog = (type: TherapyType) => {
    setEditingType(type);
    reset({
      name: type.name,
      description: type.description || "",
      duration_minutes: type.duration_minutes,
      color: type.color || "#10b981",
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingType(null);
    reset({ name: "", description: "", duration_minutes: 60, color: "#10b981" });
    setIsDialogOpen(true);
  };

  if (!activeClinicId) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-slate-500">Bitte wählen Sie eine Klinik aus.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Therapiearten</h2>
          <p className="text-sm text-slate-500">Verwalten Sie die angebotenen Therapien.</p>
        </div>
        <Button onClick={openCreateDialog} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-2 h-4 w-4" /> Therapieart hinzufügen
        </Button>
      </div>

      <div className="rounded-md border bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Farbe</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Dauer (Min)</TableHead>
              <TableHead>Beschreibung</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-300" />
                </TableCell>
              </TableRow>
            ) : therapyTypes?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-slate-500">
                  Keine Therapiearten gefunden.
                </TableCell>
              </TableRow>
            ) : (
              therapyTypes?.map((type) => (
                <TableRow key={type.id}>
                  <TableCell>
                    <div className="h-6 w-6 rounded-md shadow-sm" style={{ backgroundColor: type.color }} />
                  </TableCell>
                  <TableCell className="font-medium text-slate-900">{type.name}</TableCell>
                  <TableCell>{type.duration_minutes}</TableCell>
                  <TableCell className="text-slate-500 max-w-xs truncate">
                    {type.description || "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(type)}>
                      <Pencil className="h-4 w-4 text-slate-500" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => {
                        if (confirm("Wirklich löschen?")) {
                          deleteMutation.mutate(type.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>{editingType ? "Therapieart bearbeiten" : "Neue Therapieart erstellen"}</DialogTitle>
              <DialogDescription>
                Details der Therapieart anpassen.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" {...register("name")} placeholder="z.B. Physiotherapie" />
                {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="duration_minutes">Dauer (Minuten)</Label>
                <Input id="duration_minutes" type="number" {...register("duration_minutes")} />
                {errors.duration_minutes && <p className="text-sm text-red-500">{errors.duration_minutes.message}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="color">Farbe (Hex)</Label>
                <div className="flex gap-2">
                  <Input id="color" type="color" className="w-16 p-1 h-10" {...register("color")} />
                  <Input type="text" {...register("color")} placeholder="#10b981" className="flex-1" />
                </div>
                {errors.color && <p className="text-sm text-red-500">{errors.color.message}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Beschreibung (optional)</Label>
                <Input id="description" {...register("description")} placeholder="Kurze Beschreibung" />
                {errors.description && <p className="text-sm text-red-500">{errors.description.message}</p>}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Speichern
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
