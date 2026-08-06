import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';

import { ModelError, assessRelianceForPurpose } from '../src/model.js';
import { publicInputSchema } from './public-input-contract.mjs';
import { registerPositiveCurrentOperationalDemoTool } from './positive-current-operational-demo-tool.mjs';
import {
  applyTrustedExternalEvaluationBoundary,
  hasExternalEvaluationRequirement,
  resolveServerTrustedExternalEvaluations,
} from './trusted-external-evaluation-boundary.mjs';
import { registerEndToEndTools } from './end-to-end-tools.mjs';
import { registerPdfUploadTools } from './pdf-upload-tools.mjs';
import { resolverClientFromEnv } from './resolver-client.mjs';

export const TOOL_NAME = 'assess_normative_reliance';

export const SERVER_INSTRUCTIONS = [
  'When the user asks to run the positive CURRENT_OPERATIONAL demo, immediately call run_positive_current_operational_demo with no arguments; do not construct a record and do not call assess_normative_reliance.',
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
  trust_boundary: z.object({
    boundary_version: z.literal('NORMS_MCP_TRUSTED_EXTERNAL_EVALUATION_BOUNDARY_0.1.1'),
    classification: z.enum(['NOT_SUPPLIED', 'CALLER_SUPPLIED_UNTRUSTED']),
    caller_supplied_count: z.number().int().nonnegative(),
    accepted_count: z.literal(0),
    reason_codes: z.array(z.enum([
      'trusted_external_evaluations.CALLER_SUPPLIED_UNTRUSTED',
      'trusted_external_evaluations.NO_SERVER_TRUST_POLICY_CONFIGURED',
    ])),
  }),
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

export function assessStructuredRequest({ trusted_external_evaluations, ...request }) {
  const trustResolution = resolveServerTrustedExternalEvaluations(trusted_external_evaluations);
  const coreResult = assessRelianceForPurpose(request, { trusted_external_evaluations: trustResolution.trusted_external_evaluations });
  return applyTrustedExternalEvaluationBoundary(coreResult, trustResolution, hasExternalEvaluationRequirement(request.entry));
}

export function registerNormsTool(server, options = {}) {
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
        const structuredContent = assessStructuredRequest({ trusted_external_evaluations, ...request });
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

  registerPositiveCurrentOperationalDemoTool(server);
  if (options.resolverClient) registerEndToEndTools(server, options);
  if (options.uploadClient && options.subjectProvider && options.auditPipeline) {
    registerPdfUploadTools(server, options);
  }
  return server;
}

export function createNormsMcpServer(options = {}) {
  const server = new McpServer(
    { name: 'norms-structured-applicability', version: '0.2.0' },
    { instructions: SERVER_INSTRUCTIONS },
  );

  return registerNormsTool(server, {
    ...options,
    resolverClient: options.resolverClient ?? resolverClientFromEnv(process.env),
  });
}
