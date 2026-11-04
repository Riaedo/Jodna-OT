import { runAllPersistenceTests } from '../src/utils/persistenceValidator';

async function main() {
  console.log('======================================================================');
  console.log('🧪 JODNAOT - AUTOMATED DATA PERSISTENCE & CLOUD RESILIENCE TEST SUITE');
  console.log('======================================================================\n');

  const results = await runAllPersistenceTests();

  let passCount = 0;
  let failCount = 0;

  results.forEach((r) => {
    const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${icon} [${r.status}] Scenario ${r.scenarioId}: ${r.name}`);
    console.log(`   Description: ${r.description}`);
    console.log(`   Details:     ${r.details}`);
    console.log(`   Latency:     ${r.durationMs}ms\n`);

    if (r.status === 'PASS') passCount++;
    if (r.status === 'FAIL') failCount++;
  });

  console.log('======================================================================');
  console.log(`📊 TEST SUMMARY: Total: ${results.length} | PASS: ${passCount} | FAIL: ${failCount}`);
  console.log('======================================================================');

  if (failCount > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Test runner encountered an error:', err);
  process.exit(1);
});
