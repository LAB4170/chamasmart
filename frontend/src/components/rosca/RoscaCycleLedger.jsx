import React from 'react';
import { CheckCircle2, CircleDot, User, Calendar, CreditCard } from 'lucide-react';

const RoscaCycleLedger = ({ contributions, roster, contributionAmount }) => {
    // Group contributions by user
    const memberPayments = roster.map(member => {
        const userContributions = contributions.filter(c => c.user_id === member.user_id && c.contribution_type === 'ROSCA');
        const totalPaid = userContributions.reduce((sum, c) => sum + parseFloat(c.amount), 0);
        
        return {
            ...member,
            totalPaid,
            lastPayment: userContributions[0]?.contribution_date
        };
    });

    return (
        <div className="card-premium h-full overflow-hidden flex flex-col shadow-lg border border-gray-100">
            <div className="p-5 border-b border-gray-100 bg-gray-50/30">
                <h3 className="card-title-premium flex items-center gap-2 mb-1">
                    <div className="p-1.5 bg-indigo-100 text-indigo-600 rounded-lg">
                        <CreditCard size={18} />
                    </div>
                    Contribution Ledger
                </h3>
                <p className="text-xs text-gray-500">Real-time status of cycle funding</p>
            </div>

            <div className="overflow-x-auto flex-1">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-gray-50/50">
                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Member</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Total Paid</th>
                            <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {memberPayments.map((member) => {
                            // Target is contributionAmount * current round (simplified to basic amount check here)
                            const isFullyPaid = member.totalPaid >= contributionAmount;
                            
                            return (
                                <tr key={member.user_id} className="hover:bg-indigo-50/30 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs ring-4 ring-white">
                                                {member.first_name?.[0]?.toUpperCase() || <User size={14} />}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-sm font-semibold text-gray-800">{member.first_name} {member.last_name}</span>
                                                {member.lastPayment && (
                                                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                                                        <Calendar size={10} /> {new Date(member.lastPayment).toLocaleDateString()}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="text-sm font-bold text-gray-900">
                                                KES {member.totalPaid.toLocaleString()}
                                            </span>
                                            <span className="text-[10px] text-gray-400">
                                                Ref: KES {contributionAmount.toLocaleString()}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        {isFullyPaid ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wide">
                                                <CheckCircle2 size={10} /> Fully Paid
                                            </span>
                                        ) : member.totalPaid > 0 ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-wide">
                                                <CircleDot size={10} /> Partial
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 text-[10px] font-bold uppercase tracking-wide">
                                                <CircleDot size={10} /> Pending
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            
            <div className="p-4 bg-indigo-50/50 border-t border-indigo-100 text-center">
                <p className="text-[10px] text-indigo-600 font-medium uppercase tracking-widest">
                    Immutable Transaction Record
                </p>
            </div>
        </div>
    );
};

export default RoscaCycleLedger;
