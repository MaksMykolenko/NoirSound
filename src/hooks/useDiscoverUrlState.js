import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { normalizeGenre } from '../constants/musicGenres';

const BEAT_FILTER_KEYS = ['style', 'mood', 'bpm', 'bpmMin', 'bpmMax', 'key'];
const cleanText = (value) => String(value ?? '').trim();

// Existing links use `content`; API requests use `contentType`. Read the
// descriptive aliases centrally, and write the established URL vocabulary.
export function readDiscoverParams(searchParams) {
  const content = cleanText(searchParams.get('content') || searchParams.get('contentType') || searchParams.get('view')).toUpperCase();
  const genre = cleanText(searchParams.get('genre'));
  return {
    contentType: content === 'BEATS' ? 'BEAT' : content || 'ALL',
    q: cleanText(searchParams.get('q')),
    genre: normalizeGenre(genre) || genre,
    group: cleanText(searchParams.get('group')),
    ...Object.fromEntries(BEAT_FILTER_KEYS.map((key) => [key, cleanText(searchParams.get(key))])),
    sort: cleanText(searchParams.get('sort')).toLowerCase() || 'recent',
  };
}

export default function useDiscoverUrlState() {
  const [searchParams, setSearchParams] = useSearchParams();
  const state = useMemo(() => readDiscoverParams(searchParams), [searchParams]);

  const update = useCallback((mutate, options = {}) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('browse');
      next.delete('cursor');
      next.delete('page');
      mutate(next);
      return next;
    }, options);
  }, [setSearchParams]);

  const setContentType = useCallback((contentType) => {
    update((next) => {
      next.delete('view');
      next.delete('contentType');
      if (contentType === 'ALL') next.delete('content');
      else next.set('content', contentType);
      if (contentType !== 'BEAT') {
        for (const key of BEAT_FILTER_KEYS) next.delete(key);
      }
    });
  }, [update]);

  const setQuery = useCallback((query, options = { replace: true }) => {
    update((next) => {
      const normalized = cleanText(query);
      if (normalized) next.set('q', normalized);
      else next.delete('q');
    }, options);
  }, [update]);

  const setGenre = useCallback((genre) => {
    update((next) => {
      next.delete('group');
      const normalized = normalizeGenre(genre) || cleanText(genre);
      if (normalized) next.set('genre', normalized);
      else next.delete('genre');
    });
  }, [update]);

  const setGroup = useCallback((group) => {
    update((next) => {
      next.delete('genre');
      if (group) next.set('group', group);
      else next.delete('group');
    });
  }, [update]);

  const setSort = useCallback((sort) => {
    update((next) => {
      if (!sort || sort === 'recent') next.delete('sort');
      else next.set('sort', sort);
    });
  }, [update]);

  const setBeatFilter = useCallback((key, value) => {
    if (key === 'sort') { setSort(value); return; }
    if (!BEAT_FILTER_KEYS.includes(key)) return;
    update((next) => {
      next.set('content', 'BEAT');
      next.delete('contentType');
      next.delete('view');
      if (key === 'bpm') { next.delete('bpmMin'); next.delete('bpmMax'); }
      const cleaned = cleanText(value);
      if (cleaned) next.set(key, cleaned);
      else next.delete(key);
    });
  }, [setSort, update]);

  const clearFilters = useCallback(() => {
    update((next) => {
      for (const key of ['genre', 'group', 'sort', ...BEAT_FILTER_KEYS]) next.delete(key);
    });
  }, [update]);

  const hasFilters = Boolean(state.genre || state.group || BEAT_FILTER_KEYS.some((key) => state[key]) || state.sort !== 'recent');
  return { ...state, hasFilters, setContentType, setQuery, setGenre, setGroup, setSort, setBeatFilter, clearFilters };
}
