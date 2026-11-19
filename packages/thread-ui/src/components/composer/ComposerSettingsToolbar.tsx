import { translate, useI18n } from '../../i18n';
import type {
  ModelOptionDto,
  ReasoningEffortDto,
  SandboxModeDto,
  ThreadContextUsageDto,
  UpdateThreadSettingsInput,
} from '@remote-codex/shared';
import { useRef, type CSSProperties, type ReactNode } from 'react';

import { InputGroupButton } from '../graph-ui/InputGroup';
import type { SettingsMenu } from './types';
import { formatContextTokenKilocount, formatReasoningEffortLabel, reasoningEffortColor } from './composerUtils';
import { ContextProgressBar } from './composerPresentation';
import { ComposerMenuSurface } from './ComposerMenuSurface';
import { Check, ChevronDown, Send, Target } from 'lucide-react';
import { useThemeFeature } from '../themeHooks';
import { ComposerReasoningSlider } from './ComposerReasoningSlider';
import { ComposerModelPolicyMenu } from './ComposerModelPolicyMenu';
import { isCustomSelection, modelDisplayName, overrideCount, presetLabel, type ComposerModelPolicyProps } from './modelPolicy';

/** Send, but later: an up arrow with a small clock. */
function SendLaterIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="composer-send-later h-[18px] w-[18px] fill-none stroke-current" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 19V5" />
      <path d="m4 10 5-5 5 5" />
      <circle cx="17.5" cy="16.5" r="4.5" />
      <path d="M17.5 14.5v2l1.3 1" />
    </svg>
  );
}

