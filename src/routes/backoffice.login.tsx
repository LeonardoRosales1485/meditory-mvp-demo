import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Pill, ArrowRight, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBackofficeStore } from "@/lib/backoffice-store";

export const Route = createFileRoute("/backoffice/login")({
  head: () => ({ meta: [{ title: "Meditory — Backoffice" }] }),
  component: BackofficeLoginPage,
});

function BackofficeLoginPage() {
  const login = useBackofficeStore((s) => s.login);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const ok = await login(email.trim(), password);
      if (!ok) {
        toast.error("Credenciales inválidas", {
          description: "Email o contraseña incorrectos.",
        });
        return;
      }
      toast.success("Bienvenido al backoffice");
      navigate({ to: "/backoffice" });
    } catch (e) {
      const err = e instanceof Error ? e.message : String(e);
      toast.error("Error de conexión", { description: err.slice(0, 280) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-semibold tracking-tight">Meditory</span>
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Gestión administrativa</span>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Acceso superadmin</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="bo-email">Email</Label>
                <Input
                  id="bo-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@meditory.com"
                  autoComplete="email"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bo-password">Contraseña</Label>
                <Input
                  id="bo-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  required
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Ingresando..." : "Ingresar"} <ArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          <a href="/login" className="hover:text-primary">Volver al acceso de Institución</a>
        </p>
      </div>
    </div>
  );
}
