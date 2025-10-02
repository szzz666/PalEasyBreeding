/**
 * 配种计算器 - 负责帕鲁配种的核心计算逻辑
 */
class BreedingCalculator {
  constructor(dataManager) {
    this.dataManager = dataManager;

    // 预索引 SPECIAL_BREEDING_RULES：O(1) 查询
    this._specialPairChild = new Map(); // key: 'A|B' (排序后)
    this._genderPairRules = new Map(); // key: 'A|B' (排序后)
    if (typeof SPECIAL_BREEDING_RULES !== "undefined") {
      for (const rule of SPECIAL_BREEDING_RULES) {
        const key = [rule.parent1, rule.parent2].sort().join("|");
        if (rule.genderSpecific) {
          if (!this._genderPairRules.has(key))
            this._genderPairRules.set(key, []);
          this._genderPairRules.get(key).push(rule);
        } else {
          this._specialPairChild.set(key, rule.child);
        }
      }
    }
  }

  /**
   * 检查是否为同种配种
   */
  isSameSpeciesBreeding(parent1, parent2) {
    // 使用name字段进行比较，因为它是唯一标识符
    return parent1.name === parent2.name;
  }

  /**
   * 检查特殊配种规则
   */
  checkSpecialBreedingRules(parent1, parent2) {
    if (typeof SPECIAL_BREEDING_RULES === "undefined") {
      return null;
    }

    const key = [parent1.name, parent2.name].sort().join("|");

    // 性别限定规则（若存在则返回）
    const genderRules = this._genderPairRules.get(key) || [];
    if (genderRules.length > 0) {
      return { type: "gender_specific", rules: genderRules };
    }

    // 普通特殊规则（若存在则返回对应子代）
    const specialChildName = this._specialPairChild.get(key);
    if (specialChildName) {
      const childPal = this.dataManager.findPalByName(specialChildName);
      if (childPal) return { type: "special", result: childPal };
    }

    return null;
  }

  /**
   * 查找性别相关的特殊配种规则
   */
  findGenderSpecificRules(parent1, parent2) {
    if (typeof SPECIAL_BREEDING_RULES === "undefined") return [];
    const key = [parent1.name, parent2.name].sort().join("|");
    return this._genderPairRules.get(key) || [];
  }

  /**
   * 计算配种结果
   */
  calculateBreeding(parent1, parent2) {
    // 优先检查同种配种规则
    if (this.isSameSpeciesBreeding(parent1, parent2)) {
      return { type: "same_species", result: parent1 };
    }

    // 然后检查是否存在特殊配种规则
    const specialResult = this.checkSpecialBreedingRules(parent1, parent2);
    if (specialResult) {
      return specialResult;
    }

    // 最后使用CombiRank公式计算
    const calculatedRank = Math.floor(
      (parent1.CombiRank + parent2.CombiRank + 1) / 2
    );
    const closestPal = this.dataManager.findClosestPal(calculatedRank);

    return { type: "normal", result: closestPal };
  }

