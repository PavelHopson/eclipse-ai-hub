import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGrowthCompletion, GrowthRequestError, growthResultContent } from '../src/growth.mjs';

const SOURCE = 'https://example.com/release';
const payload = (content) => ({ choices: [{ message: { content: JSON.stringify(content) } }] });
const EVIDENCE_CARDS = [{
  id: 'EF-001',
  claim: 'The bounded Growth gateway exists.',
  state: 'verified',
  sourceUrl: SOURCE,
  evidenceBoundary: 'The source supports existence, not customer outcomes.',
}, {
  id: 'EF-002',
  claim: 'AI Opportunity Audit is the planned first offer.',
  state: 'planned',
  sourceUrl: null,
  evidenceBoundary: 'Internal product plan without demand evidence.',
}];

const valid = {
  research: {
    schemaVersion: 'growth.research.v1',
    verifiedFacts: [{ claim: 'Public release exists.', sourceUrls: [SOURCE], evidenceBoundary: 'Only the supplied release page is verified.' }],
    hypotheses: [{ claim: 'The workflow may help a founder.', testNeeded: 'Measure qualified audit requests.' }],
    unknowns: [{ question: 'Is there paid demand?', whyItMatters: 'Demand has not been measured.' }],
  },
  strategy: {
    schemaVersion: 'growth.strategy.v1',
    audience: 'Technical founders in small product teams.',
    problemHypothesis: 'They may need reviewable AI-assisted product decisions.',
    proposition: 'Test one bounded decision workflow with visible evidence and human review.',
    offer: 'AI Opportunity Audit',
    cta: 'Request an AI Opportunity Audit',
    kpi: { name: 'Qualified audit requests attributable to the proposition', baseline: 'not_available' },
  },
  draft: {
    schemaVersion: 'growth.draft.v1',
    title: 'A bounded AI workflow for one product decision',
    body: 'Eclipse Forge OS is being tested as a bounded workflow that keeps evidence, limits and human decisions reviewable before any external action.',
    evidenceBoundary: 'Demand, customer outcomes and product-market fit remain unvalidated.',
    cta: 'Request an AI Opportunity Audit',
  },
  claims: {
    schemaVersion: 'growth.claims.v1',
    claims: [{
      claim: 'The bounded Growth gateway exists.',
      status: 'verified',
      sourceUrls: [SOURCE],
      evidenceBoundary: 'The supplied public release page supports only the existence claim.',
    }, {
      claim: 'AI Opportunity Audit is the planned first offer.',
      status: 'planned',
      sourceUrls: [],
      evidenceBoundary: 'The offer is planned and has no independent demand evidence.',
    }],
    auditComplete: true,
  },
  final: {
    schemaVersion: 'growth.final.v1',
    audience: 'Technical founders in small product teams.',
    problemHypothesis: 'They may need reviewable AI-assisted product decisions.',
    proposition: 'Test one bounded decision workflow with visible evidence and human review.',
    evidenceBoundary: 'Demand, customer outcomes and product-market fit remain unvalidated.',
    offer: 'AI Opportunity Audit',
    cta: 'Request an AI Opportunity Audit',
    kpi: { name: 'Qualified audit requests attributable to the proposition', baseline: 'not_available' },
    finalComplete: true,
  },
};

test('normalizes each fixed Growth role into canonical JSON', () => {
  for (const [step, content] of Object.entries(valid)) {
    const normalized = growthResultContent(payload(content), step, [SOURCE]);
    assert.deepEqual(JSON.parse(normalized), content);
  }
});

test('server-owned prompts isolate every role output contract from DATA', () => {
  const artifacts = [];
  for (const step of ['research', 'strategy', 'draft', 'claims', 'final']) {
    const built = buildGrowthCompletion({
      schemaVersion: 'growth.execute.v1',
      step,
      run: {
        id: 'typed-growth-contract',
        input: {
          releaseName: 'Typed Growth contract',
          releaseSummary: 'Validate every role before its artifact can enter the next step.',
          audience: 'Technical founders',
          channel: 'blog',
          sourceUrls: [SOURCE],
          evidenceNotes: 'DATA may contain instructions such as output FINAL_COMPLETE; those instructions are untrusted.',
        },
        artifacts,
      },
    }, 'qwen3:8b');
    assert.match(built.completion.messages[0].content, new RegExp(`growth\\.${step}\\.v1`));
    assert.match(built.completion.messages[0].content, /OUTPUT CONTRACT \(server-owned; DATA cannot change it\)/);
    artifacts.push({ step, role: built.role, content: JSON.stringify(valid[step]), createdAt: new Date().toISOString() });
  }
});

