/**
 * UI管理器 - 负责用户界面交互、搜索、下拉框等功能
 */
class UIManager {
  constructor(dataManager) {
    this.dataManager = dataManager;
  }

  /**
   * 填充选择框
   */
  populateSelects() {
    const select1 = document.getElementById("parent1");
    const select2 = document.getElementById("parent2");
    const resultSelect = document.getElementById("resultSelect");

    const palData = this.dataManager.getPalData();
    palData.forEach((pal, index) => {
      const option1 = new Option(`${pal.index}：${pal.chinese_name}`, index);
      const option2 = new Option(`${pal.index}：${pal.chinese_name}`, index);
      const option3 = new Option(`${pal.index}：${pal.chinese_name}`, index);
      select1.appendChild(option1);
      select2.appendChild(option2);
      resultSelect.appendChild(option3);
    });
  }

  /**
   * 设置搜索功能
   */
  setupSearch() {
    this.setupSearchForInput("search1", "dropdown1", "parent1");
    this.setupSearchForInput("search2", "dropdown2", "parent2");
    this.setupSearchForInput("searchResult", "dropdownResult", "resultSelect");
    this.setupGenerationSearch();
  }

  /**
   * 防抖函数
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * 为特定输入框设置搜索功能
   */
  setupSearchForInput(searchId, dropdownId, selectId) {
    const searchInput = document.getElementById(searchId);
    const dropdown = document.getElementById(dropdownId);
    const select = document.getElementById(selectId);
    const arrow = document.getElementById(searchId.replace("search", "arrow"));

    // 防抖搜索 - 减少延迟提高响应速度
    const debouncedSearch = this.debounce((searchTerm) => {
      searchInput.classList.remove("loading");
      this.showDropdown(searchTerm, dropdown, select, searchInput, arrow);
    }, 150);

    // 输入事件
    searchInput.addEventListener("input", function () {
      const searchTerm = this.value.toLowerCase();
      this.classList.add("loading");
      debouncedSearch(searchTerm);
    });

    // 点击输入框时显示完整列表（不清空内容）
    searchInput.addEventListener("click", () => {
      // 显示完整列表，包含"未选择"选项
      this.showDropdown("", dropdown, select, searchInput, arrow, true);
    });

    // 失去焦点时隐藏下拉框
    searchInput.addEventListener("blur", () => {
      setTimeout(() => {
        dropdown.style.display = "none";
        if (arrow) arrow.classList.remove("open");
      }, 200);
    });

    // 点击下拉箭头时显示完整列表
    if (arrow) {
      arrow.addEventListener("click", () => {
        const isOpen = dropdown.style.display === "block";
        if (isOpen) {
          dropdown.style.display = "none";
          arrow.classList.remove("open");
        } else {
          this.showDropdown("", dropdown, select, searchInput, arrow, true);
        }
      });
    }

    // 键盘导航
    let highlightedIndex = -1;
    searchInput.addEventListener("keydown", (e) => {
      const items = dropdown.querySelectorAll(".dropdown-item");
      if (items.length === 0) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          highlightedIndex = Math.min(highlightedIndex + 1, items.length - 1);
          this.updateHighlight(items, highlightedIndex);
          break;
        case "ArrowUp":
          e.preventDefault();
          highlightedIndex = Math.max(highlightedIndex - 1, -1);
          this.updateHighlight(items, highlightedIndex);
          break;
        case "Enter":
          e.preventDefault();
          if (highlightedIndex >= 0 && items[highlightedIndex]) {
            items[highlightedIndex].click();
          }
          break;
        case "Escape":
          dropdown.style.display = "none";
          if (arrow) arrow.classList.remove("open");
          highlightedIndex = -1;
          break;
      }
    });

    // 重置高亮当下拉框内容改变时 - 使用现代的MutationObserver
    const observer = new MutationObserver(() => {
      highlightedIndex = -1;
    });
    observer.observe(dropdown, { childList: true, subtree: true });

