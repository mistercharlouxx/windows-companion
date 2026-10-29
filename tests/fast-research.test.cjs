const test=require('node:test');const assert=require('node:assert/strict');
const {runFastResearch}=require('../dist/main/fastResearch.js');
test('fast research plans once and synthesizes after parallel evidence',async()=>{
  let calls=0;const ask=async()=>({text:++calls===1?'answer with sources':'unexpected',model:'test'});
  const browser={open:async()=>({}),search:async()=>({links:[]})};
  const originalFetch=global.fetch;global.fetch=async url=>({ok:true,url:String(url),text:async()=>String(url).includes('duckduckgo')?'<div class="result"><h2><a class="result__a" href="https://www.carrefour.fr/rice">Rice price</a></h2><a class="result__snippet">Rice costs 2 euros</a></div></div>':'<title>Rice</title><main>Rice costs 2 euros</main>'});
  try{const result=await runFastResearch('shopping budget for one week','',ask,browser,()=>{});assert.equal(result.text,'answer with sources');assert.equal(result.steps,4);assert.ok(result.sources.length)}finally{global.fetch=originalFetch}
});
