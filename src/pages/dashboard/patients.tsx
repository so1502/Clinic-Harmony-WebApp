import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { Plus, Pencil, Trash2, Loader2, Calendar as CalendarIcon } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import type {  Patient  } from "@/types";
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

const patientSchema = z.object({
  full_name: z.string().min(2, "Name ist erforderlich"),
  email: z.string().email("Ungültige E-Mail").or(z.literal("")).optional(),
  phone: z.string().optional(),
  date_of_birth: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});

type PatientFormValues = z.infer<typeof patientSchema>;

export default function PatientsPage() {
  const { activeClinicId } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<PatientFormValues>({
    resolver: zodResolver(patientSchema),
    defaultValues: {
      full_name: "",
      email: "",
      phone: "",
      date_of_birth: "",
      address: "",
      notes: "",
    }
  });

  // Fetch Patients
  const { data: patients, isLoading } = useQuery({
    queryKey: ["patients", activeClinicId],
    queryFn: async () => {
      if (!activeClinicId) return [];
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .eq("clinic_id", activeClinicId)
        .order("full_name");
      if (error) throw error;
      return data as Patient[];
    },
    enabled: !!activeClinicId,
  });

  // Create/Update Mutation
  const saveMutation = useMutation({
    mutationFn: async (values: PatientFormValues) => {
      if (!activeClinicId) throw new Error("Keine Klinik ausgewählt");
      
      const patientData = {
        clinic_id: activeClinicId,
        full_name: values.full_name,
        email: values.email || null,
        phone: values.phone || null,
        date_of_birth: values.date_of_birth || null,
        address: values.address || null,
        notes: values.notes || null,
      };

      if (editingPatient) {
        const { error } = await supabase
          .from("patients")
          .update(patientData)
          .eq("id", editingPatient.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("patients")
          .insert([patientData]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      toast.success(editingPatient ? "Patient aktualisiert!" : "Patient erstellt!");
      setIsDialogOpen(false);
      reset();
      setEditingPatient(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Ein Fehler ist aufgetreten.");
    }
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("patients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      toast.success("Patient gelöscht!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Fehler beim Löschen.");
    }
  });

  const onSubmit = (data: PatientFormValues) => {
    saveMutation.mutate(data);
  };

  const openEditDialog = (patient: Patient) => {
    setEditingPatient(patient);
    reset({
      full_name: patient.full_name,
      email: patient.email || "",
      phone: patient.phone || "",
      date_of_birth: patient.date_of_birth || "",
      address: patient.address || "",
      notes: patient.notes || "",
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingPatient(null);
    reset({
      full_name: "",
      email: "",
      phone: "",
      date_of_birth: "",
      address: "",
      notes: "",
    });
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
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Patienten</h2>
          <p className="text-sm text-slate-500">Verwalten Sie die Patientendatenbank.</p>
        </div>
        <Button onClick={openCreateDialog} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-2 h-4 w-4" /> Patient hinzufügen
        </Button>
      </div>

      <div className="rounded-md border bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Kontakt</TableHead>
              <TableHead>Geburtsdatum</TableHead>
              <TableHead className="text-right">Aktionen</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-300" />
                </TableCell>
              </TableRow>
            ) : patients?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-slate-500">
                  Keine Patienten gefunden.
                </TableCell>
              </TableRow>
            ) : (
              patients?.map((patient) => (
                <TableRow key={patient.id}>
                  <TableCell className="font-medium text-slate-900">{patient.full_name}</TableCell>
                  <TableCell className="text-sm text-slate-500">
                    <div>{patient.email || "-"}</div>
                    <div>{patient.phone || "-"}</div>
                  </TableCell>
                  <TableCell>
                    {patient.date_of_birth ? format(new Date(patient.date_of_birth), "dd.MM.yyyy") : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(patient)}>
                      <Pencil className="h-4 w-4 text-slate-500" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => {
                        if (confirm("Wirklich löschen? Dies kann Auswirkungen auf Termine haben.")) {
                          deleteMutation.mutate(patient.id);
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
              <DialogTitle>{editingPatient ? "Patient bearbeiten" : "Neuen Patienten anlegen"}</DialogTitle>
              <DialogDescription>
                Geben Sie die Patienteninformationen ein.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="grid gap-2">
                <Label htmlFor="full_name">Vollständiger Name *</Label>
                <Input id="full_name" {...register("full_name")} />
                {errors.full_name && <p className="text-sm text-red-500">{errors.full_name.message}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">E-Mail</Label>
                <Input id="email" type="email" {...register("email")} />
                {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Telefonnummer</Label>
                <Input id="phone" {...register("phone")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="date_of_birth">Geburtsdatum</Label>
                <Input id="date_of_birth" type="date" {...register("date_of_birth")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="address">Adresse</Label>
                <Input id="address" {...register("address")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notes">Interne Notizen</Label>
                <Input id="notes" {...register("notes")} />
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
