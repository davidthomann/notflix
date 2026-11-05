import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Avatar } from '../components/Brand';
import { Dropdown } from '../components/Dropdown';
import { IconBack, IconBell, IconCaret, IconChevronRight, IconLogout, IconSettings, IconSwitch } from '../components/Icons';
import { NotificationEntry, useNotifications } from '../components/NavMenus';
import { ProfileSheet } from '../components/ProfileSheet';
import { LazyRow } from '../components/Row';
import { useDetailLink } from '../lib/actions';
import { QUALITY_OPTIONS, updateSettings, useSettings } from '../state/settings';
import { useClient, useSession } from '../state/session';

function Toggle({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="setting">
      <span>
        <strong>{label}</strong>
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" className="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function PlaybackSettings() {
  const settings = useSettings();
  return (
    <div className="settings-group">
      <Toggle
        label="Nächste Folge automatisch abspielen"
        hint="Startet die nächste Folge einer Serie von selbst."
        checked={settings.autoplayNext}
        onChange={(autoplayNext) => updateSettings({ autoplayNext })}
      />
      <Toggle
        label="Vorschauen automatisch abspielen"
        hint="Spielt Trailer und Titelvideos beim Durchstöbern, sofern auf dem Server vorhanden."
        checked={settings.autoplayPreviews}
        onChange={(autoplayPreviews) => updateSettings({ autoplayPreviews })}
      />
      <div className="setting">
        <span>
          <strong>Streaming-Qualität</strong>
          <small>{QUALITY_OPTIONS.find((q) => q.value === settings.maxBitrate)?.hint}</small>
        </span>
        <Dropdown
          label="Streaming-Qualität"
          value={settings.maxBitrate}
          options={QUALITY_OPTIONS.map((q) => ({ value: q.value, label: q.label }))}
          onChange={(maxBitrate) => updateSettings({ maxBitrate })}
        />
      </div>
    </div>
  );
}

export function AccountPage() {
  const { active, serverName, serverUrl, switchTo, signOut, forgetServer } = useSession();
  const navigate = useNavigate();
  if (!active) return null;
  return (
    <div className="page account">
      <h1>Konto</h1>
      <section className="account__card">
        <Avatar userId={active.userId} name={active.name} tag={active.imageTag} size={64} />
        <div>
          <strong>{active.name}</strong>
          <small>{serverName} · {serverUrl}</small>
        </div>
      </section>
      <h2>Wiedergabe</h2>
      <PlaybackSettings />
      <h2>Einstellungen</h2>
      <div className="settings-group">
        <button type="button" className="setting setting--link" onClick={() => { switchTo(null); navigate('/profiles'); }}>
          <strong><IconSwitch /> Profil wechseln</strong>
          <IconChevronRight width={16} height={16} />
        </button>
        <button type="button" className="setting setting--link" onClick={() => signOut(active.userId)}>
          <strong><IconLogout /> Abmelden</strong>
          <IconChevronRight width={16} height={16} />
        </button>
        <button type="button" className="setting setting--link" onClick={() => { forgetServer(); navigate('/connect'); }}>
          <strong><IconSettings /> Server wechseln</strong>
          <IconChevronRight width={16} height={16} />
        </button>
      </div>
    </div>
  );
}

/** Mobile "Mein Profil" tab: profile switcher, notifications and personal rows. */
export function MePage() {
  const client = useClient();
  const { active } = useSession();
  const { items, unread } = useNotifications();
  const [sheetOpen, setSheetOpen] = useState(false);
  if (!active) return null;
  const latest = items?.[0];
  return (
    <div className="page me">
      <button type="button" className="me__profile" aria-haspopup="dialog" onClick={() => setSheetOpen(true)}>
        <Avatar userId={active.userId} name={active.name} tag={active.imageTag} size={96} />
        <span>{active.name} <IconCaret width={18} height={18} /></span>
      </button>
      <Link to="/notifications" className="me__row">
        <span className="me__bell">
          <IconBell width={20} height={20} />
        </span>
        <span className="me__row-text">
          <strong>Benachrichtigungen{unread > 0 && <em>{unread}</em>}</strong>
          {latest && <small>{latest.Type === 'Episode' ? latest.SeriesName : latest.Name}</small>}
        </span>
        <IconChevronRight width={18} height={18} />
      </Link>
      <div className="rows">
        <LazyRow eager queryKey={['resume', 'home']} title="Weiterschauen" variant="resume" fetch={async () => (await client.resume()).Items} />
        <LazyRow
          eager
          queryKey={['mylist', 'row', 'home']}
          title="Meine Liste"
          to="/browse/my-list"
          fetch={async () => (await client.items({ isFavorite: true, includeItemTypes: ['Movie', 'Series'], sortBy: 'DateCreated', sortOrder: 'Descending', limit: 30 })).Items}
        />
        <LazyRow
          queryKey={['history']}
          title="Bereits gesehen"
          fetch={async () => (await client.items({ isPlayed: true, includeItemTypes: ['Movie', 'Episode'], sortBy: 'DatePlayed', sortOrder: 'Descending', limit: 30 })).Items}
        />
      </div>
      {sheetOpen && <ProfileSheet onClose={() => setSheetOpen(false)} />}
    </div>
  );
}

export function NotificationsPage() {
  const navigate = useNavigate();
  const detail = useDetailLink();
  const { items, isLoading, markSeen } = useNotifications();
  useEffect(markSeen, [markSeen]);
  return (
    <div className="page notifications-page">
      <div className="page-title">
        <button type="button" className="icon-btn page-title__back" aria-label="Zurück" onClick={() => navigate(-1)}>
          <IconBack />
        </button>
        <h1>Benachrichtigungen</h1>
      </div>
      {isLoading && <div className="center-spinner"><div className="spinner" /></div>}
      {items?.length === 0 && <p className="empty-note">Keine aktuellen Benachrichtigungen</p>}
      <ul className="notifications__list notifications__list--page">
        {items?.map((item) => (
          <li key={item.Id}>
            <NotificationEntry item={item} onOpen={() => detail.open(item)} />
          </li>
        ))}
      </ul>
    </div>
  );
}
