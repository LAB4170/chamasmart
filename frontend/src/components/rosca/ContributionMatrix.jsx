import React from 'react';
import { CheckCircle2, Clock, User } from 'lucide-react';

/**
 * ContributionMatrix Component
 * Visualizes ROSCA contributions across members and rounds.
 * 
 * @param {Array} roster - The cycle roster (member info + positions)
 * @param {Array} members - All chama members
 * @param {Array} contributions - Contribution history
 * @param {Function} formatCurrency - Currency formatter
 * @param {Object} activeCycle - The current active cycle object
 */
const ContributionMatrix = ({ roster, members, contributions, formatCurrency, activeCycle }) => {
  if (!roster || roster.length === 0) return null;

  // Use amount from activeCycle or fallback to first roster entry if exists
  const amountPerRound = activeCycle?.contribution_amount || roster[0]?.contribution_amount || 0;
  const cycleId = activeCycle?.cycle_id;
  
  // Sort roster by position to ensure correct turn sequence
  const sortedRoster = [...roster].sort((a, b) => a.position - b.position);
  const rounds = sortedRoster.map(r => r.position);

  return (
    <div className="contribution-matrix mt-8 card-premium" style={{ clear: 'both' }}>
      <div className="flex items-center justify-between mb-6" style={{ flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h4 className="card-title-premium m-0">Contribution Tracking Matrix</h4>
          <p className="text-secondary m-0" style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>Status of payments per round</p>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--success-color)' }}>
            <CheckCircle2 size={16} /> Paid
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--warning-color)' }}>
            <Clock size={16} /> Pending
          </div>
        </div>
      </div>

      <div style={{ overflowX: 'auto', paddingBottom: '0.5rem', width: '100%' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr>
              <th style={{ padding: '0.75rem', textAlign: 'left', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em', position: 'sticky', left: 0, backgroundColor: 'var(--card-bg)', zIndex: 10, borderBottom: '1px solid var(--border-color)' }}>Member</th>
              {rounds.map(round => (
                <th key={round} style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: '0.75rem', letterSpacing: '0.05em', borderBottom: '1px solid var(--border-color)' }}>
                  Round {round}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRoster.map((member, mIdx) => {
              // Calculate total paid by this member specifically for this ROSCA cycle
              // We filter by cycle_id to ensure we only count payments for this specific cycle
              const totalPaid = contributions
                .filter(c => 
                  c.user_id === member.user_id && 
                  (cycleId ? c.cycle_id === cycleId : true) &&
                  (c.status === 'COMPLETED' || c.verification_status === 'VERIFIED')
                )
                .reduce((sum, c) => sum + parseFloat(c.amount), 0);

              return (
                <tr key={member.user_id || mIdx} style={{ transition: 'background-color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-primary-light)'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}>
                  <td style={{ padding: '0.75rem', position: 'sticky', left: 0, backgroundColor: 'var(--card-bg)', zIndex: 10, borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ minWidth: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--bg-primary-light)', color: 'var(--primary-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', flexShrink: 0 }}>
                        {member.first_name?.[0] || 'U'}{member.last_name?.[0] || 'M'}
                      </div>
                      <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                        {member.first_name} {member.last_name}
                      </span>
                    </div>
                  </td>
                  {rounds.map(round => {
                    const isPaidForRound = totalPaid >= Math.floor(round * amountPerRound);
                    
                    return (
                      <td key={round} style={{ padding: '0.75rem', textAlign: 'center', borderBottom: '1px solid var(--border-color)' }}>
                        {isPaidForRound ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(34, 197, 94, 0.15)', color: 'var(--success-color)', margin: '0 auto' }}>
                            <CheckCircle2 size={16} />
                          </div>
                        ) : (
                          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning-color)', opacity: 0.6, margin: '0 auto' }}>
                            <Clock size={16} />
                          </div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', gap: '1rem', flexWrap: 'wrap' }}>
        <span>Unit Amount: {formatCurrency(amountPerRound)}</span>
        <span>Total Expected Rounds: {rounds.length}</span>
      </div>
    </div>
  );
};

export default ContributionMatrix;
