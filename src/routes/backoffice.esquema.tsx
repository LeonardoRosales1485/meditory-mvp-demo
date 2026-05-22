import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Database, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useBackofficeStore } from "@/lib/backoffice-store";

export const Route = createFileRoute("/backoffice/esquema")({
  component: BackofficeEsquemaPage,
});

interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
}

interface TableInfo {
  table_name: string;
  columns: ColumnInfo[];
}

function BackofficeEsquemaPage() {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    async function load() {
      try {
        const { backofficeGetSchemaRpc } = await import("@/lib/server-rpc");
        const result = await backofficeGetSchemaRpc();
        setTables(result as TableInfo[]);
        if ((result as TableInfo[]).length > 0) {
          setExpanded(new Set([(result as TableInfo[])[0].table_name]));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = tables.filter(
    (t) => t.table_name.toLowerCase().includes(search.toLowerCase()),
  );

  function toggleExpand(name: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Esquema de base de datos</h1>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar tabla…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs pl-9"
        />
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Cargando esquema…</p>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No se encontraron tablas.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((table) => (
            <Card key={table.table_name} className="border-border/60">
              <button
                className="flex w-full items-center gap-2 px-4 py-3 text-left"
                onClick={() => toggleExpand(table.table_name)}
              >
                <Database className="h-4 w-4 text-primary" />
                <span className="font-mono text-sm font-semibold">{table.table_name}</span>
                <Badge variant="secondary" className="ml-auto text-[10px]">
                  {table.columns.length} columnas
                </Badge>
              </button>
              {expanded.has(table.table_name) && (
                <CardContent className="border-t px-0">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-2 text-left font-medium text-muted-foreground">Columna</th>
                        <th className="px-4 py-2 text-left font-medium text-muted-foreground">Tipo</th>
                        <th className="px-4 py-2 text-center font-medium text-muted-foreground">Nulo</th>
                        <th className="px-4 py-2 text-left font-medium text-muted-foreground">Default</th>
                      </tr>
                    </thead>
                    <tbody>
                      {table.columns.map((col) => (
                        <tr key={col.name} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-2 font-mono font-medium">{col.name}</td>
                          <td className="px-4 py-2 font-mono text-muted-foreground">{col.type}</td>
                          <td className="px-4 py-2 text-center">
                            {col.nullable ? (
                              <span className="text-success">✓</span>
                            ) : (
                              <span className="text-destructive">✗</span>
                            )}
                          </td>
                          <td className="max-w-[200px] truncate px-4 py-2 font-mono text-muted-foreground">
                            {col.default ?? "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
