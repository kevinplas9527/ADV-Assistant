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
    hasCost: false
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
  },

  onTubeModeTap(e) {
    this.setData({ tubeMode: e.currentTarget.dataset.mode });
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: e.detail.value });
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

    this.setData({
      showResult: true,
      volume: this.formatNum(volume),
      weight: this.formatNum(weightKg),
      totalWeight: this.formatNum(totalW),
      cost: hasPrice ? this.formatNum(cost) : "-",
      hasCost: hasPrice,
      formula: finalFormula
    });
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
