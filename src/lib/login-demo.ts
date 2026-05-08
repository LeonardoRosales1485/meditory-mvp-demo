export interface Workspace {
  id: string;
  name: string;
  slug: string;
}

export const workspaces: Workspace[] = [
  { id: "ws-aleman", name: "Hospital Alemán", slug: "HOSPITALALEMAN" },
  { id: "ws-francisco", name: "Hospital Francisco", slug: "HOSPITALFRANCISCO" },
  { id: "ws-blanco", name: "Hospital Blanco", slug: "hospitalblanco" },
];
