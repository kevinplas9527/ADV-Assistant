(function () {
  "use strict";

  // ---------- 元素引用 ----------
  var materialSelect = document.getElementById("material");
  var densityInput = document.getElementById("density");
  var shapeBtns = document.querySelectorAll(".shape-btn");
  var plateForm = document.getElementById("form-plate");
  var rodForm = document.getElementById("form-rod");
  var tubeForm = document.getElementById("form-tube");
  var modeBtns = document.querySelectorAll(".mode-btn");
  var tubeOdId = document.getElementById("tube-od-id");
  var tubeOdWall = document.getElementById("tube-od-wall");
  var calcBtn = document.getElementById("calc-btn");
  var resultBox = document.getElementById("result");
  var copyBtn = document.getElementById("copy-btn");
  var costItem = document.getElementById("cost-item");
  var targetWeight = document.getElementById("target-weight");
  var solveMsg = document.getElementById("solve-msg");

  // 材料常量：value 存常用密度 (g/cm³)
  var MATERIALS = {
    "2.20": "PTFE 聚四氟乙烯",
    "2.15": "PFA 全氟烷氧基树脂",
    "1.78": "PVDF 聚偏氟乙烯",
    "1.32": "PEEK 聚醚醚酮",
    "1.35": "PPS 聚苯硫醚",
    "1.40": "PI 聚酰亚胺",
    "1.41": "POM 聚甲醛（赛钢）",
    "1.14": "PA6 尼龙6",
    "1.15": "PA66 尼龙66",
    "1.16": "MC尼龙（铸型尼龙）",
    "1.20": "PC 聚碳酸酯",
    "1.19": "PMMA 亚克力",
    "1.05": "ABS",
    "0.96": "HDPE 高密度聚乙烯",
    "0.93": "UHMWPE 超高分子量聚乙烯",
    "0.91": "PP 聚丙烯",
    "1.45": "PVC 硬质聚氯乙烯"
  };

  var currentShape = "plate";
  var currentTubeMode = "od-id"; // od-id: 内外径, od-wall: 外径壁厚

  // ---------- 材料选择联动密度 ----------
  materialSelect.addEventListener("change", function () {
    densityInput.value = materialSelect.value;
  });

  // ---------- 形态切换 ----------
  shapeBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      shapeBtns.forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      currentShape = btn.getAttribute("data-shape");
      plateForm.classList.add("hidden");
      rodForm.classList.add("hidden");
      tubeForm.classList.add("hidden");
      (currentShape === "plate" ? plateForm : currentShape === "rod" ? rodForm : tubeForm).classList.remove("hidden");
      solveMsg.classList.add("hidden");
    });
  });

  // ---------- 管材输入模式切换 ----------
  modeBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      modeBtns.forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      currentTubeMode = btn.getAttribute("data-tube-mode");
      if (currentTubeMode === "od-id") {
        tubeOdId.classList.remove("hidden");
        tubeOdWall.classList.add("hidden");
      } else {
        tubeOdWall.classList.remove("hidden");
        tubeOdId.classList.add("hidden");
      }
      solveMsg.classList.add("hidden");
    });
  });

  // 修改单件重量 → 进入反算模式（橙色提示）
  targetWeight.addEventListener("input", function () {
    targetWeight.classList.add("edited");
    solveMsg.classList.add("hidden");
  });

  // ---------- 工具函数 ----------
  function num(id) {
    var v = parseFloat(document.getElementById(id).value);
    return isFinite(v) && v > 0 ? v : null;
  }

  function formatNum(n) {
    if (!isFinite(n)) return "-";
    var rounded = Math.round(n * 1000) / 1000;
    return rounded.toLocaleString("zh-CN", { maximumFractionDigits: 3 });
  }

  // 收集当前形态的尺寸（value 为 null 表示留空待反算）
  function collectDims() {
    if (currentShape === "plate") {
      return [
        { key: "L", id: "plate-l", label: "长度", value: num("plate-l") },
        { key: "W", id: "plate-w", label: "宽度", value: num("plate-w") },
        { key: "T", id: "plate-t", label: "厚度", value: num("plate-t") }
      ];
    }
    if (currentShape === "rod") {
      return [
        { key: "D", id: "rod-d", label: "直径", value: num("rod-d") },
        { key: "L", id: "rod-l", label: "长度", value: num("rod-l") }
      ];
    }
    if (currentTubeMode === "od-wall") {
      return [
        { key: "OD", id: "tube-od2", label: "外径", value: num("tube-od2") },
        { key: "WALL", id: "tube-wall", label: "壁厚", value: num("tube-wall") },
        { key: "L", id: "tube-l2", label: "长度", value: num("tube-l2") }
      ];
    }
    return [
      { key: "OD", id: "tube-od", label: "外径", value: num("tube-od") },
      { key: "ID", id: "tube-id", label: "内径", value: num("tube-id") },
      { key: "L", id: "tube-l", label: "长度", value: num("tube-l") }
    ];
  }

  // ---------- 计算（双模式） ----------
  function calc() {
    var density = parseFloat(densityInput.value);
    if (!isFinite(density) || density <= 0) {
      alert("请填写有效的密度值");
      return;
    }

    var dims = collectDims();
    var missing = dims.filter(function (d) { return d.value === null; });
    var tWeight = parseFloat(targetWeight.value);
    var hasTarget = isFinite(tWeight) && tWeight > 0;

    if (missing.length === 0) {
      // 尺寸齐全：若用户已修改目标重量（橙色），提示留空变量，不覆盖目标值
      if (hasTarget && targetWeight.classList.contains("edited")) {
        solveMsg.classList.remove("hidden");
        solveMsg.classList.add("warn");
        solveMsg.textContent = "⚠ 反算需留空一个尺寸（长/宽/厚/直径/长度…）再点计算；或清空单件重量进行常规计算";
        return;
      }
      // 常规模式：尺寸齐全 → 计算重量
      calcNormal(density, false);
    } else if (missing.length === 1 && hasTarget) {
      // 反算模式：留空一个变量 + 目标重量 → 反算该变量
      solveMissing(dims, missing[0], tWeight, density);
    } else if (missing.length > 1) {
      alert("反算时只能留空一个变量，请保留其他尺寸（或清空单件重量进行常规计算）");
    } else {
      alert("请输入目标单件重量后再反算（修改单件重量框并留空一个变量）");
    }
  }

  // 常规计算：尺寸齐全，算重量并写入单件重量框
  function calcNormal(density, keepEdited) {
    var volume = 0;   // cm³
    var formula = "";

    if (currentShape === "plate") {
      var l = num("plate-l"), w = num("plate-w"), t = num("plate-t");
      if (l === null || w === null || t === null) {
        alert("请完整填写板材的长、宽、厚（mm）");
        return;
      }
      volume = (l * w * t) / 1000; // mm³ -> cm³
      formula = "体积 = 长×宽×厚 = " + l + "×" + w + "×" + t + " mm³\n      = " + formatNum(volume) + " cm³";

    } else if (currentShape === "rod") {
      var d = num("rod-d"), rl = num("rod-l");
      if (d === null || rl === null) {
        alert("请完整填写棒材的直径和长度（mm）");
        return;
      }
      volume = (Math.PI * d * d * rl) / 4000; // π·d²/4·L, mm³ -> cm³
      formula = "体积 = π×(直径/2)²×长度 = π×(" + d + "/2)²×" + rl + " mm³\n      = " + formatNum(volume) + " cm³";

    } else {
      var od, idv, tl;
      if (currentTubeMode === "od-wall") {
        od = num("tube-od2");
        var wall = num("tube-wall");
        tl = num("tube-l2");
        if (od === null || wall === null || tl === null) {
          alert("请完整填写管材的外径、壁厚和长度（mm）");
          return;
        }
        if (od <= 2 * wall) {
          alert("外径必须大于两倍壁厚");
          return;
        }
        idv = od - 2 * wall; // 内径 = 外径 - 2×壁厚
        volume = (Math.PI * (od * od - idv * idv) * tl) / 4000;
        formula = "内径 = 外径-2×壁厚 = " + od + "-2×" + wall + " = " + formatNum(idv) + " mm\n" +
                  "体积 = π×[(外径/2)²-(内径/2)²]×长度\n      = π×[(" + od + "/2)²-(" + idv + "/2)²]×" + tl + " mm³\n      = " + formatNum(volume) + " cm³";
      } else {
        od = num("tube-od");
        idv = num("tube-id");
        tl = num("tube-l");
        if (od === null || idv === null || tl === null) {
          alert("请完整填写管材的外径、内径和长度（mm）");
          return;
        }
        if (idv >= od) {
          alert("内径必须小于外径");
          return;
        }
        volume = (Math.PI * (od * od - idv * idv) * tl) / 4000;
        formula = "体积 = π×[(外径/2)²-(内径/2)²]×长度\n      = π×[(" + od + "/2)²-(" + idv + "/2)²]×" + tl + " mm³\n      = " + formatNum(volume) + " cm³";
      }
    }

    var weightKg = (volume * density) / 1000;      // g -> kg
    var qty = Math.max(1, parseInt(document.getElementById("qty").value, 10) || 1);
    var totalW = weightKg * qty;
    var price = parseFloat(document.getElementById("price").value);
    var hasPrice = isFinite(price) && price > 0;
    var cost = hasPrice ? totalW * price : null;

    // 渲染结果
    document.getElementById("res-volume").textContent = formatNum(volume);
    targetWeight.value = String(Math.round(weightKg * 1000) / 1000);
    document.getElementById("res-total-w").textContent = formatNum(totalW);
    var materialName = MATERIALS[densityInput.value] || "自定义材料";
    if (!hasPrice) {
      costItem.classList.add("hidden");
      document.getElementById("res-cost").textContent = "-";
    } else {
      costItem.classList.remove("hidden");
      document.getElementById("res-cost").textContent = formatNum(cost);
    }
    document.getElementById("res-formula").textContent =
      materialName + " · 密度 " + density + " g/cm³\n" +
      formula + "\n" +
      "重量 = 体积×密度 = " + formatNum(volume) + "×" + density + " g\n      = " + formatNum(weightKg) + " kg" +
      (qty > 1 ? "（×" + qty + " 件）" : "") +
      (hasPrice ? "\n成本 = 总重×单价 = " + formatNum(totalW) + "×" + formatNum(price) + " 元\n      = " + formatNum(cost) + " 元" : "");

    resultBox.classList.remove("hidden");
    copyBtn.classList.remove("hidden");

    // 常规模式：重量框回到黑色、清提示；反算联动模式：保留橙色
    if (!keepEdited) {
      targetWeight.classList.remove("edited");
      solveMsg.classList.add("hidden");
      solveMsg.classList.remove("warn");
    }
  }

  // 反算：按目标重量解出留空的变量
  function solveMissing(dims, miss, tWeight, density) {
    var V = (tWeight * 1000) / density; // 目标体积 cm³
    var known = {};
    dims.forEach(function (d) { known[d.key] = d.value; });
    var result = 0;

    if (currentShape === "plate") {
      if (miss.key === "L") {
        result = (V * 1000) / (known.W * known.T);
      } else if (miss.key === "W") {
        result = (V * 1000) / (known.L * known.T);
      } else {
        result = (V * 1000) / (known.L * known.W);
      }
    } else if (currentShape === "rod") {
      if (miss.key === "D") {
        result = Math.sqrt((4000 * V) / (Math.PI * known.L));
      } else {
        result = (4000 * V) / (Math.PI * known.D * known.D);
      }
    } else if (currentTubeMode === "od-wall") {
      if (miss.key === "OD") {
        result = (1000 * V) / (Math.PI * known.L * known.WALL) + known.WALL;
      } else if (miss.key === "WALL") {
        var sq = known.OD * known.OD - (4000 * V) / (Math.PI * known.L);
        if (sq <= 0) { alert("该重量在此外径和长度下无法实现，请调整外径/长度或目标重量"); return; }
        result = (known.OD - Math.sqrt(sq)) / 2;
      } else {
        var denom = 4 * known.WALL * (known.OD - known.WALL);
        if (denom <= 0) { alert("外径与壁厚组合无效（外径需大于两倍壁厚）"); return; }
        result = (4000 * V) / (Math.PI * denom);
      }
    } else {
      if (miss.key === "OD") {
        result = Math.sqrt(known.ID * known.ID + (4000 * V) / (Math.PI * known.L));
      } else if (miss.key === "ID") {
        var sq2 = known.OD * known.OD - (4000 * V) / (Math.PI * known.L);
        if (sq2 <= 0) { alert("该重量在此外径和长度下无法实现，请调整外径/长度或目标重量"); return; }
        result = Math.sqrt(sq2);
      } else {
        var d2 = known.OD * known.OD - known.ID * known.ID;
        if (d2 <= 0) { alert("外径必须大于内径"); return; }
        result = (4000 * V) / (Math.PI * d2);
      }
    }

    // 填回留空的变量
    document.getElementById(miss.id).value = String(Math.round(result * 1000) / 1000);
    // 蓝色加粗显示反算结果
    solveMsg.classList.remove("hidden");
    solveMsg.classList.remove("warn");
    solveMsg.textContent = "✓ 反算" + miss.label + " = " + formatNum(result) + " mm（按目标 " + formatNum(tWeight) + " kg）";
    // 联动刷新重量显示（保留橙色）
    calcNormal(density, true);
  }

  calcBtn.addEventListener("click", calc);

  // 回车触发计算
  document.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.target.matches("button")) {
      e.preventDefault();
      calc();
    }
  });

  // ---------- 复制结果 ----------
  copyBtn.addEventListener("click", function () {
    var text = [
      "【ADV小助手】工程塑料重量计算",
      "材料: " + (MATERIALS[densityInput.value] || "自定义") + "（密度 " + densityInput.value + " g/cm³）",
      "单件体积: " + document.getElementById("res-volume").textContent + " cm³",
      "单件重量: " + targetWeight.value + " kg",
      "总重量: " + document.getElementById("res-total-w").textContent + " kg",
      document.getElementById("res-cost").textContent !== "-"
        ? "材料成本: " + document.getElementById("res-cost").textContent + " 元"
        : null
    ].filter(Boolean).join("\n");

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () {
        copyBtn.textContent = "已复制 ✓";
        setTimeout(function () { copyBtn.textContent = "复制结果"; }, 1500);
      }).catch(function () { fallbackCopy(text); });
    } else {
      fallbackCopy(text);
    }
  });

  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (e) { /* 忽略 */ }
    document.body.removeChild(ta);
    copyBtn.textContent = "已复制 ✓";
    setTimeout(function () { copyBtn.textContent = "复制结果"; }, 1500);
  }

  // ---------- 页面切换（重量 / 切割） ----------
  var tabBtns = document.querySelectorAll(".app-tab");
  var pageWeight = document.getElementById("page-weight");
  var pageCut = document.getElementById("page-cut");

  tabBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      tabBtns.forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");
      var tab = btn.getAttribute("data-tab");
      pageWeight.classList.toggle("hidden", tab !== "weight");
      pageCut.classList.toggle("hidden", tab !== "cut");
    });
  });

  // ---------- 板材切割测算 ----------
  // 沿一个方向排 n 块：n×块 + (n-1)×刀缝 ≤ 板长
  function cutNum(len, block, kerf) {
    if (block + kerf <= 0) return 0;
    return Math.floor((len + kerf) / (block + kerf));
  }

  // 排样：尝试直排 / 旋转 / 分区混合，取块数最多方案
  function bestCut(W, H, bw, bh, kerf) {
    var best = { count: 0, blocks: [], mode: "" };

    function consider(blocks, mode) {
      if (blocks.length > best.count) {
        best = { count: blocks.length, blocks: blocks, mode: mode };
      }
    }

    // 纯 A（正向直排）
    (function () {
      var cols = cutNum(W, bw, kerf), rows = cutNum(H, bh, kerf);
      if (cols <= 0 || rows <= 0) return;
      var blocks = [];
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          blocks.push({ x: c * (bw + kerf), y: r * (bh + kerf), w: bw, h: bh, rot: false });
        }
      }
      consider(blocks, "正向直排");
    })();

    // 纯 B（旋转直排）
    (function () {
      var cols = cutNum(W, bh, kerf), rows = cutNum(H, bw, kerf);
      if (cols <= 0 || rows <= 0) return;
      var blocks = [];
      for (var r = 0; r < rows; r++) {
        for (var c = 0; c < cols; c++) {
          blocks.push({ x: c * (bh + kerf), y: r * (bw + kerf), w: bh, h: bw, rot: true });
        }
      }
      consider(blocks, "旋转直排");
    })();

    // 混合1：上方 t 行正向块，下方剩余区域排旋转块
    (function () {
      var rowsA = cutNum(H, bh, kerf);
      for (var t = 1; t <= rowsA; t++) {
        var hUsed = t * bh + (t - 1) * kerf;
        var hRem = H - hUsed;
        if (hRem <= 0) continue;
        var colsA = cutNum(W, bw, kerf);
        var colsB = cutNum(W, bh, kerf);
        var rowsB = cutNum(hRem, bw, kerf);
        if (colsA <= 0 || colsB <= 0 || rowsB <= 0) continue;
        var blocks = [];
        for (var r = 0; r < t; r++) {
          for (var c = 0; c < colsA; c++) {
            blocks.push({ x: c * (bw + kerf), y: r * (bh + kerf), w: bw, h: bh, rot: false });
          }
        }
        for (var r2 = 0; r2 < rowsB; r2++) {
          for (var c2 = 0; c2 < colsB; c2++) {
            blocks.push({ x: c2 * (bh + kerf), y: hUsed + kerf + r2 * (bw + kerf), w: bh, h: bw, rot: true });
          }
        }
        consider(blocks, "上正下旋分区");
      }
    })();

    // 混合2：左方 c 列正向块，右方剩余区域排旋转块
    (function () {
      var colsA = cutNum(W, bw, kerf);
      for (var c = 1; c <= colsA; c++) {
        var wUsed = c * bw + (c - 1) * kerf;
        var wRem = W - wUsed;
        if (wRem <= 0) continue;
        var rowsA = cutNum(H, bh, kerf);
        var colsB = cutNum(wRem, bh, kerf);
        var rowsB = cutNum(H, bw, kerf);
        if (rowsA <= 0 || colsB <= 0 || rowsB <= 0) continue;
        var blocks = [];
        for (var r = 0; r < rowsA; r++) {
          for (var c0 = 0; c0 < c; c0++) {
            blocks.push({ x: c0 * (bw + kerf), y: r * (bh + kerf), w: bw, h: bh, rot: false });
          }
        }
        for (var r2 = 0; r2 < rowsB; r2++) {
          for (var c2 = 0; c2 < colsB; c2++) {
            blocks.push({ x: wUsed + kerf + c2 * (bh + kerf), y: r2 * (bw + kerf), w: bh, h: bw, rot: true });
          }
        }
        consider(blocks, "左正右旋分区");
      }
    })();

    // 混合3：上方 t 行旋转块，下方剩余区域排正向块
    (function () {
      var rowsB = cutNum(H, bw, kerf);
      for (var t = 1; t <= rowsB; t++) {
        var hUsed = t * bw + (t - 1) * kerf;
        var hRem = H - hUsed;
        if (hRem <= 0) continue;
        var colsB = cutNum(W, bh, kerf);
        var colsA = cutNum(W, bw, kerf);
        var rowsA = cutNum(hRem, bh, kerf);
        if (colsB <= 0 || colsA <= 0 || rowsA <= 0) continue;
        var blocks = [];
        for (var r = 0; r < t; r++) {
          for (var c = 0; c < colsB; c++) {
            blocks.push({ x: c * (bh + kerf), y: r * (bw + kerf), w: bh, h: bw, rot: true });
          }
        }
        for (var r2 = 0; r2 < rowsA; r2++) {
          for (var c2 = 0; c2 < colsA; c2++) {
            blocks.push({ x: c2 * (bw + kerf), y: hUsed + kerf + r2 * (bh + kerf), w: bw, h: bh, rot: false });
          }
        }
        consider(blocks, "上旋下正分区");
      }
    })();

    return best;
  }

  // 绘制切割示意图（线框）
  function drawCutCanvas(blocks, W, H) {
    var canvas = document.getElementById("cut-canvas");
    var dpr = window.devicePixelRatio || 1;
    var baseW = 560;
    var baseH = Math.max(280, Math.round(baseW * H / W));
    canvas.width = baseW * dpr;
    canvas.height = baseH * dpr;
    canvas.style.aspectRatio = baseW + " / " + baseH;
    var ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, baseW, baseH);
    var pad = 24;
    var scale = Math.min((baseW - pad * 2) / W, (baseH - pad * 2) / H);
    var ox = (baseW - W * scale) / 2;
    var oy = (baseH - H * scale) / 2;

    // 板材外框
    ctx.strokeStyle = "#1e5eff";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(ox, oy, W * scale, H * scale);
    // 切割线（刀缝线用浅色虚线）
    ctx.beginPath();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = "#b9c6ea";
    ctx.lineWidth = 1;
    for (var i = 1; i < Math.round(W / 100); i++) { /* 占位：不画外部网格 */ }
    // 每个块
    blocks.forEach(function (b) {
      ctx.strokeStyle = b.rot ? "#f08c00" : "#3a66d8";
      ctx.lineWidth = 1.3;
      ctx.setLineDash([]);
      ctx.strokeRect(ox + b.x * scale, oy + b.y * scale, b.w * scale, b.h * scale);
    });
    // 旋转块用虚线区分
    ctx.setLineDash([]);
  }

  var cutBtn = document.getElementById("cut-btn");
  var cutMsg = document.getElementById("cut-msg");
  var cutTargetN = document.getElementById("cut-target-n");

  // 修改目标块数 → 进入反算模式（橙色提示）
  cutTargetN.addEventListener("input", function () {
    cutTargetN.classList.add("edited");
    cutMsg.classList.add("hidden");
  });

  // 反算板材长/宽：已知一个方向尺寸，按直排求另一方向最小长度
  function minLength(fixedLen, N, bw, bh, kerf) {
    var bestLen = null;
    // 方案A：固定方向排 bh 高（正向块）
    var rows = cutNum(fixedLen, bh, kerf);
    if (rows > 0) {
      var cols = Math.ceil(N / rows);
      var len = cols * bw + (cols - 1) * kerf;
      if (bestLen === null || len < bestLen) bestLen = len;
    }
    // 方案B：固定方向排 bw 高（旋转块）
    var rows2 = cutNum(fixedLen, bw, kerf);
    if (rows2 > 0) {
      var cols2 = Math.ceil(N / rows2);
      var len2 = cols2 * bh + (cols2 - 1) * kerf;
      if (bestLen === null || len2 < bestLen) bestLen = len2;
    }
    return bestLen;
  }

  // 常规测算：跑排样 + 展示结果与示意图
  function runCut(W, H, bw, bh, kerf, msg, keepMsg) {
    if (bw > W && bh > W && bw > H && bh > H) {
      alert("块尺寸大于板材，无法切割");
      return;
    }
    var best = bestCut(W, H, bw, bh, kerf);
    if (best.count === 0) {
      alert("无法放下任何一块，请检查尺寸");
      return;
    }
    var areaRatio = (best.count * bw * bh) / (W * H);
    document.getElementById("cut-summary").innerHTML =
      "<div class='cut-count'>可切 <b>" + best.count + "</b> 块</div>" +
      "<div class='cut-meta'>排样：" + best.mode + " ｜ 板材 " + W + "×" + H + " mm ｜ 单块 " + bw + "×" + bh + " mm ｜ 刀缝 " + kerf + " mm</div>" +
      "<div class='cut-meta'>材料利用率 " + (areaRatio * 100).toFixed(1) + "% ｜ 余料 " + formatNum(W * H - best.count * bw * bh) + " mm²</div>";
    document.getElementById("cut-result-card").classList.remove("hidden");
    if (msg) {
      cutMsg.classList.remove("hidden");
      cutMsg.textContent = msg;
      if (msg.indexOf("目标块数用于反算") !== -1) {
        cutMsg.classList.add("warn");
      } else {
        cutMsg.classList.remove("warn");
      }
    } else if (!keepMsg) {
      cutMsg.classList.add("hidden");
    }
    drawCutCanvas(best.blocks, W, H);
  }

  cutBtn.addEventListener("click", function () {
    var W = num("cut-plate-l");
    var H = num("cut-plate-w");
    var bw = num("cut-block-l");
    var bh = num("cut-block-w");
    var kerf = parseFloat(document.getElementById("cut-kerf").value);
    if (!isFinite(kerf)) kerf = 0;
    if (kerf < 0) kerf = 0;
    var targetN = parseInt(document.getElementById("cut-target-n").value, 10);
    var hasTarget = isFinite(targetN) && targetN > 0;

    if (bw === null || bh === null) {
      alert("请填写块长和块宽（mm）");
      return;
    }

    var missing = (W === null ? 1 : 0) + (H === null ? 1 : 0);

    if (missing === 0) {
      if (hasTarget) {
        runCut(W, H, bw, bh, kerf, "⚠ 目标块数用于反算：清空板材长或板材宽后点测算，可反算对应尺寸");
      } else {
        cutTargetN.classList.remove("edited");
        runCut(W, H, bw, bh, kerf, "");
      }
      return;
    }

    if (missing === 1 && hasTarget) {
      var fixed = W === null ? H : W;
      var need = minLength(fixed, targetN, bw, bh, kerf);
      if (need === null) {
        alert("固定方向的板材尺寸不足以排下任意一块");
        return;
      }
      var missName = W === null ? "板材长" : "板材宽";
      var missId = W === null ? "cut-plate-l" : "cut-plate-w";
      document.getElementById(missId).value = String(Math.round(need * 1000) / 1000);
      cutMsg.classList.remove("hidden");
      cutMsg.classList.remove("warn");
      cutMsg.textContent = "✓ 反算" + missName + " = " + formatNum(need) + " mm（按目标 " + targetN + " 块，最小需）";
      var newW = W === null ? need : W;
      var newH = H === null ? need : H;
      runCut(newW, newH, bw, bh, kerf, "", true);
      return;
    }

    if (missing > 1) {
      alert("反算时只能留空板材长或板材宽之一");
      return;
    }

    alert("请输入目标块数后再反算（修改目标块数并留空板材长或板材宽）");
  });
})();
