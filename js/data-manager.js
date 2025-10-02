/**
 * 数据管理器 - 负责帕鲁数据的加载、排序和管理
 */
class DataManager {
  constructor() {
    this.palData = [];
  }

  /**
   * 加载帕鲁数据
   */
  async loadPalData() {
    // 直接使用常量数据，避免CORS问题
    this.palData = PAL_DATA;

    // 按CombiRank排序，确保index排序的正确性
    this.palData.sort((a, b) => {
      if (a.CombiRank === b.CombiRank) {
        // 如果CombiRank相同，按index排序
        const indexA = parseInt(a.index.replace("#", "")) || 999;
        const indexB = parseInt(b.index.replace("#", "")) || 999;
        return indexA - indexB;
      }
      return a.CombiRank - b.CombiRank;
    });

    // 预构建用于 findClosestPal 的二分索引与缓存
    this._buildFindClosestCache();

    return this.palData;
  }

  /**
   * 获取帕鲁数据
   */
  getPalData() {
    return this.palData;
  }

  /**
   * 根据索引获取帕鲁
   */
  getPalByIndex(index) {
    return this.palData[index];
  }

  /**
   * 根据名称查找帕鲁
   */
  findPalByName(name) {
    return this.palData.find((pal) => pal.name === name);
  }

  /**
   * 检查是否为特殊帕鲁（只能通过特殊规则或同种配种获得）
   */
  isSpecialPal(pal) {
    // 检查是否定义了特殊配种规则
    if (typeof SPECIAL_BREEDING_RULES === "undefined") {
      return false;
    }
    // 检查该帕鲁是否在特殊配种规则中作为child出现
    return SPECIAL_BREEDING_RULES.some((rule) => rule.child === pal.name);
  }

  /**
   * 构建二分索引与结果缓存
   */
  _buildFindClosestCache() {
    // ranks 数组与 pals 同步，用于二分查找
    this._ranks = this.palData.map((p) => p.CombiRank);

    // 预标记特殊子代（用于跳过）
    this._isSpecial = this.palData.map((p) => this.isSpecialPal(p));

    // 预计算最近的非特殊上/下邻下标，便于快速跳过
    const n = this.palData.length;
    this._nextNonSpecialBelow = new Array(n).fill(-1);
    this._nextNonSpecialAbove = new Array(n).fill(-1);

    let last = -1;
    for (let i = 0; i < n; i++) {
      this._nextNonSpecialBelow[i] = last;
      if (!this._isSpecial[i]) last = i;
    }
    let next = -1;
    for (let i = n - 1; i >= 0; i--) {
      this._nextNonSpecialAbove[i] = next;
      if (!this._isSpecial[i]) next = i;
    }

    // 结果缓存：targetRank(int) -> pal
    this._closestCache = new Map();

    // 可选：预热常用区间缓存（0..最大CombiRank）
    const maxRank = this._ranks.length
      ? this._ranks[this._ranks.length - 1]
      : 0;
    for (let r = 0; r <= maxRank; r++) {
      const pal = this._findClosestByBinary(r);
      if (pal) this._closestCache.set(r, pal);
    }
  }

