/**
 * Extension Background - Ollama DNR Rules
 *
 * Keeps a dynamic MV3 declarativeNetRequest rule that removes the Origin
 * header from extension requests to the configured local Ollama endpoint.
 */

const OLLAMA_ORIGIN_RULE_ID = 11434;

function getOllamaOrigin(endpoint: string): string | null {
  try {
    const url = new URL(endpoint);
    const hostname = url.hostname.toLowerCase();

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null;
    }

    if (hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '::1' && hostname !== '[::1]') {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Install or refresh the dynamic request-header rule for local Ollama.
 */
export async function syncOllamaDnrRule(endpoint: string): Promise<void> {
  if (!chrome.declarativeNetRequest?.updateDynamicRules) {
    console.warn('[OllamaDNR] declarativeNetRequest API is not available');
    return;
  }

  const origin = getOllamaOrigin(endpoint);

  const addRules: chrome.declarativeNetRequest.Rule[] = origin
    ? [
        {
          id: OLLAMA_ORIGIN_RULE_ID,
          priority: 1,
          action: {
            type: chrome.declarativeNetRequest.RuleActionType.MODIFY_HEADERS,
            requestHeaders: [
              {
                header: 'origin',
                operation: chrome.declarativeNetRequest.HeaderOperation.REMOVE,
              },
            ],
          },
          condition: {
            regexFilter: `^${escapeRegex(origin)}/.*`,
            resourceTypes: [
              chrome.declarativeNetRequest.ResourceType.XMLHTTPREQUEST,
              chrome.declarativeNetRequest.ResourceType.OTHER,
            ],
          },
        },
      ]
    : [];

  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [OLLAMA_ORIGIN_RULE_ID],
    addRules,
  });

  if (origin) {
    console.log('[OllamaDNR] Origin header removal enabled for:', origin);
  } else {
    console.warn('[OllamaDNR] Origin header removal disabled, unsupported endpoint:', endpoint);
  }
}
