import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Pencil, Trash2, Loader2, Info } from "lucide-react";
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
  equipment_ids: z.array(z.string()).default([]),
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
      equipment_ids: [],
    }
  });

  const selectedEquipmentIds = watch("equipment_ids");

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
        if (values.equipment_ids.length > 0) {
          const junctionData = values.equipment_ids.map(eid => ({
            room_id: roomId,
            equipment_id: eid,
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
    const equipIds = room.room_equipment?.map((re: any) => re.equipment?.id).filter(Boolean) || [];
    reset({
      name: room.name,
      capacity: room.capacity,
      equipment_ids: equipIds,
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingRoom(null);
    reset({ name: "", capacity: 1, equipment_ids: [] });
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
                          <Badge key={re.equipment?.id} variant={re.equipment?.status === 'maintenance' ? 'warning' : 'secondary'} className="text-[10px] px-1.5 py-0">
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
        <DialogContent className="sm:max-w-[425px]">
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
                <div className="border rounded-md p-3 max-h-[200px] overflow-y-auto space-y-2 bg-slate-50/50">
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
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex items-center"
                        >
                          {item.name}
                          {item.status === 'maintenance' && (
                            <Badge variant="warning" className="ml-2 scale-75 origin-left">
                              {t('equipment.status.maintenance')}
                            </Badge>
                          )}
                        </label>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500 text-center py-4 italic">
                      {t('equipment.messages.empty')}
                    </p>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 flex items-center">
                  <Info className="h-3 w-3 mr-1" />
                  {t('rooms.form.equipmentPlaceholder')}
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
