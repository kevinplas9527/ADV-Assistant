Page({
  data: {
    plateL: "",
    plateW: "",
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
    canvasHeight: 0
  },

  onReady() {
    // 注意：canvas 在 wx:if 内，首次进入尚未渲染，此处仅做预初始化（拿不到节点也正常）
    this.initCanvas();
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
    let kerf = parseFloat(d.kerf);
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
        this.runCut(W, H, bw, bh, kerf, "", false);
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
  }
});
