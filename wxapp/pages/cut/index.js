const { parseVoice } = require("../../utils/voice.js");

// 语音识别插件（同声传译 WechatSI）；插件未就绪时降级提示
let voicePlugin = null;
try {
  voicePlugin = requirePlugin("WechatSI");
} catch (e) {
  voicePlugin = null;
}

// 按当前切割模式生成字段映射（长关键词在前，避免短关键词误捕）
function voiceSchema(cutType) {
  if (cutType === "rod") {
    return [
      { keys: ["下料长度", "下料长"], field: "rodSpecs[0].len", label: "下料长度" },
      { keys: ["长度", "长"], field: "rodLen", label: "长度" },
      { keys: ["直径", "径"], field: "rodDia", label: "直径" },
      { keys: ["夹持"], field: "rodClamp", label: "夹持" },
      { keys: ["刀缝", "缝"], field: "rodKerf", label: "刀缝" }
    ];
  }
  return [
    { keys: ["下料长"], field: "blockSpecs[0].l", label: "下料长" },
    { keys: ["下料宽"], field: "blockSpecs[0].w", label: "下料宽" },
    { keys: ["长", "长度"], field: "plateL", label: "长" },
    { keys: ["宽", "宽度"], field: "plateW", label: "宽" },
    { keys: ["厚", "厚度"], field: "cutThickness", label: "厚" },
    { keys: ["刀缝", "缝"], field: "kerf", label: "刀缝" }
  ];
}

