const MATERIALS = [
  { name: "PTFE 聚四氟乙烯", density: 2.20 },
  { name: "PFA 全氟烷氧基树脂", density: 2.15 },
  { name: "PVDF 聚偏氟乙烯", density: 1.78 },
  { name: "PEEK 聚醚醚酮", density: 1.32 },
  { name: "PPS 聚苯硫醚", density: 1.35 },
  { name: "PI 聚酰亚胺", density: 1.40 },
  { name: "POM 聚甲醛（赛钢）", density: 1.41 },
  { name: "PA6 尼龙6", density: 1.14 },
  { name: "PA66 尼龙66", density: 1.15 },
  { name: "MC尼龙（铸型尼龙）", density: 1.16 },
  { name: "PC 聚碳酸酯", density: 1.20 },
  { name: "PMMA 亚克力", density: 1.19 },
  { name: "ABS", density: 1.05 },
  { name: "HDPE 高密度聚乙烯", density: 0.96 },
  { name: "UHMWPE 超高分子量聚乙烯", density: 0.93 },
  { name: "PP 聚丙烯", density: 0.91 },
  { name: "PVC 硬质聚氯乙烯", density: 1.45 }
];

Page({
  data: {
    activeTab: "weight",
    materials: MATERIALS,
    materialIndex: 0,
    materialName: "PTFE 聚四氟乙烯",
    density: "2.20",
    shape: "plate",
    tubeMode: "od-id",
    plateL: "",
    plateW: "",
    plateT: "",
    rodD: "",
    rodL: "",
    tubeOd: "",
    tubeId: "",
    tubeL: "",
    tubeOd2: "",
    tubeWall: "",
    tubeL2: "",
    price: "",
    qty: "1",
    showResult: false,
    volume: "-",
    totalWeight: "-",
    cost: "-",
    formula: "",
    hasCost: false,
    solveWeight: "",
    solveWeightEdited: false,
    solveMsg: "",
    solveMsgWarn: false
  },

  onMaterialChange(e) {
    const i = Number(e.detail.value);
    const m = MATERIALS[i];
    this.setData({ materialIndex: i, materialName: m.name, density: String(m.density) });
  },

  onDensityInput(e) {
    this.setData({ density: e.detail.value });
  },

  onShapeTap(e) {
    this.setData({ shape: e.currentTarget.dataset.shape, solveMsg: "", solveMsgWarn: false });
  },

  onTubeModeTap(e) {
    this.setData({ tubeMode: e.currentTarget.dataset.mode, solveMsg: "", solveMsgWarn: false });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: e.detail.value });
  },

  onSolveWeightInput(e) {
    this.setData({
      solveWeight: e.detail.value,
      solveWeightEdited: true,
      solveMsg: "",
      solveMsgWarn: false
    });
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

  // 收集当前形态尺寸（value 为 null 表示留空待反算）
  collectDims() {
    const d = this.data;
    if (d.shape === "plate") {
      return [
        { key: "L", field: "plateL", label: "长度", value: this.num(d.plateL) },
        { key: "W", field: "plateW", label: "宽度", value: this.num(d.plateW) },
        { key: "T", field: "plateT", label: "厚度", value: this.num(d.plateT) }
      ];
    }
    if (d.shape === "rod") {
      return [
        { key: "D", field: "rodD", label: "直径", value: this.num(d.rodD) },
        { key: "L", field: "rodL", label: "长度", value: this.num(d.rodL) }
      ];
    }
    if (d.tubeMode === "od-wall") {
      return [
        { key: "OD", field: "tubeOd2", label: "外径", value: this.num(d.tubeOd2) },
        { key: "WALL", field: "tubeWall", label: "壁厚", value: this.num(d.tubeWall) },
        { key: "L", field: "tubeL2", label: "长度", value: this.num(d.tubeL2) }
      ];
    }
    return [
      { key: "OD", field: "tubeOd", label: "外径", value: this.num(d.tubeOd) },
      { key: "ID", field: "tubeId", label: "内径", value: this.num(d.tubeId) },
      { key: "L", field: "tubeL", label: "长度", value: this.num(d.tubeL) }
    ];
  },

  // 计算入口（双模式）
  onCalc() {
    const d = this.data;
    const density = parseFloat(d.density);
    if (!isFinite(density) || density <= 0) {
      wx.showToast({ title: "请填写有效的密度值", icon: "none" });
      return;
    }

    const dims = this.collectDims();
    const missing = dims.filter(x => x.value === null);
    const tWeight = parseFloat(d.solveWeight);
    const hasTarget = isFinite(tWeight) && tWeight > 0;

    if (missing.length === 0) {
      // 尺寸齐全：若用户已修改目标重量（橙色），提示留空变量，不覆盖目标值
      if (hasTarget && d.solveWeightEdited) {
        this.setData({
          solveMsg: "⚠ 反算需留空一个尺寸（长/宽/厚/直径/长度…）再点计算；或清空单件重量进行常规计算",
          solveMsgWarn: true
        });
        return;
      }
      // 常规模式：尺寸齐全 → 计算重量
      this.calcNormal(density, false);
    } else if (missing.length === 1 && hasTarget) {
      // 反算模式：留空一个变量 + 目标重量 → 反算该变量
      this.solveMissing(dims, missing[0], tWeight, density);
    } else if (missing.length > 1) {
      wx.showToast({ title: "反算时只能留空一个变量", icon: "none" });
    } else {
      wx.showToast({ title: "请输入目标单件重量后再反算", icon: "none" });
    }
  },

  // 常规计算
  calcNormal(density, keepEdited) {
    const d = this.data;
    let volume = 0;
    let formula = "";

    if (d.shape === "plate") {
      const l = this.num(d.plateL);
      const w = this.num(d.plateW);
      const t = this.num(d.plateT);
      if (l === null || w === null || t === null) {
        wx.showToast({ title: "请完整填写板材的长、宽、厚（mm）", icon: "none" });
        return;
      }
      volume = (l * w * t) / 1000;
      formula = "体积 = 长×宽×厚 = " + l + "×" + w + "×" + t + " mm³\n      = " + this.formatNum(volume) + " cm³";
    } else if (d.shape === "rod") {
      const dd = this.num(d.rodD);
      const ll = this.num(d.rodL);
      if (dd === null || ll === null) {
        wx.showToast({ title: "请完整填写棒材的直径和长度（mm）", icon: "none" });
        return;
      }
      volume = (Math.PI * dd * dd * ll) / 4000;
      formula = "体积 = π×(直径/2)²×长度 = π×(" + dd + "/2)²×" + ll + " mm³\n      = " + this.formatNum(volume) + " cm³";
    } else {
      let od;
      let idv;
      let tl;
      if (d.tubeMode === "od-wall") {
        od = this.num(d.tubeOd2);
        const wall = this.num(d.tubeWall);
        tl = this.num(d.tubeL2);
        if (od === null || wall === null || tl === null) {
          wx.showToast({ title: "请完整填写管材的外径、壁厚和长度（mm）", icon: "none" });
          return;
        }
        if (od <= 2 * wall) {
          wx.showToast({ title: "外径必须大于两倍壁厚", icon: "none" });
          return;
        }
        idv = od - 2 * wall;
        volume = (Math.PI * (od * od - idv * idv) * tl) / 4000;
        formula = "内径 = 外径-2×壁厚 = " + od + "-2×" + wall + " = " + this.formatNum(idv) + " mm\n" +
          "体积 = π×[(外径/2)²-(内径/2)²]×长度\n      = π×[(" + od + "/2)²-(" + idv + "/2)²]×" + tl + " mm³\n      = " + this.formatNum(volume) + " cm³";
      } else {
        od = this.num(d.tubeOd);
        idv = this.num(d.tubeId);
        tl = this.num(d.tubeL);
        if (od === null || idv === null || tl === null) {
          wx.showToast({ title: "请完整填写管材的外径、内径和长度（mm）", icon: "none" });
          return;
        }
        if (idv >= od) {
          wx.showToast({ title: "内径必须小于外径", icon: "none" });
          return;
        }
        volume = (Math.PI * (od * od - idv * idv) * tl) / 4000;
        formula = "体积 = π×[(外径/2)²-(内径/2)²]×长度\n      = π×[(" + od + "/2)²-(" + idv + "/2)²]×" + tl + " mm³\n      = " + this.formatNum(volume) + " cm³";
      }
    }

    const weightKg = (volume * density) / 1000;
    const qty = Math.max(1, parseInt(d.qty, 10) || 1);
    const totalW = weightKg * qty;
    const price = parseFloat(d.price);
    const hasPrice = isFinite(price) && price > 0;
    const cost = hasPrice ? totalW * price : null;

    let finalFormula =
      d.materialName + " · 密度 " + density + " g/cm³\n" + formula + "\n" +
      "重量 = 体积×密度 = " + this.formatNum(volume) + "×" + density + " g\n      = " + this.formatNum(weightKg) + " kg" +
      (qty > 1 ? "（×" + qty + " 件）" : "") +
      (hasPrice ? "\n成本 = 总重×单价 = " + this.formatNum(totalW) + "×" + this.formatNum(price) + " 元\n      = " + this.formatNum(cost) + " 元" : "");

    const patch = {
      showResult: true,
      volume: this.formatNum(volume),
      totalWeight: this.formatNum(totalW),
      cost: hasPrice ? this.formatNum(cost) : "-",
      hasCost: hasPrice,
      formula: finalFormula,
      solveWeight: String(Math.round(weightKg * 1000) / 1000)
    };
    // 常规模式：橙色标记清除；反算联动：保留橙色
    if (!keepEdited) {
      patch.solveWeightEdited = false;
      patch.solveMsg = "";
      patch.solveMsgWarn = false;
    }
    this.setData(patch);
  },

  // 反算：按目标重量解出留空的变量
  solveMissing(dims, miss, tWeight, density) {
    const V = (tWeight * 1000) / density; // 目标体积 cm³
    const known = {};
    dims.forEach(x => { known[x.key] = x.value; });
    let result = 0;

    if (this.data.shape === "plate") {
      if (miss.key === "L") {
        result = (V * 1000) / (known.W * known.T);
      } else if (miss.key === "W") {
        result = (V * 1000) / (known.L * known.T);
      } else {
        result = (V * 1000) / (known.L * known.W);
      }
    } else if (this.data.shape === "rod") {
      if (miss.key === "D") {
        result = Math.sqrt((4000 * V) / (Math.PI * known.L));
      } else {
        result = (4000 * V) / (Math.PI * known.D * known.D);
      }
    } else if (this.data.tubeMode === "od-wall") {
      if (miss.key === "OD") {
        result = (1000 * V) / (Math.PI * known.L * known.WALL) + known.WALL;
      } else if (miss.key === "WALL") {
        const sq = known.OD * known.OD - (4000 * V) / (Math.PI * known.L);
        if (sq <= 0) {
          wx.showToast({ title: "该重量在此外径和长度下无法实现", icon: "none" });
          return;
        }
        result = (known.OD - Math.sqrt(sq)) / 2;
      } else {
        const denom = 4 * known.WALL * (known.OD - known.WALL);
        if (denom <= 0) {
          wx.showToast({ title: "外径需大于两倍壁厚", icon: "none" });
          return;
        }
        result = (4000 * V) / (Math.PI * denom);
      }
    } else {
      if (miss.key === "OD") {
        result = Math.sqrt(known.ID * known.ID + (4000 * V) / (Math.PI * known.L));
      } else if (miss.key === "ID") {
        const sq2 = known.OD * known.OD - (4000 * V) / (Math.PI * known.L);
        if (sq2 <= 0) {
          wx.showToast({ title: "该重量在此外径和长度下无法实现", icon: "none" });
          return;
        }
        result = Math.sqrt(sq2);
      } else {
        const d2 = known.OD * known.OD - known.ID * known.ID;
        if (d2 <= 0) {
          wx.showToast({ title: "外径必须大于内径", icon: "none" });
          return;
        }
        result = (4000 * V) / (Math.PI * d2);
      }
    }

    // 填回留空的变量
    const patch = {};
    patch[miss.field] = String(Math.round(result * 1000) / 1000);
    patch.solveMsg = "✓ 反算" + miss.label + " = " + this.formatNum(result) + " mm（按目标 " + this.formatNum(tWeight) + " kg）";
    patch.solveMsgWarn = false;
    this.setData(patch);
    // 联动刷新重量显示（保留结果消息）
    this.calcNormal(density, true);
    // 反算成功自动复位：单件重量回归常规色，下次默认常规计算
    this.setData({ solveWeightEdited: false });
  },

  onCopy() {
    const d = this.data;
    if (!d.showResult) return;
    const lines = [
      "【ADV小助手】工程塑料重量计算",
      "材料: " + d.materialName + "（密度 " + d.density + " g/cm³）",
      "单件体积: " + d.volume + " cm³",
      "单件重量: " + d.solveWeight + " kg",
      "总重量: " + d.totalWeight + " kg"
    ];
    if (d.hasCost) lines.push("材料成本: " + d.cost + " 元");
    wx.setClipboardData({
      data: lines.join("\n"),
      success: function () {
        wx.showToast({ title: "已复制", icon: "success" });
      }
    });
  },

  // 页签切换：切割页签跳转板棒材切割测算
  onTabTap(e) {
    const t = e.currentTarget.dataset.tab;
    if (t === "cut") {
      wx.navigateTo({ url: "/pages/cut/index" });
    } else {
      this.setData({ activeTab: "weight" });
    }
  }
});