  /**
   * 基于二分与相邻比较的内部查找（跳过特殊）
   */
  _findClosestByBinary(targetRank) {
    if (!this._ranks || this._ranks.length === 0) return null;

    // 二分定位插入点（下界）
    let lo = 0,
      hi = this._ranks.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this._ranks[mid] < targetRank) lo = mid + 1;
      else hi = mid;
    }

    // 候选点：lo 左侧与 lo 位置
    const candidates = [];
    const pushIfValid = (idx) => {
      if (idx >= 0 && idx < this._ranks.length && !this._isSpecial[idx]) {
        candidates.push(idx);
      }
    };

    // 尝试从 lo 左右找最近的非特殊
    const leftIdx = lo - 1;
    const rightIdx = lo;

    // 从左侧回溯到最近非特殊
    if (leftIdx >= 0) {
      let li = leftIdx;
      if (this._isSpecial[li]) {
        // 利用 nextNonSpecialBelow
        li = this._nextNonSpecialBelow[leftIdx];
      }
      pushIfValid(li);
    }

    // 从右侧前进到最近非特殊
    if (rightIdx < this._ranks.length) {
      let ri = rightIdx;
      if (this._isSpecial[ri]) {
        // 利用 nextNonSpecialAbove
        ri = this._nextNonSpecialAbove[rightIdx];
      }
      pushIfValid(ri);
    }

    if (candidates.length === 0) return null;

    // 在候选中选最近；相等时比较 Priority（越大越优先），若仍相等则取 CombiRank 更小
    let best = candidates[0];
    let bestDist = Math.abs(this._ranks[best] - targetRank);
    for (let k = 1; k < candidates.length; k++) {
      const idx = candidates[k];
      const dist = Math.abs(this._ranks[idx] - targetRank);
      if (dist < bestDist) {
        best = idx;
        bestDist = dist;
      } else if (dist === bestDist) {
        const pBest = this.palData[best]?.Priority ?? 0;
        const pIdx = this.palData[idx]?.Priority ?? 0;
        if (pIdx > pBest) {
          best = idx;
        } else if (pIdx === pBest) {
          if (this._ranks[idx] < this._ranks[best]) best = idx;
        }
      }
    }
    return this.palData[best] || null;
  }

  /**
   * 找到最接近的帕鲁（相等时以 Priority 最大者为优先；若仍相等则取 CombiRank 更小）
   */
  findClosestPal(targetRank) {
    if (!this._closestCache) {
      // 兼容性：在未初始化时构建缓存
      this._buildFindClosestCache();
    }
    const key = Math.floor(targetRank);
    if (this._closestCache.has(key)) {
      return this._closestCache.get(key);
    }
    const pal = this._findClosestByBinary(key);
    if (pal) this._closestCache.set(key, pal);
    return pal;
  }

  /**
   * 兼容旧接口：findClosestPalPreferSmall —— 现统一为 Priority 优先
   */
  findClosestPalPreferSmall(targetRank) {
    return this.findClosestPal(targetRank);
  }

  /**
   * 初始化搜索缓存
   */
  initializeSearchCache() {
    if (!this.searchCache) {
      this.searchCache = {
        sortedByIndex: null,
        searchableData: null,
      };
    }
  }

  /**
   * 获取按索引排序的帕鲁列表（缓存版本）
   */
  getSortedByIndex() {
    this.initializeSearchCache();

    if (!this.searchCache.sortedByIndex) {
      this.searchCache.sortedByIndex = [...this.palData].sort((a, b) => {
        const indexA =
          a.index === "#-1"
            ? 999999
            : a.index === "#0"
            ? 999998
            : parseInt(a.index.replace("#", "")) || 999997;
        const indexB =
          b.index === "#-1"
            ? 999999
            : b.index === "#0"
            ? 999998
            : parseInt(b.index.replace("#", "")) || 999997;
        return indexA - indexB;
      });
    }

    return this.searchCache.sortedByIndex;
  }

  /**
   * 获取预处理的搜索数据（缓存版本）
   */
  getSearchableData() {
    this.initializeSearchCache();

    if (!this.searchCache.searchableData) {
      this.searchCache.searchableData = this.palData.map((pal) => ({
        pal,
        chineseName: pal.chinese_name.toLowerCase(),
        englishName: pal.name.toLowerCase(),
        index: pal.index.toLowerCase(),
        indexNum:
          pal.index === "#-1"
            ? 999999
            : pal.index === "#0"
            ? 999998
            : parseInt(pal.index.replace("#", "")) || 999997,
      }));
    }

    return this.searchCache.searchableData;
  }

  /**
   * 获取过滤后的帕鲁列表（优化版本）
   */
  getFilteredPals(searchTerm, showAll = false) {
    if (showAll || searchTerm === "") {
      return this.getSortedByIndex();
    }

    // 使用预处理的搜索数据进行快速搜索
    const searchableData = this.getSearchableData();
    const searchTermLower = searchTerm.toLowerCase();

    const filteredData = searchableData.filter((item) => {
      return (
        item.chineseName.includes(searchTermLower) ||
        item.englishName.includes(searchTermLower) ||
        item.index.includes(searchTermLower)
      );
    });

    // 快速排序：优先级排序
    filteredData.sort((a, b) => {
      // 优先显示中文名称开头匹配的
      const aChineseStartsWith = a.chineseName.startsWith(searchTermLower);
      const bChineseStartsWith = b.chineseName.startsWith(searchTermLower);
      if (aChineseStartsWith && !bChineseStartsWith) return -1;
      if (!aChineseStartsWith && bChineseStartsWith) return 1;

      // 然后显示英文名称开头匹配的
      const aEnglishStartsWith = a.englishName.startsWith(searchTermLower);
      const bEnglishStartsWith = b.englishName.startsWith(searchTermLower);
      if (aEnglishStartsWith && !bEnglishStartsWith) return -1;
      if (!aEnglishStartsWith && bEnglishStartsWith) return 1;

      // 最后按预计算的index排序
      return a.indexNum - b.indexNum;
    });

    // 返回帕鲁对象数组
    return filteredData.map((item) => item.pal);
  }
}
