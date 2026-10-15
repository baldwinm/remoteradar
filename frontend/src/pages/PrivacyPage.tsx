import { type MouseEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router';

import Icon, { type IconName } from '../components/Icon';
import { CONTACT_EMAIL } from '../config';
import { jumpTo, toast } from '../lib/chrome';
import { isPhoneNow, useIsPhone, useOnScroll } from '../lib/layout';

const UPDATED = 'October 15, 2026';

const SECTIONS = [
  { id: 'server', title: 'What our server sees' },
  { id: 'device', title: "What's stored on your device" },
  { id: 'analytics', title: 'Analytics' },
  { id: 'services', title: 'Services we use' },
  { id: 'choices', title: 'Your choices' },
  { id: 'contact', title: 'Changes and contact' },
] as const;

type SectionKey = (typeof SECTIONS)[number]['id'];

const isSection = (value: string): value is SectionKey => SECTIONS.some((section) => section.id === value);

const PROMISES: readonly { icon: IconName; title: string; text: string }[] = [
  { icon: 'user-x', title: 'No sign-up', text: 'You never give us your name, email or any account details.' },
  { icon: 'cookie', title: 'No cookies', text: "The site doesn't set cookies, and our analytics don't use them." },
  {
    icon: 'device',
    title: 'Settings stay with you',
    text: 'Saved cities and your settings are kept in your browser, not on our servers.',
  },
  { icon: 'ban', title: 'No ads or data sales', text: "We don't sell data, show ads or build profiles." },
];

type Sees = 'no' | 'yes' | 'not-kept';

const SERVICES: readonly { name: string; use: string; sees: Sees }[] = [
  { name: 'OpenCage', use: 'Finding cities', sees: 'no' },
  { name: 'Google Places', use: 'Cafés, coworking and other places', sees: 'no' },
  { name: 'Open-Meteo', use: 'Weather and climate', sees: 'no' },
  { name: 'Booking.com via RapidAPI', use: 'Hotel prices', sees: 'no' },
  { name: 'ExchangeRate-API', use: 'Currency rates', sees: 'no' },
  { name: 'Nager.Date', use: 'Public holidays', sees: 'no' },
  { name: 'Speedtest® by Ookla®', use: 'Internet speeds, bundled with the site', sees: 'no' },
  { name: 'Mapbox', use: 'The map on city pages', sees: 'yes' },
  { name: 'Booking.com images', use: 'Hotel photos', sees: 'yes' },
  { name: 'GoatCounter', use: 'Counting page visits', sees: 'not-kept' },
];

function SeesCell({ sees }: { sees: Sees }) {
  if (sees === 'yes') {
    return (
      <span className="pv-sees yes" role="cell">
        <Icon name="alert" size={15} />
        Yes, loads in your browser
      </span>
    );
  }
  return (
    <span className="pv-sees no" role="cell">
      <Icon name="check" size={15} />
      {sees === 'no' ? 'No' : "Sees it, doesn't store it"}
    </span>
  );
}

function OutLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a className="link" href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

/** Scrolls to a section, clear of the sticky header on desktop. */
function goTo(id: SectionKey, smooth = true) {
  jumpTo(id, isPhoneNow() ? -20 : -88, smooth);
}

export default function PrivacyPage() {
  const phone = useIsPhone();
  const { hash } = useLocation();
  const [active, setActive] = useState<SectionKey>('server');
  const phoneToc = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    document.title = 'Privacy policy - Remote Radar';
    return () => {
      document.title = 'Remote Radar - Find Your Perfect Remote Work Destination';
    };
  }, []);

  // A link to a section (the footer's Contact goes to /privacy#contact) opens at that section.
  useEffect(() => {
    const id = hash.slice(1);
    if (!isSection(id)) return;
    const frame = requestAnimationFrame(() => goTo(id, false));
    return () => cancelAnimationFrame(frame);
  }, [hash]);

  // Desktop: the contents list marks the section being read.
  useOnScroll(() => {
    if (phone) return;
    let current: SectionKey = SECTIONS[0].id;
    for (const section of SECTIONS) {
      const element = document.querySelector(`[data-sec="${section.id}"]`);
      if (element && element.getBoundingClientRect().top < 160) current = section.id;
    }
    // The last section is short and may never reach the top, so the end of the page counts as it.
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = 'contact';
    setActive(current);
  });

  function jump(event: MouseEvent, id: SectionKey) {
    event.preventDefault();
    if (phoneToc.current) phoneToc.current.open = false;
    goTo(id);
  }

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL);
      toast('Email address copied');
    } catch {
      toast("Couldn't copy it. Select the address to copy it instead.");
    }
  }

  const links = SECTIONS.map((section) => (
    <a
      key={section.id}
      href={`#${section.id}`}
      aria-current={!phone && active === section.id ? 'true' : undefined}
      onClick={(event) => jump(event, section.id)}
    >
      {section.title}
    </a>
  ));

  return (
    <div className="wrap">
      <header className="pv-hero">
        <span className="pill pill-good">
          <Icon name="check" size={13} />
          Last updated {UPDATED}
        </span>
        <h1>Privacy policy</h1>
        <p>
          Remote Radar has no accounts, no cookies and no ads, and we don&apos;t sell or share personal data.
          Here&apos;s the little information the site does handle, and why.
        </p>
      </header>

      <ul className="pv-promises" aria-label="The short version">
        {PROMISES.map((promise) => (
          <li className="pv-promise" key={promise.title}>
            <span className="tile">
              <Icon name={promise.icon} size={20} />
            </span>
            <b>{promise.title}</b>
            <span>{promise.text}</span>
          </li>
        ))}
      </ul>

      <div className="pv-body">
        {phone ? (
          <details className="pv-toc-m" ref={phoneToc}>
            <summary>
              On this page
              <Icon name="chevron-down" size={18} />
            </summary>
            <nav aria-label="On this page">{links}</nav>
          </details>
        ) : (
          <nav className="pv-toc" aria-label="On this page">
            <b aria-hidden="true">On this page</b>
            {links}
          </nav>
        )}

        <article className="pv-article">
          <section id="server" data-sec="server" aria-labelledby="server-title">
            <h2 id="server-title">What our server sees</h2>
            <p>
              Like any website, our server receives your IP address and basic browser details when you load a page.
              Here&apos;s what happens to them:
            </p>
            <ul className="pv-list">
              <li>
                <strong>Request logs.</strong> We log the page or data requested, the result and how long it took. We
                don&apos;t log your IP address or what you type into search.
              </li>
              <li>
                <strong>Abuse protection.</strong> To stop automated scraping, we count requests per IP address. The
                address is kept only as a scrambled code, in memory, and each count is deleted after at most one
                minute.
              </li>
              <li>
                <strong>Hosting.</strong> The site runs on Render, which may keep standard network logs (including IP
                addresses) for security and reliability under{' '}
                <OutLink href="https://render.com/privacy">its own privacy policy</OutLink>.
              </li>
            </ul>
          </section>

          <section id="device" data-sec="device" aria-labelledby="device-title">
            <h2 id="device-title">What&apos;s stored on your device</h2>
            <p>
              The site keeps a few settings in your browser&apos;s local storage so they&apos;re there next time.
              They never leave your device, and you can clear them at any time in your browser settings.
            </p>
            <ul className="pv-list">
              <li>Your light or dark theme choice</li>
              <li>Whether temperatures show in °C or °F</li>
              <li>Cities you save, and cities you recently viewed</li>
              <li>The home time zone you pick for the work-overlap view</li>
            </ul>
            <p>
              On city pages, the Mapbox map also keeps a random ID and a little usage data in local storage, which it
              sends to Mapbox with its anonymous usage counts. See{' '}
              <OutLink href="https://www.mapbox.com/legal/privacy">Mapbox&apos;s privacy policy</OutLink>.
            </p>
          </section>

          <section id="analytics" data-sec="analytics" aria-labelledby="analytics-title">
            <h2 id="analytics-title">Analytics</h2>
            <p>
              We use <OutLink href="https://www.goatcounter.com/help/privacy">GoatCounter</OutLink>, a
              privacy-friendly counter, to see which pages are visited. It doesn&apos;t use cookies, doesn&apos;t
              track you across sites and doesn&apos;t store IP addresses. It records the page, the referring site,
              browser and screen size, and an approximate country.
            </p>
            <p>
              To show popular cities on the home page, we also count how many times each city page is opened, grouped
              by country. The country comes from your browser&apos;s time zone setting, not your IP address. We keep
              only daily totals per city and country for 30 days, with nothing that identifies you or links one visit
              to another.
            </p>
          </section>

          <section id="services" data-sec="services" aria-labelledby="services-title">
            <h2 id="services-title">Services we use</h2>
            <p>
              Most providers get the city name or map coordinates from our server, never your IP address. Two things
              load directly in your browser, so those providers do see it.
            </p>
            <div className="pv-table" role="table" aria-label="Services we use, and whether they see your IP address">
              <div className="pv-tr head" role="row">
                <span role="columnheader">Provider</span>
                <span role="columnheader">Used for</span>
                <span role="columnheader">Sees your IP?</span>
              </div>
              {SERVICES.map((service) => (
                <div className="pv-tr" role="row" key={service.name}>
                  <b role="rowheader">{service.name}</b>
                  <span role="cell">{service.use}</span>
                  <SeesCell sees={service.sees} />
                </div>
              ))}
            </div>
            <p>
              Links to Google Maps, Booking.com and business websites take you to those sites, where their own privacy
              policies apply.
            </p>
          </section>

          <section id="choices" data-sec="choices" aria-labelledby="choices-title">
            <h2 id="choices-title">Your choices</h2>
            <p>
              Because we don&apos;t keep personal data tied to you, there&apos;s nothing for us to look up, export or
              delete. To remove the settings stored on your device, clear this site&apos;s data in your browser.
              Remote Radar isn&apos;t aimed at children under 13.
            </p>
          </section>

          <section id="contact" data-sec="contact" aria-labelledby="contact-title">
            <h2 id="contact-title">Changes and contact</h2>
            <p>If this policy changes, we&apos;ll update this page and the date at the top.</p>
            <div className="pv-contact">
              <div>
                <span>Questions about privacy</span>
                <b>
                  <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
                </b>
              </div>
              <button type="button" className="btn btn-secondary" onClick={() => void copyEmail()}>
                <Icon name="copy" size={16} />
                Copy address
              </button>
            </div>
          </section>
        </article>
      </div>
    </div>
  );
}