export function ComposerSettingsToolbar({
  openMenu,
  model,
  agent,
  queueing = false,
  liveModelSwitch = false,
  modelOptions,
  modelContextTitle,
  contextUsage,
  reasoningEffort,
  supportedEfforts,
  modelControlsDisabled,
  effortControlsDisabled,
  settingsBusy,
  goalComposeMode,
  goalBusy,
  activeView,
  disabled,
  sendDisabled = false,
  promptEmpty = false,
  sendButtonLabel,
  sendButtonClassName,
  sendButtonBaseClassName,
  beforeSend,
  onSetOpenMenu,
  onUpdateSettings,
  modelPolicy = null,
}: {
  beforeSend?: ReactNode;
  /** Group model policy: the chip summarizes it and the menu edits presets
      and author groups instead of one thread-wide model. */
  modelPolicy?: ComposerModelPolicyProps | null;
  openMenu: SettingsMenu;
  model: string | null | undefined;
  agent?: string | undefined;
  /** A turn is running, so sending adds the prompt to its queue. */
  queueing?: boolean;
  /** A model or effort chosen while a turn runs applies from its next model
      call; otherwise from the next turn. */
  liveModelSwitch?: boolean;
  modelOptions: ModelOptionDto[];
  modelContextTitle: string;
  contextUsage: ThreadContextUsageDto | null | undefined;
  reasoningEffort: ReasoningEffortDto | null | undefined;
  supportedEfforts: ModelOptionDto['supportedReasoningEfforts'];
  sandboxMode: SandboxModeDto | null | undefined;
  sandboxModeAvailable: boolean;
  settingsBusy: boolean;
  goalComposeMode: boolean;
  goalBusy: boolean;
  activeView: 'chat' | 'shell';
  disabled: boolean;
  /** Block sending while leaving editing and other controls available. */
  sendDisabled?: boolean;
  /** No text or attachment to send yet. */
  promptEmpty?: boolean;
  fastMode: boolean;
  sendButtonLabel: string;
  sendButtonClassName: string;
  modelControlsDisabled: boolean;
  effortControlsDisabled: boolean;
  effortControlTitle: string;
  inlineToggleClassName: string;
  menuItemClassName: string;
  sendButtonBaseClassName: string;
  onSetOpenMenu: (updater: (current: SettingsMenu) => SettingsMenu) => void;
  onUpdateSettings: (input: UpdateThreadSettingsInput) => void;
}) {
  useI18n();
  const modelTriggerRef = useRef<HTMLButtonElement>(null);
  // Theme flags: the harness avatar and a chevron on the model chip, and a
  // paper plane for sending now. Every theme shows the same three intents.
  const modelAvatar = useThemeFeature('composer.modelAvatar');
  const intentIcons = useThemeFeature('composer.intentIcons');
  // The host locked the chat prompt: no send or queue intent, only the reason.
  const sendLocked = activeView === 'chat' && disabled && !goalComposeMode;
  // A turn is running: sending now adds the prompt to run after it.
  const sendLater = queueing && activeView === 'chat' && !goalComposeMode && !sendLocked;
  const sendIntentLabel = goalComposeMode
    ? translate('chat.setGoal')
    : sendLater
      ? translate('chat.sendAfterTurn')
      : translate('chat.sendPrompt');
  // Nothing to send yet: the button looks off but stays focusable and says why.
  const sendEmpty = promptEmpty && !goalBusy && !(activeView === 'chat' && disabled);
  const selectedModelLabel =
    modelOptions.find((entry) => entry.model === model)?.displayName ||
    model ||
    translate('chat.selectModel');
  const supportsEffort = supportedEfforts.length > 0;
  const effortLabel = formatReasoningEffortLabel(reasoningEffort);
  // With a group policy the chip never names one model: it shows the preset,
  // or the custom selection and its override count.
  const policyView = modelPolicy?.view ?? null;
  const policyCustom = policyView ? isCustomSelection(policyView) : false;
  const policyOverrides = policyView ? overrideCount(policyView) : 0;
  const policyLabel = !modelPolicy ? null : !policyView
    ? translate(modelPolicy.error ? 'chat.policyUnavailable' : 'chat.policyLoading')
    : policyCustom ? translate('chat.policyCustom') : presetLabel(policyView);
  const policyDetail = policyView && modelPolicy?.confirmationRequired
    ? translate('chat.policyConfirm')
    : policyView && policyCustom
    ? policyOverrides ? translate('chat.policyOverrideCount', { count: policyOverrides }) : translate('chat.policyNoOverrides')
    : null;
  const policyTitle = policyView && policyCustom
    ? [policyLabel, ...policyView.groups.filter((group) => policyView.overrides[group.id]).map((group) => {
        const value = policyView.overrides[group.id]!;
        const option = group.models.find((entry) => entry.model === value.model);
        return `${group.label}: ${modelDisplayName(group.models, value.model)}${option?.supportedReasoningEfforts.length ? ` · ${formatReasoningEffortLabel(value.reasoningEffort)}` : ''}`;
      })].join('\n')
    : policyLabel ?? '';
  // ElAgente: the context row and its title text show only when the host reports a
  // usable context reading; otherwise they are omitted, never "— / —" or "unavailable".
  const hasContext = contextUsage?.availability === 'available' && (
    (contextUsage.tokensInContextWindow != null && Number.isFinite(contextUsage.tokensInContextWindow)) ||
    (contextUsage.modelContextWindow != null && Number.isFinite(contextUsage.modelContextWindow) && contextUsage.modelContextWindow > 0));

  return (
    <>
      <div className="composer-model-control relative min-w-0">
        <button
          type="button"
          ref={modelTriggerRef}
          data-composer-menu-trigger="true"
          aria-label={
            policyLabel != null
              ? translate('chat.policyChip', { value1: policyDetail ? `${policyLabel}, ${policyDetail}` : policyLabel })
              : supportsEffort
              ? translate('chat.modelAndEffort', {
                  value1: selectedModelLabel,
                  value2: effortLabel,
                })
              : selectedModelLabel
          }
          aria-haspopup="menu"
          aria-expanded={openMenu === 'model'}
          disabled={
            modelPolicy
              ? modelControlsDisabled
              : modelControlsDisabled || settingsBusy || modelOptions.length === 0
          }
          onClick={() =>
            onSetOpenMenu((current) => (current === 'model' ? null : 'model'))
          }
          data-testid="composer-model-label"
          title={policyLabel != null
            ? `${policyTitle}${policyDetail && !policyOverrides ? `\n${policyDetail}` : ''}${hasContext ? `\n${modelContextTitle}` : ''}`
            : `${selectedModelLabel}${supportsEffort ? ` · ${effortLabel}` : ''}${hasContext ? `\n${modelContextTitle}` : ''}`}
          data-model-policy={modelPolicy ? (policyCustom ? 'custom' : 'preset') : undefined}
          className="composer-model-label flex flex-col items-center justify-center whitespace-nowrap px-1 text-xs text-stone-400"
        >
          {modelAvatar && agent ? (
            <span className="matter-thread-avatar composer-model-avatar" data-agent={agent} aria-hidden="true" />
          ) : null}
          <span className="composer-model-name">{policyLabel ?? selectedModelLabel}</span>
          {policyLabel != null ? (
            policyDetail ? <span className="composer-model-effort composer-model-policy-detail"
              data-tone={modelPolicy?.confirmationRequired ? 'warning' : undefined}>{policyDetail}</span> : null
          ) : supportsEffort && (
            <span className="composer-model-effort" data-effort={reasoningEffort ?? undefined}
              style={{ '--effort-color': reasoningEffortColor(reasoningEffort) } as CSSProperties}>{effortLabel}</span>
          )}
          {modelAvatar ? <ChevronDown aria-hidden="true" className="composer-model-chevron" /> : null}
        </button>
        {model ? <ContextProgressBar contextUsage={contextUsage} /> : null}
        {openMenu === 'model' && modelPolicy ? (
          <ComposerMenuSurface
            align="end"
            className="composer-model-menu composer-model-policy-menu w-[min(21rem,calc(100vw-2rem))] rounded-xl border border-[var(--theme-border)] bg-[var(--theme-panel)] p-1.5 text-[var(--theme-fg)] shadow-xl"
          >
            <ComposerModelPolicyMenu policy={modelPolicy} queueing={queueing} liveModelSwitch={liveModelSwitch}
              onClose={() => {
                modelTriggerRef.current?.focus({ preventScroll: true });
                onSetOpenMenu(() => null);
              }} />
          </ComposerMenuSurface>
        ) : null}
        {openMenu === 'model' && !modelPolicy && (
          <ComposerMenuSurface
            align="end"
            className="composer-model-menu w-[min(19rem,calc(100vw-2rem))] rounded-xl border border-[var(--theme-border)] bg-[var(--theme-panel)] p-1.5 text-[var(--theme-fg)] shadow-xl"
          >
            <p className="composer-model-menu-heading flex items-baseline justify-between gap-3 px-2 py-1 text-xs text-[var(--theme-fg-muted)]">
              <span>{translate('chat.model')}</span>
              {/* While a turn runs, say when a change takes effect. */}
              {queueing ? (
                <span className="composer-model-menu-note text-[11px]">
                  {translate(liveModelSwitch ? 'chat.modelSwitchNextCall' : 'chat.modelSwitchNextTurn')}
                </span>
              ) : null}
            </p>
            {modelOptions.map((entry) => (
              <button
                key={entry.id}
                type="button"
                role="menuitemradio"
                aria-checked={entry.model === model}
                disabled={modelControlsDisabled || settingsBusy}
                onClick={() =>
                  onUpdateSettings({
                    model: entry.model,
                    reasoningEffort: entry.defaultReasoningEffort ?? null,
                  })
                }
                className="flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-[var(--theme-hover)] disabled:cursor-not-allowed"
              >
                <span>{entry.displayName}</span>
                {entry.model === model && (
                  <Check size={14} className="shrink-0" />
                )}
              </button>
            ))}
            {supportedEfforts.length > 0 && (
              <ComposerReasoningSlider
                key={model}
                efforts={supportedEfforts}
                effort={reasoningEffort}
                defaultEffort={
                  modelOptions.find((entry) => entry.model === model)
                    ?.defaultReasoningEffort
                }
                disabled={effortControlsDisabled || settingsBusy}
                onCommit={(next) => onUpdateSettings({ reasoningEffort: next })}
              />
            )}
            {hasContext ? <div className="composer-context-summary" title={modelContextTitle}>
              <span>{translate('chat.context')}</span>
              <span className="composer-context-value">
                {contextUsage?.availability === 'available' && contextUsage.tokensInContextWindow != null && Number.isFinite(contextUsage.tokensInContextWindow)
                  ? formatContextTokenKilocount(Math.max(0, contextUsage.tokensInContextWindow)).toUpperCase() : '—'}
                <span className="composer-context-separator"> / </span>
                {contextUsage?.modelContextWindow != null && Number.isFinite(contextUsage.modelContextWindow) && contextUsage.modelContextWindow > 0
                  ? formatContextTokenKilocount(contextUsage.modelContextWindow).toUpperCase() : '—'}
              </span>
            </div> : null}
          </ComposerMenuSurface>
        )}
      </div>

      {beforeSend}
      <InputGroupButton
        type="submit"
        variant="default"
        size="icon-xs"
        data-send-intent={goalComposeMode ? 'goal' : sendLater ? 'queue' : 'send'}
        data-empty={sendEmpty ? 'true' : undefined}
        aria-label={sendIntentLabel}
        aria-disabled={sendEmpty || undefined}
        title={sendLocked ? sendButtonLabel : sendEmpty ? translate('chat.typeToSend') : sendLater || goalComposeMode ? sendIntentLabel : sendButtonLabel}
        disabled={sendDisabled || goalBusy || (activeView === 'chat' ? disabled : false)}
        className={`${sendButtonBaseClassName} h-9 w-9 rounded-full text-sm font-medium disabled:cursor-not-allowed sm:h-8 sm:w-8 ${sendButtonClassName}`}
      >
        {goalComposeMode ? (
          <Target aria-hidden="true" className="h-[18px] w-[18px]" strokeWidth={2.2} />
        ) : sendLater ? (
          <SendLaterIcon />
        ) : intentIcons ? (
          <Send aria-hidden="true" className="composer-send-plane h-[17px] w-[17px]" strokeWidth={2.2} />
        ) : (
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="h-4 w-4 fill-none stroke-current"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M8 13V3" />
            <path d="m4 7 4-4 4 4" />
          </svg>
        )}
      </InputGroupButton>
    </>
  );
}
