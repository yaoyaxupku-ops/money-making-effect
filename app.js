const state = {
  rules: null,
  assetAmount: 1268800.52,
  operationId: "t-trade",
  selectedTool: "",
  toastIndex: 0,
  toastTimer: null
};

const formatMoney = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

async function loadRules() {
  const response = await fetch("./rules.json");
  state.rules = await response.json();
  hydrateAssetCertification();
  renderMiniChart("operation-chart-svg", state.operationId);
  renderMiniChart("kline-chart-svg", "buy-rise");
  renderShareChart("community-share-chart", { width: 320, height: 130 });
  renderShareChart("moments-share-chart", { width: 320, height: 156 });
  bindInteractions();
  startToastRotation();
}

function currentAssetTier() {
  return state.rules.assetTiers
    .filter((tier) => state.assetAmount >= tier.threshold)
    .sort((a, b) => b.threshold - a.threshold)[0];
}

function hydrateAssetCertification() {
  const tier = currentAssetTier();
  document.getElementById("asset-amount").textContent = formatMoney.format(state.assetAmount);
  // 按钮文案保持中性"资产认证 ›"，旁边 chip 显示已达等级作为弱钩子
  // chip 跟 currentAssetTier 走，不展示精确金额
  document.getElementById("asset-cert-button").textContent = "资产认证 ›";
  const levelShort = tier.level.replace("资产", "");
  document.getElementById("asset-cert-chip").textContent = `✦ ${levelShort}`;
}

function bindInteractions() {
  document.querySelectorAll("[data-screen]").forEach((button) => {
    button.addEventListener("click", () => switchScreen(button));
  });

  document.getElementById("asset-cert-button").addEventListener("click", openAssetModal);
  document.getElementById("asset-cert-chip").addEventListener("click", openAssetModal);
  document.getElementById("daily-profit-share").addEventListener("click", () => {
    const toast = document.getElementById("daily-profit-toast");
    toast.classList.add("dismissed");
    if (state.toastTimer) {
      clearInterval(state.toastTimer);
      state.toastTimer = null;
    }
  });
  document.getElementById("close-modal").addEventListener("click", closeModal);
  document.getElementById("modal-backdrop").addEventListener("click", (event) => {
    if (event.target.id === "modal-backdrop") closeModal();
  });

  document.getElementById("operation-close").addEventListener("click", closeOperationPopover);
  document.querySelectorAll(".tool-chip").forEach((chip) => {
    chip.addEventListener("click", () => toggleReferenceTool(chip.dataset.tool));
  });

  document.querySelectorAll(".moments-tab").forEach((tab) => {
    tab.addEventListener("click", () => switchMomentsCard(tab.dataset.moments));
  });

  document.querySelectorAll(".op-tool-state-tab").forEach((tab) => {
    tab.addEventListener("click", () => setOpToolState(tab.dataset.opToolState));
  });

  document.querySelectorAll("[data-moments-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      // 资产认证 H5 → 验真承接页；神操作 H5 → 个股 K 线承接画面
      if (link.dataset.momentsLink === "asset") {
        jumpToScreen("asset-landing");
      } else if (link.dataset.momentsLink === "operation") {
        jumpToOperationLanding();
      }
    });
  });

  // 社区分享卡里的"参考工具"链接在 Demo 中保持静态展示，真实线上点击落到 K 线+工具视图
  document.querySelectorAll("[data-community-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
    });
  });

  setOperationVariant(state.operationId);
  // 默认演示"选了主力筹码"的状态，让朋友圈神操作卡有完整钩子文案
  setOpToolState("with");
}

function jumpToScreen(screen) {
  const trigger = document.querySelector(`.toolbar-button[data-screen="${screen}"]`);
  if (trigger) {
    trigger.click();
    return;
  }
  document.querySelectorAll(".toolbar-button").forEach((b) => b.classList.remove("active"));
  document.querySelectorAll(".screen").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `${screen}-screen`);
  });
  updateContext(screen);
}

