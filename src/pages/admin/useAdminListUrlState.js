import { useSearchParams } from 'react-router-dom';

function normalizePage(value) {
  const page = Number.parseInt(value, 10);
  return Number.isFinite(page) && page > 0 ? page : 1;
}

export default function useAdminListUrlState(defaultValues = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  function value(name) {
    return searchParams.has(name)
      ? searchParams.get(name) ?? ''
      : defaultValues[name] ?? '';
  }

  function setFilter(name, nextValue) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      const normalizedValue = String(nextValue ?? '');
      const defaultValue = String(defaultValues[name] ?? '');

      if (normalizedValue === defaultValue) {
        next.delete(name);
      } else {
        next.set(name, normalizedValue);
      }
      next.delete('page');
      return next;
    });
  }

  function setPage(nextPage) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      const normalizedPage = normalizePage(nextPage);
      if (normalizedPage === 1) next.delete('page');
      else next.set('page', String(normalizedPage));
      return next;
    });
  }

  return {
    value,
    page: normalizePage(searchParams.get('page')),
    setFilter,
    setPage,
  };
}
