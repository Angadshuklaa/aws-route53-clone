export const ROUTES = {
  login: "/login",
  dashboard: "/route53/v2/dashboard",
  hostedZones: "/route53/v2/hostedzones",
  createHostedZone: "/route53/v2/hostedzones/create",
  healthChecks: "/route53/v2/healthchecks",
  profiles: "/route53/v2/profiles",
  trafficPolicies: "/route53/v2/trafficpolicies",
  resolver: (section: string) => `/route53/v2/resolver/${section}`,
  zone: (zoneId: string) => `/route53/v2/hostedzones/${encodeURIComponent(zoneId)}`,
};

export const RESOLVER_SECTIONS: Record<string, string> = {
  vpcs: "VPCs",
  "inbound-endpoints": "Inbound endpoints",
  "outbound-endpoints": "Outbound endpoints",
  rules: "Rules",
  "query-logging": "Query logging",
};
