import type { AuthConfig } from "convex/server";
export default {
  providers: process.env.GOOGLE_CLIENT_ID
    ? [
        {
          domain: "https://accounts.google.com",
          applicationID: process.env.GOOGLE_CLIENT_ID,
        },
      ]
    : [],
} satisfies AuthConfig;