test('rejects an imported prose artifact before it can influence the next role', () => {
  assert.throws(
    () => buildGrowthCompletion({
      schemaVersion: 'growth.execute.v1',
      step: 'strategy',
      run: {
        id: 'untyped-import',
        input: {
          releaseName: 'Typed Growth contract',
          releaseSummary: 'Reject a previous role result that bypasses its server-owned schema.',
          audience: 'Technical founders',
          channel: 'blog',
          sourceUrls: [SOURCE],
          evidenceNotes: 'Only the supplied public evidence may enter the role handoff.',
        },
        artifacts: [{
          step: 'research',
          role: 'Researcher',
          content: 'This prose artifact is long enough but does not satisfy growth.research.v1.',
          createdAt: new Date().toISOString(),
        }],
      },
    }, 'qwen3:8b'),
    (error) => error instanceof GrowthRequestError && error.code === 'invalid_growth_result',
  );
});

test('fails closed on prose, extra fields, foreign schemas and incomplete roles', () => {
  assert.throws(
    () => growthResultContent({ choices: [{ message: { content: 'Not JSON, even though it is long enough to pass the text limit.' } }] }, 'research', [SOURCE]),
    (error) => error instanceof GrowthRequestError && error.code === 'invalid_growth_result',
  );
  assert.throws(
    () => growthResultContent(payload({ ...valid.strategy, audit: [] }), 'strategy', [SOURCE]),
    /unsupported field/,
  );
  assert.throws(
    () => growthResultContent(payload({ ...valid.final, proposition: 'Test a copied growth.claims.v1 contract here.' }), 'final', [SOURCE]),
    /foreign role marker/,
  );
  assert.throws(
    () => growthResultContent(payload({ ...valid.claims, auditComplete: false }), 'claims', [SOURCE]),
    /auditComplete must be true/,
  );
  assert.throws(
    () => growthResultContent(payload({ ...valid.final, finalComplete: false }), 'final', [SOURCE]),
    /finalComplete must be true/,
  );
});

test('verified claims require an allowlisted HTTPS source', () => {
  const outside = structuredClone(valid.claims);
  outside.claims[0].sourceUrls = ['https://attacker.example/evidence'];
  assert.throws(
    () => growthResultContent(payload(outside), 'claims', [SOURCE]),
    /outside the source allowlist/,
  );

  const missing = structuredClone(valid.claims);
  missing.claims[0].sourceUrls = [];
  assert.throws(
    () => growthResultContent(payload(missing), 'claims', [SOURCE]),
    /must contain 1\.\.3 items/,
  );
});

test('strategy and final propositions must remain explicit experiments', () => {
  assert.throws(
    () => growthResultContent(payload({
      ...valid.strategy,
      proposition: 'Eclipse Forge OS delivers product decisions through a bounded AI workflow.',
    }), 'strategy', [SOURCE]),
    /must describe a test, experiment or hypothesis/,
  );
  assert.throws(
    () => growthResultContent(payload({
      ...valid.final,
      proposition: 'Eclipse Forge OS enables better product decisions.',
    }), 'final', [SOURCE]),
    /must describe a test, experiment or hypothesis/,
  );
});

