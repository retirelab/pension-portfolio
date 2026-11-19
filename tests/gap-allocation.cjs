// node tests/gap-allocation.cjs — no dependencies or private account data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function section(id) {
  return source.split(`// @section ${id} |`)[1].split('\n').slice(1).join('\n').split('// @section')[0];
}
const finite = source.match(/const finiteNonnegative = [^;]+;/)[0];
const api = vm.runInNewContext(`${section('asset-math')}\n${section('order-plan')}\n${finite}\n({allocateGapBuyOrders,calculateBuyPlan});`);
const allocate = api.allocateGapBuyOrders;
const item = (assetId,deficit,cp=1000) => ({assetId,name:assetId,deficit,cp});
const amounts = plan => Object.fromEntries(plan.orders.map(o=>[o.assetId,o.cost]));
assert.deepEqual(amounts(allocate([item('A',600000),item('B',400000)],400800)),{A:300000,B:100000});
assert.deepEqual(amounts(allocate([item('A',600000),item('B',400000)],100200)),{A:100000});
const four = allocate(['A','B','C','D'].map(id=>item(id,100000)),200400);
assert.equal(four.orders.length,4);for(const o of four.orders)assert.equal(o.cost,50000);
assert.deepEqual(amounts(allocate([item('A',1000000,1000000),item('B',500000)],100200)),{B:100000});
assert.equal(allocate([item('A',100000)],0).orders.length,0);
assert.equal(allocate([item('A',-100),item('B',100,0),item('C',100,NaN)],10000).orders.length,0);
const filled=allocate([item('A',2000)],100000);assert.equal(filled.orders[0].cost,2000);assert.equal(filled.remainingCash,97996);
// Exercise the App's actual entry point, not just the allocator: fourth target gets an order.
const acc={assets:['A','B','C','D'].map((id,i)=>({id:i,name:id,category:id,code:'123456',quantity:100,price:100,currentPrice:100})),targetPortfolio:['A','B','C','D'].map(name=>({name,value:25}))};
assert.equal(api.calculateBuyPlan(acc,4000).buyOrders.length,4);
let seed=42;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/2**32);
for(let trial=0;trial<2000;trial++){
 const items=Array.from({length:1+Math.floor(random()*12)},(_,i)=>item(String(i),Math.floor(random()*1000000)-10000,1+Math.floor(random()*50000)));
 const budget=Math.floor(random()*2000000),original=JSON.stringify(items),plan=allocate(items,budget);
 assert.equal(JSON.stringify(items),original);
 const spent=plan.orders.reduce((n,o)=>n+o.cost+o.fee,0);
 assert(spent<=budget+1e-7);assert(plan.remainingCash>=0);assert(Math.abs(spent+plan.remainingCash-budget)<1e-6);
 for(const o of plan.orders){assert(Number.isInteger(o.shares)&&o.shares>0);assert(o.cost<=o.deficit+1e-7);}
 for(const x of items){const cost=plan.orders.find(o=>o.assetId===x.assetId)?.cost||0;assert(!(x.deficit-cost+1e-8>=x.cp&&plan.remainingCash+1e-8>=x.cp*1.002),'left an affordable underweight share unallocated');}
}
// Large quantities must not require simulating each share separately.
const large=allocate([item('A',1e10,1),item('B',1e10,1),item('C',1e10,1e10)],1e9);
assert(large.orders.length>=2);
console.log('PASS gap leveling example, small cash, >3 targets, expensive shares, target caps, 2000 randomized cash/fee invariants and large quantities');

const unknown = { id: "unknown", name: "합성 미분류", category: "", quantity: 10, price: 10000, currentPrice: 10000 };
const blankParking = { ...unknown, id: "unclassified-parking", name: "합성 미분류 파킹", category: "  ", parkingAsset: true };
const baselinePlan = api.calculateBuyPlan(acc, 4000, 100);
const reviewedPlan = api.calculateBuyPlan({ ...acc, assets: [...acc.assets, unknown, blankParking] }, 4000, 100);
assert.deepEqual(reviewedPlan.fullRebalancePlan, baselinePlan.fullRebalancePlan);
assert.deepEqual(reviewedPlan.buyOrders, baselinePlan.buyOrders);
assert.deepEqual(reviewedPlan.deviationData, baselinePlan.deviationData);
assert.equal(reviewedPlan.generatedParkingSellOrders.length, 0);
assert.equal(reviewedPlan.unclassifiedAssets.length, 2);
assert.equal(api.calculateBuyPlan({ ...acc, targetPortfolio: [], assets: [unknown] }, 0).unclassifiedAssets[0].id, "unknown");
