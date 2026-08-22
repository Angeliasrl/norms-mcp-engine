import assert from 'node:assert/strict';
import * as z from 'zod/v4';

import {
  PUBLIC_CURRENT_OPERATIONAL_EXAMPLE,
  publicInputSchema,
} from '../server/public-input-contract.mjs';

const schema = z.toJSONSchema(publicInputSchema, { io: 'input' });
assert.equal(schema.oneOf.length, 3);

const branchFor = (purpose) => schema.oneOf.find(
  (branch) => branch.properties?.reliance_purpose?.const === purpose,
);

for (const purpose of ['CURRENT_OPERATIONAL', 'HISTORICAL_AS_OF']) {
  const branch = branchFor(purpose);
  assert.ok(branch, `missing ${purpose} branch`);
  assert.deepEqual(branch.required, ['reliance_purpose', 'as_of']);
  assert.match(branch.description, new RegExp(`\\b${purpose}\\b`));
}

const comparative = branchFor('COMPARATIVE_ANALYSIS');
assert.ok(comparative, 'missing COMPARATIVE_ANALYSIS branch');
assert.deepEqual(comparative.required, ['reliance_purpose']);
assert.deepEqual(comparative.not, { required: ['as_of'] });
assert.match(comparative.description, /\bCOMPARATIVE_ANALYSIS\b/);

assert.match(schema.description, /reliance_purpose is always required/i);
assert.match(schema.description, /as_of is required for CURRENT_OPERATIONAL and HISTORICAL_AS_OF/i);
assert.match(schema.description, /must be absent for COMPARATIVE_ANALYSIS/i);
assert.doesNotMatch(schema.description, /exactly one of[^.]*as_of/i);

const missingAsOf = structuredClone(PUBLIC_CURRENT_OPERATIONAL_EXAMPLE);
delete missingAsOf.as_of;
const runtimeResult = publicInputSchema.safeParse(missingAsOf);
assert.equal(runtimeResult.success, false);
assert.ok(runtimeResult.error.issues.some(
  (issue) => issue.path.length === 1
    && issue.path[0] === 'as_of'
    && issue.message === 'required for CURRENT_OPERATIONAL',
));

console.log('contract-as-of-discriminator: PASS');
