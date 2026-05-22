import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Pill,
  ArrowRight,
  ShieldCheck,
  Stethoscope,
  ShoppingCart,
  FlaskConical,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore } from "@/lib/store";
import { workspaces } from "@/lib/login-demo";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Meditory — Acceso" }] }),
  component: LoginPage,
});

const ROLES = [
  {
    role: "admin",
    label: "Admin",
    description: "Gestión completa del depósito",
    icon: ShieldCheck,
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    role: "tecnico",
    label: "Enfermero Jefe",
    description: "Farmacia interna",
    icon: FlaskConical,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  {
    role: "doctor",
    label: "Doctor",
    description: "Pedidos de medicación",
    icon: Stethoscope,
    color: "text-violet-600",
    bg: "bg-violet-50",
  },
  {
    role: "ventas",
    label: "Ventas",
    description: "Farmacia mostrador",
    icon: ShoppingCart,
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
] as const;

function LoginPage() {
  const login = useStore((s) => s.login);
  const navigate = useNavigate();
  const [hospitalSlug, setHospitalSlug] = useState(workspaces[0].slug);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function doLogin(emailToUse: string) {
    setLoading(true);
    try {
      const session = await login(emailToUse);
      if (!session) {
        toast.error("Email no reconocido");
        return;
      }
      toast.success(`Bienvenido · ${session.workspaceName}`, {
        description: `Rol: ${session.role}`,
      });
      navigate({ to: "/app" });
    } finally {
      setLoading(false);
    }
  }

  function handleRoleClick(role: string) {
    doLogin(`${hospitalSlug}${role}@user.com`);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    doLogin(email.trim());
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Pill className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">Meditory</span>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Acceso a Institución</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Demo quick-access */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Acceso rápido — demo
                </p>
              </div>

              {/* Hospital selector */}
              <Select value={hospitalSlug} onValueChange={setHospitalSlug}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {workspaces.map((ws) => (
                    <SelectItem key={ws.id} value={ws.slug}>
                      {ws.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Role buttons grid */}
              <div className="grid grid-cols-2 gap-2">
                {ROLES.map(({ role, label, description, icon: Icon, color, bg }) => (
                  <button
                    key={role}
                    type="button"
                    disabled={loading}
                    onClick={() => handleRoleClick(role)}
                    className="flex items-start gap-2.5 rounded-md border bg-background p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${bg}`}>
                      <Icon className={`h-3.5 w-3.5 ${color}`} />
                    </span>
                    <span className="flex flex-col leading-tight">
                      <span className="text-xs font-semibold">{label}</span>
                      <span className="text-[11px] text-muted-foreground">{description}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-2 text-muted-foreground">o ingresá con email</span>
              </div>
            </div>

            {/* Manual login */}
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email corporativo</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="HOSPITALALEMANadmin@user.com"
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <p className="text-[11px] text-muted-foreground">Demo · contraseña no validada</p>
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Ingresando..." : "Ingresar"} <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
