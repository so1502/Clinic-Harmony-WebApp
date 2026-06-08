import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { de, enUS } from "date-fns/locale";
import { 
  Users, 
  Calendar as CalendarIcon, 
  UserSquare2, 
  DoorOpen,
  ArrowRight,
  Plus
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import type { Appointment } from "@/types";

export default function HomePage() {
  const { activeClinicId, profile } = useAuth();
  const { t, i18n } = useTranslation();

  const dateLocale = i18n.language === 'de' ? de : enUS;

  // Fetch counts for KPI cards
  const { data: counts } = useQuery({
    queryKey: ["dashboard-counts", activeClinicId],
    queryFn: async () => {
      if (!activeClinicId) return null;

      const [patients, therapists, rooms, todayAppointments] = await Promise.all([
        supabase.from("patients").select("*", { count: "exact", head: true }).eq("clinic_id", activeClinicId),
        supabase.from("therapists").select("*", { count: "exact", head: true }).eq("clinic_id", activeClinicId),
        supabase.from("rooms").select("*", { count: "exact", head: true }).eq("clinic_id", activeClinicId),
        supabase.from("appointments")
          .select("*", { count: "exact", head: true })
          .eq("clinic_id", activeClinicId)
          .not("therapist_id", "is", null)
          .gte("start_time", new Date().toISOString().split('T')[0] + 'T00:00:00')
          .lte("start_time", new Date().toISOString().split('T')[0] + 'T23:59:59')
      ]);

      return {
        patients: patients.count || 0,
        therapists: therapists.count || 0,
        rooms: rooms.count || 0,
        todayAppointments: todayAppointments.count || 0,
      };
    },
    enabled: !!activeClinicId,
  });

  // Fetch today's appointments
  const { data: todayAppointments, isLoading: appointmentsLoading } = useQuery({
    queryKey: ["today-appointments", activeClinicId],
    queryFn: async () => {
      if (!activeClinicId) return [];

      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from("appointments")
        .select(`
          *,
          patients (id, full_name),
          therapists (id, profiles(full_name)),
          therapy_types (id, name, color)
        `)
        .eq("clinic_id", activeClinicId)
        .not("therapist_id", "is", null)
        .gte("start_time", today + 'T00:00:00')
        .lte("start_time", today + 'T23:59:59')
        .order("start_time");

      if (error) throw error;
      return data as Appointment[];
    },
    enabled: !!activeClinicId,
  });

  if (!activeClinicId) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-slate-500 text-lg">{t('home.selectClinic')}</p>
      </div>
    );
  }

  const kpis = [
    { 
      title: t('home.kpis.patients'), 
      value: counts?.patients || 0, 
      icon: Users, 
      color: "text-blue-600", 
      bg: "bg-blue-100",
      link: "/dashboard/patients"
    },
    { 
      title: t('home.kpis.appointments'), 
      value: counts?.todayAppointments || 0, 
      icon: CalendarIcon, 
      color: "text-emerald-600", 
      bg: "bg-emerald-100",
      link: "/dashboard/calendar"
    },
    { 
      title: t('home.kpis.therapists'), 
      value: counts?.therapists || 0, 
      icon: UserSquare2, 
      color: "text-purple-600", 
      bg: "bg-purple-100",
      link: "/dashboard/therapists"
    },
    { 
      title: t('home.kpis.rooms'), 
      value: counts?.rooms || 0, 
      icon: DoorOpen, 
      color: "text-orange-600", 
      bg: "bg-orange-100",
      link: "/dashboard/rooms"
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          {t('home.greeting', { name: profile?.full_name || t('dashboard.user.user') })}
        </h1>
        <p className="text-slate-500">
          {t('home.overview', { date: format(new Date(), "EEEE, d. MMMM yyyy", { locale: dateLocale }) })}
        </p>
      </div>

      {/* KPI Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Link key={kpi.title} to={kpi.link}>
            <Card className="hover:shadow-md transition-shadow border-slate-200">
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-slate-600">{kpi.title}</CardTitle>
                <div className={`${kpi.bg} p-2 rounded-lg`}>
                  <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{kpi.value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        {/* Today's Appointments */}
        <Card className="lg:col-span-4 border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{t('home.appointments.title')}</CardTitle>
              <CardDescription>{t('home.appointments.subtitle')}</CardDescription>
            </div>
            <Link to="/dashboard/calendar">
              <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                {t('home.appointments.viewAll')} <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {appointmentsLoading ? (
                <div className="py-8 text-center text-slate-400">{t('home.appointments.loading')}</div>
              ) : todayAppointments?.length === 0 ? (
                <div className="py-8 text-center text-slate-400 border-2 border-dashed border-slate-100 rounded-lg">
                  {t('home.appointments.empty')}
                </div>
              ) : (
                todayAppointments?.map((apt) => (
                  <div key={apt.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="text-center min-w-[60px] py-1 bg-slate-100 rounded text-slate-700 font-mono text-sm font-semibold">
                        {format(new Date(apt.start_time), "HH:mm")}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{apt.patients?.full_name}</p>
                        <p className="text-xs text-slate-500">{apt.therapy_types?.name || "Allgemein"} • {apt.therapists?.profiles?.full_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                       <div className="w-3 h-3 rounded-full" style={{ backgroundColor: apt.therapy_types?.color || '#3b82f6' }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="lg:col-span-3 border-slate-200 shadow-sm bg-gradient-to-br from-white to-slate-50">
          <CardHeader>
            <CardTitle>{t('home.quickActions.title')}</CardTitle>
            <CardDescription>{t('home.quickActions.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Link to="/dashboard/calendar" state={{ openCreate: true }}>
              <Button className="w-full justify-start h-12 bg-blue-600 hover:bg-blue-700 shadow-sm" size="lg">
                <Plus className="mr-3 h-5 w-5" /> {t('home.quickActions.newAppointment')}
              </Button>
            </Link>
            <Link to="/dashboard/patients" state={{ openCreate: true }}>
              <Button variant="outline" className="w-full justify-start h-12 border-slate-200 hover:bg-white hover:shadow-sm" size="lg">
                <Users className="mr-3 h-5 w-5 text-blue-600" /> {t('home.quickActions.addPatient')}
              </Button>
            </Link>
            <Link to="/dashboard/team">
              <Button variant="outline" className="w-full justify-start h-12 border-slate-200 hover:bg-white hover:shadow-sm" size="lg">
                <UserSquare2 className="mr-3 h-5 w-5 text-purple-600" /> {t('home.quickActions.manageTeam')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
