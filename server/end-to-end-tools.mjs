import * as z from 'zod/v4';
import { publicInputSchema } from './public-input-contract.mjs';
import { assessStructuredRequest } from './norms-tool.mjs';
import { ResolverError } from './resolver-client.mjs';

const civilDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const sourceRequirements = z.object({ minimum_independent_official_sources: z.number().int().min(1).max(4).optional(), require_primary_official: z.boolean().optional() }).strict();
// §7 (RATIFICA_ATTIVAZIONE_0.6.0_S7_01): il locator accetta la terza via
// `reference` (URN-addressed), ammessa SOLO con contract_version "0.6.0".
const referenceSchema = z.object({ scheme: z.string().min(1).max(64), value: z.string().min(1).max(2048), granularity: z.object({ article: z.union([z.string(), z.number().int()]).optional(), comma: z.union([z.string(), z.number().int()]).optional() }).strict().optional() }).strict();
const locator = z.object({ citation: z.string().min(1).max(2048).optional(), official_url: z.string().url().max(4096).optional(), reference: referenceSchema.optional(), contract_version: z.enum(['0.5.4', '0.6.0']).optional(), jurisdiction: z.string().regex(/^[A-Z]{2,8}$/), as_of: civilDate.optional(), source_requirements: sourceRequirements, request_id: z.string().regex(/^[A-Za-z0-9._:-]{1,128}$/) }).strict().superRefine((v, ctx) => { const present = [v.citation, v.official_url, v.reference].filter((x) => x !== undefined).length; if (present !== 1) ctx.addIssue({ code: 'custom', path: ['citation'], message: 'exactly one of citation, official_url or reference is required' }); if (v.reference !== undefined && v.contract_version !== '0.6.0') ctx.addIssue({ code: 'custom', path: ['reference'], message: 'reference requires contract_version "0.6.0"' }); });
const auditInput = locator.extend({
  context: publicInputSchema.shape.context,
  reliance_purpose: publicInputSchema.shape.reliance_purpose,
  entry_assertions: publicInputSchema.shape.entry,
  trusted_external_evaluations: publicInputSchema.shape.trusted_external_evaluations,
}).superRefine((v, ctx) => {
  const needs = v.reliance_purpose === 'CURRENT_OPERATIONAL' || v.reliance_purpose === 'HISTORICAL_AS_OF';
  if (needs && !v.as_of) ctx.addIssue({ code: 'custom', path: ['as_of'], message: 'required for selected reliance_purpose' });
  if (!needs && v.as_of) ctx.addIssue({ code: 'custom', path: ['as_of'], message: 'must be absent for COMPARATIVE_ANALYSIS' });
});

function stable(value) { if (Array.isArray(value)) return value.map(stable); if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((k) => [k, stable(value[k])])); return value; }
function packageHashProjection(value) {
  const projected = structuredClone(value);
  delete projected.observability;
  for (const receipt of projected.acquisition_receipts ?? []) { delete receipt.acquired_at_utc; delete receipt.duration_ms; }
  for (const snapshot of projected.snapshot_references ?? []) delete snapshot.created;
  return projected;
}
async function sha256Text(value) { const bytes = new TextEncoder().encode(value); return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map((b) => b.toString(16).padStart(2, '0')).join(''); }
function fail(code, resolution = null) { return { evidence_resolution: resolution, normative_assessment: null, blocking: [code], unknown: [], unexamined: true, limitations: ['NORMS_CORE_NOT_CALLED'] }; }
// §7: la resolutionView proietta i campi nuovi 0.6.0 QUANDO presenti (ramo
// reference/0.6.0). Sono assenti nelle risposte legacy → i consumatori legacy
// vedono una vista identica a prima (invariante C1 preservata a valle).
function resolutionView(r) {
  const view = { canonical_citation: r.canonical_citation, sources: r.evidence_sources, matching: r.matching, corroboration: r.corroboration, temporal_evidence: r.temporal_evidence, blocking: r.blocking, unknown: r.unknown, unexamined: r.unexamined, audit_level: r.audit_level, ready_for_norms: r.ready_for_norms, evidence_package_hash: r.package_sha256, resolution_fingerprint: r.resolution_fingerprint };
  for (const key of ['segnalazione', 'resolution_outcome', 'publication_variants', 'resolution_provenance', 'temporal_selection', 'completeness', 'candidate_blockers']) {
    if (r[key] !== undefined) view[key] = r[key];
  }
  return view;
}

