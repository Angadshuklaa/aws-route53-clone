-- Initial schema for the Route 53 clone.
-- Timestamps are ISO-8601 UTC strings (e.g. 2026-10-09T10:41:00.000Z).

CREATE TABLE hosted_zones (
    id          TEXT PRIMARY KEY,                       -- Route 53 style ID, e.g. Z0123456789ABCDEFGHIJ
    name        TEXT NOT NULL,                          -- lowercase domain without trailing dot
    type        TEXT NOT NULL CHECK (type IN ('PUBLIC', 'PRIVATE')),
    comment     TEXT NOT NULL DEFAULT '',
    vpc_id      TEXT,
    vpc_region  TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    -- Private zones must be associated with a VPC; public zones must not be.
    CHECK ((type = 'PRIVATE' AND vpc_id IS NOT NULL AND vpc_region IS NOT NULL)
        OR (type = 'PUBLIC' AND vpc_id IS NULL AND vpc_region IS NULL))
);

CREATE INDEX ix_hosted_zones_name ON hosted_zones (name);
-- At most one public zone per domain, and one private zone per domain per VPC.
CREATE UNIQUE INDEX ux_hosted_zones_public_name ON hosted_zones (name) WHERE type = 'PUBLIC';
CREATE UNIQUE INDEX ux_hosted_zones_private_name_vpc ON hosted_zones (name, vpc_id) WHERE type = 'PRIVATE';

CREATE TABLE hosted_zone_tags (
    zone_id  TEXT NOT NULL REFERENCES hosted_zones (id) ON DELETE CASCADE,
    key      TEXT NOT NULL,
    value    TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (zone_id, key)
);

-- One row per record set (name + type), like Route 53 simple routing.
CREATE TABLE dns_records (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    zone_id     TEXT NOT NULL REFERENCES hosted_zones (id) ON DELETE CASCADE,
    name        TEXT NOT NULL,                          -- FQDN, lowercase, no trailing dot
    type        TEXT NOT NULL CHECK (type IN ('A', 'AAAA', 'CNAME', 'TXT', 'MX', 'NS', 'PTR', 'SRV', 'CAA', 'SOA')),
    ttl         INTEGER NOT NULL CHECK (ttl BETWEEN 0 AND 2147483647),
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    UNIQUE (zone_id, name, type)
);

CREATE INDEX ix_dns_records_zone_type ON dns_records (zone_id, type);

-- The individual values of a record set. Type-specific fields are typed
-- columns that are NULL when the record type does not use them:
--   A/AAAA/CNAME/NS/PTR/TXT  value only
--   MX                       priority + value (mail server)
--   SRV                      priority + weight + port + value (target)
--   CAA                      flags + tag + value
--   SOA                      value (full SOA RDATA)
CREATE TABLE dns_record_values (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id  INTEGER NOT NULL REFERENCES dns_records (id) ON DELETE CASCADE,
    position   INTEGER NOT NULL CHECK (position >= 0),
    value      TEXT NOT NULL,
    priority   INTEGER CHECK (priority BETWEEN 0 AND 65535),
    weight     INTEGER CHECK (weight BETWEEN 0 AND 65535),
    port       INTEGER CHECK (port BETWEEN 0 AND 65535),
    flags      INTEGER CHECK (flags BETWEEN 0 AND 255),
    tag        TEXT,
    UNIQUE (record_id, position)
);

-- Server-side sessions for the mocked login. Only a SHA-256 hash of the
-- cookie token is stored.
CREATE TABLE sessions (
    token_hash  TEXT PRIMARY KEY,
    username    TEXT NOT NULL,
    account_id  TEXT NOT NULL,
    created_at  TEXT NOT NULL,
    expires_at  TEXT NOT NULL
);

CREATE INDEX ix_sessions_expires_at ON sessions (expires_at);

-- Small key/value store for application bookkeeping (e.g. one-time seeding).
CREATE TABLE app_metadata (
    key    TEXT PRIMARY KEY,
    value  TEXT NOT NULL
);
