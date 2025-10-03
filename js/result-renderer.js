/**
 * 结果显示器 - 负责配种结果的显示和渲染
 */
class ResultRenderer {
  constructor(dataManager) {
    this.dataManager = dataManager;
    this.palFilterManager = new PalFilterManager(dataManager);
  }

  /**
   * 显示计算结果
   */
  displayResult(closestPal) {
    if (!closestPal) return;

    // 获取当前选择的父代帕鲁
    const parent1Index = document.getElementById("parent1").value;
    const parent2Index = document.getElementById("parent2").value;

    if (parent1Index === "" || parent2Index === "") return;

    const parent1 = this.dataManager.getPalByIndex(parent1Index);
    const parent2 = this.dataManager.getPalByIndex(parent2Index);

    // 更新配种结果选择框
    const resultSelect = document.getElementById("resultSelect");
    const searchResult = document.getElementById("searchResult");
    const resultIndex = this.dataManager
      .getPalData()
      .findIndex((pal) => pal === closestPal);
    resultSelect.value = resultIndex;
    searchResult.value = `${closestPal.index}：${closestPal.chinese_name}`;

    // 更新配种结果输入框的图片
    this.updateResultInputImage(closestPal);

    // 显示单一配种结果
    this.displaySingleResult(parent1, parent2, closestPal);
  }

  /**
   * 显示单一配种结果
   */
  displaySingleResult(parent1, parent2, child) {
    const container = document.getElementById("breedingResultsContainer");
    container.innerHTML = ""; // 清空现有内容

    // 隐藏筛选控件（单一结果不需要筛选）
    this.palFilterManager.hideFilterControls();

    // 创建单一配种结果
    const resultElement = this.createBreedingResult(
      parent1,
      parent2,
      child,
      null,
      null // 无性别信息
    );

    container.appendChild(resultElement);
  }

  /**
   * 显示多个配种结果（反向查询）
   */
  displayMultipleResults(breedingCombinations, generation = null) {
    const container = document.getElementById("breedingResultsContainer");
    container.innerHTML = ""; // 清空现有内容

    if (breedingCombinations.length === 0) {
      container.innerHTML =
        '<div style="text-align: center; color: #6c757d; padding: 20px;">未找到匹配的配种组合</div>';
      this.palFilterManager.hideFilterControls();
      return;
    }

    // 设置筛选管理器的数据
    this.palFilterManager.setResultData(breedingCombinations);
    this.palFilterManager.showFilterControls();

    // 反向配种模式：无论直系/隔代，始终显示“指定帕鲁”
    this.palFilterManager.showSelectPalSection();

    // 在切换代数时清空剔除帕鲁和选中帕鲁
    if (generation !== null) {
      this.palFilterManager.clearAllExcludes();
      this.palFilterManager.clearAllSelects();
    }

    // 显示所有配种组合，不限制数量
    breedingCombinations.forEach((combination) => {
      let resultElement;

      if (combination.isMultiGeneration) {
        // 二代配种结果
        resultElement = this.createMultiGenerationBreedingResult(combination);
      } else {
        // 一代配种结果
        resultElement = this.createBreedingResult(
          combination.parent1,
          combination.parent2,
          combination.child,
          null,
          null // 无性别信息
        );
      }

      container.appendChild(resultElement);
    });
  }

  /**
   * 显示性别相关的多重配种结果
   */
  displayGenderSpecificResults(parent1, parent2, genderRules) {
    const container = document.getElementById("breedingResultsContainer");
    container.innerHTML = ""; // 清空现有内容

    const childPals = []; // 收集所有子代帕鲁

    // 为每个性别规则创建一个配种结果
    genderRules.forEach((rule) => {
      const isFirstParent = rule.parent1 === parent1.name;

      // 确定每个路径的父代顺序
      const pathParent1 = isFirstParent ? parent1 : parent2;
      const pathParent2 = isFirstParent ? parent2 : parent1;
      const pathParent1Gender = rule.parent1Gender;
      const pathParent2Gender = rule.parent2Gender;

      // 找到子代帕鲁
      const childPal = this.dataManager.findPalByName(rule.child);
      if (childPal) {
        childPals.push(childPal);
      }

      // 创建配种结果元素
      const resultElement = this.createBreedingResult(
        pathParent1,
        pathParent2,
        childPal,
        pathParent1Gender,
        pathParent2Gender
      );

      container.appendChild(resultElement);
    });

    // 更新结果文本框显示多重结果
    this.updateMultipleResultsTextBox(childPals);

    // 更新配种结果输入框的图片（如果只有一个结果）
    if (childPals.length === 1) {
      this.updateResultInputImage(childPals[0]);
    } else if (childPals.length > 1) {
      // 多重结果时清空图片
      this.clearResultInputImage();
    }

    // 显示帕鲁信息区域
    document.getElementById("palInfoDisplay").classList.remove("hidden");
  }

