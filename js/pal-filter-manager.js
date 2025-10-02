/**
 * 帕鲁筛选管理器 - 处理帕鲁剔除筛选功能
 */
class PalFilterManager {
  constructor(dataManager) {
    this.dataManager = dataManager;
    this.excludedPals = new Set(); // 存储被剔除的帕鲁名称
    this.selectedPals = new Set(); // 存储被选定的帕鲁名称
    this.availablePals = []; // 当前查询结果中的所有帕鲁
    this.originalResults = []; // 原始查询结果
    this.filteredResults = []; // 过滤后的结果

    this.initializeEventListeners();
  }

  /**
   * 通用的筛选操作处理
   */
  _performFilterOperation(palSet, pal, renderMethod, clearSearchMethod) {
    if (palSet.has(pal.name)) return;

    palSet.add(pal.name);
    renderMethod.call(this);
    this.updateFilteredResults();
    this.applyFilter();
    this.updateResultCount();
    this.updateAvailablePals();
    clearSearchMethod.call(this);
  }

  /**
   * 通用的标签创建
   */
  _createPalTag(pal, tagClass, removeMethod) {
    const tag = document.createElement("div");
    tag.className = tagClass;
    tag.innerHTML = `
      <img src="images/${pal.image_name}.png"
           alt="${pal.chinese_name}"
           class="${tagClass}-image"
           onerror="this.style.display='none'">
      <span>${pal.chinese_name}</span>
      <button class="${tagClass}-remove" data-pal-name="${pal.name}">×</button>
    `;

    const removeBtn = tag.querySelector(`.${tagClass}-remove`);
    removeBtn.addEventListener("click", () => {
      removeMethod.call(this, pal.name);
    });

    return tag;
  }

  /**
   * 通用的标签渲染
   */
  _renderPalTags(container, palSet, tagClass, removeMethod, emptyMessage) {
    container.innerHTML = "";

    if (palSet.size === 0) {
      container.innerHTML = `<div style="color: #6c757d; font-size: 12px; padding: 4px;">${emptyMessage}</div>`;
      return;
    }

    palSet.forEach((palName) => {
      const pal = this.dataManager.findPalByName(palName);
      if (!pal) return;

      const tag = this._createPalTag(pal, tagClass, removeMethod);
      container.appendChild(tag);
    });
  }

  /**
   * 初始化事件监听器
   */
  initializeEventListeners() {
    // 剔除帕鲁相关事件
    const excludeSearch = document.getElementById("excludePalSearch");
    const excludeArrow = document.getElementById("excludeArrow");

    // 搜索输入事件
    excludeSearch.addEventListener("input", (e) => {
      this.handleExcludeSearchInput(e.target.value);
    });

    // 键盘导航（↑/↓/Enter）
    excludeSearch.addEventListener("keydown", (e) => {
      this.handleDropdownKeydown(e, "exclude");
    });

    // 点击搜索框显示下拉框
    excludeSearch.addEventListener("click", () => {
      this.toggleExcludeDropdown();
    });

    // 点击下拉箭头
    excludeArrow.addEventListener("click", () => {
      this.toggleExcludeDropdown();
    });

    // 指定帕鲁相关事件
    const selectSearch = document.getElementById("selectPalSearch");
    const selectArrow = document.getElementById("selectArrow");

    // 搜索输入事件
    selectSearch.addEventListener("input", (e) => {
      this.handleSelectSearchInput(e.target.value);
    });

    // 键盘导航（↑/↓/Enter）
    selectSearch.addEventListener("keydown", (e) => {
      this.handleDropdownKeydown(e, "select");
    });

    // 点击搜索框显示下拉框
    selectSearch.addEventListener("click", () => {
      this.toggleSelectDropdown();
    });

    // 点击下拉箭头
    selectArrow.addEventListener("click", () => {
      this.toggleSelectDropdown();
    });

    // 点击外部关闭下拉框
    document.addEventListener("click", (e) => {
      if (
        !e.target.closest(".exclude-search") &&
        !e.target.closest(".select-search")
      ) {
        this.hideExcludeDropdown();
        this.hideSelectDropdown();
      }
    });

    // 清空按钮事件
    const clearAllExcludesBtn = document.getElementById("clearAllExcludes");
    const clearAllSelectsBtn = document.getElementById("clearAllSelects");

    clearAllExcludesBtn.addEventListener("click", () => {
      this.clearAllExcludes();
    });

    clearAllSelectsBtn.addEventListener("click", () => {
      this.clearAllSelects();
    });
  }

