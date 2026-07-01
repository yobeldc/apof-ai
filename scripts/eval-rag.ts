/**
 * Apof.ai RAG evaluation harness.
 *
 *   npm run rag:eval                 # uses eval/sample.jsonl
 *   npm run rag:eval -- path/to.jsonl
 *
 * Each JSONL line:
 *   {"id","caseDecisionId"?,"question","expectedEvidenceContains"?:[],
 *    "expectedAnswerContains"?:[],"expectNotFound"?:bool,"category"?}
 *
 * Computes Recall@k, MRR, citation/quote support, not-found accuracy, and
 * expected-term match. Runs entirely on the active providers (mock by default).
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { retrieveEvidence } from "../src/lib/rag/retrieve";
import { answerQuestion } from "../src/lib/rag/answer";
import {
  recallAtK, reciprocalRank, citationSupportRate, quoteSupportRate,
  notFoundCorrect, answerTermMatch, aggregate, type EvalItem, type EvalScore,
} from "../src/lib/rag/eval";
import { prisma } from "../src/lib/db";

const K = 6;

async function main() {
  const file = process.argv[2] || "eval/sample.jsonl";
  const abs = path.resolve(file);
  const raw = await fs.readFile(abs, "utf8").catch(() => null);
  if (!raw) {
    console.error(`Eval file not found: ${abs}`);
    process.exit(1);
  }
  const items: EvalItem[] = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => JSON.parse(l));

  console.log(`Evaluating ${items.length} questions from ${file} (k=${K})…\n`);

  const scores: EvalScore[] = [];
  for (const item of items) {
    const evidence = await retrieveEvidence({ question: item.question, caseDecisionId: item.caseDecisionId, topK: K });
    const answer = await answerQuestion({ question: item.question, caseDecisionId: item.caseDecisionId, topK: K });

    const texts = evidence.map((e) => e.text);
    const evidenceIds = new Set(evidence.map((e) => e.sourceId));
    const textById = new Map(evidence.map((e) => [e.sourceId, e.text]));

    const score: EvalScore = {
      id: item.id,
      category: item.category,
      recallAtK: recallAtK(texts, item.expectedEvidenceContains ?? [], K),
      mrr: reciprocalRank(texts, item.expectedEvidenceContains ?? []),
      citationSupport: citationSupportRate(answer.citations, evidenceIds),
      quoteSupport: quoteSupportRate(answer.citations, textById),
      notFoundCorrect: notFoundCorrect(item.expectNotFound, answer.notFound),
      answerMatch: answerTermMatch(answer.answer, item.expectedAnswerContains),
    };
    scores.push(score);
    console.log(
      `  ${score.notFoundCorrect ? "✓" : "✗"} ${item.id} [${item.category ?? "-"}] ` +
        `R@${K}=${score.recallAtK.toFixed(2)} MRR=${score.mrr.toFixed(2)} ` +
        `cite=${score.citationSupport.toFixed(2)} quote=${score.quoteSupport.toFixed(2)} ans=${score.answerMatch.toFixed(2)}`,
    );
  }

  const agg = aggregate(scores);
  console.log("\n=== Aggregate ===");
  console.log(`  Recall@${K}:          ${agg.recallAtK.toFixed(3)}`);
  console.log(`  MRR:                ${agg.mrr.toFixed(3)}`);
  console.log(`  Citation support:   ${agg.citationSupport.toFixed(3)}`);
  console.log(`  Quote support:      ${agg.quoteSupport.toFixed(3)}`);
  console.log(`  Not-found accuracy: ${agg.notFoundAccuracy.toFixed(3)}`);
  console.log(`  Answer term match:  ${agg.answerMatch.toFixed(3)}`);
  console.log(`\n  (manual review) Indonesian fluency: —   beginner-friendliness: —`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
