export const ROUTES = {
  login: "/login",
  dashboard: "/route53/v2/dashboard",
  hostedZones: "/route53/v2/hostedzones",
  createHostedZone: "/route53/v2/hostedzones/create",
  zone: (zoneId: string) => `/route53/v2/hostedzones/${encodeURIComponent(zoneId)}`,
};

export interface PlaceholderSection {
  title: string;
  description: string;
  group?: string;
}

const RESOLVER_DESCRIPTION =
  "Route 53 Resolver answers DNS queries for your VPCs and forwards queries between VPCs and your own network.";
const FIREWALL_DESCRIPTION = "DNS Firewall filters the DNS queries that leave your VPCs.";

export const PLACEHOLDER_SECTIONS: Record<string, PlaceholderSection> = {
  healthchecks: {
    title: "Health checks",
    description: "Monitor the health of your endpoints and route traffic only to healthy resources.",
  },
  profiles: {
    title: "Profiles",
    description: "Share DNS settings with many VPCs, across accounts, from one place.",
  },
  cidrcollections: {
    title: "CIDR collections",
    description: "Route traffic based on the IP address ranges your users come from.",
    group: "IP-based routing",
  },
  trafficpolicies: {
    title: "Traffic policies",
    description: "Build complex routing configurations visually with traffic flow.",
    group: "Traffic flow",
  },
  policyrecords: {
    title: "Policy records",
    description: "Apply traffic policies to the DNS names in your hosted zones.",
    group: "Traffic flow",
  },
  "domains/registered": {
    title: "Registered domains",
    description: "Register domain names and manage their contacts, renewals and name servers.",
    group: "Domains",
  },
  "domains/requests": {
    title: "Requests",
    description: "Track domain registration, transfer and update requests.",
    group: "Domains",
  },
  "resolver/vpcs": { title: "VPCs", description: RESOLVER_DESCRIPTION, group: "Resolver" },
  "resolver/inbound-endpoints": { title: "Inbound endpoints", description: RESOLVER_DESCRIPTION, group: "Resolver" },
  "resolver/outbound-endpoints": { title: "Outbound endpoints", description: RESOLVER_DESCRIPTION, group: "Resolver" },
  "resolver/rules": { title: "Rules", description: RESOLVER_DESCRIPTION, group: "Resolver" },
  "resolver/query-logging": { title: "Query logging", description: RESOLVER_DESCRIPTION, group: "Resolver" },
  "dnsfirewall/rule-groups": { title: "Rule groups", description: FIREWALL_DESCRIPTION, group: "DNS Firewall" },
  "dnsfirewall/domain-lists": { title: "Domain lists", description: FIREWALL_DESCRIPTION, group: "DNS Firewall" },
};

export const placeholderHref = (slug: string) => `/route53/v2/${slug}`;

export const EXTERNAL_LINKS = {
  repository: "https://github.com/Angadshuklaa/aws-route53-clone",
  readme: "https://github.com/Angadshuklaa/aws-route53-clone#readme",
  issues: "https://github.com/Angadshuklaa/aws-route53-clone/issues",
  backendSource: "https://github.com/Angadshuklaa/aws-route53-clone/tree/main/backend",
  frontendSource: "https://github.com/Angadshuklaa/aws-route53-clone/tree/main/frontend",
  apiDocs: "/api/docs",
  openApi: "/api/openapi.json",
  health: "/api/health",
};