function jumpToOperationLanding() {
  document.querySelectorAll(".screen").forEach((panel) => {
    panel.classList.toggle("active", panel.id === "kline-screen");
  });
  closeOperationPopover();
  closeModal();
  updateContext("moments");
}

function setOpToolState(stateName) {
  state.opToolState = stateName;
  document.querySelectorAll(".op-tool-state-tab").forEach((tab) => {
    const active = tab.dataset.opToolState === stateName;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  const title = document.getElementById("op-link-title");
  const sub = document.getElementById("op-link-sub");
  const thumb = document.getElementById("op-link-thumb");
  if (stateName === "with") {
    title.textContent = "主力筹码看泰晶科技";
    sub.textContent = "打开腾讯微证券 · 查看同款视角";
    thumb.textContent = "筹";
    thumb.classList.remove("brand");
    thumb.classList.add("green");
  } else {
    title.textContent = "打开腾讯微证券，了解泰晶科技";
    sub.textContent = "TA 在腾讯微证券完成的实盘操作";
    thumb.textContent = "看";
    thumb.classList.remove("green");
    thumb.classList.add("brand");
  }
}

function switchScreen(sourceButton) {
  const screen = sourceButton.dataset.screen;
  document.querySelectorAll(".toolbar-button").forEach((button) => {
    button.classList.toggle("active", button === sourceButton);
  });
  document.querySelectorAll(".screen").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `${screen}-screen`);
  });
  updateContext(sourceButton.dataset.context || screen);

  // 进入资产页时，根据按钮意图决定显示什么叠层
  if (screen === "asset") {
    if (sourceButton.dataset.operation) {
      setOperationVariant(sourceButton.dataset.operation);
      openOperationPopover();
      closeModal();
    } else if (sourceButton.dataset.modal === "cert") {
      closeOperationPopover();
      openAssetModal();
    } else {
      closeOperationPopover();
      closeModal();
    }
  } else {
    closeOperationPopover();
    closeModal();
  }

  if (screen === "moments" && sourceButton.dataset.momentsDefault) {
    switchMomentsCard(sourceButton.dataset.momentsDefault);
  }
}

function updateContext(screen) {
  document.querySelectorAll(".context-detail").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.context === screen);
  });
}

function openAssetModal() {
  const tier = currentAssetTier();
  // 等级名（"百万级"/"10万级"/"千万级"/"亿元级"） → 不含"资产"后缀
  const levelShort = tier.level.replace("资产", "");
  // 主标题：成就感导向（"百万实力，值得一晒"）
  // headlineByTier 仅按等级稍作微调，让"百万/千万/亿元"等场景都自然
  const headlineMap = {
    100_000: "起步实力，值得一晒",
    500_000: "进阶实力，值得一晒",
    1_000_000: "百万实力，值得一晒",
    10_000_000: "千万实力，值得一晒",
    100_000_000: "亿元实力，值得一晒"
  };
  document.getElementById("modal-title").textContent =
    headlineMap[tier.threshold] || `${levelShort}实力，值得一晒`;
  document.getElementById("modal-subtitle").textContent = `你的资产已达到${levelShort}`;
  // 权益 1 行汇总：头像框 · 礼盒抽奖 · 认证验真
  // frame 取字段里的简称（如"黄金百万头像框"），reward 简化为"礼盒抽奖"
  const frameShort = tier.frame.replace("头像框", "头像框");
  document.getElementById("modal-perks").textContent = `${frameShort} · 礼盒抽奖 · 认证验真`;
  // positive-visual 内的等级标签也同步
  document.querySelector(".positive-visual strong").textContent = `${levelShort}资产`;
  document.getElementById("modal-backdrop").hidden = false;
}

function closeModal() {
  document.getElementById("modal-backdrop").hidden = true;
}

