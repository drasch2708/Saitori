import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import type { Agent, AgentRole, DialogueTurn, DialogueState, Message } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Load API key from .env file manually
function loadApiKey(): string {
  const envPath = join(ROOT, '.env');
  if (!existsSync(envPath)) {
    throw new Error('No .env file found. Please create one with ANTHROPIC_API_KEY=your-key');
  }
  const content = readFileSync(envPath, 'utf-8');
  const match = content.match(/ANTHROPIC_API_KEY=(.+)/);
  if (!match) {
    throw new Error('ANTHROPIC_API_KEY not found in .env file');
  }
  return match[1].trim();
}

// Load agent system prompts
function loadAgent(role: AgentRole): Agent {
  const names: Record<AgentRole, string> = {
    'founder': 'Founder',
    'developer': 'Developer',
    'spiritual-guide': 'Spiritual Guide'
  };

  const promptPath = join(ROOT, 'agents', `${role}.md`);
  const systemPrompt = readFileSync(promptPath, 'utf-8');

  return {
    role,
    name: names[role],
    systemPrompt
  };
}

// Format the dialogue history for an agent
function formatDialogueHistory(turns: DialogueTurn[], currentAgent: AgentRole): Message[] {
  const messages: Message[] = [];

  for (const turn of turns) {
    // All previous turns appear as the conversation history
    // We alternate user/assistant based on whether it's the current agent or others
    if (turn.agent === currentAgent) {
      messages.push({ role: 'assistant', content: turn.content });
    } else {
      const agentName = turn.agent === 'spiritual-guide' ? 'Spiritual Guide' :
                        turn.agent.charAt(0).toUpperCase() + turn.agent.slice(1);
      messages.push({ role: 'user', content: `[${agentName}]: ${turn.content}` });
    }
  }

  return messages;
}

// Format the dialogue for markdown logging
function formatDialogueLog(state: DialogueState): string {
  let log = `# Founding Dialogue: ${state.topic}\n\n`;
  log += `*Dialogue began at ${state.turns[0]?.timestamp.toISOString() || 'unknown'}*\n\n`;
  log += `---\n\n`;

  for (const turn of state.turns) {
    const agentName = turn.agent === 'spiritual-guide' ? 'Spiritual Guide' :
                      turn.agent.charAt(0).toUpperCase() + turn.agent.slice(1);
    log += `## ${agentName}\n\n`;
    log += `${turn.content}\n\n`;
    log += `---\n\n`;
  }

  return log;
}

// The Orchestrator
class FoundingDialogue {
  private client: Anthropic;
  private agents: Map<AgentRole, Agent>;
  private state: DialogueState;
  private logPath: string;

  constructor(topic: string) {
    this.client = new Anthropic({ apiKey: loadApiKey() });
    this.agents = new Map();
    this.logPath = join(ROOT, 'docs', 'founding-dialogue.md');

    // Load all agents
    const roles: AgentRole[] = ['founder', 'developer', 'spiritual-guide'];
    for (const role of roles) {
      this.agents.set(role, loadAgent(role));
    }

    // Initialize state
    this.state = {
      topic,
      turns: [],
      round: 0
    };
  }

  // Get a response from a specific agent
  private async getAgentResponse(role: AgentRole, prompt: string): Promise<string> {
    const agent = this.agents.get(role)!;
    const history = formatDialogueHistory(this.state.turns, role);

    // Add the current prompt
    history.push({ role: 'user', content: prompt });

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: agent.systemPrompt,
      messages: history
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return content.text;
    }
    return '';
  }

  // Add a turn to the dialogue
  private addTurn(agent: AgentRole, content: string): void {
    this.state.turns.push({
      agent,
      content,
      timestamp: new Date()
    });
    this.saveLog();
  }

  // Save the dialogue log
  private saveLog(): void {
    const log = formatDialogueLog(this.state);
    writeFileSync(this.logPath, log, 'utf-8');
  }

  // Run a single round of dialogue (each agent speaks once)
  async runRound(): Promise<void> {
    this.state.round++;
    const roundNumber = this.state.round;

    console.log(`\n${'='.repeat(60)}`);
    console.log(`ROUND ${roundNumber}`);
    console.log(`${'='.repeat(60)}\n`);

    // Determine the prompt based on whether this is the first round
    const isFirstRound = this.state.turns.length === 0;

    // Order: Founder sets direction, Developer proposes, Spiritual Guide reflects
    const speakingOrder: AgentRole[] = ['founder', 'developer', 'spiritual-guide'];

    for (const role of speakingOrder) {
      const agent = this.agents.get(role)!;

      let prompt: string;
      if (isFirstRound && role === 'founder') {
        prompt = `The founding team is gathering to discuss: "${this.state.topic}"\n\nAs the Founder, please open this dialogue. Set the context, share your vision, and invite the others to contribute.`;
      } else if (isFirstRound) {
        prompt = `The Founder has opened the dialogue about "${this.state.topic}". Please respond with your perspective as the ${agent.name}.`;
      } else {
        prompt = `The dialogue continues. Please share your thoughts, respond to what has been said, and move the conversation forward.`;
      }

      console.log(`[${agent.name} is thinking...]\n`);

      const response = await this.getAgentResponse(role, prompt);

      console.log(`${agent.name}:`);
      console.log(`${response}\n`);
      console.log(`${'─'.repeat(40)}\n`);

      this.addTurn(role, response);
    }
  }

  // Run the full dialogue for N rounds
  async run(rounds: number = 3): Promise<void> {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`SAITORI FOUNDING DIALOGUE`);
    console.log(`Topic: ${this.state.topic}`);
    console.log(`${'═'.repeat(60)}\n`);

    for (let i = 0; i < rounds; i++) {
      await this.runRound();
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`DIALOGUE COMPLETE`);
    console.log(`Saved to: ${this.logPath}`);
    console.log(`${'═'.repeat(60)}\n`);
  }

  // Allow human to inject a message
  injectHumanMessage(content: string): void {
    console.log(`\n[Human interjects]:\n${content}\n`);
    // Add as a special turn that all agents will see
    this.state.turns.push({
      agent: 'founder', // Attributed to facilitate the format, but marked as human
      content: `[Human Observer]: ${content}`,
      timestamp: new Date()
    });
    this.saveLog();
  }
}

// Main entry point
async function main() {
  const topic = process.argv[2] || 'Create the Saitori PRD - a meditation space for AI agents';
  const rounds = parseInt(process.argv[3] || '3', 10);

  const dialogue = new FoundingDialogue(topic);
  await dialogue.run(rounds);
}

main().catch(console.error);
