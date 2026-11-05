import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useScrollLock } from '../lib/hooks';
import { useSession } from '../state/session';
import { Avatar } from './Brand';
import { IconClose, IconPencil, IconPlus } from './Icons';

/** Phone profile switcher: a sheet that rises from the bottom edge of the screen. */
export function ProfileSheet({ onClose }: { onClose: () => void }) {
  const { accounts, active, switchTo } = useSession();
  const navigate = useNavigate();
  const closeButton = useRef<HTMLButtonElement>(null);
  useScrollLock(true);

  useEffect(() => {
    closeButton.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="sheet-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Profil wechseln">
        <div className="sheet__head">
          <h2>Profil wechseln</h2>
          <button type="button" ref={closeButton} className="sheet__close" aria-label="Schließen" onClick={onClose}>
            <IconClose width={18} height={18} />
          </button>
        </div>
        <ul className="sheet__profiles">
          {accounts.map((a) => (
            <li key={a.userId}>
              <button
                type="button"
                className={`sheet__profile${a.userId === active?.userId ? ' is-active' : ''}`}
                aria-current={a.userId === active?.userId}
                onClick={() => {
                  onClose();
                  if (a.userId !== active?.userId) switchTo(a.userId);
                  navigate('/browse');
                }}
              >
                <Avatar userId={a.userId} name={a.name} tag={a.imageTag} size={72} />
                <span>{a.name}</span>
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              className="sheet__profile"
              onClick={() => {
                onClose();
                navigate('/login');
              }}
            >
              <span className="sheet__add"><IconPlus width={32} height={32} /></span>
              <span>Hinzufügen</span>
            </button>
          </li>
        </ul>
        <button
          type="button"
          className="sheet__manage"
          onClick={() => {
            onClose();
            navigate('/profiles', { state: { manage: true } });
          }}
        >
          <IconPencil width={18} height={18} /> Profile verwalten
        </button>
      </div>
    </div>,
    document.body,
  );
}
