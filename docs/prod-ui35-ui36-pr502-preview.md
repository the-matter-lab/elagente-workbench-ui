# UI35 + UI36 preview for infrastructure PR502

Package: `@remote-codex/thread-ui@0.1.33-preview.ui35-ui36.1`.

This isolated preview starts at stable UI 0.1.33 source
`858979f2fdae34239ab7cb9c86671c7d5c59cb53` and applies the exact reviewed changes:

- UI35 optional host user-content hook: `2f38345e20f54b880708746072fc976b1dc7570f`.
- UI36 composer filename chips and local metadata: `0b925a3e96eebab7ff87773d5b853af02ea76fcc`.

The UI35 cherry-pick resolves only its older package version to the qualified
preview version above. UI36 applies without source changes. UI source, styles,
tests, README and dependency lock match the preserved combined checkout
`48ca8cfe58244bc05799612eca284d420b349de2`. Generated package output is rebuilt
from this checkout and retained in the commit for reproducibility.

Scope is infrastructure PR502 Prod Web preview packaging. This is not an official
stable release. There is no PR merge, npm publication, or full CI run. Existing
local preview5022 and its worktrees are preserved.

Install alongside the existing `@elagente/plugin-xyz@0.1.6` and stable 0.1.0
shared/runtime/terminal packages. Keep the host root npm override:

```json
{
  "overrides": {
    "@elagente/plugin-xyz": {
      "@remote-codex/thread-ui": "$@remote-codex/thread-ui"
    }
  }
}
```

Pin the root and Web direct UI dependencies to the identical preview tarball.
Package integrity, source commit, exact validation commands, focused test counts,
and installability evidence are recorded beside the immutable TGZ under
`/Users/nanyang/ElAgente/.local/prod-ui35-ui36-pr502-20261118/ui/`.
