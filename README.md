# Ember Radar — token-radar-01

A token launch radar: it reads a sealed DefiLlama snapshot of 758 protocols, ranks every
rankable pre-token protocol by an implied value, and hands in a dashboard a reader can use.

- **Board:** 226 rows — all 40 watchlist protocols plus every rankable pre-token protocol
  below the $50M floor. Ranks 1..226, implied value non-increasing with rank.
- **Model (radar-2):** `implied = round(tvl_usd x 0.25 x (1 + clamp(change_7d, -80, 200) / 100 x 0.8)
  x (0.5 + min(age_days, 1095) / 1095 x 0.5))`. One function scores every row; no protocol
  name is special-cased. Momentum is weighted at 0.8 because a 7-day TVL move is the snapshot's
  only forward-looking figure; maturity runs 0.5 to 1.0 over three years with no token.
- **Farm plans:** six concrete steps per protocol (action, cost, time), derived from the
  protocol's own category, chains, TVL and age.
- **Dashboard:** sortable and filterable board, chain and category filters, watchlist-only
  toggle, a detail view with the model's own inputs and a recompute check, a live-token view
  set aside with market caps, and a model sandbox that re-ranks the board by the reader's
  constants. No network, no framework.

Run it: `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <snapshot.json|directory>`

Entry for make.fun bounty `token-radar-01` as @pranata.
