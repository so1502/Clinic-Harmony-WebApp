import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import type {  Room  } from "@/types";
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

const roomSchema = (t: any) => z.object({
  name: z.string().min(1, t('common.required')),
  capacity: z.coerce.number().min(1, t('common.required')),
  equipment: z.string().optional(),
});

type RoomFormValues = z.infer<typeof roomSchema>;

export default function RoomsPage() {
  const { t } = useTranslation();
  const { activeClinicId } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<any>({
    resolver: zodResolver(roomSchema(t)),
    defaultValues: {
      name: "",
      capacity: 1,
      equipment: "",
    }
  });

  // Fetch Rooms
  const { data: rooms, isLoading } = useQuery({
    queryKey: ["rooms", activeClinicId],
    queryFn: async () => {
      if (!activeClinicId) return [];
      const { data, error } = await supabase
        .from("rooms")
        .select("*")
        .eq("clinic_id", activeClinicId)
        .order("name");
      if (error) throw error;
      return data as Room[];
    },
    enabled: !!activeClinicId,
  });

  // Create/Update Mutation
  const saveRoomMutation = useMutation({
    mutationFn: async (values: RoomFormValues) => {
      if (!activeClinicId) throw new Error("Keine Klinik ausgewählt");
      
      const equipmentArray = values.equipment 
        ? values.equipment.split(",").map(e => e.trim()).filter(Boolean) 
        : [];

      const roomData = {
        clinic_id: activeClinicId,
        name: values.name,
        capacity: values.capacity,
        equipment: equipmentArray,
      };

      if (editingRoom) {
        const { error } = await supabase
          .from("rooms")
          .update(roomData)
          .eq("id", editingRoom.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("rooms")
          .insert([roomData]);
        if (error) throw error;
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

  const openEditDialog = (room: Room) => {
    setEditingRoom(room);
    reset({
      name: room.name,
      capacity: room.capacity,
      equipment: room.equipment ? room.equipment.join(", ") : "",
    });
    setIsDialogOpen(true);
  };

  const openCreateDialog = () => {
    setEditingRoom(null);
    reset({ name: "", capacity: 1, equipment: "" });
    setIsDialogOpen(true);
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
            {isLoading ? (
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
                  <TableCell className="text-slate-500">
                    {room.equipment?.join(", ") || "-"}
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
                <Label htmlFor="equipment">{t('rooms.table.equipment')}</Label>
                <Input id="equipment" {...register("equipment")} placeholder={t('rooms.form.equipmentPlaceholder')} />
                {errors.equipment && <p className="text-sm text-red-500">{errors.equipment.message as string}</p>}
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