  /**
   * 反向配种计算 - 查找所有能产生目标帕鲁的父代组合
   */
  calculateReverseBreeding(targetPal) {
    const breedingCombinations = [];

    // 1. 首先添加同种配种
    breedingCombinations.push({
      parent1: targetPal,
      parent2: targetPal,
      child: targetPal,
    });

    // 2. 检查是否为特殊帕鲁
    if (this.dataManager.isSpecialPal(targetPal)) {
      // 特殊帕鲁只能通过特殊规则获得，不使用CombiRank计算
      this.findSpecialBreedingReverse(targetPal, breedingCombinations);
    } else {
      // 普通帕鲁：检查特殊规则 + CombiRank计算
      this.findSpecialBreedingReverse(targetPal, breedingCombinations);

      // 早停剪枝：若按常规最近规则得到的并非目标，则跳过所有常规遍历
      const testRank = targetPal.CombiRank;
      const testClosest = this.dataManager.findClosestPal(testRank);
      const canNormalProduceTarget = !!(
        testClosest && testClosest.name === targetPal.name
      );

      if (!canNormalProduceTarget) {
        // 常规平均无法到达目标：仅保留特殊规则与同种配种
        return breedingCombinations;
      }

      // 进行CombiRank公式计算
      const palData = this.dataManager.getPalData();
      for (let i = 0; i < palData.length; i++) {
        for (let j = i; j < palData.length; j++) {
          const parent1 = palData[i];
          const parent2 = palData[j];

          // 跳过同种配种：同种配种只会产出同种，且已在开头添加目标为自身的情况
          if (this.isSameSpeciesBreeding(parent1, parent2)) {
            continue;
          }

          // 检查是否已经存在这个组合
          const alreadyFound = breedingCombinations.some(
            (combo) =>
              (combo.parent1.name === parent1.name &&
                combo.parent2.name === parent2.name) ||
              (combo.parent1.name === parent2.name &&
                combo.parent2.name === parent1.name)
          );
          if (alreadyFound) {
            continue;
          }

          // 在进行常规计算之前：若该父代组合存在特殊规则，则该组合只能产生特殊子代
          const specialCheck = this.checkSpecialBreedingRules(parent1, parent2);
          if (specialCheck) {
            if (specialCheck.type === "special") {
              // 若特殊子代不是目标帕鲁，则该组合不应计入目标帕鲁
              if (
                specialCheck.result &&
                specialCheck.result.name !== targetPal.name
              ) {
                continue;
              } else {
                // 若特殊子代正好是目标帕鲁，已通过 findSpecialBreedingReverse 添加，避免重复
                continue;
              }
            } else if (specialCheck.type === "gender_specific") {
              // 有性别限定规则时，仅当其中有子代等于目标帕鲁才保留；否则跳过
              const matchTarget = specialCheck.rules?.some(
                (r) => r.child === targetPal.name
              );
              if (!matchTarget) {
                continue;
              } else {
                // 已由 findSpecialBreedingReverse 处理，避免重复
                continue;
              }
            }
          }

          // 计算这个组合的结果CombiRank
          const calculatedRank = Math.floor(
            (parent1.CombiRank + parent2.CombiRank + 1) / 2
          );

          // 使用与正向配种相同的逻辑：找到最接近计算值的帕鲁
          const resultPal = this.dataManager.findClosestPal(calculatedRank);

          // 如果最接近的帕鲁就是目标帕鲁，则这个父代组合有效
          if (resultPal && resultPal.name === targetPal.name) {
            breedingCombinations.push({
              parent1: parent1,
              parent2: parent2,
              child: targetPal,
            });
          }
        }
      }
    }

    return breedingCombinations;
  }

  /**
   * 部分反向配种计算 - 已知一个父代，查找另一个父代
   */
  calculatePartialReverseBreeding(
    knownParent,
    targetPal,
    isParent1Known,
    generation = 1
  ) {
    if (generation === 1) {
      return this.calculatePartialReverseBreedingOneGeneration(
        knownParent,
        targetPal,
        isParent1Known
      );
    } else if (generation === 2) {
      return this.calculatePartialReverseBreedingTwoGeneration(
        knownParent,
        targetPal,
        isParent1Known
      );
    }
    return [];
  }