Page({
  data: {
    plateL: "",
    plateW: "",
    cutThickness: "",
    kerf: "",
    kerfPlaceholder: "如 5",
    blockSpecs: [{ id: 1, l: "", w: "", qty: "" }],
    blockSpecSeq: 1,
    targetN: "",
    targetNEdited: false,
    cutMsg: "",
    cutMsgWarn: false,
    targetShow: "",
    showResult: false,
    count: 0,
    mode: "",
    ratio: "",
    waste: "",
    canvasHeight: 0,
    mixMode: false,
    sheetCount: 0,
    sheetList: [],
    mixPage: 1,
    mixTotal: 0,
    legendSpecs: [],

    // 切割类型与棒/管
    cutType: "plate", // plate | rod
    rodLen: "",
    rodDia: "",
    rodSpecs: [{ id: 1, len: "", qty: "" }],
    rodSpecSeq: 1,
    rodPiece: "",
    rodClamp: "",
    rodClampPlaceholder: "推荐 20",
    rodKerf: "",
    rodKerfPlaceholder: "如 3",
    rodTargetN: "",
    rodTargetNEdited: false,
    rodMsg: "",
    rodMsgWarn: false,
    rodTargetShow: "",
    showRodResult: false,
    rodCount: 0,
    rodUsed: "",
    rodTail: "",
    rodRatio: "",
    rodKerfCount: 0,
    rodCanvasHeight: 0,
    rodMixMode: false,
    rodMixCount: 0,
    rodBarCount: 0,
    rodBarList: [],
    rodPage: 1,
    rodTotal: 0,
    legendRodSpecs: [],
    voiceState: "idle",
    voiceText: "",
    voiceTip: ""
  },

  // 开启分享：右上角菜单「转发」可用
  onShareAppMessage() {
    return {
      title: "ADV小助手 · 板棒材切割测算",
      path: "/pages/cut/index",
      imageUrl: "/images/share-cover.png"
    };
  },

  onLoad() {
    if (!voicePlugin) return;
    this.voiceManager = voicePlugin.getRecordRecognitionManager();
    this.voiceManager.onStart = () => {
      this.setData({ voiceState: "rec", voiceText: "", voiceTip: "" });
    };
    this.voiceManager.onRecognize = (res) => {
      this.setData({ voiceText: res.result || "" });
    };
    this.voiceManager.onStop = (res) => {
      this.handleVoiceResult((res && res.result) || "");
    };
    this.voiceManager.onError = (res) => {
      this.setData({ voiceState: "idle", voiceTip: "语音识别失败：" + ((res && res.msg) || "请重试") });
    };
  },

  // 语音输入：点击开始/停止（全链路异常兜底，任何问题都会可见提示）
  onVoiceTap() {
    if (!this.voiceManager) {
      wx.showToast({ title: "语音插件未就绪，请检查插件是否添加", icon: "none", duration: 2500 });
      return;
    }
    try {
      if (this.data.voiceState === "rec") {
        this.voiceManager.stop();
        return;
      }
      const startRec = () => {
        try {
          this.voiceManager.start({ duration: 30000, lang: "zh_CN" });
          // 立即给出录音态反馈，不等插件回调
          this.setData({ voiceState: "rec", voiceText: "", voiceTip: "" });
          console.log("[voice] start ok");
        } catch (err) {
          console.error("[voice] start error", err);
          wx.showToast({ title: "录音启动失败：" + (err && err.errMsg ? err.errMsg : "未知错误"), icon: "none", duration: 3000 });
        }
      };
      wx.getSetting({
        success: (r) => {
          console.log("[voice] authSetting", JSON.stringify(r.authSetting));
          if (r.authSetting["scope.record"] === false) {
            wx.showModal({
              title: "需要麦克风权限",
              content: "请在设置中允许使用麦克风后，再使用语音输入",
              confirmText: "去设置",
              success: (res) => {
                if (res.confirm) wx.openSetting({});
              }
            });
            return;
          }
          if (r.authSetting["scope.record"] === true) {
            startRec();
            return;
          }
          wx.authorize({
            scope: "scope.record",
            success: startRec,
            fail: (err) => {
              console.error("[voice] authorize fail", err);
              wx.showModal({
                title: "需要麦克风权限",
                content: "请允许使用麦克风后，再尝试语音输入",
                showCancel: false
              });
            }
          });
        },
        fail: (err) => {
          console.error("[voice] getSetting fail", err);
          wx.showToast({ title: "权限检查失败，请重试", icon: "none" });
        }
      });
    } catch (err) {
      console.error("[voice] tap error", err);
      wx.showToast({ title: "语音功能异常：" + (err && err.message ? err.message : "未知错误"), icon: "none", duration: 3000 });
    }
  },

  // 识别完成：解析并填入对应输入框
  handleVoiceResult(text) {
    if (!text) {
      this.setData({ voiceState: "idle", voiceTip: "未听清，请再说一次" });
      return;
    }
    const schema = voiceSchema(this.data.cutType);
    const { values, labels } = parseVoice(text, schema);
    if (Object.keys(values).length === 0) {
      this.setData({ voiceState: "idle", voiceTip: "未识别到参数，试试说：长1000，宽500，厚30" });
      return;
    }
    this.setData(Object.assign({}, values, { voiceState: "done", voiceTip: "已填入：" + labels.join(" / ") }));
    setTimeout(() => {
      this.setData({ voiceState: "idle", voiceTip: "" });
    }, 3000);
  },

  onReady() {
    // 注意：canvas 在 wx:if 内，首次进入尚未渲染，此处仅做预初始化（拿不到节点也正常）
    this.initCanvas();
  },

  // 切割类型切换
  onCutTypeTap(e) {
    this.setData({ cutType: e.currentTarget.dataset.type });
  },

  onRodInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: e.detail.value });
  },

  // 夹持长度按直径推荐（车床/切断机装夹惯例）
  clampByDia(d) {
    if (d <= 6) return 10;
    if (d <= 12) return 15;
    if (d <= 20) return 20;
    if (d <= 30) return 25;
    return 30;
  },

  // 刀缝按直径推荐（棒/管锯切常用）
  kerfByDia(d) {
    if (d <= 10) return 2;
    if (d <= 20) return 3;
    if (d <= 30) return 4;
    return 5;
  },

  // 直径变化 → 联动夹持/刀缝推荐值（灰色 placeholder）
  onRodDiaInput(e) {
    const d = this.num(e.detail.value);
    this.setData({
      rodDia: e.detail.value,
      rodClampPlaceholder: d !== null ? "推荐 " + this.clampByDia(d) + "（直径 " + d + " mm）" : "推荐 20",
      rodKerfPlaceholder: d !== null ? "推荐 " + this.kerfByDia(d) + "（直径 " + d + " mm）" : "如 3"
    });
  },

  onRodTargetNInput(e) {
    this.setData({ rodTargetN: e.detail.value, rodTargetNEdited: true, rodMsg: "", rodMsgWarn: false });
  },

  rodNum(v) {
    const n = parseFloat(v);
    return isFinite(n) && n > 0 ? n : null;
  },

  // 查询并缓存 canvas 节点（画布渲染后才可查询）
  initCanvas() {
    const query = wx.createSelectorQuery().in(this);
    query.select("#cutCanvas").fields({ node: true, size: true }).exec((res) => {
      if (res && res[0] && res[0].node) {
        this.canvas = res[0].node;
        this.ctx = this.canvas.getContext("2d");
        this.canvasCssWidth = res[0].width;
      }
    });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: e.detail.value });
  },

  // ---------- 多规格输入（板材 / 棒管共用逻辑） ----------
  onBlockSpecInput(e) {
    const i = Number(e.currentTarget.dataset.index);
    const key = e.currentTarget.dataset.key;
    const specs = this.data.blockSpecs.slice();
    if (!specs[i]) return;
    specs[i] = Object.assign({}, specs[i], { [key]: e.detail.value });
    this.setData({ blockSpecs: specs });
  },

  onAddBlockSpec() {
    const len = this.data.blockSpecs.length;
    if (len >= 5) {
      wx.showToast({ title: "最多 5 条规格", icon: "none" });
      return;
    }
    const seq = this.data.blockSpecSeq + 1;
    this.setData({
      blockSpecSeq: seq,
      blockSpecs: this.data.blockSpecs.concat([{ id: seq, l: "", w: "", qty: "" }])
    });
  },

  onDelBlockSpec(e) {
    const i = Number(e.currentTarget.dataset.index);
    if (this.data.blockSpecs.length <= 1) return;
    const specs = this.data.blockSpecs.slice();
    specs.splice(i, 1);
    this.setData({ blockSpecs: specs });
  },

  onRodSpecInput(e) {
    const i = Number(e.currentTarget.dataset.index);
    const key = e.currentTarget.dataset.key;
    const specs = this.data.rodSpecs.slice();
    if (!specs[i]) return;
    specs[i] = Object.assign({}, specs[i], { [key]: e.detail.value });
    this.setData({ rodSpecs: specs });
  },

  onAddRodSpec() {
    const len = this.data.rodSpecs.length;
    if (len >= 5) {
      wx.showToast({ title: "最多 5 条规格", icon: "none" });
      return;
    }
    const seq = this.data.rodSpecSeq + 1;
    this.setData({
      rodSpecSeq: seq,
      rodSpecs: this.data.rodSpecs.concat([{ id: seq, len: "", qty: "" }])
    });
  },

  onDelRodSpec(e) {
    const i = Number(e.currentTarget.dataset.index);
    if (this.data.rodSpecs.length <= 1) return;
    const specs = this.data.rodSpecs.slice();
    specs.splice(i, 1);
    this.setData({ rodSpecs: specs });
  },

  // 板材厚度变化 → 联动刀缝推荐值（灰色 placeholder）
  onCutThicknessInput(e) {
    const t = this.num(e.detail.value);
    this.setData({
      cutThickness: e.detail.value,
      kerfPlaceholder: t !== null ? "推荐 " + this.kerfByThickness(t) + "（厚度 " + t + " mm）" : "如 5"
    });
  },

  // 刀缝按厚度推荐（工程塑料锯切常用）
  kerfByThickness(t) {
    if (t <= 5) return 2;
    if (t <= 10) return 3;
    if (t <= 20) return 4;
    if (t <= 30) return 5;
    return 6;
  },

  onTargetNInput(e) {
    this.setData({ targetN: e.detail.value, targetNEdited: true, cutMsg: "", cutMsgWarn: false });
  },

  num(v) {
    const n = parseFloat(v);
    return isFinite(n) && n > 0 ? n : null;
  },

  formatNum(n) {
    if (!isFinite(n)) return "-";
    const rounded = Math.round(n * 1000) / 1000;
    return rounded.toLocaleString("zh-CN", { maximumFractionDigits: 3 });
  },

  // 沿一个方向排 n 块：n×块 + (n-1)×刀缝 ≤ 板长
  cutNum(len, block, kerf) {
    if (block + kerf <= 0) return 0;
    return Math.floor((len + kerf) / (block + kerf));
  },

  // 排样：直排 / 旋转 / 分区混合，取最大块数
  bestCut(W, H, bw, bh, kerf) {
    let best = { count: 0, blocks: [], mode: "" };

    const consider = (blocks, mode) => {
      if (blocks.length > best.count) {
        best = { count: blocks.length, blocks: blocks, mode: mode };
      }
    };

    // 纯 A（正向直排）
    (() => {
      const cols = this.cutNum(W, bw, kerf);
      const rows = this.cutNum(H, bh, kerf);
      if (cols <= 0 || rows <= 0) return;
      const blocks = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          blocks.push({ x: c * (bw + kerf), y: r * (bh + kerf), w: bw, h: bh, rot: false });
        }
      }
      consider(blocks, "正向直排");
    })();

    // 纯 B（旋转直排）
    (() => {
      const cols = this.cutNum(W, bh, kerf);
      const rows = this.cutNum(H, bw, kerf);
      if (cols <= 0 || rows <= 0) return;
      const blocks = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          blocks.push({ x: c * (bh + kerf), y: r * (bw + kerf), w: bh, h: bw, rot: true });
        }
      }
      consider(blocks, "旋转直排");
    })();

    // 混合1：上方 t 行正向块，下方剩余区域排旋转块
    (() => {
      const rowsA = this.cutNum(H, bh, kerf);
      for (let t = 1; t <= rowsA; t++) {
        const hUsed = t * bh + (t - 1) * kerf;
        const hRem = H - hUsed;
        if (hRem <= 0) continue;
        const colsA = this.cutNum(W, bw, kerf);
        const colsB = this.cutNum(W, bh, kerf);
        const rowsB = this.cutNum(hRem, bw, kerf);
        if (colsA <= 0 || colsB <= 0 || rowsB <= 0) continue;
        const blocks = [];
        for (let r = 0; r < t; r++) {
          for (let c = 0; c < colsA; c++) {
            blocks.push({ x: c * (bw + kerf), y: r * (bh + kerf), w: bw, h: bh, rot: false });
          }
        }
        for (let r2 = 0; r2 < rowsB; r2++) {
          for (let c2 = 0; c2 < colsB; c2++) {
            blocks.push({ x: c2 * (bh + kerf), y: hUsed + kerf + r2 * (bw + kerf), w: bh, h: bw, rot: true });
          }
        }
        consider(blocks, "上正下旋分区");
      }
    })();

    // 混合2：左方 c 列正向块，右方剩余区域排旋转块
    (() => {
      const colsA = this.cutNum(W, bw, kerf);
      for (let c = 1; c <= colsA; c++) {
        const wUsed = c * bw + (c - 1) * kerf;
        const wRem = W - wUsed;
        if (wRem <= 0) continue;
        const rowsA = this.cutNum(H, bh, kerf);
        const colsB = this.cutNum(wRem, bh, kerf);
        const rowsB = this.cutNum(H, bw, kerf);
        if (rowsA <= 0 || colsB <= 0 || rowsB <= 0) continue;
        const blocks = [];
        for (let r = 0; r < rowsA; r++) {
          for (let c0 = 0; c0 < c; c0++) {
            blocks.push({ x: c0 * (bw + kerf), y: r * (bh + kerf), w: bw, h: bh, rot: false });
          }
        }
        for (let r2 = 0; r2 < rowsB; r2++) {
          for (let c2 = 0; c2 < colsB; c2++) {
            blocks.push({ x: wUsed + kerf + c2 * (bh + kerf), y: r2 * (bw + kerf), w: bh, h: bw, rot: true });
          }
        }
        consider(blocks, "左正右旋分区");
      }
    })();

    // 混合3：上方 t 行旋转块，下方剩余区域排正向块
    (() => {
      const rowsB = this.cutNum(H, bw, kerf);
      for (let t = 1; t <= rowsB; t++) {
        const hUsed = t * bw + (t - 1) * kerf;
        const hRem = H - hUsed;
        if (hRem <= 0) continue;
        const colsB = this.cutNum(W, bh, kerf);
        const colsA = this.cutNum(W, bw, kerf);
        const rowsA = this.cutNum(hRem, bh, kerf);
        if (colsB <= 0 || colsA <= 0 || rowsA <= 0) continue;
        const blocks = [];
        for (let r = 0; r < t; r++) {
          for (let c = 0; c < colsB; c++) {
            blocks.push({ x: c * (bh + kerf), y: r * (bw + kerf), w: bh, h: bw, rot: true });
          }
        }
        for (let r2 = 0; r2 < rowsA; r2++) {
          for (let c2 = 0; c2 < colsA; c2++) {
            blocks.push({ x: c2 * (bw + kerf), y: hUsed + kerf + r2 * (bh + kerf), w: bw, h: bh, rot: false });
          }
        }
        consider(blocks, "上旋下正分区");
      }
    })();

    return best;
  },

  // ---------- 多规格混排（板材 2D 矩形排样） ----------
  // 规格配色（示意图 / 图例共用）
  specColor(i) {
    const COLORS = ["#1e5eff", "#f08c00", "#2f9e44", "#7048e8", "#c92a2a"];
    return COLORS[i % COLORS.length];
  },

  // 在板的自由矩形里放一块（含刀缝占位），best-fit 短边优先
  placePiece(sheet, piece, kerf) {
    const K = kerf > 0 ? kerf : 0;
    const pw = piece.l + K;
    const ph = piece.w + K;
    let best = null;
    for (let fi = 0; fi < sheet.free.length; fi++) {
      const fr = sheet.free[fi];
      const opts = [];
      if (pw <= fr.w + 1e-6 && ph <= fr.h + 1e-6) opts.push({ rot: false, ow: pw, oh: ph });
      if (ph <= fr.w + 1e-6 && pw <= fr.h + 1e-6) opts.push({ rot: true, ow: ph, oh: pw });
      for (let oi = 0; oi < opts.length; oi++) {
        const o = opts[oi];
        const left = fr.w * fr.h - o.ow * o.oh;
        const shortSide = Math.min(fr.w - o.ow, fr.h - o.oh);
        if (!best || left < best.left - 1e-9 ||
            (Math.abs(left - best.left) < 1e-9 && shortSide < best.shortSide)) {
          best = { fi: fi, fr: fr, o: o, left: left, shortSide: shortSide };
        }
      }
    }
    if (!best) return false;
    const fr = best.fr;
    const o = best.o;
    sheet.blocks.push({
      x: fr.x,
      y: fr.y,
      w: o.rot ? piece.w : piece.l,
      h: o.rot ? piece.l : piece.w,
      rot: o.rot,
      spec: piece.spec
    });
    sheet.free.splice(best.fi, 1);
    const rw = fr.w - o.ow;
    const rh = fr.h - o.oh;
    if (rw > 1e-6 && rh > 1e-6) {
      if (rw >= rh) {
        sheet.free.push({ x: fr.x + o.ow, y: fr.y, w: rw, h: fr.h });
        sheet.free.push({ x: fr.x, y: fr.y + o.oh, w: o.ow, h: rh });
      } else {
        sheet.free.push({ x: fr.x, y: fr.y + o.oh, w: fr.w, h: rh });
        sheet.free.push({ x: fr.x + o.ow, y: fr.y, w: rw, h: o.oh });
      }
    } else if (rw > 1e-6) {
      sheet.free.push({ x: fr.x + o.ow, y: fr.y, w: rw, h: fr.h });
    } else if (rh > 1e-6) {
      sheet.free.push({ x: fr.x, y: fr.y + o.oh, w: fr.w, h: rh });
    }
    return true;
  },

  // 按需求数量装板：面积降序 + 首次适配
  mixPack(W, H, specs, kerf) {
    const pieces = [];
    specs.forEach((s, si) => {
      for (let i = 0; i < s.qty; i++) {
        pieces.push({ l: s.l, w: s.w, spec: si, area: s.l * s.w });
      }
    });
    pieces.sort((a, b) => b.area - a.area);
    const sheets = [];
    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i];
      let placed = false;
      for (let si = 0; si < sheets.length && !placed; si++) {
        placed = this.placePiece(sheets[si], piece, kerf);
      }
      if (placed) continue;
      const fits = (piece.l + kerf <= W + 1e-6 && piece.w + kerf <= H + 1e-6) ||
                   (piece.w + kerf <= W + 1e-6 && piece.l + kerf <= H + 1e-6);
      if (!fits) {
        return { error: "规格" + (piece.spec + 1) + "（" + this.formatNum(piece.l) + "×" + this.formatNum(piece.w) + "）放不进板材" };
      }
      const sheet = { blocks: [], free: [{ x: 0, y: 0, w: W, h: H }] };
      sheets.push(sheet);
      if (!this.placePiece(sheet, piece, kerf)) {
        return { error: "规格" + (piece.spec + 1) + " 排样失败" };
      }
    }
    return { pieces: pieces, sheets: sheets };
  },

  runMixCut(W, H, specs, kerf, kerfHint) {
    const packed = this.mixPack(W, H, specs, kerf);
    if (packed.error) {
      wx.showToast({ title: packed.error, icon: "none", duration: 2500 });
      return;
    }
    const sheets = packed.sheets;
    if (!sheets.length) {
      wx.showToast({ title: "无法放置任何一块", icon: "none" });
      return;
    }
    let cutArea = 0;
    packed.pieces.forEach((p) => { cutArea += p.area; });
    const totalArea = sheets.length * W * H;
    const ratio = (cutArea / totalArea * 100).toFixed(1);
    const sheetList = [];
    for (let i = 0; i < sheets.length; i++) {
      const sh = sheets[i];
      let used = 0;
      sh.blocks.forEach((b) => { used += b.w * b.h; });
      sheetList.push({
        idx: i + 1,
        blocks: sh.blocks.length,
        ratio: (used / (W * H) * 100).toFixed(1)
      });
    }
    const legendSpecs = [];
    for (let i = 0; i < specs.length; i++) {
      legendSpecs.push({
        color: this.specColor(i),
        label: "规格" + (i + 1) + " " + this.formatNum(specs[i].l) + "×" + this.formatNum(specs[i].w),
        count: specs[i].qty
      });
    }
    this.setData({
      showResult: true,
      mixMode: true,
      count: packed.pieces.length,
      mode: "混排 " + sheets.length + " 张板",
      ratio: ratio,
      waste: (totalArea - cutArea).toLocaleString("zh-CN"),
      cutMsg: kerfHint || "",
      cutMsgWarn: false,
      targetShow: "",
      sheetCount: sheets.length,
      sheetList: sheetList,
      mixPage: 1,
      mixTotal: sheets.length,
      legendSpecs: legendSpecs,
      canvasHeight: 0
    });
    setTimeout(() => this.initMixCanvasAndDraw(sheets, W, H), 120);
    setTimeout(() => this.scrollToResult("#resultCard"), 620);
  },

  initMixCanvasAndDraw(sheets, W, H) {
    const query = wx.createSelectorQuery().in(this);
    query.select("#cutCanvas").fields({ node: true, size: true }).exec((res) => {
      if (res && res[0] && res[0].node) {
        this.canvas = res[0].node;
        this.ctx = this.canvas.getContext("2d");
        this.canvasCssWidth = res[0].width || 320;
        this.drawMixCut(sheets, W, H);
      } else {
        this._retry = (this._retry || 0) + 1;
        if (this._retry <= 6) {
          setTimeout(() => this.initMixCanvasAndDraw(sheets, W, H), 150);
        }
      }
    });
  },

  // 单张板逐页展示：一次只画当前页，块位与编号看得清，不受板数限制
  drawMixCut(sheets, W, H) {
    if (!this.canvas || !this.ctx) {
      this.initMixCanvasAndDraw(sheets, W, H);
      return;
    }
    this._mix = { sheets: sheets, W: W, H: H };
    const total = sheets.length;
    let page = this.data.mixPage || 1;
    if (page < 1) page = 1;
    if (page > total) page = total;
    const sheet = sheets[page - 1];

    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const dpr = info.pixelRatio || 2;
    const cssW = this.canvasCssWidth || 320;
    const drawW = cssW - 28;
    const boxH = Math.min(300, Math.round(drawW * (H / W)));
    const cssH = boxH + 36;
    if (this.data.canvasHeight !== cssH) {
      this.setData({ canvasHeight: cssH }, () => {
        setTimeout(() => this.drawMixCut(sheets, W, H), 30);
      });
      return;
    }
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    this.canvas.width = pw;
    this.canvas.height = ph;
    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, pw, ph);
    ctx.scale(dpr, dpr);

    const scale = Math.min(drawW / W, boxH / H);
    const ox = (cssW - W * scale) / 2;
    const oy = 22;
    let used = 0;
    sheet.blocks.forEach((b) => { used += b.w * b.h; });
    ctx.fillStyle = "#6b7686";
    ctx.font = "12px sans-serif";
    ctx.fillText("板" + page + " · " + sheet.blocks.length + " 块 · 利用率 " + (used / (W * H) * 100).toFixed(1) + "%", 8, 14);

    ctx.strokeStyle = "#1e5eff";
    ctx.lineWidth = 2;
    ctx.strokeRect(ox, oy, W * scale, H * scale);

    sheet.blocks.forEach((b) => {
      const color = this.specColor(b.spec);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(ox + b.x * scale, oy + b.y * scale, b.w * scale, b.h * scale);
      if (b.w * scale > 15 && b.h * scale > 13) {
        ctx.fillStyle = color;
        ctx.font = "11px sans-serif";
        ctx.fillText(String(b.spec + 1), ox + b.x * scale + 3, oy + b.y * scale + 12);
      }
    });
  },

  onMixPrev() {
    const page = (this.data.mixPage || 1) - 1;
    if (page < 1) return;
    this.setData({ mixPage: page });
    if (this._mix) this.drawMixCut(this._mix.sheets, this._mix.W, this._mix.H);
  },

  onMixNext() {
    const total = this.data.mixTotal || 1;
    const page = (this.data.mixPage || 1) + 1;
    if (page > total) return;
    this.setData({ mixPage: page });
    if (this._mix) this.drawMixCut(this._mix.sheets, this._mix.W, this._mix.H);
  },

  // 反算板材长/宽：已知一个方向尺寸，按直排求另一方向最小长度
  minLength(fixedLen, N, bw, bh, kerf) {
    let bestLen = null;
    // 方案A：固定方向排 bh 高（正向块）
    const rows = this.cutNum(fixedLen, bh, kerf);
    if (rows > 0) {
      const cols = Math.ceil(N / rows);
      const len = cols * bw + (cols - 1) * kerf;
      if (bestLen === null || len < bestLen) bestLen = len;
    }
    // 方案B：固定方向排 bw 高（旋转块）
    const rows2 = this.cutNum(fixedLen, bw, kerf);
    if (rows2 > 0) {
      const cols2 = Math.ceil(N / rows2);
      const len2 = cols2 * bh + (cols2 - 1) * kerf;
      if (bestLen === null || len2 < bestLen) bestLen = len2;
    }
    return bestLen;
  },

  // canvas 渲染完成后初始化节点并绘制示意图（真机 wx:if 渲染慢，放宽重试）
  initCanvasAndDraw(blocks, W, H) {
    const query = wx.createSelectorQuery().in(this);
    query.select("#cutCanvas").fields({ node: true, size: true }).exec((res) => {
      if (res && res[0] && res[0].node) {
        this.canvas = res[0].node;
        this.ctx = this.canvas.getContext("2d");
        this.canvasCssWidth = res[0].width || 320;
        this.drawCut(blocks, W, H);
      } else {
        this._retry = (this._retry || 0) + 1;
        if (this._retry <= 6) {
          setTimeout(() => this.initCanvasAndDraw(blocks, W, H), 150);
        }
      }
    });
  },

  // 常规测算：排样 + 展示结果与示意图
  runCut(W, H, bw, bh, kerf, msg, keepMsg, targetText) {
    if ((bw > W && bh > W) && (bw > H && bh > H)) {
      wx.showToast({ title: "块尺寸大于板材，无法切割", icon: "none" });
      return;
    }
    const best = this.bestCut(W, H, bw, bh, kerf);
    if (best.count === 0) {
      wx.showToast({ title: "无法放下任何一块", icon: "none" });
      return;
    }
    const ratio = ((best.count * bw * bh) / (W * H) * 100).toFixed(1);
    const waste = W * H - best.count * bw * bh;
    this.setData({
      showResult: true,
      mixMode: false,
      count: best.count,
      mode: best.mode,
      ratio: ratio,
      waste: waste.toLocaleString("zh-CN"),
      canvasHeight: 0,
      cutMsg: msg || (keepMsg ? this.data.cutMsg : ""),
      cutMsgWarn: !!msg && msg.indexOf("目标块数用于反算") !== -1,
      targetShow: targetText || ""
    });
    // 等 canvas 渲染后初始化节点并绘制
    setTimeout(() => this.initCanvasAndDraw(best.blocks, W, H), 120);
    setTimeout(() => this.scrollToResult("#resultCard"), 620);
  },

  onCut() {
    const d = this.data;
    const W = this.num(d.plateL);
    const H = this.num(d.plateW);
    const thickness = this.num(d.cutThickness);
    // 刀缝留空：按厚度推荐（未填厚度按默认 4mm）
    let kerf = parseFloat(d.kerf);
    let kerfHint = "";
    if (d.kerf === "") {
      kerf = thickness !== null ? this.kerfByThickness(thickness) : 4;
      kerfHint = "刀缝按推荐值 " + kerf + " mm 计" + (thickness !== null ? "（厚度 " + thickness + " mm）" : "（未填厚度）");
    }
    if (!isFinite(kerf) || kerf < 0) kerf = 0;
    const targetN = parseInt(d.targetN, 10);
    const hasTarget = isFinite(targetN) && targetN > 0;

    // 收集已填长宽的规格
    const specs = [];
    (d.blockSpecs || []).forEach((s, i) => {
      const l = this.num(s.l);
      const w = this.num(s.w);
      if (l === null || w === null) return;
      const q = parseInt(s.qty, 10);
      specs.push({ index: i, l: l, w: w, qty: isFinite(q) && q > 0 ? q : null });
    });
    if (specs.length === 0) {
      wx.showToast({ title: "请填写下料长和宽（mm）", icon: "none" });
      return;
    }

    // 多条规格 / 填了数量 → 混排
    const needMix = specs.length > 1 || specs.some((s) => s.qty !== null);
    if (needMix) {
      if (W === null || H === null) {
        wx.showToast({ title: "混排需填写板材长和宽", icon: "none" });
        return;
      }
      for (let i = 0; i < specs.length; i++) {
        if (specs[i].qty === null) {
          wx.showToast({ title: "混排请填写规格" + (specs[i].index + 1) + "的数量", icon: "none", duration: 2500 });
          return;
        }
      }
      this.runMixCut(W, H, specs, kerf, kerfHint);
      return;
    }

    // 单规格：沿用常规测算 / 反算
    const bw = specs[0].l;
    const bh = specs[0].w;
    const missing = (W === null ? 1 : 0) + (H === null ? 1 : 0);

    if (missing === 0) {
      if (hasTarget && d.targetNEdited) {
        this.runCut(W, H, bw, bh, kerf, "⚠ 目标块数用于反算：清空板材长或板材宽后点测算，可反算对应尺寸", false);
      } else {
        this.setData({ targetNEdited: false });
        this.runCut(W, H, bw, bh, kerf, kerfHint, false);
      }
      return;
    }

    if (missing === 1 && hasTarget) {
      const fixed = W === null ? H : W;
      const need = this.minLength(fixed, targetN, bw, bh, kerf);
      if (need === null) {
        wx.showToast({ title: "固定方向的板材尺寸不足以排下任意一块", icon: "none" });
        return;
      }
      const missName = W === null ? "板材长" : "板材宽";
      const missField = W === null ? "plateL" : "plateW";
      const patch = {};
      patch[missField] = String(Math.round(need * 1000) / 1000);
      patch.cutMsg = "✓ 反算" + missName + " = " + this.formatNum(need) + " mm（按目标 " + targetN + " 块，最小需）";
      patch.cutMsgWarn = false;
      this.setData(patch);
      const newW = W === null ? need : W;
      const newH = H === null ? need : H;
      // 反算成功后：清空目标块数、复位颜色，结果区显示目标
      this.setData({ targetN: "", targetNEdited: false });
      this.runCut(newW, newH, bw, bh, kerf, "", true, "（目标 " + targetN + " 块）");
      return;
    }

    if (missing > 1) {
      wx.showToast({ title: "反算时只能留空板材长或板材宽之一", icon: "none" });
      return;
    }

    wx.showToast({ title: "请输入目标块数后再反算", icon: "none" });
  },

  // ---------- 棒/管切割 ----------
  rodRun(L, p, clamp, k, n, msg, keepMsg, targetText) {
    if (n < 1) {
      wx.showToast({ title: "材料长度不足以切出 1 件（含夹持）", icon: "none" });
      return;
    }
    const used = clamp + n * p + (n - 1) * k;
    const tail = Math.max(0, L - used);
    const ratio = ((n * p) / L * 100).toFixed(1);
    this.setData({
      showRodResult: true,
      rodCount: n,
      rodLen: L,
      rodPiece: p,
      rodClamp: clamp,
      rodKerf: k,
      rodUsed: this.formatNum(used),
      rodTail: this.formatNum(tail),
      rodRatio: ratio,
      rodKerfCount: n - 1,
      rodMixMode: false,
      rodCanvasHeight: 0,
      rodMsg: msg || (keepMsg ? this.data.rodMsg : ""),
      rodMsgWarn: !!msg && msg.indexOf("目标件数用于反算") !== -1,
      rodTargetShow: targetText || ""
    });
    setTimeout(() => this.initRodCanvasAndDraw(n, L, p, clamp, k), 120);
    setTimeout(() => this.scrollToResult("#resultCard"), 620);
  },

  initRodCanvasAndDraw(n, L, p, clamp, k) {
    const query = wx.createSelectorQuery().in(this);
    query.select("#rodCanvas").fields({ node: true, size: true }).exec((res) => {
      if (res && res[0] && res[0].node) {
        this.rodCanvas = res[0].node;
        this.rodCtx = this.rodCanvas.getContext("2d");
        this.rodCanvasCssWidth = res[0].width || 320;
        this.drawRod(n, L, p, clamp, k);
      } else {
        this._rodRetry = (this._rodRetry || 0) + 1;
        if (this._rodRetry <= 6) {
          setTimeout(() => this.initRodCanvasAndDraw(n, L, p, clamp, k), 150);
        }
      }
    });
  },

  // 一维切割示意图：夹持段(灰) + 各件(蓝) + 刀缝(细分隔) + 余料(白)
  drawRod(n, L, p, clamp, k) {
    if (!this.rodCanvas || !this.rodCtx) {
      this.initRodCanvasAndDraw(n, L, p, clamp, k);
      return;
    }
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const dpr = info.pixelRatio || 2;
    const cssW = this.rodCanvasCssWidth || 320;
    const cssH = 80;
    // 两段式：先设置 CSS 高度，渲染完成后再次进入真正绘制
    if (this.data.rodCanvasHeight !== cssH) {
      this.setData({ rodCanvasHeight: cssH }, () => {
        setTimeout(() => this.drawRod(n, L, p, clamp, k), 30);
      });
      return;
    }
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    this.rodCanvas.width = pw;
    this.rodCanvas.height = ph;

    const ctx = this.rodCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, pw, ph);
    ctx.scale(dpr, dpr);

    const used = clamp + n * p + (n - 1) * k;
    const tail = Math.max(0, L - used);
    const scale = (cssW - 16) / L;
    let x = 8;
    const y = 26;
    const h = 30;

    const seg = (w, color, border) => {
      const ww = Math.max(w * scale, w > 0 ? 1 : 0);
      ctx.fillStyle = color;
      ctx.fillRect(x, y, ww, h);
      if (border) {
        ctx.strokeStyle = border;
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, ww, h);
      }
      x += ww;
    };

    if (clamp > 0) seg(clamp, "#b8bec9", "#8a93a3");
    for (let i = 0; i < n; i++) {
      seg(p, "#1e5eff");
      if (i < n - 1) {
        const kw = Math.max(k * scale, 1);
        ctx.fillStyle = "#e9edf4";
        ctx.fillRect(x, y, kw, h);
        x += kw;
      }
    }
    if (tail > 0) seg(tail, "#ffffff", "#c3cad6");

    ctx.fillStyle = "#6b7686";
    ctx.font = "11px sans-serif";
    ctx.fillText("夹持 " + this.formatNum(clamp), 8, 20);
    if (tail > 0.5) {
      const tx = 8 + (clamp + n * p + (n - 1) * k) * scale;
      ctx.fillText("余料 " + this.formatNum(tail), Math.min(tx, cssW - 70), cssH - 8);
    }
  },

  // ---------- 多规格混排（棒/管 一维切割） ----------
  // 按需求装棒：长度降序 + best-fit（选剩余最短且够长的棒）
  rodMixPack(L, specs, clamp, k) {
    const pieces = [];
    specs.forEach((s, si) => {
      for (let i = 0; i < s.qty; i++) pieces.push({ len: s.len, spec: si });
    });
    pieces.sort((a, b) => b.len - a.len);
    const bars = [];
    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i];
      let bestBar = -1;
      let bestRest = Infinity;
      for (let bi = 0; bi < bars.length; bi++) {
        const bar = bars[bi];
        if (bar.end + piece.len <= L + 1e-6) {
          const rest = L - (bar.end + piece.len);
          if (rest < bestRest) {
            bestRest = rest;
            bestBar = bi;
          }
        }
      }
      if (bestBar >= 0) {
        const bar = bars[bestBar];
        bar.segs.push({ len: piece.len, spec: piece.spec });
        bar.end += piece.len + k;
        continue;
      }
      if (clamp + piece.len > L + 1e-6) {
        return { error: "规格" + (piece.spec + 1) + "（" + this.formatNum(piece.len) + " mm）超过材料可切长度" };
      }
      bars.push({ segs: [{ len: piece.len, spec: piece.spec }], end: clamp + piece.len + k });
    }
    return { pieces: pieces, bars: bars };
  },

  runRodMixCut(L, specs, clamp, k, hints) {
    const packed = this.rodMixPack(L, specs, clamp, k);
    if (packed.error) {
      wx.showToast({ title: packed.error, icon: "none", duration: 2500 });
      return;
    }
    const bars = packed.bars;
    if (!bars.length) {
      wx.showToast({ title: "无法切出任何一段", icon: "none" });
      return;
    }
    let sumLen = 0;
    packed.pieces.forEach((p) => { sumLen += p.len; });
    const ratio = (sumLen / (bars.length * L) * 100).toFixed(1);
    const barList = [];
    for (let i = 0; i < bars.length; i++) {
      const bar = bars[i];
      const used = bar.end - k;
      const tail = Math.max(0, L - used);
      barList.push({
        idx: i + 1,
        count: bar.segs.length,
        tail: this.formatNum(tail),
        used: this.formatNum(used)
      });
    }
    const legendRodSpecs = [];
    for (let i = 0; i < specs.length; i++) {
      legendRodSpecs.push({
        color: this.specColor(i),
        label: "规格" + (i + 1) + " " + this.formatNum(specs[i].len) + " mm",
        count: specs[i].qty
      });
    }
    this.setData({
      showRodResult: true,
      rodMixMode: true,
      rodMixCount: packed.pieces.length,
      rodBarCount: bars.length,
      rodBarList: barList,
      rodPage: 1,
      rodTotal: bars.length,
      legendRodSpecs: legendRodSpecs,
      rodLen: L,
      rodClamp: clamp,
      rodKerf: k,
      rodRatio: ratio,
      rodMsg: (hints || []).join("；"),
      rodMsgWarn: false,
      rodTargetShow: "",
      rodCanvasHeight: 0
    });
    setTimeout(() => this.initRodMixCanvasAndDraw(bars, L, clamp, k), 120);
    setTimeout(() => this.scrollToResult("#resultCard"), 620);
  },

  initRodMixCanvasAndDraw(bars, L, clamp, k) {
    const query = wx.createSelectorQuery().in(this);
    query.select("#rodCanvas").fields({ node: true, size: true }).exec((res) => {
      if (res && res[0] && res[0].node) {
        this.rodCanvas = res[0].node;
        this.rodCtx = this.rodCanvas.getContext("2d");
        this.rodCanvasCssWidth = res[0].width || 320;
        this.drawRodMix(bars, L, clamp, k);
      } else {
        this._rodRetry = (this._rodRetry || 0) + 1;
        if (this._rodRetry <= 6) {
          setTimeout(() => this.initRodMixCanvasAndDraw(bars, L, clamp, k), 150);
        }
      }
    });
  },

  // 单根棒/管逐页展示：一次只画当前页，段位与余料看得清，不受根数限制
  drawRodMix(bars, L, clamp, k) {
    if (!this.rodCanvas || !this.rodCtx) {
      this.initRodMixCanvasAndDraw(bars, L, clamp, k);
      return;
    }
    this._rodMix = { bars: bars, L: L, clamp: clamp, k: k };
    const total = bars.length;
    let page = this.data.rodPage || 1;
    if (page < 1) page = 1;
    if (page > total) page = total;
    const bar = bars[page - 1];

    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const dpr = info.pixelRatio || 2;
    const cssW = this.rodCanvasCssWidth || 320;
    const cssH = 92;
    if (this.data.rodCanvasHeight !== cssH) {
      this.setData({ rodCanvasHeight: cssH }, () => {
        setTimeout(() => this.drawRodMix(bars, L, clamp, k), 30);
      });
      return;
    }
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    this.rodCanvas.width = pw;
    this.rodCanvas.height = ph;
    const ctx = this.rodCtx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, pw, ph);
    ctx.scale(dpr, dpr);

    const scale = (cssW - 16) / L;
    const barH = 30;
    const y = 30;
    let x = 8;
    const used = bar.end - k;
    const tail = Math.max(0, L - used);
    ctx.fillStyle = "#6b7686";
    ctx.font = "12px sans-serif";
    ctx.fillText("棒" + page + " · " + bar.segs.length + " 段 · 占用 " + this.formatNum(used) + " mm · 余料 " + this.formatNum(tail) + " mm", 8, 14);

    if (clamp > 0) {
      const ww = Math.max(clamp * scale, 1);
      ctx.fillStyle = "#b8bec9";
      ctx.fillRect(x, y, ww, barH);
      x += ww;
    }
    for (let i = 0; i < bar.segs.length; i++) {
      const s = bar.segs[i];
      const ww = Math.max(s.len * scale, 1);
      ctx.strokeStyle = this.specColor(s.spec);
      ctx.lineWidth = 1.2;
      ctx.strokeRect(x, y, ww, barH);
      if (ww > 14) {
        ctx.fillStyle = this.specColor(s.spec);
        ctx.font = "11px sans-serif";
        ctx.fillText(String(s.spec + 1), x + 3, y + barH / 2 + 4);
      }
      x += ww;
      if (i < bar.segs.length - 1) {
        const kw = Math.max(k * scale, 1);
        ctx.fillStyle = "#e9edf4";
        ctx.fillRect(x, y, kw, barH);
        x += kw;
      }
    }
    if (tail > 0.5) {
      const ww = Math.max(tail * scale, 1);
      ctx.strokeStyle = "#c3cad6";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, ww, barH);
    }
  },

  onRodMixPrev() {
    const page = (this.data.rodPage || 1) - 1;
    if (page < 1) return;
    this.setData({ rodPage: page });
    if (this._rodMix) this.drawRodMix(this._rodMix.bars, this._rodMix.L, this._rodMix.clamp, this._rodMix.k);
  },

  onRodMixNext() {
    const total = this.data.rodTotal || 1;
    const page = (this.data.rodPage || 1) + 1;
    if (page > total) return;
    this.setData({ rodPage: page });
    if (this._rodMix) this.drawRodMix(this._rodMix.bars, this._rodMix.L, this._rodMix.clamp, this._rodMix.k);
  },

  // 结果区不在屏幕内时才平滑滚动过去；已可见则不打扰
  scrollToResult(sel) {
    const q = wx.createSelectorQuery();
    q.select(sel).boundingClientRect();
    q.selectViewport().scrollOffset();
    q.exec((res) => {
      if (!res || !res[0] || !res[1]) return;
      const rect = res[0];
      if (!rect || !rect.height) return;
      const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
      const vh = info.windowHeight || 600;
      // 结果区顶部还没进入视口上部区域才滚；已可见或已滚到上方都不打扰
      if (!(rect.top > vh * 0.55)) return;
      const top = Math.max(0, rect.top + res[1].scrollTop - 10);
      wx.pageScrollTo({ scrollTop: top, duration: 400 });
    });
  },

  onRodCut() {
    const d = this.data;
    const L = this.rodNum(d.rodLen);
    const dia = this.rodNum(d.rodDia);
    let k = parseFloat(d.rodKerf);
    if (!isFinite(k) || k < 0) k = 0;
    let clamp = parseFloat(d.rodClamp);
    if (!isFinite(clamp) || clamp < 0) clamp = 20;
    // 夹持/刀缝留空：按直径推荐（未填直径用默认值）
    const hints = [];
    if (d.rodClamp === "") {
      clamp = dia !== null ? this.clampByDia(dia) : 20;
      hints.push("夹持按推荐值 " + clamp + " mm 计" + (dia !== null ? "（直径 " + dia + " mm）" : "（未填直径）"));
    }
    if (d.rodKerf === "") {
      k = dia !== null ? this.kerfByDia(dia) : 3;
      hints.push("刀缝按推荐值 " + k + " mm 计" + (dia !== null ? "（直径 " + dia + " mm）" : "（未填直径）"));
    }
    const targetN = parseInt(d.rodTargetN, 10);
    const hasTarget = isFinite(targetN) && targetN > 0;

    // 收集已填长度的规格
    const specs = [];
    (d.rodSpecs || []).forEach((s, i) => {
      const len = this.rodNum(s.len);
      if (len === null) return;
      const q = parseInt(s.qty, 10);
      specs.push({ index: i, len: len, qty: isFinite(q) && q > 0 ? q : null });
    });
    if (specs.length === 0) {
      wx.showToast({ title: "请填写下料长度（mm）", icon: "none" });
      return;
    }

    // 多条规格 / 填了数量 → 一维混排
    const needMix = specs.length > 1 || specs.some((s) => s.qty !== null);
    if (needMix) {
      if (L === null) {
        wx.showToast({ title: "混排需填写材料长度", icon: "none" });
        return;
      }
      for (let i = 0; i < specs.length; i++) {
        if (specs[i].qty === null) {
          wx.showToast({ title: "混排请填写规格" + (specs[i].index + 1) + "的数量", icon: "none", duration: 2500 });
          return;
        }
      }
      this.runRodMixCut(L, specs, clamp, k, hints);
      return;
    }

    const p = specs[0].len;

    // 反算：按目标件数调整材料长度
    if (hasTarget) {
      if (p === null) {
        wx.showToast({ title: "请填写单件长度（mm）后反算材料长度", icon: "none" });
        return;
      }
      const need = clamp + targetN * p + (targetN - 1) * k;
      this.setData({
        rodLen: String(Math.round(need * 1000) / 1000),
        rodMsg: "✓ 反算材料长度 = " + this.formatNum(need) + " mm（按目标 " + targetN + " 件）",
        rodMsgWarn: false
      });
      // 反算成功后：清空目标件数、复位颜色，结果区显示目标
      this.setData({ rodTargetN: "", rodTargetNEdited: false });
      this.rodRun(need, p, clamp, k, targetN, "", true, "（目标 " + targetN + " 件）");
      return;
    }

    // 常规测算
    if (L === null || p === null) {
      wx.showToast({ title: "请填写材料长度和单件长度（mm）", icon: "none" });
      return;
    }
    if (L < clamp + p) {
      wx.showToast({ title: "材料长度不足以切出 1 件（需 ≥ " + this.formatNum(clamp + p) + " mm）", icon: "none" });
      return;
    }
    this.setData({ rodTargetNEdited: false });
    const n = Math.floor((L - clamp + k) / (p + k));
    this.rodRun(L, p, clamp, k, n, hints.join("；"), false);
  },

  drawCut(blocks, W, H) {
    if (!this.canvas || !this.ctx) {
      // canvas 未就绪：重新查询节点
      this.initCanvasAndDraw(blocks, W, H);
      return;
    }
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    const dpr = info.pixelRatio || 2;
    const cssW = this.canvasCssWidth || 320;
    const ratio = H / W;
    const pw = Math.round(cssW * dpr);
    const ph = Math.max(200, Math.round(pw * ratio));
    const cssH = Math.round(ph / dpr);
    // 两段式：先设置 CSS 高度，等渲染完成后再次进入真正绘制（避免高度为 0 画了看不见）
    if (this.data.canvasHeight !== cssH) {
      this.setData({ canvasHeight: cssH }, () => {
        setTimeout(() => this.drawCut(blocks, W, H), 30);
      });
      return;
    }
    this.canvas.width = pw;
    this.canvas.height = ph;

    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, pw, ph);
    ctx.scale(dpr, dpr);

    const baseW = cssW;
    const baseH = ph / dpr;
    const pad = 20;
    const scale = Math.min((baseW - pad * 2) / W, (baseH - pad * 2) / H);
    const ox = (baseW - W * scale) / 2;
    const oy = (baseH - H * scale) / 2;

    // 板材外框
    ctx.strokeStyle = "#1e5eff";
    ctx.lineWidth = 2;
    ctx.strokeRect(ox, oy, W * scale, H * scale);

    // 每个块（旋转块橙色虚线，正向块蓝色实线）
    blocks.forEach((b) => {
      ctx.beginPath();
      ctx.strokeStyle = b.rot ? "#f08c00" : "#3a66d8";
      ctx.lineWidth = 1.2;
      ctx.setLineDash(b.rot ? [3, 3] : []);
      ctx.strokeRect(ox + b.x * scale, oy + b.y * scale, b.w * scale, b.h * scale);
    });
    ctx.setLineDash([]);
  }
});
