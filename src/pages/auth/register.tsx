import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

type RegisterFormValues = {
  email: string;
  password: string;
  fullName: string;
};

export default function RegisterPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const registerSchema = z.object({
    email: z.string().email(t('auth.validation.email')),
    password: z.string().min(6, t('auth.validation.password')),
    fullName: z.string().min(2, t('auth.validation.fullName')),
  });

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormValues) => {
    try {
      setIsLoading(true);
      
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName,
          }
        }
      });

      if (authError) {
        throw authError;
      }

      // The trigger 'on_auth_user_created' will create the profile automatically,
      // but we might want to update the full_name explicitly just in case, or let the trigger handle it if we modify it.
      // Wait, the trigger only inserts id and email. Let's update the full_name here.
      if (authData.user) {
        await supabase
          .from('profiles')
          .update({ full_name: data.fullName })
          .eq('id', authData.user.id);
      }

      toast.success(t('auth.register.success'));
      navigate("/auth/login");
    } catch (error: any) {
      toast.error(error.message || t('auth.register.error'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <Card className="w-full max-w-md shadow-lg border-slate-200">
        <CardHeader className="space-y-2 text-center">
          <CardTitle className="text-3xl font-bold tracking-tight text-slate-900">{t('auth.register.title')}</CardTitle>
          <CardDescription>
            {t('auth.register.subtitle')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">{t('auth.register.fullName')}</Label>
              <Input
                id="fullName"
                placeholder="Max Mustermann"
                {...register("fullName")}
              />
              {errors.fullName && (
                <p className="text-sm text-red-500">{errors.fullName.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">{t('auth.register.email')}</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@klinik.de"
                {...register("email")}
              />
              {errors.email && (
                <p className="text-sm text-red-500">{errors.email.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t('auth.register.password')}</Label>
              <Input
                id="password"
                type="password"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-sm text-red-500">{errors.password.message}</p>
              )}
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('auth.register.submit')}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex justify-center">
          <p className="text-sm text-slate-600">
            {t('auth.register.hasAccount')}{" "}
            <Link to="/auth/login" className="text-blue-600 hover:underline font-medium">
              {t('auth.register.login')}
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
