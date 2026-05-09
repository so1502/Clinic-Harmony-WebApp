import { useState } from "react";
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

const roomSchema = z.object({
  name: z.string().min(1, "Name ist erforderlich"),
  capacity: z.coerce.number().min(1, "Kapazität muss mindestens 1 sein"),
  equipment: z.string().optional(),
});

type RoomFormValues = z.infer<typeof roomSchema>;

export default function RoomsPage() {
  const { activeClinicId } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<RoomFormValues>({
    resolver: zodResolver(roomSchema),
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
      toast.success(editingRoom ? "Raum aktualisiert!" : "Raum erstellt!");
      setIsDialogOpen(false);
      reset();
      setEditingRoom(null);
    },
    onError: (error: any) => {
      toast.error(error.message || "Ein Fehler ist aufgetreten.");
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
      toast.success("Raum gelöscht!");
    },
    onError: (error: any) => {
      toast.error(error.message || "Fehler beim Löschen.");
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
        <p className="text-slate-500">Bitte wählen Sie eine Klinik aus oder erstellen Sie eine, um Räume zu verwalten.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Räume</h2>
          <p className="text-sm text-slate-500">Verwalten Sie die verfügbaren Räume Ihrer Klinik.</p>
        </div>
        <Button onClick={openCreateDialog} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="mr-2 h-4 w-4" /> Raum hinzufügen
        </Button>
      </div>

      <div className="rounded-md border bg-white shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Kapazität</TableHead>
              <TableHead>Ausstattung</TableHead>
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
            ) : rooms?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-slate-500">
                  Keine Räume gefunden.
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
                        if (confirm("Wirklich löschen?")) {
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
              <DialogTitle>{editingRoom ? "Raum bearbeiten" : "Neuen Raum erstellen"}</DialogTitle>
              <DialogDescription>
                Geben Sie die Details des Raums ein. Klicken Sie auf Speichern, wenn Sie fertig sind.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Raumname</Label>
                <Input id="name" {...register("name")} placeholder="z.B. Behandlungsraum 1" />
                {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="capacity">Kapazität (Personen)</Label>
                <Input id="capacity" type="number" {...register("capacity")} />
                {errors.capacity && <p className="text-sm text-red-500">{errors.capacity.message}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="equipment">Ausstattung (kommagetrennt)</Label>
                <Input id="equipment" {...register("equipment")} placeholder="z.B. Liege, Ultraschall" />
                {errors.equipment && <p className="text-sm text-red-500">{errors.equipment.message}</p>}
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
