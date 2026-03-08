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
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Header
      doc.setFontSize(22);
      doc.setTextColor(33, 37, 41);
      doc.text("Loan Analytics Report", 14, 25);
      
      doc.setFontSize(10);
      doc.setTextColor(108, 117, 125);
      doc.text(`Chama ID: ${chamaId} | Generated: ${new Date().toLocaleString('en-KE')}`, 14, 32);

      // Horizontal Line
      doc.setDrawColor(200, 200, 200);
      doc.line(14, 35, pageWidth - 14, 35);

      // Summary Stats Section
      doc.setFontSize(14);
      doc.setTextColor(33, 37, 41);
      doc.text("Financial Summary", 14, 45);

      doc.autoTable({
        startY: 50,
        head: [['Metric', 'Value']],
        body: [
          ['Total Interest Earned', fmt(data.summary.total_interest_earned)],
          ['Total Outstanding Balance', fmt(data.summary.total_outstanding_balance)],
          ['Average Default Rate', `${data.defaultRate}%`],
          ['Active Loans Count', data.summary.active_loans_count.toString()]
        ],
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246], fontSize: 11, fontStyle: 'bold' },
        bodyStyles: { fontSize: 10 },
        columnStyles: { 0: { fontStyle: 'bold', cellWidth: 80 } }
      });

      // Upcoming Repayments
      const nextY = doc.lastAutoTable.finalY + 15;
      doc.setFontSize(14);
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
        headStyles: { fillColor: [75, 85, 99], fontSize: 10 },
        bodyStyles: { fontSize: 9 }
      });

      // Footer
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, doc.internal.pageSize.getHeight() - 10, { align: 'center' });
      }

      doc.save(`Chama_${chamaId}_Loan_Report.pdf`);
      toast.success("PDF Report generated successfully");
    } catch (err) {
      console.error("PDF Export Error:", err);
      toast.error("Failed to generate PDF report");
    }
  };

  const exportToExcel = () => {
    if (!data) return;
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Executive Summary
      const summaryData = [
        ["CHAMASMART LOAN ANALYTICS SUMMARY"],
        ["Generated on", new Date().toLocaleString()],
        [],
        ["Metric", "Value"],
        ["Total Interest Earned", data.summary.total_interest_earned],
        ["Total Outstanding Balance", data.summary.total_outstanding_balance],
        ["Default Rate", `${data.defaultRate}%`],
        ["Active Loans Count", data.summary.active_loans_count]
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

      // Sheet 2: Upcoming Repayments
      const formattedUpcoming = data.upcomingRepayments.map(r => ({
        "Member Name": r.borrower_name,
        "Amount Due (KES)": r.amount_due,
        "Due Date": new Date(r.next_repayment_date).toLocaleDateString('en-KE'),
        "Status": "PENDING"
      }));
      const wsUpcoming = XLSX.utils.json_to_sheet(formattedUpcoming);
      XLSX.utils.book_append_sheet(wb, wsUpcoming, "Repayment Schedule");

      // Sheet 3: Disbursement Trends
      const wsTrends = XLSX.utils.json_to_sheet(data.disbursementTrends.map(t => ({
        "Reporting Month": t.month,
        "Total Disbursed (KES)": t.amount,
        "Number of Loans": t.count
      })));
      XLSX.utils.book_append_sheet(wb, wsTrends, "Historical Trends");

      XLSX.writeFile(wb, `Chama_${chamaId}_Loan_Analytics.xlsx`);
      toast.success("Excel Workbook generated successfully");
    } catch (err) {
      console.error("Excel Export Error:", err);
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
          <div className="kpi-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
            <TrendingUp size={24} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Yield Generated</span>
            <span className="kpi-value text-green">{fmt(summary.total_interest_earned)}</span>
          </div>
        </div>
        
        <div className="kpi-card glass-card">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
            <DollarSign size={24} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Deployed Capital</span>
            <span className="kpi-value text-blue">{fmt(summary.total_outstanding_balance)}</span>
          </div>
        </div>

        <div className="kpi-card glass-card">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
            <Activity size={24} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Risk Profile</span>
            <span className="kpi-value" style={{ color: defaultRate > 10 ? '#ef4444' : '#10b981' }}>
              {defaultRate}% DFLT
            </span>
          </div>
        </div>

        <div className="kpi-card glass-card">
          <div className="kpi-icon-wrap" style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' }}>
            <FileText size={24} />
          </div>
          <div className="kpi-content">
            <span className="kpi-label">Asset Velocity</span>
            <span className="kpi-value text-purple">{summary.active_loans_count} active</span>
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
                <AreaChart data={disbursementTrends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                      <stop offset="50%" stopColor="#3b82f6" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} 
                    dy={10}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }} 
                    tickFormatter={(val) => `KES ${val >= 1000 ? (val / 1000).toFixed(1) + 'k' : val}`}
                  />
                  <Tooltip 
                    cursor={{ stroke: '#3b82f6', strokeWidth: 2, strokeDasharray: '5 5' }}
                    formatter={(value) => [fmt(value), "Disbursed"]}
                    contentStyle={{ 
                      borderRadius: '16px', 
                      border: '1px solid rgba(255,255,255,0.3)', 
                      backdropFilter: 'blur(12px)',
                      background: 'rgba(255,255,255,0.8)',
                      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
                      padding: '12px'
                    }}
                    itemStyle={{ fontWeight: 800, color: '#1e293b' }}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="#3b82f6" 
                    strokeWidth={4} 
                    fillOpacity={1} 
                    fill="url(#colorAmount)"
                    animationDuration={1500}
                  />
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
                    <Calendar size={20} />
                  </div>
                  <div className="upcoming-details">
                    <span className="borrower-name">{rep.borrower_name}</span>
                    <span className="due-date">Scheduled for {new Date(rep.next_repayment_date).toLocaleDateString()}</span>
                  </div>
                  <div className="upcoming-amount">
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
        .analytics-container { display: flex; flex-direction: column; gap: 1.5rem; margin-top: 1.5rem; animation: fadeIn 0.5s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        
        .analytics-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; border-bottom: 1px solid var(--border); padding-bottom: 1rem; }
        .analytics-actions { display: flex; gap: 0.75rem; }
        
        .btn-action-outline { 
          border: 1px solid var(--border); 
          background: rgba(255, 255, 255, 0.05); 
          backdrop-filter: blur(8px);
          padding: 0.5rem 1rem; 
          border-radius: 10px; 
          display: inline-flex; 
          align-items: center; 
          gap: 0.5rem; 
          font-weight: 600; 
          font-size: 0.875rem; 
          cursor: pointer; 
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
          color: var(--text-secondary); 
        }
        .btn-action-outline:hover { 
          background: var(--primary-light); 
          color: var(--primary); 
          border-color: var(--primary); 
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
        }

        .glass-card { 
          background: rgba(255, 255, 255, 0.7); 
          backdrop-filter: blur(12px); 
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.3); 
          border-radius: 20px; 
          padding: 1.5rem; 
          box-shadow: 0 8px 32px 0 rgba(31, 38, 135, 0.07); 
        }
        
        .kpi-grid { display: grid; grid-template-columns: repeat(1, 1fr); gap: 1.25rem; }
        @media(min-width: 640px) { .kpi-grid { grid-template-columns: repeat(2, 1fr); } }
        @media(min-width: 1024px) { .kpi-grid { grid-template-columns: repeat(4, 1fr); } }
        
        .kpi-card { 
          display: flex; 
          align-items: center; 
          gap: 1.25rem; 
          position: relative;
          overflow: hidden;
          transition: transform 0.3s;
        }
        .kpi-card:hover { transform: scale(1.02); }
        .kpi-card::after {
          content: "";
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(255,255,255,0.2) 0%, transparent 70%);
          opacity: 0;
          transition: opacity 0.3s;
        }
        .kpi-card:hover::after { opacity: 1; }

        .kpi-icon-wrap { 
          width: 54px; 
          height: 54px; 
          border-radius: 16px; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          flex-shrink: 0; 
          box-shadow: inset 0 2px 4px rgba(0,0,0,0.05);
        }
        
        .kpi-content { display: flex; flex-direction: column; }
        .kpi-label { font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-muted); margin-bottom: 0.25rem; }
        .kpi-value { font-size: 1.35rem; font-weight: 900; color: var(--text-primary); letter-spacing: -0.02em; }
        
        .charts-grid { display: grid; grid-template-columns: 1fr; gap: 1.5rem; margin-top: 0.5rem; }
        @media(min-width: 1280px) { .charts-grid { grid-template-columns: 2.2fr 1fr; } }
        
        .chart-title { font-size: 1rem; color: var(--text-primary); display: flex; align-items: center; gap: 0.5rem; }
        
        .upcoming-list { display: flex; flex-direction: column; gap: 0.875rem; max-height: 380px; overflow-y: auto; padding-right: 4px; }
        .upcoming-list::-webkit-scrollbar { width: 4px; }
        .upcoming-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 10px; }
        
        .upcoming-item { 
          display: flex; 
          align-items: center; 
          gap: 1rem; 
          padding: 1rem; 
          background: rgba(255, 255, 255, 0.4); 
          border-radius: 16px; 
          border: 1px solid rgba(255, 255, 255, 0.5); 
          transition: all 0.2s;
        }
        .upcoming-item:hover { background: #fff; transform: translateX(5px); border-color: var(--primary-light); }
        
        .upcoming-icon { background: rgba(245, 158, 11, 0.1); color: #f59e0b; padding: 0.6rem; border-radius: 12px; }
        .upcoming-details { display: flex; flex-direction: column; flex: 1; }
        .borrower-name { font-size: 0.95rem; font-weight: 700; color: var(--text-primary); }
        .due-date { font-size: 0.75rem; font-weight: 600; color: var(--text-muted); }
        .upcoming-amount { font-size: 1rem; font-weight: 800; color: #ef4444; }
        
        .text-green { color: #10b981 !important; }
        .text-purple { color: #a855f7 !important; }
        .text-blue { color: #3b82f6 !important; }
        
        .empty-chart { height: 320px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text-muted); background: var(--surface); border-radius: 20px; border: 2px dashed var(--border); gap: 1rem; }
      `}</style>
    </div>
  );
}
