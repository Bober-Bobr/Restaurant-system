import { useEffect, useRef } from 'react';
import type { RichRendererProps, RsvpPayload } from './types';

// Hosts a rich template inside a sandboxed iframe. The template's HTML/CSS/JS is
// injected via `srcdoc` together with a `window.__CONFIG__` object. The iframe
// runs with `allow-scripts` but WITHOUT `allow-same-origin`, so its scripts can
// animate freely yet cannot touch the v-invite.uz origin (cookies, localStorage,
// the auth store). Config edits are pushed in live via postMessage so the
// opening animation doesn't replay on every keystroke.

type InMsg =
  | { type: 'vinvite:rsvp'; payload: RsvpPayload }
  | { type: 'vinvite:height'; height: number };

function buildSrcDoc(html: string, config: Record<string, unknown>, languages: string[]): string {
  // The template runs on the opaque `about:srcdoc` origin, so it can't read the
  // host origin itself. Inject it so templates can resolve their own bundled
  // default assets (served from the web origin, e.g. `${__ORIGIN__}/tuscan/…`).
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const bootstrap = `<script>
    window.__CONFIG__ = ${JSON.stringify(config)};
    window.__LANGS__ = ${JSON.stringify(languages)};
    window.__ORIGIN__ = ${JSON.stringify(origin)};
  </script>`;
  // Templates include the marker <!--__CONFIG__--> in <head>; fall back to
  // prepending into <head> if absent.
  if (html.includes('<!--__CONFIG__-->')) return html.replace('<!--__CONFIG__-->', bootstrap);
  return html.replace('<head>', `<head>${bootstrap}`);
}

export function RichRenderer({ html, config, languages, onRsvp, interactive }: RichRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const loadedRef = useRef(false);

  // Receive messages from the sandboxed template (RSVP submissions, height).
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== iframeRef.current?.contentWindow) return;
      const data = e.data as InMsg | undefined;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'vinvite:rsvp' && onRsvp) {
        void onRsvp(data.payload).then(
          () => iframeRef.current?.contentWindow?.postMessage({ type: 'vinvite:rsvp-ok' }, '*'),
          () => iframeRef.current?.contentWindow?.postMessage({ type: 'vinvite:rsvp-err' }, '*'),
        );
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onRsvp]);

  // Live-update config/languages without reloading the iframe (keeps animations
  // from replaying). The initial values are already baked into srcdoc below.
  useEffect(() => {
    if (!loadedRef.current) return;
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'vinvite:config', config, languages },
      '*',
    );
  }, [config, languages]);

  return (
    <iframe
      ref={iframeRef}
      title="invitation"
      onLoad={() => { loadedRef.current = true; }}
      // allow-scripts only: no same-origin access to the parent page.
      sandbox="allow-scripts allow-popups allow-downloads"
      // The frame is cross-origin (no allow-same-origin), so audio playback is
      // blocked by Permissions Policy unless it is delegated explicitly — the
      // template starts the music on the envelope tap.
      allow="autoplay"
      srcDoc={buildSrcDoc(html, config, languages)}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        border: 'none',
        borderRadius: interactive ? 0 : 0,
        background: '#f6f0e4',
      }}
    />
  );
}
