---
phase: 14
plan: 2
wave: 2
---

# Plan 14.2: Visual Rendering & Functional Exports

## Objective
Transform the raw analytics data into a visually stunning, impact-driven dashboard using Recharts and custom CSS. Implement fully functional, robust PDF and Excel exports for the loan data.

## Context
- `LoanAnalyticsDashboard.jsx` handles state and data from Phase 14.1.
- We need to render the `disbursementTrends` array into a Recharts Area or Bar chart.
- We need to render `upcomingRepayments` into an elegant, styled list.
- We need to utilize `jspdf` and `xlsx` (already in `package.json` and used in `ChamaDetails.jsx`) to export these reports.

## Tasks

<task type="auto">
  <name>Premium Charting & Visual Refinement</name>
  <files>frontend/src/pages/chama/loans/LoanAnalyticsDashboard.jsx</files>
  <action>
    - Implement a rich `Recharts` graph showing Monthly Disbursement Trends (amount vs count). Look at `ChamaDetails.jsx` for theme-aware chart components.
    - Style the 4 top KPI cards (Interest, Outstanding, Default Rate, Active Loans) using `lucide-react` icons and glassmorphism/gradient backgrounds matching the premium ChamaSmart aesthetic.
    - Create a clean "Upcoming Repayments" table or list view for the next 30 days data.
    - Ensure responsiveness for mobile (grid-cols-1 vs md:grid-cols-2 lg:grid-cols-4).
  </action>
  <verify>grep -n "Recharts" frontend/src/pages/chama/loans/LoanAnalyticsDashboard.jsx</verify>
  <done>UI includes interactive charts and styled KPI cards matching theme.</done>
</task>

<task type="auto">
  <name>Functional Report Exports</name>
  <files>frontend/src/pages/chama/loans/LoanAnalyticsDashboard.jsx</files>
  <action>
    - Implement `exportToPDF` function. Use `jspdf` and `jspdf-autotable`. Add a clean header, title, and a table mapping `upcomingRepayments` and `summary` stats.
    - Implement `exportToExcel` function. Use `XLSX.utils.book_new` and append sheets for "Summary", "Upcoming Dues", and "Trends".
    - Tie these functions to "Export PDF" and "Export Excel" buttons in the dashboard header. Provide toast feedback on success/failure.
  </action>
  <verify>grep -n "exportToPDF" frontend/src/pages/chama/loans/LoanAnalyticsDashboard.jsx</verify>
  <done>PDF and Excel files are generated and downloaded seamlessly with structured data.</done>
</task>

## Success Criteria
- [ ] Monthly trends render successfully in a responsive Recharts component.
- [ ] KPI cards use premium CSS styling and dynamic coloring (e.g., Red for high default rate, Green for good recovery).
- [ ] Export PDF button downloads a styled document.
- [ ] Export Excel button downloads a multi-sheet workbook.
