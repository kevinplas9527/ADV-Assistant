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
    weight: "-",
    totalWeight: "-",
    cost: "-",
    formula: "",
    hasCost: false,
    solveWeight: "",
    solveWeightTouched: false,
    solveResult: "",
    solveVars: []
  },

  onLoad() {
    this.buildSolveVars();
  },

  buildSolveVars() {
    const map = {
      "plate": [{ key: "L", label: "反算长" }, { key: "W", label: "反算宽" }, { key: "T", label: "反算厚" }],
      "rod": [{ key: "D", label: "反算直径" }, { key: "L", label: "反算长度" }],
      "tube-od-id": [{ key: "OD", label: "反算外径" }, { key: "ID", label: "反算内径" }, { key: "L", label: "反算长度" }],
      "tube-od-wall": [{ key: "OD", label: "反算外径" }, { key: "WALL", label: "反算壁厚" }, { key: "L", label: "反算长度" }]
    };
    const k = this.data.shape === "tube" ? "tube-" + this.data.tubeMode : this.data.shape;
    this.setData({ solveVars: map[k], solveResult: "" });
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
    this.setData({ shape: e.currentTarget.dataset.shape });
    this.buildSolveVars();
  },

  onTubeModeTap(e) {
    this.setData({ tubeMode: e.currentTarget.dataset.mode });
    this.buildSolveVars();
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: e.detail.value });
  },

  onSolveWeightInput(e) {
    this.setData({ solveWeight: e.detail.value, solveWeightTouched: true, solveResult: "" });
  },

  onSolveVarTap(e) {
    this.solve(e.currentTarget.dataset.key);
  },

  solve(key) {
    const d = this.data;
    const density = parseFloat(d.density);
    const wTarget = parseFloat(d.solveWeight);
    if (!isFinite(density) || density <= 0) {
      wx.showToast({ title: "请先填写有效的密度值", icon: "none" });
      return;
    }
    if (!isFinite(wTarget) || wTarget <= 0) {
      wx.showToast({ title: "请先填写目标重量（kg）", icon: "none" });
      return;
    }
    const V = (wTarget * 1000) / density; // 目标体积 cm³
    let result = 0;
    let hint = "";
    const fieldMap = {};

    if (d.shape === "plate") {
      const pL = this.num(d.plateL);
      const pW = this.num(d.plateW);
      const pT = this.num(d.plateT);
      if (key === "L") {
        if (pW === null || pT === null) { wx.showToast({ title: "请先填写宽度和厚度", icon: "none" }); return; }
        result = (V * 1000) / (pW * pT); fieldMap.plateL = result; hint = "长度";
      } else if (key === "W") {
        if (pL === null || pT === null) { wx.showToast({ title: "请先填写长度和厚度", icon: "none" }); return; }
        result = (V * 1000) / (pL * pT); fieldMap.plateW = result; hint = "宽度";
      } else {
        if (pL === null || pW === null) { wx.showToast({ title: "请先填写长度和宽度", icon: "none" }); return; }
        result = (V * 1000) / (pL * pW); fieldMap.plateT = result; hint = "厚度";
      }
    } else if (d.shape === "rod") {
      const rD = this.num(d.rodD);
      const rL = this.num(d.rodL);
      if (key === "D") {
        if (rL === null) { wx.showToast({ title: "请先填写长度", icon: "none" }); return; }
        result = Math.sqrt((4000 * V) / (Math.PI * rL)); fieldMap.rodD = result; hint = "直径";
      } else {
        if (rD === null) { wx.showToast({ title: "请先填写直径", icon: "none" }); return; }
        result = (4000 * V) / (Math.PI * rD * rD); fieldMap.rodL = result; hint = "长度";
      }
    } else {
      let tOD, tID, tL;
      if (d.tubeMode === "od-wall") {
        tOD = this.num(d.tubeOd2);
        const tWall = this.num(d.tubeWall);
        tL = this.num(d.tubeL2);
        if (key === "OD") {
          if (tWall === null || tL === null) { wx.showToast({ title: "请先填写壁厚和长度", icon: "none" }); return; }
          result = (1000 * V) / (Math.PI * tL * tWall) + tWall; fieldMap.tubeOd2 = result; hint = "外径";
        } else if (key === "WALL") {
          if (tOD === null || tL === null) { wx.showToast({ title: "请先填写外径和长度", icon: "none" }); return; }
          const sq = tOD * tOD - (4000 * V) / (Math.PI * tL);
          if (sq <= 0) { wx.showToast({ title: "该重量在此外径和长度下无法实现", icon: "none" }); return; }
          result = (tOD - Math.sqrt(sq)) / 2; fieldMap.tubeWall = result; hint = "壁厚";
        } else {
          if (tOD === null || tWall === null) { wx.showToast({ title: "请先填写外径和壁厚", icon: "none" }); return; }
          const denom = 4 * tWall * (tOD - tWall);
          if (denom <= 0) { wx.showToast({ title: "外径需大于两倍壁厚", icon: "none" }); return; }
          result = (4000 * V) / (Math.PI * denom); fieldMap.tubeL2 = result; hint = "长度";
        }
      } else {
        tOD = this.num(d.tubeOd);
        tID = this.num(d.tubeId);
        tL = this.num(d.tubeL);
        if (key === "OD") {
          if (tID === null || tL === null) { wx.showToast({ title: "请先填写内径和长度", icon: "none" }); return; }
          result = Math.sqrt(tID * tID + (4000 * V) / (Math.PI * tL)); fieldMap.tubeOd = result; hint = "外径";
        } else if (key === "ID") {
          if (tOD === null || tL === null) { wx.showToast({ title: "请先填写外径和长度", icon: "none" }); return; }
          const sq2 = tOD * tOD - (4000 * V) / (Math.PI * tL);
          if (sq2 <= 0) { wx.showToast({ title: "该重量在此外径和长度下无法实现", icon: "none" }); return; }
          result = Math.sqrt(sq2); fieldMap.tubeId = result; hint = "内径";
        } else {
          if (tOD === null || tID === null) { wx.showToast({ title: "请先填写外径和内径", icon: "none" }); return; }
          const d2 = tOD * tOD - tID * tID;
          if (d2 <= 0) { wx.showToast({ title: "外径必须大于内径", icon: "none" }); return; }
          result = (4000 * V) / (Math.PI * d2); fieldMap.tubeL = result; hint = "长度";
        }
      }
    }

    // 写回输入框
    const patch = {};
    for (const f in fieldMap) {
      patch[f] = String(Math.round(fieldMap[f] * 1000) / 1000);
    }
    patch.solveResult = "✓ 反算" + hint + " = " + this.formatNum(result) + " mm（按目标 " + this.formatNum(wTarget) + " kg，已填入上方）";
    this.setData(patch);
    this.onCalc(); // 联动刷新计算结果
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

  onCalc() {
    const d = this.data;
    const density = parseFloat(d.density);
    if (!isFinite(density) || density <= 0) {
      wx.showToast({ title: "请填写有效的密度值", icon: "none" });
      return;
    }

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
      weight: this.formatNum(weightKg),
      totalWeight: this.formatNum(totalW),
      cost: hasPrice ? this.formatNum(cost) : "-",
      hasCost: hasPrice,
      formula: finalFormula
    };
    // 目标重量预填当前单件重量（用户改过则保留）
    if (!this.data.solveWeightTouched) {
      patch.solveWeight = String(Math.round(weightKg * 1000) / 1000);
    }
    this.setData(patch);
  },

  onCopy() {
    const d = this.data;
    if (!d.showResult) return;
    const lines = [
      "【ADV小助手】工程塑料重量计算",
      "材料: " + d.materialName + "（密度 " + d.density + " g/cm³）",
      "单件体积: " + d.volume + " cm³",
      "单件重量: " + d.weight + " kg",
      "总重量: " + d.totalWeight + " kg"
    ];
    if (d.hasCost) lines.push("材料成本: " + d.cost + " 元");
    wx.setClipboardData({
      data: lines.join("\n"),
      success: function () {
        wx.showToast({ title: "已复制", icon: "success" });
      }
    });
  }
});
