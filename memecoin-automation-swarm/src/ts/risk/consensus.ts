import * as redis from "../shared/redis";
import { CHANNELS } from "../shared/types";

export interface SpendProposal {
  id: string;
  proposer: string;
  amount_sol: number;
  estimated_cost_sol: number;
  reason: string;
  timestamp: number;
  nonce: number; // replay protection per proposer
}

export interface ValidatorVote {
  name: string;
  approved: boolean;
  reason?: string;
}

export interface ValidationResult {
  proposalId: string;
  approved: boolean;
  votes: ValidatorVote[];
  thresholdMet: number;
  thresholdRequired: number;
  timestamp: number;
}

export abstract class AuthenticityValidator {
  abstract name: string;
  abstract evaluate(_proposal: SpendProposal, _gateway?: ConsensusGateway): Promise<boolean>;
}

export class BudgetValidator extends AuthenticityValidator {
  name = "BudgetValidator";
  async evaluate(proposal: SpendProposal): Promise<boolean> {
    return proposal.estimated_cost_sol <= proposal.amount_sol;
  }
}

export class SecurityValidator extends AuthenticityValidator {
  name = "SecurityValidator";
  async evaluate(proposal: SpendProposal): Promise<boolean> {
    const allowedProposers = ["mint-module", "viral-module", "txeng-module"];
    return allowedProposers.includes(proposal.proposer);
  }
}

export class StrategyValidator extends AuthenticityValidator {
  name = "StrategyValidator";
  async evaluate(proposal: SpendProposal): Promise<boolean> {
    const keywords = ["vampire", "clone", "intercept"];
    return keywords.some((kw) => proposal.reason.toLowerCase().includes(kw));
  }
}

export class ConsensusGateway {
  private validators: AuthenticityValidator[];
  private threshold: number;

  constructor(threshold?: number) {
    this.validators = [
      new BudgetValidator(),
      new SecurityValidator(),
      new StrategyValidator(),
    ];
    this.threshold = threshold ?? this.validators.length;
  }

  async requestApproval(proposal: SpendProposal): Promise<boolean> {
    console.log(`\n[ConsensusGateway] Evaluating SpendProposal ${proposal.id}`);
    console.log(
      `[ConsensusGateway] Proposer: ${proposal.proposer} | Amount: ${proposal.amount_sol} SOL | Cost: ${proposal.estimated_cost_sol} SOL | Reason: ${proposal.reason}`,
    );

    const results = await Promise.all(
      this.validators.map(async (v) => {
        const approved = await v.evaluate(proposal, this);
        console.log(
          `[ConsensusGateway] Validator '${v.name}' voted: ${approved ? "APPROVE ✅" : "REJECT ❌"}`,
        );
        return { name: v.name, approved };
      }),
    );

    const approvedCount = results.filter((r) => r.approved).length;
    const consensusReached = approvedCount >= this.threshold;

    const redisClient = redis.getRedis();
    if (consensusReached) {
      console.log(
        `\n[ConsensusGateway] Consensus REACHED for proposal ${proposal.id}\n`,
      );
      await redisClient.publish(
        CHANNELS.ECONOMY_SETTLED,
        JSON.stringify({ event: "consensus_reached", proposalId: proposal.id }),
      ).catch((err: unknown) =>
        console.error("[ConsensusGateway] Failed to publish consensus_reached:", err),
      );
    } else {
      console.log(
        `\n[ConsensusGateway] Consensus REJECTED for proposal ${proposal.id}\n`,
      );
      await redisClient.publish(
        CHANNELS.RISK_ALERTS,
        JSON.stringify({
          event: "consensus_rejected",
          proposalId: proposal.id,
        }),
      ).catch((err: unknown) =>
        console.error("[ConsensusGateway] Failed to publish consensus_rejected:", err),
      );
    }
    return consensusReached;
  }
}

// Exported default instance configured with threshold from env
// Default: all 3 validators must agree (Budget + Security + Strategy)
const threshold = Number(process.env.CONSENSUS_THRESHOLD) || 3;
export const gateway = new ConsensusGateway(threshold);
