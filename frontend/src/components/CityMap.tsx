import type { Map as MapboxMap } from 'mapbox-gl';
import { useEffect, useRef, useState } from 'react';

import { MAPBOX_TOKEN } from '../config';
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

const styleUrl = (id: StyleId) => `mapbox://styles/mapbox/${id}`;

interface Props {
  name: string;
  lat: number;
  lng: number;
}

export default function CityMap({ name, lat, lng }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapboxMap | null>(null);
  const [style, setStyle] = useState<StyleId>('streets-v12');
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
      new mapboxgl.Marker().setLngLat([lng, lat]).addTo(instance);

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

  function changeStyle(next: StyleId) {
    setStyle(next);
    styleRef.current = next;
    map.current?.setStyle(styleUrl(next));
  }

  return (
    <section className="city-map-container" aria-label={`Map of ${name}`}>
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
        <label className="map-style-selector">
          Map style:
          <select
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
