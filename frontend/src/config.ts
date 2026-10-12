// Mapbox *public* token (pk.*). Public tokens are meant to ship in browser code; protect it
// by adding URL restrictions (remoteradar.net, localhost) in the Mapbox account settings.
// Set VITE_MAPBOX_TOKEN at build time to use a different token.
const DEFAULT_MAPBOX_TOKEN =
  'pk.eyJ1IjoibWpiYWxkd2luIiwiYSI6ImNtOXB6bWRkNDE4NXUydnBxMXdkZm1lYTAifQ.70dqUOegckCY145fG-uokA';

export const MAPBOX_TOKEN: string = import.meta.env.VITE_MAPBOX_TOKEN || DEFAULT_MAPBOX_TOKEN;
