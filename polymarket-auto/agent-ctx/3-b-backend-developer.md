---
Task ID: 3-b
Agent: backend-developer
Task: Build backend API routes and seed script

Work Log:
- Created seed script (prisma/seed.ts) with comprehensive mock data:
  - 15 wallets (7 edge traders, 8 regular traders)
  - 12 active prediction markets across 5 categories
  - 55 trades (20 agent trades with reasoning, 35 wallet trades)
  - 1 agent state record (running, $25 to $4,237 growth)
  - 10 news events with sentiment scores and agent actions
  - 20 agent decisions (scan, analyze, trade, hold, exit types)
- Added db:seed script to package.json
- Created 7 API route files:
  - /api/wallets - GET all wallets sorted by edgeScore desc with trade counts
  - /api/agent - GET agent state + recent 10 decisions
  - /api/markets - GET active markets sorted by mispricingScore desc (nulls last)
  - /api/trades - GET recent 50 trades with relations, ?agent=true filter
  - /api/news - GET recent 20 news events sorted by publishedAt desc
  - /api/performance - GET generated time series data (50 points, $25 to $4,237 growth)
  - /api/kelly - POST Kelly criterion calculator (winProb, odds, bankroll)
- Seeded database successfully
- Lint passed with no errors

Stage Summary:
- All API routes created and tested
- Database seeded with mock data
- All routes handle errors gracefully
