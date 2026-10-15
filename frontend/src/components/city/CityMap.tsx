import type { Map as MapboxMap, Marker } from 'mapbox-gl';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import type { Place, PlaceType } from '../../api/types';
import { MAPBOX_TOKEN } from '../../config';
import { prefersReducedMotion } from '../../lib/layout';
import { type Theme, useTheme } from '../../lib/theme';
import Icon from '../Icon';
import { Seg } from '../ui';
import { PLACE_KINDS } from './common';

type MapboxGl = (typeof import('mapbox-gl'))['default'];
type Look = 'map' | 'satellite';

/** A place that has coordinates, so it can be pinned. */
export type Pinned = Place & { lat: number; lng: number };
export const hasCoords = (place: Place): place is Pinned => place.lat !== null && place.lng !== null;

export interface Padding {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

function styleUrl(look: Look, theme: Theme): string {
  if (look === 'satellite') return 'mapbox://styles/mapbox/satellite-streets-v12';
  return theme === 'dark' ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11';
}

interface Props {
  /** Read out for the map: "Map of places in Lisbon". */
  label: string;
  lat: number;
  lng: number;
  pins: Pinned[];
  /** The highlighted pin. */
  hot: string | null;
  onPin: (id: string) => void;
  onHover?: (id: string | null) => void;
  /** A click on the map itself, not on a pin. */
  onBackground?: () => void;
  /** The map fits itself to the pins each time this changes, such as when another kind of place is picked. */
  fitKey: string;
  /** Room around the pins when fitting, clear of the controls or cards on top of the map. */
  padding: Padding;
  /** Pans to the highlighted pin whenever it changes (the phone map, where cards pick the pin). */
  followHot?: boolean;
  /** Desktop: the place whose card is open on the map, and the card. */
  focus?: Pinned | null;
  card?: ReactNode;
  /** Moves keyboard focus into the card when it opens, when it was opened from the keyboard. */
  focusCard?: boolean;
  /** Scrolling the page past the map doesn't zoom it; ctrl or ⌘ and scroll, or two fingers, does. */
  cooperative?: boolean;
  /** Map or satellite, zoom and recenter buttons, and the legend. */
  controls?: boolean;
  className?: string;
}

/** A live Mapbox map of the city with a colored pin per place. */
export default function CityMap(props: Props) {
  const {
    lat,
    lng,
    pins,
    hot,
    fitKey,
    padding,
    followHot = false,
    focus = null,
    card,
    focusCard = false,
    cooperative = true,
    controls = true,
    className,
  } = props;
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const libRef = useRef<MapboxGl | null>(null);
  const markers = useRef(new Map<string, { marker: Marker; element: HTMLElement }>());
  // Pins and the map call back through this, so they always reach the latest handlers.
  const handlers = useRef(props);
  useEffect(() => {
    handlers.current = props;
  });
  const theme = useTheme();
  const [look, setLook] = useState<Look>('map');
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const style = styleUrl(look, theme);
  // The style the map is showing; it starts with the one picked on the first render.
  const shownStyle = useRef(style);
  // Mapbox moves this element into its card; React renders the card's content into it.
  const [cardNode] = useState(() => document.createElement('div'));
  const fitted = useRef<string | null>(null);
  const followed = useRef<string | null>(null);

  useEffect(() => {
    const node = box.current;
    const pinned = markers.current;
    let cancelled = false;
    let map: MapboxMap | undefined;

    async function init() {
      // mapbox-gl is large, so it loads only when a map is about to be seen.
      const [{ default: mapboxgl }] = await Promise.all([import('mapbox-gl'), import('mapbox-gl/dist/mapbox-gl.css')]);
      if (cancelled || !node) return;
      libRef.current = mapboxgl;
      mapboxgl.accessToken = MAPBOX_TOKEN;
      map = new mapboxgl.Map({
        container: node,
        style: shownStyle.current,
        center: [lng, lat],
        zoom: 12.5,
        cooperativeGestures: cooperative,
        attributionControl: false,
        // The legend sits at the bottom left, so the logo joins the credits at the bottom right.
        logoPosition: 'bottom-right',
        dragRotate: false,
        pitchWithRotate: false,
      });
      map.touchZoomRotate.disableRotation();
      map.addControl(new mapboxgl.AttributionControl({ compact: true }), 'bottom-right');
      map.getCanvas().setAttribute('aria-label', handlers.current.label);

      const center = document.createElement('div');
      center.className = 'mk-center';
      center.setAttribute('aria-hidden', 'true');
      new mapboxgl.Marker({ element: center }).setLngLat([lng, lat]).addTo(map);

      let loaded = false;
      map.on('load', () => {
        loaded = true;
        if (!cancelled) setStatus('ready');
      });
      map.on('error', (event) => {
        // Single tiles failing is normal and recovers on its own; only a map that never loaded
        // (a bad token, a blocked network) is shown as an error.
        console.error('Map error', event.error);
        if (!loaded && !cancelled) setStatus('error');
      });
      map.on('click', () => handlers.current.onBackground?.());
      mapRef.current = map;
    }

    init().catch((error: unknown) => {
      console.error("The map couldn't start", error);
      if (!cancelled) setStatus('error');
    });

    return () => {
      cancelled = true;
      pinned.forEach(({ marker }) => marker.remove());
      pinned.clear();
      map?.remove();
      mapRef.current = null;
    };
  }, [lat, lng, cooperative]);

  // Follows the theme (and the Map or Satellite choice).
  useEffect(() => {
    const map = mapRef.current;
    if (status !== 'ready' || !map || shownStyle.current === style) return;
    shownStyle.current = style;
    map.setStyle(style);
  }, [style, status]);

  // Adds and removes pins as the list changes. Pins are plain elements over the map, so they
  // survive style changes.
  useEffect(() => {
    const lib = libRef.current;
    const map = mapRef.current;
    if (status !== 'ready' || !lib || !map) return;
    const pinned = markers.current;
    const wanted = new Set(pins.map((pin) => pin.id));
    for (const [id, entry] of pinned) {
      if (wanted.has(id)) continue;
      entry.marker.remove();
      pinned.delete(id);
    }
    for (const pin of pins) {
      if (pinned.has(pin.id)) continue;
      const element = document.createElement('div');
      element.className = `mk mk-${pin.type}`;
      element.title = pin.name;
      // The list (or the cards on phones) offers the same places to keyboards and screen readers.
      element.setAttribute('aria-hidden', 'true');
      element.append(document.createElement('i'));
      element.addEventListener('click', (event) => {
        event.stopPropagation();
        handlers.current.onPin(pin.id);
      });
      element.addEventListener('mouseenter', () => handlers.current.onHover?.(pin.id));
      element.addEventListener('mouseleave', () => handlers.current.onHover?.(null));
      const marker = new lib.Marker({ element }).setLngLat([pin.lng, pin.lat]).addTo(map);
      pinned.set(pin.id, { marker, element });
    }
  }, [pins, status]);

  useEffect(() => {
    for (const [id, { element }] of markers.current) element.classList.toggle('is-hot', id === hot);
  }, [hot, pins, status]);

  // Fits the map to the pins once per kind of place, when they arrive.
  useEffect(() => {
    const lib = libRef.current;
    const map = mapRef.current;
    if (status !== 'ready' || !lib || !map || pins.length === 0 || fitted.current === fitKey) return;
    const first = fitted.current === null;
    fitted.current = fitKey;
    const bounds = new lib.LngLatBounds([lng, lat], [lng, lat]);
    for (const pin of pins) bounds.extend([pin.lng, pin.lat]);
    map.fitBounds(bounds, { padding, maxZoom: 15, duration: first || prefersReducedMotion() ? 0 : 700 });
  }, [fitKey, pins, status, lat, lng, padding]);

  // Phones: the map glides to whichever place the cards land on.
  useEffect(() => {
    const map = mapRef.current;
    if (!followHot || status !== 'ready' || !map || !hot || followed.current === hot) return;
    const pin = pins.find((item) => item.id === hot);
    if (!pin) return;
    followed.current = hot;
    map.easeTo({
      center: [pin.lng, pin.lat],
      // Keep the pin in the open part of the map, above the cards.
      offset: [0, (padding.top - padding.bottom) / 2],
      duration: prefersReducedMotion() ? 0 : 450,
    });
  }, [followHot, hot, pins, status, padding]);

  // Desktop: the card for the place picked in the list or on the map.
  useEffect(() => {
    const lib = libRef.current;
    const map = mapRef.current;
    if (status !== 'ready' || !lib || !map || !focus) return;
    const popup = new lib.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 18,
      maxWidth: '300px',
      className: 'map-card',
      focusAfterOpen: focusCard,
    })
      .setLngLat([focus.lng, focus.lat])
      .setDOMContent(cardNode)
      .addTo(map);
    // Bring the place into view if it's near an edge, leaving room above it for the card.
    const point = map.project([focus.lng, focus.lat]);
    const frame = map.getContainer();
    if (point.x < 160 || point.x > frame.clientWidth - 160 || point.y < 250 || point.y > frame.clientHeight - 50) {
      map.easeTo({ center: [focus.lng, focus.lat], offset: [0, 110], duration: prefersReducedMotion() ? 0 : 500 });
    }
    return () => {
      popup.remove();
    };
  }, [focus, focusCard, status, cardNode]);

  function recenter() {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib) return;
    const bounds = new lib.LngLatBounds([lng, lat], [lng, lat]);
    for (const pin of pins) bounds.extend([pin.lng, pin.lat]);
    map.fitBounds(bounds, { padding, maxZoom: 15, duration: prefersReducedMotion() ? 0 : 600 });
  }

  const kinds = PLACE_KINDS.filter((kind) => pins.some((pin) => pin.type === kind.key));

  return (
    <div className={className ? `map ${className}` : 'map'}>
      {/* Mapbox takes over this element, so React renders nothing inside it. */}
      <div ref={box} className="map-canvas" />
      {status === 'error' ? (
        <div className="map-error" role="status">
          <span className="state-ic">
            <Icon name="map" size={22} />
          </span>
          <p>The map couldn&apos;t load. The list still has every place.</p>
        </div>
      ) : (
        controls && (
          <>
            <Seg
              className="map-style"
              label="Map style"
              value={look}
              options={[
                { value: 'map', label: 'Map' },
                { value: 'satellite', label: 'Satellite' },
              ]}
              onChange={setLook}
            />
            <div className="map-tools">
              <div className="map-zoom">
                <button type="button" aria-label="Zoom in" onClick={() => mapRef.current?.zoomIn()}>
                  <Icon name="plus" size={18} />
                </button>
                <button type="button" aria-label="Zoom out" onClick={() => mapRef.current?.zoomOut()}>
                  <Icon name="minus" size={18} />
                </button>
              </div>
              <div className="map-zoom">
                <button type="button" aria-label="Show all the places" onClick={recenter}>
                  <Icon name="locate" size={18} />
                </button>
              </div>
            </div>
            {kinds.length > 0 && (
              <div className="map-legend" aria-hidden="true">
                {kinds.map((kind) => (
                  <span key={kind.key}>
                    <i className={`dot-${kind.key as PlaceType}`} />
                    {kind.label}
                  </span>
                ))}
              </div>
            )}
          </>
        )
      )}
      {focus && card !== undefined && createPortal(card, cardNode)}
    </div>
  );
}
