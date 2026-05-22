# Meditory MVP

MVP de gestión de medicamentos para hospitales (workspaces), con foco en:

- stock por depósitos,
- transferencias controladas entre depósitos,
- pedidos médicos,
- ventas desde depósitos de tipo ventas,
- auditoría de eventos.

Este documento está pensado para que un programador pueda:

1. clonar y levantar el proyecto rápido,
2. entender cómo preparar la base de datos,
3. desplegar una demo en un entorno personal,
4. migrar el mismo proyecto al repositorio y cuenta de la empresa.

---

## 1) Stack técnico

- Frontend + server functions: TanStack Start + Vite + React + TypeScript
- Estado cliente: Zustand
- UI: shadcn/ui + Tailwind
- Base de datos: Supabase (PostgreSQL)
- Asistente virtual: Groq API (LLM vía Nitro route `server/api/ai-chat.ts` con streaming SSE)

---

## 2) Requisitos previos

- Node.js 20+ (recomendado 22 LTS)
- npm 10+
- Proyecto Supabase (URL + keys)
- (Opcional) Cuenta en Groq (https://console.groq.com) para el asistente virtual
- (Opcional) cuenta en Vercel para deploy demo

---

## 3) Setup local

### 3.1 Instalar dependencias

```bash
npm install
```

### 3.2 Variables de entorno

Crear archivo `.env.local` en la raíz:

```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
# opcional para SSR si no querés depender de VITE_SUPABASE_URL
SUPABASE_URL=...

# Asistente virtual (Groq)
GROQ_API_KEY=gsk_...
```

Notas:

- El backend usa `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_URL` (o fallback a `VITE_SUPABASE_URL`).
- Podés tomar como base el archivo [`.env.example`](.env.example).
- Contrato recomendado para Vercel:
  - Públicas (cliente): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  - Privadas (server): `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

### 3.3 Levantar en desarrollo

```bash
npm run dev
```

App local por defecto: `http://localhost:8080`

---

## 4) Base de datos (SQL)

Ejecutar scripts en este orden exacto desde `sql/`:

1. `001_schema.sql`
2. `002_seed.sql` (solo si querés datos demo)
3. `003_fix_schema_drift.sql`
4. `004_user_warehouse_access.sql`
5. `005_transfer_flow_updates.sql`
6. `006_order_flow_updates.sql`
7. `007_patients.sql`
8. `008_hard_stock_rules.sql`
9. `009_lot_selection_flow.sql`
10. `010_transfer_codes.sql`
11. `011_consume_stock_overload.sql`
12. `012_wings_rooms_beds.sql`
13. `013_demo_internacion_rooms.sql`
14. `014_medications_sale_price.sql`
15. `015_warehouses_soft_delete.sql`
16. `016_medications_soft_delete.sql`
17. `017_medications_sale_enabled.sql`

### Recomendación práctica

- Entorno demo: correr todos, incluyendo `002_seed.sql`.
- Entorno cliente/empresa: correr sin `002_seed.sql` o adaptar seed.

---

## 5) Scripts útiles

- Desarrollo: `npm run dev`
- Build: `npm run build`
- Preview local build: `npm run preview`
- Lint: `npm run lint`
- Format: `npm run format`

---

## 6) Deploy demo (repo personal + Vercel personal)

### 6.1 Subir repo personal

1. Crear repo privado/público personal.
2. Push de esta carpeta.
3. Verificar que `.env.local` no se suba (usar `.gitignore`).

### 6.2 Deploy en Vercel

Prerequisito: este proyecto usa **TanStack Start + Nitro** para generar salida compatible con Vercel Functions.

1. Importar repo en Vercel.
2. Configurar variables de entorno en Vercel (Production y Preview):
    - `VITE_SUPABASE_URL`
    - `VITE_SUPABASE_ANON_KEY`
    - `SUPABASE_SERVICE_ROLE_KEY`
    - `SUPABASE_URL` (recomendado explícito)
    - `GROQ_API_KEY` (si se usa el asistente virtual)
3. Project Settings -> Build and Output Settings:
   - Install Command: `npm install`
   - Build Command: `npm run build`
   - Output Directory: dejar vacío (auto, manejado por Nitro)
4. Deploy.
5. Si venías de un intento fallido con configuración vieja, hacer **Redeploy** sin cache.

### 6.3 Smoke test post-deploy

- Login correcto.
- Creación de medicamento.
- Registro de ingreso.
- Creación de transferencia.
- Creación de pedido médico.
- Auditoría visible.
- Verificar que no aparezca `404 NOT_FOUND` en `/` y rutas profundas (`/login`, `/app/pedidos`, `/app/transferencias`).
- Confirmar que las server functions respondan (acciones que mutan datos y refrescan estado).

---

## 7) Pasaje a repositorio de la empresa

Objetivo: conservar código/funcionalidad de la demo, cambiando ownership, secretos y entorno.

### 7.1 Crear proyecto destino

- Nuevo repo en la organización de la empresa.
- Nueva instancia Supabase de empresa (idealmente separada de demo).
- Nuevo proyecto de deploy (Vercel/infra empresa).

### 7.2 Migrar código

Opciones:

- **A)** mirror/push al nuevo remote, o
- **B)** clonar limpio y copiar código.

