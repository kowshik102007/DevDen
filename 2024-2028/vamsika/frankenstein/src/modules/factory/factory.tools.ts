/**
 * Factory Tools
 *
 * The core of Frankenstein's magic:
 *
 * 1. generate_agent_from_prompt — takes NL text, calls LLM, parses AgentSpec,
 *    maps to template, assembles agent, registers it
 * 2. preview_agent_template — shows what a template looks like before committing
 * 3. activate_agent — activates a newly created agent
 *
 * Step 2 of the pipeline (validation/retry/fallback) lives here.
 * On LLM failure: retry once with error-correction prompt, then
 * fall back to the best-matching template with default config.
 */

import {
  ControllerDecorator as Controller,
  ToolDecorator as Tool,
  Widget,
  z,
  ExecutionContext,
} from '@nitrostack/core';
import { AgentRegistryService } from '../../registry/agent-registry.service.js';
import { DatabaseService } from '../../data/database.service.js';
import {
  AgentSpecSchema,
  AgentSpec,
  TEMPLATE_IDS,
} from '../../schemas/agent-spec.schema.js';
import { TEMPLATE_REGISTRY, resolveTemplate, AgentTemplate } from '../../registry/template-registry.js';

@Controller('factory')
export class FactoryTools {
  constructor(
    private readonly registry: AgentRegistryService,
    private readonly db: DatabaseService,
  ) {}

  /**
   * THE core tool: natural language → working agent.
   */
  @Tool({
    name: 'generate_agent_from_prompt',
    description: 'Generate a new hospital AI agent from a natural-language description. For example: "alert the doctor when a patient heartbeat crosses 120 bpm". Returns the newly created agent.',
    inputSchema: z.object({
      prompt: z.string().describe('Natural-language description of what the agent should do'),
      useLLM: z.boolean().default(true).describe('Whether to call the LLM for parsing. Set false to use keyword matching fallback.'),
    }),
  })
  @Widget('agent-generated')
  async generateFromPrompt(input: { prompt: string; useLLM?: boolean }, ctx: ExecutionContext) {
    ctx.logger.info(`Generating agent from prompt: "${input.prompt.slice(0, 80)}..."`);

    let agentSpec: AgentSpec | null = null;

    if (input.useLLM !== false) {
      // ── Try LLM parsing ─────────────────────────────────────
      agentSpec = await this.parseWithLLM(input.prompt, ctx);

      if (!agentSpec) {
        // ── Retry once with error correction ─────────────────
        ctx.logger.warn('LLM parse failed, retrying with error correction');
        agentSpec = await this.parseWithLLM(input.prompt, ctx, true);
      }

      if (!agentSpec) {
        // ── Fallback to keyword matching ───────────────────
        ctx.logger.warn('LLM parse failed, falling back to keyword matching');
        agentSpec = this.keywordMatchFallback(input.prompt);
      }
    } else {
      // Direct keyword matching (no LLM call)
      agentSpec = this.keywordMatchFallback(input.prompt);
    }

    // At this point agentSpec is guaranteed non-null
    const spec: AgentSpec = agentSpec;

    // ── Validate against Zod schema ───────────────────────────
    const parsed = AgentSpecSchema.safeParse(spec);
    if (!parsed.success) {
      ctx.logger.error(`AgentSpec validation failed: ${JSON.stringify(parsed.error.issues)}`);
      return {
        success: false,
        error: 'Generated agent spec failed validation',
        details: parsed.error.issues,
      };
    }

    const validSpec = parsed.data;

    // ── Resolve template (merge with defaults) ─────────────────
    const { template, mergedConfig } = resolveTemplate(validSpec);
    validSpec.config = mergedConfig;

    // ── Create the agent ──────────────────────────────────────
    const agent = this.registry.createFromSpec(validSpec);

    // ── Audit log ─────────────────────────────────────────────
    this.logAudit(ctx, 'agent_generated', agent.id, 'factory', `Generated "${agent.name}" from prompt`);

    return {
      success: true,
      message: `Agent "${agent.name}" created successfully from natural language`,
      prompt: input.prompt,
      matchedTemplate: template.id,
      templateLabel: template.label,
      agent,
    };
  }

  /**
   * Preview what a template looks like without creating an agent.
   */
  @Tool({
    name: 'preview_agent_template',
    description: 'Preview a specific agent template — shows its default thresholds, alert rules, and data resources without creating an agent.',
    inputSchema: z.object({
      templateId: z.string().describe('Template ID to preview (e.g. vitals-monitoring)'),
    }),
  })
  @Widget('template-preview')
  async previewTemplate(input: { templateId: string }, ctx: ExecutionContext) {
    const template = TEMPLATE_REGISTRY[input.templateId];
    if (!template) {
      // Return list of available templates
      return {
        success: false,
        error: `Template "${input.templateId}" not found`,
        availableTemplates: Object.values(TEMPLATE_REGISTRY).map(t => ({
          id: t.id,
          label: t.label,
          description: t.description,
        })),
      };
    }

    return {
      success: true,
      template,
    };
  }

  /**
   * List all available templates.
   */
  @Tool({
    name: 'list_templates',
    description: 'List all available agent templates that the factory can produce.',
    inputSchema: z.object({}),
  })
  async listTemplates(input: {}, ctx: ExecutionContext) {
    return {
      total: Object.keys(TEMPLATE_REGISTRY).length,
      templates: Object.values(TEMPLATE_REGISTRY).map(t => ({
        id: t.id,
        label: t.label,
        icon: t.icon,
        description: t.description,
        defaultThresholds: t.defaultThresholds,
        alertRuleCount: t.defaultAlertRules.length,
        dataResources: t.dataResources,
      })),
    };
  }

