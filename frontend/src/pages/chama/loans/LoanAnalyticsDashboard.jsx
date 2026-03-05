import React, { useState, useEffect } from 'react';
import { loanAPI } from "../../../services/api";
import { toast } from "react-toastify";
import { 
  DollarSign, TrendingUp, AlertTriangle, FileText, Download, Activity, Calendar
} from "lucide-react";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import jsPDF from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";

export default function LoanAnalyticsDashboard({ chamaId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let isMounted = true;
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const res = await loanAPI.getAnalytics(chamaId);
        if (isMounted) setData(res.data.data);
      } catch (err) {
        console.error("Error fetching loan analytics:", err);
        if (isMounted) setError("Failed to load analytics data");
        toast.error("Failed to load analytics data");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchAnalytics();
    return () => { isMounted = false; };
  }, [chamaId]);

  const fmt = (num) => new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES' }).format(num || 0);

  const exportToPDF = () => {
    if (!data) return;
    try {
      const doc = new jsPDF();
      
      // Header
      doc.setFontSize(20);
      doc.setTextColor(33, 37, 41);
      doc.text("Loan Analytics Report", 14, 22);
      
      doc.setFontSize(10);
      doc.setTextColor(108, 117, 125);
      doc.text(`Generated on: ${new Date().toLocaleDateString('en-KE')}`, 14, 30);

      // Summary Stats
      doc.autoTable({
        startY: 40,
        head: [['Metric', 'Value']],
        body: [
          ['Total Interest Earned', fmt(data.summary.total_interest_earned)],
          ['Total Outstanding Balance', fmt(data.summary.total_outstanding_balance)],
          ['Default Rate', `${data.defaultRate}%`],
          ['Active Loans Count', data.summary.active_loans_count.toString()]
        ],
        theme: 'grid',
        headStyles: { fillColor: [43, 91, 132] }
      });

      // Upcoming Repayments
      const nextY = doc.lastAutoTable.finalY + 15;
      doc.setFontSize(14);
      doc.setTextColor(33, 37, 41);
      doc.text("Upcoming Repayments (Next 30 Days)", 14, nextY);

      doc.autoTable({
        startY: nextY + 5,
        head: [['Borrower', 'Amount Due', 'Due Date']],
        body: data.upcomingRepayments.map(r => [
          r.borrower_name,
          fmt(r.amount_due),
          new Date(r.next_repayment_date).toLocaleDateString('en-KE')
        ]),
        theme: 'striped',
        headStyles: { fillColor: [75, 85, 99] }
      });

      doc.save("Loan_Analytics_Report.pdf");
      toast.success("PDF Downloaded Successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate PDF");
    }
  };

  const exportToExcel = () => {
    if (!data) return;
    try {
      const wb = XLSX.utils.book_new();

      // Summary Sheet
      const wsSummary = XLSX.utils.json_to_sheet([
        { Metric: 'Total Interest Earned', Value: fmt(data.summary.total_interest_earned) },
        { Metric: 'Total Outstanding Balance', Value: fmt(data.summary.total_outstanding_balance) },
        { Metric: 'Default Rate', Value: `${data.defaultRate}%` },
        { Metric: 'Active Loans Count', Value: data.summary.active_loans_count }
      ]);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

      // Upcoming Sheet
      const formattedUpcoming = data.upcomingRepayments.map(r => ({
        "Borrower": r.borrower_name,
        "Amount Due": r.amount_due, // Raw number for excel math
        "Due Date": new Date(r.next_repayment_date).toLocaleDateString('en-KE')
      }));
      const wsUpcoming = XLSX.utils.json_to_sheet(formattedUpcoming);
      XLSX.utils.book_append_sheet(wb, wsUpcoming, "Upcoming Repayments");

      // Trends Sheet
      const wsTrends = XLSX.utils.json_to_sheet(data.disbursementTrends.map(t => ({
        "Month": t.month,
        "Total Amount Disbursed": t.amount,
        "Loan Count": t.count
      })));
      XLSX.utils.book_append_sheet(wb, wsTrends, "Disbursement Trends");

      XLSX.writeFile(wb, "Loan_Analytics_Data.xlsx");
      toast.success("Excel Downloaded Successfully");
    } catch (err) {
      console.error(err);
      toast.error("Failed to generate Excel file");
    }
  };

  if (loading) {
    return (
      <div className="lw-root" style={{ minHeight: "40vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Activity size={36} className="lw-spin-slowly" style={{ color: "var(--primary)" }}/>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="alert alert-error" style={{ marginTop: "1rem" }}>
        <AlertTriangle size={16} /> {error || "No data available. Apply for some loans to see analytics."}
      </div>
    );
  }

  const { summary, defaultRate, upcomingRepayments, disbursementTrends } = data;

  return (
    <div className="analytics-container mt-4">
      {/* Header Actions */}
      <div className="analytics-header">
        <h2 className="text-xl font-bold">Loan Performance Overview</h2>
        <div className="analytics-actions">
          <button onClick={exportToPDF} className="btn-action-outline">
            <FileText size={16} /> Export PDF
          </button>
          <button onClick={exportToExcel} className="btn-action-outline">
            <Download size={16} /> Export Excel
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="kpi-grid">
        <div className="kpi-card glass-card">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e' }}>
            <TrendingUp size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Interest Earned</span>
            <span className="kpi-value text-green">{fmt(summary.total_interest_earned)}</span>
          </div>
        </div>
        
        <div className="kpi-card glass-card">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6' }}>
            <DollarSign size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Outstanding Balance</span>
            <span className="kpi-value">{fmt(summary.total_outstanding_balance)}</span>
          </div>
        </div>

        <div className="kpi-card glass-card">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}>
            <AlertTriangle size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Default Rate</span>
            <span className="kpi-value">{defaultRate}%</span>
          </div>
        </div>

        <div className="kpi-card glass-card">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}>
            <FileText size={22} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Active Loans</span>
            <span className="kpi-value">{summary.active_loans_count}</span>
          </div>
        </div>
      </div>

      <div className="charts-grid">
        {/* Chart Area */}
        <div className="glass-card chart-wrapper">
          <h3 className="chart-title mb-4 font-bold text-gray-700">Monthly Disbursements (Last 6 Months)</h3>
          {disbursementTrends?.length > 0 ? (
            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <AreaChart data={disbursementTrends} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} tickFormatter={(val) => `KES ${val / 1000}k`} />
                  <Tooltip 
                    formatter={(value) => [fmt(value), "Amount"]}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area type="monotone" dataKey="amount" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorAmount)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty-chart">Not enough data to map trends</div>
          )}
        </div>

        {/* Upcoming Area */}
        <div className="glass-card upcoming-wrapper">
          <h3 className="chart-title mb-4 font-bold text-gray-700">Upcoming Dues (Next 30 Days)</h3>
          <div className="upcoming-list">
            {upcomingRepayments?.length > 0 ? (
              upcomingRepayments.map((rep, idx) => (
                <div key={idx} className="upcoming-item">
                  <div className="upcoming-icon">
                    <Calendar size={18} />
                  </div>
                  <div className="upcoming-details">
                    <span className="borrower-name font-semibold">{rep.borrower_name}</span>
                    <span className="due-date text-xs text-gray-500">Due: {new Date(rep.next_repayment_date).toLocaleDateString()}</span>
                  </div>
                  <div className="upcoming-amount font-bold text-error">
                    {fmt(rep.amount_due)}
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-list text-gray-400 text-sm italic">No repayments due in the next 30 days.</div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .analytics-container { display: flex; flex-direction: column; gap: 1.5rem; margin-top: 1.5rem; }
        .analytics-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; }
        .analytics-actions { display: flex; gap: 0.75rem; }
        .btn-action-outline { border: 1px solid var(--border); background: var(--surface); padding: 0.5rem 1rem; border-radius: 8px; display: inline-flex; align-items: center; gap: 0.5rem; font-weight: 600; font-size: 0.875rem; cursor: pointer; transition: all 0.2s; color: var(--text-secondary); }
        .btn-action-outline:hover { background: var(--primary-light); color: var(--primary); border-color: var(--primary); }
        .glass-card { background: var(--surface-2); border: 1px solid var(--border); border-radius: 12px; padding: 1.25rem; box-shadow: var(--shadow-sm); }
        .kpi-grid { display: grid; grid-template-columns: repeat(1, 1fr); gap: 1rem; }
        @media(min-width: 640px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
        @media(min-width: 1024px) { .kpi-grid { grid-template-columns: repeat(4, 1fr); } }
        .charts-grid { display: grid; grid-template-columns: 1fr; gap: 1.5rem; margin-top: 0.5rem; }
        @media(min-width: 1024px) { .charts-grid { grid-template-columns: 2fr 1fr; } }
        .kpi-card { display: flex; align-items: center; gap: 1rem; }
        .kpi-icon-wrap { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .kpi-content { display: flex; flex-direction: column; }
        .kpi-label { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); margin-bottom: 0.2rem; }
        .kpi-value { font-size: 1.25rem; font-weight: 800; color: var(--text-primary); }
        .text-green { color: #22c55e !important; }
        .text-error { color: #ef4444 !important; }
        .mb-4 { margin-bottom: 1rem; }
        .empty-chart { height: 300px; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-style: italic; background: var(--surface); border-radius: 8px; border: 1px dashed var(--border); }
        .upcoming-list { display: flex; flex-direction: column; gap: 0.75rem; }
        .upcoming-item { display: flex; align-items: center; gap: 1rem; padding: 0.75rem; background: var(--surface); border-radius: 8px; border: 1px solid var(--border); }
        .upcoming-icon { background: rgba(245, 158, 11, 0.15); color: #f59e0b; padding: 0.5rem; border-radius: 8px; }
        .upcoming-details { display: flex; flex-direction: column; flex: 1; }
      `}</style>
    </div>
  );
}
