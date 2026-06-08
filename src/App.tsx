import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./hooks/use-auth";
import { ProtectedRoute } from "./components/layout/protected-route";
import { DashboardLayout } from "./components/layout/dashboard-layout";
import LoginPage from "./pages/auth/login";
import RegisterPage from "./pages/auth/register";
import { Toaster } from "@/components/ui/sonner";

import RoomsPage from "./pages/dashboard/rooms";
import TherapyTypesPage from "./pages/dashboard/therapy-types";
import PatientsPage from "./pages/dashboard/patients";
import TeamPage from "./pages/dashboard/team";
import ClinicsPage from "./pages/dashboard/clinics";
import CalendarPage from "./pages/dashboard/calendar";
import PinboardPage from "./pages/dashboard/pinboard";
import EquipmentPage from "./pages/dashboard/equipment";
// Placeholder components for Step 4
import HomePage from "./pages/dashboard/home";
import LandingPage from "./pages/landing/LandingPage";
import { useAuth } from "./hooks/use-auth";

function RootRoute() {
  const { user, isLoading } = useAuth();
  
  if (isLoading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  
  return <LandingPage />;
}


const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/auth/login" element={<LoginPage />} />
            <Route path="/auth/register" element={<RegisterPage />} />
            
            {/* Protected Routes inside Dashboard Layout */}
            <Route path="/dashboard" element={<ProtectedRoute />}>
              <Route element={<DashboardLayout />}>
                <Route index element={<HomePage />} />
                <Route path="pinboard" element={<PinboardPage />} />
                <Route path="calendar" element={<CalendarPage />} />
                <Route path="patients" element={<PatientsPage />} />
                <Route path="therapists" element={<TeamPage />} />
                <Route path="therapy-types" element={<TherapyTypesPage />} />
                <Route path="rooms" element={<RoomsPage />} />
                <Route path="equipment" element={<EquipmentPage />} />
                <Route path="clinics" element={<ClinicsPage />} />
              </Route>
            </Route>

            {/* Public Root Route */}
            <Route path="/" element={<RootRoute />} />
            
            {/* Catch-all route */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Router>
        <Toaster position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
