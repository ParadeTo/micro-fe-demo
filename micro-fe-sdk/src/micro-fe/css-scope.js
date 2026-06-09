export function scopeCss(cssText, appName) {
  return rewriteRules(stripComments(cssText), scopeAttribute(appName)).trim();
}

function scopeAttribute(appName) {
  return `[data-micro-app="${appName}"]`;
}

function stripComments(cssText) {
  return cssText.replace(/\/\*[\s\S]*?\*\//g, '');
}

function rewriteRules(cssText, scope) {
  let output = '';
  let cursor = 0;

  while (cursor < cssText.length) {
    const nextBrace = cssText.indexOf('{', cursor);

    if (nextBrace === -1) {
      output += cssText.slice(cursor).trim();
      break;
    }

    const prelude = cssText.slice(cursor, nextBrace).trim();
    const endBrace = findMatchingBrace(cssText, nextBrace);

    if (endBrace === -1) {
      output += cssText.slice(cursor).trim();
      break;
    }

    const body = cssText.slice(nextBrace + 1, endBrace).trim();

    if (isGlobalAtRule(prelude)) {
      output += `${prelude} { ${body} }\n`;
    } else if (isNestedAtRule(prelude)) {
      output += `${prelude} { ${rewriteRules(body, scope)} }\n`;
    } else if (prelude.length > 0) {
      output += `${scopeSelectors(prelude, scope)} { ${body} }\n`;
    }

    cursor = endBrace + 1;
  }

  return output;
}

function findMatchingBrace(text, openIndex) {
  let depth = 0;

  for (let index = openIndex; index < text.length; index += 1) {
    if (text[index] === '{') {
      depth += 1;
    } else if (text[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function isGlobalAtRule(prelude) {
  return /^@(?:-\w+-)?keyframes\b/.test(prelude) || /^@font-face\b/.test(prelude);
}

function isNestedAtRule(prelude) {
  return /^@(media|supports|container)\b/.test(prelude);
}

function scopeSelectors(selectorText, scope) {
  return selectorText
    .split(',')
    .map((selector) => scopeSelector(selector.trim(), scope))
    .join(', ');
}

function scopeSelector(selector, scope) {
  if (selector.length === 0 || selector.startsWith(scope)) {
    return selector;
  }

  if (selector === ':root' || selector === 'html' || selector === 'body') {
    return scope;
  }

  return `${scope} ${selector}`;
}
