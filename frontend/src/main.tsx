import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import App from './App';
import './styles/tokens.css';
import './styles/site.css';
import './styles/city.css';
import './styles/home.css';
import './styles/pages.css';
import './styles/extras.css';
import './styles/tablet.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// The old app registered a service worker that cached pages indefinitely. Remove it
// for anyone who still has it, so they always get the current version of the site.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .getRegistrations()
    .then((registrations) => registrations.forEach((registration) => registration.unregister()))
    .catch(() => undefined);
}
