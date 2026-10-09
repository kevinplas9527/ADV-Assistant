(function () {
  "use strict";

  // ---------- 元素引用 ----------
  var materialSelect = document.getElementById("material");
  var densityInput = document.getElementById("density");
  var shapeBtns = document.querySelectorAll(".shape-btn");
  var plateForm = document.getElementById("form-plate");
  var rodForm = document.getElementById("form-rod");
  var tubeForm = document.getElementById("form-tube");
  var calcBtn = document.getElementById("calc-btn");
  var resultBox = document.getElementById("result");
  var copyBtn = document.getElementById("copy-btn");
  var costItem = document.getElementById("cost-item");

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
    });
  });

  // ---------- 计算 ----------
  function num(id) {
    var v = parseFloat(document.getElementById(id).value);
    return isFinite(v) && v > 0 ? v : null;
  }

  function calc() {
    var density = parseFloat(densityInput.value);
    if (!isFinite(density) || density <= 0) {
      alert("请填写有效的密度值");
      return;
    }

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
      var od = num("tube-od"), idv = num("tube-id"), tl = num("tube-l");
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

    var weightKg = (volume * density) / 1000;      // g -> kg
    var qty = Math.max(1, parseInt(document.getElementById("qty").value, 10) || 1);
    var totalW = weightKg * qty;
    var price = parseFloat(document.getElementById("price").value);
    var hasPrice = isFinite(price) && price > 0;
    var cost = hasPrice ? totalW * price : null;

    // 渲染结果
    document.getElementById("res-volume").textContent = formatNum(volume);
    document.getElementById("res-weight").textContent = formatNum(weightKg);
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
  }

  function formatNum(n) {
    if (!isFinite(n)) return "-";
    var rounded = Math.round(n * 1000) / 1000;
    return rounded.toLocaleString("zh-CN", { maximumFractionDigits: 3 });
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
      "单件重量: " + document.getElementById("res-weight").textContent + " kg",
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
})();
