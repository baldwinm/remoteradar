import type { Map as MapboxMap, Marker } from 'mapbox-gl';
import { useEffect, useRef, useState } from 'react';

import type { Place, PlaceType } from '../api/types';
import { MAPBOX_TOKEN } from '../config';
import { type Theme, useTheme } from '../lib/theme';
import './CityMap.css';

const STYLES = [
  { id: 'streets-v12', name: 'Street Map' },
  { id: 'satellite-v9', name: 'Satellite' },
  { id: 'satellite-streets-v12', name: 'Satellite with Streets' },
  { id: 'light-v11', name: 'Light' },
  { id: 'dark-v11', name: 'Dark' },
  { id: 'outdoors-v12', name: 'Outdoors' },
] as const;

type StyleId = (typeof STYLES)[number]['id'];
type MapboxGl = typeof import('mapbox-gl');

const LEGEND: { type: PlaceType; label: string }[] = [
  { type: 'coffee', label: 'Coffee' },
  { type: 'coworking', label: 'Coworking' },
  { type: 'restaurant', label: 'Restaurants' },
];

const THEME_STYLES: Record<Theme, StyleId> = { light: 'light-v11', dark: 'dark-v11' };

const styleUrl = (id: StyleId) => `mapbox://styles/mapbox/${id}`;

interface Props {
  name: string;
  lat: number;
  lng: number;
  /** Pinned on the map, colored by type. */
  places?: Place[];
}

export default function CityMap({ name, lat, lng, places = [] }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapboxMap | null>(null);
  const lib = useRef<MapboxGl | null>(null);
  const theme = useTheme();
  const [style, setStyle] = useState<StyleId>(() => THEME_STYLES[theme]);
  const styleRef = useRef(style);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    let instance: MapboxMap | undefined;

    async function init() {
      // mapbox-gl is large; load it only when a map is actually on screen.
      const [{ default: mapboxgl }] = await Promise.all([
        import('mapbox-gl'),
        import('mapbox-gl/dist/mapbox-gl.css'),
      ]);
      if (cancelled || !container.current) return;

      lib.current = mapboxgl;
      mapboxgl.accessToken = MAPBOX_TOKEN;
      instance = new mapboxgl.Map({
        container: container.current,
        style: styleUrl(styleRef.current),
        center: [lng, lat],
        zoom: 12,
        // Scrolling the page shouldn't zoom the map; ctrl/⌘ + scroll or two fingers does.
        cooperativeGestures: true,
      });
      instance.addControl(new mapboxgl.NavigationControl(), 'top-right');
      new mapboxgl.Marker({ color: '#16161a' }).setLngLat([lng, lat]).addTo(instance);

      let loaded = false;
      instance.on('load', () => {
        loaded = true;
        if (!cancelled) setStatus('ready');
      });
      instance.on('error', (event) => {
        // Individual tiles failing is normal and recovers on its own; only a map that
        // never finished loading (bad token, blocked network) is shown as an error.
        console.error('Map error', event.error);
        if (!loaded && !cancelled) setStatus('error');
      });
      map.current = instance;
    }

    init().catch((error: unknown) => {
      console.error('Map failed to start', error);
      if (!cancelled) setStatus('error');
    });

    return () => {
      cancelled = true;
      instance?.remove();
      map.current = null;
    };
  }, [lat, lng]);

  useEffect(() => {
    const mapboxgl = lib.current;
    const instance = map.current;
    if (status !== 'ready' || !mapboxgl || !instance) return;
    const markers: Marker[] = [];
    for (const place of places) {
      if (place.lat === null || place.lng === null) continue;
      const element = document.createElement('div');
      element.className = `map-pin map-pin--${place.type}`;
      element.title = place.name;
      const popup = new mapboxgl.Popup({ offset: 10, closeButton: false }).setText(place.name);
      markers.push(new mapboxgl.Marker({ element }).setLngLat([place.lng, place.lat]).setPopup(popup).addTo(instance));
    }
    return () => markers.forEach((marker) => marker.remove());
  }, [places, status]);

  // While the map uses the plain light or dark style, keep it in step with the site theme.
  useEffect(() => {
    const current = styleRef.current;
    const next = THEME_STYLES[theme];
    if (current === next || (current !== 'light-v11' && current !== 'dark-v11')) return;
    changeStyle(next);
  }, [theme]);

  function changeStyle(next: StyleId) {
    setStyle(next);
    styleRef.current = next;
    map.current?.setStyle(styleUrl(next));
  }

  return (
    <section className="card city-map" aria-label={`Map of ${name}`}>
      <div className="map-frame">
        {/* Mapbox takes over this element, so React must not render anything inside it. */}
        <div ref={container} className="map-canvas" />
        {status === 'error' && (
          <div className="map-error">
            <p>The map couldn't be loaded.</p>
          </div>
        )}
      </div>
      <div className="map-controls">
        <ul className="map-legend" aria-label="Pin colors">
          {LEGEND.map((item) => (
            <li key={item.type}>
              <span className={`map-dot map-pin--${item.type}`} aria-hidden="true" />
              {item.label}
            </li>
          ))}
        </ul>
        <label className="map-style-selector">
          Style
          <select
            className="select"
            value={style}
            onChange={(event) => changeStyle(event.target.value as StyleId)}
            disabled={status !== 'ready'}
          >
            {STYLES.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}
