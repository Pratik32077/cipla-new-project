import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { Eye, EyeOff, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Redirect } from "wouter";

const loginSchema = z.object({
  employeeCode: z.string().min(1, "Employee code is required"),
  password: z.string().min(1, "Password is required"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { login, loginPending, user } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { employeeCode: "", password: "" },
  });

  if (user) {
    return <Redirect to="/dashboard" />;
  }

  const onSubmit = async (values: LoginForm) => {
    try {
      await login(values.employeeCode, values.password);
    } catch {
      toast({
        title: "Login failed",
        description: "Invalid employee code or password. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-sidebar flex items-center justify-center p-4">
      {/* Background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary shadow-lg mb-4">
            <Shield size={26} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Cipla Healthcare</h1>
          <p className="text-sm text-white/50 mt-1">Campaign Management Portal</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm shadow-2xl">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-white">Sign in</h2>
            <p className="text-sm text-white/50 mt-0.5">Use your employee credentials to access the portal</p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="employeeCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white/70 text-sm">Employee Code</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        data-testid="input-employee-code"
                        placeholder="e.g. ADMIN001"
                        className="bg-white/8 border-white/15 text-white placeholder:text-white/30 focus-visible:ring-primary focus-visible:border-primary"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white/70 text-sm">Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          data-testid="input-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Enter your password"
                          className="bg-white/8 border-white/15 text-white placeholder:text-white/30 focus-visible:ring-primary focus-visible:border-primary pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                data-testid="button-submit"
                disabled={loginPending}
                className="w-full bg-primary hover:bg-primary/90 text-white font-medium h-10 mt-2"
              >
                {loginPending ? (
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Signing in...
                  </span>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>
          </Form>

          <p className="mt-5 text-center text-xs text-white/30">
            Default admin: ADMIN001 / Cipla@2024
          </p>
        </div>

        <p className="text-center text-xs text-white/25 mt-6">
          &copy; 2024 Cipla Ltd. All rights reserved.
        </p>
      </div>
    </div>
  );
}
