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
      { keys: ["下料长度", "下料长"], field: "rodPiece", label: "下料长度" },
      { keys: ["长度", "长"], field: "rodLen", label: "长度" },
      { keys: ["直径", "径"], field: "rodDia", label: "直径" },
      { keys: ["夹持"], field: "rodClamp", label: "夹持" },
      { keys: ["刀缝", "缝"], field: "rodKerf", label: "刀缝" }
    ];
  }
  return [
    { keys: ["下料长"], field: "blockL", label: "下料长" },
    { keys: ["下料宽"], field: "blockW", label: "下料宽" },
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
    blockL: "",
    blockW: "",
    kerf: "",
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

    // 切割类型与棒/管
    cutType: "plate", // plate | rod
    rodLen: "",
    rodDia: "",
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
    voiceState: "idle",
    voiceText: "",
    voiceTip: ""
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

  // canvas 渲染完成后初始化节点并绘制示意图
  initCanvasAndDraw(blocks, W, H) {
    const query = wx.createSelectorQuery().in(this);
    query.select("#cutCanvas").fields({ node: true, size: true }).exec((res) => {
      if (res && res[0] && res[0].node) {
        this.canvas = res[0].node;
        this.ctx = this.canvas.getContext("2d");
        this.canvasCssWidth = res[0].width;
        this.drawCut(blocks, W, H);
      } else {
        // 节点尚未渲染（wx:if 刚置 true），稍后重试
        this._retry = (this._retry || 0) + 1;
        if (this._retry <= 3) {
          setTimeout(() => this.initCanvasAndDraw(blocks, W, H), 120);
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
  },

  onCut() {
    const d = this.data;
    const W = this.num(d.plateL);
    const H = this.num(d.plateW);
    const bw = this.num(d.blockL);
    const bh = this.num(d.blockW);
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

    if (bw === null || bh === null) {
      wx.showToast({ title: "请填写块长和块宽（mm）", icon: "none" });
      return;
    }

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
      rodCanvasHeight: 0,
      rodMsg: msg || (keepMsg ? this.data.rodMsg : ""),
      rodMsgWarn: !!msg && msg.indexOf("目标件数用于反算") !== -1,
      rodTargetShow: targetText || ""
    });
    setTimeout(() => this.initRodCanvasAndDraw(n, L, p, clamp, k), 120);
  },

  initRodCanvasAndDraw(n, L, p, clamp, k) {
    const query = wx.createSelectorQuery().in(this);
    query.select("#rodCanvas").fields({ node: true, size: true }).exec((res) => {
      if (res && res[0] && res[0].node) {
        this.rodCanvas = res[0].node;
        this.rodCtx = this.rodCanvas.getContext("2d");
        this.rodCanvasCssWidth = res[0].width;
        this.drawRod(n, L, p, clamp, k);
      } else {
        this._rodRetry = (this._rodRetry || 0) + 1;
        if (this._rodRetry <= 3) {
          setTimeout(() => this.initRodCanvasAndDraw(n, L, p, clamp, k), 120);
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
    const pw = Math.round(cssW * dpr);
    const ph = Math.round(cssH * dpr);
    this.rodCanvas.width = pw;
    this.rodCanvas.height = ph;
    this.setData({ rodCanvasHeight: cssH });

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

  onRodCut() {
    const d = this.data;
    const L = this.rodNum(d.rodLen);
    const p = this.rodNum(d.rodPiece);
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
    this.canvas.width = pw;
    this.canvas.height = ph;
    this.setData({ canvasHeight: Math.round(ph / dpr) });

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
  },

  // 意见反馈：打开微信客服会话
  onFeedbackTap() {
    wx.openCustomerServiceChat({
      extInfo: { url: "" },
      success: () => {},
      fail: () => {
        wx.showModal({
          title: "意见反馈",
          content: "客服暂未开通。可在小程序后台「功能 → 客服」添加客服微信；或先直接联系 ADV 客服。",
          showCancel: false
        });
      }
    });
  }
});