  /**
   * 更新多重结果文本框
   */
  updateMultipleResultsTextBox(childPals) {
    const resultSelect = document.getElementById("resultSelect");
    const searchResult = document.getElementById("searchResult");

    if (childPals.length === 0) return;

    if (childPals.length === 1) {
      // 单一结果
      const pal = childPals[0];
      const palData = this.dataManager.getPalData();
      const resultIndex = palData.findIndex((p) => p === pal);
      resultSelect.value = resultIndex;
      searchResult.value = `${pal.index}：${pal.chinese_name}`;
    } else {
      // 多重结果
      const palNames = childPals.map((pal) => pal.chinese_name).join("、");
      resultSelect.value = "";
      searchResult.value = `${palNames}`;
    }
  }

  /**
   * 创建配种结果元素
   */
  createBreedingResult(parent1, parent2, child, parent1Gender, parent2Gender) {
    // 统一处理大小写和空格
    const g1 = parent1Gender ? parent1Gender.trim().toLowerCase() : "";
    const g2 = parent2Gender ? parent2Gender.trim().toLowerCase() : "";

    const resultDiv = document.createElement("div");
    resultDiv.className = "breeding-result";
    const defaultImageSrc = this.getDefaultImageSrc();

    const searchBtn = `<button class="bing-search-btn" onclick="searchPal('${child.chinese_name}')" title="在必应搜索">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M10 2a8 8 0 018 8c0 1.848-.627 3.55-1.68 4.905l3.387 3.388a1 1 0 01-1.414 1.414l-3.388-3.387A7.965 7.965 0 0110 18a8 8 0 110-16zm0 2a6 6 0 100 12 6 6 0 000-12z"/>
            </svg>
          </button>
          
          <button class="bing-search-btn" onclick="openWiki('${child.chinese_name}')" title="打开Wiki">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
          </button>`;

    resultDiv.innerHTML = `
    <div class="breeding-formula">
      <div class="pal-card">
        <img src="images/${parent1.image_name}.png"
             alt="${parent1.chinese_name}"
             class="pal-image"
             onerror="this.src='${defaultImageSrc}'">
        <div class="pal-name-container">
          <span class="pal-chinese">${parent1.chinese_name}${searchBtn}</span>
          ${
        g1
            ? `<span class="gender-symbol ${g1}" style="display: inline;">${
                g1 === "male" ? "♂" : "♀"
            }</span>`
            : ""
    }
          
        </div>
      </div>
      <div class="math-symbol">+</div>
      <div class="pal-card">
        <img src="images/${parent2.image_name}.png"
             alt="${parent2.chinese_name}"
             class="pal-image"
             onerror="this.src='${defaultImageSrc}'">
        <div class="pal-name-container">
          <span class="pal-chinese">${parent2.chinese_name} ${searchBtn}</span>
          ${
        g2
            ? `<span class="gender-symbol ${g2}" style="display: inline;">${
                g2 === "male" ? "♂" : "♀"
            }</span>`
            : ""
    }
         
        </div>
      </div>
      <div class="math-symbol">=</div>
      <div class="pal-card">
        <img src="images/${child.image_name}.png"
             alt="${child.chinese_name}"
             class="pal-image"
             onerror="this.src='${defaultImageSrc}'">
        <div class="pal-name-container">
          <span class="pal-chinese">${child.chinese_name}${searchBtn}</span>
          
        </div>
      </div>
    </div>
  `;

    return resultDiv;
  }

