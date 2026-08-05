import * as z from 'zod/v4';

import { assessRelianceForPurpose } from '../src/model.js';
import { positiveCurrentOperationalDemoInputs } from './positive-current-operational-demo-fixture.mjs';

export const POSITIVE_DEMO_TOOL_NAME = 'run_positive_current_operational_demo';
export const POSITIVE_DEMO_TOOL_DESCRIPTION = 'Call this zero-input tool directly when the user asks to run the positive CURRENT_OPERATIONAL demo. It runs a fixed public synthetic positive example through the canonical NORMS engine and returns the five demonstration fields. Do not construct a record or call assess_normative_reliance for that demo. It does not assess user-provided facts or certify real-world compliance.';

export const positiveDemoOutputSchema = {
  authorizes_current_operational: z.boolean(),
  admissible: z.boolean(),
  blocking: z.array(z.string()),
  unknown: z.array(z.string()),
  unexamined: z.boolean(),
};

export const selectPositiveDemoFields = (engineResult) => {
  const assessment = engineResult.purpose_assessment;
  return {
    authorizes_current_operational: assessment.authorizes_current_operational,
    admissible: assessment.admissible,
    blocking: assessment.blocking,
    unknown: assessment.unknown,
    unexamined: assessment.unexamined,
  };
};

export function runPositiveCurrentOperationalDemo({ engine = assessRelianceForPurpose } = {}) {
  const { request, options } = positiveCurrentOperationalDemoInputs();
  return selectPositiveDemoFields(engine(request, options));
}

export function registerPositiveCurrentOperationalDemoTool(server) {
  server.registerTool(
    POSITIVE_DEMO_TOOL_NAME,
    {
      title: 'Positive CURRENT_OPERATIONAL demo (no input)',
      description: POSITIVE_DEMO_TOOL_DESCRIPTION,
      inputSchema: z.object({}).strict(),
      outputSchema: positiveDemoOutputSchema,
      annotations: {
        readOnlyHint: true,
        openWorldHint: false,
        destructiveHint: false,
      },
    },
    async () => {
      const structuredContent = runPositiveCurrentOperationalDemo();
      return {
        structuredContent,
        content: [{ type: 'text', text: JSON.stringify(structuredContent, null, 2) }],
      };
    },
  );
  return server;
}
