# Task 1: Bug Fix & Styling Agent

## Task Description
Fix identified bugs and make comprehensive styling/readability improvements across the POLYAGENT dashboard.

## Work Completed

### Bug Fixes

1. **Next.js Dev Overlay Badge** - Added CSS rules in `globals.css` to hide/reposition the "1 Issue" badge that was overlapping with the QuickActionsToolbar:
   - `[data-nextjs-dialog-overlay]` and `nextjs-portal` elements set to `display: none !important`
   - `button[class*="nextjs"]` repositioned with `z-index: 40` and `bottom: 56px` to sit above the toolbar

2. **MetricCard Readability** - Fixed in `page.tsx`:
   - Label text: `text-[9px]` → `text-[10px]`
   - Sub-value text: `text-[8px]` → `text-[9px]`
   - Label color: `text-[#475569]` → `text-[#64748b]`
   - Sub-value color: `text-[#475569]/70` → `text-[#64748b]/80`
   - Icon container: `h-7 w-7` → `h-8 w-8`
   - Icon size: `h-3.5 w-3.5` → `h-4 w-4`

3. **PerformanceChart Gridlines & Labels** - Fixed in `PerformanceChart.tsx`:
   - Added `CartesianGrid` component with subtle horizontal gridlines (`#1e293b/40`)
   - Y-axis tick fontSize: 11 → 12
   - X-axis tick fontSize: 10 → 11
   - Y-axis width: 50 → 55 (to accommodate `$` prefix)
   - Added inline chart title "Capital Over Time" inside chart area

### Styling Improvements

4. **LivePriceTicker Readability** - Fixed in `LivePriceTicker.tsx`:
   - Market title abbreviation max length: 28 → 32 chars
   - Ticker entry text size: `text-[11px]` → `text-[12px]`
   - Price text: `font-semibold` → `font-bold`
   - Arrow icons: `h-2.5 w-2.5` → `h-3 w-3`
   - Item gap: `gap-1` → `gap-1.5`

5. **SystemStatus Row Readability** - Fixed in `page.tsx`:
   - Gap: `gap-4` → `gap-5`
   - Label text: `text-[9px]` → `text-[10px]`
   - Label color: `text-[#475569]` → `text-[#64748b]`
   - Value text: `text-[10px]` → `text-[11px]`

6. **Section Separation** - Added in `page.tsx` Overview tab:
   - `<div className="glow-divider" />` between PerformanceChart and PortfolioTimeline
   - `<div className="glow-divider" />` between PortfolioTimeline and 2-column grid

7. **ElapsedCounter Visibility** - Fixed in `page.tsx`:
   - Changed from `text-xs` to `text-[11px]`
   - Added `font-semibold`

8. **Footer Padding** - Fixed in `page.tsx`:
   - Changed `pb-14` → `pb-20` for QuickActionsToolbar clearance

## Verification
- `bun run lint` passes clean with 0 errors
- Dev server compiling successfully
