"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import {
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Close,
  Globe,
  Menu,
  Minus,
  Plus,
  Search,
  ThumbsDown,
  ThumbsUp,
  UserCircle,
} from "@/components/landing/icons";
import styles from "@/components/landing/landing.module.css";
import { loginUrl, useAuth } from "@/lib/auth";
import { formatAccountId } from "@/lib/format";
import { EXTERNAL_LINKS, ROUTES } from "@/lib/routes";

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "features", label: "Features" },
  { id: "use-cases", label: "Use cases" },
  { id: "get-started", label: "Get started" },
  { id: "faqs", label: "FAQs" },
] as const;

const FEATURE_LINKS = [
  { href: "#features", label: "Hosted zones" },
  { href: "#features", label: "DNS records" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Import and export" },
];

interface AccordionEntry {
  id: string;
  title: string;
  body: ReactNode;
}

const BENEFITS: AccordionEntry[] = [
  {
    id: "zones",
    title: "Manage public and private hosted zones for your domains from one console.",
    body: (
      <>
        <p>
          Create a hosted zone for any domain name, add a description and tags, and choose whether it answers queries
          from the internet or only from a VPC. Every new zone starts with its NS and SOA records, just as in Route 53.
        </p>
        <p>Search, sort and page through your zones, then edit or delete them with confirmation.</p>
      </>
    ),
  },
  {
    id: "records",
    title: "Create every common record type: A, AAAA, CNAME, MX, TXT, NS, PTR, SRV and CAA.",
    body: (
      <p>
        Each type has its own fields, such as priority and mail server for MX, or priority, weight, port and target for
        SRV. Records can hold multiple values, and TTL shortcuts and inline validation catch mistakes before they&apos;re
        saved.
      </p>
    ),
  },
  {
    id: "find",
    title: "Find the record you need quickly with search, type filters and pagination.",
    body: (
      <p>
        Search by name, type or value, combine the search with a record type filter, and choose how many rows to show.
        The details panel shows everything about the selected record.
      </p>
    ),
  },
  {
    id: "files",
    title: "Move zones in and out with BIND zone file import and export.",
    body: (
      <p>
        Paste or upload a zone file to import its records, with a line-by-line report of anything that was skipped.
        Export any zone as a BIND file or as JSON.
      </p>
    ),
  },
];

const USE_CASES: AccordionEntry[] = [
  {
    id: "practice",
    title: "Practice DNS management safely",
    body: (
      <p>
        Experiment with hosted zones and records without touching real name servers. Nothing you change here is
        published to the internet.
      </p>
    ),
  },
  {
    id: "migrate",
    title: "Plan a DNS migration",
    body: (
      <p>
        Import an existing zone file, review and clean up the records, and export the result, all before changing a
        real provider.
      </p>
    ),
  },
  {
    id: "learn",
    title: "Learn how Route 53 behaves",
    body: (
      <p>
        The console enforces the same rules as Route 53: one record set per name and type, no CNAME at the zone apex
        or next to other records, and protected NS and SOA records at the apex.
      </p>
    ),
  },
];

const FAQS: AccordionEntry[] = [
  {
    id: "aws",
    title: "Is this connected to AWS?",
    body: (
      <p>
        No. Route 53 Clone is an independent demo project and isn&apos;t affiliated with Amazon Web Services. It
        doesn&apos;t call AWS, and it doesn&apos;t publish DNS records anywhere.
      </p>
    ),
  },
  {
    id: "credentials",
    title: "How do I sign in?",
    body: (
      <p>
        Use the demo IAM user: account ID <code>123456789012</code>, user name <code>demo</code>, password{" "}
        <code>Route53Demo!</code>. The sign-in page can also fill these in for you. Never enter real AWS credentials.
      </p>
    ),
  },
  {
    id: "data",
    title: "Where is my data stored?",
    body: (
      <p>
        Hosted zones and records are saved by the demo&apos;s REST API in a SQLite database on persistent storage, so
        they survive restarts. Everyone shares the same demo account, so other visitors can see your changes.
      </p>
    ),
  },
  {
    id: "types",
    title: "Which record types are supported?",
    body: (
      <p>
        A, AAAA, CAA, CNAME, MX, NS, PTR, SRV and TXT, with simple routing. Route 53 manages the SOA record for each
        zone.
      </p>
    ),
  },
];

function Accordion({ items, label }: { items: AccordionEntry[]; label: string }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className={styles.accordion} aria-label={label}>
      {items.map((item) => {
        const expanded = open === item.id;
        const panelId = `${label}-${item.id}-panel`.replace(/\s+/g, "-").toLowerCase();
        return (
          <div className={styles.accordionItem} key={item.id}>
            <h3 style={{ margin: 0 }}>
              <button
                type="button"
                className={styles.accordionTrigger}
                aria-expanded={expanded}
                aria-controls={panelId}
                onClick={() => setOpen(expanded ? null : item.id)}
              >
                <span>{item.title}</span>
                {expanded ? <Minus /> : <Plus />}
              </button>
            </h3>
            {expanded && (
              <div id={panelId} className={styles.accordionPanel}>
                {item.body}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function HowItWorksDiagram() {
  const nodes = [
    { x: 20, title: "You", lines: ["Sign in with the", "demo IAM user"] },
    { x: 270, title: "Route 53 console", lines: ["Hosted zones, records,", "search and filters"] },
    { x: 520, title: "REST API", lines: ["Validates every change", "with Route 53 rules"] },
    { x: 770, title: "Database", lines: ["Zones and records", "saved on disk"] },
  ];
  return (
    <svg viewBox="0 0 1000 220" role="img" aria-labelledby="diagram-title">
      <title id="diagram-title">
        Requests flow from you to the Route 53 console, then to the REST API, which stores hosted zones and records in
        the database.
      </title>
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
          <path d="M0 0L10 5L0 10z" fill="#545b64" />
        </marker>
      </defs>
      {nodes.slice(0, -1).map((node) => (
        <line
          key={node.x}
          x1={node.x + 200}
          y1={70}
          x2={node.x + 246}
          y2={70}
          stroke="#545b64"
          strokeWidth="2"
          markerEnd="url(#arrow)"
        />
      ))}
      {nodes.map((node, index) => (
        <g key={node.title}>
          <rect x={node.x} y={20} width={200} height={100} rx={16} fill="#ffffff" stroke="#c6c6cd" strokeWidth="1.5" />
          <circle cx={node.x + 36} cy={70} r={18} fill={["#ff9900", "#7b3fe4", "#0972d3", "#037f0c"][index]} />
          <text x={node.x + 36} y={76} textAnchor="middle" fontSize="16" fontWeight="700" fill="#ffffff">
            {index + 1}
          </text>
          <text x={node.x + 64} y={76} fontSize="17" fontWeight="600" fill="#0f141a">
            {node.title}
          </text>
          {node.lines.map((line, i) => (
            <text key={line} x={node.x + 100} y={150 + i * 22} textAnchor="middle" fontSize="14" fill="#545b64">
              {line}
            </text>
          ))}
        </g>
      ))}
    </svg>
  );
}

export function LandingPage() {
  const router = useRouter();
  const { status, user, logout } = useAuth();
  const [activeSection, setActiveSection] = useState<string>("overview");
  const [featuresOpen, setFeaturesOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [feedback, setFeedback] = useState<"yes" | "no" | null>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  const signedIn = status === "authenticated";
  const consoleHref = signedIn ? ROUTES.dashboard : loginUrl(ROUTES.dashboard);
  const consoleLabel = signedIn ? "Go to the console" : "Sign in to console";

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting);
        if (visible.length > 0) setActiveSection(visible[0].target.id);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    SECTIONS.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (featuresRef.current && !featuresRef.current.contains(target)) setFeaturesOpen(false);
      if (accountRef.current && !accountRef.current.contains(target)) setAccountOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFeaturesOpen(false);
        setAccountOpen(false);
        setSearchOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const term = query.trim();
    router.push(term ? `${ROUTES.hostedZones}?search=${encodeURIComponent(term)}` : ROUTES.hostedZones);
  };

  return (
    <div className={styles.page}>
      <a href="#overview" className="skip-link">
        Skip to main content
      </a>

      <header className={styles.header}>
        <div className={styles.utilityBar}>
          <span className={styles.demoNote}>Demo project · not affiliated with Amazon Web Services</span>
          <nav className={styles.utilityLinks} aria-label="Utility">
            <span className={`${styles.utilityItem} ${styles.hideMobile}`}>
              <Globe /> English
            </span>
            <a className={styles.hideMobile} href={EXTERNAL_LINKS.readme} target="_blank" rel="noopener noreferrer">
              Documentation
            </a>
            <a className={styles.hideMobile} href={EXTERNAL_LINKS.apiDocs}>
              API reference
            </a>
            <a className={styles.hideMobile} href={EXTERNAL_LINKS.repository} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
            <div className={styles.accountWrap} ref={accountRef}>
              <button
                type="button"
                className={`${styles.utilityButton} ${styles.hideMobile}`}
                aria-expanded={accountOpen}
                aria-haspopup="true"
                onClick={() => setAccountOpen((open) => !open)}
              >
                My account <ChevronDown width={14} height={14} />
              </button>
              <button
                type="button"
                className={styles.userIcon}
                aria-label="My account"
                aria-expanded={accountOpen}
                onClick={() => setAccountOpen((open) => !open)}
              >
                <UserCircle />
              </button>
              {accountOpen && (
                <div className={styles.accountMenu} role="menu">
                  {signedIn && user ? (
                    <>
                      <p>
                        Signed in as {user.username} @ {formatAccountId(user.account_id)}
                      </p>
                      <Link role="menuitem" href={ROUTES.dashboard}>
                        Route 53 console
                      </Link>
                      <Link role="menuitem" href={ROUTES.hostedZones}>
                        Hosted zones
                      </Link>
                      <button role="menuitem" type="button" onClick={() => void logout()}>
                        Sign out
                      </button>
                    </>
                  ) : (
                    <>
                      <p>You aren&apos;t signed in.</p>
                      <Link role="menuitem" href={consoleHref}>
                        Sign in to console
                      </Link>
                    </>
                  )}
                </div>
              )}
            </div>
          </nav>
        </div>

        <div className={styles.mainNav}>
          <Link href="/" className={styles.brand} aria-label="Route 53 Clone home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="" />
            <span>Route 53 Clone</span>
          </Link>
          <span className={styles.navDivider} />
          <nav className={styles.primaryLinks} aria-label="Primary">
            <Link href={consoleHref}>Console</Link>
            <Link href={signedIn ? ROUTES.hostedZones : loginUrl(ROUTES.hostedZones)}>Hosted zones</Link>
            <a href="#features">Features</a>
            <a href={EXTERNAL_LINKS.apiDocs}>API</a>
            <a href={EXTERNAL_LINKS.readme} target="_blank" rel="noopener noreferrer">
              Documentation
            </a>
          </nav>
          <div className={styles.navActions}>
            {searchOpen ? (
              <form className={styles.searchForm} role="search" onSubmit={submitSearch}>
                <Search />
                <input
                  autoFocus
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search hosted zones"
                  aria-label="Search hosted zones"
                />
              </form>
            ) : (
              <button type="button" className={styles.searchToggle} onClick={() => setSearchOpen(true)}>
                <Search /> Search
              </button>
            )}
            <Link href={consoleHref}>{consoleLabel}</Link>
            <Link href={consoleHref} className={styles.pillDark}>
              Try the demo
            </Link>
          </div>
          <button
            type="button"
            className={styles.menuButton}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <Close /> : <Menu />}
          </button>
        </div>
        {mobileOpen && (
          <nav className={styles.mobileMenu} aria-label="Mobile">
            <Link href={consoleHref}>Console</Link>
            <a href="#features" onClick={() => setMobileOpen(false)}>
              Features
            </a>
            <a href={EXTERNAL_LINKS.apiDocs}>API reference</a>
            <a href={EXTERNAL_LINKS.readme} target="_blank" rel="noopener noreferrer">
              Documentation
            </a>
            <a href={EXTERNAL_LINKS.repository} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
            <Link href={consoleHref} className={styles.pillDark}>
              {consoleLabel}
            </Link>
          </nav>
        )}
      </header>

      <div className={styles.subNavWrap}>
        <nav className={styles.subNav} aria-label="Route 53 Clone">
          <span className={styles.subNavTitle}>Route 53 Clone</span>
          <div className={styles.subNavLinks}>
            <a
              href="#overview"
              className={`${styles.subNavLink} ${activeSection === "overview" ? styles.subNavLinkActive : ""}`}
              aria-current={activeSection === "overview" ? "true" : undefined}
            >
              Overview
            </a>
            <div className={styles.featuresWrap} ref={featuresRef}>
              <button
                type="button"
                className={`${styles.subNavLink} ${activeSection === "features" ? styles.subNavLinkActive : ""}`}
                aria-expanded={featuresOpen}
                aria-haspopup="true"
                onClick={() => setFeaturesOpen((open) => !open)}
              >
                Features <ChevronDown width={14} height={14} />
              </button>
              {featuresOpen && (
                <div className={styles.featuresMenu}>
                  {FEATURE_LINKS.map((link) => (
                    <a key={link.label} href={link.href} onClick={() => setFeaturesOpen(false)}>
                      {link.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
            {SECTIONS.slice(2).map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className={`${styles.subNavLink} ${activeSection === section.id ? styles.subNavLinkActive : ""}`}
                aria-current={activeSection === section.id ? "true" : undefined}
              >
                {section.label}
              </a>
            ))}
          </div>
        </nav>
      </div>

      <main>
        <section id="overview" className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.container}>
            <ol className={styles.breadcrumbs} aria-label="Breadcrumbs">
              <li>
                <a href={EXTERNAL_LINKS.repository} target="_blank" rel="noopener noreferrer">
                  Projects
                </a>
              </li>
              <li aria-hidden="true">
                <ChevronRight />
              </li>
              <li>
                <a href="#features">Networking and Content Delivery</a>
              </li>
              <li aria-hidden="true">
                <ChevronRight />
              </li>
              <li aria-current="page">Route 53 Clone</li>
            </ol>
            <h1 id="hero-title" className={styles.heroTitle}>
              Route 53 Clone - DNS service
            </h1>
            <p className={styles.heroSubtitle}>
              A reliable, hands-on way to manage hosted zones and DNS records in a console that works like Route 53
            </p>
            <div className={styles.heroActions}>
              <Link href={consoleHref} className={styles.pillDark}>
                Get started with Route 53
              </Link>
              <a href={EXTERNAL_LINKS.repository} target="_blank" rel="noopener noreferrer" className={styles.pillOutline}>
                View the source code
              </a>
            </div>
          </div>
        </section>

        <section id="features" className={styles.section} aria-labelledby="benefits-title">
          <div className={`${styles.container} ${styles.split}`}>
            <div>
              <h2 id="benefits-title" className={styles.sectionTitle}>
                Benefits of Route 53 Clone
              </h2>
            </div>
            <Accordion items={BENEFITS} label="Benefits" />
          </div>
        </section>

        <section id="how-it-works" className={styles.section} aria-labelledby="how-title">
          <div className={styles.container}>
            <div className={styles.split}>
              <h2 id="how-title" className={styles.sectionTitle}>
                How it works
              </h2>
              <div className={styles.prose}>
                <p>
                  Route 53 Clone gives you a console for the DNS data that Route 53 manages: hosted zones and the records
                  inside them. Domain names such as example.com map to the addresses and services behind them, such as
                  192.0.2.1 or a mail server.
                </p>
                <p>
                  Every change you make in the console goes through a REST API that checks it the way Route 53 would,
                  then saves it in a database. Your zones are still there when you come back. The{" "}
                  <a href={EXTERNAL_LINKS.apiDocs}>API reference</a> lists every endpoint, and the{" "}
                  <a href={EXTERNAL_LINKS.readme} target="_blank" rel="noopener noreferrer">
                    documentation
                  </a>{" "}
                  explains the architecture.
                </p>
              </div>
            </div>
            <div className={styles.diagram}>
              <HowItWorksDiagram />
            </div>
          </div>
        </section>

        <section id="use-cases" className={styles.section} aria-labelledby="use-cases-title">
          <div className={`${styles.container} ${styles.split}`}>
            <h2 id="use-cases-title" className={styles.sectionTitle}>
              Use cases
            </h2>
            <Accordion items={USE_CASES} label="Use cases" />
          </div>
        </section>

        <section className={styles.section} aria-label="Highlights">
          <div className={`${styles.container} ${styles.spotlights}`}>
            <Link href={signedIn ? ROUTES.hostedZones : loginUrl(ROUTES.hostedZones)} className={`${styles.spotlight} ${styles.bgBlue}`}>
              <span className={styles.spotlightKicker}>Hosted zones</span>
              <span className={styles.spotlightTitle}>Create, search, edit and delete hosted zones with full validation</span>
              <ArrowRight className={styles.spotlightArrow} />
            </Link>
            <Link href={signedIn ? ROUTES.hostedZones : loginUrl(ROUTES.hostedZones)} className={`${styles.spotlight} ${styles.bgInk}`}>
              <span className={styles.spotlightKicker}>DNS records</span>
              <span className={styles.spotlightTitle}>Nine record types, each with a form built for its fields</span>
              <ArrowRight className={styles.spotlightArrow} />
            </Link>
            <Link href={signedIn ? ROUTES.hostedZones : loginUrl(ROUTES.hostedZones)} className={`${styles.spotlight} ${styles.bgAmber}`}>
              <span className={styles.spotlightKicker}>Zone files</span>
              <span className={styles.spotlightTitle}>Import and export BIND zone files in a few clicks</span>
              <ArrowRight className={styles.spotlightArrow} />
            </Link>
          </div>
        </section>

        <section id="get-started" className={styles.section} aria-labelledby="get-started-title">
          <div className={styles.container}>
            <h2 id="get-started-title" className={styles.sectionTitle}>
              Get started
            </h2>
            <div className={styles.getStarted}>
              <a
                href={EXTERNAL_LINKS.readme}
                target="_blank"
                rel="noopener noreferrer"
                className={`${styles.spotlight} ${styles.bgBlue}`}
              >
                <span className={styles.spotlightTag}>Documentation</span>
                <span className={styles.spotlightTitle}>Read more about Route 53 Clone</span>
                <ArrowRight className={styles.spotlightArrow} />
              </a>
              <Link href={consoleHref} className={`${styles.spotlight} ${styles.bgRed}`}>
                <span className={styles.spotlightTag}>Getting started</span>
                <span className={styles.spotlightTitle}>{signedIn ? "Open the Route 53 console" : "Sign in to the Route 53 console"}</span>
                <ArrowRight className={styles.spotlightArrow} />
              </Link>
            </div>
          </div>
        </section>

        <section id="faqs" className={styles.section} aria-labelledby="faqs-title">
          <div className={`${styles.container} ${styles.split}`}>
            <h2 id="faqs-title" className={styles.sectionTitle}>
              FAQs
            </h2>
            <Accordion items={FAQS} label="FAQs" />
          </div>
        </section>

        <section className={styles.container} aria-label="Feedback">
          <div className={styles.feedback}>
            <div>
              <h2>Did you find what you were looking for today?</h2>
              <p>Let us know so we can improve this demo.</p>
            </div>
            {feedback === null ? (
              <div className={styles.feedbackActions}>
                <button type="button" className={styles.pillDark} onClick={() => setFeedback("yes")}>
                  Yes <ThumbsUp />
                </button>
                <button type="button" className={styles.pillDark} onClick={() => setFeedback("no")}>
                  No <ThumbsDown />
                </button>
              </div>
            ) : (
              <p className={styles.feedbackThanks} role="status">
                {feedback === "yes" ? (
                  <>
                    Great! <Link href={consoleHref}>Open the console</Link> to try it out.
                  </>
                ) : (
                  <>
                    Sorry about that.{" "}
                    <a href={EXTERNAL_LINKS.issues} target="_blank" rel="noopener noreferrer">
                      Open an issue on GitHub
                    </a>{" "}
                    and tell us what&apos;s missing.
                  </>
                )}
              </p>
            )}
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={styles.footerTop}>
            <Link href={consoleHref} className={styles.pillLight}>
              {consoleLabel}
            </Link>
            <span className={styles.pillOutlineLight}>
              <Globe /> English
            </span>
          </div>
          <div className={styles.footerColumns}>
            <div>
              <h2>Console</h2>
              <ul>
                <li>
                  <Link href={signedIn ? ROUTES.dashboard : loginUrl(ROUTES.dashboard)}>Dashboard</Link>
                </li>
                <li>
                  <Link href={signedIn ? ROUTES.hostedZones : loginUrl(ROUTES.hostedZones)}>Hosted zones</Link>
                </li>
                <li>
                  <Link href={signedIn ? ROUTES.createHostedZone : loginUrl(ROUTES.createHostedZone)}>Create hosted zone</Link>
                </li>
                <li>
                  <Link href={ROUTES.login}>Sign in</Link>
                </li>
              </ul>
            </div>
            <div>
              <h2>Resources</h2>
              <ul>
                <li>
                  <a href={EXTERNAL_LINKS.readme} target="_blank" rel="noopener noreferrer">
                    Documentation
                  </a>
                </li>
                <li>
                  <a href={EXTERNAL_LINKS.apiDocs}>API reference</a>
                </li>
                <li>
                  <a href={EXTERNAL_LINKS.openApi}>OpenAPI schema</a>
                </li>
                <li>
                  <a href={EXTERNAL_LINKS.health}>Service health</a>
                </li>
              </ul>
            </div>
            <div>
              <h2>Developers</h2>
              <ul>
                <li>
                  <a href={EXTERNAL_LINKS.repository} target="_blank" rel="noopener noreferrer">
                    Source code
                  </a>
                </li>
                <li>
                  <a href={EXTERNAL_LINKS.backendSource} target="_blank" rel="noopener noreferrer">
                    Backend (FastAPI)
                  </a>
                </li>
                <li>
                  <a href={EXTERNAL_LINKS.frontendSource} target="_blank" rel="noopener noreferrer">
                    Frontend (Next.js)
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h2>Help</h2>
              <ul>
                <li>
                  <a href="#faqs">FAQs</a>
                </li>
                <li>
                  <a href={EXTERNAL_LINKS.issues} target="_blank" rel="noopener noreferrer">
                    Report an issue
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className={styles.backToTop}>
            <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}>
              Back to top <ArrowUp />
            </button>
          </div>
          <div className={styles.legal}>
            <p>
              Route 53 Clone is an independent demo project. It isn&apos;t affiliated with, endorsed by, or sponsored by
              Amazon Web Services. Amazon Web Services, AWS and Route 53 are trademarks of Amazon.com, Inc. or its
              affiliates.
            </p>
            <p>© 2026 Route 53 Clone</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