function setOperationVariant(operationId) {
  state.operationId = operationId;
  const rule = state.rules.operationRules.find((item) => item.id === operationId);
  document.getElementById("operation-title").textContent = rule.title;
  document.getElementById("operation-headline").textContent = rule.headline;
  document.getElementById("operation-metric").textContent = rule.metric;
  document.getElementById("operation-quote").textContent = rule.body;
  document.getElementById("asset-operation-popover").classList.toggle("sell-drop", operationId === "sell-drop");
  renderMiniChart("operation-chart-svg", operationId);
}

function openOperationPopover() {
  document.getElementById("asset-operation-overlay").hidden = false;
  document.getElementById("asset-operation-popover").hidden = false;
}

function closeOperationPopover() {
  document.getElementById("asset-operation-overlay").hidden = true;
  document.getElementById("asset-operation-popover").hidden = true;
}

function toggleReferenceTool(tool) {
  // 单选 + 可取消：再次点击当前选中项视为"不展示工具"
  state.selectedTool = state.selectedTool === tool ? "" : tool;
  document.querySelectorAll(".tool-chip").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.tool === state.selectedTool);
  });
}

function switchMomentsCard(type) {
  document.querySelectorAll(".moments-tab").forEach((tab) => {
    const active = tab.dataset.moments === type;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  document.querySelectorAll("[data-moments-card]").forEach((card) => {
    card.hidden = card.dataset.momentsCard !== type;
  });
}

function startToastRotation() {
  const toast = document.getElementById("daily-profit-toast");
  const messages = state.rules.toastMessages || [];
  if (messages.length === 0) return;
  toast.textContent = messages[0];
  state.toastIndex = 0;
  state.toastTimer = setInterval(() => {
    if (toast.classList.contains("dismissed")) return;
    state.toastIndex = (state.toastIndex + 1) % messages.length;
    toast.classList.add("rotating");
    setTimeout(() => {
      toast.textContent = messages[state.toastIndex];
      toast.classList.remove("rotating");
    }, 180);
  }, 3000);
}

// 分时图数据：x 为时间百分比（0-100），y 为价格（任意单位）
const CHART_DATA = {
  "t-trade": {
    points: [
      [0, 60], [6, 58], [12, 56], [18, 53], [24, 51], [30, 52],
      [36, 55], [42, 60], [48, 64], [54, 67], [60, 70], [66, 72],
      [72, 74], [78, 73], [84, 70], [90, 68], [96, 66], [100, 65]
    ],
    buy: { x: 24, y: 51, label: "买" },
    sell: { x: 72, y: 74, label: "卖" },
    highlight: [24, 72]
  },
  "sell-drop": {
    points: [
      [0, 50], [6, 53], [12, 56], [18, 60], [24, 64], [30, 68],
      [36, 71], [42, 73], [48, 74], [54, 73], [60, 70], [66, 66],
      [72, 62], [78, 58], [84, 55], [90, 53], [96, 51], [100, 50]
    ],
    sell: { x: 48, y: 74, label: "卖" },
    highlight: [48, 100],
    sellDrop: true
  },
  "buy-rise": {
    points: [
      [0, 55], [6, 54], [12, 52], [18, 51], [24, 50], [30, 52],
      [36, 55], [42, 58], [48, 62], [54, 65], [60, 68], [66, 71],
      [72, 73], [78, 75], [84, 76], [90, 76], [96, 75], [100, 75]
    ],
    buy: { x: 24, y: 50, label: "买" },
    highlight: [24, 100]
  }
};

function renderMiniChart(containerId, variant) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const data = CHART_DATA[variant] || CHART_DATA["t-trade"];

  // 视图坐标系
  const W = 260;
  const H = 84;
  const padX = 6;
  const padTop = 6;
  const padBottom = 4;

  const xs = data.points.map((p) => p[0]);
  const ys = data.points.map((p) => p[1]);
  const yMin = Math.min(...ys) - 3;
  const yMax = Math.max(...ys) + 3;

  const toX = (x) => padX + ((x - xs[0]) / (xs[xs.length - 1] - xs[0])) * (W - padX * 2);
  const toY = (y) => padTop + (1 - (y - yMin) / (yMax - yMin)) * (H - padTop - padBottom);

  const linePath = data.points
    .map((p, i) => `${i === 0 ? "M" : "L"}${toX(p[0]).toFixed(1)},${toY(p[1]).toFixed(1)}`)
    .join(" ");

  const fillPath = `${linePath} L${toX(xs[xs.length - 1]).toFixed(1)},${H - padBottom} L${toX(xs[0]).toFixed(1)},${H - padBottom} Z`;

  // 高亮区间（半透明）
  let highlightRect = "";
  if (data.highlight) {
    const [hx1, hx2] = data.highlight;
    highlightRect = `<rect x="${toX(hx1).toFixed(1)}" y="${padTop}" width="${(toX(hx2) - toX(hx1)).toFixed(1)}" height="${(H - padTop - padBottom).toFixed(1)}" fill="rgba(214,66,66,0.08)" />`;
  }

  // 价格基线（用平均价做参考虚线）
  const baseY = toY(ys[0]);

  // 网格
  const gridLines = [0.25, 0.5, 0.75]
    .map((r) => {
      const y = padTop + r * (H - padTop - padBottom);
      return `<line x1="${padX}" y1="${y.toFixed(1)}" x2="${W - padX}" y2="${y.toFixed(1)}" stroke="#eef0f5" stroke-width="1" />`;
    })
    .join("");

  // 买卖点标签
  const isRise = !data.sellDrop;
  const lineColor = isRise ? "#d64242" : "#16a34a";
  const lineColorFaded = isRise ? "rgba(214,66,66,0.18)" : "rgba(22,163,74,0.16)";

  let markers = "";
  if (data.buy) {
    const bx = toX(data.buy.x);
    const by = toY(data.buy.y);
    markers += `
      <g class="marker buy">
        <line x1="${bx.toFixed(1)}" y1="${(by + 4).toFixed(1)}" x2="${bx.toFixed(1)}" y2="${(H - padBottom).toFixed(1)}" stroke="#16a34a" stroke-width="1" stroke-dasharray="2 2" />
        <rect x="${(bx - 9).toFixed(1)}" y="${(by - 18).toFixed(1)}" width="18" height="14" rx="3" fill="#16a34a" />
        <text x="${bx.toFixed(1)}" y="${(by - 8).toFixed(1)}" text-anchor="middle" fill="#fff" font-size="9" font-weight="700">买</text>
        <circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="3" fill="#fff" stroke="#16a34a" stroke-width="2" />
      </g>`;
  }
  if (data.sell) {
    const sx = toX(data.sell.x);
    const sy = toY(data.sell.y);
    markers += `
      <g class="marker sell">
        <line x1="${sx.toFixed(1)}" y1="${(sy + 4).toFixed(1)}" x2="${sx.toFixed(1)}" y2="${(H - padBottom).toFixed(1)}" stroke="#ec3342" stroke-width="1" stroke-dasharray="2 2" />
        <rect x="${(sx - 9).toFixed(1)}" y="${(sy - 18).toFixed(1)}" width="18" height="14" rx="3" fill="#ec3342" />
        <text x="${sx.toFixed(1)}" y="${(sy - 8).toFixed(1)}" text-anchor="middle" fill="#fff" font-size="9" font-weight="700">卖</text>
        <circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="3" fill="#fff" stroke="#ec3342" stroke-width="2" />
      </g>`;
  }

  container.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g-${containerId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${lineColorFaded}" />
          <stop offset="100%" stop-color="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      ${gridLines}
      ${highlightRect}
      <line x1="${padX}" y1="${baseY.toFixed(1)}" x2="${W - padX}" y2="${baseY.toFixed(1)}" stroke="#cbd2dd" stroke-width="1" stroke-dasharray="3 3" />
      <path d="${fillPath}" fill="url(#g-${containerId})" />
      <path d="${linePath}" fill="none" stroke="${lineColor}" stroke-width="1.6" stroke-linejoin="round" />
      ${markers}
    </svg>`;
}

function renderShareChart(containerId, opts) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const { width: W = 320, height: H = 130 } = opts || {};
  const data = CHART_DATA["t-trade"];
  const padX = 10;
  const padTop = 12;
  const padBottom = 8;

  const xs = data.points.map((p) => p[0]);
  const ys = data.points.map((p) => p[1]);
  const yMin = Math.min(...ys) - 3;
  const yMax = Math.max(...ys) + 3;

  const toX = (x) => padX + ((x - xs[0]) / (xs[xs.length - 1] - xs[0])) * (W - padX * 2);
  const toY = (y) => padTop + (1 - (y - yMin) / (yMax - yMin)) * (H - padTop - padBottom);

  const linePath = data.points
    .map((p, i) => `${i === 0 ? "M" : "L"}${toX(p[0]).toFixed(1)},${toY(p[1]).toFixed(1)}`)
    .join(" ");
  const fillPath = `${linePath} L${toX(xs[xs.length - 1]).toFixed(1)},${H - padBottom} L${toX(xs[0]).toFixed(1)},${H - padBottom} Z`;

  const gridLines = [0.25, 0.5, 0.75]
    .map((r) => {
      const y = padTop + r * (H - padTop - padBottom);
      return `<line x1="${padX}" y1="${y.toFixed(1)}" x2="${W - padX}" y2="${y.toFixed(1)}" stroke="#eef2f7" stroke-width="1" />`;
    })
    .join("");

  const bx = toX(data.buy.x);
  const by = toY(data.buy.y);
  const sx = toX(data.sell.x);
  const sy = toY(data.sell.y);

  container.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="sg-${containerId}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="rgba(236,51,66,0.18)" />
          <stop offset="100%" stop-color="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      ${gridLines}
      <rect x="${bx.toFixed(1)}" y="${padTop}" width="${(sx - bx).toFixed(1)}" height="${(H - padTop - padBottom).toFixed(1)}" fill="rgba(236,51,66,0.07)" />
      <path d="${fillPath}" fill="url(#sg-${containerId})" />
      <path d="${linePath}" fill="none" stroke="#ec3342" stroke-width="1.8" stroke-linejoin="round" />
      <line x1="${bx.toFixed(1)}" y1="${(by + 5).toFixed(1)}" x2="${bx.toFixed(1)}" y2="${(H - padBottom).toFixed(1)}" stroke="#16a34a" stroke-width="1" stroke-dasharray="3 3" />
      <line x1="${sx.toFixed(1)}" y1="${(sy + 5).toFixed(1)}" x2="${sx.toFixed(1)}" y2="${(H - padBottom).toFixed(1)}" stroke="#ec3342" stroke-width="1" stroke-dasharray="3 3" />
      <g>
        <rect x="${(bx - 11).toFixed(1)}" y="${(by - 22).toFixed(1)}" width="22" height="16" rx="4" fill="#16a34a" />
        <text x="${bx.toFixed(1)}" y="${(by - 10).toFixed(1)}" text-anchor="middle" fill="#fff" font-size="10" font-weight="700">买</text>
        <circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="4" fill="#fff" stroke="#16a34a" stroke-width="2" />
      </g>
      <g>
        <rect x="${(sx - 11).toFixed(1)}" y="${(sy - 22).toFixed(1)}" width="22" height="16" rx="4" fill="#ec3342" />
        <text x="${sx.toFixed(1)}" y="${(sy - 10).toFixed(1)}" text-anchor="middle" fill="#fff" font-size="10" font-weight="700">卖</text>
        <circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="4" fill="#fff" stroke="#ec3342" stroke-width="2" />
      </g>
    </svg>`;
}

loadRules();
