import {
  AgentStatus,
  MonitoringMetrics,
  EventEnvelope,
  createEnvelope,
  CHANNELS,
} from "../shared/types";
import {
  publishEvent,
  subscribeToChannel,
  getCounter,
  incrFloat,
} from "../shared/redis";

interface AgentConfig {
  agentId: string;
  name: string;
  maxConcurrentTasks: number;
  heartbeatIntervalMs: number;
}

interface Task {
  id: string;
  type: "monitor" | "alert" | "deployment" | "analysis";
  priority: "high" | "medium" | "low";
  assignedAgent?: string;
  createdAt: string;
  data: unknown;
}

interface SwarmMonitorOptions {
  agents: AgentConfig[];
  metricsIntervalMs: number;
  profitabilityTargetMultiplier: number;
}

export class SwarmMonitor {
  private agents: Map<string, AgentStatus> = new Map();
  private tasks: Map<string, Task> = new Map();
  private metrics: MonitoringMetrics = {
    profitability_score: 0,
    roi_3x_progress: 0,
    active_agents: 0,
    total_deployments: 0,
    success_rate: 0,
    average_profit_per_deployment: 0,
  };
  private isRunning = false;
  private profitabilityTarget: number = 3.0;
  private deploymentHistory: {
    timestamp: string;
    profit: number;
    success: boolean;
  }[] = [];
  private static readonly MAX_HISTORY = 1000;

  // eslint-disable-next-line no-unused-vars
  constructor(private options: SwarmMonitorOptions) {
    this.initializeAgents();
  }

  private initializeAgents(): void {
    this.options.agents.forEach((agentConfig) => {
      const status: AgentStatus = {
        id: agentConfig.agentId,
        name: agentConfig.name,
        status: "idle",
        last_heartbeat: new Date().toISOString(),
        tasks_completed: 0,
        error_count: 0,
      };
      this.agents.set(agentConfig.agentId, status);
    });
  }

  async start(): Promise<void> {
    this.isRunning = true;
    console.log("Swarm Monitor started with", this.agents.size, "agents");

    setInterval(() => {
      this.monitorHeartbeats().catch((err) =>
        console.error("[SwarmMonitor] monitorHeartbeats error:", err),
      );
    }, 5000);
    setInterval(() => {
      this.collectMetrics().catch((err) =>
        console.error("[SwarmMonitor] collectMetrics error:", err),
      );
    }, this.options.metricsIntervalMs);
    setInterval(() => {
      this.processTasks().catch((err) =>
        console.error("[SwarmMonitor] processTasks error:", err),
      );
    }, 1000);

    this.subscribeToChannels();
  }

  private subscribeToChannels(): void {
    subscribeToChannel(CHANNELS.RECON_SIGNALS, (envelope: EventEnvelope) => {
      this.handleReconSignal(envelope);
    });

    subscribeToChannel(CHANNELS.DETECT_RESULTS, (envelope: EventEnvelope) => {
      this.handleDetectionResult(envelope);
    });

    subscribeToChannel(CHANNELS.RISK_ALERTS, (envelope: EventEnvelope) => {
      this.handleRiskAlert(envelope);
    });
  }

  private async monitorHeartbeats(): Promise<void> {
    const now = Date.now();
    const timeout = 30000;

    this.agents.forEach((agent) => {
      const lastBeat = new Date(agent.last_heartbeat).getTime();
      if (now - lastBeat > timeout) {
        agent.status = "error";
        console.warn(`Agent ${agent.id} heartbeat timeout`);
      }
    });
  }

  private async collectMetrics(): Promise<void> {
    const [totalDeployments, successCount, profitTotal] = await Promise.all([
      getCounter("mas:monitor:deployments:total"),
      getCounter("mas:monitor:deployments:success"),
      getCounter("mas:monitor:profit:total"),
    ]);

    const successRate =
      totalDeployments > 0 ? (successCount / totalDeployments) * 100 : 0;
    const avgProfit = totalDeployments > 0 ? profitTotal / totalDeployments : 0;

    this.metrics = {
      ...this.metrics,
      active_agents: this.getActiveAgentCount(),
      total_deployments: totalDeployments,
      success_rate: successRate,
      average_profit_per_deployment: avgProfit,
    };

    const currentROI = this.calculateCurrentROI();
    this.metrics.roi_3x_progress = Math.min(
      currentROI / this.profitabilityTarget,
      1,
    );

    if (currentROI >= this.profitabilityTarget) {
      console.log(
        `✅ 3x profitability target achieved! ROI: ${currentROI.toFixed(2)}x`,
      );
      await this.triggerProfitabilityTarget(currentROI);
    }
  }

  private getActiveAgentCount(): number {
    const now = Date.now();
    let count = 0;
    this.agents.forEach((agent) => {
      const lastBeat = new Date(agent.last_heartbeat).getTime();
      if (now - lastBeat < 30000 && agent.status !== "error") {
        count++;
      }
    });
    return count;
  }

  private calculateCurrentROI(): number {
    if (this.deploymentHistory.length === 0) return 0;
    const totalProfit = this.deploymentHistory.reduce(
      (sum, h) => sum + (h.profit || 0),
      0,
    );
    const totalDeployments = this.deploymentHistory.length;
    return totalProfit > 0 ? totalProfit / totalDeployments : 0;
  }

