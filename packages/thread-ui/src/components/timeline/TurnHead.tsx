import { useState, useSyncExternalStore, type MouseEvent, useContext } from 'react';
import { getLocale, translate, useI18n } from '../../i18n';
import { AddedPromptIcon } from './AddedPromptIcon';
import { Collapse } from './Collapse';
import type { TimelineTurn } from './timelineItems';
import { TokenSpeedDetails } from './TokenSpeedDetails';
import { TokenUsageCost } from './TokenUsageCost';
import { formatElapsedDuration, TurnClockContext, useSecondClock } from './turnStatus';
import { TurnModels } from './TurnModels';

export { shortModelName } from './TurnModels';

// A wide screen has room for the whole head on one line; a phone opens the rest on tap.
const wideQuery = '(min-width: 640px)';
const subscribeWide = (change: () => void) => {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const query = window.matchMedia(wideQuery);
  query.addEventListener('change', change);
  return () => query.removeEventListener('change', change);
};
const readWide = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(wideQuery).matches;
const useWideScreen = () => useSyncExternalStore(subscribeWide, readWide, () => false);

const clock = (at: string) => new Date(at).toLocaleTimeString(getLocale(), { hour: 'numeric', minute: '2-digit' });
const dated = (at: string) => new Date(at).toLocaleString(getLocale(), {
  month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  ...(new Date(at).getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}),
});
const preciseTimestamp = (at: string) => new Date(at).toLocaleString(getLocale(), {
  year: 'numeric', month: 'short', day: 'numeric',
  hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short',
});

/** The top of a turn: a dot with the time it has worked, its cost, when it
    started, the model, the speed and the prompts added while it worked. On a
    phone only the dot, time and cost show; tapping the line opens the rest on
    one more line. */
export function TurnHead({ turn, active, added, onBeforeResize }: {
  turn: TimelineTurn;
  active: boolean;
  /** Prompts added while the turn was working. */
  added: number;
  onBeforeResize?: ((anchor?: Element | null) => void) | undefined;
}) {
  useI18n();
  const wide = useWideScreen();
  const [open, setOpen] = useState(false);
  const [withDate, setWithDate] = useState(true);
  const now = useSecondClock(active);
  // While the host cannot confirm the turn is running, its time is the
  // elapsed time when the loss was noticed: an unconfirmed estimate (the turn
  // may already have finished), not live work and not a proven minimum.
  const turnClock = useContext(TurnClockContext);
  const unconfirmed = active && turnClock?.frozenAt != null;
  const started = turn.startedAt;
  const elapsed = formatElapsedDuration(started, active ? now : Date.parse(turn.completedAt ?? ''));
  const took = elapsed && unconfirmed ? `~${elapsed}?` : elapsed;
  const usage = turn.tokenUsage?.total;
  const speed = turn.tokenUsage?.generationSpeed;
  // While the turn works, the speed so far counts only model calls whose output
  // has been reported; the time of the call in flight would dilute it.
  const rate = active ? speed?.averageOutputTokensPerSecond : speed?.averageOutputTokensPerSecond ?? speed?.averageTokensPerSecond;
  const toggle = (event: MouseEvent<HTMLElement>) => {
    // The cost is a control of its own.
    if (event.target instanceof Element && event.target.closest('.thread-usage-cost')) return;
    onBeforeResize?.(event.currentTarget);
    setOpen(value => !value);
  };

  const worked = elapsed ? translate(unconfirmed ? 'chat.turnHeadUnconfirmed' : active ? 'chat.turnHeadRunning' : 'chat.turnHeadWorked', { elapsed }) : null;
  const dot = <>
    <i className="thread-turn-head-dot" aria-hidden="true" />
    {took ? <span className="thread-turn-head-took" title={unconfirmed ? worked ?? undefined : undefined}>{took}</span> : null}
  </>;
  const cost = usage || turn.priceEstimate ? <TokenUsageCost usage={usage} price={turn.priceEstimate} /> : null;
  const more = <>
    {started ? (
      <button type="button" className="thread-turn-head-time" title={preciseTimestamp(started)} aria-pressed={withDate}
        onClick={() => setWithDate(value => !value)}>
        <time dateTime={started}>{withDate ? dated(started) : clock(started)}</time>
      </button>
    ) : null}
    <TurnModels turn={turn} />
    {speed && rate != null && Number.isFinite(rate) && rate > 0 ? <TokenSpeedDetails speed={speed} value={rate} live={active} /> : null}
    {added ? (
      <span className="thread-turn-head-added" role="img" title={translate('chat.turnHeadAddedValue', { count: added })}
        aria-label={translate('chat.turnHeadAddedValue', { count: added })}>
        <AddedPromptIcon />{added}
      </span>
    ) : null}
  </>;

  if (wide) return (
    <div className="thread-turn-head-block">
      <div className="thread-turn-head is-wide" data-active={active || undefined} data-unconfirmed={unconfirmed || undefined} data-status={turn.status}>
        <span className="thread-turn-head-main" role={worked ? 'img' : undefined} aria-label={worked ?? undefined}>{dot}</span>
        {cost}
        {more}
      </div>
    </div>
  );

  return (
    <div className="thread-turn-head-block">
      <div className="thread-turn-head" data-active={active || undefined} data-unconfirmed={unconfirmed || undefined} data-status={turn.status} onClick={toggle}>
        <button type="button" className="thread-turn-head-main" aria-expanded={open} title={translate('chat.turnHeadDetails')}
          aria-label={worked ?? translate('chat.turnHeadDetails')}>
          {dot}
        </button>
        {cost}
      </div>
      <Collapse open={open}>
        <div className="thread-turn-head-more">{more}</div>
      </Collapse>
    </div>
  );
}
