
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const api = require("../household-import.js");
const { applyHouseholdImport, DEFAULT_MAPPING } = api;
const today = "2026-11-19";
const asset = (code, quantity, other = {}) => ({ id: code, code, quantity, name: "합성 " + code, category: "합성 분류", price: 10, currentPrice: 12, parkingAsset: false, assetType: "위험자산", stockRatio: 40, ...other });
const account = label => ({ label, assets: [asset("123456", 3), asset("444444", 7), asset("", 1, { name: "예수금", parkingAsset: true, price: 43, currentPrice: 43 })],
  contributions: [{ id: 1, type: "배당", month: "2025-09", amount: 4 }, { id: 2, type: "배당", month: "2026-02", amount: 7 },
    { id: 3, type: "입금", month: "2026-04", amount: 20 }], pastContributions: [{ year: 2024, amount: 9, dividend: 2 }],
  targetPortfolio: [{ name: "합성 분류", value: 100 }], rebalanceMonth: 7, rebalanceDay: 10, monthlyInput: 0, limit: 0, availableCash: 45 });
const position = (code, quantity, price = 21, currency = "KRW") => ({ 종목코드: code, 종목명: "합성 " + code, 수량: quantity, 평균매입가: price, 통화: currency });
const pay = { 배당ID: "D1", 지급일: "2026-03-04", 종목코드: "123456", 실수령액: 13 };
const source = (id, holdings, dividends = [], cash = 110) => ({ 계좌ID: id, holdings, dividends, 예수금: cash });
const file = { schema: "household-holdings", schemaVersion: 1, exportedAt: today + "T09:00:00+09:00",
  accounts: [source("ACC-003", [position("123456", 4), position("0A0020", 2), position("SPY", 0.5, 300, "USD")],
    [pay, pay, { ...pay, 배당ID: "D2", 지급일: "2025-02-03" }]), source("ACC-004", [position("123456", 8, 27)], [], null), source("ACC-009", [])] };
const accounts = Object.fromEntries(Object.keys(DEFAULT_MAPPING).map(key => [key, account(key)]));
const inputBefore = JSON.stringify(accounts);
const { accounts: next, summaries } = applyHouseholdImport(accounts, file, DEFAULT_MAPPING, today);

assert.equal(next.pension1.assets[0].quantity, 4);
assert.equal(next.pension2.assets[0].quantity, 8);
assert.equal(next.pension2.assets[0].price, 27);
assert.equal(next.pension1.assets[1].quantity, 0);
assert.equal(next.pension1.assets[1].category, "합성 분류");
assert.equal(next.pension1.assets[0].stockRatio, 40);
assert.equal(next.pension1.assets[0].currentPrice, 12);
assert.equal(next.pension1.assets[2].currentPrice, 110);
assert.equal(next.pension2.assets[2].currentPrice, 43);
assert.equal(next.pension1.availableCash, null);
assert.equal(next.pension1.assets.at(-1).category, "");
assert.equal(next.pension1.assets.at(-1).code, "0A0020");
assert.deepEqual(next.pension1.contributions.map(c => c.amount), [4, 20, 13]);
assert.equal(next.pension1.contributions.at(-1).sourceId, "D1");
assert.equal(next.pension1.contributions.at(-1).memo, "합성 123456");
assert.deepEqual(next.pension1.pastContributions, accounts.pension1.pastContributions);
assert.deepEqual(next.pension1.targetPortfolio, accounts.pension1.targetPortfolio);
assert.equal(next.dcIrp, accounts.dcIrp);
assert.equal(JSON.stringify(accounts), inputBefore);
assert.deepEqual(summaries[0].dividends, {before: 1, after: 1});
assert.throws(() => applyHouseholdImport(next, file, DEFAULT_MAPPING, today), /최신/);
const refreshed = { ...file, exportedAt: today + "T09:00:01+09:00" };
const repeat = applyHouseholdImport(next, refreshed, DEFAULT_MAPPING, today).accounts;
assert.deepEqual(repeat.pension1.contributions, next.pension1.contributions);
assert.deepEqual(repeat.pension1.assets, next.pension1.assets);
const zero = applyHouseholdImport(accounts, { ...file, accounts: [source("ACC-003", [])] }, DEFAULT_MAPPING, today);
assert.equal(zero.summaries[0].allZero, true);
assert.equal(zero.accounts.pension1.assets[0].quantity, 0);
assert.throws(() => applyHouseholdImport(accounts, { ...file, schemaVersion: 99 }, DEFAULT_MAPPING, today), /스키마/);
assert.throws(() => applyHouseholdImport(accounts, file, {...DEFAULT_MAPPING, pension2: "ACC-003"}, today), /두 번/);
assert.throws(() => api.parse(" ".repeat(api.MAX_BYTES + 1)), /20MB/);

