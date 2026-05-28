import { api, type Alert } from './api';
import { escapeHtml } from './format';

const POLL_INTERVAL_MS = 30_000;

export async function renderAlertCard(el: HTMLElement): Promise<void> {
  const card = el.closest('.card') as HTMLElement | null;

  let alerts: Alert[] = [];
  try {
    const res = await api.alerts(20);
    alerts = res.alerts;
  } catch {
    // Don't surface a broken box on the overview — just stay hidden.
    if (card) card.style.display = 'none';
    return;
  }

  if (alerts.length === 0) {
    if (card) card.style.display = 'none';
    return;
  }

  if (card) card.style.display = '';
  el.innerHTML = `<ul class="alerts">${alerts.map(a => `
    <li class="alert alert-${a.severity}">
      <div class="alert-head">
        <strong>${escapeHtml(a.title)}</strong>
        <span class="alert-severity">${a.severity}</span>
      </div>
      <p>${escapeHtml(a.message)}</p>
      <time>seen since ${new Date(a.first_seen_at).toLocaleString()}</time>
    </li>
  `).join('')}</ul>`;
}

let _notifPermissionRequested = false;

function _maybeAskForPermission(): void {
  if (_notifPermissionRequested) return;
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'default') return;
  _notifPermissionRequested = true;
  document.addEventListener('click', () => {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, { once: true });
}

export function startNotificationPoll(cardEl: HTMLElement): void {
  _maybeAskForPermission();

  const firedIds = new Set<number>();

  async function tick(): Promise<void> {
    try {
      const res = await api.unseenAlerts('critical');
      const fresh = res.alerts.filter(a => !firedIds.has(a.id));
      let firedAny = false;
      for (const a of fresh) {
        firedIds.add(a.id);
        if ('Notification' in window && Notification.permission === 'granted') {
          // eslint-disable-next-line no-new
          new Notification('Argus', {
            body: a.title,
            tag: `argus-alert-${a.id}`,
          });
        }
        try {
          await api.markAlertSeen(a.id);
        } catch { /* retry on next tick */ }
        firedAny = true;
      }
      if (firedAny) {
        await renderAlertCard(cardEl);
      }
    } catch {
      /* network blip — try again next tick */
    }
  }

  tick();
  setInterval(tick, POLL_INTERVAL_MS);
}
