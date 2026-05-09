import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./hooks/use-auth";
import { ProtectedRoute } from "./components/layout/protected-route";
import { DashboardLayout } from "./components/layout/dashboard-layout";
import LoginPage from "./pages/auth/login";
import RegisterPage from "./pages/auth/register";
import { Toaster } from "@/components/ui/sonner";
import { lazy } from "react";

import RoomsPage from "./pages/dashboard/rooms";
import TherapyTypesPage from "./pages/dashboard/therapy-types";
import PatientsPage from "./pages/dashboard/patients";
import TeamPage from "./pages/dashboard/team";
import ClinicsPage from "./pages/dashboard/clinics";
import CalendarPage from "./pages/dashboard/calendar";

// Placeholder components for Step 4
import HomePage from "./pages/dashboard/home";


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
                <Route path="calendar" element={<CalendarPage />} />
                <Route path="patients" element={<PatientsPage />} />
                <Route path="therapists" element={<TeamPage />} />
                <Route path="therapy-types" element={<TherapyTypesPage />} />
                <Route path="rooms" element={<RoomsPage />} />
                <Route path="clinics" element={<ClinicsPage />} />
              </Route>
            </Route>

            {/* Redirect root to dashboard */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            
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
