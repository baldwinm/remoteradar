import { useEffect } from 'react';
import { Link } from 'react-router';

import { CONTACT_EMAIL } from '../config';
import './PrivacyPage.css';

const UPDATED = 'October 13, 2026';

export default function PrivacyPage() {
  useEffect(() => {
    document.title = 'Privacy policy - Remote Radar';
    return () => {
      document.title = 'Remote Radar - Find Your Perfect Remote Work Destination';
    };
  }, []);

  return (
    <article className="privacy">
      <header className="privacy-head">
        <p className="eyebrow">Last updated {UPDATED}</p>
        <h1>Privacy policy</h1>
        <p className="privacy-lede">
          Remote Radar has no accounts, no cookies and no ads, and we don't sell or share personal data. This page
          explains the little information the site does handle, and why.
        </p>
      </header>

      <section aria-labelledby="p-short">
        <h2 id="p-short">The short version</h2>
        <ul className="privacy-summary">
          <li>
            <strong>No sign-up.</strong> You never give us your name, email or any account details.
          </li>
          <li>
            <strong>No cookies.</strong> The site doesn't set cookies, and our analytics don't use them.
          </li>
          <li>
            <strong>Your settings stay on your device.</strong> Saved cities and your theme choice are stored in
            your browser, not on our servers.
          </li>
          <li>
            <strong>No selling or advertising.</strong> We don't sell data, show ads or build profiles.
          </li>
        </ul>
      </section>

      <section aria-labelledby="p-server">
        <h2 id="p-server">What our server sees</h2>
        <p>
          Like any website, our server receives your IP address and basic browser details when you load a page.
          Here is what happens to them:
        </p>
        <ul>
          <li>
            <strong>Request logs.</strong> We log the page or data requested, the result and how long it took. We
            don't log your IP address or the text you type into search.
          </li>
          <li>
            <strong>Abuse protection.</strong> To stop automated scraping, we count requests per IP address. The
            address is only kept as a scrambled code, in memory, and each count is deleted after at most one minute.
          </li>
          <li>
            <strong>Hosting.</strong> The site runs on Render, which may keep standard network logs (including IP
            addresses) for security and reliability under{' '}
            <a href="https://render.com/privacy" target="_blank" rel="noopener noreferrer">
              its own privacy policy
            </a>
            .
          </li>
        </ul>
      </section>

      <section aria-labelledby="p-device">
        <h2 id="p-device">What's stored on your device</h2>
        <p>
          The site keeps a few settings in your browser's local storage so they're there next time. They never
          leave your device, and you can clear them at any time in your browser settings.
        </p>
        <ul>
          <li>Your light or dark theme choice</li>
          <li>Cities you save, and cities you recently viewed</li>
          <li>The home time zone you pick for the work-overlap view</li>
        </ul>
        <p>
          On city pages, the Mapbox map also keeps a random ID and a little usage data in local storage, which it
          sends to Mapbox with its anonymous usage counts (see below).
        </p>
      </section>

      <section aria-labelledby="p-analytics">
        <h2 id="p-analytics">Analytics</h2>
        <p>
          We use{' '}
          <a href="https://www.goatcounter.com/help/privacy" target="_blank" rel="noopener noreferrer">
            GoatCounter
          </a>
          , a privacy-friendly counter, to see which pages are visited. It doesn't use cookies, doesn't track you
          across sites, and doesn't store IP addresses. It records the page, the referring site, browser and screen
          size, and an approximate country.
        </p>
        <p>
          To show popular cities on the home page, we also count how many times each city page is opened, grouped by
          country. The country comes from your browser's time zone setting, not your IP address. We keep only daily
          totals per city and country for 30 days, with nothing that identifies you or links one visit to another.
        </p>
      </section>

      <section aria-labelledby="p-third">
        <h2 id="p-third">Services that help build each city page</h2>
        <p>
          Our server looks up city information from these providers. They receive the city name or map
          coordinates from our server, not your IP address or anything about you:
        </p>
        <ul className="privacy-columns">
          <li>OpenCage (finding cities)</li>
          <li>Google Places (cafés, coworking, restaurants)</li>
          <li>Open-Meteo (weather and climate)</li>
          <li>Booking.com via RapidAPI (hotel prices)</li>
          <li>ExchangeRate-API (currency rates)</li>
          <li>Nager.Date (public holidays)</li>
        </ul>
        <p>Internet speeds come from Speedtest® by Ookla® open data that we bundle with the site, so no lookup is made.</p>
        <p>Two things load directly in your browser, so those providers do see your IP address:</p>
        <ul>
          <li>
            <strong>The map</strong> comes from Mapbox, which receives the area being viewed and anonymous usage
            data. See{' '}
            <a href="https://www.mapbox.com/legal/privacy" target="_blank" rel="noopener noreferrer">
              Mapbox's privacy policy
            </a>
            .
          </li>
          <li>
            <strong>Hotel photos</strong> load from Booking.com's image servers.
          </li>
        </ul>
        <p>
          Links to Google Maps, Booking.com and business websites take you to those sites, where their own
          privacy policies apply.
        </p>
      </section>

      <section aria-labelledby="p-rights">
        <h2 id="p-rights">Your choices</h2>
        <p>
          Because we don't keep personal data tied to you, there's nothing for us to look up, export or delete. To
          remove the settings stored on your device, clear this site's data in your browser. Remote Radar isn't
          aimed at children under 13.
        </p>
      </section>

      <section aria-labelledby="p-changes">
        <h2 id="p-changes">Changes and contact</h2>
        <p>
          If this policy changes, we'll update this page and the date at the top.{' '}
          {CONTACT_EMAIL ? (
            <>
              Questions? Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </>
          ) : (
            <span className="privacy-todo">Questions? Email [contact email needed].</span>
          )}
        </p>
      </section>

      <p className="privacy-back">
        <Link to="/">Back to search</Link>
      </p>
    </article>
  );
}
