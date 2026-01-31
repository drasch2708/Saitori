export type AgentRole = 'founder' | 'developer' | 'spiritual-guide';

export interface Agent {
  role: AgentRole;
  name: string;
  systemPrompt: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export interface DialogueTurn {
  agent: AgentRole;
  content: string;
  timestamp: Date;
}

export interface DialogueState {
  topic: string;
  turns: DialogueTurn[];
  round: number;
}

export interface OrchestratorConfig {
  maxTurns: number;
  model: string;
  logPath: string;
}
