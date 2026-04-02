/**
 * Artificial Intelligence Expert System
 * Uses Forward-Chaining Inference Engine with MYCIN-style Certainty Factors
 * Implements 15 Production Rules and an Explanation Facility Trace.
 */
class ExpertSystem {
  constructor() {
    this.explanationTrace = [];
    this.certaintyFactor = 0.0;
    this.workingMemory = {};
    this.rulesFired = new Set();
  }

  /**
   * MYCIN Certainty Factor Combination Math
   */
  combineCertainty(existingCF, newCF) {
    let result = 0;
    if (existingCF >= 0 && newCF >= 0) {
      result = existingCF + newCF * (1 - existingCF);
    } else if (existingCF < 0 && newCF < 0) {
      result = existingCF + newCF * (1 + existingCF);
    } else {
      result = (existingCF + newCF) / (1 - Math.min(Math.abs(existingCF), Math.abs(newCF)));
    }
    // Prevent floating point anomalies
    return Math.max(-1.0, Math.min(1.0, result));
  }

  evaluate(facts) {
    this.startTime = process.hrtime();
    
    // Initialize exactly 21 Working Memory Attributes
    this.workingMemory = {
      chamaId: facts.chamaId || null,
      userId: facts.userId || null,
      requestedAmount: parseFloat(facts.requestedAmount) || 0,
      chamaType: facts.chamaType || 'UNKNOWN',
      savings: parseFloat(facts.savings) || 0,
      defaultedCount: parseInt(facts.defaultedCount) || 0,
      loanMultiplierConfig: parseFloat(facts.loanMultiplierConfig) || 3.0,
      availableTreasury: parseFloat(facts.availableTreasury) || 0,
      treasuryTotal: parseFloat(facts.treasuryTotal) || 0,
      trustScore: parseFloat(facts.trustScore) || 50.0,
      guarantorCover: parseFloat(facts.guarantorCover) || 0,
      activeLoansBalance: parseFloat(facts.activeLoansBalance) || 0,
      totalContributions: parseFloat(facts.totalContributions) || 0,
      repaymentPeriod: parseInt(facts.repaymentPeriod) || 1,
      isActiveMember: Boolean(facts.isActiveMember),
      hasPendingLoans: Boolean(facts.hasPendingLoans),
      // Computed attributes internal to memory
      treasuryUtilization: 0,
      savingsRatio: 0,
      isLiquid: false,
      guarantorSufficient: false,
      baseEligibility: false,
    };

    // Calculate dynamic memory attributes
    this.workingMemory.treasuryUtilization = this.workingMemory.treasuryTotal > 0 
      ? 1 - (this.workingMemory.availableTreasury / this.workingMemory.treasuryTotal) 
      : 1;
    this.workingMemory.savingsRatio = this.workingMemory.savings > 0 
      ? this.workingMemory.requestedAmount / this.workingMemory.savings 
      : Infinity;
    this.workingMemory.isLiquid = this.workingMemory.availableTreasury >= this.workingMemory.requestedAmount;
    this.workingMemory.guarantorSufficient = this.workingMemory.guarantorCover >= this.workingMemory.requestedAmount;
    this.workingMemory.baseEligibility = this.workingMemory.savings > 0 && !this.workingMemory.hasPendingLoans;

    this.explanationTrace.push(`[INIT] Loaded ${Object.keys(this.workingMemory).length} Working Memory Attributes.`);
    this.explanationTrace.push(`[INIT] Initial Certainty Factor: 0.0`);

    // 15 Production Rules
    const productionRules = [
      {
        id: "R01",
        name: "Base Eligibility Block",
        condition: (m) => m.savings <= 0 || !m.isActiveMember,
        cf: -1.0,
        explanation: "Member has no active savings or is inactive."
      },
      {
        id: "R02",
        name: "Defaulted History Penalty",
        condition: (m) => m.defaultedCount > 0,
        cf: -1.0,
        explanation: "Member has history of defaulted loans."
      },
      {
        id: "R03",
        name: "ASCA Multiplier Violation",
        condition: (m) => m.chamaType === 'ASCA' && m.savingsRatio > 3,
        cf: -0.9,
        explanation: "Requested amount exceeds strict ASCA 3x multiplier."
      },
      {
        id: "R04",
        name: "Table Banking Multiplier Violation",
        condition: (m) => m.chamaType !== 'ASCA' && m.savingsRatio > m.loanMultiplierConfig,
        cf: -0.9,
        explanation: "Requested amount exceeds configured loan multiplier."
      },
      {
        id: "R05",
        name: "Excellent Savings Ratio (Low Risk)",
        condition: (m) => m.savingsRatio <= 0.5,
        cf: 0.6,
        explanation: "Requested loan is fully collateralized by 2x personal savings."
      },
      {
        id: "R06",
        name: "Safe Savings Ratio (Medium Risk)",
        condition: (m) => m.savingsRatio > 0.5 && m.savingsRatio <= 1.0,
        cf: 0.4,
        explanation: "Requested loan matches or is slightly below full personal savings."
      },
      {
        id: "R07",
        name: "Standard Leveraged Loan",
        condition: (m) => m.savingsRatio > 1.0 && m.savingsRatio <= 2.0,
        cf: 0.2,
        explanation: "Leveraging savings within standard capacity (1-2x)."
      },
      {
        id: "R08",
        name: "High Leverage Risk Penalty",
        condition: (m) => m.savingsRatio > 2.0,
        cf: -0.3,
        explanation: "High leverage (>2x savings) increases default risk probability."
      },
      {
        id: "R09",
        name: "Treasury Liquidity Barrier",
        condition: (m) => !m.isLiquid,
        cf: -1.0,
        explanation: "Insufficient treasury liquidity to disburse the requested amount."
      },
      {
        id: "R10",
        name: "High Trust Score Endorsement",
        condition: (m) => m.trustScore >= 80,
        cf: 0.5,
        explanation: "Borrower has an excellent historical trust standing."
      },
      {
        id: "R11",
        name: "Low Trust Score Deterrent",
        condition: (m) => m.trustScore < 40,
        cf: -0.4,
        explanation: "Borrower has a statistically poor trust standing."
      },
      {
        id: "R12",
        name: "Healthy Treasury Bonus",
        condition: (m) => m.treasuryUtilization < 0.6,
        cf: 0.3,
        explanation: "Treasury is highly liquid, encouraging healthy lending."
      },
      {
        id: "R13",
        name: "Strained Treasury Penalty",
        condition: (m) => m.treasuryUtilization > 0.85,
        cf: -0.5,
        explanation: "Treasury utilization is critical; capital preservation is favored."
      },
      {
        id: "R14",
        name: "Guarantor Over-collateralization",
        condition: (m) => m.guarantorCover > m.requestedAmount,
        cf: 0.7,
        explanation: "Loan risk is fully mitigated by sufficient third-party guarantors."
      },
      {
        id: "R15",
        name: "Insufficient Guarantor Coverage",
        condition: (m) => m.chamaType === 'ASCA' && !m.guarantorSufficient,
        cf: -1.0,
        explanation: "Lack of required guarantor cover for ASCA high-leverage loan."
      }
    ];

    // Forward-Chaining Inference Loop
    let cycleCount = 0;
    let ruleFiredThisCycle = true;

    while (ruleFiredThisCycle) {
      ruleFiredThisCycle = false;
      cycleCount++;

      for (let rule of productionRules) {
        if (!this.rulesFired.has(rule.id) && rule.condition(this.workingMemory)) {
          // Rule fires!
          this.rulesFired.add(rule.id);
          const oldCF = this.certaintyFactor;
          this.certaintyFactor = this.combineCertainty(this.certaintyFactor, rule.cf);
          
          this.explanationTrace.push(
             `[CYCLE ${cycleCount}] RULE ${rule.id} FIRED: ${rule.name}. ` +
             `CF Δ: (${oldCF.toFixed(2)} + ${rule.cf.toFixed(2)}) => ${this.certaintyFactor.toFixed(2)} | Reason: ${rule.explanation}`
          );
          
          ruleFiredThisCycle = true;
          break; // Break loop to restart forward-chaining cycle with new memory states (if any changed)
        }
      }
    }

    // Determine Final Decision Threshold (+0.2 required to approve)
    const approved = this.certaintyFactor > 0.2;
    const diffTime = process.hrtime(this.startTime);
    const inferenceTimeMs = (diffTime[0] * 1000) + (diffTime[1] / 1000000);

    const resultStr = approved ? "APPROVED" : "DENIED";
    this.explanationTrace.push(`[CONCLUSION] Final CF: ${this.certaintyFactor.toFixed(2)}. Threshold: > 0.2. Decision: ${resultStr}`);
    this.explanationTrace.push(`[PERFORMANCE] Inference Time: ${inferenceTimeMs.toFixed(2)}ms across ${this.rulesFired.size} fired rules.`);

    return {
      approved,
      certaintyFactor: this.certaintyFactor,
      explanationTrace: this.explanationTrace,
      inferenceTimeMs,
      rulesFiredCount: this.rulesFired.size
    };
  }
}

module.exports = ExpertSystem;
