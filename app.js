const state = {
  rules: null,
  assetAmount: 1268800.52
};

const formatMoney = new Intl.NumberFormat("zh-CN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
});

async function loadRules() {
  const response = await fetch("./rules.json");
  state.rules = await response.json();
  hydrateAssetCertification();
  bindInteractions();
}

function currentAssetTier() {
  return state.rules.assetTiers
    .filter((tier) => state.assetAmount >= tier.threshold)
    .sort((a, b) => b.threshold - a.threshold)[0];
}

function hydrateAssetCertification() {
  const tier = currentAssetTier();
  document.getElementById("asset-amount").textContent = formatMoney.format(state.assetAmount);
  document.getElementById("asset-cert-button").textContent = tier.buttonLabel;
}

function bindInteractions() {
  document.querySelectorAll("[data-screen]").forEach((button) => {
    button.addEventListener("click", () => switchScreen(button.dataset.screen));
  });

  document.getElementById("asset-cert-button").addEventListener("click", openAssetModal);
  document.getElementById("close-modal").addEventListener("click", closeModal);
  document.getElementById("modal-backdrop").addEventListener("click", (event) => {
    if (event.target.id === "modal-backdrop") closeModal();
  });
}

function switchScreen(screen) {
  document.querySelectorAll(".toolbar-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.screen === screen);
  });
  document.querySelectorAll(".screen").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `${screen}-screen`);
  });
  updateContext(screen);
}

function updateContext(screen) {
  document.querySelectorAll(".context-detail").forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.context === screen);
  });
}

function openAssetModal() {
  const tier = currentAssetTier();
  document.getElementById("modal-title").textContent = `已获${tier.label}`;
  document.getElementById("modal-subtitle").textContent = `你的${tier.level}已通过腾讯微证券认证`;
  document.getElementById("modal-benefits").innerHTML = [
    `评论区权益：${tier.frame}`,
    "腾讯微证券认证标识，支持链接验真",
    `活动权益：${tier.reward}`
  ].map((item) => `<span>${item}</span>`).join("");
  document.getElementById("modal-backdrop").hidden = false;
}

function closeModal() {
  document.getElementById("modal-backdrop").hidden = true;
}

loadRules();
