/**
 * Runs in the page MAIN world (not the extension isolated world).
 * Patches fetch/XHR so we can reuse LinkedIn's own Voyager responses
 * when the user selects a job — no duplicate API calls needed.
 */
(() => {
  const flag = '__liFacilitatorVoyagerHookInstalled';
  const root = window as Window & { [key: string]: boolean };
  if (root[flag]) return;
  root[flag] = true;

  const EVENT = 'li-facilitator-voyager-job-posting';
  const JOB_POSTING_PATH =
    /\/voyager\/api\/(?:jobs\/jobPostings|voyagerJobsJobPostings)\/(\d+)(?:[/?]|$)/;

  function requestUrl(input: RequestInfo | URL): string {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.href;
    return input.url;
  }

  function extractJobId(url: string): string | null {
    return url.match(JOB_POSTING_PATH)?.[1] || null;
  }

  function publish(jobId: string, payload: unknown): void {
    window.dispatchEvent(
      new CustomEvent(EVENT, {
        detail: { jobId, payload },
      }),
    );
  }

  function maybeCapture(url: string, getPayload: () => Promise<unknown>): void {
    const jobId = extractJobId(url);
    if (!jobId) return;

    void getPayload()
      .then((payload) => publish(jobId, payload))
      .catch(() => {
        // LinkedIn may return non-JSON for some voyager calls.
      });
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const response = await originalFetch(input, init);
    try {
      const url = requestUrl(input);
      if (response.ok) {
        maybeCapture(url, async () => response.clone().json());
      }
    } catch {
      // ignore hook errors — never break LinkedIn
    }
    return response;
  };

  const originalOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function open(method, url, ...rest) {
    const requestUrlValue = typeof url === 'string' ? url : url.toString();
    (this as XMLHttpRequest & { __liFacilitatorUrl?: string }).__liFacilitatorUrl =
      requestUrlValue;
    return originalOpen.call(this, method, url, ...rest);
  };

  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function send(body) {
    this.addEventListener('load', function onLoad() {
      const requestUrlValue = (this as XMLHttpRequest & { __liFacilitatorUrl?: string })
        .__liFacilitatorUrl;
      if (!requestUrlValue || this.status < 200 || this.status >= 300) return;

      maybeCapture(requestUrlValue, async () => {
        const text = this.responseText;
        return JSON.parse(typeof text === 'string' ? text : String(text));
      });
    });

    return originalSend.call(this, body);
  };
})();
