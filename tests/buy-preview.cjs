// node tests/buy-preview.cjs — no private data or dependencies.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const section=id=>source.split(`// @section ${id} |`)[1].split('\n').slice(1).join('\n').split('// @section')[0];
const helper=section('buy-preview').split('    function BuyPreview')[0];
const finite=source.match(/const finiteNonnegative = [^;]+;/)[0];
const api=vm.runInNewContext(`${section('asset-math')}\n${section('order-plan')}\n${finite}\n${helper}\n({calculateBuyPreview,calculateBuyPlan});`);
const {calculateBuyPreview:preview,calculateBuyPlan:plan}=api;
const close=(a,b)=>assert(Math.abs(a-b)<1e-8,`${a} != ${b}`);
const sample={currentPortfolio:[{name:'A',categoryValue:400,targetWeight:50},{name:'B',categoryValue:600,targetWeight:50}],buyOrders:[{name:'A',cost:200,fee:.4}],remainingCash:9.6};
const original=JSON.stringify(sample),p=preview(sample);assert.equal(JSON.stringify(sample),original);
close(p.rows[0].beforeWeight,40);close(p.rows[0].afterWeight,50);close(p.rows[1].afterWeight,50);close(p.afterTotal,1200);close(p.purchaseFee,.4);close(p.remainingCash,9.6);
const asset=(id,category,quantity,parkingAsset=false)=>({id,name:id,category,quantity,price:100,currentPrice:100,code:'123456',parkingAsset});
const acc={assets:[asset('A1','A',100),asset('A2','A',80),asset('B','B',20),asset('P','現金/단기채',100,true)],targetPortfolio:[{name:'A',value:50},{name:'B',value:50}]};
const before=JSON.stringify(acc);
for(const parkingRatio of [0,50,100])for(const cash of [0,10,1000,3000]){
 const calculated=plan(acc,cash,parkingRatio),result=preview(calculated);
 close(result.beforeTotal,20000);
 for(const row of result.rows){
  const value=acc.assets.filter(a=>!a.parkingAsset&&a.category===row.name).reduce((s,a)=>s+a.quantity*a.currentPrice,0)+calculated.buyOrders.filter(o=>o.name===row.name).reduce((s,o)=>s+o.shares*o.cp,0);
  close(row.afterValue,value);close(row.afterWeight,value/result.afterTotal*100);
 }
 close(result.rows.reduce((s,r)=>s+r.afterWeight,0),100);
 close(result.purchaseCost+result.purchaseFee+result.remainingCash,calculated.deployCash);
}
assert.equal(JSON.stringify(acc),before);
const empty=preview({currentPortfolio:[{name:'A',categoryValue:0,targetWeight:100}],buyOrders:[],remainingCash:100});assert.equal(empty.rows[0].beforeWeight,null);assert.equal(empty.rows[0].afterWeight,null);
const unchanged=preview({...sample,buyOrders:[]});close(unchanged.rows[0].beforeWeight,unchanged.rows[0].afterWeight);
console.log('PASS before/after weights, unchanged categories, same-category assets, fees/cash conservation, parking/override cash, zero assets and no mutations');
