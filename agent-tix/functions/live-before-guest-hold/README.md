# The three functions exactly as they were live on 10 October 2026

Read back from the live project (`jlwopomkqeawrxlapwpc`) before the guest hold
work was deployed, then compared with git, byte for byte, with `diff`:

| Function | Live version | `verify_jwt` | Files | Same as git at |
|---|---|---|---|---|
| `availability` | v14 | off | `index.ts` | `ef0209b` (identical) |
| `create-checkout` | v14 | off | `index.ts`, `rybbit.ts` | `ef0209b` (identical) |
| `stripe-webhook-v2` | v9 | off | `index.ts`, `rybbit.ts` | `index.ts` at `ef0209b`; `rybbit.ts` at **`3d69cb2`** (not `ef0209b`) |

**The webhook's `rybbit.ts` is the older copy.** The webhook was last deployed
with the abandoned-checkout version of `rybbit.ts` (commit `3d69cb2`). The
`checkout_started` additions came later and went to `create-checkout` only. The
repo's current webhook `rybbit.ts` is therefore NOT what is live; use the one in
this folder to restore it.

## To restore

Redeploy each function from its folder here, with JWT checking **off** (it is off
on all four live functions), `index.ts` as the entry point, and both files for
`create-checkout` and `stripe-webhook-v2`. A redeploy makes a new version number
(the old numbers cannot be brought back), with the old code.

Do not edit these files. They are a record.
