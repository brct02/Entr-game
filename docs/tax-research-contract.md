# Tax research contract

When a player picks a US jurisdiction that has no tax pack, a research agent is asked to produce one. This is what it must return and what the engine does with it.

## What the agent returns

One JSON object matching `TaxPack` in `src/taxpack.ts`: state, county, optional city, tax year, the date of the research, and one entry for every item in `TAX_ITEM_BOUNDS`.

## Rules for the agent

1. Every figure comes from a page it opened. No figure from memory.
2. Prefer the state revenue department, the county tax collector and the city's own site. Set `official: true` only for a government page.
3. If it cannot find a figure, it returns `kind: "unknown"` with `value: null` and says what it looked for in `note`. It never estimates.
4. `asOf` is the date or period the source states, not today's date.
5. Rates are percentages (7, not 0.07). Money is in cents.

## What the engine does

- `validateTaxPack` rejects the pack if any item is missing, lacks a source link or date, or falls outside the plausible range for that tax.
- A pack is **provisional** until a person has reviewed it and every item has an official source. The player sees that label.
- Anything that needs an unknown item stops with a message naming the item. The game does not fill the gap.
- An accepted pack is stored and reused for every player in that jurisdiction and tax year. It is not researched again per player.
- A game keeps the tax year it started with.

## Assumed figures

The game's owner may set a figure by hand when research comes up empty. It is stored as `kind: "assumed"` with a note saying who set it, when and why. The player sees it labeled as an assumption, and the pack stays provisional until a real source replaces it. A research agent may never return an assumed figure.

## Not covered yet

Property tax, federal and state income tax brackets, city-level gross receipts taxes, and industry-specific taxes. Add an item to `TAX_ITEM_BOUNDS` for each when the engine starts using it.
