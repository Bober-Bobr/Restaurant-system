import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'qrcode';
import type { TranslationKey } from '../utils/translate';
import logoUrl from '../assets/qr-logo.png';

type T = (k: TranslationKey) => string;

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Builds a scannable QR for `url` with the v-menu logo composited in the center.
// Uses the highest error-correction level ('H', ~30% recovery) so the code still
// scans reliably despite the logo covering the middle.
async function buildQrWithLogo(url: string): Promise<string> {
  const size = 512;
  const qrDataUrl = await QRCode.toDataURL(url, {
    width: size, margin: 2, errorCorrectionLevel: 'H',
    color: { dark: '#0b1120', light: '#ffffff' },
  });
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return qrDataUrl;
  const qrImg = await loadImage(qrDataUrl);
  ctx.drawImage(qrImg, 0, 0, size, size);
  try {
    const logo = await loadImage(logoUrl);
    // The logo is a round black mark on a transparent background. Draw a white
    // circle just larger than it as a quiet zone so it stays scannable, then the
    // logo itself — no square plate, so it reads as the round logo dropped in.
    const box = Math.round(size * 0.26);
    const cx = size / 2;
    const cy = size / 2;
    ctx.beginPath();
    ctx.arc(cx, cy, box / 2 + Math.round(box * 0.09), 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    // Contain the logo inside the box, preserving aspect ratio.
    const ar = logo.width / logo.height;
    let lw = box, lh = box;
    if (ar >= 1) lh = box / ar; else lw = box * ar;
    ctx.drawImage(logo, cx - lw / 2, cy - lh / 2, lw, lh);
  } catch { /* logo optional — plain QR still returned */ }
  return canvas.toDataURL('image/png');
}

// Top-bar button that reveals the finished project's public link together with a
// scannable QR code. Both can be reopened at any time and downloaded/copied.
export function LinkQrButton({ url, filename, t }: { url: string; filename: string; t: T }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="adm-btn-ghost" style={{ fontSize: 12 }} onClick={() => setOpen(true)} title={t('link_and_qr')}>
        🔗 {t('link_and_qr')}
      </button>
      {open && <LinkQrModal url={url} filename={filename} t={t} onClose={() => setOpen(false)} />}
    </>
  );
}

function LinkQrModal({ url, filename, t, onClose }: { url: string; filename: string; t: T; onClose: () => void }) {
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    if (!url) { setQr(null); return; }
    setQr(null);
    buildQrWithLogo(url)
      .then((data) => { if (alive) setQr(data); })
      .catch(() => { if (alive) setQr(null); });
    return () => { alive = false; };
  }, [url]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard unavailable */ }
  };

  const downloadQr = () => {
    if (!qr) return;
    const a = document.createElement('a');
    a.href = qr;
    a.download = `${filename || 'qr'}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="scale-in" style={{ width: '100%', maxWidth: 420, maxHeight: 'calc(100vh - 32px)', overflowY: 'auto', borderRadius: 18, background: 'rgba(15,23,42,0.98)', border: '1px solid rgba(255,255,255,0.12)', padding: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h3 style={{ margin: 0, color: '#f8fafc', fontSize: 16 }}>{t('link_and_qr')}</h3>
          <button type="button" onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)', background: 'transparent', color: '#e2e8f0', cursor: 'pointer' }}>×</button>
        </div>

        {url ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            {/* QR */}
            <div style={{ padding: 14, background: '#fff', borderRadius: 16, boxShadow: '0 10px 30px rgba(0,0,0,0.35)' }}>
              {qr
                ? <img src={qr} alt={t('scan_to_open')} style={{ display: 'block', width: 220, height: 220 }} />
                : <div style={{ width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 13 }}>…</div>}
            </div>
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(226,232,240,0.55)' }}>{t('scan_to_open')}</p>

            {/* Link */}
            <div style={{ width: '100%' }}>
              <span style={{ fontSize: 11, color: 'rgba(226,232,240,0.6)', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{t('share_link')}</span>
              <a href={url} target="_blank" rel="noreferrer"
                style={{ display: 'block', marginTop: 6, padding: '10px 12px', borderRadius: 10, background: 'rgba(201,164,44,0.08)', border: '1px solid rgba(201,164,44,0.3)', color: '#c9a42c', fontSize: 13, wordBreak: 'break-all', textDecoration: 'none' }}>
                {url}
              </a>
            </div>

            <div style={{ display: 'flex', gap: 8, width: '100%' }}>
              <button type="button" className="adm-btn-ghost" style={{ flex: 1, fontSize: 13 }} onClick={copy}>
                {copied ? `✓ ${t('copied')}` : t('copy_link')}
              </button>
              <button type="button" className="adm-btn-primary" style={{ flex: 1, fontSize: 13 }} disabled={!qr} onClick={downloadQr}>
                ⬇ {t('download_qr')}
              </button>
            </div>
          </div>
        ) : (
          <p style={{ margin: 0, color: 'rgba(226,232,240,0.6)', fontSize: 13 }}>{t('save_first_for_link')}</p>
        )}
      </div>
    </div>,
    document.body,
  );
}
