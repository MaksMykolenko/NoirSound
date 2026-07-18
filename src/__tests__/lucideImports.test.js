import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function productionFiles(relativeDirectory = 'src') {
  const directory = path.join(projectRoot, relativeDirectory);
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === '__tests__') return [];
    const relativePath = path.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) return productionFiles(relativePath);
    if (!/\.[jt]sx?$/.test(entry.name) || /\.test\.[jt]sx?$/.test(entry.name)) return [];
    return [relativePath];
  });
}

function source(relativePath) {
  return readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

describe('lucide production imports', () => {
  it('does not retain the full icon namespace through wildcard imports', () => {
    const namespaceImport = /import\s+\*\s+as\s+\w+\s+from\s+['"]lucide-react['"]/;
    const offenders = productionFiles().filter((file) => namespaceImport.test(source(file)));

    expect(offenders).toEqual([]);
  });

  it('uses explicit icon maps while preserving safe fallbacks', () => {
    const emptyState = source('src/components/ui/EmptyState.jsx');
    const statsCard = source('src/components/dashboard/StatsCard.jsx');

    expect(emptyState).toContain('const EMPTY_STATE_ICONS = {');
    expect(emptyState).toContain('EMPTY_STATE_ICONS[iconName] || Music');
    expect(statsCard).toContain('const STATS_ICONS = {');
    expect(statsCard).toContain('STATS_ICONS[iconName] || BarChart3');
  });
});
