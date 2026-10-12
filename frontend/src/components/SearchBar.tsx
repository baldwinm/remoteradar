import { useQueryClient } from '@tanstack/react-query';
import { type FormEvent, type KeyboardEvent, useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import { cityKeys, useCitySearch } from '../api/queries';
import type { City } from '../api/types';
import './SearchBar.css';

const DEBOUNCE_MS = 300;

function useDebounced(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function regionLabel(city: City) {
  if (city.country_code === 'us') return [city.state, 'USA'].filter(Boolean).join(', ');
  return [city.state, city.country].filter(Boolean).join(', ');
}

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const term = useDebounced(query.trim(), DEBOUNCE_MS);
  const { data: results = [], isFetching, isError } = useCitySearch(term);
  const showResults = open && term.length >= 2 && results.length > 0;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function select(city: City) {
    // The city page can render immediately from what search already returned.
    queryClient.setQueryData(cityKeys.city(city.id), city);
    navigate(`/city/${encodeURIComponent(city.id)}`);
    setQuery('');
    setOpen(false);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const choice = results[active] ?? results[0];
    if (choice && term.length >= 2) select(choice);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!showResults) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, results.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="search-bar" ref={containerRef}>
      <form onSubmit={handleSubmit} role="search">
        <input
          type="text"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Enter a city name..."
          className="search-input"
          aria-label="Search for a city"
          autoComplete="off"
          role="combobox"
          aria-expanded={showResults}
          aria-controls={listId}
          aria-activedescendant={showResults ? `${listId}-${active}` : undefined}
        />
        <button type="submit" className="search-button">
          Search
        </button>
      </form>

      {open && isFetching && term.length >= 2 && results.length === 0 && (
        <div className="search-status">Searching…</div>
      )}
      {open && isError && <div className="search-status search-error">Couldn't search right now. Please try again.</div>}
      {open && !isFetching && !isError && term.length >= 2 && results.length === 0 && (
        <div className="search-status">No matching cities.</div>
      )}

      {showResults && (
        <ul className="search-results" id={listId} role="listbox">
          {results.map((city, index) => (
            <li
              key={city.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              className={`search-result${index === active ? ' active' : ''}`}
              onMouseEnter={() => setActive(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => select(city)}
            >
              <span className="search-result-name">{city.name}</span>
              <span className="search-result-region">{regionLabel(city)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
