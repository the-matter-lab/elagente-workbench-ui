import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ChartNoAxesColumn, FolderOpen, MoreHorizontal, Share } from 'lucide-react';
import { translate, useI18n } from '../../i18n';
import type { MatterWorkbenchOptions } from '../MatterWorkbench';
import { ThreadToolsMenu } from './ThreadToolsMenu';
import { Tooltip, TooltipContent, TooltipTrigger } from '../graph-ui/Tooltip';

/** Opt-in host chrome. The second menu keeps all existing host actions mounted,
 * including dialogs and compute panels, behind Save & export. */
export function ThreadHeader({ header, title, threadKey, explorerOpen, onToggleExplorer, options, actions }: {
  header: NonNullable<MatterWorkbenchOptions['threadHeader']>;
  title: string;
  threadKey: string;
  explorerOpen: boolean;
  onToggleExplorer: () => void;
  options: MatterWorkbenchOptions;
  actions: ReactNode;
}) {
  useI18n();
  const id = useId();
  const toggle = useRef<HTMLButtonElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const disabled = header.toolsDisabled ?? header.tone !== 'running';
  useEffect(() => { setMoreOpen(false); setActionsOpen(false); }, [threadKey, disabled]);
  const restoreFocus = (restore: boolean) => { if (restore) toggle.current?.focus(); };
  const moreLabel = translate('workbench.moreActions');
  const lifecycle = <span className="matter-thread-lifecycle" data-tone={header.tone} role="status"
    tabIndex={header.statusDescription ? 0 : undefined}>{header.status}</span>;
  return <header className="matter-thread-header" aria-label={translate('workbench.selectedThread')}>
    <div className="matter-thread-header-summary">
      <h1 className="matter-thread-header-title" title={title}>{title}</h1>
      {header.statusDescription ? (
        <Tooltip delayDuration={180}>
          <TooltipTrigger asChild>{lifecycle}</TooltipTrigger>
          <TooltipContent side="bottom" align="start" sideOffset={6} collisionPadding={12}
            className="matter-thread-lifecycle-tooltip max-w-xs">
            {header.statusDescription}
          </TooltipContent>
        </Tooltip>
      ) : lifecycle}
    </div>
    <div className="matter-thread-header-actions">
      <button type="button" aria-label={translate('workbench.files')} aria-pressed={explorerOpen} aria-expanded={explorerOpen}
        disabled={disabled} onClick={onToggleExplorer}>
        <FolderOpen data-icon="explorer" aria-hidden="true" /><span>{translate('workbench.files')}</span>
      </button>
      <button ref={toggle} type="button" aria-label={moreLabel} title={moreLabel} aria-haspopup="menu"
        aria-controls={`${id}-${actionsOpen ? 'actions' : 'more'}`} aria-expanded={moreOpen || actionsOpen}
        disabled={disabled} onClick={() => {
          if (actionsOpen) setActionsOpen(false);
          else setMoreOpen(open => !open);
        }} onKeyDown={event => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault(); setMoreOpen(true); setActionsOpen(false);
          }
        }}><MoreHorizontal data-icon="more" aria-hidden="true" /></button>
    </div>
    <ThreadToolsMenu id={`${id}-more`} open={moreOpen && !disabled} anchorRef={toggle} path="" title={title}
      favorite={false} showHeader={false} label={moreLabel}
      onClose={restore => { setMoreOpen(false); restoreFocus(restore); }}>
      <button type="button" role="menuitem" onClick={() => {
        setMoreOpen(false);
        if (header.onSaveExport) header.onSaveExport();
        else setActionsOpen(true);
      }}>
        <Share aria-hidden="true" /><span>{translate('workbench.saveExport')}</span>
      </button>
      <button type="button" role="menuitem" disabled={!header.onOpenToolUsage} onClick={() => {
        setMoreOpen(false); header.onOpenToolUsage?.();
      }}><ChartNoAxesColumn aria-hidden="true" /><span>{translate('workbench.toolUsage')}</span></button>
    </ThreadToolsMenu>
    <ThreadToolsMenu id={`${id}-actions`} open={actionsOpen && !disabled} anchorRef={toggle}
      path={options.workspacePath} title={title} favorite={options.favorite} favoriteBusy={options.favoriteBusy}
      onToggleFavorite={options.showShortcuts === false ? undefined : options.onToggleFavorite} panels={options.statusActions}
      onClose={restore => { setActionsOpen(false); restoreFocus(restore); }}>
      {actions}
    </ThreadToolsMenu>
  </header>;
}
