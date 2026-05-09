import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { 
  Calendar, 
  Users, 
  UserSquare2, 
  Activity, 
  DoorOpen, 
  LogOut, 
  Menu, 
  LayoutDashboard,
  Building2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function DashboardLayout() {
  const { signOut, profile, role, activeClinicId, setActiveClinicId } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Fetch all clinics if user is system_admin
  const { data: clinics } = useQuery({
    queryKey: ["all-clinics"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clinics").select("*").order("name");
      if (error) throw error;
      return data;
    },
    enabled: role === "system_admin",
  });


  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Kalender", href: "/dashboard/calendar", icon: Calendar },
    { name: "Patienten", href: "/dashboard/patients", icon: Users },
    { name: "Team", href: "/dashboard/therapists", icon: UserSquare2 },
    { name: "Therapiearten", href: "/dashboard/therapy-types", icon: Activity },
    { name: "Räume", href: "/dashboard/rooms", icon: DoorOpen },
  ];

  if (role === "system_admin") {
    navItems.push({ name: "Klinikverwaltung", href: "/dashboard/clinics", icon: Building2 });
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900">
      {/* Sidebar for Desktop */}
      <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex flex-col border-b border-slate-200 p-4 min-h-16 justify-center">
          <h1 className="text-xl font-bold text-blue-600 mb-2">Clinic-Harmony</h1>
          {role === "system_admin" && (
            <Select value={activeClinicId || ""} onValueChange={setActiveClinicId}>
              <SelectTrigger className="w-full h-auto py-2 text-xs font-medium">
                <SelectValue>
                  {clinics?.find((c: any) => c.id === activeClinicId)?.name || "Klinik auswählen"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {clinics?.map(clinic => (
                  <SelectItem key={clinic.id} value={clinic.id} className="text-xs">{clinic.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex-1 overflow-y-auto py-4">
          <nav className="space-y-1 px-4">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <item.icon
                    className={`mr-3 h-5 w-5 flex-shrink-0 ${
                      isActive ? "text-blue-700" : "text-slate-400"
                    }`}
                  />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="border-t border-slate-200 p-4">
          <div className="flex items-center space-x-3 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold">
              {profile?.full_name?.charAt(0) || "U"}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">{profile?.full_name || "Benutzer"}</p>
              <p className="text-xs text-slate-500 capitalize">{role ? role.replace('_', ' ') : 'Gast'}</p>
            </div>
          </div>
          <Button variant="outline" className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Abmelden
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-4 sm:px-6 md:hidden">
          <h1 className="text-xl font-bold text-blue-600">Clinic-Harmony</h1>
          <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            <Menu className="h-6 w-6" />
          </Button>
        </header>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="absolute inset-0 z-40 bg-slate-900/50 md:hidden" onClick={() => setIsMobileMenuOpen(false)}>
            <div className="absolute inset-y-0 left-0 w-64 bg-white shadow-xl flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="flex h-16 items-center border-b border-slate-200 px-6">
                <h1 className="text-xl font-bold text-blue-600">Menu</h1>
              </div>
              <div className="flex-1 overflow-y-auto py-4">
                <nav className="space-y-1 px-4">
                  {navItems.map((item) => {
                    const isActive = location.pathname === item.href;
                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className={`flex items-center rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
                          isActive
                            ? "bg-blue-50 text-blue-700"
                            : "text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <item.icon
                          className={`mr-3 h-5 w-5 flex-shrink-0 ${
                            isActive ? "text-blue-700" : "text-slate-400"
                          }`}
                        />
                        {item.name}
                      </Link>
                    );
                  })}
                </nav>
              </div>
              <div className="border-t border-slate-200 p-4">
                <Button variant="outline" className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => { signOut(); setIsMobileMenuOpen(false); }}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Abmelden
                </Button>
              </div>
            </div>
          </div>
        )}

        <main className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
