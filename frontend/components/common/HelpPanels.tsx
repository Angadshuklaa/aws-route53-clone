"use client";

import Box from "@cloudscape-design/components/box";
import HelpPanel from "@cloudscape-design/components/help-panel";

export function HostedZonesHelp() {
  return (
    <HelpPanel header={<h2>Hosted zones</h2>}>
      <p>
        A hosted zone is a container for the records that define how traffic is routed for a domain, such as
        example.com, and its subdomains.
      </p>
      <h3>Public and private hosted zones</h3>
      <ul>
        <li>
          <strong>Public</strong> hosted zones answer queries from the internet.
        </li>
        <li>
          <strong>Private</strong> hosted zones answer queries only from the VPCs associated with them.
        </li>
      </ul>
      <p>
        When you create a hosted zone, Route 53 adds a name server (NS) record and a start of authority (SOA) record
        to it automatically.
      </p>
      <Box variant="small" color="text-body-secondary">
        In this clone, DNS changes are stored in the application database and aren&apos;t published to real name
        servers.
      </Box>
    </HelpPanel>
  );
}

export function RecordsHelp() {
  return (
    <HelpPanel header={<h2>Records</h2>}>
      <p>Records tell DNS resolvers how to answer queries for a name in the hosted zone.</p>
      <dl>
        <dt>A / AAAA</dt>
        <dd>Route traffic to an IPv4 or IPv6 address.</dd>
        <dt>CNAME</dt>
        <dd>Alias one name to another. Not allowed at the zone apex or next to other records.</dd>
        <dt>MX</dt>
        <dd>Mail servers with a priority. Lower values are preferred.</dd>
        <dt>TXT</dt>
        <dd>Free-form text, used for SPF, DKIM and domain verification.</dd>
        <dt>NS</dt>
        <dd>Delegate a subdomain to other name servers.</dd>
        <dt>PTR</dt>
        <dd>Map an address to a name for reverse lookups.</dd>
        <dt>SRV</dt>
        <dd>Priority, weight, port and target for a service.</dd>
        <dt>CAA</dt>
        <dd>Restrict which certificate authorities can issue certificates.</dd>
      </dl>
      <p>
        <strong>TTL</strong> is how long, in seconds, resolvers cache the answer.
      </p>
    </HelpPanel>
  );
}

export function CreateHostedZoneHelp() {
  return (
    <HelpPanel header={<h2>Create hosted zone</h2>}>
      <p>Enter the domain name you want to route traffic for, then choose whether the zone is public or private.</p>
      <p>
        Private hosted zones must be associated with a VPC. Enter the VPC ID and choose the Region the VPC belongs to.
      </p>
      <p>Tags help you organize and identify hosted zones.</p>
    </HelpPanel>
  );
}