### 7.3 Migrar base

- Ejecutar migraciones SQL en entorno empresa.
- Decidir si cargar seed (normalmente no en producción).

### 7.4 Configurar secretos empresa

En entorno empresa, definir:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`

### 7.5 Checklist de corte

- [ ] Demo personal y empresa no comparten service role key.
- [ ] `.env.local` fuera de git.
- [ ] DB empresa inicializada.
- [ ] Deploy empresa en verde.
- [ ] Flujo funcional validado por QA funcional.

---

## 8) Reglas de negocio clave implementadas (resumen)

- Un único depósito `central` por workspace.
- Ingresos solo al depósito central y con vencimiento futuro.
- Transferencias con flujo controlado y post-recepción (aceptar/rechazar).
- Selección explícita de lote en transferencias/pedidos (default FEFO).
- Ventas solo desde depósitos tipo `ventas` y con stock.
- Trazabilidad con auditoría.
- ID amigable de transferencia `YYYYMM-00001` (con contador mensual por workspace).

---

## 9) Troubleshooting rápido

- Error de env vars faltantes:
  - revisar `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_URL`/`VITE_SUPABASE_URL`.
- UI no refleja cambios:
  - verificar ejecución correcta de migraciones SQL.
- Errores de schema drift:
  - re-ejecutar scripts `003` a `010` en orden.

---

## 10) Seguridad y gobernanza

- No commitear secrets.
- Rotar keys antes de pasar de demo personal a entorno empresa.
- Separar completamente entornos: demo, QA, prod.

---

## 11) Responsive guidelines

Lineamientos base para mantener UI responsive en futuras pantallas:

- Breakpoints de referencia:
  - Mobile: `320px`, `375px`, `390px`
  - Tablet: `768px`
  - Desktop: `1024px+`
- Layout:
  - usar `mobile-first` (`grid-cols-1` por defecto y escalar con `sm:/md:/lg:`),
  - evitar paddings fijos grandes en mobile,
  - aplicar `min-w-0` en contenedores flex para prevenir cortes.
- Headers:
  - en mobile, `title + action` debe apilar (`flex-col`) y volver a fila en `sm+`.
- Tablas:
  - permitir scroll horizontal (`overflow-x-auto`),
  - ocultar columnas secundarias en mobile con `hidden md:table-cell` / `hidden lg:table-cell`.
- Modales/formularios:
  - mantener `max-h` + `overflow-y-auto` en contenido,
  - formularios de 1 columna en mobile y 2 columnas desde `md`.
- QA visual mínimo antes de merge:
  - revisar `/login`, `/app/*` principales y modales críticos en 320/375/390/768/1024+.

---

## 12) Toggle mobile Tabla/Cards por pantalla

Para vistas con listado en rutas `app.*`, se usa un patrón compartido:

- Hook: `useMobileListView(routeKey)` en `src/lib/use-mobile-list-view.ts`
  - detecta mobile (`max-width: 640px`),
  - persiste preferencia en `localStorage` con clave `mobile-view:<routeKey>`,
  - modos: `"table"` y `"cards"` (default mobile: `"cards"`).
- UI: `MobileViewToggle` en `src/components/mobile-view-toggle.tsx`
  - visible solo en mobile,
  - alterna entre `Cards` y `Tabla`.

Uso sugerido en cada ruta:

1. crear estado con `const { isMobile, viewMode, setViewMode } = useMobileListView("app-ruta")`;
2. renderizar `<MobileViewToggle ... />` solo si `isMobile`;
3. mantener render dual:
   - `isMobile && viewMode === "cards"` -> cards con mismas acciones,
   - caso contrario -> tabla existente (desktop/tablet intacto).

Regla importante: no modificar reglas de negocio ni handlers; solo cambia la presentación del listado.

---

## 13) Documentación funcional

Documentos de este proyecto pueden ser consultados en este drive: https://drive.google.com/drive/folders/1otq1ulj76Yv3Cpwubhg5wMFSPumoD8AO?usp=drive_link