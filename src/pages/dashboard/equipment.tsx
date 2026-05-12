import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Pencil, Trash2, Loader2, Wrench, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import type { Equipment } from "@/types";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const equipmentSchema = (t: any) => z.object({
  name: z.string().min(1, t('common.required')),
  description: z.string().optional(),
  status: z.enum(['active', 'maintenance']),
});

type EquipmentFormValues = z.infer<ReturnType<typeof equipmentSchema>>;

export default function EquipmentPage() {
  const { t } = useTranslation();
  const { activeClinicId } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<EquipmentFormValues>({
    resolver: zodResolver(equipmentSchema(t)),
    defaultValues: {
      name: "",
      description: "",
      status: "active",
    }
  });

  const statusValue = watch("status");

  // Fetch Equipment
  const { data: equipment, isLoading } = useQuery({
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
    mutationFn: async (values: EquipmentFormValues) => {
      if (!activeClinicId) throw new Error("Keine Klinik ausgewählt");
      
      const equipData = {
        clinic_id: activeClinicId,
        ...values,
      };

      if (editingEquipment) {
        const { error } = await supabase
          .from("equipment")
          .update(equipData)
          .eq("id", editingEquipment.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("equipment")
          .insert([equipData]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      toast.success(editingEquipment ? t('equipment.messages.successUpdate') : t('equipment.messages.successCreate'));
      setIsDialogOpen(false);
      reset();
      setEditingEquipment(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "An error occurred.");
    }
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("equipment").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["equipment"] });
      toast.success(t('equipment.messages.successDelete'));
    },
    onError: (error: any) => {
      toast.error(error.message || "Error deleting.");
    }
  });

  const onSubmit = (data: EquipmentFormValues) => {
    saveMutation.mutate(data);
  };

  const openEditDialog = (item: Equipment) => {
    setEditingEquipment(item);
    reset({
      name: item.name,
      description: item.description || "",
      status: item.status,
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingEquipment(null);
    reset({ name: "", description: "", status: "active" });
    setIsDialogOpen(true);
  };

  if (!activeClinicId) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-slate-500">{t('equipment.messages.selectClinic')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">{t('equipment.title')}</h2>
          <p className="text-sm text-slate-500">{t('equipment.subtitle')}</p>
        </div>
        <Button onClick={openCreateDialog} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-2 h-4 w-4" /> {t('equipment.add')}
        </Button>
      </div>

      <div className="rounded-md border bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('equipment.table.name')}</TableHead>
              <TableHead>{t('equipment.table.description')}</TableHead>
              <TableHead>{t('equipment.table.status')}</TableHead>
              <TableHead className="text-right">{t('equipment.table.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-300" />
                </TableCell>
              </TableRow>
            ) : equipment?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-slate-500">
                  {t('equipment.messages.empty')}
                </TableCell>
              </TableRow>
            ) : (
              equipment?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-slate-900">{item.name}</TableCell>
                  <TableCell className="max-w-xs truncate text-slate-500">
                    {item.description || "-"}
                  </TableCell>
                  <TableCell>
                    {item.status === 'active' ? (
                      <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-none">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        {t('equipment.status.active')}
                      </Badge>
                    ) : (
                      <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-100 border-none">
                        <AlertTriangle className="mr-1 h-3 w-3" />
                        {t('equipment.status.maintenance')}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(item)}>
                      <Pencil className="h-4 w-4 text-slate-500" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => {
                        if (confirm(t('equipment.messages.confirmDelete'))) {
                          deleteMutation.mutate(item.id);
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
              <DialogTitle>{editingEquipment ? t('equipment.edit') : t('equipment.create')}</DialogTitle>
              <DialogDescription>
                {t('equipment.form.description')}
              </DialogDescription>
            </DialogHeader>
             <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">{t('equipment.form.name')}</Label>
                <Input id="name" {...register("name")} placeholder={t('equipment.form.namePlaceholder')} />
                {errors.name && <p className="text-sm text-red-500">{errors.name.message as string}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="status">{t('equipment.form.status')}</Label>
                <Select value={statusValue} onValueChange={(val: any) => setValue("status", val)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Status wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{t('equipment.status.active')}</SelectItem>
                    <SelectItem value="maintenance">{t('equipment.status.maintenance')}</SelectItem>
                  </SelectContent>
                </Select>
                {errors.status && <p className="text-sm text-red-500">{errors.status.message as string}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">{t('equipment.form.description')}</Label>
                <Textarea 
                  id="description" 
                  {...register("description")} 
                  placeholder={t('equipment.form.descriptionPlaceholder')}
                  className="resize-none"
                  rows={3}
                />
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
