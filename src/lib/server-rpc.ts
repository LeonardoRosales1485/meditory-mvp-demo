import { createServerFn } from "@tanstack/react-start";
import { fetchWorkspaceData, runAction } from "./server/workspace-service";

export const fetchWorkspaceDataRpc = createServerFn({ method: "POST" })
  .inputValidator((data: { workspaceId: string }) => data)
  .handler(async ({ data }) => {
    return fetchWorkspaceData(data.workspaceId);
  });

export const runActionRpc = createServerFn({ method: "POST" })
  .inputValidator((data: { action: string; payload: unknown }) => data)
  .handler(async ({ data }) => {
    await runAction(data.action as never, data.payload as never);
    return { ok: true };
  });