export { locator as resolveLocatorSchema };

export async function resolveNormativeEvidence(args, resolverClient) {
  try { return resolutionView(await resolverClient.resolve(args)); }
  catch (error) { return fail(error instanceof ResolverError ? error.code : 'RESOLVER_UNAVAILABLE'); }
}

export async function auditNormativeReliance(args, resolverClient, assess = assessStructuredRequest) {
  let resolved;
  try { resolved = await resolverClient.resolve(Object.fromEntries(Object.entries(args).filter(([k]) => ['citation', 'official_url', 'reference', 'contract_version', 'jurisdiction', 'as_of', 'source_requirements', 'request_id'].includes(k)))); }
  catch (error) { return fail(error instanceof ResolverError ? error.code : 'RESOLVER_UNAVAILABLE'); }
  const view = resolutionView(resolved);
  if (!resolved.ready_for_norms || resolved.audit_level !== 'PUBLIC_RESOLVED') return fail('RESOLUTION_NOT_PUBLIC_RESOLVED', view);
  if ((resolved.blocking?.length ?? 0) || (resolved.contradiction_ledger?.length ?? 0)) return fail('RESOLUTION_BLOCKED', view);
  if (!/^[0-9a-f]{64}$/.test(resolved.package_sha256 ?? '') || typeof resolved.package_canonical_json !== 'string') return fail('EVIDENCE_PACKAGE_HASH_INVALID', view);
  let canonicalPackage; try { canonicalPackage = JSON.parse(resolved.package_canonical_json); } catch { return fail('EVIDENCE_PACKAGE_HASH_INVALID', view); }
  if (JSON.stringify(stable(canonicalPackage)) !== JSON.stringify(stable(packageHashProjection(resolved.evidence_package))) || await sha256Text(resolved.package_canonical_json) !== resolved.package_sha256) return fail('EVIDENCE_PACKAGE_HASH_INVALID', view);
  const payload = { entry: structuredClone(args.entry_assertions), context: structuredClone(args.context), reliance_purpose: args.reliance_purpose, ...(args.as_of ? { as_of: args.as_of } : {}), ...(args.trusted_external_evaluations ? { trusted_external_evaluations: structuredClone(args.trusted_external_evaluations) } : {}) };
  const validated = publicInputSchema.safeParse(payload); if (!validated.success) return fail('NORMS_PAYLOAD_INVALID', view);
  const assessment = assess(validated.data);
  return { evidence_resolution: view, normative_assessment: assessment, blocking: [...view.blocking, ...assessment.purpose_assessment.blocking], unknown: [...view.unknown, ...assessment.purpose_assessment.unknown], unexamined: Boolean(view.unexamined?.length || assessment.purpose_assessment.unexamined), limitations: ['ADAPTER_MAPPING_REQUIRES_EXPLICIT_ENTRY_ASSERTIONS'] };
}

export function registerEndToEndTools(server, { resolverClient, assess = assessStructuredRequest }) {
  server.registerTool('resolve_normative_evidence', { title: 'Resolve normative evidence', description: 'Acquire and match official normative evidence without invoking NORMS Core.', inputSchema: locator, annotations: { readOnlyHint: true, openWorldHint: true, destructiveHint: false } }, async (args) => { const structuredContent = await resolveNormativeEvidence(args, resolverClient); return { structuredContent, content: [{ type: 'text', text: JSON.stringify(structuredContent) }] }; });
  server.registerTool('audit_normative_reliance', { title: 'Audit normative reliance', description: 'Resolve official evidence, enforce PUBLIC_RESOLVED gates, then assess explicit normative assertions.', inputSchema: auditInput, annotations: { readOnlyHint: true, openWorldHint: true, destructiveHint: false } }, async (args) => { const structuredContent = await auditNormativeReliance(args, resolverClient, assess); return { structuredContent, content: [{ type: 'text', text: JSON.stringify(structuredContent) }] }; });
  return server;
}
