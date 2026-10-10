// 语音文本解析：按字段 schema 提取“关键词 + 数字”，供首页/切割页共用
// schema 示例: [{ keys: ['长', '长度'], field: 'plateL', label: '长' }]

const DIGIT_MAP = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

// 中文数字转阿拉伯（支持 千/百/十/点 组合，如“一千零五十” → 1050）
function cnToNum(s) {
  if (/^\d/.test(s)) return s;
  if (!/[零一二两三四五六七八九十百千万点]/.test(s)) return s;
  let total = 0, cur = 0;
  for (const ch of s) {
    if (ch in DIGIT_MAP) {
      cur = cur * 10 + DIGIT_MAP[ch];
    } else if (ch === '十') {
      total += (cur || 1) * 10; cur = 0;
    } else if (ch === '百') {
      total += (cur || 1) * 100; cur = 0;
    } else if (ch === '千') {
      total += (cur || 1) * 1000; cur = 0;
    } else if (ch === '万') {
      total += (cur || 1) * 10000; cur = 0;
    } else if (ch === '点') {
      total += cur; cur = 0;
      // 小数点后简单拼数字
      const tail = s.slice(s.indexOf(ch) + 1);
      let frac = '';
      for (const c of tail) frac += c in DIGIT_MAP ? String(DIGIT_MAP[c]) : '';
      return total + '.' + frac;
    }
  }
  total += cur;
  return total ? String(total) : s;
}

/**
 * 解析语音文本
 * @param {string} text 识别文本，如“长1000，宽500，厚30”
 * @param {Array} schema 字段映射表
 * @returns {{values:Object, labels:Array}} values: {field: '数值'}；labels: ['长1000', ...]
 */
function parseVoice(text, schema) {
  const values = {};
  const labels = [];
  if (!text) return { values, labels };
  for (const item of schema) {
    for (const k of item.keys) {
      const re = new RegExp(
        k + '\\s*[为是等于]?\\s*(\\d+(?:\\.\\d+)?|[零一二两三四五六七八九十百千万]+(?:\\.?[零一二三四五六七八九]+)?)'
      );
      const m = text.match(re);
      if (m) {
        const v = cnToNum(m[1]);
        if (v && !Number.isNaN(Number(v))) {
          values[item.field] = v;
          labels.push(item.label + v);
          break;
        }
      }
    }
  }
  return { values, labels };
}

module.exports = { parseVoice, cnToNum };