const html = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const context = vm.createContext({ HouseholdImport: api, normalizeAccounts: x => x });
vm.runInContext(html.slice(html.indexOf("const ACCOUNT_KEYS"), html.indexOf("function saveState")), context);
const settings = { userName: "합성", incomeLevel: "5500이하" };
assert.doesNotThrow(() => context.validateBackup({ schemaVersion: "1.2", accounts, global: settings }));
assert.doesNotThrow(() => context.validateBackup({ schemaVersion: "1.3", accounts: next, global: { ...settings, householdMapping: DEFAULT_MAPPING } }));
assert.throws(() => context.validateState({ ...next, pension1: { ...next.pension1, lastHouseholdImportAt: "?" } }, settings), /시각/);

const importedAt = "2026-11-19T12:50:00+09:00";
const fixtureAccount = (id, version) => ({
  계좌ID: id,
  holdings: [{ 보유ID: "SAMPLE-01", 종목코드: "123456", 통화: "KRW", 수량: 5 }],
  dividends: [{
    배당ID: "SAMPLE-DIV-" + id,
    지급일: "2026-09-28",
    ...(version === 1 ? { 실수령액: 53.2 } : { 실수령액원: 53 }),
  }],
});
const oldExport = {
  schema: "household-holdings", schemaVersion: 1, exportedAt: importedAt, sourceUi: 70,
  accounts: ["ACC-003", "ACC-004", "ACC-005", "ACC-002", "ACC-008"].map(id => fixtureAccount(id, 1)),
};
const oldPlan = applyHouseholdImport(accounts, api.parse(JSON.stringify(oldExport)), DEFAULT_MAPPING, today);
assert.equal(oldPlan.summaries.length, 4);
assert.equal(oldPlan.accounts.irp.contributions.at(-1).amount, 53.2);
assert.equal(oldPlan.accounts.irp.contributions.at(-1).memo, "종목명 미확인");
assert.equal(oldPlan.accounts.pension1.assets[0].price, accounts.pension1.assets[0].price);
assert.equal(oldPlan.accounts.pension1.assets[2].price, accounts.pension1.assets[2].price);

const examples = ["ACC-003", "ACC-004", "ACC-005", "ACC-002"].map(id => fixtureAccount(id, 2));
examples[0].예수금통화별 = { KRW: 175, USD: 60.1234 };
examples[1].예수금통화별 = { USD: 12.75 };
examples[2].예수금통화별 = null;
examples[0].holdings[0].평균매입가원 = 19;
examples[0].dividends[0].종목명 = "합성 지급 종목";
const newExport = { ...oldExport, schemaVersion: api.SCHEMA_VERSION, sourceUi: 71, accounts: examples };
const nextV2 = applyHouseholdImport(accounts, newExport, DEFAULT_MAPPING, today).accounts;
assert.equal(nextV2.pension1.assets[0].price, 19);
assert.equal(nextV2.pension1.assets[2].price, 175);
assert.equal(nextV2.pension2.assets[2].price, 43);
assert.equal(nextV2.isa.assets[2].price, 43);
assert.equal(nextV2.pension1.contributions.at(-1).memo, "합성 지급 종목");
assert.equal(nextV2.pension1.contributions.at(-1).amount, 53);
assert.doesNotThrow(() => context.validateState(nextV2, settings));
console.log("가계앱 가져오기 및 백업 호환 시험 통과");