  /**
   * 创建二代配种结果元素
   */
  createMultiGenerationBreedingResult(combination) {

    const resultDiv = document.createElement("div");
    resultDiv.className = "breeding-result multi-generation";

    const defaultImageSrc = this.getDefaultImageSrc();
    const step1 = combination.generationPath.step1;
    const step2 = combination.generationPath.step2;
    const searchBtn = `<button class="bing-search-btn" onclick="searchPal('${step1.parent1.chinese_name}')" title="在必应搜索">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M10 2a8 8 0 018 8c0 1.848-.627 3.55-1.68 4.905l3.387 3.388a1 1 0 01-1.414 1.414l-3.388-3.387A7.965 7.965 0 0110 18a8 8 0 110-16zm0 2a6 6 0 100 12 6 6 0 000-12z"/>
            </svg>
          </button>
          
          <button class="bing-search-btn" onclick="openWiki('${step1.parent1.chinese_name}')" title="打开Wiki">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
          </button>`;
    resultDiv.innerHTML = `
      <div class="breeding-formula">
        <div class="pal-card">
          <img src="images/${step1.parent1.image_name}.png"
               alt="${step1.parent1.chinese_name}"
               class="pal-image"
               onerror="this.src='${defaultImageSrc}'">
          <div class="pal-name-container">
            <span class="pal-chinese">${step1.parent1.chinese_name}${searchBtn}</span>
            
          </div>
        </div>
        <div class="math-symbol">+</div>
        <div class="pal-card">
          <img src="images/${step1.parent2.image_name}.png"
               alt="${step1.parent2.chinese_name}"
               class="pal-image"
               onerror="this.src='${defaultImageSrc}'">
          <div class="pal-name-container">
            <span class="pal-chinese">${step1.parent2.chinese_name}${searchBtn}</span>
          </div>
        </div>
        <div class="math-symbol">=</div>
        <div class="pal-card">
          <img src="images/${step1.child.image_name}.png"
               alt="${step1.child.chinese_name}"
               class="pal-image"
               onerror="this.src='${defaultImageSrc}'">
          <div class="pal-name-container">
            <span class="pal-chinese">${step1.child.chinese_name}${searchBtn}</span>
           
          </div>
        </div>
        <div class="math-symbol">+</div>
        <div class="pal-card">
          <img src="images/${step2.parent2.image_name}.png"
               alt="${step2.parent2.chinese_name}"
               class="pal-image"
               onerror="this.src='${defaultImageSrc}'">
          <div class="pal-name-container">
            <span class="pal-chinese">${step2.parent2.chinese_name}${searchBtn}</span>
            
          </div>
        </div>
        <div class="math-symbol">=</div>
        <div class="pal-card">
          <img src="images/${step2.child.image_name}.png"
               alt="${step2.child.chinese_name}"
               class="pal-image"
               onerror="this.src='${defaultImageSrc}'">
          <div class="pal-name-container">
            <span class="pal-chinese">${step2.child.chinese_name}${searchBtn}</span>
   
          </div>
        </div>
      </div>
    `;

    return resultDiv;
  }

  /**
   * 更新配种结果输入框的图片
   */
  updateResultInputImage(pal) {
    const inputImage = document.getElementById("inputImageResult");
    const searchInput = document.getElementById("searchResult");

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
   * 清空配种结果输入框的图片
   */
  clearResultInputImage() {
    const inputImage = document.getElementById("inputImageResult");
    const searchInput = document.getElementById("searchResult");

    if (inputImage && searchInput) {
      inputImage.innerHTML = "";
      inputImage.style.display = "none";
      searchInput.classList.add("no-image");
    }
  }

  /**
   * 获取默认图片源
   */
  getDefaultImageSrc() {
    return "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSIjZjhmOWZhIiBzdHJva2U9IiNlOWVjZWYiLz4KPHN2ZyB4PSIyMCIgeT0iMjAiIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM2Yzc1N2QiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIj4KPHJlY3QgeD0iMyIgeT0iMyIgd2lkdGg9IjE4IiBoZWlnaHQ9IjE4IiByeD0iMiIgcnk9IjIiLz4KPGNpcmNsZSBjeD0iOC41IiBjeT0iOC41IiByPSIxLjUiLz4KPHBvbHlsaW5lIHBvaW50cz0iMjEsMTUgMTYsMTAgNSwyMSIvPgo8L3N2Zz4KPC9zdmc+";
  }
}
function searchPal(palName) {
  window.open('https://www.bing.com/search?q=' + encodeURIComponent("幻兽帕鲁 " + palName), '_blank');
}
function openWiki(palName) {
  window.open('https://wiki.biligame.com/palworld/' + encodeURIComponent(palName), '_blank');
}