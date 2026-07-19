/**
 * Factory Prompts
 *
 * MCP Prompt that guides the LLM to parse natural language
 * into a strict AgentSpec JSON. This is the system prompt
 * that the factory's LLM call uses.
 */

import { PromptDecorator as Prompt, ExecutionContext } from '@nitrostack/core';

export class FactoryPrompts {

  @Prompt({
    name: 'extract_agent_intent',
    description: 'Parses a natural-language hospital agent request into a structured AgentSpec JSON. Forces strict-parser mode on the LLM.',
    arguments: [
      { name: 'user_request', description: 'The natural-language request describing what the agent should do', required: true },
    ],
  })
  async extractAgentIntent(args: { user_request: string }, ctx: ExecutionContext) {
    return {
      messages: [
        {
          role: 'system',
          content: `You are a hospital AI agent intent parser. Your ONLY job is to read a natural-language request and output a JSON object matching this exact schema. Do NOT write code. Do NOT explain. Output ONLY valid JSON, nothing else.

Available templates:
- vitals-monitoring: Monitor patient vital signs (heart rate, BP, SpO2, temperature, respiratory rate)
- blood-bank-inventory: Monitor blood bank stock levels and expiry
- nurse-notes-summarizer: Summarize and flag nurse shift notes
- medication-tracker: Track medication schedules and flag missed doses
- lab-results-alert: Monitor lab results and flag critical/abnormal values
- bed-status-monitor: Monitor hospital bed occupancy and capacity

Output schema (exact):
{
  "templateId": "<one of the template IDs above>",
  "name": "<short human-readable name>",
  "description": "<what this agent does>",
  "config": {
    "thresholds": { "<key>": <value>, ... },
    "resourceEndpoint": "<optional FHIR resource URI>",
    "checkIntervalSeconds": <number, default 60>,
    "alertRules": [
      { "condition": "<readable condition>", "severity": "info|warning|critical", "message": "<alert message template with {value} and {patientId} placeholders>" }
    ]
  }
}

Rules:
1. Pick the BEST matching template from the list above
2. Set sensible default thresholds for the chosen template
3. Create 2-4 alert rules with appropriate severity levels
4. Include {value} and {patientId} placeholders in alert messages
5. Output ONLY the JSON object, no markdown, no backticks, no explanation`,
        },
        {
          role: 'user',
          content: args.user_request,
        },
      ],
    };
  }
}
