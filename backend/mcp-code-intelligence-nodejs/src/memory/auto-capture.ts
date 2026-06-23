/**
 * AutoCaptureHook — automatically captures knowledge from agent interactions.
 */

import { DecisionMemory } from './decision.js';
import { ErrorPatternMemory } from './error-pattern.js';

export interface CaptureConfig {
  enabled: boolean;
  captureToolCalls: boolean;
  captureDecisions: boolean;
  captureErrors: boolean;
  captureDocuments: boolean;
  minContentLength: number;
}

const DEFAULT_CONFIG: CaptureConfig = {
  enabled: true,
  captureToolCalls: true,
  captureDecisions: true,
  captureErrors: true,
  captureDocuments: true,
  minContentLength: 50,
};

export class AutoCaptureHook {
  private pipeline: any;
  private decisions: DecisionMemory;
  private errors: ErrorPatternMemory;
  private config: CaptureConfig;

  constructor(pipeline: any, decisions: DecisionMemory, errors: ErrorPatternMemory, config?: Partial<CaptureConfig>) {
    this.pipeline = pipeline;
    this.decisions = decisions;
    this.errors = errors;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Capture a tool call result as knowledge. */
  captureToolResult(toolName: string, result: string, source?: string): void {
    if (!this.config.captureToolCalls) return;
    if (result.length < this.config.minContentLength) return;
    this.pipeline.ingestEntry(
      result, `Tool result: ${toolName}`, 'CONTEXT', source, `auto-capture,tool,${toolName}`
    );
  }

  /** Capture a decision. */
  captureDecision(title: string, context: string, decision: string, rationale: string, source?: string): void {
    if (!this.config.captureDecisions) return;
    this.decisions.recordDecision({
      title, context, decision, rationale, source, tags: 'auto-capture',
    });
  }

  /** Capture an error pattern. */
  captureError(error: string, context: string, solution: string, source?: string): void {
    if (!this.config.captureErrors) return;
    this.errors.recordError({
      errorMessage: error, context, rootCause: 'Auto-detected',
      solution, source, tags: 'auto-capture',
    });
  }

  /** Capture a document. */
  captureDocument(content: string, source: string, format = 'markdown'): void {
    if (!this.config.captureDocuments) return;
    if (content.length < this.config.minContentLength) return;
    if (format === 'markdown') {
      this.pipeline.ingestMarkdown(content, source);
    } else {
      this.pipeline.ingestText(content, source);
    }
  }
}
