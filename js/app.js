/**
 * 帕鲁配种计算器 - 重构后的主应用文件
 * 使用模块化架构，职责分离
 */
class PalBreedingCalculator {
  constructor() {
    this.dataManager = new DataManager();
    this.breedingCalculator = new BreedingCalculator(this.dataManager);
    this.uiManager = new UIManager(this.dataManager);
    this.resultRenderer = new ResultRenderer(this.dataManager);
    // 使用 resultRenderer 的 palFilterManager 实例
    this.palFilterManager = this.resultRenderer.palFilterManager;

    this.init();
  }

  /**
   * 初始化计算器
   */
  async init() {
    await this.loadPalData();
    this.setupEventListeners();
    this.uiManager.setupSearch();
    this.uiManager.initializeInputStyles();
  }

  /**
   * 加载帕鲁数据
   */
  async loadPalData() {
    const loadingOverlay = document.getElementById("loadingOverlay");

    await this.dataManager.loadPalData();
    this.uiManager.populateSelects();
    loadingOverlay.classList.add("hidden");
  }

  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    document.getElementById("parent1").addEventListener("change", () => {
      this.checkAndCalculate();
    });
    document.getElementById("parent2").addEventListener("change", () => {
      this.checkAndCalculate();
    });
    document.getElementById("resultSelect").addEventListener("change", () => {
      this.checkAndCalculate();
    });
    document
      .getElementById("generationSelect")
      .addEventListener("change", () => {
        this.checkAndCalculate();
      });
    document
      .getElementById("resetBtn")
      .addEventListener("click", () => this.uiManager.resetAll());

    // 图片加载错误处理
    document.addEventListener(
      "error",
      (e) => {
        if (e.target.tagName === "IMG") {
          e.target.src = this.uiManager.getDefaultImageSrc();
          e.target.style.display = "block";
          e.target.style.opacity = "1";
        }
      },
      true
    );
  }

  /**
   * 检查并执行相应的计算逻辑
   */
  checkAndCalculate() {
    const parent1Value = document.getElementById("parent1").value;
    const parent2Value = document.getElementById("parent2").value;
    const resultValue = document.getElementById("resultSelect").value;
    const palInfoDisplay = document.getElementById("palInfoDisplay");
    const searchResult = document.getElementById("searchResult");
    const generationSelector = document.getElementById("generationSelector");

    // 场景1：配种一和配种二都未选择 + 配种结果已选择 (反向查询所有组合)
    if (parent1Value === "" && parent2Value === "" && resultValue !== "") {
      palInfoDisplay.classList.remove("hidden");
      generationSelector.classList.add("hidden"); // 隐藏配种代数选择器
      searchResult.readOnly = false;
      this.calculateReverseBreeding();
      // 反向配种：始终显示“指定帕鲁”部分
      this.palFilterManager.showSelectPalSection();
    }
    // 场景2：配种一或配种二其中一个已选择 + 另一个未选择 + 配种结果已选择 (部分反向查询)
    else if (
      (parent1Value !== "" && parent2Value === "" && resultValue !== "") ||
      (parent1Value === "" && parent2Value !== "" && resultValue !== "")
    ) {
      palInfoDisplay.classList.remove("hidden");
      generationSelector.classList.remove("hidden"); // 显示配种代数选择器
      searchResult.readOnly = false;
      this.calculatePartialReverseBreeding();
      // 部分反向配种：无论直系/隔代，显示“指定帕鲁”
      this.palFilterManager.showSelectPalSection();
    }
    // 场景3：配种一和配种二都已选择 (正向计算)
    else if (parent1Value !== "" && parent2Value !== "") {
      palInfoDisplay.classList.remove("hidden");
      generationSelector.classList.add("hidden"); // 隐藏配种代数选择器
      searchResult.readOnly = false; // 允许编辑配种结果
      this.calculateBreeding();
      this.palFilterManager.hideSelectPalSection(); // 隐藏指定帕鲁部分
    }
    // 场景4：其他情况，隐藏帕鲁信息区域
    else {
      palInfoDisplay.classList.add("hidden");
      generationSelector.classList.add("hidden"); // 隐藏配种代数选择器
      searchResult.readOnly = false;
      this.palFilterManager.hideSelectPalSection(); // 隐藏指定帕鲁部分
    }
  }

  /**
   * 反向配种计算 - 查找所有能产生目标帕鲁的父代组合
   */
  calculateReverseBreeding() {
    const resultIndex = document.getElementById("resultSelect").value;
    if (resultIndex === "") return;

    const targetPal = this.dataManager.getPalByIndex(resultIndex);
    const breedingCombinations =
      this.breedingCalculator.calculateReverseBreeding(targetPal);

    this.resultRenderer.displayMultipleResults(breedingCombinations);
  }

  /**
   * 部分反向配种计算 - 已知一个父代，查找另一个父代
   */
  calculatePartialReverseBreeding() {
    const parent1Value = document.getElementById("parent1").value;
    const parent2Value = document.getElementById("parent2").value;
    const resultValue = document.getElementById("resultSelect").value;
    const generation = parseInt(
      document.getElementById("generationSelect").value
    );

    if (resultValue === "") return;

    const targetPal = this.dataManager.getPalByIndex(resultValue);
    const knownParent =
      parent1Value !== ""
        ? this.dataManager.getPalByIndex(parent1Value)
        : this.dataManager.getPalByIndex(parent2Value);
    const isParent1Known = parent1Value !== "";

    const breedingCombinations =
      this.breedingCalculator.calculatePartialReverseBreeding(
        knownParent,
        targetPal,
        isParent1Known,
        generation
      );

    // 显示结果，并传递代数信息用于控制指定帕鲁部分的显示
    this.resultRenderer.displayMultipleResults(
      breedingCombinations,
      generation
    );
  }

  /**
   * 计算配种结果
   */
  calculateBreeding() {
    const parent1Index = document.getElementById("parent1").value;
    const parent2Index = document.getElementById("parent2").value;

    if (parent1Index === "" || parent2Index === "") return;

    const parent1 = this.dataManager.getPalByIndex(parent1Index);
    const parent2 = this.dataManager.getPalByIndex(parent2Index);

    const result = this.breedingCalculator.calculateBreeding(parent1, parent2);

    if (result.type === "same_species") {
      this.resultRenderer.displayResult(result.result);
    } else if (result.type === "special") {
      this.resultRenderer.displayResult(result.result);
    } else if (result.type === "gender_specific") {
      this.resultRenderer.displayGenderSpecificResults(
        parent1,
        parent2,
        result.rules
      );
    } else if (result.type === "normal") {
      this.resultRenderer.displayResult(result.result);
    }
  }
}

// 当DOM加载完成后初始化计算器
document.addEventListener("DOMContentLoaded", () => {
  new PalBreedingCalculator();
});
