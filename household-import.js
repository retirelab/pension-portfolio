/* 가계앱 내보내기 형식의 검증과 가져오기. 브라우저 저장소와 네트워크는 사용하지 않는다. */
const HouseholdImport = (() => {
  const MAX_BYTES = 20 * 1024 * 1024;
  const DEFAULT_MAPPING = Object.freeze({
    pension1: "ACC-003", pension2: "ACC-004", irp: "ACC-005", dcIrp: null, isa: "ACC-002",
  });
  const isObject = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const isAmount = value => typeof value === "number" && Number.isFinite(value) && value >= 0;
  const isAccountId = value => typeof value === "string" && /^ACC-[0-9]+$/.test(value);
  const isCode = value => typeof value === "string" && /^[0-9A-Z]{6}$/.test(value);
  const isText = value => value === null || typeof value === "string";
  const validDate = value => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const time = Date.parse(value + "T00:00:00Z");
    return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
  };
  const validTimestamp = value => typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    validDate(value.slice(0, 10)) && Number.isFinite(Date.parse(value));

  function validateMapping(mapping) {
    if (!isObject(mapping)) throw new Error("계좌 연결 설정을 확인해주세요.");
    const used = new Set();
    for (const [key, id] of Object.entries(mapping)) {
      if (!Object.hasOwn(DEFAULT_MAPPING, key) || (id !== null && !isAccountId(id))) {
        throw new Error("계좌 ID는 ACC-003처럼 입력해주세요.");
      }
      if (id !== null && used.has(id)) throw new Error("같은 가계앱 계좌를 두 번 연결할 수 없습니다.");
      if (id !== null) used.add(id);
    }
    return mapping;
  }

  function parse(text) {
    if (new TextEncoder().encode(text).length > MAX_BYTES) throw new Error("20MB 이하의 자료만 가져올 수 있습니다.");
    try { return JSON.parse(text); }
    catch { throw new Error("JSON 파일 또는 붙여넣은 내용을 확인해주세요."); }
  }

  function readFile(file) {
    if (!isObject(file) || file.schema !== "household-holdings" || file.schemaVersion !== 1 ||
        !validTimestamp(file.exportedAt) || !Array.isArray(file.accounts)) {
      throw new Error("가계앱 보유 내보내기 파일(스키마 1)이 필요합니다.");
    }
    const indexed = new Map();
    for (const row of file.accounts) {
      if (!isObject(row) || !isAccountId(row.계좌ID) || indexed.has(row.계좌ID)) {
        throw new Error("내보내기 파일에 잘못되거나 중복된 계좌 ID가 있습니다.");
      }
      indexed.set(row.계좌ID, row);
    }
    return indexed;
  }

  function readHoldings(source) {
    if (!Array.isArray(source.holdings) || !Array.isArray(source.dividends) ||
        (source.예수금 !== null && !isAmount(source.예수금))) throw new Error("보유 종목·배당·예수금 항목을 확인해주세요.");
    const positions = new Map();
    for (const row of source.holdings) {
      if (!isObject(row) || !isText(row.통화)) throw new Error("종목 통화 정보가 올바르지 않습니다.");
      if (row.통화 !== "KRW") {
        if (row.통화 === null) throw new Error("통화가 확인되지 않은 종목이 있습니다.");
        continue;
      }
      const code = row.종목코드;
      if (!isCode(code) || positions.has(code) || !isText(row.종목명) ||
          !Number.isSafeInteger(row.수량) || row.수량 <= 0 ||
          (row.평균매입가 !== null && !isAmount(row.평균매입가))) {
        throw new Error("국내 종목코드·수량·평균매입가를 확인해주세요.");
      }
      positions.set(code, row);
    }
    return positions;
  }

  function newId(used, base) {
    let id = base;
    for (let i = 2; used.has(id); i++) id = base + "-" + i;
    used.add(id);
    return id;
  }

  function replaceDividends(account, source, names, today) {
    const year = today.slice(0, 4);
    if (account.pastContributions.some(row => String(row.year) === year)) {
      return { contributions: account.contributions, dividends: null };
    }
    const isThisYearDividend = row => row.type === "배당" && row.month.slice(0, 4) === year;
    const contributions = account.contributions.filter(row => !isThisYearDividend(row));
    const before = account.contributions.length - contributions.length;
    const ids = new Set(contributions.map(row => row.id));
    const seen = new Set(contributions.map(row => row.sourceId).filter(Boolean));
    let after = 0;
    for (const row of source.dividends) {
      if (!isObject(row) || typeof row.배당ID !== "string" || !row.배당ID.trim() ||
          !validDate(row.지급일) || !isText(row.종목코드) ||
          (row.실수령액 !== null && !isAmount(row.실수령액))) throw new Error("파일의 배당 내역을 확인해주세요.");
      if (!row.지급일.startsWith(year) || row.지급일 > today || seen.has(row.배당ID)) continue;
      if (row.실수령액 === null) throw new Error("올해 배당 중 실수령액이 비어 있는 기록이 있습니다.");
      seen.add(row.배당ID);
      contributions.push({
        id: newId(ids, "hh-div-" + row.배당ID), month: row.지급일, amount: row.실수령액,
        type: "배당", sourceId: row.배당ID,
        memo: (typeof row.종목명 === "string" && row.종목명) || names.get(row.종목코드) || row.종목코드 || "종목명 미확인",
      });
      after++;
    }
    return { contributions, dividends: { before, after } };
  }

  const assetCode = asset => String(asset.code || "").trim().toUpperCase();
  const isCash = asset => !assetCode(asset) && asset.name.trim() === "예수금";
  const cashValue = asset => asset.quantity * (asset.currentPrice || asset.price);

  function applyHouseholdImport(accounts, file, mapping, today) {
    validateMapping(mapping);
    if (!validDate(today)) throw new Error("오늘 날짜를 확인해주세요.");
    const incoming = readFile(file);
    const next = { ...accounts };
    const summaries = [];
    for (const [key, sourceId] of Object.entries(mapping)) {
      if (!sourceId || !incoming.has(sourceId)) continue;
      const source = incoming.get(sourceId);
      const account = accounts[key];
      if (!account) throw new Error("연결할 절세3총사 계좌가 없습니다.");
      if (account.lastHouseholdImportAt && Date.parse(file.exportedAt) <= Date.parse(account.lastHouseholdImportAt)) {
        throw new Error(account.label + "에 적용한 파일보다 최신 자료가 필요합니다.");
      }
      const positions = readHoldings(source);
      const ids = new Set(account.assets.map(asset => asset.id));
      const names = new Map(account.assets.filter(asset => assetCode(asset)).map(asset => [assetCode(asset), asset.name]));
      positions.forEach((row, code) => { if (row.종목명) names.set(code, row.종목명); });
      const summary = { key, sourceId, label: account.label, changed: [], zeroed: [], added: [] };
      const localCodes = new Set();
      const cashRows = account.assets.filter(isCash);
      if (cashRows.length > 1) throw new Error(account.label + "의 예수금 항목이 중복되어 있습니다.");
      let assets = account.assets.map(asset => {
        const code = assetCode(asset);
        if (!isCode(code)) return asset;
        if (localCodes.has(code)) throw new Error(account.label + "에 같은 종목코드가 여러 번 있습니다.");
        localCodes.add(code);
        const row = positions.get(code);
        const quantity = row?.수량 ?? 0;
        if (quantity !== asset.quantity) {
          const change = { code, name: asset.name, before: asset.quantity, after: quantity };
          (quantity === 0 ? summary.zeroed : summary.changed).push(change);
        }
        return { ...asset, quantity, price: row?.평균매입가 ?? asset.price };
      });
      for (const [code, row] of positions) {
        if (localCodes.has(code)) continue;
        if (row.평균매입가 === null) throw new Error(code + " 신규 종목의 평균매입가를 확인해주세요.");
        const name = row.종목명 || code;
        assets.push({ id: newId(ids, "hh-" + code), code, name, quantity: row.수량, price: row.평균매입가,
          currentPrice: 0, category: "", parkingAsset: false, assetType: "위험자산" });
        summary.added.push({ code, name, after: row.수량 });
      }
      const beforeCash = cashRows.length ? cashValue(cashRows[0]) : 0;
      summary.cash = { before: beforeCash, after: source.예수금 };
      if (source.예수금 !== null) {
        const base = cashRows[0] || { id: newId(ids, "hh-cash"), name: "예수금", code: "", category: "현금/단기채", assetType: "안전자산" };
        const cash = { ...base, parkingAsset: true, quantity: 1, price: source.예수금, currentPrice: source.예수금 };
        assets = cashRows.length ? assets.map(asset => asset.id === base.id ? cash : asset) : [...assets, cash];
      }
      const result = replaceDividends(account, source, names, today);
      summary.dividends = result.dividends;
      summary.allZero = positions.size === 0;
      next[key] = { ...account, assets, contributions: result.contributions, availableCash: null, lastHouseholdImportAt: file.exportedAt };
      summaries.push(summary);
    }
    if (!summaries.length) throw new Error("파일에 연결된 계좌가 없습니다. 계좌 연결을 확인해주세요.");
    return { accounts: next, summaries };
  }

  return { MAX_BYTES, DEFAULT_MAPPING, validTimestamp, validateMapping, parse, applyHouseholdImport };
})();
if (typeof module !== "undefined" && module.exports) module.exports = HouseholdImport;
