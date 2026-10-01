import type { Route } from "@atw/core";

export function deriveTags(route: Route): string[] {
  const tags = new Set<string>();
  const blob = `${route.endpoint ?? ""} ${route.path ?? ""} ${JSON.stringify(route.defaults ?? {})}`.toLowerCase();
  if (blob.includes("android")) tags.add("android");
  if (blob.includes("ios") || blob.includes("iphone")) tags.add("ios");
  if (blob.includes("web") || blob.includes("browser")) tags.add("web");
  if (blob.includes("admin") || blob.includes("internal")) tags.add("critical");
  if (!blob.includes("auth") && !blob.includes("login") && !blob.includes("token")) tags.add("no-auth");
  return [...tags];
}