  private async triggerProfitabilityTarget(currentROI: number): Promise<void> {
    await publishEvent(
      CHANNELS.ORACLE_RESULTS,
      createEnvelope("monitor", "profitability_target_achieved", {
        target: this.profitabilityTarget,
        achieved_at: new Date().toISOString(),
        current_roi: currentROI,
        metrics: this.metrics,
      }),
    );
  }

  private async handleReconSignal(envelope: EventEnvelope): Promise<void> {
    console.log("Received recon signal:", envelope.payload);
    await this.scheduleTask({
      type: "monitor",
      priority: "high",
      data: envelope.payload,
    });
  }

  private async handleDetectionResult(envelope: EventEnvelope): Promise<void> {
    const result = envelope.payload as { classification?: string; confidence?: number };
    console.log("Detection result:", result);

    if (result.classification === "clone") {
      await incrFloat(
        "mas:monitor:profit:potential",
        result.confidence ?? 0.1,
      );
    }
  }

  private async handleRiskAlert(envelope: EventEnvelope): Promise<void> {
    console.log("Risk alert received:", envelope.payload);
    const alert = envelope.payload as { level?: string };
    if (alert.level === "red") {
      await this.emergencyShutdown();
    }
  }

  private async processTasks(): Promise<void> {
    const availableAgents = Array.from(this.agents.entries())
      .filter(([, agent]) => agent.status === "idle" && agent.error_count < 3)
      .sort(([, a], [, b]) => a.tasks_completed - b.tasks_completed);

    const pendingTasks = Array.from(this.tasks.values()).filter(
      (task) => !task.assignedAgent && task.priority === "high",
    );

    for (const task of pendingTasks) {
      if (availableAgents.length === 0) break;

      const [agentId, agent] = availableAgents[0];
      task.assignedAgent = agentId;
      agent.status = "busy";
      agent.tasks_completed++;

      console.log(`Assigning task ${task.id} to agent ${agentId}`);
      await this.executeTask(task, agent);
    }
  }

  private async executeTask(task: Task, agent: AgentStatus): Promise<void> {
    try {
      console.log(`Executing task ${task.id} on agent ${agent.id}`);
      await new Promise((resolve) => setTimeout(resolve, 1000));

      agent.status = "idle";
      agent.last_heartbeat = new Date().toISOString();
      this.tasks.delete(task.id);
    } catch (error) {
      agent.error_count++;
      agent.status = "error";
      console.error(`Task ${task.id} failed:`, error);
    }
  }

  private async scheduleTask(task: Partial<Task>): Promise<string> {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newTask: Task = {
      id: taskId,
      type: task.type || "monitor",
      priority: task.priority || "medium",
      assignedAgent: task.assignedAgent,
      createdAt: new Date().toISOString(),
      data: task.data || {},
    };

    this.tasks.set(taskId, newTask);
    return taskId;
  }

  private shutdownTriggered = false;

  private async emergencyShutdown(): Promise<void> {
    if (this.shutdownTriggered) return;
    this.shutdownTriggered = true;

    console.log("🚨 EMERGENCY SHUTDOWN TRIGGERED 🚨");
    this.isRunning = false;

    await publishEvent(
      CHANNELS.ORACLE_RESULTS,
      createEnvelope("monitor", "emergency_shutdown", {
        reason: "circuit_breaker_red",
        timestamp: new Date().toISOString(),
      }),
    ).catch((err) =>
      console.error("[SwarmMonitor] Failed to publish shutdown event:", err),
    );
  }

  getMetrics(): MonitoringMetrics {
    return { ...this.metrics };
  }

  getAgentStatus(): AgentStatus[] {
    return Array.from(this.agents.values());
  }

  async addAgent(config: AgentConfig): Promise<void> {
    const status: AgentStatus = {
      id: config.agentId,
      name: config.name,
      status: "idle",
      last_heartbeat: new Date().toISOString(),
      tasks_completed: 0,
      error_count: 0,
    };
    this.agents.set(config.agentId, status);
  }

  async reportDeploymentResult(
    success: boolean,
    profit: number = 0,
  ): Promise<void> {
    await incrFloat("mas:monitor:deployments:total", 1);
    if (success) {
      await incrFloat("mas:monitor:deployments:success", 1);
      await incrFloat("mas:monitor:profit:total", profit);

      this.deploymentHistory.push({
        timestamp: new Date().toISOString(),
        profit,
        success: true,
      });
      if (this.deploymentHistory.length > SwarmMonitor.MAX_HISTORY) {
        this.deploymentHistory = this.deploymentHistory.slice(-SwarmMonitor.MAX_HISTORY);
      }

      await this.collectMetrics();
    }
  }

  async heartbeat(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId);
    if (agent) {
      agent.last_heartbeat = new Date().toISOString();
      agent.status = "active";
    }
  }

  async shutdown(): Promise<void> {
    this.isRunning = false;
    console.log("Swarm Monitor stopped");
  }
}

export const swarmMonitor = new SwarmMonitor({
  agents: [
    {
      agentId: "agent-001",
      name: "ProfitAnalyzer",
      maxConcurrentTasks: 5,
      heartbeatIntervalMs: 5000,
    },
    {
      agentId: "agent-002",
      name: "RiskManager",
      maxConcurrentTasks: 3,
      heartbeatIntervalMs: 5000,
    },
    {
      agentId: "agent-003",
      name: "DeploymentBot",
      maxConcurrentTasks: 10,
      heartbeatIntervalMs: 3000,
    },
  ],
  metricsIntervalMs: 10000,
  profitabilityTargetMultiplier: 3,
});
