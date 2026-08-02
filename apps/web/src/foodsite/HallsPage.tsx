import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { publicHallService } from '../services/publicHall.service';
import { getPhotoUrl } from '../utils/photoUrl';
import type { Hall } from '../types/domain';
import { Lightbox } from './Lightbox';
import { SectionHeading, useT } from './ui';

// Combine a hall's single photoUrl + photos array into a unique, ordered list.
function hallPhotoList(hall: Hall): string[] {
  const all = [hall.photoUrl, ...(hall.photos ?? [])].filter((p): p is string => !!p);
  return Array.from(new Set(all));
}

function useHalls(restaurantId: string) {
  return useQuery({
    queryKey: ['fs-halls', restaurantId],
    queryFn: () => publicHallService.listActive(restaurantId),
  });
}

export function HallsPage({ restaurantId }: { restaurantId: string }) {
  const { t } = useT();
  const { data: halls = [], isLoading } = useHalls(restaurantId);

  return (
    <div style={{ paddingTop: 30 }}>
      <SectionHeading title={t('halls')} meta={halls.length ? String(halls.length) : undefined} />
      {isLoading && <div className="fs-skeleton" style={{ height: 220 }} />}
      {!isLoading && halls.length === 0 && <p className="fs-muted">—</p>}

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(268px, 1fr))' }}>
        {halls.map((hall) => {
          const photos = hallPhotoList(hall);
          const src = photos[0] ? getPhotoUrl(photos[0]) : null;
          return (
            <Link key={hall.id} to={`/halls/${hall.id}`} className="fs-card fs-card-lift reveal"
              style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', textDecoration: 'none', color: 'inherit' }}>
              <div style={{ position: 'relative' }}>
                {src
                  ? <img src={src} alt={hall.name} loading="lazy" style={{ width: '100%', aspectRatio: '16 / 10', objectFit: 'cover', display: 'block' }} />
                  : <div style={{ width: '100%', aspectRatio: '16 / 10', background: 'rgb(var(--fs-accent-rgb) / 0.08)' }} />}
                {photos.length > 1 && (
                  <span className="fs-pill fs-pill-muted" style={{ position: 'absolute', right: 10, bottom: 10 }}>
                    {photos.length} 🖼
                  </span>
                )}
              </div>
              <div style={{ padding: '14px 16px', display: 'grid', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 750 }}>{hall.name}</h3>
                  <span style={{ color: 'var(--fs-accent)', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>
                    {hall.capacity} {t('seats')}
                  </span>
                </div>
                {hall.description && (
                  <p className="fs-muted fs-clamp-2" style={{ margin: 0, fontSize: 13, lineHeight: 1.5 }}>
                    {hall.description}
                  </p>
                )}
                <span style={{ marginTop: 2, fontSize: 13, fontWeight: 700, color: 'var(--fs-accent)' }}>
                  {t('view_hall')} →
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function HallDetailPage({ restaurantId }: { restaurantId: string }) {
  const { hallId = '' } = useParams();
  const { t } = useT();
  const [lightbox, setLightbox] = useState<number | null>(null);
  const { data: halls = [], isLoading } = useHalls(restaurantId);

  const hall = halls.find((h) => h.id === hallId);
  const photos = hall ? hallPhotoList(hall) : [];

  const back = (
    <Link to="/halls" style={{ fontSize: 13, color: 'var(--fs-dim)', textDecoration: 'none' }}>
      ← {t('back_to_halls')}
    </Link>
  );

  if (isLoading) return <div style={{ paddingTop: 30 }}><div className="fs-skeleton" style={{ height: 220 }} /></div>;
  if (!hall) return <div style={{ paddingTop: 30 }}>{back}<p className="fs-muted" style={{ marginTop: 16 }}>—</p></div>;

  return (
    <div style={{ paddingTop: 30 }}>
      {back}
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        gap: 12, flexWrap: 'wrap', margin: '12px 0 18px',
      }}>
        <h1 className="fs-title">{hall.name}</h1>
        <span style={{ color: 'var(--fs-accent)', fontSize: 15, fontWeight: 750 }}>
          {hall.capacity} {t('seats')}
        </span>
      </div>

      {hall.description && (
        <div className="fs-card reveal" style={{ padding: 20, marginBottom: 22 }}>
          <p className="fs-muted" style={{ margin: 0, fontSize: 15, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
            {hall.description}
          </p>
        </div>
      )}

      {photos.length > 0 && (
        <>
          <SectionHeading title={t('hall_gallery')} meta={String(photos.length)} />
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(224px, 1fr))' }}>
            {photos.map((photo, i) => (
              <button key={photo} type="button" onClick={() => setLightbox(i)}
                className="fs-card fs-card-lift reveal"
                style={{ overflow: 'hidden', padding: 0, cursor: 'pointer', background: 'transparent' }}>
                <img src={getPhotoUrl(photo)} alt={`${hall.name} ${i + 1}`} loading="lazy"
                  style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', display: 'block' }} />
              </button>
            ))}
          </div>
        </>
      )}

      {lightbox !== null && photos[lightbox] && (
        <Lightbox
          photos={photos}
          index={lightbox}
          alt={hall.name}
          onIndex={setLightbox}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
