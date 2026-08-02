import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format } from "date-fns";
import { Plus, Pencil, Trash2, Loader2, Search, X, UserX, UserCheck, Archive } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import type { Patient } from "@/types";
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
  is_active: z.boolean().default(true),
});

type PatientFormValues = z.infer<typeof patientSchema>;

export default function PatientsPage() {
  const { t } = useTranslation();
  const { activeClinicId } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  
  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "discharged">("active");

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<any>({
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
      is_active: true,
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
      
      const is_active = values.is_active !== undefined ? values.is_active : true;
      const status = is_active ? "active" : "discharged";

      const patientData: any = {
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
        is_active: is_active,
        status: status,
      };

      let res = editingPatient
        ? await supabase.from("patients").update(patientData).eq("id", editingPatient.id)
        : await supabase.from("patients").insert([patientData]);

      if (res.error && res.error.message?.includes("is_active")) {
        // Fallback if is_active column is not yet added in Supabase DB
        delete patientData.is_active;
        delete patientData.status;
        res = editingPatient
          ? await supabase.from("patients").update(patientData).eq("id", editingPatient.id)
          : await supabase.from("patients").insert([patientData]);
        if (res.error) throw res.error;
      } else if (res.error) {
        throw res.error;
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

  // Toggle Discharge / Active Status Mutation
  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: boolean }) => {
      const { error } = await supabase
        .from("patients")
        .update({
          is_active: newStatus,
          status: newStatus ? "active" : "discharged"
        })
        .eq("id", id);

      if (error && error.message?.includes("is_active")) {
        throw new Error("Bitte führen Sie die SQL-Migration in Supabase aus (Spalte 'is_active' fehlt in Supabase Tabelle 'patients').");
      } else if (error) {
        throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["patients"] });
      if (variables.newStatus) {
        toast.success(t('patients.messages.successReactivate'));
      } else {
        toast.success(t('patients.messages.successDischarge'));
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Status update failed.");
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
    const isActive = patient.is_active !== undefined ? Boolean(patient.is_active) : (patient.status !== "discharged" && patient.status !== "inactive");
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
      is_active: isActive,
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
      is_active: true,
    });
    setIsDialogOpen(true);
  };

  // Filtered patients list based on search query and status tab
  const filteredPatients = patients?.filter((patient) => {
    const isInactive = patient.is_active === false || patient.status === "discharged" || patient.status === "inactive";
    
    // Status filter
    if (statusFilter === "active" && isInactive) return false;
    if (statusFilter === "discharged" && !isInactive) return false;

    // Search query filter
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      patient.full_name?.toLowerCase().includes(q) ||
      patient.first_name?.toLowerCase().includes(q) ||
      patient.last_name?.toLowerCase().includes(q) ||
      patient.email?.toLowerCase().includes(q) ||
      patient.phone?.toLowerCase().includes(q) ||
      patient.ssn_svn?.toLowerCase().includes(q) ||
      patient.insurance_provider?.toLowerCase().includes(q) ||
      patient.insurance_number?.toLowerCase().includes(q) ||
      patient.city?.toLowerCase().includes(q)
    );
  });

  if (!activeClinicId) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-slate-500">{t('patients.messages.selectClinic')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">{t('patients.title')}</h2>
          <p className="text-sm text-slate-500">{t('patients.subtitle')}</p>
        </div>
        <Button onClick={openCreateDialog} className="bg-blue-600 hover:bg-blue-700 self-start sm:self-auto">
          <Plus className="mr-2 h-4 w-4" /> {t('patients.add')}
        </Button>
      </div>

      {/* Search and Status Filter Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-lg border shadow-sm">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('patients.searchPlaceholder')}
            className="pl-9 pr-9"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-md text-sm font-medium text-slate-600">
          <button
            onClick={() => setStatusFilter("active")}
            className={`px-3 py-1.5 rounded-sm transition-colors ${
              statusFilter === "active" ? "bg-white text-slate-900 shadow-sm" : "hover:text-slate-900"
            }`}
          >
            {t('patients.filter.active')}
          </button>
          <button
            onClick={() => setStatusFilter("discharged")}
            className={`px-3 py-1.5 rounded-sm transition-colors ${
              statusFilter === "discharged" ? "bg-white text-slate-900 shadow-sm" : "hover:text-slate-900"
            }`}
          >
            {t('patients.filter.discharged')}
          </button>
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-3 py-1.5 rounded-sm transition-colors ${
              statusFilter === "all" ? "bg-white text-slate-900 shadow-sm" : "hover:text-slate-900"
            }`}
          >
            {t('patients.filter.all')}
          </button>
        </div>
      </div>

      {/* Patient Table */}
      <div className="rounded-md border bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead>{t('patients.table.name')}</TableHead>
              <TableHead>{t('patients.table.contact')}</TableHead>
              <TableHead>{t('patients.table.dob')}</TableHead>
              <TableHead>{t('patients.table.status')}</TableHead>
              <TableHead className="text-right">{t('patients.table.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-300" />
                </TableCell>
              </TableRow>
            ) : filteredPatients?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-slate-500">
                  {t('patients.messages.empty')}
                </TableCell>
              </TableRow>
            ) : (
              filteredPatients?.map((patient) => {
                const isDischarged = patient.is_active === false || patient.status === "discharged" || patient.status === "inactive";
                return (
                  <TableRow 
                    key={patient.id}
                    className={isDischarged ? "bg-slate-50/60 opacity-60" : ""}
                  >
                    <TableCell className="font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        <span className={isDischarged ? "line-through text-slate-500" : ""}>
                          {patient.full_name}
                        </span>
                        {patient.ssn_svn && (
                          <span className="text-xs text-slate-400 font-normal">
                            ({patient.ssn_svn})
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-500">
                      <div>{patient.email || "-"}</div>
                      <div>{patient.phone || "-"}</div>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {patient.date_of_birth ? format(new Date(patient.date_of_birth), "dd.MM.yyyy") : "-"}
                    </TableCell>
                    <TableCell>
                      {isDischarged ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-700">
                          <Archive className="h-3 w-3" />
                          {t('patients.status.discharged')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                          {t('patients.status.active')}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end space-x-1">
                        {/* Toggle Discharge / Reactivate Button */}
                        {isDischarged ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            title={t('patients.status.reactivate')}
                            onClick={() => {
                              if (confirm(t('patients.messages.confirmReactivate'))) {
                                toggleStatusMutation.mutate({ id: patient.id, newStatus: true });
                              }
                            }}
                          >
                            <UserCheck className="h-4 w-4 mr-1" />
                            <span className="hidden md:inline">{t('patients.status.reactivate')}</span>
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            title={t('patients.status.discharge')}
                            onClick={() => {
                              if (confirm(t('patients.messages.confirmDischarge'))) {
                                toggleStatusMutation.mutate({ id: patient.id, newStatus: false });
                              }
                            }}
                          >
                            <UserX className="h-4 w-4 mr-1" />
                            <span className="hidden md:inline">{t('patients.status.discharge')}</span>
                          </Button>
                        )}

                        {/* Edit Button */}
                        <Button variant="ghost" size="icon" onClick={() => openEditDialog(patient)} title={t('common.edit')}>
                          <Pencil className="h-4 w-4 text-slate-500" />
                        </Button>

                        {/* Delete Button */}
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          title={t('common.delete')}
                          onClick={() => {
                            if (confirm(t('patients.messages.confirmDelete'))) {
                              deleteMutation.mutate(patient.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Spacious / Wider Patient Form Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[850px] max-w-[95vw] max-h-[90vh] flex flex-col">
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
            <DialogHeader className="border-b pb-4">
              <DialogTitle className="text-xl font-bold">
                {editingPatient ? t('patients.edit') : t('patients.create')}
              </DialogTitle>
              <DialogDescription>
                {t('patients.form.description')}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto py-6 px-1 space-y-6">
              {/* Section 1: Stammdaten */}
              <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-600"></span>
                  {t('patients.form.demographics')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="first_name">{t('patients.form.firstName')} *</Label>
                    <Input id="first_name" {...register("first_name")} />
                    {errors.first_name && <p className="text-xs text-red-500">{errors.first_name.message?.toString()}</p>}
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="last_name">{t('patients.form.lastName')} *</Label>
                    <Input id="last_name" {...register("last_name")} />
                    {errors.last_name && <p className="text-xs text-red-500">{errors.last_name.message?.toString()}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="date_of_birth">{t('patients.form.dob')}</Label>
                    <Input id="date_of_birth" type="date" {...register("date_of_birth")} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="ssn_svn">{labelSSN}</Label>
                    <Input id="ssn_svn" {...register("ssn_svn")} placeholder={isUS ? "000-00-0000" : "1234 010170"} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="gender">{t('patients.form.gender.label')}</Label>
                    <select 
                      id="gender" 
                      {...register("gender")}
                      className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="">{t('patients.form.gender.select')}</option>
                      <option value="male">{t('patients.form.gender.male')}</option>
                      <option value="female">{t('patients.form.gender.female')}</option>
                      <option value="other">{t('patients.form.gender.other')}</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="preferred_language">{t('patients.form.language')}</Label>
                    <Input id="preferred_language" {...register("preferred_language")} placeholder="de / en" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="is_active">{t('patients.form.status')}</Label>
                    <select 
                      id="is_active" 
                      value={watch("is_active") ? "true" : "false"}
                      onChange={(e) => setValue("is_active", e.target.value === "true")}
                      className="flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      <option value="true">{t('patients.status.active')}</option>
                      <option value="false">{t('patients.status.discharged')}</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Section 2: Kontakt & Adresse */}
              <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-600"></span>
                  {t('patients.form.contactAddress')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="email">{t('patients.form.email')}</Label>
                    <Input id="email" type="email" {...register("email")} placeholder="name@beispiel.de" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="phone">{t('patients.form.phone')}</Label>
                    <Input id="phone" {...register("phone")} placeholder="+43 660 123456" />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-3 grid gap-2">
                    <Label htmlFor="street">{t('patients.form.street')}</Label>
                    <Input id="street" {...register("street")} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="house_number">{t('patients.form.houseNumber')}</Label>
                    <Input id="house_number" {...register("house_number")} />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="postal_code">{labelPostal}</Label>
                    <Input id="postal_code" {...register("postal_code")} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="city">{t('patients.form.city')}</Label>
                    <Input id="city" {...register("city")} />
                  </div>
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

              {/* Section 3: Versicherung */}
              <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-600"></span>
                  {t('patients.form.insurance')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="insurance_provider">{t('patients.form.provider')}</Label>
                    <Input id="insurance_provider" {...register("insurance_provider")} placeholder={isUS ? "e.g. Blue Cross" : "e.g. ÖGK / SVS"} />
                  </div>
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

              {/* Section 4: Notfallkontakt & Notizen */}
              <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80 space-y-4">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-blue-600"></span>
                  {t('patients.form.emergency')} & {t('patients.form.other')}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="emergency_contact_name">{t('patients.form.contactPerson')}</Label>
                    <Input id="emergency_contact_name" {...register("emergency_contact_name")} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="emergency_contact_phone">{t('patients.form.contactPhone')}</Label>
                    <Input id="emergency_contact_phone" {...register("emergency_contact_phone")} />
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="notes">{t('patients.form.notes')}</Label>
                  <Input id="notes" {...register("notes")} placeholder="Zusätzliche Notizen zum Patienten..." />
                </div>
              </div>
            </div>

            <DialogFooter className="pt-4 border-t mt-2">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-700">
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