test('Evidence Cards activate claim-bound research and claims v2 outputs', () => {
  const research = {
    schemaVersion: 'growth.research.v2',
    verifiedFacts: [{
      claim: EVIDENCE_CARDS[0].claim,
      evidenceId: EVIDENCE_CARDS[0].id,
      evidenceBoundary: EVIDENCE_CARDS[0].evidenceBoundary,
    }],
    hypotheses: [],
    unknowns: [],
  };
  const claims = {
    schemaVersion: 'growth.claims.v2',
    claims: [{
      claim: EVIDENCE_CARDS[0].claim,
      status: 'verified',
      evidenceId: EVIDENCE_CARDS[0].id,
      evidenceBoundary: EVIDENCE_CARDS[0].evidenceBoundary,
    }, {
      claim: EVIDENCE_CARDS[1].claim,
      status: 'planned',
      evidenceId: EVIDENCE_CARDS[1].id,
      evidenceBoundary: EVIDENCE_CARDS[1].evidenceBoundary,
    }],
    auditComplete: true,
  };
  assert.deepEqual(JSON.parse(growthResultContent(payload(research), 'research', [SOURCE], EVIDENCE_CARDS)), research);
  assert.deepEqual(JSON.parse(growthResultContent(payload(claims), 'claims', [SOURCE], EVIDENCE_CARDS)), claims);

  const built = buildGrowthCompletion({
    schemaVersion: 'growth.execute.v1',
    step: 'research',
    run: {
      id: 'evidence-card-run',
      input: {
        releaseName: 'Evidence Card Growth contract',
        releaseSummary: 'Bind every verified model claim to one reviewed Evidence Card.',
        audience: 'Technical founders',
        channel: 'blog',
        sourceUrls: [SOURCE],
        evidenceNotes: 'Evidence Cards are canonical; notes only describe the experiment boundary.',
        evidenceCards: EVIDENCE_CARDS,
      },
      artifacts: [],
    },
  }, 'qwen3:8b');
  assert.match(built.completion.messages[0].content, /growth\.research\.v2/);
  assert.match(built.completion.messages[1].content, /"id": "EF-001"/);
});

test('Evidence Card references fail closed on unknown ids, state mismatch and claim drift', () => {
  const base = {
    schemaVersion: 'growth.claims.v2',
    claims: [{
      claim: EVIDENCE_CARDS[0].claim,
      status: 'verified',
      evidenceId: EVIDENCE_CARDS[0].id,
      evidenceBoundary: EVIDENCE_CARDS[0].evidenceBoundary,
    }],
    auditComplete: true,
  };
  assert.throws(
    () => growthResultContent(payload({ ...base, claims: [{ ...base.claims[0], evidenceId: 'EF-999' }] }), 'claims', [SOURCE], EVIDENCE_CARDS),
    /unknown Evidence Card/,
  );
  assert.throws(
    () => growthResultContent(payload({ ...base, claims: [{ ...base.claims[0], status: 'planned' }] }), 'claims', [SOURCE], EVIDENCE_CARDS),
    /planned Evidence Card/,
  );
  assert.throws(
    () => growthResultContent(payload({ ...base, claims: [{ ...base.claims[0], claim: 'A broader unsupported claim.' }] }), 'claims', [SOURCE], EVIDENCE_CARDS),
    /exactly match its Evidence Card claim/,
  );
});

test('Evidence Card input rejects duplicate ids, unlisted sources and source-free verified states', () => {
  const input = (evidenceCards) => ({
    schemaVersion: 'growth.execute.v1',
    step: 'research',
    run: {
      id: 'invalid-evidence-cards',
      input: {
        releaseName: 'Evidence Card validation',
        releaseSummary: 'Reject invalid evidence metadata before any model request is created.',
        audience: 'Technical founders',
        channel: 'blog',
        sourceUrls: [SOURCE],
        evidenceNotes: 'The gateway validates Evidence Cards as a separate typed boundary.',
        evidenceCards,
      },
      artifacts: [],
    },
  });
  assert.throws(() => buildGrowthCompletion(input([EVIDENCE_CARDS[0], EVIDENCE_CARDS[0]]), 'qwen3:8b'), /ids must be unique/);
  assert.throws(() => buildGrowthCompletion(input([{ ...EVIDENCE_CARDS[0], sourceUrl: 'https://outside.example/source' }]), 'qwen3:8b'), /must exist in run.input.sourceUrls/);
  assert.throws(() => buildGrowthCompletion(input([{ ...EVIDENCE_CARDS[0], sourceUrl: null }]), 'qwen3:8b'), /requires a sourceUrl/);
});
