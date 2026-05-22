import { createFileRoute, Link } from "@tanstack/react-router";
import { Pill, ArrowRight, ShieldCheck, Boxes, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Meditory — Gestión farmacéutica para hospitales" },
      {
        name: "description",
        content:
          "SaaS argentina para control de inventario, vencimientos y trazabilidad farmacéutica en hospitales y clínicas.",
      },
    ],
  }),
  component: Landing,
});

const features = [
  {
    icon: Boxes,
    title: "Multi-depósito por Institución",
    description:
      "Hospital, farmacia interna, farmacia ventas. Datos aislados por cliente, configuración por unidad funcional.",
  },
  {
    icon: AlertTriangle,
    title: "Vencimientos sin pérdidas",
    description:
      "Alertas automáticas por lote y trazabilidad de cada movimiento. Cero medicamentos vencidos sin detectar.",
  },
  {
    icon: ShieldCheck,
    title: "Auditoría completa",
    description:
      "Quién, cuándo, qué y por qué. Control de acceso por rol y registro inmutable de cambios.",
  },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Pill className="h-4 w-4" />
            </div>
            <span className="text-base font-semibold tracking-tight">Meditory</span>
          </div>
          <Button asChild size="sm">
            <Link to="/login">
              Entrar a la demo <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
        <div className="max-w-3xl">
          <h1 className="mt-6 text-4xl font-semibold tracking-tight text-foreground lg:text-6xl">
            Gestión farmacéutica para hospitales,{" "}
            <span className="text-primary">sin planillas ni vencimientos perdidos.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
            Meditory controla ingreso, egreso y movimientos de stock entre depósitos, con
            alertas de vencimiento, lotes auditados y un modelo de instituciones por cliente.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/login">
                Explorar el panel <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/login">Acceder con un usuario demo</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="border-t bg-muted/40 py-16">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-4 md:grid-cols-3">
            {features.map((f) => (
              <Card key={f.title} className="border-border/60">
                <CardContent className="p-6">
                  <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary-soft text-primary">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {f.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-xs text-muted-foreground">
          <span>© 2026 Meditory · Blue Open Data</span>
        </div>
      </footer>
    </div>
  );
}
