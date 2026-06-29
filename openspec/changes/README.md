# Changes

In-flight change proposals live here, one folder per change, following the
[OpenSpec](https://openspec.dev/) convention:

```
changes/<change-id>/
  proposal.md   # why + what
  tasks.md      # implementation checklist
  design.md     # technical decisions (optional)
  specs/        # spec deltas (## ADDED / MODIFIED / REMOVED Requirements)
```

When a change ships, fold its spec deltas into `openspec/specs/` (the source of
truth) and remove the change folder. This directory is empty until the first
proposal.
