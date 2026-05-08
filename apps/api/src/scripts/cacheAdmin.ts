import {
  getPersistentCacheReadOptions,
  PERSISTENT_CACHE_POLICY,
} from "../lib/cachePolicy";
import {
  sweepAllPersistentCaches,
  sweepPersistentCache,
} from "../lib/cacheMaintenance";
import {
  deletePersistentValue,
  inspectPersistentValue,
  listPersistentEntries,
} from "../lib/persistentCache";

function usage(): never {
  console.error(
    [
      "Usage:",
      "  npm run cache:inspect -- <cache-name> [key]",
      "  npm run cache:evict -- <cache-name> <key>",
      "  npm run cache:sweep -- [cache-name]",
      "",
      "Known cache names:",
      ...Object.keys(PERSISTENT_CACHE_POLICY).map((name) => `  - ${name}`),
    ].join("\n"),
  );
  process.exit(1);
}

async function main() {
  const [, , action, cacheName, key] = process.argv;
  if (!action) usage();

  const options = getPersistentCacheReadOptions(cacheName);

  if (action === "inspect") {
    if (!cacheName) usage();
    if (key) {
      const result = await inspectPersistentValue(cacheName, key, options);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    const entries = await listPersistentEntries(cacheName, options);
    console.log(JSON.stringify(entries, null, 2));
    return;
  }

  if (action === "evict") {
    if (!cacheName || !key) usage();
    const deleted = await deletePersistentValue(cacheName, key);
    console.log(JSON.stringify({ cacheName, key, deleted }, null, 2));
    return;
  }

  if (action === "sweep") {
    if (!cacheName || cacheName === "--all") {
      console.log(JSON.stringify(await sweepAllPersistentCaches(), null, 2));
      return;
    }

    console.log(JSON.stringify(await sweepPersistentCache(cacheName), null, 2));
    return;
  }

  usage();
}

void main();