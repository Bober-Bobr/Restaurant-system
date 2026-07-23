import { useEffect, useRef, useState } from 'react';
import type { RichRendererProps, RsvpPayload } from './types';
import { ADMIN_RUNTIME } from './adminRuntime';

// Hosts a rich template inside a sandboxed iframe. The template's HTML/CSS/JS is
// injected via `srcdoc` together with a `window.__CONFIG__` object. The iframe
// runs with `allow-scripts` but WITHOUT `allow-same-origin`, so its scripts can
// animate freely yet cannot touch the v-invite.uz origin (cookies, localStorage,
// the auth store).
//
// The srcdoc is built ONCE from the initial props and kept stable afterwards —
// config/language changes are pushed in via postMessage, so the iframe never
// reloads (and the opening animation never replays) while editing.

type InMsg =
  | { type: 'vinvite:rsvp'; payload: RsvpPayload }
  | { type: 'vinvite:height'; height: number }
  | { type: 'vinvite:admin-move'; id: string; x: number; y: number; kf?: number };

function buildSrcDoc(html: string, config: Record<string, unknown>, languages: string[], adminEdit?: boolean, adminPlay?: boolean): string {
  // The template runs on the opaque `about:srcdoc` origin, so it can't read the
  // host origin itself. Inject it so templates can resolve their own bundled
  // default assets (served from the web origin, e.g. `${__ORIGIN__}/tuscan/…`).
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const bootstrap = `<script>
    window.__CONFIG__ = ${JSON.stringify(config)};
    window.__LANGS__ = ${JSON.stringify(languages)};
    window.__ORIGIN__ = ${JSON.stringify(origin)};
    window.__ADMIN_EDIT__ = ${adminEdit ? 'true' : 'false'};
    window.__ADMIN_PLAY__ = ${adminPlay ? 'true' : 'false'};
  </script>`;
  // The Design+ overlay runtime (system-admin custom elements / palettes)
  // rides along in every template, after the template's own script.
  const adminScript = `<script>${ADMIN_RUNTIME}</script>`;
  // Templates include the marker <!--__CONFIG__--> in <head>; fall back to
  // prepending into <head> if absent.
  const withBootstrap = html.includes('<!--__CONFIG__-->')
    ? html.replace('<!--__CONFIG__-->', bootstrap)
    : html.replace('<head>', `<head>${bootstrap}`);
  return withBootstrap.includes('</body>')
    ? withBootstrap.replace('</body>', `${adminScript}</body>`)
    : withBootstrap + adminScript;
}

export function RichRenderer({ html, config, languages, onRsvp, onAdminMove, adminEdit, adminPlay, interactive }: RichRendererProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const loadedRef = useRef(false);

  // Built once per mounted template — later prop changes go via postMessage.
  const [doc, setDoc] = useState(() => buildSrcDoc(html, config, languages, adminEdit, adminPlay));
  const htmlRef = useRef(html);
  useEffect(() => {
    if (htmlRef.current === html) return;
    // A different template was swapped in — a real reload is required.
    htmlRef.current = html;
    loadedRef.current = false;
    setDoc(buildSrcDoc(html, config, languages, adminEdit, adminPlay));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [html]);

  // Receive messages from the sandboxed template (RSVP submissions, drags).
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
      if (data.type === 'vinvite:admin-move' && onAdminMove) {
        onAdminMove(data.id, data.x, data.y, data.kf);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onRsvp, onAdminMove]);

  // Live-update config/languages without reloading the iframe (keeps animations
  // from replaying). The initial values are already baked into srcdoc above.
  useEffect(() => {
    if (!loadedRef.current) return;
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'vinvite:config', config, languages, ...(adminEdit ? { adminPlay: !!adminPlay } : {}) },
      '*',
    );
  }, [config, languages, adminEdit, adminPlay]);

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
      srcDoc={doc}
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
