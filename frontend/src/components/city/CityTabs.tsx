import { type MouseEvent, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router';

import { useWorkScore } from '../../api/queries';
import type { City } from '../../api/types';
import { scrollBehavior, useIsPhone, useOnScroll } from '../../lib/layout';
import Icon, { Logo } from '../Icon';
import { openSearch } from '../Search';
import { Ring } from '../ui';
import { SaveButton } from './CityHero';
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
          {tab.label}
        </a>
      ))}
      <span className="ink" ref={ink} aria-hidden="true" />
    </nav>
  );
}

/** Desktop: a bar that takes over from the site header once the hero scrolls away. */
function SectionBar({ city, dataId }: { city: City; dataId: string }) {
  const dock = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);
  const active = useActiveSection(140);
  const score = useWorkScore(dataId);
  useOnScroll(() => {
    const node = dock.current;
    if (node) setOn(node.getBoundingClientRect().top <= 1);
  });

  return (
    <div className="subnav-dock" ref={dock}>
      <div className={`subnav${on ? ' is-on' : ''}`}>
        <div className="wrap">
          <Link className="subnav-home" to="/" aria-label="Remote Radar home">
            <Logo size={24} />
          </Link>
          <span className="subnav-sep" aria-hidden="true" />
          <span className="subnav-city">
            <Ring score={score.data?.score} size={30} stroke={3.5} />
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

/** The city page's section tabs: a bar on desktop, a strip of tabs under the header on phones. */
export default function CityTabs({ city, dataId }: { city: City; dataId: string }) {
  return useIsPhone() ? <PhoneTabs /> : <SectionBar city={city} dataId={dataId} />;
}