  /**
   * 显示筛选控件
   */
  showFilterControls() {
    const filterControls = document.getElementById("filterControls");
    filterControls.classList.remove("hidden");
  }

  /**
   * 显示指定帕鲁部分（仅在隔代配种时）
   */
  showSelectPalSection() {
    const selectPalSection = document.getElementById("selectPalSection");
    selectPalSection.classList.remove("hidden");
  }

  /**
   * 隐藏指定帕鲁部分
   */
  hideSelectPalSection() {
    const selectPalSection = document.getElementById("selectPalSection");
    selectPalSection.classList.add("hidden");
    this.clearAllSelects();
  }

  /**
   * 隐藏筛选控件
   */
  hideFilterControls() {
    const filterControls = document.getElementById("filterControls");
    filterControls.classList.add("hidden");
    this.clearAllExcludes();
    this.clearAllSelects();
  }

  /**
   * 设置查询结果数据
   */
  setResultData(breedingCombinations) {
    this.originalResults = breedingCombinations;
    this.extractAvailablePals();
    this.updateFilteredResults();
    this.updateResultCount();
  }

  /**
   * 从配种结果中提取所有帕鲁（基于原始结果）
   */
  extractAvailablePals() {
    this.availablePals = this.extractPalsFromResults(this.originalResults);
  }

  /**
   * 从指定的配种结果中提取帕鲁列表
   * @param {Array} results - 配种结果数组
   * @returns {Array} 帕鲁对象数组
   */
  extractPalsFromResults(results) {
    const palList = []; // 使用数组保持顺序
    const palSet = new Set(); // 用于去重

    results.forEach((combination) => {
      const addPal = (palName) => {
        if (!palSet.has(palName)) {
          palSet.add(palName);
          palList.push(palName);
        }
      };

      if (combination.isMultiGeneration) {
        // 二代配种结果
        const step1 = combination.generationPath.step1;
        const step2 = combination.generationPath.step2;

        addPal(step1.parent1.name);
        addPal(step1.parent2.name);
        addPal(step1.child.name);
        addPal(step2.parent1.name); // 添加step2的parent1
        addPal(step2.parent2.name);
        addPal(step2.child.name);
      } else {
        // 一代配种结果
        addPal(combination.parent1.name);
        addPal(combination.parent2.name);
        addPal(combination.child.name);
      }
    });

    // 获取当前选择的父代和子代帕鲁
    const excludeFromSelection = this.getCurrentSelectedPals();

    // 转换为帕鲁对象数组，排除当前选择的帕鲁，保持出现顺序
    return palList
      .map((name) => this.dataManager.findPalByName(name))
      .filter((pal) => pal !== null && !excludeFromSelection.has(pal.name));
  }

  /**
   * 更新可用帕鲁列表（基于当前过滤后的结果）
   */
  updateAvailablePals() {
    this.availablePals = this.extractPalsFromResults(this.filteredResults);
  }

  /**
   * 获取当前选择的父代和子代帕鲁
   */
  getCurrentSelectedPals() {
    const selectedPals = new Set();

    // 获取配种一
    const parent1Index = document.getElementById("parent1").value;
    if (parent1Index !== "") {
      const parent1 = this.dataManager.getPalByIndex(parent1Index);
      if (parent1) {
        selectedPals.add(parent1.name);
      }
    }

    // 获取配种二
    const parent2Index = document.getElementById("parent2").value;
    if (parent2Index !== "") {
      const parent2 = this.dataManager.getPalByIndex(parent2Index);
      if (parent2) {
        selectedPals.add(parent2.name);
      }
    }

    // 获取配种结果
    const resultIndex = document.getElementById("resultSelect").value;
    if (resultIndex !== "") {
      const result = this.dataManager.getPalByIndex(resultIndex);
      if (result) {
        selectedPals.add(result.name);
      }
    }

    return selectedPals;
  }

  /**
   * 处理剔除搜索输入
   */
  handleExcludeSearchInput(searchTerm) {
    if (searchTerm.trim() === "") {
      this.hideExcludeDropdown();
      return;
    }

    // 先关闭指定帕鲁下拉框，确保互斥显示
    this.hideSelectDropdown();

    const filteredPals = this.availablePals.filter(
      (pal) =>
        !this.excludedPals.has(pal.name) &&
        (pal.chinese_name.includes(searchTerm) ||
          pal.index.toString().includes(searchTerm))
    );

    this.renderExcludeDropdownItems(filteredPals);
    this.showExcludeDropdown();
  }

