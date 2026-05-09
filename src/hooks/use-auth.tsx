import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';
import type { Profile, UserRole, UserContextType } from '@/types';

const AuthContext = createContext<UserContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeClinicId, setActiveClinicIdState] = useState<string | null>(null);

  // Special setter for activeClinicId that only works for admins or if it's the initial load
  const setActiveClinicId = (id: string | null) => {
    if (role === 'system_admin' || !activeClinicId) {
      setActiveClinicIdState(id);
    }
  };

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfileAndRole(session.user.id);
      } else {
        setIsLoading(false);
      }
    });

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          fetchProfileAndRole(session.user.id);
        } else {
          setProfile(null);
          setRole(null);
          setActiveClinicId(null);
          setIsLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfileAndRole(userId: string) {
    try {
      setIsLoading(true);
      
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;
      setProfile(profileData);
      
      if (profileData?.clinic_id) {
        setActiveClinicId(profileData.clinic_id);
      }

      const { data: roleData, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      if (roleError && roleError.code !== 'PGRST116') {
        // PGRST116 means no rows returned, which might be fine if a role isn't assigned yet
        throw roleError;
      }
      
      
      setRole(roleData?.role ?? null);

      // On initial load, if the user has a clinic, set it as active
      if (profileData?.clinic_id && !activeClinicId) {
        setActiveClinicIdState(profileData.clinic_id);
      }
    } catch (error) {
      console.error('Error fetching user profile/role:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, profile, role, isLoading, activeClinicId, setActiveClinicId, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
