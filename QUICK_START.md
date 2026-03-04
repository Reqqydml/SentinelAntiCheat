# Dashboard Enhancement - Quick Start Guide

## What's New

Your Sentinel Anti-Cheat dashboard has been completely transformed with:

- **9 Real-Time KPI Cards** - At-a-glance metrics on all key indicators
- **6 Professional Charts** - Risk trends, confidence analysis, signal correlation, and more
- **Deep Dive Analysis** - Move-by-move accuracy tracking and signal detection breakdown
- **Player Profiles** - Comprehensive player history and risk assessment
- **Database Optimization** - Fast queries with indexed lookups and materialized views

---

## Getting Started

### 1. **View Your Dashboard**

The Command Center now displays three major sections:

```
┌─────────────────────────────────────────────┐
│  KPI DASHBOARD (9 metrics)                  │
├─────────────────────────────────────────────┤
│  METRICS ANALYSIS (6 interactive charts)    │
├─────────────────────────────────────────────┤
│  LIVE GAME FEED (sorted by risk)            │
├─────────────────────────────────────────────┤
│  ALERT QUEUE (with pending reviews)         │
├─────────────────────────────────────────────┤
│  PGN ANALYSIS WORKBENCH                     │
└─────────────────────────────────────────────┘
```

### 2. **Navigate Between Views**

Click the top navigation to access:
- **Command Center** - Overview dashboard (new metrics)
- **Game Deep Dive** - Detailed game analysis with charts
- **Player Profile** - Complete player history and risk trends
- **Report Composer** - Generate formal findings reports
- **System Config** - Check system health and settings

### 3. **View Game Details**

1. Click any game card in the Live Feed
2. You'll see the Game Deep Dive with:
   - Accuracy trend over moves
   - Centipawn loss analysis
   - Think time patterns
   - Triggered signals breakdown

### 4. **Analyze Players**

1. Click Player Profile tab
2. System auto-loads the player from the selected game
3. View comprehensive statistics:
   - Game count and flag rate
   - Risk distribution across games
   - Confidence trends
   - Historical flag rate patterns

---

## Key Metrics Explained

### KPI Cards

| Metric | Meaning |
|--------|---------|
| Games Analyzed | Total games processed today |
| Flagged Games | Games with any risk elevation |
| High Risk | Games requiring immediate action |
| Elevated Risk | Games under observation |
| Avg Confidence | How certain the analysis is (0-1) |
| Avg Regan Z-Score | Statistical deviation measure |
| Analysis Success Rate | System reliability percentage |
| Pending Review | Games awaiting human decision |

### Charts

1. **Risk Tier Distribution** (Pie) - How many games in each risk category
2. **Confidence Scores** (Bar) - Average confidence by risk tier
3. **Risk & Confidence Trends** (Line) - 24-hour historical patterns
4. **Signal Correlation** (Scatter) - Multi-signal interaction analysis
5. **Analysis Velocity** (Bar) - Processing speed per hour
6. **Engine Accuracy** (Line) - Centipawn loss and move accuracy

---

## Database Optimization (Optional)

To speed up queries even more, run:

```bash
psql $DATABASE_URL < scripts/optimize-dashboard-schema.sql
```

This adds:
- 14 performance indexes
- 4 materialized views
- Proper permissions for APIs

---

## API Endpoints

All new endpoints are ready to use:

### Metrics APIs
```
GET /api/metrics/kpi
GET /api/metrics/dashboard
```

### Analysis APIs
```
GET /api/analysis/game/:gameId
GET /api/analysis/player/:playerId
```

All endpoints support:
- Real-time data updates
- Server-side aggregation
- Auto-refresh on the frontend

---

## Customization Tips

### Change Refresh Intervals
In `kpi-cards.tsx` and `metrics-analyzer.tsx`:
```typescript
// Default: 60,000ms (1 minute) for KPI
// Default: 30,000ms (30 seconds) for metrics

const interval = setInterval(fetchMetrics, 30000); // Edit this value
```

### Adjust Color Scheme
Edit `globals.css`:
```css
--high: #c0392b;        /* Red for HIGH risk */
--elevated: #d4691a;    /* Orange for ELEVATED */
--moderate: #c8960c;    /* Yellow for MODERATE */
--safe: #1a7a3c;        /* Green for LOW */
```

### Modify KPI Thresholds
In `kpi-cards.tsx`, update the risk level calculation:
```typescript
const riskLevel =
  kpiData.high_risk_count > 5    // Change this threshold
    ? "HIGH_RISK"
    : "LOW_RISK";
```

---

## Troubleshooting

### Charts Not Showing?
- Check browser console for API errors
- Verify Supabase connection and API keys
- Ensure database has data in the tables

### Slow Performance?
- Run the database optimization script
- Check if your Supabase plan has rate limits
- Increase refresh intervals if needed

### Missing Data?
- Verify your Supabase tables have data
- Check API route responses in Network tab
- Ensure proper database permissions are set

---

## What's Included

### New Components
- `kpi-cards.tsx` - 9 KPI metric cards
- `metrics-analyzer.tsx` - 6 interactive charts
- `game-analysis-deep-dive.tsx` - Detailed game analysis
- `player-profile-analysis.tsx` - Player statistics

### New API Routes
- `/api/metrics/kpi` - KPI data endpoint
- `/api/metrics/dashboard` - Chart data endpoint
- `/api/analysis/game/:gameId` - Game analysis endpoint
- `/api/analysis/player/:playerId` - Player analysis endpoint

### New Database Script
- `scripts/optimize-dashboard-schema.sql` - Optional indexes and views

### Documentation
- `DASHBOARD_ENHANCEMENTS.md` - Complete feature documentation
- `QUICK_START.md` - This file

---

## Next Steps

1. **Deploy to Vercel** - Push your changes to main branch
2. **Monitor Performance** - Check API response times
3. **Customize KPIs** - Adjust thresholds to match your standards
4. **Train Team** - Show arbiters how to use new features
5. **Gather Feedback** - Iterate on visualizations based on usage

---

## Support

For detailed documentation, see: `DASHBOARD_ENHANCEMENTS.md`

For architecture details, check the inline component documentation.

---

**Your enhanced dashboard is ready to go!** Start exploring the new analytics capabilities.
