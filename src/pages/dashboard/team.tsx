import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Plus, Pencil, Trash2, Loader2, UserPlus, Mail, ShieldCheck } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import type { UserRole } from "@/types";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const inviteSchema = (t: any) => z.object({
  email: z.string().email(t('auth.login.error')),
  role: z.enum(["clinic_admin", "therapist", "receptionist", "viewer"]),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

export default function TeamPage() {
  const { t } = useTranslation();
  const { user, activeClinicId } = useAuth();
  const queryClient = useQueryClient();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<any>(null);

  const { register, handleSubmit, control, reset, formState: { errors } } = useForm<any>({
    resolver: zodResolver(inviteSchema(t)),
    defaultValues: {
      email: "",
      role: "therapist",
    }
  });

  const editForm = useForm<{ role: UserRole }>({
    defaultValues: {
      role: "therapist",
    }
  });

  // Fetch Team Members (Profiles + Roles)
  const { data: members, isLoading: isMembersLoading } = useQuery({
    queryKey: ["team-members", activeClinicId],
    queryFn: async () => {
      if (!activeClinicId) return [];
      
      const { data, error } = await supabase
        .from("profiles")
        .select(`
          id,
          full_name,
          email,
          user_roles ( role )
        `)
        .eq("clinic_id", activeClinicId);
        
      if (error) throw error;
      return data;
    },
    enabled: !!activeClinicId,
  });

  // Fetch Pending Invitations
  const { data: invitations, isLoading: isInvitesLoading } = useQuery({
    queryKey: ["invitations", activeClinicId],
    queryFn: async () => {
      if (!activeClinicId) return [];
      const { data, error } = await supabase
        .from("invitations")
        .select("*")
        .eq("clinic_id", activeClinicId)
        .eq("is_consumed", false);
      if (error) throw error;
      return data;
    },
    enabled: !!activeClinicId,
  });

  // Invite Mutation
  const inviteMutation = useMutation({
    mutationFn: async (values: InviteFormValues) => {
      if (!activeClinicId) throw new Error(t('patients.messages.selectClinic'));
      
      const { error } = await supabase
        .from("invitations")
        .insert({
          email: values.email,
          clinic_id: activeClinicId,
          role: values.role,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
      toast.success(t('team.messages.successInvite'));
      setIsInviteOpen(false);
      reset();
    },
    onError: (error: any) => {
      toast.error(error.message || "Error.");
    }
  });

  // Update Role Mutation
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string, newRole: UserRole }) => {
      // First delete existing roles for this user
      const { error: deleteError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);
        
      if (deleteError) throw deleteError;
      
      // Insert the new role
      const { error: insertError } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role: newRole });
        
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      toast.success(t('team.messages.successUpdate'));
      setIsEditOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Error updating role.");
    }
  });

  // Delete Member Mutation
  const deleteMemberMutation = useMutation({
    mutationFn: async (userId: string) => {
      // 1. Set clinic_id to null in profiles
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ clinic_id: null })
        .eq("id", userId);
      if (profileError) throw profileError;

      // 2. Delete roles
      const { error: rolesError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId);
      if (rolesError) throw rolesError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      toast.success(t('team.messages.successRemove'));
    },
    onError: (error: any) => {
      toast.error(error.message || "Error removing member.");
    }
  });

  // Delete Invitation Mutation
  const deleteInviteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invitations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
      toast.success(t('team.messages.successRevoke'));
    }
  });

  const onInviteSubmit = (data: InviteFormValues) => {
    inviteMutation.mutate(data);
  };

  const onEditSubmit = (data: { role: UserRole }) => {
    if (!editingMember) return;
    updateRoleMutation.mutate({ userId: editingMember.id, newRole: data.role });
  };

  const openEditDialog = (member: any) => {
    setEditingMember(member);
    editForm.setValue("role", member.user_roles?.[0]?.role || "therapist");
    setIsEditOpen(true);
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
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">{t('team.title')}</h2>
          <p className="text-sm text-slate-500">{t('team.subtitle')}</p>
        </div>
        <Button onClick={() => setIsInviteOpen(true)} className="bg-blue-600 hover:bg-blue-700">
          <UserPlus className="mr-2 h-4 w-4" /> {t('team.add')}
        </Button>
      </div>

      <Tabs defaultValue="members" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="members">{t('team.tabs.members')}</TabsTrigger>
          <TabsTrigger value="invites">{t('team.tabs.invites')}</TabsTrigger>
        </TabsList>
        
        <TabsContent value="members">
          <div className="rounded-md border bg-white shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>{t('team.table.name')}</TableHead>
                  <TableHead>{t('team.table.email')}</TableHead>
                  <TableHead>{t('team.table.role')}</TableHead>
                  <TableHead className="text-right">{t('team.table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isMembersLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-300" />
                    </TableCell>
                  </TableRow>
                ) : members?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-slate-500">
                      {t('team.messages.emptyMembers')}
                    </TableCell>
                  </TableRow>
                ) : (
                  members?.map((member: any) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
                            {member.full_name?.charAt(0) || "U"}
                          </div>
                          {member.full_name || t('common.unknown')}
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600">{member.email}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800 border border-slate-200 capitalize">
                          <ShieldCheck className="w-3 h-3 text-blue-500" />
                          {t(`roles.${member.user_roles?.[0]?.role || 'none'}`)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-slate-600 hover:text-blue-600"
                             onClick={() => openEditDialog(member)}
                            disabled={member.id === user?.id} // Cannot edit own role to prevent lockout
                          >
                            <Pencil className="h-4 w-4 mr-1" /> {t('common.edit')}
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-slate-400 hover:text-red-600"
                             onClick={() => {
                              if (confirm(t('team.messages.confirmRemove', { name: member.full_name || member.email }))) {
                                deleteMemberMutation.mutate(member.id);
                              }
                            }}
                            disabled={member.id === user?.id} // Cannot remove yourself
                          >
                            <Trash2 className="h-4 w-4 mr-1" /> {t('common.delete')}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="invites">
          <div className="rounded-md border bg-white shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>{t('team.table.email')}</TableHead>
                  <TableHead>{t('team.table.role')}</TableHead>
                  <TableHead>{t('team.table.date')}</TableHead>
                  <TableHead className="text-right">{t('team.table.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isInvitesLoading ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-slate-300" />
                    </TableCell>
                  </TableRow>
                ) : invitations?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-slate-500 italic py-8">
                      {t('team.messages.emptyInvites')}
                    </TableCell>
                  </TableRow>
                ) : (
                  invitations?.map((invite: any) => (
                    <TableRow key={invite.id}>
                      <TableCell className="font-medium text-slate-900 flex items-center gap-2">
                        <Mail className="w-4 h-4 text-slate-400" />
                        {invite.email}
                      </TableCell>
                      <TableCell>
                        <span className="capitalize text-sm bg-blue-50 text-blue-700 px-2 py-1 rounded border border-blue-100">
                          {t(`roles.${invite.role}`)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-slate-500">
                        {new Date(invite.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                           className="text-red-500 hover:bg-red-50"
                          onClick={() => {
                            if (confirm(t('team.messages.confirmRevoke'))) {
                              deleteInviteMutation.mutate(invite.id);
                            }
                          }}
                        >
                          {t('common.delete')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Invite Dialog */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={handleSubmit(onInviteSubmit)}>
             <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-600" />
                {t('team.add')}
              </DialogTitle>
              <DialogDescription>
                {t('team.form.inviteDescription')}
              </DialogDescription>
            </DialogHeader>
            
             <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="email">{t('team.form.email')}</Label>
                <Input id="email" {...register("email")} placeholder={t('team.form.placeholderEmail')} />
                {errors.email && <p className="text-xs text-red-500">{errors.email?.message as string}</p>}
              </div>
              
               <div className="grid gap-2">
                <Label htmlFor="role">{t('team.form.role')}</Label>
                <Controller
                  name="role"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {field.value ? t(`roles.${field.value}`) : t('team.form.roleSelect') || 'Select Role'}
                        </SelectValue>
                      </SelectTrigger>
                       <SelectContent>
                        <SelectItem value="therapist">{t('roles.therapist')}</SelectItem>
                        <SelectItem value="receptionist">{t('roles.receptionist')}</SelectItem>
                        <SelectItem value="viewer">{t('roles.viewer')}</SelectItem>
                        <SelectItem value="clinic_admin">{t('roles.clinic_admin')}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

             <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsInviteOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={inviteMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
                {inviteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('team.invite')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <form onSubmit={editForm.handleSubmit(onEditSubmit)}>
             <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                {t('team.form.editRole')}
              </DialogTitle>
              <DialogDescription>
                {t('team.form.editSubtitle', { name: editingMember?.full_name || editingMember?.email })}
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-role">{t('team.form.role')}</Label>
                <Controller
                  name="role"
                  control={editForm.control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {field.value ? t(`roles.${field.value}`) : t('team.form.roleSelect') || 'Select Role'}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="therapist">{t('roles.therapist')}</SelectItem>
                        <SelectItem value="receptionist">{t('roles.receptionist')}</SelectItem>
                        <SelectItem value="viewer">{t('roles.viewer')}</SelectItem>
                        <SelectItem value="clinic_admin">{t('roles.clinic_admin')}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

             <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={updateRoleMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
                {updateRoleMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('common.save')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

