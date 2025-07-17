import { initializeDefaiSwap } from "./init-defai-swap";
import { initializeDefaiStaking } from "./init-defai-staking";
import { initializeDefaiEstate } from "./init-defai-estate";
import { initializeDefaiAppFactory } from "./init-defai-app-factory";

async function initializeAllPrograms() {
  console.log("🚀 Initializing all DEFAI programs...\n");
  
  const programs = [
    { name: "DEFAI Swap", init: initializeDefaiSwap },
    { name: "DEFAI Staking", init: initializeDefaiStaking },
    { name: "DEFAI Estate", init: initializeDefaiEstate },
    { name: "DEFAI App Factory", init: initializeDefaiAppFactory },
  ];
  
  const results: { name: string; success: boolean; error?: any }[] = [];
  
  for (const program of programs) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Initializing ${program.name}`);
    console.log(`${"=".repeat(60)}\n`);
    
    try {
      await program.init();
      results.push({ name: program.name, success: true });
    } catch (error) {
      console.error(`❌ Failed to initialize ${program.name}:`, error);
      results.push({ name: program.name, success: false, error });
    }
  }
  
  // Summary
  console.log(`\n${"=".repeat(60)}`);
  console.log("INITIALIZATION SUMMARY");
  console.log(`${"=".repeat(60)}`);
  
  results.forEach(result => {
    const status = result.success ? "✅ Success" : "❌ Failed";
    console.log(`${result.name}: ${status}`);
    if (!result.success && result.error) {
      console.log(`  Error: ${result.error.message || result.error}`);
    }
  });
  
  const successCount = results.filter(r => r.success).length;
  console.log(`\nTotal: ${successCount}/${results.length} programs initialized successfully`);
  
  if (successCount < results.length) {
    console.log("\n⚠️  Some programs failed to initialize. Please check the errors above.");
  } else {
    console.log("\n🎉 All programs initialized successfully!");
  }
}

// Run if called directly
if (require.main === module) {
  initializeAllPrograms().catch(console.error);
} 