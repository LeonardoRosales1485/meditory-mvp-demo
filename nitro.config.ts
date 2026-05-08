import { defineNitroConfig } from "nitro/config";

export default defineNitroConfig({
  // Keep provider explicit for predictable Vercel output.
  preset: "vercel",
});
