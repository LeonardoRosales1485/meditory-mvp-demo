export interface Workspace {
  id: string;
  name: string;
  slug: string;
}

export const workspaces: Workspace[] = [
  { id: "ws-aleman",     name: "Hospital Alemán",                 slug: "HOSPITALALEMAN" },
  { id: "ws-francisco",  name: "Hospital Francisco",              slug: "HOSPITALFRANCISCO" },
  { id: "ws-blanco",     name: "Hospital Blanco",                 slug: "hospitalblanco" },
  { id: "ws-padilla",    name: "Hospital Ángel C. Padilla",       slug: "HOSPITALPADILLA" },
  { id: "ws-ninez",      name: "Hospital del Niño Jesús",         slug: "HOSPITALNINEZ" },
  { id: "ws-mujer",      name: "Hospital de la Mujer",            slug: "HOSPITALMUJER" },
  { id: "ws-evaperon",   name: "Hospital Eva Perón",              slug: "HOSPITALEVAPERON" },
  { id: "ws-concepcion", name: "Hospital Regional de Concepción", slug: "HOSPITALCONCEPCION" },
  { id: "ws-este",       name: "Hospital de la Comunidad - Este", slug: "HOSPITALESTE" },
];
