import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Pencil, Loader2, Building2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
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

const clinicSchema = z.object({
  name: z.string().min(2, "Name ist erforderlich"),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Ungültige E-Mail").or(z.literal("")).optional(),
  adminEmail: z.string().email("Ungültige E-Mail").or(z.literal("")).optional(),
});

type ClinicFormValues = z.infer<typeof clinicSchema>;

export default function ClinicsPage() {
  const { role } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingClinic, setEditingClinic] = useState<any>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<ClinicFormValues>({
    resolver: zodResolver(clinicSchema),
    defaultValues: {
      name: "",
      address: "",
      phone: "",
      email: "",
      adminEmail: "",
    }
  });

  // Fetch Clinics
  const { data: clinics, isLoading } = useQuery({
    queryKey: ["all-clinics"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clinics").select("*").order("name");
      if (error) throw error;
      return data;
    },
    enabled: role === "system_admin",
  });

  // Create/Update Mutation
  const saveMutation = useMutation({
    mutationFn: async (values: ClinicFormValues) => {
      const clinicData = {
        name: values.name,
        address: values.address || null,
        phone: values.phone || null,
        email: values.email || null,
      };

      if (editingClinic) {
        const { error } = await supabase
          .from("clinics")
          .update(clinicData)
          .eq("id", editingClinic.id);
        if (error) throw error;
      } else {
        const { data: newClinic, error } = await supabase
          .from("clinics")
          .insert([clinicData])
          .select()
          .single();
        if (error) throw error;

        // If adminEmail provided, create an invitation
        if (values.adminEmail && newClinic) {
          const { error: inviteError } = await supabase
            .from("invitations")
            .insert({
              email: values.adminEmail,
              clinic_id: newClinic.id,
              role: "clinic_admin",
              invited_by: (await supabase.auth.getUser()).data.user?.id
            });
          
          if (inviteError) {
             toast.error(`Klinik erstellt, aber Einladung konnte nicht gespeichert werden.`);
          } else {
             toast.info(`Einladung an ${values.adminEmail} wurde vorgemerkt.`);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-clinics"] });
      toast.success(editingClinic ? "Klinik aktualisiert!" : "Klinik erstellt!");
      setIsDialogOpen(false);
      reset();
      setEditingClinic(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Ein Fehler ist aufgetreten.");
    }
  });

  const onSubmit = (data: ClinicFormValues) => {
    saveMutation.mutate(data);
  };

  const openEditDialog = (clinic: any) => {
    setEditingClinic(clinic);
    reset({
      name: clinic.name,
      address: clinic.address || "",
      phone: clinic.phone || "",
      email: clinic.email || "",
      adminEmail: "", // Don't show admin email on edit for now
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingClinic(null);
    reset({ name: "", address: "", phone: "", email: "", adminEmail: "" });
    setIsDialogOpen(true);
  };

  if (role !== "system_admin") {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-red-500 font-medium">Zugriff verweigert. Nur für System-Administratoren.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Klinikverwaltung</h2>
          <p className="text-sm text-slate-500">Systemweite Verwaltung aller Kliniken.</p>
        </div>
        <Button onClick={openCreateDialog} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-2 h-4 w-4" /> Klinik hinzufügen
        </Button>
      </div>

      <div className="rounded-md border bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Klinik Name</TableHead>
              <TableHead>Kontakt</TableHead>
              <TableHead>Adresse</TableHead>
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
            ) : clinics?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-slate-500">
                  Keine Kliniken gefunden.
                </TableCell>
              </TableRow>
            ) : (
              clinics?.map((clinic) => (
                <TableRow key={clinic.id}>
                  <TableCell>
                    <div className="flex items-center font-medium text-slate-900">
                      <Building2 className="mr-2 h-4 w-4 text-slate-400" />
                      {clinic.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">
                    <div>{clinic.email || "-"}</div>
                    <div>{clinic.phone || "-"}</div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-500">{clinic.address || "-"}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(clinic)}>
                      <Pencil className="h-4 w-4 text-slate-500" />
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
              <DialogTitle>{editingClinic ? "Klinik bearbeiten" : "Neue Klinik anlegen"}</DialogTitle>
              <DialogDescription>
                Hinterlegen Sie die grundlegenden Daten der Klinik.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Klinik Name *</Label>
                <Input id="name" {...register("name")} placeholder="z.B. Reha-Klinik Sonnenaufgang" />
                {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">E-Mail</Label>
                <Input id="email" type="email" {...register("email")} placeholder="info@klinik.de" />
                {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Telefon</Label>
                <Input id="phone" {...register("phone")} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="address">Vollständige Adresse</Label>
                <Input id="address" {...register("address")} />
              </div>
              {!editingClinic && (
                <div className="grid gap-2 p-3 bg-blue-50 rounded-md border border-blue-100">
                  <Label htmlFor="adminEmail" className="text-blue-700">Initialer Klinik-Admin (E-Mail)</Label>
                  <Input 
                    id="adminEmail" 
                    {...register("adminEmail")} 
                    placeholder="E-Mail des Admins"
                    className="bg-white"
                  />
                  <p className="text-[10px] text-blue-500 italic">Der Nutzer erhält automatisch Admin-Rechte, sobald er sich registriert.</p>
                  {errors.adminEmail && <p className="text-sm text-red-500">{errors.adminEmail.message}</p>}
                </div>
              )}
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
