import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Pencil, Trash2, Loader2, Wrench } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import type { TherapyType, Equipment } from "@/types";
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
import { Badge } from "@/components/ui/badge";

const therapyTypeSchema = (t: any) => z.object({
  name: z.string().min(1, t('common.required')),
  description: z.string().optional(),
  duration_minutes: z.coerce.number().min(5, t('common.required')),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, t('common.required')).optional(),
  equipment_ids: z.array(z.string()).default([]),
});

type TherapyTypeFormValues = z.infer<ReturnType<typeof therapyTypeSchema>>;

export default function TherapyTypesPage() {
  const { t } = useTranslation();
  const { activeClinicId } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<TherapyType | null>(null);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<TherapyTypeFormValues>({
    resolver: zodResolver(therapyTypeSchema(t)),
    defaultValues: {
      name: "",
      description: "",
      duration_minutes: 60,
      color: "#10b981",
      equipment_ids: [],
    }
  });

  const selectedEquipmentIds = watch("equipment_ids");

  // Fetch Therapy Types with Equipment
  const { data: therapyTypes, isLoading: isLoadingTypes } = useQuery({
    queryKey: ["therapyTypes", activeClinicId],
    queryFn: async () => {
      if (!activeClinicId) return [];
      const { data, error } = await supabase
        .from("therapy_types")
        .select(`
          *,
          therapy_type_equipment (
            equipment (*)
          )
        `)
        .eq("clinic_id", activeClinicId)
        .order("name");
      if (error) throw error;
      return data as any[];
    },
    enabled: !!activeClinicId,
  });

  // Fetch All Available Equipment
  const { data: equipmentList } = useQuery({
    queryKey: ["equipment", activeClinicId],
    queryFn: async () => {
      if (!activeClinicId) return [];
      const { data, error } = await supabase
        .from("equipment")
        .select("*")
        .eq("clinic_id", activeClinicId)
        .order("name");
      if (error) throw error;
      return data as Equipment[];
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

      let typeId = editingType?.id;

      if (editingType) {
        const { error } = await supabase
          .from("therapy_types")
          .update(therapyData)
          .eq("id", editingType.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("therapy_types")
          .insert([therapyData])
          .select()
          .single();
        if (error) throw error;
        typeId = data.id;
      }

      // Handle Equipment Junction
      if (typeId) {
        // Delete existing
        const { error: delError } = await supabase
          .from("therapy_type_equipment")
          .delete()
          .eq("therapy_type_id", typeId);
        if (delError) throw delError;

        // Insert new
        if (values.equipment_ids.length > 0) {
          const junctionData = values.equipment_ids.map(eid => ({
            therapy_type_id: typeId,
            equipment_id: eid,
          }));
          const { error: insError } = await supabase
            .from("therapy_type_equipment")
            .insert(junctionData);
          if (insError) throw insError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["therapyTypes"] });
      toast.success(editingType ? t('therapyTypes.messages.successUpdate') : t('therapyTypes.messages.successCreate'));
      setIsDialogOpen(false);
      reset();
      setEditingType(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "An error occurred.");
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
      toast.success(t('therapyTypes.messages.successDelete'));
    },
    onError: (error: any) => {
      toast.error(error.message || "Error deleting.");
    }
  });

  const onSubmit = (data: TherapyTypeFormValues) => {
    saveMutation.mutate(data);
  };

  const openEditDialog = (type: any) => {
    setEditingType(type);
    const equipIds = type.therapy_type_equipment?.map((te: any) => te.equipment?.id).filter(Boolean) || [];
    reset({
      name: type.name,
      description: type.description || "",
      duration_minutes: type.duration_minutes,
      color: type.color || "#10b981",
      equipment_ids: equipIds,
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingType(null);
    reset({ name: "", description: "", duration_minutes: 60, color: "#10b981", equipment_ids: [] });
    setIsDialogOpen(true);
  };

  const toggleEquipment = (id: string) => {
    const current = selectedEquipmentIds || [];
    if (current.includes(id)) {
      setValue("equipment_ids", current.filter(cid => cid !== id));
    } else {
      setValue("equipment_ids", [...current, id]);
    }
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
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">{t('therapyTypes.title')}</h2>
          <p className="text-sm text-slate-500">{t('therapyTypes.subtitle')}</p>
        </div>
        <Button onClick={openCreateDialog} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-2 h-4 w-4" /> {t('therapyTypes.add')}
        </Button>
      </div>

      <div className="rounded-md border bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('therapyTypes.table.color')}</TableHead>
              <TableHead>{t('therapyTypes.table.name')}</TableHead>
              <TableHead>{t('therapyTypes.table.duration')}</TableHead>
              <TableHead>{t('equipment.scheduling.required')}</TableHead>
              <TableHead className="text-right">{t('therapyTypes.table.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingTypes ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-300" />
                </TableCell>
              </TableRow>
            ) : therapyTypes?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-slate-500">
                  {t('therapyTypes.messages.empty')}
                </TableCell>
              </TableRow>
            ) : (
              therapyTypes?.map((type) => (
                <TableRow key={type.id}>
                  <TableCell>
                    <div className="h-6 w-6 rounded-md shadow-sm" style={{ backgroundColor: type.color }} />
                  </TableCell>
                  <TableCell className="font-medium text-slate-900">{type.name}</TableCell>
                  <TableCell>{type.duration_minutes} min</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {type.therapy_type_equipment && type.therapy_type_equipment.length > 0 ? (
                        type.therapy_type_equipment.map((te: any) => (
                          <Badge key={te.equipment?.id} variant="secondary" className="text-[10px] px-1.5 py-0">
                            <Wrench className="h-2.5 w-2.5 mr-1" />
                            {te.equipment?.name}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-slate-400 text-xs italic">{t('calendar.form.none')}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(type)}>
                      <Pencil className="h-4 w-4 text-slate-500" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                     onClick={() => {
                        if (confirm(t('therapyTypes.messages.confirmDelete'))) {
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
              <DialogTitle>{editingType ? t('therapyTypes.edit') : t('therapyTypes.create')}</DialogTitle>
              <DialogDescription>
                {t('therapyTypes.form.description')}
              </DialogDescription>
            </DialogHeader>
             <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">{t('therapyTypes.table.name')}</Label>
                <Input id="name" {...register("name")} placeholder={t('therapyTypes.form.namePlaceholder')} />
                {errors.name && <p className="text-sm text-red-500">{errors.name.message as string}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="duration_minutes">{t('therapyTypes.table.duration')}</Label>
                <Input id="duration_minutes" type="number" {...register("duration_minutes")} />
                {errors.duration_minutes && <p className="text-sm text-red-500">{errors.duration_minutes.message as string}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="color">{t('therapyTypes.table.color')} (Hex)</Label>
                <div className="flex gap-2">
                  <Input id="color" type="color" className="w-16 p-1 h-10" {...register("color")} />
                  <Input type="text" {...register("color")} placeholder="#10b981" className="flex-1" />
                </div>
                {errors.color && <p className="text-sm text-red-500">{errors.color.message as string}</p>}
              </div>
              
              <div className="grid gap-2">
                <Label>{t('equipment.scheduling.required')}</Label>
                <div className="border rounded-md p-3 max-h-[150px] overflow-y-auto space-y-2 bg-slate-50/50">
                  {equipmentList && equipmentList.length > 0 ? (
                    equipmentList.map((item) => (
                      <div key={item.id} className="flex items-center space-x-2">
                        <input 
                          type="checkbox"
                          id={`equip-${item.id}`}
                          checked={selectedEquipmentIds?.includes(item.id)}
                          onChange={() => toggleEquipment(item.id)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                        />
                        <label 
                          htmlFor={`equip-${item.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {item.name}
                        </label>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500 text-center py-4 italic">
                      {t('equipment.messages.empty')}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">{t('therapyTypes.table.description')}</Label>
                <Input id="description" {...register("description")} placeholder={t('therapyTypes.form.descriptionPlaceholder')} />
                {errors.description && <p className="text-sm text-red-500">{errors.description.message as string}</p>}
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