  /**
   * 处理选定搜索输入
   */
  handleSelectSearchInput(searchTerm) {
    if (searchTerm.trim() === "") {
      this.hideSelectDropdown();
      return;
    }

    // 先关闭剔除帕鲁下拉框，确保互斥显示
    this.hideExcludeDropdown();

    const filteredPals = this.availablePals.filter(
      (pal) =>
        !this.selectedPals.has(pal.name) &&
        (pal.chinese_name.includes(searchTerm) ||
          pal.index.toString().includes(searchTerm))
    );

    this.renderSelectDropdownItems(filteredPals);
    this.showSelectDropdown();
  }

  /**
   * 渲染剔除下拉选项
   */
  renderExcludeDropdownItems(pals) {
    const dropdown = document.getElementById("excludeDropdown");
    dropdown.innerHTML = "";

    if (pals.length === 0) {
      dropdown.innerHTML =
        '<div style="padding: 8px 12px; color: #6c757d; font-size: 13px;">未找到匹配的帕鲁</div>';
      return;
    }

    pals.forEach((pal) => {
      const item = document.createElement("div");
      item.className = "dropdown-item";
      item.innerHTML = `
        <img src="images/${pal.image_name}.png"
             alt="${pal.chinese_name}"
             class="dropdown-item-image"
             onerror="this.style.display='none'">
        <span class="dropdown-item-text">${pal.index}：${pal.chinese_name}</span>
      `;

      item.addEventListener("click", () => {
        this.addExcludePal(pal);
      });

      dropdown.appendChild(item);
    });
  }

  /**
   * 渲染选定下拉选项
   */
  renderSelectDropdownItems(pals) {
    const dropdown = document.getElementById("selectDropdown");
    dropdown.innerHTML = "";

    if (pals.length === 0) {
      dropdown.innerHTML =
        '<div style="padding: 8px 12px; color: #6c757d; font-size: 13px;">未找到匹配的帕鲁</div>';
      return;
    }

    pals.forEach((pal) => {
      const item = document.createElement("div");
      item.className = "dropdown-item";
      item.innerHTML = `
        <img src="images/${pal.image_name}.png"
             alt="${pal.chinese_name}"
             class="dropdown-item-image"
             onerror="this.style.display='none'">
        <span class="dropdown-item-text">${pal.index}：${pal.chinese_name}</span>
      `;

      item.addEventListener("click", () => {
        this.addSelectPal(pal);
      });

      dropdown.appendChild(item);
    });
  }

  /**
   * 添加剔除帕鲁
   */
  addExcludePal(pal) {
    this._performFilterOperation(
      this.excludedPals,
      pal,
      this.renderSelectedExcludes,
      () => {
        document.getElementById("excludePalSearch").value = "";
        this.hideExcludeDropdown();
      }
    );
  }

  /**
   * 移除剔除帕鲁
   */
  removeExcludePal(palName) {
    this.excludedPals.delete(palName);
    this.renderSelectedExcludes();
    this.updateFilteredResults();
    this.applyFilter();
    this.updateResultCount();

    // 重要：更新可用帕鲁列表，基于当前过滤后的结果
    this.updateAvailablePals();
  }

  /**
   * 添加指定帕鲁
   */
  addSelectPal(pal) {
    this._performFilterOperation(
      this.selectedPals,
      pal,
      this.renderSelectedSelects,
      () => {
        document.getElementById("selectPalSearch").value = "";
        this.hideSelectDropdown();
      }
    );
  }

  /**
   * 移除指定帕鲁
   */
  removeSelectPal(palName) {
    this.selectedPals.delete(palName);
    this.renderSelectedSelects();
    this.updateFilteredResults();
    this.applyFilter();
    this.updateResultCount();

    // 重要：更新可用帕鲁列表，基于当前过滤后的结果
    this.updateAvailablePals();
  }

  /**
   * 渲染已选择的剔除帕鲁
   */
  renderSelectedExcludes() {
    const container = document.getElementById("selectedExcludes");
    this._renderPalTags(
      container,
      this.excludedPals,
      "exclude-tag",
      this.removeExcludePal,
      "暂无剔除的帕鲁"
    );
  }

