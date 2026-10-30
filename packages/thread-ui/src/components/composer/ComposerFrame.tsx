import { usePhoneDock } from '../workbench/phoneDockContext';
import { X } from 'lucide-react';
import { translate, useI18n } from '../../i18n';
import type {
  FormEvent,
  MutableRefObject,
  ReactNode,
} from 'react';

import type { AgentSubscriptionUsageDto, PromptAttachmentKindDto } from '@remote-codex/shared';
import { useCompactComposer } from './useCompactComposer';
import { InputGroup } from '../graph-ui/InputGroup';
import { ComposerHiddenAttachmentInputs } from './ComposerHiddenAttachmentInputs';
import { ComposerJumpLatestButton } from './ComposerJumpLatestButton';
import { ComposerSubscriptionUsage, visibleSubscriptionWindows } from './ComposerSubscriptionUsage';

export interface ComposerFrameProps {
  activeView: 'chat' | 'shell';
  /** Theme avatar key of the thread's harness; presentation only. */
  agent?: string | undefined;
  busy?: boolean;
  layerClassName: string;
  formClassName: string;
  shellClassName: string;
  inputGroupClassName: string;
  error: string | null | undefined;
  onDismissError?: (() => void) | undefined;
  followTail: boolean;
  attachmentCapabilities?: { files: boolean; images: boolean } | undefined;
  photoInputRef: MutableRefObject<HTMLInputElement | null>;
  fileInputRef: MutableRefObject<HTMLInputElement | null>;
  onAppendAttachments: (
    files: FileList | null,
    kind: PromptAttachmentKindDto,
  ) => void;
  onToggleFollow?: () => void;
  canJumpToPreviousTurn?: boolean;
  onJumpToPreviousTurn?: () => void;
  canJumpToNextTurn?: boolean;
  onJumpToNextTurn?: () => void;
  subscriptionUsage?: AgentSubscriptionUsageDto | null;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  formRef: MutableRefObject<HTMLFormElement | null>;
  promptSlot: ReactNode;
  pendingQueueSlot?: ReactNode;
  toolbarSlot: ReactNode;
  goalSlot: ReactNode;
  shellPromptSlot: ReactNode;
}

export function ComposerFrame({
  activeView,
  agent,
  busy = false,
  layerClassName,
  formClassName,
  shellClassName,
  inputGroupClassName,
  error,
  onDismissError,
  followTail,
  attachmentCapabilities,
  photoInputRef,
  fileInputRef,
  onAppendAttachments,
  onToggleFollow,
  canJumpToPreviousTurn,
  onJumpToPreviousTurn,
  canJumpToNextTurn,
  onJumpToNextTurn,
  subscriptionUsage,
  onSubmit,
  formRef,
  promptSlot,
  pendingQueueSlot,
  toolbarSlot,
  goalSlot,
  shellPromptSlot,
}: ComposerFrameProps) {
  useI18n();
  const { expanded, focusOwner, ...focusEvents } = useCompactComposer(formRef, activeView === 'chat');
  // The phone dock's status bar shows usage instead.
  const dock = usePhoneDock();
  const usage = !dock && activeView === 'chat' && visibleSubscriptionWindows(subscriptionUsage).length > 0
    ? <ComposerSubscriptionUsage usage={subscriptionUsage} />
    : null;
  return (
    <div className={layerClassName}>
      <ComposerHiddenAttachmentInputs
        attachmentCapabilities={attachmentCapabilities}
        photoInputRef={photoInputRef}
        fileInputRef={fileInputRef}
        onAppendAttachments={onAppendAttachments}
      />
      <ComposerJumpLatestButton
        activeView={activeView}
        followTail={followTail}
        onToggleFollow={onToggleFollow}
        canJumpToPreviousTurn={canJumpToPreviousTurn}
        onJumpToPreviousTurn={onJumpToPreviousTurn}
        canJumpToNextTurn={canJumpToNextTurn}
        onJumpToNextTurn={onJumpToNextTurn}
      />

      {pendingQueueSlot}

      <form
        ref={formRef}
        {...focusEvents}
        data-composer-focus-owner={focusOwner}
        data-agent={agent}
        data-composer-busy={busy ? 'true' : undefined}
        data-composer-layout={activeView === 'chat' ? (expanded ? 'expanded' : 'collapsed') : undefined}
        data-testid={activeView === 'chat' ? 'chat-composer' : undefined}
        onSubmit={onSubmit}
        className={formClassName}
      >
        <div
          className={`${shellClassName} relative flex w-full flex-col overflow-visible rounded-[16px] sm:rounded-[18px]`}
        >
          <InputGroup className={inputGroupClassName}>
            {promptSlot}
            {toolbarSlot}
          </InputGroup>

          {goalSlot}
          {shellPromptSlot}
          {usage ? <div className="thread-composer-usage-tag">{usage}</div> : null}
        </div>
        {error ? (
          <div role="alert" className="mt-2 flex items-start gap-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            <span className="min-w-0 flex-1 break-words">{error}</span>
            {onDismissError ? (
              <button
                type="button"
                aria-label={translate('chat.dismissAttachmentError')}
                onClick={onDismissError}
                className="shrink-0 rounded p-1 hover:bg-rose-500/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        ) : null}
      </form>
    </div>
  );
}
