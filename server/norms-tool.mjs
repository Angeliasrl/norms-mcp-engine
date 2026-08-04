import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';

import { ModelError, assessRelianceForPurpose } from '../src/model.js';
import { publicInputSchema } from './public-input-contract.mjs';

export const TOOL_NAME = 'assess_normative_reliance';

export const SERVER_INSTRUCTIONS = [
  'Use assess_normative_reliance only with structured normative records and structured facts.',
  'Never infer missing fields from value, notes, or other free text.',
  'Do not describe an outcome as legal advice or general compliance.',
  'Always show blocking, unknown, and unexamined, and distinguish not examined from satisfied.',
  'An empty blocking list is not authorization unless every required gate passes.',
].join(' ');

const groundSchema = z.object({
  eligible: z.boolean(),
  blocking: z.array(z.string()),
  unknown: z.array(z.string()),
  unexamined: z.boolean(),
});
const intervalSchema = z.object({
  from: z.string(),
  until_exclusive: z.string().optional(),
});
const conditionResultSchema = z.object({
  id: z.string(),
  outcome: z.enum(['SATISFIED', 'NOT_SATISFIED', 'UNKNOWN']),
  basis: z.enum([
    'ENGINE_DERIVED',
    'EXTERNALLY_RATIFIED',
    'CALLER_ASSERTED_UNCONFIRMED',
    'MISSING',
    'UNSUPPORTED',
  ]),
});
const conditionCompletenessResultSchema = z.object({
  outcome: z.enum(['SATISFIED', 'NOT_SATISFIED', 'UNKNOWN']),
  basis: z.enum([
    'ENGINE_DERIVED',
    'EXTERNALLY_RATIFIED',
    'CALLER_ASSERTED_UNCONFIRMED',
    'MISSING',
    'UNSUPPORTED',
  ]),
});
const instrumentStatusSchema = z.object({
  currency: z.enum(['CURRENT', 'STALE', 'UNKNOWN']),
  authority_status: z.enum(['VALID', 'INVALID', 'UNKNOWN']),
  expiry_status: z.enum(['ACTIVE', 'EXPIRED', 'REVIEW_DUE', 'UNKNOWN']),
});

export const outputSchema = {
  current_operational_ground: groundSchema,
  purpose_assessment: z.object({
    purpose: z.enum(['CURRENT_OPERATIONAL', 'HISTORICAL_AS_OF', 'COMPARATIVE_ANALYSIS']),
    as_of: z.string().optional(),
    eligible: z.boolean(),
    admissible: z.boolean(),
    blocking: z.array(z.string()),
    unknown: z.array(z.string()),
    unexamined: z.boolean(),
    temporal_known: z.boolean(),
    temporal_matches: z.boolean().nullable(),
    scope_known: z.boolean(),
    scope_matches: z.boolean(),
    effective_interval: intervalSchema.nullable(),
    applicability: intervalSchema.nullable(),
    applicability_known: z.boolean(),
    applicability_matches: z.boolean().nullable(),
    conditions_status: z.null(),
    conditions_known: z.boolean(),
    conditions_satisfied: z.boolean(),
    condition_completeness: z.enum(['COMPLETE', 'INCOMPLETE', 'UNKNOWN']).nullable(),
    condition_completeness_result: conditionCompletenessResultSchema,
    condition_completeness_verified: z.boolean(),
    condition_results: z.array(conditionResultSchema),
    external_evaluation_required: z.boolean(),
    normative_unit_known: z.boolean(),
    provision_identified: z.boolean(),
    segmentation_status: z.enum(['SEGMENTED', 'NOT_REQUIRED', 'REQUIRED', 'UNKNOWN']).nullable(),
    segmentation_known: z.boolean(),
    requires_provision_segmentation: z.boolean(),
    instrument_status: instrumentStatusSchema,
    reported_current_status: instrumentStatusSchema,
    authorizes_current_operational: z.boolean(),
    authorizes_historical_as_of: z.boolean(),
  }),
};

const summaryText = (assessment) => [
  `Admissible for ${assessment.purpose}: ${assessment.admissible}.`,
  `Current-operational authorization: ${assessment.authorizes_current_operational}.`,
  `Blocking: ${assessment.blocking.length === 0 ? 'none' : assessment.blocking.join(', ')}.`,
  `Unknown: ${assessment.unknown.length === 0 ? 'none' : assessment.unknown.join(', ')}.`,
  `Unexamined: ${assessment.unexamined}.`,
  'This is a bounded structured assessment, not legal advice or a general compliance determination.',
].join(' ');

export function registerNormsTool(server) {
  server.registerTool(
    TOOL_NAME,
    {
      title: 'Assess normative reliance',
      description: 'Assess whether a structured normative record may be relied upon for a specified purpose. Returns explicit blockers, unknowns and unexamined areas. It does not retrieve laws, parse documents, infer legal conditions from free text, provide legal advice or certify overall compliance.',
      inputSchema: publicInputSchema,
      outputSchema,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
    },
    async ({ trusted_external_evaluations, ...request }) => {
      try {
        const structuredContent = assessRelianceForPurpose(
          request,
          { trusted_external_evaluations: trusted_external_evaluations ?? [] },
        );
        return {
          structuredContent,
          content: [{ type: 'text', text: summaryText(structuredContent.purpose_assessment) }],
        };
      } catch (error) {
        const code = error instanceof ModelError ? error.code : 'INVALID_STRUCTURED_INPUT';
        return {
          isError: true,
          content: [{
            type: 'text',
            text: `NORMS_INPUT_INVALID:${code}. The structured input was rejected; no assessment was produced.`,
          }],
        };
      }
    },
  );

  return server;
}

export function createNormsMcpServer() {
  const server = new McpServer(
    { name: 'norms-structured-applicability', version: '0.1.0' },
    { instructions: SERVER_INSTRUCTIONS },
  );

  return registerNormsTool(server);
}