  /**
   * 一代部分反向配种计算
   */
  calculatePartialReverseBreedingOneGeneration(
    knownParent,
    targetPal,
    isParent1Known
  ) {
    const breedingCombinations = [];

    // 1. 首先检查同种配种：如果已知父代就是目标帕鲁
    if (knownParent.name === targetPal.name) {
      breedingCombinations.push({
        parent1: targetPal,
        parent2: targetPal,
        child: targetPal,
      });
    }

    // 2. 检查是否为特殊帕鲁
    if (this.dataManager.isSpecialPal(targetPal)) {
      // 特殊帕鲁只能通过特殊规则获得，不使用CombiRank计算
      this.findPartialSpecialBreedingReverse(
        knownParent,
        targetPal,
        breedingCombinations,
        isParent1Known
      );
    } else {
      // 普通帕鲁：检查特殊规则 + CombiRank计算
      this.findPartialSpecialBreedingReverse(
        knownParent,
        targetPal,
        breedingCombinations,
        isParent1Known
      );

      // 早停剪枝：若按常规最近规则得到的并非目标，则跳过所有常规遍历
      const testRank = targetPal.CombiRank;
      const testClosest = this.dataManager.findClosestPal(testRank);
      const canNormalProduceTarget = !!(
        testClosest && testClosest.name === targetPal.name
      );
      if (!canNormalProduceTarget) {
        return breedingCombinations;
      }

      // 进行CombiRank公式计算
      const palData = this.dataManager.getPalData();
      for (let i = 0; i < palData.length; i++) {
        const candidateParent = palData[i];

        // 跳过同种配种：同种配种只会产出同种，且若目标为自身已在前面添加
        if (this.isSameSpeciesBreeding(knownParent, candidateParent)) {
          continue;
        }

        // 检查是否已经存在这个组合
        const alreadyFound = breedingCombinations.some(
          (combo) =>
            (combo.parent1.name === knownParent.name &&
              combo.parent2.name === candidateParent.name) ||
            (combo.parent1.name === candidateParent.name &&
              combo.parent2.name === knownParent.name)
        );
        if (alreadyFound) {
          continue;
        }

        // 在进行常规计算之前：若该父代组合存在特殊规则，则该组合只能产生特殊子代
        const specialCheck = this.checkSpecialBreedingRules(
          knownParent,
          candidateParent
        );
        if (specialCheck) {
          if (specialCheck.type === "special") {
            if (
              specialCheck.result &&
              specialCheck.result.name !== targetPal.name
            ) {
              // 特殊子代不是目标帕鲁：跳过该组合
              continue;
            } else {
              // 特殊子代就是目标帕鲁：已由 findPartialSpecialBreedingReverse 处理，避免重复
              continue;
            }
          } else if (specialCheck.type === "gender_specific") {
            const matchTarget = specialCheck.rules?.some(
              (r) => r.child === targetPal.name
            );
            if (!matchTarget) {
              continue;
            } else {
              // 已由 findPartialSpecialBreedingReverse 处理，避免重复
              continue;
            }
          }
        }

        // 计算这个组合的结果CombiRank
        const calculatedRank = Math.floor(
          (knownParent.CombiRank + candidateParent.CombiRank + 1) / 2
        );

        // 使用与正向配种相同的逻辑：找到最接近计算值的帕鲁
        const resultPal = this.dataManager.findClosestPal(calculatedRank);

        // 如果最接近的帕鲁就是目标帕鲁，则这个父代组合有效
        if (resultPal && resultPal.name === targetPal.name) {
          const combination = {
            parent1: isParent1Known ? knownParent : candidateParent,
            parent2: isParent1Known ? candidateParent : knownParent,
            child: targetPal,
          };
          breedingCombinations.push(combination);
        }
      }
    }

    return breedingCombinations;
  }

  /**
   * 二代部分反向配种计算 - 已知一个父代，通过两步配种查找路径
   */
  calculatePartialReverseBreedingTwoGeneration(
    knownParent,
    targetPal,
    isParent1Known
  ) {
    const breedingCombinations = [];
    const palData = this.dataManager.getPalData();

    // 遍历所有可能的中间帕鲁
    for (let i = 0; i < palData.length; i++) {
      const intermediatePal = palData[i];

      // 第一步：已知父代 + 某个帕鲁 = 中间帕鲁
      for (let j = 0; j < palData.length; j++) {
        const firstStepOtherParent = palData[j];

        // 计算第一步的结果
        const firstStepResult = this.calculateBreeding(
          knownParent,
          firstStepOtherParent
        );

        // 如果第一步的结果是我们想要的中间帕鲁
        if (
          firstStepResult.result &&
          firstStepResult.result.name === intermediatePal.name
        ) {
          // 第二步：中间帕鲁 + 某个帕鲁 = 目标帕鲁
          for (let k = 0; k < palData.length; k++) {
            const secondStepOtherParent = palData[k];

            // 计算第二步的结果
            const secondStepResult = this.calculateBreeding(
              intermediatePal,
              secondStepOtherParent
            );

            // 如果第二步的结果是目标帕鲁
            if (
              secondStepResult.result &&
              secondStepResult.result.name === targetPal.name
            ) {
              // 检查是否已经存在这个组合路径
              const pathKey = `${knownParent.name}-${firstStepOtherParent.name}-${intermediatePal.name}-${secondStepOtherParent.name}`;
              const alreadyFound = breedingCombinations.some(
                (combo) =>
                  combo.pathKey === pathKey ||
                  combo.pathKey ===
                    `${knownParent.name}-${firstStepOtherParent.name}-${intermediatePal.name}-${secondStepOtherParent.name}` ||
                  combo.pathKey ===
                    `${firstStepOtherParent.name}-${knownParent.name}-${intermediatePal.name}-${secondStepOtherParent.name}` ||
                  combo.pathKey ===
                    `${knownParent.name}-${firstStepOtherParent.name}-${secondStepOtherParent.name}-${intermediatePal.name}`
              );

              if (!alreadyFound) {
                const combination = {
                  parent1: isParent1Known ? knownParent : firstStepOtherParent,
                  parent2: isParent1Known ? firstStepOtherParent : knownParent,
                  child: targetPal,
                  isMultiGeneration: true,
                  generationPath: {
                    step1: {
                      parent1: knownParent,
                      parent2: firstStepOtherParent,
                      child: intermediatePal,
                    },
                    step2: {
                      parent1: intermediatePal,
                      parent2: secondStepOtherParent,
                      child: targetPal,
                    },
                  },
                  pathKey: pathKey,
                };
                breedingCombinations.push(combination);
              }
            }
          }
        }
      }
    }

    return breedingCombinations;
  }

