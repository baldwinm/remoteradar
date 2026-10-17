import { type MouseEvent, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';

import type { City } from '../../api/types';
import { useLayerElement } from '../../lib/chrome';
import { scrollBehavior, useIsPhone, useOnScroll } from '../../lib/layout';
import { useSavedCities } from '../../lib/savedCities';
import Icon, { Logo } from '../Icon';
import { openSearch } from '../Search';
import { SaveButton, compareWith } from './CityHero';
import { type SectionId, TABS, goToSection } from './common';

const MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** The section that has reached `line` pixels from the top of the screen, if any. */
function useActiveSection(line: number): SectionId | null {
  const [active, setActive] = useState<SectionId | null>(null);
  useOnScroll(() => {
    let current: SectionId | null = null;
    for (const tab of TABS) {
      const element = document.querySelector(`[data-sec="${tab.id}"]`);
      if (element && element.getBoundingClientRect().top <= line) current = tab.id;
    }
    setActive(current);
  });
  return active;
}

function Tabs({ active, phone }: { active: SectionId | null; phone: boolean }) {
  const nav = useRef<HTMLElement>(null);
  const ink = useRef<HTMLSpanElement>(null);

  // The ink line slides under the current tab; on phones the tabs scroll to keep it in view.
  useLayoutEffect(() => {
    const box = nav.current;
    const line = ink.current;
    if (!box || !line) return;
    const link = active ? box.querySelector<HTMLElement>(`a[data-tab="${active}"]`) : null;
    function place() {
      if (!line) return;
      line.style.opacity = link ? '1' : '0';
      if (!link) return;
      const pad = parseFloat(getComputedStyle(link).paddingLeft) || 0;
      line.style.width = `${link.offsetWidth - pad * 2}px`;
      line.style.transform = `translateX(${link.offsetLeft + pad}px)`;
    }
    place();
    if (phone && link && box) {
      box.scrollTo({ left: link.offsetLeft - box.clientWidth / 2 + link.offsetWidth / 2, behavior: scrollBehavior() });
    }
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [active, phone]);

  function jump(event: MouseEvent, id: SectionId) {
    event.preventDefault();
    goToSection(id);
  }

  return (
    <nav className="tabs" aria-label="Sections" ref={nav}>
      {TABS.map((tab) => (
        <a
          key={tab.id}
          href={`#${tab.id}`}
          data-tab={tab.id}
          aria-current={active === tab.id ? 'true' : undefined}
          onClick={(event) => jump(event, tab.id)}
        >
          {phone ? tab.short : tab.label}
        </a>
      ))}
      <span className="ink" ref={ink} aria-hidden="true" />
    </nav>
  );
}

/**
 * Desktop: a row of tabs right under the hero, then a bar that takes over from the site header once
 * that row scrolls away.
 */
function SectionBar({ city }: { city: City }) {
  const dock = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  const active = useActiveSection(140);
  useOnScroll(() => {
    const node = dock.current;
    if (node) setOn(node.getBoundingClientRect().top <= 1);
  });

  return (
    <>
      {/* One set of section tabs at a time: this row until the pinned bar takes over. */}
      <div className="sec-tabs" aria-hidden={on} inert={on}>
        <div className="wrap">
          <Tabs active={active} phone={false} />
        </div>
      </div>
      <div className="subnav-dock" ref={dock}>
        <div className={`subnav${on ? ' is-on' : ''}`} aria-hidden={!on} inert={!on}>
          <div className="wrap">
            <Link className="subnav-home" to="/" aria-label="Remote Radar home">
              <Logo size={24} />
            </Link>
            <span className="subnav-sep" aria-hidden="true" />
            <span className="subnav-city">
              <span className="subnav-name">{city.name}</span>
            </span>
            <Tabs active={active} phone={false} />
            <div className="subnav-acts">
              <button type="button" className="btn btn-ghost" onClick={() => openSearch()}>
                <Icon name="search" size={16} />
                <span className="subnav-label">Search</span>
                <span className="kbd" aria-hidden="true">
                  {MAC ? '⌘K' : 'Ctrl K'}
                </span>
              </button>
              <SaveButton city={city} className="btn-secondary" size={16} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function PhoneTabs() {
  const active = useActiveSection(120);
  return (
    <div className="ptabs">
      <Tabs active={active} phone />
    </div>
  );
}

/** The city page's section tabs: a row and a pinned bar on desktop, a strip under the header on phones. */
export default function CityTabs({ city }: { city: City }) {
  return useIsPhone() ? <PhoneTabs /> : <SectionBar city={city} />;
}

/**
 * Phones: Save and Compare stay at the bottom of the screen once the hero's own buttons scroll away.
 * The root gets `has-actbar` while it's on the page (room at the bottom) and `actbar-on` while it shows
 * (the map button and toasts move up out of its way).
 */
export function PhoneActionBar({ city }: { city: City }) {
  const phone = useIsPhone();
  const layer = useLayerElement();
  const saved = useSavedCities();
  const [on, setOn] = useState(false);
  useOnScroll(() => {
    const hero = document.querySelector('.acts3');
    setOn(hero ? hero.getBoundingClientRect().bottom < 0 : false);
  });

  useEffect(() => {
    if (!phone) return;
    const root = document.documentElement;
    root.classList.add('has-actbar');
    return () => root.classList.remove('has-actbar', 'actbar-on');
  }, [phone]);
  useEffect(() => {
    if (phone) document.documentElement.classList.toggle('actbar-on', on);
  }, [phone, on]);

  if (!phone || !layer) return null;
  return createPortal(
    <div className={`actbar${on ? ' is-on' : ''}`} aria-hidden={!on} inert={!on}>
      <SaveButton city={city} className="btn-primary" size={18} named />
      <Link className="btn btn-secondary" to={compareWith(city, saved)}>
        <Icon name="compare" size={18} />
        Compare
      </Link>
    </div>,
    layer,
  );
}
