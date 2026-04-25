export const DATASETS = [
  {
    name: "airport-coordinates",
    displayName: "Airport Coordinates",
    description: "Geo coordinates (latitude/longitude) for airports associated with CloudFront edge locations.",
    href: "/datasets/airport-coordinates",
    format: "JSON",
  },
  {
    name: "cloudfront-edge-locations",
    displayName: "CloudFront Edge Locations",
    description: "CloudFront POP locations with IATA codes, cities, countries, and active node identifiers.",
    href: "/datasets/cloudfront-edge-locations",
    format: "JSON",
  },
  {
    name: "cloudfront-embedded-pops",
    displayName: "CloudFront Embedded PoPs",
    description: "CloudFront Embedded PoP locations (caches within ISP networks) by city and country.",
    href: "/datasets/cloudfront-embedded-pops",
    format: "JSON",
  },
  {
    name: "domain-registry",
    displayName: "Domain Registry",
    description: "RDAP registration data (registrar, created/expires dates, nameservers, DNSSEC) for top-ranked domains.",
    href: "/datasets/domain-registry",
    format: "JSON",
  },
  {
    name: "icloud-private-relay",
    displayName: "iCloud Private Relay",
    description: "IP prefixes (CIDR) used by Apple iCloud Private Relay egress nodes.",
    href: "/datasets/icloud-private-relay",
    format: "TXT",
  },
];
