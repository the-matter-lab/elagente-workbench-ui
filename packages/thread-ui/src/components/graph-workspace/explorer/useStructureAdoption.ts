import { useEffect, useReducer, useRef } from 'react';
import type { ThreadArtifactDto } from '@remote-codex/shared';
import { translate, type TranslationKey } from '../../../i18n';
import type { ExtensionHostAdapter } from '../../../plugins/plugin-types';

type Attempt =
  | { state: 'pending' }
  | { state: 'adopted'; artifact: ThreadArtifactDto | null }
  | { state: 'failed'; code: string | null; epoch: number };

const MESSAGES: Record<string, TranslationKey> = {
  FILE_TOO_LARGE: 'files.adoptTooLarge',
  INPUT_UNSUPPORTED: 'files.adoptUnsupportedFormat',
  INVALID_XYZ: 'files.adoptUnsupportedFormat',
  TURN_BUSY: 'files.adoptTurnBusy',
};
const MAX_ATTEMPTS = 64;

const codeOf = (error: unknown) => {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : null;
};

/** The user wording for a failed adoption; null keeps the file silently view-only. */
export function structureAdoptionMessage(code: string | null) {
  const key = code ? MESSAGES[code] : undefined;
  return key ? translate(key) : null;
}

/**
 * Structure edits step 4: a structure file whose verified revision has no
 * published artifact asks the host to adopt it, once per (path, revision).
 * The plain preview stays meanwhile and on failure. `FILE_CONFLICT` re-checks
 * the disk revision and retries once when it is unchanged (a changed revision
 * is a new key). `TURN_BUSY` retries after the next disk re-check (`epoch`,
 * which the host bumps on every workspace change). Nothing else retries.
 */
export function useStructureAdoption({
  adopt,
  path,
  revision,
  bound,
  epoch,
  recheck,
  currentRevision,
}: {
  adopt?: ExtensionHostAdapter['adoptStructure'];
  path: string | null;
  /** The clean, verified document's sha256; null while it is not adoptable. */
  revision: string | null;
  /** The thread's artifact list already binds this revision. */
  bound: boolean;
  /** Changes whenever the disk revision is re-checked. */
  epoch: number;
  recheck?: () => Promise<void> | void;
  currentRevision?: () => string | null | undefined;
}): { artifact: ThreadArtifactDto | null; message: string | null } {
  const attempts = useRef(new Map<string, Attempt>());
  const [, rerender] = useReducer((value: number) => value + 1, 0);
  const latest = useRef({ epoch, recheck, currentRevision });
  latest.current = { epoch, recheck, currentRevision };
  const key = path && revision ? JSON.stringify([path, revision]) : null;

  useEffect(() => {
    if (!adopt || !key || !path || !revision || bound) return;
    const prior = attempts.current.get(key);
    if (prior && !(prior.state === 'failed' && prior.code === 'TURN_BUSY' && prior.epoch !== epoch)) return;
    const record = (attempt: Attempt) => {
      if (!attempts.current.has(key) && attempts.current.size >= MAX_ATTEMPTS)
        attempts.current.delete(attempts.current.keys().next().value!);
      attempts.current.set(key, attempt);
      rerender();
    };
    record({ state: 'pending' });
    void (async () => {
      try {
        record({ state: 'adopted', artifact: (await adopt(path, revision)) || null });
        return;
      } catch (error) {
        let code = codeOf(error);
        if (code === 'FILE_CONFLICT') {
          try { await latest.current.recheck?.(); } catch { /* the document reports it */ }
          // A changed revision is another key and gets its own attempt.
          if (latest.current.currentRevision?.() !== revision) {
            record({ state: 'failed', code: null, epoch: latest.current.epoch });
            return;
          }
          try {
            record({ state: 'adopted', artifact: (await adopt(path, revision)) || null });
            return;
          } catch (retryError) {
            code = codeOf(retryError);
          }
        }
        record({ state: 'failed', code, epoch: latest.current.epoch });
      }
    })();
  }, [adopt, key, path, revision, bound, epoch]);

  const attempt = key ? attempts.current.get(key) : undefined;
  return {
    artifact: attempt?.state === 'adopted' ? attempt.artifact : null,
    message: attempt?.state === 'failed' && !bound ? structureAdoptionMessage(attempt.code) : null,
  };
}
