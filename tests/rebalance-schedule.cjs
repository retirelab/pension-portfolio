// Run: node tests/rebalance-schedule.cjs (no packages or personal data required).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const math = source.split('// @section asset-math |')[1].split('// @section order-plan |')[0].split('\n').slice(1).join('\n');
const dateKey = source.match(/function localDateKey\(d\) \{[\s\S]*?\n    \}/)[0];
const api = vm.runInNewContext(`${math}\n${dateKey}\n({nextRebalance, rebalanceScheduleLabel});`, {Date});
for (const [frequency, month, day, date, expected, days] of [
  ['annual', 7, 15, '2026-07-15', '2026-07-15', 0],
  ['annual', 7, 15, '2026-07-16', '2027-07-15', 364],
  ['semiannual', 1, 15, '2026-07-16', '2027-01-15', 183],
  ['quarterly', 1, 15, '2026-11-06', '2027-01-15', 70],
  ['quarterly', 2, 31, '2026-11-30', '2026-11-30', 0],
  ['monthly', 7, 31, '2026-02-01', '2026-02-28', 27],
  ['monthly', 7, 31, '2026-03-01', '2026-03-31', 30],
  ['monthly', 7, 31, '2028-02-01', '2028-02-29', 28],
  ['monthly', 7, 15, '2026-12-16', '2027-01-15', 30],
  ['quarterly', 11, 15, '2026-02-16', '2026-05-15', 88],
  ['semiannual', 10, 15, '2026-04-16', '2026-10-15', 182],
]) {
  const actual = api.nextRebalance(month, day, new Date(date + 'T12:00:00'), frequency);
  assert.equal(actual.date, expected, `${frequency}: ${date}`);
  assert.equal(actual.days, days, `${frequency}: days from ${date}`);
}
assert.equal(api.nextRebalance(7, 15, new Date('2026-11-06T12:00:00')).date, '2027-07-15');
assert.equal(api.rebalanceScheduleLabel({rebalanceFrequency:'quarterly',rebalanceMonth:1,rebalanceDay:15}), '분기 · 1·4·7·10월 15일');
assert.equal(api.rebalanceScheduleLabel({rebalanceFrequency:'monthly',rebalanceMonth:1,rebalanceDay:31}), '매월 31일');
console.log('PASS annual, semiannual, quarterly, monthly, rollover, leap dates, month-end and legacy default');