  /**
   * 渲染指定帕鲁标签
   */
  renderSelectedSelects() {
    const container = document.getElementById("selectedSelects");
    this._renderPalTags(
      container,
      this.selectedPals,
      "select-tag",
      this.removeSelectPal,
      "暂无选定的帕鲁"
    );
  }

  /**
   * 更新过滤后的结果
   */
  updateFilteredResults() {
    // 第一步：剔除筛选
    let results = this.originalResults.filter((combination) => {
      return !this.combinationContainsExcludedPal(combination);
    });

    // 第二步：选定筛选（如果有选定的帕鲁）
    if (this.selectedPals.size > 0) {
      results = results.filter((combination) => {
        return this.combinationContainsSelectedPal(combination);
      });
    }

    this.filteredResults = results;
  }

  /**
   * 检查配种组合是否包含被剔除的帕鲁
   */
  combinationContainsExcludedPal(combination) {
    if (combination.isMultiGeneration) {
      // 二代配种结果
      const step1 = combination.generationPath.step1;
      const step2 = combination.generationPath.step2;

      return (
        this.excludedPals.has(step1.parent1.name) ||
        this.excludedPals.has(step1.parent2.name) ||
        this.excludedPals.has(step1.child.name) ||
        this.excludedPals.has(step2.parent1.name) || // 添加step2的parent1检查
        this.excludedPals.has(step2.parent2.name) ||
        this.excludedPals.has(step2.child.name)
      );
    } else {
      // 一代配种结果
      return (
        this.excludedPals.has(combination.parent1.name) ||
        this.excludedPals.has(combination.parent2.name) ||
        this.excludedPals.has(combination.child.name)
      );
    }
  }

  /**
   * 检查配种组合是否包含被选定的帕鲁（OR逻辑）
   */
  combinationContainsSelectedPal(combination) {
    if (combination.isMultiGeneration) {
      // 二代配种结果
      const step1 = combination.generationPath.step1;
      const step2 = combination.generationPath.step2;

      return (
        this.selectedPals.has(step1.parent1.name) ||
        this.selectedPals.has(step1.parent2.name) ||
        this.selectedPals.has(step1.child.name) ||
        this.selectedPals.has(step2.parent1.name) ||
        this.selectedPals.has(step2.parent2.name) ||
        this.selectedPals.has(step2.child.name)
      );
    } else {
      // 一代配种结果
      return (
        this.selectedPals.has(combination.parent1.name) ||
        this.selectedPals.has(combination.parent2.name) ||
        this.selectedPals.has(combination.child.name)
      );
    }
  }

  /**
   * 应用筛选
   */
  applyFilter() {
    const container = document.getElementById("breedingResultsContainer");
    const resultElements = container.querySelectorAll(".breeding-result");

    // 重置所有元素的显示状态
    resultElements.forEach((element) => {
      element.classList.remove("filtered-hidden");
    });

    // 如果没有任何筛选条件，显示所有结果
    if (this.excludedPals.size === 0 && this.selectedPals.size === 0) {
      return;
    }

    // 隐藏不符合筛选条件的结果
    resultElements.forEach((element, index) => {
      if (index < this.originalResults.length) {
        const combination = this.originalResults[index];

        // 检查是否应该隐藏这个结果
        let shouldHide = false;

        // 第一步：剔除筛选
        if (this.combinationContainsExcludedPal(combination)) {
          shouldHide = true;
        }

        // 第二步：选定筛选（只有在没有被剔除的情况下才检查）
        if (!shouldHide && this.selectedPals.size > 0) {
          if (!this.combinationContainsSelectedPal(combination)) {
            shouldHide = true;
          }
        }

        if (shouldHide) {
          element.classList.add("filtered-hidden");
        }
      }
    });
  }

  /**
   * 清空所有剔除
   */
  clearAllExcludes() {
    this.excludedPals.clear();
    this.renderSelectedExcludes();
    this.updateFilteredResults();
    this.applyFilter();
    this.updateResultCount();

    // 重要：更新可用帕鲁列表，基于当前过滤后的结果
    this.updateAvailablePals();

    document.getElementById("excludePalSearch").value = "";
    this.hideExcludeDropdown();
  }

  /**
   * 清空所有选定
   */
  clearAllSelects() {
    this.selectedPals.clear();
    this.renderSelectedSelects();
    this.updateFilteredResults();
    this.applyFilter();
    this.updateResultCount();

    // 重要：更新可用帕鲁列表，基于当前过滤后的结果
    this.updateAvailablePals();

    document.getElementById("selectPalSearch").value = "";
    this.hideSelectDropdown();
  }

