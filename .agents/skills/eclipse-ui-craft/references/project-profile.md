# Eclipse AI Hub UI profile

## Product character

Eclipse AI Hub is an operational control surface for model access, bounded AI workflows, budgets, evidence, approvals, and reviewable artifacts. The interface should communicate capability, cost, provenance, execution state, and human control without turning into a generic AI playground.

## Visual system to preserve

- Preserve the current Eclipse Forge product profile: near-black surfaces, signal blue `#6BA3FF`, restrained gold `#D4AF37`, local Outfit/Inter fonts, quiet grid depth, and the existing Eclipse icon family.
- Keep the current Bento/futurism profile restrained. Do not add generic gradients, decorative card stacks, pervasive glow, glass, bounce, or new fonts.
- Keep dense operational content legible. Status, evidence, cost, risk, and next action take priority over decoration.
- Reuse `hub-card`, `hub-input`, `hub-btn`, `hub-btn-ghost`, `hub-nav-item`, `hub-tile`, current Tailwind utilities, and CSS tokens before adding primitives.

## Runtime and trust boundaries

- UI craft must not weaken provider allowlists, budgets, privacy routing, approval gates, evidence requirements, materialization boundaries, or server-side secret handling.
- A visual state never proves a model call, scan, build, approval, publish, or artifact write succeeded. Show success only from the established confirmed result.
- Keep plan, preview, approval, execution, receipt, retry, cancellation, and failure visibly distinct.
- Never place provider keys or service tokens in browser state or generated UI examples.

## Motion and accessibility

- Existing CSS/Tailwind transitions are valid for bounded feedback. Do not add an animation library unless an approved gesture requires it and the installed API is verified.
- Preserve the global reduced-motion guard, semantic buttons, `aria-current`/`aria-expanded`, visible focus, keyboard navigation, readable Russian copy, and responsive layouts.
- Page transitions must not delay navigation or reset useful context. Repeated list/card entrance delays must remain short and must disappear under reduced motion.

## Next small pilot — not implemented here

Audit `src/components/Sidebar.tsx` as one bounded slice: keep current module IDs and navigation behavior, add consistent non-committing press/focus feedback using existing primitives, verify collapse state and labels with keyboard and screen reader, and ensure the width transition is removed under reduced motion. Do not alter provider selection, module permissions, or route/runtime behavior.

## Sources inside this repository

- `AGENTS.md`
- `CLAUDE.md`
- `README.md`
- `src/styles.css`
- `src/components/Sidebar.tsx`
- `docs/builder-project-v1.md`
- `docs/growth-os-contract.md`