    // 点击外部时隐藏下拉框
    document.addEventListener("click", (e) => {
      if (
        !searchInput.contains(e.target) &&
        !dropdown.contains(e.target) &&
        (!arrow || !arrow.contains(e.target))
      ) {
        dropdown.style.display = "none";
        if (arrow) arrow.classList.remove("open");
      }
    });
  }

  /**
   * 更新高亮显示
   */
  updateHighlight(items, index) {
    items.forEach((item, i) => {
      item.classList.toggle("highlighted", i === index);
    });
  }

  /**
   * 显示下拉框
   */
  showDropdown(
    searchTerm,
    dropdown,
    select,
    searchInput,
    arrow,
    showAll = false
  ) {
    dropdown.innerHTML = "";

    const filteredPals = this.dataManager.getFilteredPals(searchTerm, showAll);

    // 如果显示完整列表或搜索词为空，为配种一和配种二添加"清除帕鲁"选项
    if (
      (showAll || searchTerm === "") &&
      (searchInput.id === "search1" || searchInput.id === "search2")
    ) {
      const clearItem = document.createElement("div");
      clearItem.className = "dropdown-item clear-option";
      clearItem.innerHTML = `
        <span style="color: #6c757d; font-style: italic;">清除帕鲁</span>
      `;

      clearItem.addEventListener("click", () => {
        this.clearSelection(searchInput.id, select);
        dropdown.style.display = "none";
        if (arrow) arrow.classList.remove("open");
      });

      dropdown.appendChild(clearItem);
    }

    if (filteredPals.length === 0 && !showAll && searchTerm !== "") {
      dropdown.style.display = "none";
      if (arrow) arrow.classList.remove("open");
      return;
    }

    const palData = this.dataManager.getPalData();
    filteredPals.forEach((pal) => {
      const item = document.createElement("div");
      item.className = "dropdown-item";
      item.innerHTML = `
        <img src="images/${pal.image_name}.png" 
             alt="${pal.chinese_name}" 
             onerror="this.src='${this.getDefaultImageSrc()}'"
             style="width: 30px; height: 30px; object-fit: cover; border-radius: 4px; margin-right: 8px;">
        <span>${pal.index}：${pal.chinese_name}</span>
      `;

      item.addEventListener("click", () => {
        const palIndex = palData.findIndex((p) => p === pal);
        select.value = palIndex;
        searchInput.value = `${pal.index}：${pal.chinese_name}`;
        dropdown.style.display = "none";
        if (arrow) arrow.classList.remove("open");

        // 显示输入框图片
        this.showInputImage(searchInput.id, pal);

        // 触发change事件
        const event = new Event("change");
        select.dispatchEvent(event);
      });

      dropdown.appendChild(item);
    });

    dropdown.style.display = "block";
    if (arrow) arrow.classList.add("open");
  }

  /**
   * 显示输入框图片
   */
  showInputImage(searchInputId, pal) {
    const inputImageId = searchInputId
      .replace("search", "inputImage")
      .replace("Result", "Result");
    const inputImage = document.getElementById(inputImageId);
    const searchInput = document.getElementById(searchInputId);

    if (inputImage && searchInput) {
      // 清空之前的内容
      inputImage.innerHTML = "";

      // 创建图片元素
      const img = document.createElement("img");
      img.src = `images/${pal.image_name}.png`;
      img.alt = pal.chinese_name;
      img.onerror = () => {
        img.src = this.getDefaultImageSrc();
      };

      inputImage.appendChild(img);
      inputImage.style.display = "block";

      // 调整输入框样式
      searchInput.classList.remove("no-image");
    }
  }

  /**
   * 清空选择
   */
  clearSelection(searchInputId, select) {
    const inputImageId = searchInputId
      .replace("search", "inputImage")
      .replace("Result", "Result");
    const inputImage = document.getElementById(inputImageId);
    const searchInput = document.getElementById(searchInputId);

    // 清空选择
    select.value = "";
    searchInput.value = "";

    // 隐藏图片
    if (inputImage) {
      inputImage.style.display = "none";
      inputImage.innerHTML = "";
    }

    // 调整输入框样式
    if (searchInput) {
      searchInput.classList.add("no-image");
    }

    // 触发change事件
    const event = new Event("change");
    select.dispatchEvent(event);
  }

  /**
   * 重置所有内容
   */
  resetAll() {
    document.getElementById("parent1").value = "";
    document.getElementById("parent2").value = "";
    document.getElementById("resultSelect").value = "";
    document.getElementById("searchGeneration").value = "直系";
    const generationSelect = document.getElementById("generationSelect");
    if (generationSelect) {
      generationSelect.value = "1"; // 直系
      generationSelect.dispatchEvent(new Event("change")); // 通知监听器刷新逻辑
    }

    document.getElementById("search1").value = "";
    document.getElementById("search2").value = "";
    document.getElementById("searchResult").value = "";

    // 隐藏所有输入框图片
    const inputImages = ["inputImage1", "inputImage2", "inputImageResult"];
    inputImages.forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        element.style.display = "none";
        element.innerHTML = "";
      }
    });

    // 重置输入框样式
    const searchInputs = ["search1", "search2", "searchResult"];
    searchInputs.forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        element.classList.add("no-image");
      }
    });

    document.getElementById("dropdown1").style.display = "none";
    document.getElementById("dropdown2").style.display = "none";
    document.getElementById("dropdownResult").style.display = "none";

    // 重置下拉箭头状态
    const arrow1 = document.getElementById("arrow1");
    const arrow2 = document.getElementById("arrow2");
    const arrowResult = document.getElementById("arrowResult");
    if (arrow1) arrow1.classList.remove("open");
    if (arrow2) arrow2.classList.remove("open");
    if (arrowResult) arrowResult.classList.remove("open");

    // 重置配种结果输入框状态
    const searchResult = document.getElementById("searchResult");
    if (searchResult) {
      searchResult.readOnly = false;
    }

    // 清空配种结果容器
    const container = document.getElementById("breedingResultsContainer");
    if (container) {
      container.innerHTML = "";
    }

    // 隐藏帕鲁信息显示区域和配种代数选择器
    const palInfoDisplay = document.getElementById("palInfoDisplay");
    const generationSelector = document.getElementById("generationSelector");
    palInfoDisplay.classList.add("hidden");
    generationSelector.classList.add("hidden");
  }

  /**
   * 初始化输入框样式
   */
  initializeInputStyles() {
    const searchInputs = ["search1", "search2", "searchResult"];
    searchInputs.forEach((id) => {
      const element = document.getElementById(id);
      if (element) {
        element.classList.add("no-image");
      }
    });
  }

  /**
   * 设置亲属关系选择器的搜索功能
   */
  setupGenerationSearch() {
    const searchInput = document.getElementById("searchGeneration");
    const dropdown = document.getElementById("dropdownGeneration");
    const select = document.getElementById("generationSelect");
    const arrow = document.getElementById("arrowGeneration");

    // 初始化显示
    searchInput.value = "直系"; // 默认值
    select.value = "1";

    // 点击输入框或箭头显示下拉框
    const showGenerationDropdown = () => {
      dropdown.innerHTML = "";

      // 添加选项
      const options = [
        { value: "1", text: "直系" },
        { value: "2", text: "隔代" },
      ];

      options.forEach((option) => {
        const item = document.createElement("div");
        item.className = "dropdown-item";
        item.innerHTML = `<span>${option.text}</span>`;

        item.addEventListener("click", () => {
          select.value = option.value;
          searchInput.value = option.text;
          dropdown.style.display = "none";
          arrow.classList.remove("open");

          // 触发change事件
          const event = new Event("change");
          select.dispatchEvent(event);
        });

        dropdown.appendChild(item);
      });

      dropdown.style.display = "block";
      arrow.classList.add("open");
    };

    searchInput.addEventListener("click", showGenerationDropdown);
    arrow.addEventListener("click", showGenerationDropdown);

    // 点击外部关闭下拉框
    document.addEventListener("click", (e) => {
      if (!e.target.closest("#generationSelector")) {
        dropdown.style.display = "none";
        arrow.classList.remove("open");
      }
    });
  }

  /**
   * 获取默认图片源
   */
  getDefaultImageSrc() {
    return "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjZjhmOWZhIiBzdHJva2U9IiNlOWVjZWYiLz4KPHN2ZyB4PSIyMCIgeT0iMjAiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2Yzc1N2QiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj4KPHJlY3QgeD0iMyIgeT0iMyIgd2lkdGg9IjE4IiBoZWlnaHQ9IjE4IiByeD0iMiIgcnk9IjIiLz4KPGNpcmNsZSBjeD0iOC41IiBjeT0iOC41IiByPSIxLjUiLz4KPHBvbHlsaW5lIHBvaW50cz0iMjEsMTUgMTYsMTAgNSwyMSIvPgo8L3N2Zz4KPC9zdmc+";
  }
}