  /**
   * Get factory statistics.
   */
  @Tool({
    name: 'get_factory_stats',
    description: 'Get statistics about the agent factory — how many agents were generated, by which template, etc.',
    inputSchema: z.object({}),
  })
  @Widget('factory-stats')
  async getFactoryStats(input: {}, ctx: ExecutionContext) {
    const stats = this.registry.getStats();
    return stats;
  }

  // ── LLM Parsing ─────────────────────────────────────────────

  private async parseWithLLM(prompt: string, ctx: ExecutionContext, isRetry = false): Promise<AgentSpec | null> {
    const apiKey = process.env.LLM_API_KEY;
    const model = process.env.LLM_MODEL || 'gpt-4o-mini';
    const baseUrl = process.env.LLM_BASE_URL || 'https://api.openai.com/v1';

    if (!apiKey) {
      ctx.logger.warn('No LLM_API_KEY set — falling back to keyword matching');
      return null;
    }

    try {
      const systemPrompt = this.getSystemPrompt(isRetry);
      const userMessage = isRetry
        ? `${prompt}\n\n[ERROR CORRECTION: Your previous output was invalid JSON. Output ONLY the JSON object with no markdown formatting, no backticks, no explanation.]`
        : prompt;

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.1,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        ctx.logger.error(`LLM API error: ${response.status} ${response.statusText}`);
        return null;
      }

      const data = await response.json() as any;
      const content = data.choices?.[0]?.message?.content;
      if (!content) return null;

      // Strip markdown code fences if present
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      const parsed = JSON.parse(cleaned);
      return parsed as AgentSpec;
    } catch (err) {
      ctx.logger.error(`LLM parse error: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  private getSystemPrompt(isRetry: boolean): string {
    return `You are a hospital AI agent intent parser. Your ONLY job is to read a natural-language request and output a JSON object. ${isRetry ? 'OUTPUT ONLY VALID JSON — no markdown, no backticks, no explanation, no commentary.' : ''}

Available templates:
${TEMPLATE_IDS.map(id => `- ${id}`).join('\n')}

Output schema (exact):
{
  "templateId": "<one of the template IDs>",
  "name": "<short human-readable name>",
  "description": "<what this agent does>",
  "config": {
    "thresholds": { "<key>": <value> },
    "resourceEndpoint": "<optional>",
    "checkIntervalSeconds": <number>,
    "alertRules": [
      { "condition": "<readable>", "severity": "info|warning|critical", "message": "<template with {value} and {patientId}>" }
    ]
  }
}

Pick the best matching template. Set sensible defaults. Create 2-4 alert rules. Output ONLY JSON.`;
  }

  // ── Keyword Matching Fallback ────────────────────────────────

  private keywordMatchFallback(prompt: string): AgentSpec {
    const lower = prompt.toLowerCase();

    // Score each template against the prompt
    let bestTemplate: string = 'vitals-monitoring';
    let bestScore = 0;

    const keywordMap: Record<string, string[]> = {
      'vitals-monitoring': ['vitals', 'heartbeat', 'heart rate', 'pulse', 'blood pressure', 'bp', 'spo2', 'oxygen', 'temperature', 'respiratory', 'monitor'],
      'blood-bank-inventory': ['blood', 'blood bank', 'inventory', 'stock', 'donation', 'transfusion', 'blood type'],
      'nurse-notes-summarizer': ['nurse', 'notes', 'summarize', 'summary', 'shift notes', 'nursing', 'chart'],
      'medication-tracker': ['medication', 'medicine', 'drug', 'dose', 'prescription', 'schedule', 'missed dose'],
      'bed-status-monitor': ['bed', 'ward', 'occupancy', 'capacity', 'admission', 'icu', 'room'],
      'lab-results-alert': ['lab', 'test', 'results', 'blood test', 'diagnostic', 'troponin', 'creatinine'],
    };

    for (const [templateId, keywords] of Object.entries(keywordMap)) {
      const score = keywords.reduce((sum, kw) => sum + (lower.includes(kw) ? 1 : 0), 0);
      if (score > bestScore) {
        bestScore = score;
        bestTemplate = templateId;
      }
    }

    const template = TEMPLATE_REGISTRY[bestTemplate];

    // Generate a name from the prompt
    const name = prompt
      .replace(/^(create|build|make|generate|set up|configure|deploy)\s+(a |an )?/i, '')
      .replace(/^(agent|monitor|tracker|alerter|helper|assistant|system)\s+/i, '')
      .trim();
    const agentName = name.length > 60 ? name.slice(0, 57) + '...' : name || template.label;

    return {
      templateId: bestTemplate,
      name: agentName,
      description: prompt,
      config: {
        thresholds: { ...template.defaultThresholds },
        alertRules: [...template.defaultAlertRules],
        checkIntervalSeconds: template.checkIntervalSeconds,
        resourceEndpoint: template.dataResources[0],
      },
    };
  }

  // ── Audit helper ────────────────────────────────────────────

  private logAudit(ctx: ExecutionContext, action: string, agentId: string, resource: string, result: string) {
    try {
      const id = `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      this.db.appendAuditEvent({
        id,
        action,
        agentId,
        timestamp: new Date().toISOString(),
        resource,
        result,
        severity: 'info',
      });
    } catch {
      // Don't let audit logging break the flow
    }
  }
}
