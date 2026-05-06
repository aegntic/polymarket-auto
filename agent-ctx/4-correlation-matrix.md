# Task 4: Correlation Matrix Component

## Agent: Code Agent
## Date: 2026-03-04
## Status: Completed

## Summary
Created `/src/components/dashboard/CorrelationMatrix.tsx` — an interactive correlation matrix heatmap for the POLYAGENT dashboard.

## Implementation Details

### Core Logic
- **Seeded RNG (mulberry32)**: Used to generate deterministic pseudo-random correlation coefficients. Seed derived from `hashString(m1.id + m2.id)` ensures consistency across renders.
- **Category-based correlation**: Same-category markets get correlation 0.5–0.9; different-category markets get 0.1–0.5.
- **Matrix computation**: N×N matrix computed in `useMemo`, sorted by category then title.

### UI Components
- **Heatmap Grid**: Each cell is a colored rectangle with the numeric correlation value (2 decimal places). Color interpolated from red (-1.0) through dark (0) to green (+1.0).
- **Diagonal cells**: Show 1.00 with green border + glow styling.
- **Hover interaction**: Highlights entire row and column, dims unrelated cells to 40% opacity. Hovered cell gets purple glow shadow and scale animation.
- **Tooltip (shadcn/ui)**: Shows both market names, full correlation (4 decimals), same-category indicator.
- **Click → Trade Opportunity panel**: Expanding panel with opportunity type, market pair badges, ρ value, description, and action suggestion.
- **Summary Stats**: 4-column grid showing total pairs, avg correlation, highest pair, high-correlation count.
- **Color Legend**: 5-stop gradient bar.
- **Category Legend**: Purple badges for each unique category.
- **ScrollArea**: max-h-[400px] for overflow.

### Styling
- Card class: `card-accent-purple border-[#1e293b] bg-[#0f1724]/80 backdrop-blur`
- Uses `font-mono` throughout matching other dashboard components
- Cyberpunk color scheme: green (#00ff41), cyan (#22d3ee), amber (#f59e0b), purple (#a855f7)
- Dynamic cell sizing based on market count

### Dependencies
- `@tanstack/react-query` — `useQuery` with `queryKey: ['markets']`
- `framer-motion` — cell entrance animations, hover scale, panel slide-in/out
- `@/lib/store` — `type Market`
- shadcn/ui components: Card, Badge, ScrollArea, Skeleton, Tooltip

## Lint Status
- No errors in the component file
- Existing lint error in `AgentStrategyPanel.tsx` (unrelated)

## Files Modified
- Created: `/src/components/dashboard/CorrelationMatrix.tsx`
- Updated: `/home/z/my-project/worklog.md`
