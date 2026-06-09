const htmlEntryCache = new Map();

export async function loadHtmlEntry(entry) {
  const entryUrl = new URL(entry, window.location.href).toString();

  if (htmlEntryCache.has(entryUrl)) {
    return htmlEntryCache.get(entryUrl);
  }

  const html = await fetchText(entryUrl);
  const documentSnapshot = new DOMParser().parseFromString(html, 'text/html');
  const styles = await collectStyles(documentSnapshot, entryUrl);
  const scripts = await collectScripts(documentSnapshot, entryUrl);

  removeNodes(documentSnapshot, 'script, style, link[rel="stylesheet"]');

  const assets = {
    entry: entryUrl,
    template: documentSnapshot.body.innerHTML.trim(),
    styles,
    scripts,
  };

  htmlEntryCache.set(entryUrl, assets);
  return assets;
}

export function clearHtmlEntryCache() {
  htmlEntryCache.clear();
}

async function collectStyles(documentSnapshot, entryUrl) {
  const styleNodes = [...documentSnapshot.querySelectorAll('style, link[rel="stylesheet"]')];

  return Promise.all(
    styleNodes.map((node) => {
      if (node.tagName.toLowerCase() === 'style') {
        return node.textContent || '';
      }

      return fetchText(resolveUrl(node.getAttribute('href'), entryUrl));
    }),
  );
}

async function collectScripts(documentSnapshot, entryUrl) {
  const scriptNodes = [...documentSnapshot.querySelectorAll('script')];

  return Promise.all(
    scriptNodes.map(async (node, index) => {
      const src = node.getAttribute('src');
      const sourceUrl = src ? resolveUrl(src, entryUrl) : `${entryUrl}?inline-script=${index}`;
      const code = src ? await fetchText(sourceUrl) : node.textContent || '';

      return {
        code,
        sourceUrl,
      };
    }),
  );
}

function removeNodes(documentSnapshot, selector) {
  for (const node of documentSnapshot.querySelectorAll(selector)) {
    node.remove();
  }
}

function resolveUrl(url, baseUrl) {
  return new URL(url, baseUrl).toString();
}

async function fetchText(url) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  return response.text();
}
