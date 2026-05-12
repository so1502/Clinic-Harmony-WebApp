import { useState } from "react";
import { useTranslation } from "react-i18next";
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

const patientSchema = (t: any) => z.object({
  first_name: z.string().min(2, t('common.required')),
  last_name: z.string().min(2, t('common.required')),
  email: z.string().email().or(z.literal("")).optional(),
  phone: z.string().optional(),
  date_of_birth: z.string().optional(),
  gender: z.string().optional(),
  ssn_svn: z.string().optional(),
  street: z.string().optional(),
  house_number: z.string().optional(),
  city: z.string().optional(),
  state_province: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),
  insurance_provider: z.string().optional(),
  insurance_number: z.string().optional(),
  insurance_group: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  preferred_language: z.string().optional(),
  notes: z.string().optional(),
});

type PatientFormValues = z.infer<typeof patientSchema>;

export default function PatientsPage() {
  const { t } = useTranslation();
  const { activeClinicId } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<any>({
    resolver: zodResolver(patientSchema(t)),
    defaultValues: {
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      date_of_birth: "",
      gender: "",
      ssn_svn: "",
      street: "",
      house_number: "",
      city: "",
      state_province: "",
      postal_code: "",
      country: "",
      insurance_provider: "",
      insurance_number: "",
      insurance_group: "",
      emergency_contact_name: "",
      emergency_contact_phone: "",
      preferred_language: "de",
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

  // Fetch Clinic Info for regional labels
  const { data: clinic } = useQuery({
    queryKey: ["clinic", activeClinicId],
    queryFn: async () => {
      if (!activeClinicId) return null;
      const { data, error } = await supabase
        .from("clinics")
        .select("*")
        .eq("id", activeClinicId)
        .single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!activeClinicId,
  });

  const isUS = clinic?.country_code === 'US';
  const labelSSN = isUS ? t('patients.form.ssn') : t('patients.form.svn');
  const labelPostal = isUS ? t('patients.form.zipCode') : t('patients.form.postalCode');
  const labelState = isUS ? t('patients.form.stateUS') : t('patients.form.state');

  // Create/Update Mutation
  const saveMutation = useMutation({
    mutationFn: async (values: any) => {
      if (!activeClinicId) throw new Error(t('patients.messages.selectClinic'));
      
      const patientData = {
        clinic_id: activeClinicId,
        full_name: `${values.first_name} ${values.last_name}`,
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email || null,
        phone: values.phone || null,
        date_of_birth: values.date_of_birth || null,
        gender: values.gender || null,
        ssn_svn: values.ssn_svn || null,
        street: values.street || null,
        house_number: values.house_number || null,
        city: values.city || null,
        state_province: values.state_province || null,
        postal_code: values.postal_code || null,
        country: values.country || null,
        insurance_provider: values.insurance_provider || null,
        insurance_number: values.insurance_number || null,
        insurance_group: values.insurance_group || null,
        emergency_contact_name: values.emergency_contact_name || null,
        emergency_contact_phone: values.emergency_contact_phone || null,
        preferred_language: values.preferred_language || null,
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
      toast.success(editingPatient ? t('patients.messages.successUpdate') : t('patients.messages.successCreate'));
      setIsDialogOpen(false);
      reset();
      setEditingPatient(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "An error occurred.");
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
      toast.success(t('patients.messages.successDelete'));
    },
    onError: (error: any) => {
      toast.error(error.message || "Error deleting.");
    }
  });

  const onSubmit = (data: PatientFormValues) => {
    saveMutation.mutate(data);
  };

  const openEditDialog = (patient: Patient) => {
    setEditingPatient(patient);
    reset({
      first_name: patient.first_name || "",
      last_name: patient.last_name || "",
      email: patient.email || "",
      phone: patient.phone || "",
      date_of_birth: patient.date_of_birth || "",
      gender: patient.gender || "",
      ssn_svn: patient.ssn_svn || "",
      street: patient.street || "",
      house_number: patient.house_number || "",
      city: patient.city || "",
      state_province: patient.state_province || "",
      postal_code: patient.postal_code || "",
      country: patient.country || "",
      insurance_provider: patient.insurance_provider || "",
      insurance_number: patient.insurance_number || "",
      insurance_group: patient.insurance_group || "",
      emergency_contact_name: patient.emergency_contact_name || "",
      emergency_contact_phone: patient.emergency_contact_phone || "",
      preferred_language: patient.preferred_language || "de",
      notes: patient.notes || "",
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingPatient(null);
    reset({
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      date_of_birth: "",
      gender: "",
      ssn_svn: "",
      street: "",
      house_number: "",
      city: "",
      state_province: "",
      postal_code: "",
      country: "",
      insurance_provider: "",
      insurance_number: "",
      insurance_group: "",
      emergency_contact_name: "",
      emergency_contact_phone: "",
      preferred_language: "de",
      notes: "",
    });
    setIsDialogOpen(true);
  };

  if (!activeClinicId) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-slate-500">{t('patients.messages.selectClinic')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">{t('patients.title')}</h2>
          <p className="text-sm text-slate-500">{t('patients.subtitle')}</p>
        </div>
        <Button onClick={openCreateDialog} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-2 h-4 w-4" /> {t('patients.add')}
        </Button>
      </div>

      <div className="rounded-md border bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('patients.table.name')}</TableHead>
              <TableHead>{t('patients.table.contact')}</TableHead>
              <TableHead>{t('patients.table.dob')}</TableHead>
              <TableHead className="text-right">{t('patients.table.actions')}</TableHead>
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
                  {t('patients.messages.empty')}
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
                        if (confirm(t('patients.messages.confirmDelete'))) {
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
              <DialogTitle>{editingPatient ? t('patients.edit') : t('patients.create')}</DialogTitle>
              <DialogDescription>
                {t('patients.subtitle')}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4 max-h-[70vh] overflow-y-auto px-1">
              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 border-b pb-1">{t('patients.form.demographics')}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="first_name">{t('patients.form.firstName')} *</Label>
                    <Input id="first_name" {...register("first_name")} />
                    {errors.first_name && <p className="text-sm text-red-500">{errors.first_name.message}</p>}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="last_name">{t('patients.form.lastName')} *</Label>
                    <Input id="last_name" {...register("last_name")} />
                    {errors.last_name && <p className="text-sm text-red-500">{errors.last_name.message}</p>}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="date_of_birth">{t('patients.form.dob')}</Label>
                    <Input id="date_of_birth" type="date" {...register("date_of_birth")} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="ssn_svn">{labelSSN}</Label>
                    <Input id="ssn_svn" {...register("ssn_svn")} placeholder={isUS ? "000-00-0000" : "1234 010170"} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="gender">{t('patients.form.gender.label')}</Label>
                    <select 
                      id="gender" 
                      {...register("gender")}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="">{t('patients.form.gender.select')}</option>
                      <option value="male">{t('patients.form.gender.male')}</option>
                      <option value="female">{t('patients.form.gender.female')}</option>
                      <option value="other">{t('patients.form.gender.other')}</option>
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="preferred_language">{t('patients.form.language')}</Label>
                    <Input id="preferred_language" {...register("preferred_language")} />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 border-b pb-1">{t('patients.form.contactAddress')}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="email">{t('patients.form.email')}</Label>
                    <Input id="email" type="email" {...register("email")} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="phone">{t('patients.form.phone')}</Label>
                    <Input id="phone" {...register("phone")} />
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-3 grid gap-2">
                    <Label htmlFor="street">{t('patients.form.street')}</Label>
                    <Input id="street" {...register("street")} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="house_number">{t('patients.form.houseNumber')}</Label>
                    <Input id="house_number" {...register("house_number")} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="postal_code">{labelPostal}</Label>
                    <Input id="postal_code" {...register("postal_code")} />
                  </div>
                  <div className="col-span-2 grid gap-2">
                    <Label htmlFor="city">{t('patients.form.city')}</Label>
                    <Input id="city" {...register("city")} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="state_province">{labelState}</Label>
                    <Input id="state_province" {...register("state_province")} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="country">{t('patients.form.country')}</Label>
                    <Input id="country" {...register("country")} />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 border-b pb-1">{t('patients.form.insurance')}</h3>
                <div className="grid gap-2">
                  <Label htmlFor="insurance_provider">{t('patients.form.provider')}</Label>
                  <Input id="insurance_provider" {...register("insurance_provider")} placeholder={isUS ? "e.g. Blue Cross" : "e.g. ÖGK"} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="insurance_number">{t('patients.form.insuranceNumber')}</Label>
                    <Input id="insurance_number" {...register("insurance_number")} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="insurance_group">{t('patients.form.group')}</Label>
                    <Input id="insurance_group" {...register("insurance_group")} />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 border-b pb-1">{t('patients.form.emergency')}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="emergency_contact_name">{t('patients.form.contactPerson')}</Label>
                    <Input id="emergency_contact_name" {...register("emergency_contact_name")} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="emergency_contact_phone">{t('patients.form.phone')}</Label>
                    <Input id="emergency_contact_phone" {...register("emergency_contact_phone")} />
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 border-b pb-1">{t('patients.form.other')}</h3>
                <div className="grid gap-2">
                  <Label htmlFor="notes">{t('patients.form.notes')}</Label>
                  <Input id="notes" {...register("notes")} />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