  /**
   * 查找特殊配种规则的反向组合
   */
  findSpecialBreedingReverse(targetPal, breedingCombinations) {
    // 检查是否定义了特殊配种规则
    if (typeof SPECIAL_BREEDING_RULES === "undefined") {
      return;
    }

    // 遍历所有特殊配种规则
    for (const rule of SPECIAL_BREEDING_RULES) {
      // 如果这个规则的结果是目标帕鲁
      if (rule.child === targetPal.name) {
        // 查找父代帕鲁
        const parent1 = this.dataManager.findPalByName(rule.parent1);
        const parent2 = this.dataManager.findPalByName(rule.parent2);

        if (parent1 && parent2) {
          // 检查是否已经存在这个组合
          const alreadyExists = breedingCombinations.some(
            (combo) =>
              (combo.parent1.name === parent1.name &&
                combo.parent2.name === parent2.name) ||
              (combo.parent1.name === parent2.name &&
                combo.parent2.name === parent1.name)
          );

          if (!alreadyExists) {
            breedingCombinations.push({
              parent1: parent1,
              parent2: parent2,
              child: targetPal,
            });
          }
        }
      }
    }
  }

  /**
   * 查找部分特殊配种规则的反向组合
   */
  findPartialSpecialBreedingReverse(
    knownParent,
    targetPal,
    breedingCombinations,
    isParent1Known
  ) {
    // 检查是否定义了特殊配种规则
    if (typeof SPECIAL_BREEDING_RULES === "undefined") {
      return;
    }

    // 遍历所有特殊配种规则
    for (const rule of SPECIAL_BREEDING_RULES) {
      // 如果这个规则的结果是目标帕鲁
      if (rule.child === targetPal.name) {
        // 检查已知父代是否匹配规则中的某个父代
        let otherParentName = null;
        if (rule.parent1 === knownParent.name) {
          otherParentName = rule.parent2;
        } else if (rule.parent2 === knownParent.name) {
          otherParentName = rule.parent1;
        }

        if (otherParentName) {
          // 查找另一个父代帕鲁
          const otherParent = this.dataManager.findPalByName(otherParentName);

          if (otherParent) {
            // 检查是否已经存在这个组合
            const alreadyExists = breedingCombinations.some(
              (combo) =>
                (combo.parent1.name === knownParent.name &&
                  combo.parent2.name === otherParent.name) ||
                (combo.parent1.name === otherParent.name &&
                  combo.parent2.name === knownParent.name)
            );

            if (!alreadyExists) {
              breedingCombinations.push({
                parent1: isParent1Known ? knownParent : otherParent,
                parent2: isParent1Known ? otherParent : knownParent,
                child: targetPal,
              });
            }
          }
        }
      }
    }
  }
}
