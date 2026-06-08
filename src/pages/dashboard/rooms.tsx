import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Pencil, Trash2, Loader2, Info, Wrench } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import type { Room, Equipment } from "@/types";
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

const roomSchema = (t: any) => z.object({
  name: z.string().min(1, t('common.required')),
  capacity: z.coerce.number().min(1, t('common.required')),
  equipment: z.array(z.object({
    id: z.string(),
    status: z.enum(['active', 'maintenance'])
  })).default([]),
});

type RoomFormValues = z.infer<ReturnType<typeof roomSchema>>;

export default function RoomsPage() {
  const { t } = useTranslation();
  const { activeClinicId } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  const { register, handleSubmit, reset, setValue, watch, formState: { errors, isSubmitting } } = useForm<RoomFormValues>({
    resolver: zodResolver(roomSchema(t)),
    defaultValues: {
      name: "",
      capacity: 1,
      equipment: [],
    }
  });

  const selectedEquipment = watch("equipment");

  // Fetch Rooms with Equipment
  const { data: rooms, isLoading: isLoadingRooms } = useQuery({
    queryKey: ["rooms", activeClinicId],
    queryFn: async () => {
      if (!activeClinicId) return [];
      const { data, error } = await supabase
        .from("rooms")
        .select(`
          *,
          room_equipment (
            equipment_id,
            status,
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
  const saveRoomMutation = useMutation({
    mutationFn: async (values: RoomFormValues) => {
      if (!activeClinicId) throw new Error("Keine Klinik ausgewählt");
      
      const roomData = {
        clinic_id: activeClinicId,
        name: values.name,
        capacity: values.capacity,
      };

      let roomId = editingRoom?.id;

      if (editingRoom) {
        const { error } = await supabase
          .from("rooms")
          .update(roomData)
          .eq("id", editingRoom.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("rooms")
          .insert([roomData])
          .select()
          .single();
        if (error) throw error;
        roomId = data.id;
      }

      // Handle Equipment Junction
      if (roomId) {
        // Delete existing
        const { error: delError } = await supabase
          .from("room_equipment")
          .delete()
          .eq("room_id", roomId);
        if (delError) throw delError;

        // Insert new
        if (values.equipment.length > 0) {
          const junctionData = values.equipment.map(e => ({
            room_id: roomId,
            equipment_id: e.id,
            status: e.status
          }));
          const { error: insError } = await supabase
            .from("room_equipment")
            .insert(junctionData);
          if (insError) throw insError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      toast.success(editingRoom ? t('rooms.messages.successUpdate') : t('rooms.messages.successCreate'));
      setIsDialogOpen(false);
      reset();
      setEditingRoom(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "An error occurred.");
    }
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rooms").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      toast.success(t('rooms.messages.successDelete'));
    },
    onError: (error: any) => {
      toast.error(error.message || "Error deleting.");
    }
  });

  const onSubmit = (data: RoomFormValues) => {
    saveRoomMutation.mutate(data);
  };

  const openEditDialog = (room: any) => {
    setEditingRoom(room);
    const equip = room.room_equipment?.map((re: any) => ({
      id: re.equipment?.id,
      status: re.status || 'active'
    })).filter((e: any) => Boolean(e.id)) || [];
    
    reset({
      name: room.name,
      capacity: room.capacity,
      equipment: equip,
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingRoom(null);
    reset({ name: "", capacity: 1, equipment: [] });
    setIsDialogOpen(true);
  };

  const toggleEquipment = (id: string) => {
    const current = selectedEquipment || [];
    const exists = current.find(e => e.id === id);
    if (exists) {
      setValue("equipment", current.filter(e => e.id !== id));
    } else {
      setValue("equipment", [...current, { id, status: 'active' }]);
    }
  };

  const toggleEquipmentStatus = (id: string) => {
    const current = selectedEquipment || [];
    setValue("equipment", current.map(e => {
      if (e.id === id) {
        return { ...e, status: e.status === 'active' ? 'maintenance' : 'active' };
      }
      return e;
    }));
  };

  if (!activeClinicId) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-slate-500">{t('rooms.messages.selectClinic')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">{t('rooms.title')}</h2>
          <p className="text-sm text-slate-500">{t('rooms.subtitle')}</p>
        </div>
        <Button onClick={openCreateDialog} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-2 h-4 w-4" /> {t('rooms.add')}
        </Button>
      </div>

      <div className="rounded-md border bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('rooms.table.name')}</TableHead>
              <TableHead>{t('rooms.table.capacity')}</TableHead>
              <TableHead>{t('rooms.table.equipment')}</TableHead>
              <TableHead className="text-right">{t('rooms.table.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingRooms ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-300" />
                </TableCell>
              </TableRow>
            ) : rooms?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-slate-500">
                  {t('rooms.messages.empty')}
                </TableCell>
              </TableRow>
            ) : (
              rooms?.map((room) => (
                <TableRow key={room.id}>
                  <TableCell className="font-medium text-slate-900">{room.name}</TableCell>
                  <TableCell>{room.capacity}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {room.room_equipment && room.room_equipment.length > 0 ? (
                        room.room_equipment.map((re: any) => (
                          <Badge key={re.equipment?.id} variant={re.status === 'maintenance' ? 'warning' : 'secondary'} className="text-[10px] px-1.5 py-0">
                            {re.equipment?.name}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-slate-400 text-xs">-</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(room)}>
                      <Pencil className="h-4 w-4 text-slate-500" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                     onClick={() => {
                        if (confirm(t('rooms.messages.confirmDelete'))) {
                          deleteMutation.mutate(room.id);
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
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSubmit(onSubmit)}>
            <DialogHeader>
              <DialogTitle>{editingRoom ? t('rooms.edit') : t('rooms.create')}</DialogTitle>
              <DialogDescription>
                {t('rooms.form.description')}
              </DialogDescription>
            </DialogHeader>
             <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">{t('rooms.table.name')}</Label>
                <Input id="name" {...register("name")} placeholder={t('rooms.form.namePlaceholder')} />
                {errors.name && <p className="text-sm text-red-500">{errors.name.message as string}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="capacity">{t('rooms.table.capacity')}</Label>
                <Input id="capacity" type="number" {...register("capacity")} />
                {errors.capacity && <p className="text-sm text-red-500">{errors.capacity.message as string}</p>}
              </div>
              
              <div className="grid gap-2">
                <Label>{t('rooms.table.equipment')}</Label>
                <div className="border rounded-md p-3 max-h-[250px] overflow-y-auto space-y-3 bg-slate-50/50">
                  {equipmentList && equipmentList.length > 0 ? (
                    equipmentList.map((item) => {
                      const isSelected = selectedEquipment?.find(e => e.id === item.id);
                      return (
                        <div key={item.id} className="flex items-center justify-between space-x-2 pb-2 border-b border-slate-100 last:border-0 last:pb-0">
                          <div className="flex items-center space-x-2">
                            <input 
                              type="checkbox"
                              id={`equip-${item.id}`}
                              checked={!!isSelected}
                              onChange={() => toggleEquipment(item.id)}
                              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                            />
                            <label 
                              htmlFor={`equip-${item.id}`}
                              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex flex-col"
                            >
                              <span>{item.name}</span>
                              {item.status === 'maintenance' && !isSelected && (
                                <span className="text-[10px] text-orange-500 mt-1 flex items-center">
                                  <Wrench className="h-3 w-3 mr-1" />
                                  Global Maintenance
                                </span>
                              )}
                            </label>
                          </div>
                          {isSelected && (
                            <Button 
                              type="button" 
                              variant="outline"
                              size="sm"
                              className={`h-7 text-[10px] px-2 border transition-colors ${
                                isSelected.status === 'maintenance' 
                                  ? 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100' 
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              }`}
                              onClick={() => toggleEquipmentStatus(item.id)}
                            >
                              <Wrench className={`h-3 w-3 mr-1 ${isSelected.status === 'maintenance' ? 'text-orange-500' : 'text-emerald-500'}`} />
                              {isSelected.status === 'maintenance' ? t('equipment.status.maintenance') : t('equipment.status.active')}
                            </Button>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    <p className="text-xs text-slate-500 text-center py-4 italic">
                      {t('equipment.messages.empty')}
                    </p>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 flex items-center mt-1">
                  <Info className="h-3 w-3 mr-1" />
                  Klicke auf den Status-Button, um ein Gerät in diesem Raum als defekt zu markieren.
                </p>
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