  /**
   * 更新结果数量显示
   */
  updateResultCount() {
    const resultCount = document.getElementById("resultCount");
    const total = this.originalResults.length;
    const filtered = this.filteredResults.length;

    if (this.excludedPals.size === 0 && this.selectedPals.size === 0) {
      resultCount.textContent = `共 ${total} 个配种组合`;
    } else {
      const excludeInfo =
        this.excludedPals.size > 0 ? `剔除 ${this.excludedPals.size} 种` : "";
      const selectInfo =
        this.selectedPals.size > 0 ? `选定 ${this.selectedPals.size} 种` : "";
      const filterInfo = [excludeInfo, selectInfo]
        .filter((info) => info)
        .join("，");
      resultCount.textContent = `显示 ${filtered} / ${total} 个配种组合（${filterInfo}）`;
    }
  }

  /**
   * 显示剔除下拉框
   */
  showExcludeDropdown() {
    const dropdown = document.getElementById("excludeDropdown");
    dropdown.style.display = "block";
  }

  /**
   * 隐藏剔除下拉框
   */
  hideExcludeDropdown() {
    const dropdown = document.getElementById("excludeDropdown");
    dropdown.style.display = "none";
  }

  /**
   * 切换剔除下拉框显示状态
   */
  toggleExcludeDropdown() {
    const dropdown = document.getElementById("excludeDropdown");
    if (dropdown.style.display === "block") {
      this.hideExcludeDropdown();
    } else {
      // 先关闭指定帕鲁下拉框，确保互斥显示
      this.hideSelectDropdown();

      // 显示所有可用帕鲁（排除已剔除的）
      const availablePalsToShow = this.availablePals.filter(
        (pal) => !this.excludedPals.has(pal.name)
      );
      this.renderExcludeDropdownItems(availablePalsToShow);
      this.showExcludeDropdown();
    }
  }

  /**
   * 显示选定下拉框
   */
  showSelectDropdown() {
    const dropdown = document.getElementById("selectDropdown");
    dropdown.style.display = "block";
  }

  /**
   * 隐藏选定下拉框
   */
  hideSelectDropdown() {
    const dropdown = document.getElementById("selectDropdown");
    dropdown.style.display = "none";
  }

  /**
   * 切换选定下拉框显示状态
   */
  toggleSelectDropdown() {
    const dropdown = document.getElementById("selectDropdown");
    if (dropdown.style.display === "block") {
      this.hideSelectDropdown();
    } else {
      // 先关闭剔除帕鲁下拉框，确保互斥显示
      this.hideExcludeDropdown();

      // 显示所有可用帕鲁（排除已选定的）
      const availablePalsToShow = this.availablePals.filter(
        (pal) => !this.selectedPals.has(pal.name)
      );
      this.renderSelectDropdownItems(availablePalsToShow);
      this.showSelectDropdown();
    }
  }

  /**
   * 下拉框键盘导航处理（↑/↓/Enter）
   */
  handleDropdownKeydown(e, type) {
    const isUp = e.key === "ArrowUp";
    const isDown = e.key === "ArrowDown";
    const isEnter = e.key === "Enter";
    if (!isUp && !isDown && !isEnter) return;

    const dropdownId =
      type === "exclude" ? "excludeDropdown" : "selectDropdown";
    const dropdown = document.getElementById(dropdownId);
    if (!dropdown || dropdown.style.display !== "block") return;

    const items = Array.from(dropdown.querySelectorAll(".dropdown-item"));
    if (items.length === 0) return;

    e.preventDefault();

    // 当前高亮索引
    let currentIndex = items.findIndex((el) => el.classList.contains("active"));

    // 方向键更新索引
    if (isDown) {
      currentIndex = (currentIndex + 1) % items.length;
    } else if (isUp) {
      currentIndex = (currentIndex - 1 + items.length) % items.length;
    }

    // 清除原有高亮并设置新高亮
    items.forEach((el) => el.classList.remove("active"));
    const activeEl = items[currentIndex];
    activeEl.classList.add("active");

    // 让高亮项可见
    activeEl.scrollIntoView({ block: "nearest" });

    // 回车选中
    if (isEnter) {
      activeEl.click();
    }
  }
}
