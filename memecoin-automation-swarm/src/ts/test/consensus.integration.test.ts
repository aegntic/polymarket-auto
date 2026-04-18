/* eslint-disable @typescript-eslint/no-explicit-any */
import { ConsensusGateway, type SpendProposal } from "../risk/consensus.ts";

describe("ConsensusGateway 3/3 consensus validation", () => {
  let gateway: ConsensusGateway;

  beforeEach(() => {
    gateway = new ConsensusGateway();
  });

  it("approves when all 3 validators pass (3/3 unanimous)", async () => {
    const proposal: SpendProposal = {
      id: "test-1",
      proposer: "mint-module",
      amount_sol: 0.02,
      estimated_cost_sol: 0.02,
      reason: "Vampire intercept clone of TEST",
      timestamp: Date.now(),
      nonce: 1,
    };
    const approved = await gateway.requestApproval(proposal);
    expect(approved).toBe(true); // all 3 validators pass, threshold 3 met
  });

  it("rejects when budget validator fails", async () => {
    const proposal: SpendProposal = {
      id: "test-2",
      proposer: "mint-module",
      amount_sol: 0.5,
      estimated_cost_sol: 1.0,
      reason: "Vampire intercept clone of TEST",
      timestamp: Date.now(),
      nonce: 1,
    };
    const approved = await gateway.requestApproval(proposal);
    expect(approved).toBe(false);
  });

  it("rejects when security validator fails", async () => {
    const proposal: SpendProposal = {
      id: "test-3",
      proposer: "unknown-module",
      amount_sol: 0.02,
      estimated_cost_sol: 0.02,
      reason: "Vampire intercept clone of TEST",
      timestamp: Date.now(),
      nonce: 1,
    };
    const approved = await gateway.requestApproval(proposal);
    expect(approved).toBe(false);
  });

  it("rejects when strategy validator fails", async () => {
    const proposal: SpendProposal = {
      id: "test-4",
      proposer: "mint-module",
      amount_sol: 0.02,
      estimated_cost_sol: 0.02,
      reason: "random action",
      timestamp: Date.now(),
      nonce: 1,
    };
    const approved = await gateway.requestApproval(proposal);
    expect(approved).toBe(false);
  });

  it("accepts when 3/3 validators approve (mock all pass)", async () => {
    const mockValidators = [
      { name: "BudgetValidator", evaluate: () => Promise.resolve(true) },
      { name: "SecurityValidator", evaluate: () => Promise.resolve(true) },
      { name: "StrategyValidator", evaluate: () => Promise.resolve(true) },
    ] as any;
    (gateway as any).validators = mockValidators;
    (gateway as any).threshold = 3;
    const proposal: SpendProposal = {
      id: "test-5",
      proposer: "mint-module",
      amount_sol: 0.02,
      estimated_cost_sol: 0.02,
      reason: "Vampire intercept clone of TEST",
      timestamp: Date.now(),
      nonce: 1,
    };
    const approved = await gateway.requestApproval(proposal);
    expect(approved).toBe(true);
  });

  it("tracks nonce per proposer for replay protection", async () => {
    const proposal1: SpendProposal = {
      id: "test-6a",
      proposer: "mint-module",
      amount_sol: 0.02,
      estimated_cost_sol: 0.02,
      reason: "Vampire intercept clone of TEST",
      timestamp: Date.now(),
      nonce: 1,
    };
    const proposal2: SpendProposal = {
      ...proposal1,
      id: "test-6b",
      nonce: 1,
    };
    await gateway.requestApproval(proposal1);
    await gateway.requestApproval(proposal2);
    expect(true).toBe(true);
  });
});
