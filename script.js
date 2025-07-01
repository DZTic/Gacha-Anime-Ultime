// --- NOUVEAU: Initialisation de Firebase ---
    // Note: The actual firebaseConfig object has been moved to data.js
    // We still need to initialize Firebase here using that config.
    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();

    // --- NOUVEAU: Variables pour l'état de l'authentification ---
    let currentUser = null;
    let isGameInitialized = false; // Pour s'assurer que le jeu n'est initialisé qu'une seule fois

    // --- NOUVEAU: Références aux nouveaux éléments HTML ---
    const appContainer = document.getElementById("app-container");
    const authContainer = document.getElementById("auth-container");
    const gameContainer = document.getElementById("game-container");
    const userStatus = document.getElementById("user-status");

    // --- VARIABLES GLOBALES ENSUITE ---
    let characterIdCounter = parseInt(localStorage.getItem("characterIdCounter")) || 0;
    let gemsRaw = localStorage.getItem("gems");
    let gems;
    if (gemsRaw !== null) {
        gems = parseInt(gemsRaw);
        if (isNaN(gems)) {
            console.warn("Valeur de 'gems' invalide dans localStorage:", gemsRaw, ". Réinitialisation à 1000.");
            gems = 1000;
        }
    } else {
        gems = 1000;
    }
    let coins = parseInt(localStorage.getItem("coins")) || 0;
    let pullCount = parseInt(localStorage.getItem("pullCount")) || 0;
    
    let ownedCharacters = [];
    const rawOwnedCharactersString = localStorage.getItem("ownedCharacters");
    console.log("Vérification avant boucle: statRanks est défini?", typeof statRanks !== 'undefined'); // LOG DE CONTRÔLE

    if (rawOwnedCharactersString) {
        try {
            const loadedChars = JSON.parse(rawOwnedCharactersString);
            if (Array.isArray(loadedChars)) {
                loadedChars.forEach((char, index) => {
                    try {
                        if (!char || typeof char.name !== 'string') {
                            console.warn(`[INIT Char ${index}] Personnage invalide ou nom manquant, skippé:`, char);
                            return;
                        }

                        const nameToFind = char.hasEvolved && char.originalName ? char.originalName : char.name;
                        const baseDefinition = allCharacters.find(c => c.name === nameToFind);
                        if (!baseDefinition) {
                            console.warn(`[INIT Char ${index}] Définition de base non trouvée pour '${char.name}'. Skippé.`);
                            return;
                        }
                        const initialPowerFromDefinition = baseDefinition.power;

                        let basePower = char.basePower;
                        let statRank = char.statRank;
                        let statModifier = char.statModifier;
                        let traitOnLoad = char.trait || { id: null, grade: 0 };
                        if (char.trait && typeof char.trait.level !== 'undefined' && typeof char.trait.grade === 'undefined') {
                            traitOnLoad.grade = char.trait.level > 0 ? char.trait.level : 0;
                            delete traitOnLoad.level;
                        }

                        if (typeof basePower === 'undefined' || basePower === null || isNaN(Number(basePower)) || Number(basePower) <= 0) {
                            // ... (logique existante pour dériver basePower)
                        }

                        if (!statRank || !statRanks[statRank]) {
                            statRank = getRandomStatRank();
                            statModifier = statRanks[statRank].modifier;
                        } else if (typeof statModifier === 'undefined' || statModifier === null || isNaN(Number(statModifier))) {
                            statModifier = statRanks[statRank].modifier;
                        }

                        const newCharData = {
                             ...(baseDefinition ? baseDefinition : {}),
                            ...char,
                            id: char.id || `char_${characterIdCounter++}`,
                            level: Number(char.level) || 1,
                            exp: Number(char.exp) || 0,
                            locked: char.locked || false,
                            hasEvolved: char.hasEvolved || false,
                            curseEffect: Number(char.curseEffect) || 0,
                            basePower: Number(basePower),
                            // MODIFICATION ICI:
                            maxLevelCap: Number(char.maxLevelCap) || 60, // Assurer que maxLevelCap existe, sinon 60
                            statRank: statRank,
                            statModifier: Number(statModifier),
                            trait: (traitOnLoad && typeof traitOnLoad.id === 'string' && typeof traitOnLoad.grade === 'number' && TRAIT_DEFINITIONS[traitOnLoad.id])
                                   ? { id: traitOnLoad.id, grade: traitOnLoad.grade }
                                   : { id: null, grade: 0 }
                        };
                        delete newCharData.power;

                        // console.log(`[DEBUG Pre-Recalc] Char: ${newCharData.name}, BaseP: ${newCharData.basePower}, StatMod: ${newCharData.statModifier}, Trait: ${JSON.stringify(newCharData.trait)}`);
                        if (newCharData.trait.id && newCharData.trait.grade > 0) {
                            const traitDef = TRAIT_DEFINITIONS[newCharData.trait.id];
                            if (traitDef && traitDef.grades) {
                                const maxGradeForTrait = traitDef.grades.length;
                                if (newCharData.trait.grade > maxGradeForTrait) {
                                    console.warn(`[INIT Char ${newCharData.name}] Trait ${newCharData.trait.id} avait un grade ${newCharData.trait.grade} > max ${maxGradeForTrait}. Ajustement au grade max.`);
                                    newCharData.trait.grade = maxGradeForTrait;
                                }
                                if (newCharData.trait.grade <= 0) { // Si le grade était 0 après la conversion
                                     console.warn(`[INIT Char ${newCharData.name}] Trait ${newCharData.trait.id} avait un grade 0. Remise à 0 (aucun trait).`);
                                     newCharData.trait = { id: null, grade: 0 }; // Réinitialiser si grade 0
                                }
                            } else { // Trait ID existe mais pas de définition de grades (ne devrait pas arriver avec la nouvelle structure)
                                newCharData.trait = { id: null, grade: 0 };
                            }
                        } else if (newCharData.trait.id && newCharData.trait.grade === 0) { // Si l'ID est là mais grade 0
                            newCharData.trait = { id: null, grade: 0 };
                        }
                        
                        recalculateCharacterPower(newCharData);

                        if (isNaN(newCharData.power) || newCharData.power <= 0) {
                             console.warn(`[INIT Char ${index}] Puissance INVALIDE pour ${newCharData.name} après recalcul. Power: ${newCharData.power}. SKIPPED.`);
                             console.log("[INIT Char Detail for Skipped]: ", JSON.parse(JSON.stringify(newCharData)));
                             return;
                        }
                        ownedCharacters.push(newCharData);
                    } catch (errorForChar) {
                        console.error(`[INIT Char ${index}] ERREUR lors du traitement du personnage sauvegardé:`, char, errorForChar);
                    }
                });
                if (loadedChars.length !== ownedCharacters.length) {
                    console.warn("[INIT] Attention: Certains personnages de la sauvegarde n'ont pas pu être chargés correctement.");
                }
            } else {
                console.warn("[INIT] 'ownedCharacters' depuis localStorage n'est pas un tableau. Initialisation à vide.");
            }
        } catch (e) {
            console.error("[INIT] ERREUR FATALE lors du JSON.parse de 'ownedCharacters' ou de son traitement:", e);
            ownedCharacters = [];
        }
    } else {
        // console.log("[INIT] 'ownedCharacters' non trouvé dans localStorage. Initialisation à un tableau vide.");
    }
    localStorage.setItem("characterIdCounter", characterIdCounter);

    let level = parseInt(localStorage.getItem("level")) || 1;
    let exp = parseInt(localStorage.getItem("exp")) || 0;
    let expMultiplier = parseFloat(localStorage.getItem("expMultiplier")) || 1;
    let pullTickets = parseInt(localStorage.getItem("pullTickets")) || 0;
    let missions = JSON.parse(localStorage.getItem("missions")) || [];
    let isDeleteMode = false;
    let selectedCharacterIndices = new Set(); 
    let shopOffers = JSON.parse(localStorage.getItem("shopOffers")) || [];
    let shopRefreshTime = parseInt(localStorage.getItem("shopRefreshTime")) || Date.now() + 2 * 60 * 60 * 1000;
    let expBoostEndTime = parseInt(localStorage.getItem("expBoostEndTime")) || 0;
    let storyProgress = (() => {
      const savedProgressString = localStorage.getItem("storyProgress");
      let loadedProgressArray = [];
      if (savedProgressString) {
          try {
              loadedProgressArray = JSON.parse(savedProgressString);
              if (!Array.isArray(loadedProgressArray)) {
                  console.warn("storyProgress depuis localStorage n'est pas un tableau. Il sera ignoré.");
                  loadedProgressArray = [];
              }
          } catch (e) {
              console.error("Erreur lors du parsing de storyProgress depuis localStorage:", e);
              loadedProgressArray = [];
          }
      }

      // 1. Utiliser une Map pour s'assurer que chaque niveau de allGameLevels a une entrée
      //    et que les états sauvegardés sont prioritaires.
      let currentProgressMap = new Map();

      allGameLevels.forEach(levelDefinition => {
        const savedLevelState = loadedProgressArray.find(sl => sl.id === levelDefinition.id);
        
        let isUnlockedInitial = levelDefinition.unlocked || false; // Utiliser la valeur de la définition, ou false

        // Logique de déverrouillage initial spécifique pour les types de niveaux
        if (levelDefinition.type === 'story' && !levelDefinition.isInfinite) {
            // Seul le premier niveau d'histoire (ID 1) est débloqué au départ
            isUnlockedInitial = (levelDefinition.id === 1);
        } else if (levelDefinition.type === 'material' || levelDefinition.type === 'challenge') {
            // Les niveaux de matériaux et challenges sont toujours débloqués initialement
            isUnlockedInitial = true;
        }
        // Pour les types 'legendary' et 'infinite' (sauf si ID 1), on se fie à leur `unlocked` dans allGameLevels
        // ou à la logique de migration ci-dessous.

        if (savedLevelState && typeof savedLevelState.unlocked === 'boolean' && typeof savedLevelState.completed === 'boolean') {
          // Si un état sauvegardé valide existe, on l'utilise
          currentProgressMap.set(levelDefinition.id, { ...savedLevelState });
        } else {
          // Sinon, on utilise l'état initial déduit de la définition du niveau
          currentProgressMap.set(levelDefinition.id, {
            id: levelDefinition.id,
            unlocked: isUnlockedInitial,
            completed: levelDefinition.completed || false
          });
        }
      });

      // Convertir la Map en Array pour la suite de la logique
      let currentProgress = Array.from(currentProgressMap.values());

      // 2. Logique de déblocage additionnelle pour les mondes d'histoire (migration pour joueurs existants)
      //    Cette partie est cruciale pour s'assurer que si un joueur a terminé un monde, le suivant se débloque.
      //    On utilise une liste de mondes triée par leur premier ID de niveau pour assurer l'ordre correct.
      const storyWorldDefinitions = [...new Set(baseStoryLevels
          .filter(l => l.type === 'story' && !l.isInfinite) // Uniquement les niveaux d'histoire standard
          .map(l => ({ // Créer un objet avec le nom du monde et le plus petit ID de niveau de ce monde
              world: l.world,
              firstId: Math.min(...baseStoryLevels
                  .filter(sl => sl.world === l.world && sl.type === 'story' && !sl.isInfinite)
                  .map(sl => sl.id))
          }))
          .sort((a, b) => a.firstId - b.firstId) // Trier les mondes par leur premier ID de niveau
      )];

      for (let i = 0; i < storyWorldDefinitions.length - 1; i++) { // Itérer jusqu'à l'avant-dernier monde
          const currentWorldName = storyWorldDefinitions[i].world;
          const nextWorldName = storyWorldDefinitions[i + 1].world;

          // Vérifier si tous les niveaux du monde actuel sont complétés
          const levelsInCurrentWorldProgress = currentProgress.filter(p => {
              const levelDef = baseStoryLevels.find(lDef => lDef.id === p.id);
              return levelDef && levelDef.world === currentWorldName && levelDef.type === 'story' && !levelDef.isInfinite;
          });

          if (levelsInCurrentWorldProgress.length > 0 && levelsInCurrentWorldProgress.every(p => p.completed)) {
              // Si le monde actuel est complété, trouver le premier niveau du prochain monde
              const levelsInNextWorldDefs = baseStoryLevels.filter(lDef =>
                  lDef.world === nextWorldName &&
                  lDef.type === 'story' &&
                  !lDef.isInfinite);
              
              if (levelsInNextWorldDefs.length > 0) {
                  const firstLevelOfNextWorldId = Math.min(...levelsInNextWorldDefs.map(l => l.id));
                  const progressForFirstLevelNextWorld = currentProgress.find(p => p.id === firstLevelOfNextWorldId);
                  
                  // Débloquer le premier niveau du prochain monde s'il n'est pas déjà débloqué
                  if (progressForFirstLevelNextWorld && !progressForFirstLevelNextWorld.unlocked) {
                      console.log(`[MIGRATION PROGRESSION] Déblocage du niveau ID ${firstLevelOfNextWorldId} (${levelsInNextWorldDefs.find(l=>l.id === firstLevelOfNextWorldId)?.name}) car le monde ${currentWorldName} est complété.`);
                      progressForFirstLevelNextWorld.unlocked = true;
                  }
              }
          }
      }
      
      // 3. Logique de déblocage pour le Niveau Infini (ID 49) - Si tous les niveaux d'histoire standard sont faits
      const infiniteLevelId = 49; 
      const infiniteLevelProgress = currentProgress.find(p => p.id === infiniteLevelId);
      const infiniteLevelDef = allGameLevels.find(l => l.id === infiniteLevelId && l.isInfinite);

      if (infiniteLevelProgress && infiniteLevelDef && !infiniteLevelProgress.unlocked) {
          const allStandardStoryLevels = baseStoryLevels.filter(l => l.type === 'story' && !l.isInfinite);
          const allStandardStoryLevelsCompleted = allStandardStoryLevels.every(stdLevel => {
              const progress = currentProgress.find(p => p.id === stdLvl.id);
              return progress && progress.completed;
          });

          if (allStandardStoryLevelsCompleted) {
              console.log(`[MIGRATION PROGRESSION] Déblocage de ${infiniteLevelDef.name} (ID ${infiniteLevelId}) car tous les mondes d'histoire standard sont complétés.`);
              infiniteLevelProgress.unlocked = true;
          }
      }

      // 4. Logique de déblocage pour les niveaux légendaires - Si le monde standard correspondant est terminé
      const uniqueStoryWorldNames = [...new Set(baseStoryLevels.filter(l => l.type === 'story' && !l.isInfinite).map(l => l.world))];
      uniqueStoryWorldNames.forEach(worldName => {
          const standardLevelsInThisWorld = baseStoryLevels.filter(l => l.world === worldName && l.type === 'story' && !l.isInfinite);
          const isThisStandardWorldCompleted = standardLevelsInThisWorld.length > 0 && standardLevelsInThisWorld.every(l => {
              const prog = currentProgress.find(p => p.id === l.id);
              return prog && prog.completed;
          });

          if (isThisStandardWorldCompleted) {
              const legendaryLevelForThisWorld = legendaryStoryLevels.find(ll => ll.world === worldName);
              if (legendaryLevelForThisWorld) {
                  const legendaryProgress = currentProgress.find(p => p.id === legendaryLevelForThisWorld.id);
                  if (legendaryProgress && !legendaryProgress.unlocked) {
                      console.log(`[MIGRATION PROGRESSION] Déblocage du niveau légendaire ${legendaryLevelForThisWorld.name} (ID ${legendaryLevelForThisWorld.id}) car le monde ${worldName} est complété.`);
                      legendaryProgress.unlocked = true;
                  }
              }
          }
      });


      return currentProgress;
    })();
    let selectedBattleCharacters = new Set();
    let selectedFusionCharacters = new Set();
    let currentLevelId = null;
    let currentFusionCharacterId = null;
    let soundEnabled = localStorage.getItem("soundEnabled") !== "false";
    let animationsEnabled = localStorage.getItem("animationsEnabled") !== "false";
    let theme = localStorage.getItem("theme") || "dark";
    let infiniteLevelStartTime = null;
    let everOwnedCharacters = JSON.parse(localStorage.getItem("everOwnedCharacters")) || [];
    let sortCriteria = localStorage.getItem("sortCriteria") || "power";
    let battleSortCriteria = localStorage.getItem("battleSortCriteria") || "power";
    let inventory = JSON.parse(localStorage.getItem("inventory")) || {
            "Haricots": 0,
            "Fluide mystérieux": 0,
            "Wisteria Flower": 0,
            "Pass XP": pullTickets,
            "Cursed Token": 0,
            "Shadow Tracer": 0,
            "Stat Chip": 0,
            "Reroll Token": 0,
            "Divin Wish": 0,
            "Hellsing Arms": 0,
            "Green Essence": 0,
            "Yellow Essence": 0,
            "Blue Essence": 0,
            "Pink Essence": 0,
            "Rainbow Essence": 0,
            "Crystal": 0,
            "Magic Pendant": 0,
            "Chocolate Bar's": 0,
            "Head Captain's Coat": 0,
            "Broken Sword": 0,
            "Chipped Blade": 0,
            "Cast Blades": 0,
            "Hardened Blood": 0,
            "Silverite Sword": 0,
            "Cursed Finger": 0,
            "Magic Stone": 0,
            "Magma Stone": 0,
            "Broken Pendant": 0,
            "Stone Pendant": 0,
            "Demon Beads": 0,
            "Alien Core": 0,
            "Nichirin Cleavers": 0,
            "Tavern Pie": 0,
            "Blue Chakra": 0,
            "Red Chakra": 0,
            "Skin Patch": 0,
            "Snake Scale": 0,
            "Senzu Bean": 0,
            "Holy Corpse Eyes": 0,
            "Holy Corpse Arms": 0,
            "Completed Holy Corpse": 0,
            "Gorgon's Blindfold": 0,
            "Caster's Headpiece": 0,
            "Avalon": 0,
            "Goddess' Sword": 0,
            "Blade of Death": 0,
            "Berserker's Blade": 0,
            "Shunpo Spirit": 0,
            "Energy Arrow": 0,
            "Hair Ornament": 0,
            "Bucket Hat": 0,
            "Horn of Salvation": 0,
            "Energy Bone": 0,
            "Prison Chair": 0,
            "Rotara Earring 2": 0,
            "Rotara Earring 1": 0,
            "Z Blade": 0,
            "Champ's Belt": 0,
            "Dog Bone": 0,
            "Six Eyes": 0,
            "Tome of Wisdom": 0,
            "Corrupted Visor": 0,
            "Tainted Ribbon": 0,
            "Demon Chalice": 0,
            "Essence of the Spirit King": 0,
            "Ring of Friendship": 0,
            "Red Jewel": 0,
            "Majan Essence": 0,
            "Donut": 0,
            "Atomic Essence": 0,
            "Plume Céleste": 0,
            "Sablier Ancien": 0,
            "Restricting Headband": 0,
        };
    inventory["Pass XP"] = pullTickets;
    let selectedItemsForGiving = new Map(); 
    let currentGiveItemsCharacterId = null;
    let currentEvolutionCharacterId = null;
    let selectedEvolutionItems = new Map(); 
    let purchasedOffers = JSON.parse(localStorage.getItem("purchasedOffers")) || [];
    let characterPreset = JSON.parse(localStorage.getItem("characterPreset")) || []; 
    let presetConfirmed = localStorage.getItem("presetConfirmed") === "true"; 
    let selectedPresetCharacters = new Set(); 
    let presetSortCriteria = localStorage.getItem("presetSortCriteria") || "power"; 
    let currentAutofuseCharacterId = null;
    let autofuseSelectedRarities = new Set();
    let discoveredCharacters = JSON.parse(localStorage.getItem("discoveredCharacters")) || [];
    let lastUsedBattleTeamIds = [];
    let currentCurseCharacterId = null;
    let currentStatChangeCharacterId = null; 
    let curseConfirmationCallback = null;
    let statChangeConfirmationCallback = null;
    let statChangeInfoTimeoutId = null;
    let currentTraitCharacterId = null;
    let traitKeepBetterToggleState = false;
    let traitConfirmationCallback = null;
    let infoMsgTraitTimeoutId = null;
    let currentLimitBreakCharacterId = null;
    let bannerTimerIntervalId = null;
    let currentMaxTeamSize = 3;
    let battleSearchName = localStorage.getItem("battleSearchName") || "";
    let battleFilterRarity = localStorage.getItem("battleFilterRarity") || "all";
    let presetSearchName = localStorage.getItem("presetSearchName") || "";
    let presetFilterRarity = localStorage.getItem("presetFilterRarity") || "all";
    let fusionSearchName = localStorage.getItem("fusionSearchName") || "";
    let fusionFilterRarity = localStorage.getItem("fusionFilterRarity") || "all";
    let standardPityCount = parseInt(localStorage.getItem("standardPityCount")) || 0;
    let specialPityCount = parseInt(localStorage.getItem("specialPityCount")) || 0;
    let sortCriteriaSecondary = localStorage.getItem("sortCriteriaSecondary") || "none";
    let inventoryFilterName = localStorage.getItem("inventoryFilterName") || "";
    let inventoryFilterRarity = localStorage.getItem("inventoryFilterRarity") || "all";
    let inventoryFilterEvolvable = localStorage.getItem("inventoryFilterEvolvable") === "true";
    let inventoryFilterLimitBreak = localStorage.getItem("inventoryFilterLimitBreak") === "true";
    let inventoryFilterCanReceiveExp = localStorage.getItem("inventoryFilterCanReceiveExp") === "true";
    let saveTimeoutId = null; // Pour stocker l'ID du minuteur de sauvegarde
    const SAVE_DELAY_MS = 2000; // 2 secondes de délai avant la sauvegarde
    let miniGameState = {
        isActive: false,
        bossMaxHealth: 0,
        bossCurrentHealth: 0,
        damagePerClick: 0,
        timer: 30,
        intervalId: null,
        levelData: null
    };

    // Existing DOM elements
    const gemsElement = document.getElementById("gems");
    const coinsElement = document.getElementById("coins");
    const pullCountElement = document.getElementById("pull-count");
    const levelElement = document.getElementById("level");
    const expElement = document.getElementById("exp");
    const expNeededElement = document.getElementById("exp-needed");
    const pullButton = document.getElementById("pull-button");
    const multiPullButton = document.getElementById("multi-pull-button");
    const specialPullButton = document.getElementById("special-pull-button");
    const shopElement = document.getElementById("shop");
    const missionsElement = document.getElementById("missions");
    const inventoryElement = document.getElementById("inventory");
    const playElement = document.getElementById("play");
    const missionListElement = document.getElementById("mission-list");
    const resultElement = document.getElementById("result");
    const characterDisplay = document.getElementById("character-display");
    const itemDisplay = document.getElementById("item-display");
    const shopTimerElement = document.getElementById("shop-timer");
    const missionTimerElement = document.getElementById("mission-timer");
    const shopItemsElement = document.getElementById("shop-items");
    const levelListElement = document.getElementById("level-list");
    const rareCountElement = document.getElementById("rare-count");
    const epicCountElement = document.getElementById("epic-count");
    const legendaryCountElement = document.getElementById("legendary-count");
    const mythicCountElement = document.getElementById("mythic-count");
    const secretCountElement = document.getElementById("secret-count");
    const tabButtons = document.querySelectorAll(".tab-button"); // This will include the new tab-stat-change
    const subtabButtons = document.querySelectorAll(".subtab-button"); // Keep this for Play and Inventory subtabs
    const deleteButton = document.getElementById("delete-button");
    const statsModal = document.getElementById("stats-modal");
    const modalContent = document.getElementById("modal-content");
    const fuseButton = document.getElementById("fuse-button");
    const closeModalButton = document.getElementById("close-modal");
    const characterSelectionModal = document.getElementById("character-selection-modal");
    const characterSelectionList = document.getElementById("character-selection-list");
    const selectedCountElement = document.getElementById("selected-count");
    const confirmSelectionButton = document.getElementById("confirm-selection");
    const cancelSelectionButton = document.getElementById("cancel-selection");
    const fusionModal = document.getElementById("fusion-modal");
    const fusionSelectionList = document.getElementById("fusion-selection-list");
    const fusionSelectedCountElement = document.getElementById("fusion-selected-count");
    const confirmFusionButton = document.getElementById("confirm-fusion");
    const cancelFusionButton = document.getElementById("cancel-fusion");
    const settingsButton = document.getElementById("settings-button");
    const settingsModal = document.getElementById("settings-modal");
    const soundToggle = document.getElementById("sound-toggle");
    const animationsToggle = document.getElementById("animations-toggle");
    const themeSelect = document.getElementById("theme-select");
    const resetGameButton = document.getElementById("reset-game");
    const saveSettingsButton = document.getElementById("save-settings");
    const closeSettingsButton = document.getElementById("close-settings");
    const resetConfirmModal = document.getElementById("reset-confirm-modal");
    const confirmResetButton = document.getElementById("confirm-reset");
    const cancelResetButton = document.getElementById("cancel-reset");
    const indexElement = document.getElementById("index");
    const indexDisplay = document.getElementById("index-display");
    const sortCriteriaSelect = document.getElementById("sort-criteria");
    const giveItemsModal = document.getElementById("give-items-modal");
    const giveItemsButton = document.getElementById("give-items-button");
    const itemSelectionList = document.getElementById("item-selection-list");
    const itemSelectedCountElement = document.getElementById("item-selected-count");
    const confirmGiveItemsButton = document.getElementById("confirm-give-items");
    const cancelGiveItemsButton = document.getElementById("cancel-give-items");
    const evolutionElement = document.getElementById("evolution");
    const evolutionDisplay = document.getElementById("evolution-display");
    const evolutionModal = document.getElementById("evolution-modal");
    const evolutionRequirementsElement = document.getElementById("evolution-requirements");
    const evolutionSelectionList = document.getElementById("evolution-selection-list");
    const evolutionSelectedCountElement = document.getElementById("evolution-selected-count");
    const confirmEvolutionButton = document.getElementById("confirm-evolution");
    const cancelEvolutionButton = document.getElementById("cancel-evolution");
    const autofuseSettingsButton = document.getElementById("autofuse-settings-button");
    const autofuseModal = document.getElementById("autofuse-modal");
    const autofuseMainCharacterElement = document.getElementById("autofuse-main-character");
    const autofuseCharacterGrid = document.getElementById("autofuse-character-grid");
    const autofuseCountElement = document.getElementById("autofuse-count");
    const confirmAutofuseButton = document.getElementById("confirm-autofuse");
    const cancelAutofuseButton = document.getElementById("cancel-autofuse");
    const autofuseRarityCheckboxes = {
      Rare: document.getElementById("autofuse-rare"),
      Épique: document.getElementById("autofuse-epic"),
      Légendaire: document.getElementById("autofuse-legendary"),
      Mythic: document.getElementById("autofuse-mythic"),
      Secret: document.getElementById("autofuse-secret")
    };
    const presetSelectionModal = document.getElementById("preset-selection-modal");
    const presetSelectionList = document.getElementById("preset-selection-list");
    const presetSelectedCountDisplayElement = document.getElementById("preset-selected-count-display");
    const confirmPresetButton = document.getElementById("confirm-preset");
    const cancelPresetButton = document.getElementById("cancel-preset");
    const pullMethodModal = document.getElementById("pull-method-modal");
    const pullWithGemsButton = document.getElementById("pull-with-gems");
    const pullWithTicketButton = document.getElementById("pull-with-ticket");
    const cancelPullMethodButton = document.getElementById("cancel-pull-method");
    let currentPullType = null; 
    const infoButton = document.getElementById("info-button");
    const probabilitiesModal = document.getElementById("probabilities-modal");
    const closeProbabilitiesButton = document.getElementById("close-probabilities");
    const probTabButtons = document.querySelectorAll(".prob-tab-button");
    const standardProbabilities = document.getElementById("standard-probabilities");
    const specialProbabilities = document.getElementById("special-probabilities");
    const tabCurseButton = document.getElementById("tab-curse");
    const curseElement = document.getElementById("curse");
    const cursedTokenCountElement = document.getElementById("cursed-token-count");
    const curseSelectedCharacterDisplayElement = document.getElementById("curse-selected-character-display");
    const curseCharacterSelectionGridElement = document.getElementById("curse-character-selection-grid");
    const applyCurseButton = document.getElementById("apply-curse-button");
    let currentStandardBanner = { Mythic: [], generatedAt: 0 };
    const statRankInfoButton = document.getElementById("stat-rank-info-button");
    const statRankProbabilitiesModal = document.getElementById("stat-rank-probabilities-modal");
    const statRankProbabilitiesContent = document.getElementById("stat-rank-probabilities-content");
    const closeStatRankProbabilitiesModalButton = document.getElementById("close-stat-rank-probabilities-modal-button");
    const curseKeepBetterToggle = document.getElementById("curse-keep-better-toggle");
    const curseMinPercentageInput = document.getElementById("curse-min-percentage");
    const curseConfirmContinueModal = document.getElementById("curse-confirm-continue-modal");
    const curseConfirmMessageElement = document.getElementById("curse-confirm-message");
    const curseConfirmYesButton = document.getElementById("curse-confirm-yes-button");
    const curseConfirmNoButton = document.getElementById("curse-confirm-no-button");
    const statKeepBetterToggle = document.getElementById("stat-keep-better-toggle");
    const statTargetRanksSelectionElement = document.getElementById("stat-target-ranks-selection");
    const statChangeConfirmContinueModal = document.getElementById("stat-change-confirm-continue-modal");
    const statChangeConfirmMessageElement = document.getElementById("stat-change-confirm-message");
    const statChangeConfirmYesButton = document.getElementById("stat-change-confirm-yes-button");
    const statChangeConfirmNoButton = document.getElementById("stat-change-confirm-no-button");
    const statChangeElement = document.getElementById("stat-change"); // Pour le nouvel onglet principal

    const TRAIT_REMOVAL_COST = 5; // Cost in Reroll Token to remove a trait
    const APPLY_NEW_TRAIT_COST = 1;
    const tabTraitButton = document.getElementById("tab-trait"); // NOUVEAU
    const traitElement = document.getElementById("trait"); // NOUVEAU
    const traitEssenceCountElement = document.getElementById("trait-essence-count"); // NOUVEAU
    const traitSelectedCharacterDisplayElement = document.getElementById("trait-selected-character-display"); // NOUVEAU
    const traitCharacterSelectionGridElement = document.getElementById("trait-character-selection-grid"); // NOUVEAU
    const traitAvailableListElement = document.getElementById("trait-available-list"); // NOUVEAU
    const removeTraitButton = document.getElementById("remove-trait-button"); // NOUVEAU
    const traitCharSearchInput = document.getElementById("trait-char-search"); // NOUVEAU
    const traitProbabilitiesInfoButton = document.getElementById("trait-probabilities-info-button");
    const traitProbabilitiesModal = document.getElementById("trait-probabilities-modal");
    const traitProbabilitiesContent = document.getElementById("trait-probabilities-content");
    const closeTraitProbabilitiesModalButton = document.getElementById("close-trait-probabilities-modal-button");
    const traitKeepBetterToggle = document.getElementById("trait-keep-better-toggle");
    const traitTargetSelectionElement = document.getElementById("trait-target-selection");
    const traitActionConfirmModal = document.getElementById("trait-action-confirm-modal");
    const traitActionConfirmMessageElement = document.getElementById("trait-action-confirm-message");
    const tabLimitBreakButton = document.getElementById("tab-limit-break"); // AJOUT
    const limitBreakElement = document.getElementById("limit-break"); // AJOUT
    const transcendenceOrbCountElement = document.getElementById("transcendence-orb-count"); // AJOUT
    const limitBreakSelectedCharDisplayElement = document.getElementById("limit-break-selected-char-display"); // AJOUT
    const limitBreakCharSelectionGridElement = document.getElementById("limit-break-char-selection-grid"); // AJOUT
    const applyLimitBreakButton = document.getElementById("apply-limit-break-button"); // AJOUT
    const traitActionConfirmYesButton = document.getElementById("trait-action-confirm-yes-button");
    const traitActionConfirmNoButton = document.getElementById("trait-action-confirm-no-button");
    const LIMIT_BREAK_LEVEL_INCREASE = 5;
    const MAX_POSSIBLE_LEVEL_CAP = 100; 
    const LIMIT_BREAK_COST = 1;
    const STANDARD_MYTHIC_PITY_THRESHOLD = 10000;
    const SPECIAL_BANNER_PITY_THRESHOLD = 85000;
    const miniGameModal = document.getElementById('mini-game-modal');
    const miniGameStartScreen = document.getElementById('mini-game-start-screen');
    const miniGameMainScreen = document.getElementById('mini-game-main-screen');
    const miniGameResultScreen = document.getElementById('mini-game-result-screen');
    const miniGameStartButton = document.getElementById('mini-game-start-button');
    const miniGameBossImage = document.getElementById('mini-game-boss-image');
    const miniGameTimerEl = document.getElementById('mini-game-timer');
    const miniGameHealthBar = document.getElementById('mini-game-boss-health-bar');
    const miniGameHealthText = document.getElementById('mini-game-boss-health-text');
    const miniGameCloseButton = document.getElementById('mini-game-close-button');
    const miniGameDamageContainer = document.getElementById('mini-game-damage-container');

    
    const pullSound = new Audio("https://freesound.org/data/previews/270/270333_5121236-lq.mp3");
    const buySound = new Audio("https://freesound.org/data/previews/156/156859_2048418-lq.mp3");
    const battleSound = new Audio("https://freesound.org/data/previews/270/270330_5121236-lq.mp3");
    const winSound = new Audio('');
    const loseSound = new Audio('');

    function setupAuthUI() {
        // Logique pour basculer entre les vues de connexion et d'inscription
        document.getElementById('show-signup').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('login-view').classList.add('hidden');
            document.getElementById('signup-view').classList.remove('hidden');
            document.getElementById('auth-error').textContent = '';
        });

        document.getElementById('show-login').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('signup-view').classList.add('hidden');
            document.getElementById('login-view').classList.remove('hidden');
            document.getElementById('auth-error').textContent = '';
        });

        // Gestion des soumissions de formulaire
        document.getElementById('login-form').addEventListener('submit', handleLogin);
        document.getElementById('signup-form').addEventListener('submit', handleSignup);
        document.getElementById('logout-button').addEventListener('click', handleLogout);
    }

    function initializeGameData(saveData) {
        // Cas 1: Nouvelle partie (pas de sauvegarde trouvée)
        if (!saveData) {
            console.log("Aucune sauvegarde trouvée, initialisation d'une nouvelle partie.");
            
            // Variables de base du joueur
            characterIdCounter = 0;
            gems = 1000;
            coins = 0;
            pullCount = 0;
            ownedCharacters = [];
            level = 1;
            exp = 0;
            expMultiplier = 1;
            pullTickets = 0;
            
            // Variables de progression et d'état
            missions = [];
            shopOffers = [];
            shopRefreshTime = Date.now() + TWO_HOURS_MS;
            expBoostEndTime = 0;
            storyProgress = allGameLevels.map(level => ({
                id: level.id,
                unlocked: level.type === 'challenge' ? true : (level.type === 'material' ? true : (level.type === 'story' && level.id === 1)),
                completed: false
            }));
            discoveredCharacters = [];
            characterPreset = [];
            presetConfirmed = false;
            standardPityCount = 0;
            specialPityCount = 0;
            lastUsedBattleTeamIds = [];

            // Paramètres par défaut
            autosellSettings = { Rare: false, Épique: false, Légendaire: false, Mythic: false, Secret: false };

            // Inventaire par défaut (tous les objets à 0)
            inventory = {
                "Haricots": 0, "Fluide mystérieux": 0, "Wisteria Flower": 0, "Pass XP": 0,
                "Cursed Token": 0, "Shadow Tracer": 0, "Stat Chip": 0, "Reroll Token": 0, "Divin Wish": 0,
                "Hellsing Arms": 0, "Green Essence": 0, "Yellow Essence": 0, "Blue Essence": 0,
                "Pink Essence": 0, "Rainbow Essence": 0, "Crystal": 0, "Magic Pendant": 0,
                "Chocolate Bar's": 0, "Head Captain's Coat": 0, "Broken Sword": 0, "Chipped Blade": 0,
                "Cast Blades": 0, "Hardened Blood": 0, "Silverite Sword": 0, "Cursed Finger": 0,
                "Magic Stone": 0, "Magma Stone": 0, "Broken Pendant": 0, "Stone Pendant": 0,
                "Demon Beads": 0, "Alien Core": 0, "Nichirin Cleavers": 0, "Tavern Pie": 0,
                "Blue Chakra": 0, "Red Chakra": 0, "Skin Patch": 0, "Snake Scale": 0, "Senzu Bean": 0,
                "Holy Corpse Eyes": 0, "Holy Corpse Arms": 0, "Completed Holy Corpse": 0,
                "Gorgon's Blindfold": 0, "Caster's Headpiece": 0, "Avalon": 0, "Goddess' Sword": 0,
                "Blade of Death": 0, "Berserker's Blade": 0, "Shunpo Spirit": 0, "Energy Arrow": 0,
                "Hair Ornament": 0, "Bucket Hat": 0, "Horn of Salvation": 0, "Energy Bone": 0,
                "Prison Chair": 0, "Rotara Earring 2": 0, "Rotara Earring 1": 0, "Z Blade": 0,
                "Champ's Belt": 0, "Dog Bone": 0, "Six Eyes": 0, "Tome of Wisdom": 0,
                "Corrupted Visor": 0, "Tainted Ribbon": 0, "Demon Chalice": 0, "Essence of the Spirit King": 0,
                "Ring of Friendship": 0, "Red Jewel": 0, "Majan Essence": 0, "Donut": 0, "Atomic Essence": 0,
                "Plume Céleste": 0, "Sablier Ancien": 0, "Restricting Headband": 0, "Toil Ribbon": 0
            };

        // Cas 2: Chargement d'une partie existante
        } else {
            console.log("Sauvegarde trouvée, chargement de la progression.");
            
            // Charger les données depuis l'objet saveData, en utilisant "||" pour fournir
            // une valeur par défaut si une propriété n'existe pas dans la sauvegarde (utile pour les mises à jour du jeu).
            characterIdCounter = saveData.characterIdCounter || 0;
            gems = saveData.gems || 1000;
            coins = saveData.coins || 0;
            pullCount = saveData.pullCount || 0;
            ownedCharacters = saveData.ownedCharacters || [];
            level = saveData.level || 1;
            exp = saveData.exp || 0;
            expMultiplier = saveData.expMultiplier || 1;
            pullTickets = saveData.pullTickets || 0;
            missions = saveData.missions || [];
            shopOffers = saveData.shopOffers || [];
            shopRefreshTime = saveData.shopRefreshTime || (Date.now() + TWO_HOURS_MS);
            expBoostEndTime = saveData.expBoostEndTime || 0;
            storyProgress = saveData.storyProgress || allGameLevels.map(level => ({
                id: level.id,
                unlocked: level.type === 'challenge' ? true : (level.type === 'material' ? true : (level.type === 'story' && level.id === 1)),
                completed: false
            }));
            inventory = saveData.inventory || {}; // Un objet vide est une bonne valeur par défaut
            discoveredCharacters = saveData.discoveredCharacters || [];
            characterPreset = saveData.characterPreset || [];
            presetConfirmed = saveData.presetConfirmed || false;
            standardPityCount = saveData.standardPityCount || 0;
            specialPityCount = saveData.specialPityCount || 0;
            lastUsedBattleTeamIds = saveData.lastUsedBattleTeamIds || [];
            autosellSettings = saveData.autosellSettings || { Rare: false, Épique: false, Légendaire: false, Mythic: false, Secret: false };
            
            // Assurer la cohérence entre pullTickets et l'inventaire
            if (inventory) {
                inventory["Pass XP"] = pullTickets;
            }
        }

        // 1. Mettre à jour les données et les états internes en premier.
        updateLegendeDisplay();
        updateChallengeDisplay();
        updateMaterialFarmDisplay();
        updateShopDisplay();
        updateMissions();
        applySettings();
        updateTimer();

        // 2. Mettre à jour l'affichage de l'UI principale avec les données finalisées.
        updateUI();
        updateCharacterDisplay();
        updateItemDisplay();
        updateIndexDisplay();
        updateEvolutionDisplay();
        updateStatChangeTabDisplay();
        updateCurseTabDisplay();
        updateTraitTabDisplay();
        updateLimitBreakTabDisplay();

        // 3. Mettre à jour l'affichage des niveaux AVANT de montrer l'onglet
        updateLevelDisplay(); // <-- Ligne cruciale restaurée ici

        // 4. Afficher le premier onglet maintenant que tout est prêt.
        showTab("play");
        
        // 5. Marquer le jeu comme initialisé.
        isGameInitialized = true;

        // 6. Planifier une sauvegarde initiale une fois que tout est chargé.
        scheduleSave();
    }

    async function handleLogin(e) {
        e.preventDefault();
        document.getElementById('auth-error').textContent = '';
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;

        if (!username || !password) {
            document.getElementById('auth-error').textContent = "Veuillez remplir tous les champs.";
            return;
        }

        try {
            // 1. Chercher le pseudo dans Firestore pour trouver l'email associé
            const usernameDocRef = db.collection('usernames').doc(username.toLowerCase());
            const doc = await usernameDocRef.get();

            if (!doc.exists) {
                throw new Error("Ce pseudo n'existe pas.");
            }

            const email = doc.data().email;

            // 2. Se connecter avec l'email récupéré et le mot de passe fourni
            await auth.signInWithEmailAndPassword(email, password);
            // L'observateur onAuthStateChanged s'occupera du reste

        } catch (error) {
            console.error("Erreur de connexion:", error);
            if (error.code === 'auth/wrong-password') {
                document.getElementById('auth-error').textContent = "Mot de passe incorrect.";
            } else {
                document.getElementById('auth-error').textContent = `Erreur: ${error.message}`;
            }
        }
    }

    // MODIFIÉ: Gère l'inscription avec un pseudo
    async function handleSignup(e) {
        e.preventDefault();
        document.getElementById('auth-error').textContent = '';
        const username = document.getElementById('signup-username').value.trim();
        const password = document.getElementById('signup-password').value;

        // Validation du pseudo
        if (username.length < 3 || username.length > 15) {
            document.getElementById('auth-error').textContent = "Le pseudo doit contenir entre 3 et 15 caractères.";
            return;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            document.getElementById('auth-error').textContent = "Le pseudo ne peut contenir que des lettres, des chiffres et des underscores (_).";
            return;
        }

        try {
            // 1. Vérifier si le pseudo est déjà pris dans Firestore (en minuscules pour être insensible à la casse)
            const usernameDocRef = db.collection('usernames').doc(username.toLowerCase());
            const doc = await usernameDocRef.get();

            if (doc.exists) {
                throw new Error("Ce pseudo est déjà utilisé.");
            }

            // 2. Générer un email synthétique pour Firebase Auth
            const email = `${username.toLowerCase()}@gacha-game-ultime.com`; // Le domaine n'a pas besoin d'exister

            // 3. Créer l'utilisateur dans Firebase Auth
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // 4. Enregistrer l'association pseudo/email et uid dans Firestore
            await usernameDocRef.set({
                email: user.email,
                uid: user.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            
            // L'observateur onAuthStateChanged s'occupera du reste

        } catch (error) {
            console.error("Erreur d'inscription:", error);
            if (error.code === 'auth/weak-password') {
                document.getElementById('auth-error').textContent = "Le mot de passe est trop faible.";
            } else {
                document.getElementById('auth-error').textContent = `Erreur: ${error.message}`;
            }
        }
    }

    async function handleLogout() {
        console.log("[LOGOUT] Sauvegarde immédiate avant déconnexion.");
        await _performSave(); // Attend que la sauvegarde soit terminée
        auth.signOut();
    }

    function getRandomStatRank(fromPull = false) {
        let random = Math.random();
        let cumulativeProbability = 0;
        let obtainedRankKey = statRankProbabilities[statRankProbabilities.length - 1].rank; // Fallback au rang le plus bas

        for (const entry of statRankProbabilities) {
            cumulativeProbability += entry.probability;
            if (random < cumulativeProbability) {
                obtainedRankKey = entry.rank;
                break;
            }
        }

        if (fromPull) {
            const rankBOrder = statRanks["B"]?.order;
            const obtainedRankOrder = statRanks[obtainedRankKey]?.order;

            // Safety checks for undefined orders (should not happen with correct statRanks definition)
            if (rankBOrder === undefined) {
                console.error("Stat rank 'B' definition or its order is missing in statRanks. Cannot cap pulls.");
                return obtainedRankKey; // Return original if 'B' is not properly defined
            }
            if (obtainedRankOrder === undefined) {
                console.warn(`Obtained rank '${obtainedRankKey}' has no order defined. Cannot compare for capping. Returning original.`);
                return obtainedRankKey;
            }

            if (obtainedRankOrder > rankBOrder) {
                return "B"; // Cap to "B" if the obtained rank is higher than B
            }
        }
        return obtainedRankKey;
    }

    function recalculateCharacterPower(char) {
        if (!char.statRank || !statRanks[char.statRank]) {
            char.statRank = "A"; // Rang par défaut si non défini
            char.statModifier = statRanks["A"].modifier;
        } else if (typeof char.statModifier === 'undefined' || char.statModifier === null || isNaN(Number(char.statModifier))) {
            char.statModifier = statRanks[char.statRank].modifier;
        }

        let powerBeforeTrait = char.basePower * char.statModifier;
        let traitPowerBonus = 0; // Généralement pas utilisé si powerMultiplier est présent pour le même trait
        let traitPowerMultiplier = 1.0;

        if (char.trait && char.trait.id && char.trait.grade > 0) {
            const traitDef = TRAIT_DEFINITIONS[char.trait.id];
            if (traitDef && traitDef.grades) {
                const gradeDef = traitDef.grades.find(g => g.grade === char.trait.grade);
                if (gradeDef) {
                    // Gère les bonus de puissance directs (comme +X Puissance) - Moins courant avec les multiplicateurs
                    if (typeof gradeDef.powerBonus === 'number') {
                        traitPowerBonus = gradeDef.powerBonus;
                    }
                    // Gère les multiplicateurs de puissance (comme +Y% Puissance)
                    // S'applique aux traits comme Strength, Monarch
                    if (typeof gradeDef.powerMultiplier === 'number') {
                        traitPowerMultiplier = 1.0 + gradeDef.powerMultiplier;
                    }
                    // Note: Les traits de puissance spécifiques au mode (Berserk, Legends, Challenge Master)
                    // sont gérés dans la fonction `confirmSelection` car ils ne modifient pas la puissance de base
                    // du personnage, mais sa puissance effective pendant un combat spécifique.
                }
            }
        }
        
        let powerAfterTraitMultiplier = powerBeforeTrait * traitPowerMultiplier;
        let powerAfterTraitBonus = powerAfterTraitMultiplier + traitPowerBonus; // Appliquer le bonus additif après le multiplicateur
        
        char.power = Math.max(1, Math.floor(powerAfterTraitBonus) + (char.curseEffect || 0));

        if (isNaN(char.power) || char.power <= 0) {
            const baseDefinition = allCharacters.find(c => c.name === char.name);
            const initialPowerFromDefinition = baseDefinition ? baseDefinition.power : 50;
            if (isNaN(char.basePower) || char.basePower <=0) char.basePower = initialPowerFromDefinition / (char.statModifier || 1);
            powerBeforeTrait = char.basePower * (char.statModifier || 1);
            powerAfterTraitMultiplier = powerBeforeTrait * traitPowerMultiplier;
            powerAfterTraitBonus = powerAfterTraitMultiplier + traitPowerBonus;
            char.power = Math.max(1, Math.floor(powerAfterTraitBonus) + (char.curseEffect || 0));
        }
    }

    function showProbTab(tabId) {
      document.getElementById("prob-standard").classList.add("hidden");
      document.getElementById("prob-special").classList.add("hidden");
      document.getElementById(`prob-${tabId}`).classList.remove("hidden");
      probTabButtons.forEach(btn => {
        btn.classList.toggle("border-blue-500", btn.dataset.tab === tabId);
        btn.classList.toggle("border-transparent", btn.dataset.tab !== tabId);
      });
    }

    function populateTargetStatRanks() {
        statTargetRanksSelectionElement.innerHTML = "";
        Object.keys(statRanks).sort((a,b) => statRanks[a].order - statRanks[b].order).forEach(rankKey => {
            const rankData = statRanks[rankKey];
            const label = document.createElement("label");
            label.className = `flex items-center p-1.5 rounded hover:bg-gray-600 transition-colors duration-150`;
            label.innerHTML = `
                <input type="checkbox" value="${rankKey}" class="stat-target-rank-checkbox mr-2 h-4 w-4 ${rankData.borderColor ? rankData.borderColor.replace('border-', 'text-') : 'text-teal-500'} border-gray-400 rounded focus:ring-transparent">
                <span class="${rankData.color || 'text-white'} text-sm font-medium">${rankKey}</span>
            `;
            // AJOUT DE L'ÉCOUTEUR D'ÉVÉNEMENT
            const checkbox = label.querySelector('.stat-target-rank-checkbox');
            checkbox.addEventListener('change', () => {
                if (statKeepBetterToggle.checked) { // Seulement mettre à jour si le toggle principal est actif
                    updateStatChangeTabDisplay();
                }
            });
            statTargetRanksSelectionElement.appendChild(label);
        });
    }

    function formatTime(ms) {
      if (ms <= 0) return "00:00:00";
      let seconds = Math.floor((ms / 1000) % 60);
      let minutes = Math.floor((ms / (1000 * 60)) % 60);
      let hours = Math.floor(ms / (1000 * 60 * 60));

      hours = hours < 10 ? "0" + hours : hours;
      minutes = minutes < 10 ? "0" + minutes : minutes;
      seconds = seconds < 10 ? "0" + seconds : seconds;

      return `${hours}:${minutes}:${seconds}`;
    }

    function updateProbabilitiesDisplay() {
        standardProbabilities.innerHTML = ""; // Vider le contenu précédent
        const decimalPlaces = 5;

        // --- DÉBUT DES AJOUTS POUR LE MINUTEUR DE BANNIÈRE ---
        const probStandardDiv = document.getElementById("prob-standard");
        const h3Title = probStandardDiv ? probStandardDiv.querySelector('h3') : null;

        // Supprimer un ancien conteneur de minuteur s'il existe (pour éviter les doublons lors des mises à jour)
        if (h3Title) {
            const existingTimerContainer = h3Title.querySelector('#banner-change-timer-container-title');
            if (existingTimerContainer) {
                existingTimerContainer.remove();
            }
        }

        let bannerTimerHTMLForTitle = "";
        if (h3Title && currentStandardBanner && currentStandardBanner.generatedAt) {
            const nextChangeTime = currentStandardBanner.generatedAt + TWO_HOURS_MS;
            const timeLeftMs = Math.max(0, nextChangeTime - Date.now()); // S'assurer que le temps n'est pas négatif

            bannerTimerHTMLForTitle = `
                <div id="banner-change-timer-container-title" class="ml-4 text-sm sm:text-base text-gray-300">
                  (Change dans: <span id="standard-banner-timer-title" class="font-bold text-yellow-300">${formatTime(timeLeftMs)}</span>)
                </div>
            `;
            h3Title.classList.add('flex', 'items-center', 'flex-wrap'); // flex-wrap si le titre est long
            h3Title.insertAdjacentHTML('beforeend', bannerTimerHTMLForTitle);

        } else if (h3Title) {
             bannerTimerHTMLForTitle = `
                <div id="banner-change-timer-container-title" class="ml-4 text-sm sm:text-base text-gray-300">
                  (Chargement du minuteur...)
                </div>
            `;
            h3Title.classList.add('flex', 'items-center', 'flex-wrap');
            h3Title.insertAdjacentHTML('beforeend', bannerTimerHTMLForTitle);
        }
        // --- FIN DES AJOUTS POUR LE MINUTEUR DE BANNIÈRE ---


        const mythicConfig = BANNER_CONFIG.Mythic;
        const featuredMythicNames = currentStandardBanner.Mythic || [];
        const allMythicCharsStd = standardCharacters.filter(char => char.rarity === "Mythic");

        // 1. Afficher les Mythics en Vedette individuellement
        featuredMythicNames.forEach((charName, index) => {
            const charData = allMythicCharsStd.find(c => c.name === charName);
            if (!charData) return;
            let individualChance = 0;
            if (mythicConfig.featuredRelativeWeights && mythicConfig.featuredRelativeWeights.length === featuredMythicNames.length) {
                 individualChance = mythicConfig.overallChance * mythicConfig.featuredPoolRatio * mythicConfig.featuredRelativeWeights[index];
            } else if (featuredMythicNames.length > 0) {
                individualChance = (mythicConfig.overallChance * mythicConfig.featuredPoolRatio) / featuredMythicNames.length;
            }

            standardProbabilities.innerHTML += `
                <div class="bg-gray-700 p-4 rounded-lg border-2 ${getRarityBorderClass(charData.rarity)}">
                    <div class="flex items-center gap-4">
                        <img src="${charData.image}" alt="${charData.name}" class="object-contain">
                        <div>
                            <p class="rainbow-text font-semibold">${charData.name} (Vedette)</p>
                            <p class="text-white">Probabilité: ${(individualChance * 100).toFixed(decimalPlaces)}%</p>
                        </div>
                    </div>
                </div>`;
        });

        // 2. Afficher la probabilité groupée pour les Mythics Non-Vedette
        const totalChanceNonFeaturedMythic = mythicConfig.overallChance * (1 - mythicConfig.featuredPoolRatio);
        if (totalChanceNonFeaturedMythic > 0 && allMythicCharsStd.filter(char => !featuredMythicNames.includes(char.name)).length > 0) {
            standardProbabilities.innerHTML += `
                <div class="bg-gray-600 p-4 rounded-lg border-2 ${getRarityBorderClass("Mythic")}">
                    <div class="flex items-center gap-4">
                        <div>
                            <p class="rainbow-text font-semibold">Autres personnages Mythiques</p>
                            <p class="text-white">Probabilité globale: ${(totalChanceNonFeaturedMythic * 100).toFixed(decimalPlaces)}%</p>
                        </div>
                    </div>
                </div>`;
        }

        // 3. Afficher les probabilités groupées pour les autres raretés
        ["Secret", "Légendaire", "Épique", "Rare"].forEach(rarity => {
            const rarityConfig = BANNER_CONFIG[rarity];
            if (!rarityConfig || rarityConfig.overallChance === 0) {
                return;
            }
            let rarityDisplayName = `Personnages ${rarity === "Épique" ? "Épiques" : (rarity + (rarity.endsWith('e') || rarity.endsWith('s') ? '' : 's'))}`;
            if (rarity === "Légendaire") rarityDisplayName = "Personnages Légendaires";

            let textColorClass = "";
            switch(rarity) {
                case "Secret": textColorClass = "text-secret"; break;
                case "Légendaire": textColorClass = "text-yellow-400"; break;
                case "Épique": textColorClass = "text-purple-400"; break;
                case "Rare": textColorClass = "text-gray-400"; break;
                default: textColorClass = "text-white";
            }

            standardProbabilities.innerHTML += `
                <div class="bg-gray-600 p-4 rounded-lg border-2 ${getRarityBorderClass(rarity)}">
                    <div class="flex items-center gap-4">
                        <div>
                            <p class="${textColorClass} font-semibold">${rarityDisplayName}</p>
                            <p class="text-white">Probabilité globale: ${(rarityConfig.overallChance * 100).toFixed(decimalPlaces)}%</p>
                        </div>
                    </div>
                </div>`;
        });

        // Bannière Spéciale (inchangée)
        specialProbabilities.innerHTML = specialCharacters.map(char => {
            // ... (code existant pour specialProbabilities) ...
            let textColorClass = char.color;
            if (char.rarity === "Mythic") textColorClass = "rainbow-text";
            else if (char.rarity === "Secret") textColorClass = "text-secret";
            else if (char.rarity === "Légendaire") textColorClass = "text-yellow-400";
            else if (char.rarity === "Épique") textColorClass = "text-purple-400";
            else if (char.rarity === "Rare") textColorClass = "text-gray-400";
            return `
            <div class="bg-gray-700 p-4 rounded-lg border-2 ${getRarityBorderClass(char.rarity)}">
                <div class="flex items-center gap-4">
                    <img src="${char.image}" alt="${char.name}" class="object-contain">
                    <div>
                        <p class="${textColorClass} font-semibold">${char.name} (${char.rarity})</p>
                        <p class="text-white">Probabilité: ${(char.chance * 100).toFixed(decimalPlaces)}%</p>
                    </div>
                </div>
            </div>`;
        }).join("");
    }

    function getRandomGradeForTrait(traitDef) {
        if (!traitDef || !traitDef.grades || traitDef.grades.length === 0) {
            console.warn(`Le trait ${traitDef?.name || 'inconnu'} n'a pas de grades définis. Fallback.`);
            return { grade: 1, description: "Erreur: Trait sans grade" }; // Fallback
        }

        // If gradeProbabilities is defined and not empty, use the existing logic for multi-grade traits
        if (traitDef.gradeProbabilities && traitDef.gradeProbabilities.length > 0) {
            let randomNumber = Math.random();
            let cumulativeProbability = 0;

            for (const gradeProb of traitDef.gradeProbabilities) {
                cumulativeProbability += gradeProb.probability;
                if (randomNumber <= cumulativeProbability) {
                    const chosenGradeDef = traitDef.grades.find(g => g.grade === gradeProb.grade);
                    return chosenGradeDef || { grade: gradeProb.grade, description: `Grade ${gradeProb.grade} (desc. manquante)` };
                }
            }
            // Fallback if sum of probabilities isn't 1 or other error for multi-grade
            console.warn(`Fallback dans getRandomGradeForTrait (multi-grade) pour ${traitDef.name}. Somme des probabilités de grade != 1?`);
            return traitDef.grades[traitDef.grades.length - 1]; // Returns the highest grade definition in case of issues
        } else {
            // If no gradeProbabilities, assume it's a single-grade trait.
            // Return its first (and only) grade definition.
            // We expect traitDef.grades[0] to have a `grade` property (e.g., grade: 1).
            const singleGradeDef = { ...traitDef.grades[0] };
             // Ensure the 'grade' property exists, default to 1 if not.
            if (typeof singleGradeDef.grade === 'undefined') {
                console.warn(`Trait ${traitDef.name} (single-grade) missing 'grade' property in its definition. Defaulting to grade 1.`);
                singleGradeDef.grade = 1;
            }
            return singleGradeDef;
        }
    }

    function openStatRankProbabilitiesModal() {
        statRankProbabilitiesContent.innerHTML = ""; // Vider le contenu précédent
        statRankProbabilities.forEach(probEntry => {
            const rankData = statRanks[probEntry.rank];
            const percentage = (probEntry.probability * 100).toFixed(probEntry.probability < 0.01 ? 2 : 1); // Plus de décimales pour les petites probas

            const probDiv = document.createElement("div");
            probDiv.className = "flex justify-between items-center p-2 bg-gray-700 rounded";
            probDiv.innerHTML = `
                <span class="${rankData.color || 'text-white'} font-semibold">Rang ${probEntry.rank}</span>
                <span class="text-white">${percentage}%</span>
            `;
            statRankProbabilitiesContent.appendChild(probDiv);
        });
        statRankProbabilitiesModal.classList.remove("hidden");
        enableNoScroll();
    }

    function closeStatRankProbabilitiesModal() {
        statRankProbabilitiesModal.classList.add("hidden");
        disableNoScroll();
    }

    function getExpNeededForCharacterLevel(level, rarity) {
      const baseExp = 50 * level * level; 
      const multiplier = rarityExpMultipliers[rarity] || 1.0; 
      return Math.floor(baseExp * multiplier); 
    }

    function updateLevelDisplay() {
          const worlds = baseStoryLevels.reduce((acc, level) => {
            if (!acc[level.world]) acc[level.world] = [];
            acc[level.world].push(level);
            return acc;
          }, {});
          levelListElement.innerHTML = Object.entries(worlds).map(([worldName, levels]) => {
            const progressLevels = levels.map(level => storyProgress.find(p => p.id === level.id));
            const worldUnlocked = progressLevels.some(p => p.unlocked);
            const worldCompleted = progressLevels.every(p => p.completed);
            return `
              <div class="mb-6">
                <h3 class="text-xl text-white font-bold mb-2">${worldName} ${worldCompleted ? '(Terminé)' : ''}</h3>
                <div class="grid gap-4">
                  ${worldUnlocked ? levels.map(level => {
                    const progress = storyProgress.find(p => p.id === level.id);
                    const isDisabled = !progress.unlocked;
                    const buttonText = level.isInfinite ? `${level.name} (Gemmes/min: ${level.rewards.gemsPerMinute})` : `${level.name} ${progress.completed ? '(Terminé)' : ''}`;
                    return `<button class="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}" onclick="${level.isInfinite ? 'startInfiniteLevel(' : 'startLevel('}${level.id})" ${isDisabled ? 'disabled' : ''}>${buttonText}</button>`;
                  }).join("") : '<p class="text-white">Monde verrouillé. Terminez le monde précédent pour déverrouiller.</p>'}
                </div>
              </div>`;
          }).join("");
          const groupedLevels = storyProgress.reduce((acc, level) => {
            const world = level.id <= 6 ? "Royaume des Ombres" : level.id <= 12 ? "Empire de Cristal" : level.id <= 18 ? "Profondeurs Abyssales" : level.id <= 24 ? "Pics Célestes" : level.id <= 30 ? "Déserts du Vide" : level.id <= 36 ? "Éclipse Éternelle" : "Abîme Infini";
            acc[world] = acc[world] || [];
            acc[world].push(level);
            return acc;
          }, {});
          document.querySelectorAll('.start-level-button').forEach(button => {
            button.addEventListener('click', () => {
              currentLevelId = parseInt(button.dataset.levelId);
              selectedBattleCharacters.clear();
              characterSelectionModal.classList.remove('hidden');
              enableNoScroll();
              updateCharacterSelectionDisplay();
            });
          });
    }

    function updateLegendeDisplay() {
        const legendeLevelListElement = document.getElementById("legende-level-list");
        if (!legendeLevelListElement) return;

        legendeLevelListElement.innerHTML = ""; // Vider le contenu précédent

        const uniqueWorldsInStory = [...new Set(baseStoryLevels.filter(lvl => !lvl.isInfinite).map(level => level.world))];

        let foundLegendaryLevel = false;
        uniqueWorldsInStory.forEach(worldName => {
            const standardLevelsInWorld = baseStoryLevels.filter(level => level.world === worldName && !level.isInfinite && level.type !== 'legendary');
            const worldCompleted = standardLevelsInWorld.length > 0 && standardLevelsInWorld.every(level => {
                const progress = storyProgress.find(p => p.id === level.id);
                return progress && progress.completed;
            });

            const legendaryLevelForWorld = legendaryStoryLevels.find(ll => ll.world === worldName);

            if (legendaryLevelForWorld) {
                let legendaryProgress = storyProgress.find(p => p.id === legendaryLevelForWorld.id);
                if (!legendaryProgress) { // S'assurer que la progression existe pour les niveaux légendaires
                    legendaryProgress = { id: legendaryLevelForWorld.id, unlocked: false, completed: false };
                    storyProgress.push(legendaryProgress); // AJOUTER à storyProgress si nouveau
                }

                // Déverrouiller le niveau légendaire si le monde est terminé et qu'il n'est pas déjà déverrouillé
                if (worldCompleted && !legendaryProgress.unlocked) {
                    legendaryProgress.unlocked = true;
                }

                const isDisabled = !legendaryProgress.unlocked;
                const buttonText = `${legendaryLevelForWorld.name} ${legendaryProgress.completed ? '(Terminé)' : ''}`;

                const levelDiv = document.createElement('div');
                levelDiv.className = 'mb-6';
                levelDiv.innerHTML = `
                    <h3 class="text-xl text-white font-bold mb-2">${worldName} - Défi Légendaire</h3>
                    <div class="grid gap-4">
                        <button class="bg-yellow-600 hover:bg-yellow-700 text-white py-2 px-4 rounded-lg ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}"
                                onclick="startLevel(${legendaryLevelForWorld.id})" ${isDisabled ? 'disabled' : ''}>
                            ${buttonText}
                        </button>
                        ${isDisabled && !worldCompleted ? `<p class="text-sm text-gray-400">Terminez tous les niveaux du monde "${worldName}" pour débloquer ce défi.</p>` : ''}
                        ${isDisabled && worldCompleted && !legendaryProgress.unlocked ? `<p class="text-sm text-gray-400">Défi verrouillé. Le monde "${worldName}" est terminé mais le défi n'est pas encore débloqué.</p>` : ''}
                         ${!worldCompleted && legendaryProgress.unlocked ? `<p class="text-sm text-yellow-300">Attention: Défi débloqué mais le monde "${worldName}" n'est pas complet. (Vérifier logique)</p>` : ''}
                    </div>
                `;
                legendeLevelListElement.appendChild(levelDiv);
                foundLegendaryLevel = true;
            }
        });

        if (!foundLegendaryLevel) {
             legendeLevelListElement.innerHTML = "<p class='text-white'>Aucun défi légendaire disponible pour le moment. Terminez des mondes pour les déverrouiller !</p>";
        }
        scheduleSave(); // Sauvegarder les changements de storyProgress (surtout les nouveaux déverrouillages)
    }

    function startLevel(id, useLastTeam = false) {
      console.log("startLevel appelé avec id:", id, "useLastTeam:", useLastTeam);
      const levelData = allGameLevels.find(lvl => lvl.id === id);
      if (!levelData) {
        console.log("Niveau introuvable, id:", id);
        return;
      }
      
      if (levelData.type !== 'challenge' && levelData.type !== 'minigame' && !storyProgress.find(sp => sp.id === id)?.unlocked) {
          console.log("Niveau non déverrouillé, id:", id);
          return;
      }

      currentLevelId = id;
      selectedBattleCharacters.clear();

      let teamReady = false;
      let loadedTeam = [];

      if (useLastTeam && lastUsedBattleTeamIds && lastUsedBattleTeamIds.length > 0) {
        const validLastTeam = lastUsedBattleTeamIds.every(charId => ownedCharacters.find(c => c.id === charId));
        if (validLastTeam) {
            lastUsedBattleTeamIds.forEach(charId => {
                const index = ownedCharacters.findIndex(c => c.id === charId);
                if (index !== -1) selectedBattleCharacters.add(index);
            });

            const expectedSizeForThisTeam = calculateMaxTeamSize();
            if (selectedBattleCharacters.size === expectedSizeForThisTeam && selectedBattleCharacters.size === lastUsedBattleTeamIds.length) {
                teamReady = true;
                loadedTeam = Array.from(selectedBattleCharacters).map(index => ownedCharacters[index]);
                console.log("Utilisation de la dernière équipe pour enchaîner:", loadedTeam.map(c => c.name));
            } else {
                selectedBattleCharacters.clear();
            }
        }
      }
      
      if (!teamReady && presetConfirmed && characterPreset && characterPreset.length > 0) {
        const validPreset = characterPreset.every(pid => ownedCharacters.find(c => c.id === pid));
        if (validPreset) {
          characterPreset.forEach(pid => {
            const index = ownedCharacters.findIndex(c => c.id === pid);
            if (index !== -1) selectedBattleCharacters.add(index);
          });
          
          const expectedSizeForThisPresetTeam = calculateMaxTeamSize(); 
          if (selectedBattleCharacters.size === expectedSizeForThisPresetTeam && selectedBattleCharacters.size === characterPreset.length) { 
            teamReady = true;
            loadedTeam = Array.from(selectedBattleCharacters).map(index => ownedCharacters[index]);
            console.log("Utilisation du preset confirmé:", loadedTeam.map(c => c.name));
          } else {
            selectedBattleCharacters.clear();
            characterPreset = [];
            presetConfirmed = false;
            localStorage.setItem("characterPreset", JSON.stringify(characterPreset));
            localStorage.setItem("presetConfirmed", presetConfirmed.toString());
          }
        } else {
          characterPreset = [];
          presetConfirmed = false;
          localStorage.setItem("characterPreset", JSON.stringify(characterPreset));
          localStorage.setItem("presetConfirmed", presetConfirmed.toString());
        }
      }

      // AJOUT : Vérification du type de niveau pour router le gameplay
      if (levelData.type === 'minigame') {
        if (teamReady) {
            // Lance directement le mini-jeu si une équipe est prête
            launchMiniGame(levelData, loadedTeam);
        } else {
            // Ouvre la sélection d'équipe, `confirmSelection` gérera le lancement
            characterSelectionModal.classList.remove("hidden");
            enableNoScroll();
            updateCharacterSelectionDisplay();
        }
        return; // Fin de la fonction pour les mini-jeux
      }

      // Logique pour les niveaux normaux
      if (teamReady) {
        console.log("Équipe prête, lancement direct du combat pour le niveau:", levelData.name);
        confirmSelection();
      } else {
        console.log("Aucun preset valide ou dernière équipe, ouverture de la modale de sélection pour le niveau:", levelData.name);
        characterSelectionModal.classList.remove("hidden");
        enableNoScroll();
        updateCharacterSelectionDisplay();
      }
    }


    function startAutofuse() {
      console.log("startAutofuse appelé");
      if (ownedCharacters.length <= 1) {
        resultElement.innerHTML = '<p class="text-red-400">Pas assez de personnages pour autofusionner !</p>';
        return;
      }
      currentAutofuseCharacterId = null;
      autofuseSelectedRarities.clear();
      settingsModal.classList.add("hidden");
      autofuseModal.classList.remove("hidden");
      enableNoScroll();
      updateAutofuseDisplay();
    }

    function updateAutofuseDisplay() {
      // Afficher le personnage principal sélectionné
      let mainCharIsMaxLevel = false;
      if (currentAutofuseCharacterId) {
        const char = ownedCharacters.find(c => c.id === currentAutofuseCharacterId);
        if (char) {
          // MODIFIÉ: Utiliser maxLevelCap
          mainCharIsMaxLevel = char.level >= (char.maxLevelCap || 60);
          autofuseMainCharacterElement.innerHTML = `
            <div class="bg-gray-800 bg-opacity-50 p-4 rounded-lg border-2 ${getRarityBorderClass(char.rarity)}">
              <img src="${char.image}" alt="${char.name}" class="w-full h-32 object-cover rounded mb-2">
              <p class="${char.color} font-semibold">${char.name} (<span class="${char.rarity === 'Mythic' ? 'rainbow-text' : ''}">${char.rarity}</span>, Niv. ${char.level}${mainCharIsMaxLevel ? ` (Max: ${char.maxLevelCap || 60})` : ` / ${char.maxLevelCap || 60}`})</p>
              <p class="text-white">Puissance: ${char.power}</p>
              ${mainCharIsMaxLevel ? '<p class="text-red-400 font-bold mt-2">Niveau maximum atteint ! Ne peut pas recevoir d\'EXP.</p>' : ''}
            </div>
          `;
        }
      } else {
        autofuseMainCharacterElement.innerHTML = '<p class="text-gray-400">Aucun personnage sélectionné</p>';
      }

      // Afficher la grille des personnages disponibles pour être sélectionné comme principal
      autofuseCharacterGrid.innerHTML = ownedCharacters
        // MODIFIÉ: Utiliser maxLevelCap
        .filter(char => char.level < (char.maxLevelCap || 60))
        .sort((a, b) => b.power - a.power)
        .map(char => `
          <div class="bg-gray-800 bg-opacity-50 p-4 rounded-lg border-2 ${getRarityBorderClass(char.rarity)} cursor-pointer hover:bg-gray-700 ${currentAutofuseCharacterId === char.id ? 'border-green-500' : ''}" data-id="${char.id}">
            <img src="${char.image}" alt="${char.name}" class="w-full h-24 object-cover rounded mb-2">
            <p class="${char.color} font-semibold text-sm">${char.name} ${char.locked ? '🔒' : ''}</p>
            <p class="text-white text-xs"><span class="${char.rarity === 'Mythic' ? 'rainbow-text' : ''}">${char.rarity}</span>, Niv. ${char.level} / ${char.maxLevelCap || 60}</p>
          </div>
        `)
        .join("") || '<p class="text-gray-400 col-span-full">Aucun personnage éligible (niveau inférieur à son cap actuel) disponible.</p>';

      // Ajouter des écouteurs aux vignettes
      autofuseCharacterGrid.querySelectorAll("[data-id]").forEach(element => {
        element.addEventListener("click", () => {
          currentAutofuseCharacterId = element.dataset.id;
          updateAutofuseDisplay(); // Mettre à jour l'affichage après sélection
        });
      });

      // Mettre à jour l'état des cases à cocher
      Object.keys(autofuseRarityCheckboxes).forEach(rarity => {
        autofuseRarityCheckboxes[rarity].checked = autofuseSelectedRarities.has(rarity);
      });

      // Compter les personnages à fusionner (doivent être non verrouillés et différents du principal)
      const charactersToFuse = ownedCharacters.filter(c =>
          c.id !== currentAutofuseCharacterId &&
          !c.locked &&
          autofuseSelectedRarities.has(c.rarity)
      );
      autofuseCountElement.textContent = charactersToFuse.length;

      // Activer/désactiver le bouton Confirmer
      const disableConfirm = charactersToFuse.length === 0 || !currentAutofuseCharacterId || mainCharIsMaxLevel;
      confirmAutofuseButton.disabled = disableConfirm;
      confirmAutofuseButton.classList.toggle("opacity-50", disableConfirm);
      confirmAutofuseButton.classList.toggle("cursor-not-allowed", disableConfirm);
    }

    function selectAutofuseRarity(rarity, checked) {
      if (checked) {
        autofuseSelectedRarities.add(rarity);
      } else {
        autofuseSelectedRarities.delete(rarity);
      }
      updateAutofuseDisplay();
    }

    function cancelAutofuse() {
      console.log("cancelAutofuse appelé");
      autofuseSelectedRarities.clear();
      autofuseModal.classList.add("hidden");
      disableNoScroll();
    }

    function confirmAutofuse() {
        console.log("confirmAutofuse appelé");
        if (autofuseSelectedRarities.size === 0 || !currentAutofuseCharacterId) {
            console.log("Personnage principal ou raretés non sélectionnés");
            resultElement.innerHTML = '<p class="text-red-400">Veuillez sélectionner un personnage principal et au moins une rareté.</p>';
            return;
        }
        const mainChar = ownedCharacters.find(c => c.id === currentAutofuseCharacterId);
        if (!mainChar) {
            console.log("Personnage principal non trouvé, currentAutofuseCharacterId:", currentAutofuseCharacterId);
            resultElement.innerHTML = '<p class="text-red-400">Personnage principal non trouvé !</p>';
            autofuseModal.classList.add("hidden");
            document.body.classList.remove("no-scroll");
            return;
        }
        if (mainChar.level >= 100) {
            console.log("Personnage au niveau maximum");
            resultElement.innerHTML = '<p class="text-red-400">Ce personnage est déjà au niveau maximum (100) !</p>';
            autofuseModal.classList.add("hidden");
            document.body.classList.remove("no-scroll");
            return;
        }
        if (mainChar.level >= (mainChar.maxLevelCap || 60)) {
            resultElement.innerHTML = `<p class="text-red-400">Le personnage principal ${mainChar.name} est déjà à son niveau maximum actuel (${mainChar.maxLevelCap || 60}) et ne peut plus recevoir d'EXP. Choisissez un autre personnage ou augmentez son cap.</p>`;
            // Ne pas fermer la modale, laisser l'utilisateur choisir un autre personnage
            return;
        }

        const expByRarity = {
            Rare: 25,
            Épique: 50,
            Légendaire: 100,
            Mythic: 200,
            Secret: 300
        };
        let totalExpGained = 0;
        const fusionSummary = {};

        // --- CORRECTION ICI : Ajout de !c.locked ---
        const charactersToFuse = ownedCharacters.filter(c =>
            c.id !== currentAutofuseCharacterId &&
            !c.locked && // Ajout de la condition !c.locked
            autofuseSelectedRarities.has(c.rarity)
        );
        // --- FIN CORRECTION ---

        if (charactersToFuse.length === 0) {
            console.log("Aucun personnage non verrouillé disponible pour la fusion");
            resultElement.innerHTML = '<p class="text-red-400">Aucun personnage non verrouillé disponible pour la fusion avec les raretés sélectionnées.</p>';
            // Pas besoin de fermer la modale ici, l'utilisateur peut vouloir changer de rareté
            updateAutofuseDisplay(); // Met à jour l'affichage pour refléter 0 personnage à fusionner
            return;
        }

        const characterIdsToFuse = charactersToFuse.map(c => c.id); // Obtenir les IDs avant de modifier ownedCharacters

        charactersToFuse.forEach(char => {
            const expGained = expByRarity[char.rarity] || 25;
            totalExpGained += expGained;
            fusionSummary[char.rarity] = (fusionSummary[char.rarity] || 0) + 1;
        });

        addCharacterExp(mainChar, totalExpGained); // Ajouter l'EXP au personnage principal

        // Supprimer les personnages fusionnés en utilisant leurs IDs
        ownedCharacters = ownedCharacters.filter(c => !characterIdsToFuse.includes(c.id));

        addExp(totalExpGained); // Ajouter l'EXP au joueur

        const summaryText = Object.entries(fusionSummary)
            .map(([rarity, count]) => `${count} ${rarity} (+${count * expByRarity[rarity]} EXP)`)
            .join(", ");
        resultElement.innerHTML = `
        <p class="text-green-400">Multifusion réussie pour ${mainChar.name} !</p>
        <p class="text-white">${charactersToFuse.length} personnage(s) fusionné(s) (non verrouillés): ${summaryText}</p>
        <p class="text-white">Total +${totalExpGained} EXP gagné pour ${mainChar.name} et le joueur</p>
      `;
        autofuseSelectedRarities.clear(); // Réinitialiser les raretés sélectionnées
        autofuseModal.classList.add("hidden");
        disableNoScroll(); // Utiliser la fonction pour gérer le scroll et padding
        updateCharacterDisplay();
        // updateAutofuseCharacterGrid(); // Pas nécessaire car la modale est fermée
        updateUI();
        scheduleSave();
    }

    function addGems(amount) {
        gems = Math.min(gems + amount, 1000000000); // Limite à 10 000 gemmes
        updateUI(); // Met à jour l'affichage
        scheduleSave(); // Sauvegarde la progression
    }

    function openPullMethodModal(pullType) {
      console.log("openPullMethodModal appelé avec pullType:", pullType);
      currentPullType = pullType;
      pullMethodModal.classList.remove("hidden");
      document.body.classList.add("no-scroll");
      pullWithGemsButton.disabled = (pullType === "standard" && gems < 100) || (pullType === "special" && gems < 150);
      pullWithGemsButton.classList.toggle("opacity-50", pullWithGemsButton.disabled);
      pullWithGemsButton.classList.toggle("cursor-not-allowed", pullWithGemsButton.disabled);
      pullWithTicketButton.disabled = pullTickets === 0;
      pullWithTicketButton.classList.toggle("opacity-50", pullWithTicketButton.disabled);
      pullWithTicketButton.classList.toggle("cursor-not-allowed", pullWithTicketButton.disabled);
    }

    function cancelPullMethod() {
      console.log("cancelPullMethod appelé");
      pullMethodModal.classList.add("hidden");
      document.body.classList.remove("no-scroll");
      currentPullType = null;
    }


    function startInfiniteLevel(levelId) {
      if (ownedCharacters.length < 3) {
        resultElement.innerHTML = '<p class="text-red-400">Vous avez besoin d\'au moins 3 personnages pour commencer un combat !</p>';
        return;
      }
      selectedBattleCharacters.clear();
      currentLevelId = levelId;
      infiniteLevelStartTime = Date.now();
      updateCharacterSelectionDisplay();
      characterSelectionModal.classList.remove("hidden");
    }

    function openPresetSelectionModal() {
      console.log("openPresetSelectionModal appelé");
      selectedPresetCharacters.clear();
      presetSelectionModal.classList.remove("hidden");
      enableNoScroll();
      updatePresetSelectionDisplay();
    }

    function updatePresetSelectionDisplay() {
      presetSelectionList.innerHTML = "";
      const currentFunctionalMaxPresetTeamSize = calculateMaxPresetTeamSize(); // Calcul dynamique

      // Mettre à jour le titre de la modale de preset
      const presetModalTitle = document.getElementById("preset-selection-modal-title"); // S'assurer que l'ID est correct
      if (presetModalTitle) {
          presetModalTitle.textContent = `Sélectionner ${currentFunctionalMaxPresetTeamSize} Personnage(s) pour le Preset`;
      }

      const searchNameInputPreset = document.getElementById("preset-search-name");
      const filterRaritySelectPreset = document.getElementById("preset-filter-rarity");
      if (searchNameInputPreset) searchNameInputPreset.value = presetSearchName;
      if (filterRaritySelectPreset) filterRaritySelectPreset.value = presetFilterRarity;


      let charactersToDisplayForPreset = [...ownedCharacters];

      // Appliquer le filtre par nom (utilise la variable globale presetSearchName)
      if (presetSearchName) {
          charactersToDisplayForPreset = charactersToDisplayForPreset.filter(char => (char.name || "").toLowerCase().includes(presetSearchName));
      }

      // Appliquer le filtre par rareté (utilise la variable globale presetFilterRarity)
      if (presetFilterRarity !== "all") {
          charactersToDisplayForPreset = charactersToDisplayForPreset.filter(char => char.rarity === presetFilterRarity);
      }

      const sortedCharacters = charactersToDisplayForPreset.sort((a, b) => {
        if (presetSortCriteria === "power") { // Utilise bien presetSortCriteria
          return (b.power || 0) - (a.power || 0);
        } else if (presetSortCriteria === "rarity") { // Utilise bien presetSortCriteria
          const rarityAValue = rarityOrder[a.rarity] ?? -1;
          const rarityBValue = rarityOrder[b.rarity] ?? -1;
          return rarityBValue - rarityAValue;
        } else if (presetSortCriteria === "level") { // Utilise bien presetSortCriteria
          return (b.level || 0) - (a.level || 0);
        } else if (presetSortCriteria === "name") { // Ajout du tri par nom
          return (a.name || "").localeCompare(b.name || "");
        }
        return 0;
      });

      const selectedPresetCharacterNames = new Set();
      for (const selectedIdx of selectedPresetCharacters) {
          if(ownedCharacters[selectedIdx]) { // Vérifier que l'index est valide
              selectedPresetCharacterNames.add(ownedCharacters[selectedIdx].name);
          }
      }

      sortedCharacters.forEach((char) => {
        const originalIndex = ownedCharacters.findIndex(c => c.id === char.id);
        if (originalIndex === -1) return;

        const charElement = document.createElement("div");
        
        let isCurrentlySelectedInPreset = selectedPresetCharacters.has(originalIndex);
        let isSelectableForPreset = true;
        let additionalClassesPreset = "";

        // Si le personnage n'est pas sélectionné et qu'il y a de la place
        if (!isCurrentlySelectedInPreset && selectedPresetCharacters.size < currentFunctionalMaxPresetTeamSize) {
            if (selectedPresetCharacterNames.has(char.name)) {
                isSelectableForPreset = false;
                additionalClassesPreset = "non-selectable-for-battle";
            }
        } else if (!isCurrentlySelectedInPreset && selectedPresetCharacters.size >= currentFunctionalMaxPresetTeamSize) {
            isSelectableForPreset = false;
            additionalClassesPreset = "opacity-50";
        }


        let rarityTextClass = char.color;
        if (char.rarity === "Mythic") rarityTextClass = "rainbow-text";
        else if (char.rarity === "Secret") rarityTextClass = "text-secret";
        else if (char.rarity === "Vanguard") rarityTextClass = "text-vanguard";


        charElement.className = `bg-gray-800 bg-opacity-50 p-4 rounded-lg transition transform hover:scale-105 cursor-pointer border-2 ${getRarityBorderClass(char.rarity)} ${
            isCurrentlySelectedInPreset ? 'selected-for-battle' : ''
        } ${additionalClassesPreset}`;
        
        charElement.innerHTML = `
          <img src="${char.image}" alt="${char.name}" class="w-full h-32 object-contain rounded mb-2">
          <p class="${rarityTextClass} font-semibold">${char.name} (<span class="${rarityTextClass}">${char.rarity}</span>, Niv. ${char.level})</p>
          <p class="text-white">Puissance: ${char.power}</p>
        `;
        
        if (isSelectableForPreset || isCurrentlySelectedInPreset) {
            charElement.addEventListener("click", () => {
                selectPresetCharacter(originalIndex);
            });
        }
        presetSelectionList.appendChild(charElement);
      });

      // Mettre à jour l'élément d'affichage du compteur
      if (presetSelectedCountDisplayElement) { // Utilise la variable renommée
        presetSelectedCountDisplayElement.textContent = `${selectedPresetCharacters.size}/${currentFunctionalMaxPresetTeamSize}`;
      }
      
      confirmPresetButton.disabled = selectedPresetCharacters.size !== currentFunctionalMaxPresetTeamSize;
      confirmPresetButton.classList.toggle("opacity-50", selectedPresetCharacters.size !== currentFunctionalMaxPresetTeamSize);
      confirmPresetButton.classList.toggle("cursor-not-allowed", selectedPresetCharacters.size !== currentFunctionalMaxPresetTeamSize);
      document.getElementById("preset-sort-criteria").value = presetSortCriteria;
    }

    function selectPresetCharacter(index) {
      const characterToAdd = ownedCharacters[index];

      if (selectedPresetCharacters.has(index)) {
          selectedPresetCharacters.delete(index);
      } else {
          // Recalculer la taille max *potentielle* si ce personnage était ajouté (pour le preset)
          let potentialSelectedForPreset = new Set(selectedPresetCharacters);
          potentialSelectedForPreset.add(index);
          let potentialMaxTeamSizeForPreset = 3;
          let potentialBonusForPreset = 0;
          potentialSelectedForPreset.forEach(idx => {
              const char = ownedCharacters[idx];
              if (char && char.passive && typeof char.passive.teamSizeBonus === 'number') {
                  potentialBonusForPreset = Math.max(potentialBonusForPreset, char.passive.teamSizeBonus);
              }
          });
          potentialMaxTeamSizeForPreset += potentialBonusForPreset;

          if (selectedPresetCharacters.size < potentialMaxTeamSizeForPreset) { // MODIFIÉ: Utilise la taille potentielle
              let alreadySelectedSameNameInPreset = false;
              for (const selectedIndex of selectedPresetCharacters) {
                  if (ownedCharacters[selectedIndex].name === characterToAdd.name) {
                      alreadySelectedSameNameInPreset = true;
                      break;
                  }
              }
              if (!alreadySelectedSameNameInPreset) {
                  selectedPresetCharacters.add(index);
              } else {
                  console.log(`Preset: Personnage ${characterToAdd.name} (ou un autre du même nom) déjà sélectionné pour ce preset.`);
              }
          }
      }
      updatePresetSelectionDisplay(); // Ceci va recalculer et réafficher avec la bonne taille max
    }

    function confirmPreset() {
      console.log("confirmPreset appelé");
      const currentMaxPresetTeamSize = calculateMaxPresetTeamSize(); // MODIFIÉ: Utilise la taille dynamique

      if (selectedPresetCharacters.size !== currentMaxPresetTeamSize) { // MODIFIÉ: Utilise la taille dynamique
        resultElement.innerHTML = `<p class="text-red-400">Veuillez sélectionner exactement ${currentMaxPresetTeamSize} personnage(s) !</p>`;
        return;
      }
      characterPreset = Array.from(selectedPresetCharacters).map(index => ownedCharacters[index].id);
      presetConfirmed = true;
      localStorage.setItem("characterPreset", JSON.stringify(characterPreset));
      localStorage.setItem("presetConfirmed", presetConfirmed);
      resultElement.innerHTML = '<p class="text-green-400">Preset enregistré avec succès !</p>';
      selectedPresetCharacters.clear();
      presetSelectionModal.classList.add("hidden");
      disableNoScroll();
      updateCharacterDisplay();
    }


    function cancelPreset() {
      console.log("cancelPreset appelé");
      selectedPresetCharacters.clear();
      presetSelectionModal.classList.add("hidden");
      disableNoScroll();
      updateCharacterDisplay();
    }

    function loadPreset() {
      console.log("loadPreset appelé, characterPreset:", characterPreset);
      if (characterPreset.length !== 3) {
        resultElement.innerHTML = '<p class="text-red-400">Aucun preset valide enregistré ou le preset n\'est pas complet !</p>';
        return;
      }
      const validPresetOwnership = characterPreset.every(id => ownedCharacters.find(c => c.id === id));
      if (!validPresetOwnership) {
        resultElement.innerHTML = '<p class="text-red-400">Le preset contient des personnages non possédés ! Il sera vidé.</p>';
        characterPreset = [];
        presetConfirmed = false;
        localStorage.setItem("characterPreset", JSON.stringify(characterPreset));
        localStorage.setItem("presetConfirmed", presetConfirmed);
        selectedBattleCharacters.clear(); // Vider la sélection si le preset est invalide
        updateCharacterSelectionDisplay();
        return;
      }

      selectedBattleCharacters.clear(); // Vider la sélection actuelle avant de charger
      const tempSelectedNamesFromPreset = new Set(); // Pour suivre les noms ajoutés depuis le preset

      for (const charOwnedId of characterPreset) {
          const index = ownedCharacters.findIndex(c => c.id === charOwnedId);
          if (index !== -1) {
              const characterToLoad = ownedCharacters[index];
              if (!tempSelectedNamesFromPreset.has(characterToLoad.name)) {
                  if (selectedBattleCharacters.size < 3) { // S'assurer qu'on n'ajoute pas plus de 3
                      selectedBattleCharacters.add(index);
                      tempSelectedNamesFromPreset.add(characterToLoad.name);
                  }
              } else {
                  console.warn(`Preset: Le personnage ${characterToLoad.name} (ID: ${charOwnedId}) est un doublon par nom dans le preset et a été ignoré lors du chargement.`);
              }
          }
      }
      
      if (selectedBattleCharacters.size < 3) {
          resultElement.innerHTML = '<p class="text-yellow-400">Le preset a été chargé, mais contenait des doublons. Veuillez compléter votre équipe.</p>';
          // Le bouton "Confirmer" sera désactivé par updateCharacterSelectionDisplay si la taille n'est pas 3.
      } else {
          // Si tout s'est bien passé et que 3 personnages uniques ont été chargés.
           resultElement.innerHTML = '<p class="text-green-400">Preset chargé !</p>';
           setTimeout(() => {
                if (resultElement.innerHTML.includes("Preset chargé !")) {
                    resultElement.innerHTML = `<p class="text-white text-lg">Tire pour obtenir des personnages légendaires !</p>`;
                }
           }, 3000);
      }

      updateCharacterSelectionDisplay(); // Met à jour l'affichage avec les personnages chargés
    }

    function updateIndexDisplay() {
        if (!allCharacters) {
            console.error("allCharacters n'est pas défini");
            indexDisplay.innerHTML = '<p class="text-red-400">Erreur : Liste des personnages non disponible.</p>';
            return;
        }

        // Trier les personnages par rareté
        const sortedCharacters = [...allCharacters].sort((a, b) => {
            return rarityOrder[a.rarity] - rarityOrder[b.rarity];
        });

        indexDisplay.innerHTML = sortedCharacters.map(char => {
            const isDiscovered = discoveredCharacters.includes(char.name);
            return `
            <div class="relative p-2 rounded-lg border ${isDiscovered ? getRarityBorderClass(char.rarity) : 'unowned-character'}">
                <img src="${char.image}" alt="${char.name}" class="w-full h-32 object-cover rounded">
                <p class="text-center text-white font-semibold mt-2">${isDiscovered ? char.name : '???'}</p>
                <p class="text-center ${isDiscovered ? (char.rarity === 'Mythic' ? 'rainbow-text' : char.color) : 'text-gray-400'}">${isDiscovered ? char.rarity : 'Inconnu'}</p>
            </div>
            `;
        }).join("");
    }

    let autosellSettings = JSON.parse(localStorage.getItem("autosellSettings")) || {
      Rare: false,
      Épique: false,
      Légendaire: false,
      Mythic: false,
      Secret: false
    };

    function autoSellCharacter(char) {
      const gemValue = char.rarity === "Rare" ? 10 : char.rarity === "Épique" ? 50 : char.rarity === "Légendaire" ? 100 : char.rarity === "Mythic" ? 500 : 1000;
      const coinValue = char.rarity === "Rare" ? 5 : char.rarity === "Épique" ? 15 : char.rarity === "Légendaire" ? 30 : char.rarity === "Mythic" ? 100 : 200;
      
      addGems(gemValue);
      coins = Math.min(coins + coinValue, 10000000);
      
      missions.forEach(mission => {
        if (!mission.completed) {
          if (mission.type === "sell_chars") mission.progress++;
          if (mission.type === "sell_rare_chars" && char.rarity === "Rare") mission.progress++;
        }
      });
      checkMissions();
      return { gems: gemValue, coins: coinValue };
    }

    async function confirmSelection() {
        const currentMaxTeamSize = calculateMaxTeamSize();
        if (selectedBattleCharacters.size !== currentMaxTeamSize) {
            console.warn("Tentative de confirmation avec une sélection invalide. Taille attendue:", currentMaxTeamSize, "Taille actuelle:", selectedBattleCharacters.size);
            if (!characterSelectionModal.classList.contains("hidden")) {
                return;
            }
            characterSelectionModal.classList.remove("hidden");
            enableNoScroll();
            updateCharacterSelectionDisplay();
            return;
        }

        lastUsedBattleTeamIds = Array.from(selectedBattleCharacters).map(index => ownedCharacters[index].id);
        
        if (!characterSelectionModal.classList.contains("hidden")) {
            characterSelectionModal.classList.add("hidden");
            disableNoScroll();
        }

        const selectedCharsObjects = Array.from(selectedBattleCharacters).map(index => ownedCharacters[index]);
        const levelData = allGameLevels.find(l => l.id === currentLevelId);
        
        // AJOUT : Aiguillage vers le mini-jeu si le type de niveau correspond
        if (levelData && levelData.type === 'minigame') {
            launchMiniGame(levelData, selectedCharsObjects);
            return; // Important : arrête l'exécution pour ne pas lancer le combat automatique
        }

        let progress = storyProgress.find(p => p.id === currentLevelId);
        if (!progress && levelData && levelData.type === 'challenge') {
            progress = { id: currentLevelId, unlocked: true, completed: false };
            storyProgress.push(progress);
        }

        if (!levelData || !progress) {
            console.error("Données de niveau ou de progression introuvables dans confirmSelection. Level ID:", currentLevelId);
            resultElement.innerHTML = `<p class="text-white text-lg">Tire pour obtenir des personnages légendaires !</p>`;
            return;
        }
        
        if (selectedCharsObjects.some(char => char === undefined)) {
            console.error("Un ou plusieurs personnages sélectionnés sont undefined. Indices:", Array.from(selectedBattleCharacters), "OwnedChars:", ownedCharacters.length);
            selectedBattleCharacters.clear();
            lastUsedBattleTeamIds = [];
            characterSelectionModal.classList.remove("hidden");
            enableNoScroll();
            updateCharacterSelectionDisplay();
            resultElement.innerHTML = '<p class="text-red-500">Erreur de sélection d\'équipe. Veuillez réessayer.</p>';
            return;
        }

        resultElement.innerHTML = `<p class="text-white">${levelData.isInfinite ? 'Plongée dans l\'Abîme Infini...' : 'Combat en cours contre ' + levelData.enemy.name + '...'}</p>`;
        if (animationsEnabled) {
            resultElement.classList.add("animate-pulse");
        }
        if (soundEnabled) battleSound.play();
        await new Promise(resolve => setTimeout(resolve, 1500));
        resultElement.classList.remove("animate-pulse");

        let playerPower = 0;
        selectedCharsObjects.forEach(char => {
            let battlePower = char.power;
            if (char.trait && char.trait.id && char.trait.grade > 0) {
                const traitDef = TRAIT_DEFINITIONS[char.trait.id];
                if (traitDef && traitDef.grades) {
                    const gradeDef = traitDef.grades.find(g => g.grade === char.trait.grade);
                    if (gradeDef) {
                        if (levelData.isInfinite && typeof gradeDef.powerMultiplierInfinite === 'number') {
                            battlePower *= (1 + gradeDef.powerMultiplierInfinite);
                        } else if (levelData.type === 'legendary' && typeof gradeDef.powerMultiplierLegend === 'number') {
                            battlePower *= (1 + gradeDef.powerMultiplierLegend);
                        } else if (levelData.type === 'challenge' && typeof gradeDef.powerMultiplierChallenge === 'number') {
                            battlePower *= (1 + gradeDef.powerMultiplierChallenge);
                        }
                    }
                }
            }
            playerPower += Math.floor(battlePower);
        });

        const enemyPower = levelData.enemy.power;
        const playerScore = playerPower * (1 + (Math.random() * 0.1));
        const enemyScore = enemyPower * (1 + (Math.random() * 0.1));

        let battleOutcomeMessage = "";

        if (levelData.isInfinite) {
            // Logique pour le niveau infini... (inchangée)
            const timeSurvived = Math.floor((Date.now() - infiniteLevelStartTime) / 1000);
            const baseGemsEarnedInfinite = Math.floor(timeSurvived / 60) * levelData.rewards.gemsPerMinute;
            let golderBonusGemsInfinite = 0;
            let golderMessagePartInfinite = "";

            selectedCharsObjects.forEach(char => {
                if (char.trait && char.trait.id === 'golder' && char.trait.grade > 0) {
                    const traitDef = TRAIT_DEFINITIONS['golder'];
                    const gradeDef = traitDef.grades.find(g => g.grade === char.trait.grade);
                    if (gradeDef && typeof gradeDef.gemBonusPercentageAllModes === 'number') {
                        golderBonusGemsInfinite += Math.floor(baseGemsEarnedInfinite * gradeDef.gemBonusPercentageAllModes);
                    }
                }
            });
            const totalGemsEarnedInfinite = baseGemsEarnedInfinite + golderBonusGemsInfinite;
            if (golderBonusGemsInfinite > 0) {
                golderMessagePartInfinite = ` (dont +${golderBonusGemsInfinite} grâce au trait Golder)`;
            }

            gems = Math.min(gems + totalGemsEarnedInfinite, 10000000);

            const expEarned = Math.floor(timeSurvived / 10);
            addExp(expEarned);
            selectedCharsObjects.forEach(char => {
                addCharacterExp(char, expEarned);
            });
            battleOutcomeMessage = `
                <p class="text-green-400 text-2xl font-bold mb-2">Survie Réussie !</p>
                <p class="text-white">Vous avez survécu ${timeSurvived} secondes dans l'Abîme Infini !</p>
                <p class="text-white">Récompenses: +${totalGemsEarnedInfinite} gemmes${golderMessagePartInfinite}, +${expEarned} EXP</p>`;
            if (animationsEnabled) confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
            infiniteLevelStartTime = null;

        } else {
            // Logique pour les niveaux normaux... (inchangée)
            if (playerScore > enemyScore) { 
                // Logique de VICTOIRE (inchangée)
                 let itemRewardText = '';

                if (levelData.type === "story" && !levelData.isInfinite) {
                    const storyWorldNames = [...new Set(baseStoryLevels.filter(l => l.type === 'story' && !l.isInfinite).map(l => ({world: l.world, firstId: Math.min(...baseStoryLevels.filter(sl => sl.world === l.world && sl.type === 'story' && !sl.isInfinite).map(sl => sl.id))})).sort((a, b) => a.firstId - b.firstId).map(w => w.world))];
                    const worldArrayIndex = storyWorldNames.indexOf(levelData.world);
                    const worldNumberForReward = worldArrayIndex !== -1 ? worldArrayIndex + 1 : null;

                    if (worldNumberForReward) {
                        const worldRewardDef = worldRewards.find(wr => wr.world === worldNumberForReward);
                        if (worldRewardDef && worldRewardDef.item) {
                            const itemQuantityStory = Math.floor(Math.random() * (worldRewardDef.maxQuantity - worldRewardDef.minQuantity + 1)) + worldRewardDef.minQuantity;
                            inventory[worldRewardDef.item] = (inventory[worldRewardDef.item] || 0) + itemQuantityStory;
                            itemRewardText += `${itemRewardText ? ', ' : ''}+${itemQuantityStory} ${worldRewardDef.item}`;
                        }
                    }
                }
                
                if ((levelData.type === "legendary" || levelData.type === "challenge" || levelData.type === "material") && levelData.rewards.itemChance) {
                    const chancesArray = Array.isArray(levelData.rewards.itemChance) ? levelData.rewards.itemChance : [levelData.rewards.itemChance];
                    chancesArray.forEach(chanceDef => {
                        if (chanceDef.item && typeof chanceDef.minQuantity === 'number' && typeof chanceDef.maxQuantity === 'number' && typeof chanceDef.probability === 'number') {
                            let finalDropProbability = chanceDef.probability;
                            let looterEffectAppliedToProbThisItem = false;
                            selectedCharsObjects.forEach(char => {
                                if (char.trait && char.trait.id === 'looter' && char.trait.grade > 0) {
                                    const traitDefLooter = TRAIT_DEFINITIONS['looter'];
                                    if (traitDefLooter) {
                                        const gradeDefLooter = traitDefLooter.grades.find(g => g.grade === char.trait.grade);
                                        if (gradeDefLooter && typeof gradeDefLooter.itemDropRateStoryBonusPercentage === 'number') {
                                            if (chanceDef.probability < 1.0) {
                                                const increasedProbability = chanceDef.probability * (1 + gradeDefLooter.itemDropRateStoryBonusPercentage);
                                                if (increasedProbability > finalDropProbability) {
                                                    finalDropProbability = Math.min(increasedProbability, 1.0);
                                                }
                                                if (finalDropProbability > chanceDef.probability) looterEffectAppliedToProbThisItem = true;
                                            }
                                        }
                                    }
                                }
                            });
                            if (Math.random() < finalDropProbability) {
                                const itemQuantity = Math.floor(Math.random() * (chanceDef.maxQuantity - chanceDef.minQuantity + 1)) + chanceDef.minQuantity;
                                inventory[chanceDef.item] = (inventory[chanceDef.item] || 0) + itemQuantity;
                                itemRewardText += `${itemRewardText ? ', ' : ''}+${itemQuantity} ${chanceDef.item}`;
                                if (looterEffectAppliedToProbThisItem) itemRewardText += ` (Looter actif)`;
                            }
                        }
                    });
                }

                let baseGemsRewardForLevel = levelData.rewards.gems;
                let baseCoinsRewardForLevel = levelData.rewards.coins;
                const expReward = levelData.rewards.exp;

                let gemsRewardToPlayer = baseGemsRewardForLevel;
                if (levelData.type !== 'challenge' && progress.completed) gemsRewardToPlayer = Math.floor(baseGemsRewardForLevel * 0.5);

                let fortuneBonusGems = 0, golderBonusGems = 0, golderBonusCoins = 0;
                selectedCharsObjects.forEach(char => {
                    if (char.trait && char.trait.id && char.trait.grade > 0) {
                        const traitDef = TRAIT_DEFINITIONS[char.trait.id];
                        const gradeDef = traitDef.grades.find(g => g.grade === char.trait.grade);
                        if (gradeDef) {
                            if (levelData.type === 'story' && char.trait.id === 'fortune' && typeof gradeDef.gemBonusPercentage === 'number') fortuneBonusGems += Math.floor(baseGemsRewardForLevel * gradeDef.gemBonusPercentage);
                            if (char.trait.id === 'golder') {
                                if (typeof gradeDef.gemBonusPercentageAllModes === 'number') golderBonusGems += Math.floor(baseGemsRewardForLevel * gradeDef.gemBonusPercentageAllModes);
                                if (typeof gradeDef.coinBonusPercentageAllModes === 'number') golderBonusCoins += Math.floor(baseCoinsRewardForLevel * gradeDef.coinBonusPercentageAllModes);
                            }
                        }
                    }
                });

                let fortuneMessagePart = fortuneBonusGems > 0 ? ` +${fortuneBonusGems} Gemmes` : "";
                let golderGemsMessagePart = golderBonusGems > 0 ? ` +${golderBonusGems} Gemmes` : "";
                let golderCoinsMessagePart = golderBonusCoins > 0 ? ` +${golderBonusCoins} Pièces` : "";
                addGems(gemsRewardToPlayer + fortuneBonusGems + golderBonusGems);
                coins = Math.min(coins + baseCoinsRewardForLevel + golderBonusCoins, 10000000);
                addExp(expReward);
                selectedCharsObjects.forEach(char => addCharacterExp(char, expReward));

                battleOutcomeMessage = `<p class="text-green-400 text-2xl font-bold mb-2">Victoire !</p><p class="text-white">Victoire contre ${levelData.enemy.name} !</p><p class="text-white">Récompenses: +${gemsRewardToPlayer} gemmes${(levelData.type !== 'challenge' && progress.completed && gemsRewardToPlayer !== baseGemsRewardForLevel) ? ' (réduit)' : ''}${fortuneMessagePart}${golderGemsMessagePart}, +${baseCoinsRewardForLevel} pièces${golderCoinsMessagePart}, +${expReward} EXP ${itemRewardText ? ', ' + itemRewardText : ''}</p>`;

                missions.forEach(mission => {
                    if (!mission.completed) {
                        if (levelData.type === 'story' && mission.type === 'complete_story_levels') mission.progress++;
                        else if (levelData.type === 'legendary' && mission.type === 'complete_legendary_levels') mission.progress++;
                        else if (levelData.type === 'challenge' && mission.type === 'complete_challenge_levels') mission.progress++;
                    }
                });
                if (!progress.completed) progress.completed = true;

                if (levelData.type === 'story' && !levelData.isInfinite) {
                    const nextSequentialLevelId = levelData.id + 1;
                    const nextSequentialLevelData = allGameLevels.find(l => l.id === nextSequentialLevelId);
                    if (nextSequentialLevelData) {
                        const nextSequentialLevelProgress = storyProgress.find(p => p.id === nextSequentialLevelId);
                        if (nextSequentialLevelProgress && nextSequentialLevelData.type === 'story' && !nextSequentialLevelData.isInfinite && nextSequentialLevelData.world === levelData.world && !nextSequentialLevelProgress.unlocked) {
                            nextSequentialLevelProgress.unlocked = true;
                            battleOutcomeMessage += `<p class="text-white mt-1">${nextSequentialLevelData.name} déverrouillé !</p>`;
                        }
                    }
                    const currentWorldStoryLevels = baseStoryLevels.filter(l => l.world === levelData.world && l.type === 'story' && !l.isInfinite);
                    if (currentWorldStoryLevels.length > 0) {
                        const maxIdInCurrentWorld = Math.max(...currentWorldStoryLevels.map(l => l.id));
                        if (levelData.id === maxIdInCurrentWorld) {
                            const storyWorldNames = [...new Set(baseStoryLevels.filter(l => l.type === 'story' && !l.isInfinite).map(l => ({ world: l.world, firstId: Math.min(...baseStoryLevels.filter(sl => sl.world === l.world && sl.type === 'story' && !sl.isInfinite).map(sl => sl.id)) })).sort((a, b) => a.firstId - b.firstId).map(w => w.world))];
                            const currentWorldIndexInList = storyWorldNames.indexOf(levelData.world);
                            if (currentWorldIndexInList !== -1 && currentWorldIndexInList < storyWorldNames.length - 1) {
                                const nextWorldNameInList = storyWorldNames[currentWorldIndexInList + 1];
                                const levelsInNextWorld = baseStoryLevels.filter(l => l.world === nextWorldNameInList && l.type === 'story' && !l.isInfinite);
                                if (levelsInNextWorld.length > 0) {
                                    const firstLevelOfNextWorldId = Math.min(...levelsInNextWorld.map(l => l.id));
                                    const firstLevelOfNextWorldData = levelsInNextWorld.find(l => l.id === firstLevelOfNextWorldId);
                                    if (firstLevelOfNextWorldData) {
                                        const firstLevelOfNextWorldProgress = storyProgress.find(p => p.id === firstLevelOfNextWorldData.id);
                                        if (firstLevelOfNextWorldProgress && !firstLevelOfNextWorldProgress.unlocked) {
                                            firstLevelOfNextWorldProgress.unlocked = true;
                                            battleOutcomeMessage += `<p class="text-white mt-1">Nouveau monde déverrouillé: ${firstLevelOfNextWorldData.name} !</p>`;
                                        }
                                    }
                                }
                            }
                        }
                    }
                    const infiniteLevelIdToCheck = 49;
                    const infiniteLvlProgress = storyProgress.find(p => p.id === infiniteLevelIdToCheck);
                    const infiniteLvlDef = allGameLevels.find(l => l.id === infiniteLevelIdToCheck && l.isInfinite);
                    if (infiniteLvlProgress && infiniteLvlDef && !infiniteLvlProgress.unlocked) {
                        const allStandardStoryLevels = baseStoryLevels.filter(lvl => lvl.type === 'story' && !lvl.isInfinite);
                        const allStandardStoryLevelsNowCompleted = allStandardStoryLevels.every(stdLvl => {
                            const prog = storyProgress.find(p => p.id === stdLvl.id);
                            return prog && prog.completed;
                        });
                        if (allStandardStoryLevelsNowCompleted) {
                            infiniteLvlProgress.unlocked = true;
                            battleOutcomeMessage += `<p class="text-white mt-1 font-bold text-yellow-300">${infiniteLvlDef.name} déverrouillé ! Tous les mondes d'histoire ont été conquis !</p>`;
                            if (animationsEnabled) setTimeout(() => confetti({ particleCount: 200, spread: 120, origin: { y: 0.4 }, angle: 90, scalar: 1.5, colors: ['#FFD700', '#FF8C00', '#FFA500'] }), 500);
                        }
                    }
                }
                if (soundEnabled) winSound.play();
                if (animationsEnabled) confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
                localStorage.setItem("inventory", JSON.stringify(inventory));
            } else { 
                // Logique de DÉFAITE (inchangée)
                battleOutcomeMessage = `<p class="text-red-400 text-2xl font-bold mb-2">Défaite !</p><p class="text-white">Défaite contre ${levelData.enemy.name} ! Votre puissance: ${playerPower.toFixed(0)} (Score: ${playerScore.toFixed(0)}), Ennemi: ${enemyPower.toFixed(0)} (Score: ${enemyScore.toFixed(0)})</p><p class="text-white">Mieux vous préparer et réessayez !</p>`;
                selectedCharsObjects.forEach(char => addCharacterExp(char, Math.floor(levelData.rewards.exp / 4)));
                if (soundEnabled) loseSound.play();
            }
        }

        resultElement.innerHTML = battleOutcomeMessage;
        setTimeout(() => {
            const currentResultHTML = resultElement.innerHTML;
            if (currentResultHTML.includes("Victoire !") || currentResultHTML.includes("Défaite !") || currentResultHTML.includes("Survie Réussie !")) {
                resultElement.innerHTML = `<p class="text-white text-lg">Tire pour obtenir des personnages légendaires !</p>`;
            }
        }, 7000);

        selectedBattleCharacters.clear();
        updateLevelDisplay();
        updateLegendeDisplay();
        updateChallengeDisplay();
        updateCharacterDisplay();
        updateIndexDisplay();
        updateUI();
        updateItemDisplay();
        saveProgress();
    }

    function updateChallengeDisplay() {
        const challengeLevelListElement = document.getElementById("challenge-level-list");
        if (!challengeLevelListElement) return;

        challengeLevelListElement.innerHTML = ""; // Vider le contenu précédent

        if (challengeLevels.length === 0) {
            challengeLevelListElement.innerHTML = "<p class='text-white'>Aucun défi disponible pour le moment.</p>";
            return;
        }
        
        challengeLevels.forEach(level => {
            const progress = storyProgress.find(p => p.id === level.id) || { unlocked: true, completed: false };
            if (!storyProgress.find(p => p.id === level.id)) {
                storyProgress.push({ id: level.id, unlocked: true, completed: false });
            }

            const isDisabled = !progress.unlocked;
            const buttonText = `${level.name} ${progress.completed ? '(Terminé)' : ''}`;
            
            // Logique pour déterminer le style du bouton
            let buttonClass = 'bg-purple-600 hover:bg-purple-700'; // Style par défaut pour les challenges normaux
            if(level.type === 'minigame') {
                buttonClass = 'bg-red-600 hover:bg-red-700 border-2 border-yellow-400'; // Style spécial pour le mini-jeu
            }

            let itemDropText = '';
            if (level.rewards.itemChance) {
                const chancesArray = Array.isArray(level.rewards.itemChance) ? level.rewards.itemChance : [level.rewards.itemChance];
                const dropNames = chancesArray.map(chanceDef => {
                    if (chanceDef && chanceDef.item) {
                        return `${chanceDef.item} (${(chanceDef.probability * 100).toFixed(2)}%)`;
                    }
                    return '';
                }).filter(Boolean).join(', ');

                if (dropNames) {
                    itemDropText = `<p>Drop Spécial: ${dropNames}</p>`;
                }
            }

            const levelDiv = document.createElement('div');
            levelDiv.className = 'mb-6';
            levelDiv.innerHTML = `
                <h3 class="text-xl text-white font-bold mb-2">${level.world}</h3>
                <div class="grid gap-2">
                    <button class="${buttonClass} text-white py-2 px-4 rounded-lg transition-colors duration-200 ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}"
                            onclick="startLevel(${level.id})" ${isDisabled ? 'disabled' : ''}>
                        ${buttonText}
                    </button>
                    <div class="text-xs text-gray-300 px-2 mt-1">
                      <p>Ennemi: ${level.enemy.name} (Vie: ${level.enemy.power.toLocaleString()})</p>
                      <p>Récompenses: ${level.rewards.gems}G, ${level.rewards.coins}P, ${level.rewards.exp}EXP</p>
                      ${itemDropText}
                    </div>
                </div>
            `;
            challengeLevelListElement.appendChild(levelDiv);
        });

        scheduleSave();
    }

    function addCharacterExp(character, amount) {
      const currentCharacterMaxLevel = character.maxLevelCap || 60; // Utiliser le cap actuel du personnage

      if (character.level >= currentCharacterMaxLevel) { // Vérifier par rapport au cap actuel
        character.exp = 0; // Si déjà au cap, s'assurer que l'exp est à 0
        return;
      }

      character.exp += Math.floor(amount * expMultiplier);
      let leveledUp = false;
      let expNeeded = getExpNeededForCharacterLevel(character.level, character.rarity);

      while (character.exp >= expNeeded && character.level < currentCharacterMaxLevel) { // Boucler tant qu'on est sous le cap actuel
        const currentStatModifier = character.statModifier || (statRanks[character.statRank]?.modifier || 1.0);
        const powerFromBaseAndStatRankBeforeLevelUp = character.basePower * currentStatModifier;
        const currentCurseEffectValue = character.curseEffect || 0;
        let curseRatioRelativeToBaseAndStatRank = 0;
        if (powerFromBaseAndStatRankBeforeLevelUp !== 0 && currentCurseEffectValue !== 0) {
            curseRatioRelativeToBaseAndStatRank = currentCurseEffectValue / powerFromBaseAndStatRankBeforeLevelUp;
        }

        character.exp -= expNeeded;
        character.level++;
        leveledUp = true;

        let powerIncreaseBase = 15;
        let powerIncreasePerRarity = 5;
        let rarityFactor = rarityOrder[character.rarity] || 1;
        const levelUpPowerGain = powerIncreaseBase + (rarityFactor * powerIncreasePerRarity);

        character.basePower += levelUpPowerGain;

        if (curseRatioRelativeToBaseAndStatRank !== 0) {
            const newPowerFromBaseAndStatRankAfterLevelUp = character.basePower * currentStatModifier;
            character.curseEffect = Math.round(newPowerFromBaseAndStatRankAfterLevelUp * curseRatioRelativeToBaseAndStatRank);
        }

        recalculateCharacterPower(character);

        if (character.level === currentCharacterMaxLevel) { // Si le cap actuel est atteint
          character.exp = 0;
          // Afficher un message plus générique car le cap peut être 60, 65, 70, etc.
          resultElement.innerHTML += `<p class="text-yellow-400">${character.name} a atteint le Niveau ${character.level} (Cap Actuel) !</p>`;
          break;
        }
        expNeeded = getExpNeededForCharacterLevel(character.level, character.rarity);
      }

      if (character.level < currentCharacterMaxLevel) { // Si toujours sous le cap actuel
          const currentExpNeededForDisplay = getExpNeededForCharacterLevel(character.level, character.rarity);
          if (character.exp >= currentExpNeededForDisplay) {
              character.exp = currentExpNeededForDisplay - 1;
          }
      } else { // Si au cap actuel (ou au-dessus par erreur, ce qui ne devrait pas arriver avec la boucle `while`)
          character.exp = 0;
      }

      if (leveledUp && character.level < currentCharacterMaxLevel) { // Si level up mais pas encore au cap
        resultElement.innerHTML += `<p class="text-green-400">${character.name} a atteint le niveau ${character.level} !</p>`;
      }
      // Le message pour avoir atteint le cap est déjà géré dans la boucle while.
    }

    // Existing functions (unchanged, included for completeness)
    function applySettings() {
      console.log("applySettings appelé, autosellSettings:", autosellSettings);
      soundToggle.checked = soundEnabled;
      animationsToggle.checked = animationsEnabled;
      themeSelect.value = theme;
      document.getElementById("autosell-rare").checked = autosellSettings.Rare || false;
      document.getElementById("autosell-epic").checked = autosellSettings.Épique || false;
      document.getElementById("autosell-legendary").checked = autosellSettings.Légendaire || false;
      document.getElementById("autosell-mythic").checked = autosellSettings.Mythic || false;
      document.getElementById("autosell-secret").checked = autosellSettings.Secret || false;
      document.body.classList.remove("dark-theme", "light-theme");
      document.body.classList.add(`${theme}-theme`);

      if (tabCurseButton && curseElement) {
        tabCurseButton.classList.toggle("hidden", theme !== "dark");
        if (theme !== "dark") {
            document.body.classList.remove("curse-tab-active-bg"); // Retirer le fond spécial si on passe en thème clair
            if (!curseElement.classList.contains("hidden")) {
              showTab("play");
            }
        } else {
            // Si le thème est sombre ET l'onglet curse est celui qui est actuellement affiché (non hidden)
            // alors s'assurer que le fond spécial est appliqué.
            if (!curseElement.classList.contains("hidden")) {
                document.body.classList.add("curse-tab-active-bg");
            } else {
                // Si le thème est sombre mais l'onglet curse n'est PAS actif, s'assurer que le fond spécial est retiré.
                // Ceci est utile si on change de thème vers sombre alors qu'on n'est pas sur l'onglet curse.
                document.body.classList.remove("curse-tab-active-bg");
            }
        }
      }
      console.log("Paramètres appliqués, checkboxes mises à jour");
    }
   

    function saveSettings() {
      console.log("saveSettings appelé");
      soundEnabled = soundToggle.checked;
      animationsEnabled = animationsToggle.checked;
      theme = themeSelect.value;
      autosellSettings = {
        Rare: document.getElementById("autosell-rare").checked,
        Épique: document.getElementById("autosell-epic").checked,
        Légendaire: document.getElementById("autosell-legendary").checked,
        Mythic: document.getElementById("autosell-mythic").checked,
        Secret: document.getElementById("autosell-secret").checked
      };
      localStorage.setItem("soundEnabled", soundEnabled);
      localStorage.setItem("animationsEnabled", animationsEnabled);
      localStorage.setItem("theme", theme);
      localStorage.setItem("autosellSettings", JSON.stringify(autosellSettings));
      applySettings();
      settingsModal.classList.add("hidden");
      console.log("Paramètres sauvegardés:", { soundEnabled, animationsEnabled, theme, autosellSettings });
    }

    function resetGame() {
        console.log("resetGame appelé");
        resetConfirmModal.classList.remove("hidden");
        // La confirmation se fera via le bouton de la modale
    }

    async function confirmReset() {
        console.log("Réinitialisation de la partie pour l'utilisateur:", currentUser.uid);
        resetConfirmModal.classList.add("hidden");

        // Supprimer la sauvegarde de la base de données
        if (currentUser) {
            await db.collection('playerSaves').doc(currentUser.uid).delete();
        }
        
        // --- NOUVEAU: Réinitialisation complète des paramètres ---
        // 1. Supprimer les clés de paramètres du localStorage
        localStorage.removeItem("soundEnabled");
        localStorage.removeItem("animationsEnabled");
        localStorage.removeItem("theme");
        localStorage.removeItem("autosellSettings");
        localStorage.removeItem("sortCriteria");
        localStorage.removeItem("battleSortCriteria");
        localStorage.removeItem("presetSortCriteria");
        localStorage.removeItem("battleSearchName");
        localStorage.removeItem("battleFilterRarity");
        localStorage.removeItem("presetSearchName");
        localStorage.removeItem("presetFilterRarity");
        localStorage.removeItem("fusionSearchName");
        localStorage.removeItem("fusionFilterRarity");
        localStorage.removeItem("inventoryFilterName");
        localStorage.removeItem("inventoryFilterRarity");
        localStorage.removeItem("inventoryFilterEvolvable");
        localStorage.removeItem("inventoryFilterLimitBreak");
        localStorage.removeItem("inventoryFilterCanReceiveExp");

        // 2. Réassigner les valeurs par défaut aux variables globales des paramètres
        soundEnabled = true;
        animationsEnabled = true;
        theme = "dark";
        autosellSettings = { Rare: false, Épique: false, Légendaire: false, Mythic: false, Secret: false };
        sortCriteria = "power";
        battleSortCriteria = "power";
        presetSortCriteria = "power";
        battleSearchName = "";
        battleFilterRarity = "all";
        presetSearchName = "";
        presetFilterRarity = "all";
        fusionSearchName = "";
        fusionFilterRarity = "all";
        inventoryFilterName = "";
        inventoryFilterRarity = "all";
        inventoryFilterEvolvable = false;
        inventoryFilterLimitBreak = false;
        inventoryFilterCanReceiveExp = false;
        // --- FIN NOUVEAU ---

        // Réinitialiser le reste du jeu à son état initial
        isGameInitialized = false; // Forcer la réinitialisation
        initializeGameData(null);
        
        // --- NOUVEAU: Appliquer les paramètres réinitialisés à l'UI
        applySettings();
        // --- FIN NOUVEAU ---

        disableNoScroll();

        resultElement.innerHTML = '<p class="text-green-400">Partie et paramètres réinitialisés avec succès !</p>';
        setTimeout(() => {
            if (resultElement.innerHTML.includes("Partie et paramètres réinitialisés")) {
                resultElement.innerHTML = `<p class="text-white text-lg">Tire pour obtenir des personnages légendaires !</p>`;
            }
        }, 3000);
    }

    function cancelReset() {
      resetConfirmModal.classList.add("hidden");
    }

    function updateShopOffers() {
      shopOffers = [];
      const availableItems = [...shopItemPool];
      for (let i = 0; i < 3; i++) {
        if (availableItems.length === 0) break;
        const randomIndex = Math.floor(Math.random() * availableItems.length);
        shopOffers.push(availableItems.splice(randomIndex, 1)[0]);
      }
      shopRefreshTime = Date.now() + 2 * 60 * 60 * 1000;
      purchasedOffers = []; // Réinitialiser les offres achetées
      localStorage.setItem("shopOffers", JSON.stringify(shopOffers));
      localStorage.setItem("shopRefreshTime", shopRefreshTime);
      localStorage.setItem("purchasedOffers", JSON.stringify(purchasedOffers));
      updateShopDisplay();
    }

    function updateShopDisplay() {
      shopItemsElement.innerHTML = shopOffers.map((offer, index) => {
        const isPurchased = purchasedOffers.includes(index);
        return `
          <div class="bg-gray-800 bg-opacity-50 p-4 rounded-lg transition transform hover:scale-105">
            <p class="text-white font-semibold">${offer.description}</p>
            <p class="text-white">Coût: ${offer.cost} ${offer.currency}</p>
            <button 
              class="mt-2 bg-blue-500 text-white py-2 px-4 rounded-lg w-full transition transform hover:scale-105 
              ${isPurchased ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-600'}" 
              ${isPurchased ? 'disabled' : `onclick="buyItem(${index})"`}
            >
              ${isPurchased ? 'Acheté' : 'Acheter'}
            </button>
          </div>
        `;
      }).join("");
    }


    function updateMissions() {
      missions.forEach(mission => {
        mission.completed = mission.progress >= mission.goal;
      });
      missionListElement.innerHTML = missions.map(m => {
        const progressPercent = m.goal > 0 ? Math.min((m.progress / m.goal) * 100, 100) : (m.completed ? 100 : 0);
        const isCompleted = m.completed;

        // SVG Icon for the gem
        const gemIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-300" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd" /></svg>`;
        // SVG Icon for the checkmark
        const checkIcon = `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>`;

        return `
          <div class="mission-card ${isCompleted ? 'completed' : ''}">
            ${isCompleted ? `<div class="mission-completed-badge">${checkIcon} Terminé</div>` : ''}
            
            <div>
              <p class="text-white font-semibold text-lg pr-20">${m.description}</p>
              <p class="text-gray-300 text-sm mt-1">${m.progress} / ${m.goal}</p>
            </div>
            
            <div class="progress-bar-bg mt-auto">
              <div class="progress-bar-fill" style="width: ${progressPercent}%;"></div>
            </div>
            
            <div class="mission-reward">
              ${gemIcon}
              <span class="text-white font-bold">${m.reward.gems}</span>
            </div>
          </div>
        `;
      }).join("");
    }

    function updateMissionPool() {
      missions = [];
      const shuffledMissions = missionPool.sort(() => 0.5 - Math.random());
      missions = shuffledMissions.slice(0, 3).map(m => ({
        ...m,
        progress: 0,
        completed: false
      }));
      localStorage.setItem("missions", JSON.stringify(missions));
      updateMissions();
    }

    function updateTimer() {
      const now = Date.now();
      let timeLeft = shopRefreshTime - now;
      if (timeLeft <= 0) {
        shopRefreshTime = now + 2 * 60 * 60 * 1000;
        localStorage.setItem("shopRefreshTime", shopRefreshTime);
        updateShopOffers();
        updateMissionPool();
        timeLeft = shopRefreshTime - now;
      }
      const hours = Math.floor(timeLeft / (1000 * 60 * 60));
      const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
      const timerText = `${hours}h ${minutes}m`;
      shopTimerElement.textContent = timerText;
      missionTimerElement.textContent = timerText;
    }
    setInterval(updateTimer, 1000);

    function updateItemDisplay() {
      const now = Date.now();
      let expBoostStatus = expMultiplier > 1 && now < expBoostEndTime 
        ? `Actif (expire dans ${Math.floor((expBoostEndTime - now) / 1000 / 60)} min)`
        : "Inactif";
      const itemImages = {
        "Haricots": "https://static.wikia.nocookie.net/animeadventures/images/6/6c/Senzu_Bean.png/revision/latest?cb=20230101141509",
        "Fluide mystérieux": "https://static.wikia.nocookie.net/animeadventures/images/7/72/Mysterious_Fluid.png/revision/latest?cb=20230101141428",
        "Wisteria Flower": "https://static.wikia.nocookie.net/animeadventures/images/9/95/Wisteria_Flower.png/revision/latest/scale-to-width-down/115?cb=20230101141611",
        "Ramen Bowl": "https://static.wikia.nocookie.net/animeadventures/images/f/fd/Ramen_Bowl.png/revision/latest/scale-to-width-down/115?cb=20230101142002",
        "Ghoul Coffee": "https://static.wikia.nocookie.net/animeadventures/images/d/d4/Ghoul_Coffee.png/revision/latest/scale-to-width-down/115?cb=20230101141346",
        "Soul Candy": "https://static.wikia.nocookie.net/animeadventures/images/3/3c/Soul_Candy.png/revision/latest/scale-to-width-down/115?cb=20230101141254",
        "Cooked Fish": "https://static.wikia.nocookie.net/animeadventures/images/f/f6/Cooked_Fish.png/revision/latest/scale-to-width-down/115?cb=20230101141820",
        "Magical Artifact": "https://static.wikia.nocookie.net/animeadventures/images/0/05/Magical_Artifact.png/revision/latest/scale-to-width-down/115?cb=20230101142122",
        "Chocolate Bar's": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/e/ea/Chocolate_Bar%27s.png/revision/latest/scale-to-width-down/200?cb=20250507164414",
        "Curse Talisman": "https://static.wikia.nocookie.net/animeadventures/images/e/eb/Curse_Talisman.png/revision/latest/scale-to-width-down/115?cb=20230101141854",
        "Pièces": "https://via.placeholder.com/150?text=Pièces",
        "Pass XP": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/3/35/Pass_XP.png/revision/latest/scale-to-width-down/200?cb=20240912054111",
        "Stat Chip": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/d/d4/Stat_Chip.png/revision/latest/scale-to-width-down/200?cb=20240925095125",
        "Cursed Token": "https://static.wikia.nocookie.net/animeadventures/images/9/9a/Cursed_Finger.png/revision/latest?cb=20250323070916", // Image mise à jour pour Cursed Token
        "Boost EXP x2": "https://via.placeholder.com/150?text=BoostEXP",
        "Shadow Tracer": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/1/11/Shadow_Trace.png/revision/latest/scale-to-width-down/200?cb=20240925095144",
        "Blood-Red Armor": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/4/42/Blood-Red_Armor.png/revision/latest/scale-to-width-down/200?cb=20240925095521",
        "Reroll Token": "https://static.wikia.nocookie.net/animeadventures/images/1/1e/Reroll_Token.png/revision/latest?cb=20230209202447",
        "Divin Wish": "https://static.wikia.nocookie.net/animeadventures/images/1/1d/DivineWish.webp/revision/latest?cb=20250214095329",
        "Hellsing Arms": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/5/56/Hellsing_Arms.png/revision/latest/scale-to-width-down/200?cb=20240925095219",
        "Green Essence": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/7/7d/Green_Essence.png/revision/latest/scale-to-width-down/200?cb=20240925095259",
        "Yellow Essence": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/d/d6/Yellow_Essence.png/revision/latest/scale-to-width-down/200?cb=20240925095305",    
        "Red Essence": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/f/fe/Red_Essence.png/revision/latest/scale-to-width-down/200?cb=20240925095246",
        "Blue Essence": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/2/2a/Blue_Essence.png/revision/latest/scale-to-width-down/200?cb=20240925100144",
        "Pink Essence": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/5/5a/Pink_Essence.png/revision/latest/scale-to-width-down/200?cb=20240925095536",
        "Rainbow Essence": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/c/c1/Rainbow_Essence.png/revision/latest/scale-to-width-down/200?cb=20240925095210",
        "Crystal": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/3/31/Crystal.png/revision/latest/scale-to-width-down/200?cb=20241108234506",
        "Purple Essence": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/f/f2/Purple_Essence.png/revision/latest/scale-to-width-down/200?cb=20240925095542",
        "Magic Pendant": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/5/50/Magic_Pendant.png/revision/latest/scale-to-width-down/200?cb=20241228183321",
        "Head Captain's Coat": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/7/76/Head_Captain%27s_Coat.png/revision/latest/scale-to-width-down/200?cb=20250301094746",
        "Broken Sword": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/b/b7/Broken_Sword.png/revision/latest/scale-to-width-down/200?cb=20240925095613",
        "Chipped Blade": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/d/d3/Chipped_Blade.png/revision/latest/scale-to-width-down/200?cb=20250301095941",
        "Cast Blades": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/e/e4/Cast_Blades.png/revision/latest/scale-to-width-down/200?cb=20241228195617",
        "Hardened Blood": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/2/2a/Hardened_Blood.png/revision/latest/scale-to-width-down/200?cb=20241027175015",
        "Silverite Sword": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/9/9c/Silverite_Sword.png/revision/latest/scale-to-width-down/200?cb=20250129015816",
        "Cursed Finger": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/9/9a/Cursed_Finger.png/revision/latest/scale-to-width-down/200?cb=20241108232910",
        "Magma Stone": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/3/33/Magma_Stone.png/revision/latest/scale-to-width-down/200?cb=20250325084958",
        "Magic Stone": "https://static.wikia.nocookie.net/animeadventures/images/6/63/Magic_Stone.png/revision/latest/scale-to-width-down/115?cb=20230101141650",
        "Broken Pendant": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/d/d0/Broken_Pendant.png/revision/latest/scale-to-width-down/200?cb=20241027174604",
        "Stone Pendant": "https://static.wikia.nocookie.net/animeadventures/images/f/f7/Stone_Pendant.png/revision/latest/scale-to-width-down/115?cb=20230101141922",
        "Demon Beads": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/2/28/Demon_Beads.png/revision/latest/scale-to-width-down/200?cb=20240925095328",
        "Nichirin Cleavers": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/d/d9/Nichirin_Cleavers.png/revision/latest/scale-to-width-down/200?cb=20240925095532",
        "Tavern Piece": "https://static.wikia.nocookie.net/animeadventures/images/c/cc/Tavern_Pie.png/revision/latest?cb=20230606150016",
        "Blue Chakra": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/b/bb/Blue_Chakra.png/revision/latest/scale-to-width-down/200?cb=20240908064022",
        "Red Chakra": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/1/1e/Red_Chakra.png/revision/latest/scale-to-width-down/200?cb=20240908064022",
        "Skin Patch": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/c/c7/Skin_Patch.png/revision/latest/scale-to-width-down/200?cb=20240925095526",
        "Snake Scale": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/d/d5/Snake_Scale.png/revision/latest/scale-to-width-down/200?cb=20240925095139",
        "Senzu Bean": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/6/6c/Senzu_Bean.png/revision/latest/scale-to-width-down/200?cb=20250404123542",
        "Holy Corpse Eyes": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/a/a5/Holy_Corpse_Eyes.png/revision/latest/scale-to-width-down/200?cb=20241228041057",
        "Holy Corpse Arms": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/9/9d/Holy_Corpse_Arms.png/revision/latest/scale-to-width-down/200?cb=20241228042407",
        "Completed Holy Corpse": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/9/91/Completed_Holy_Corpse.png/revision/latest/scale-to-width-down/200?cb=20241228201349",
        "Gorgon's Blindfold": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/1/1f/Gorgon%27s_Blindfold.png/revision/latest/scale-to-width-down/200?cb=20241228195652",
        "Caster's Headpiece": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/4/4f/Caster%27s_Headpiece.png/revision/latest/scale-to-width-down/200?cb=20241228195633",
        "Avalon": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/b/b7/Avalon.png/revision/latest/scale-to-width-down/200?cb=20241228195608",
        "Goddess' Sword": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/a/a5/Goddess%27_Sword.png/revision/latest/scale-to-width-down/200?cb=20241228195642",
        "Blade of Death": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/b/ba/Blade_of_Death.png/revision/latest/scale-to-width-down/200?cb=20241228195625",
        "Berserker's Blade": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/8/87/Berserker%27s_Blade.png/revision/latest/scale-to-width-down/200?cb=20250301095923",
        "Shunpo Spirit": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/9/9b/Shunpo_Spirit.png/revision/latest/scale-to-width-down/200?cb=20250301094718",
        "Energy Arrow": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/c/c4/Energy_Arrow.png/revision/latest/scale-to-width-down/200?cb=20250301084925",
        "Hair Ornament": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/5/5d/Hair_Ornament.png/revision/latest/scale-to-width-down/200?cb=20250301094807",
        "Bucket Hat": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/2/2e/Bucket_Hat.png/revision/latest/scale-to-width-down/200?cb=20250301094814",
        "Horn of Salvation": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/f/f9/Horn_of_Salvation.png/revision/latest/scale-to-width-down/200?cb=20250301094802",
        "Energy Bone": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/2/21/Energy_Bone.png/revision/latest/scale-to-width-down/200?cb=20250301094756",
        "Prison Chair": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/b/b3/Prison_Chair.png/revision/latest/scale-to-width-down/200?cb=20250301084509",
        "Rotara Earring 2": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/1/10/Rotara_Earring_2.png/revision/latest/scale-to-width-down/200?cb=20250508200230",
        "Rotara Earring 1": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/f/f1/Rotara_Earring_1.png/revision/latest/scale-to-width-down/200?cb=20250507164632",
        "Z Blade": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/1/16/Z_Blade.png/revision/latest/scale-to-width-down/200?cb=20250507174034",
        "Champ's Belt": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/f/fb/Champ%27s_Belt.png/revision/latest/scale-to-width-down/200?cb=20250507164406",
        "Dog Bone": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/9/9d/Dog_Bone.png/revision/latest/scale-to-width-down/200?cb=20250507160505",
        "Six Eyes": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/9/91/Six_Eyes.png/revision/latest/scale-to-width-down/200?cb=20241108232222",
        "Tome of Wisdom": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/0/02/Tome_Of_Wisdom.png/revision/latest?cb=20250130224612",
        "Corrupted Visor": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/4/48/Corrupted_Visor.png/revision/latest/scale-to-width-down/200?cb=20250205094632",
        "Tainted Ribbon": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/0/0e/Tainted_Ribbon.png/revision/latest/scale-to-width-down/200?cb=20250301095928",
        "Demon Chalice": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/8/8c/Demon_Chalice.png/revision/latest/scale-to-width-down/200?cb=20250205094729",
        "Essence of the Spirit King": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/4/44/Essence_of_the_Spirit_King.png/revision/latest/scale-to-width-down/200?cb=20250301094735",
        "Ring of Friendship": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/7/75/Ring_of_Friendship.png/revision/latest/scale-to-width-down/200?cb=20250321000834",
        "Red Jewel": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/7/74/Red_Jewel.png/revision/latest/scale-to-width-down/200?cb=20250321000706",
        "Majan Essence": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/6/63/Mojon_Essence.png/revision/latest/scale-to-width-down/200?cb=20250507174026",
        "Donut": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/9/9b/Donut.png/revision/latest/scale-to-width-down/200?cb=20250507160557",
        "Atomic Essence": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/6/6a/Atomic_Essence.png/revision/latest/scale-to-width-down/200?cb=20250507160544",
        "Alien Core": "https://static.wikia.nocookie.net/animeadventures/images/e/e9/Alien_Core.png/revision/latest?cb=20230129102904",
        "Tavern Pie": "https://static.wikia.nocookie.net/animeadventures/images/c/cc/Tavern_Pie.png/revision/latest?cb=20230606150016",
        "Plume Céleste": "https://png.pngtree.com/png-vector/20250517/ourlarge/pngtree-vibrant-and-detailed-feather-on-white-background-png-image_16308203.png",
        "Sablier Ancien": "https://static.wikia.nocookie.net/animeadventures/images/5/5f/Miracle_Timepiece.png/revision/latest?cb=20221119040302",
        "Restricting Headband": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/f/fd/Restricting_Headband.png/revision/latest/scale-to-width-down/200?cb=20250603203745",
        "Toil Ribbon" : "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/b/bb/Tail_Ribbon.png/revision/latest/scale-to-width-down/200?cb=20250603203730",
    };
    
      let itemsHtmlOutput = "";

      if (expMultiplier > 1 && now < expBoostEndTime) {
        itemsHtmlOutput += `
          <div class="bg-gray-700 bg-opacity-40 p-2 rounded-lg border border-gray-600 flex flex-col items-center justify-around text-center h-full min-h-[140px] sm:min-h-[160px]">
            <img src="${itemImages['Boost EXP x2']}" alt="Boost EXP x2" class="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded mb-1">
            <div>
              <p class="text-white font-semibold text-xs sm:text-sm">Boost EXP x2</p>
              <p class="text-white text-xs">${expBoostStatus}</p>
            </div>
          </div>
        `;
      }

      const ownedItemEntries = Object.entries(inventory)
        .filter(([item, quantity]) => {
            if (item === "Pass XP") return pullTickets > 0; // Afficher Pass XP si des tickets sont disponibles
            return quantity > 0; // Pour les autres objets, vérifier la quantité dans l'inventaire
        });

      // Si aucun objet possédé (en tenant compte du Boost EXP et des Pass XP)
      if (ownedItemEntries.length === 0 && !(expMultiplier > 1 && now < expBoostEndTime)) {
        itemDisplay.innerHTML = '<p class="text-white col-span-full text-center">Votre inventaire d\'objets est vide.</p>';
        return;
      }

      ownedItemEntries.forEach(([item, quantity]) => {
        const displayQuantity = item === "Pass XP" ? pullTickets : quantity;
        // S'assurer de ne pas afficher des items avec une quantité de 0 (surtout après la logique Pass XP)
        if (displayQuantity <= 0) return; 

        itemsHtmlOutput += `
          <div class="bg-gray-700 bg-opacity-40 p-2 rounded-lg border border-gray-600 flex flex-col items-center justify-around text-center h-full min-h-[140px] sm:min-h-[160px]">
            <img src="${itemImages[item] || 'https://via.placeholder.com/150?text=Item'}" alt="${item}" class="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded mb-1">
            <div>
              <p class="text-white font-semibold text-xs sm:text-sm">${item}</p>
              <p class="text-white text-xs">Quantité: ${displayQuantity}</p>
            </div>
          </div>
        `;
      });

      // Mettre à jour le DOM une seule fois avec tout le HTML généré
      itemDisplay.innerHTML = itemsHtmlOutput;
      // #item-display est déjà `grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4`
      // Chaque div générée sera un enfant direct et prendra une cellule de cette grille.
    }

    async function _performSave() {
        if (!currentUser || !isGameInitialized) {
            // Ne pas sauvegarder si l'utilisateur n'est pas connecté ou si le jeu n'est pas prêt
            return;
        }
        console.log(`%c[SAVE] Déclenchement de la sauvegarde sur Firestore... (Gemmes: ${gems})`, 'color: #7CFC00');
        
        // Créer un objet contenant toutes les données à sauvegarder
        const saveData = {
            characterIdCounter, gems, coins, pullCount, ownedCharacters, level, exp,
            pullTickets, missions, shopOffers, shopRefreshTime, storyProgress, inventory,
            characterPreset, presetConfirmed, standardPityCount, specialPityCount,
            lastUsedBattleTeamIds, autosellSettings, expMultiplier, expBoostEndTime, discoveredCharacters,
            everOwnedCharacters,
            // Ajoutez toutes les autres variables d'état ici
        };

        try {
            await db.collection('playerSaves').doc(currentUser.uid).set(saveData);
            console.log("%c[SAVE] Progression sauvegardée avec succès !", 'color: #7CFC00');
        } catch (error) {
            console.error("Erreur lors de la sauvegarde de la progression:", error);
        }
    }

    // Nouvelle fonction qui planifie une sauvegarde. C'est celle-ci que nous appellerons partout.
    function scheduleSave() {
        // Annuler toute sauvegarde précédemment planifiée
        if (saveTimeoutId) {
            clearTimeout(saveTimeoutId);
        }
        // Planifier une nouvelle sauvegarde après le délai
        console.log(`[SAVE] Sauvegarde planifiée dans ${SAVE_DELAY_MS / 1000}s...`);
        saveTimeoutId = setTimeout(() => {
            _performSave();
            saveTimeoutId = null; // Réinitialiser l'ID après l'exécution
        }, SAVE_DELAY_MS);
    }

    async function loadProgress(userId) {
        const docRef = db.collection('playerSaves').doc(userId);
        try {
            const doc = await docRef.get();
            if (doc.exists) {
                initializeGameData(doc.data());
            } else {
                // C'est un nouvel utilisateur, il n'a pas de sauvegarde
                initializeGameData(null);
            }
        } catch (error) {
            console.error("Erreur lors du chargement de la progression:", error);
            // En cas d'erreur, on initialise une nouvelle partie pour éviter de bloquer le joueur
            initializeGameData(null);
        }
    }

    function updateUI() {
      gemsElement.textContent = gems;
      coinsElement.textContent = coins;
      pullCountElement.textContent = pullCount;
      levelElement.textContent = level;
      expElement.textContent = exp;
      expNeededElement.textContent = 50 * level * level;

      pullButton.disabled = gems < 100 && pullTickets === 0;
      multiPullButton.disabled = gems < 1000; // CORRECTED: 1000
      specialPullButton.disabled = gems < 150 && pullTickets === 0;
      
      const specialMultiPullButtonElement = document.getElementById("special-multi-pull-button");
      if (specialMultiPullButtonElement) { // ADDED: Disable logic for special multi pull
        specialMultiPullButtonElement.disabled = gems < 1500;
        specialMultiPullButtonElement.classList.toggle("opacity-50", gems < 1500);
        specialMultiPullButtonElement.classList.toggle("cursor-not-allowed", gems < 1500);
      }

      pullButton.classList.toggle("opacity-50", pullButton.disabled);
      pullButton.classList.toggle("cursor-not-allowed", pullButton.disabled);
      
      multiPullButton.classList.toggle("opacity-50", multiPullButton.disabled); // CORRECTED: uses multiPullButton.disabled
      multiPullButton.classList.toggle("cursor-not-allowed", multiPullButton.disabled); // CORRECTED: uses multiPullButton.disabled
      
      specialPullButton.classList.toggle("opacity-50", specialPullButton.disabled);
      specialPullButton.classList.toggle("cursor-not-allowed", specialPullButton.disabled);
      
      deleteButton.textContent = isDeleteMode ? "Confirmer la suppression" : "Activer le mode suppression";
      deleteButton.classList.toggle("bg-red-700", isDeleteMode);
      deleteButton.classList.toggle("bg-red-500", !isDeleteMode);

      const stats = { Rare: 0, Épique: 0, Légendaire: 0, Mythic: 0, Secret: 0 };
      ownedCharacters.forEach(char => stats[char.rarity]++);
      rareCountElement.textContent = stats.Rare;
      epicCountElement.textContent = stats.Épique;
      legendaryCountElement.textContent = stats.Légendaire;
      mythicCountElement.textContent = stats.Mythic;
      secretCountElement.textContent = stats.Secret;
      const standardPityDisplay = document.getElementById("standard-pity-display");
      const specialPityDisplay = document.getElementById("special-pity-display");
      if (standardPityDisplay) standardPityDisplay.textContent = standardPityCount;
      if (specialPityDisplay) specialPityDisplay.textContent = specialPityCount;

      updateShopDisplay(); 
    }

    function getRarityBorderClass(rarity) {
      const borderClasses = {
          Rare: "border-gray-400",
          Épique: "border-purple-400",
          Légendaire: "border-yellow-400",
          Mythic: "rainbow-border",
          Secret: "border-secret",
          Vanguard: "border-vanguard" // NOUVEAU
      };
      return borderClasses[rarity] || "border-gray-400";
    }


    function addExp(amount) {
      exp += Math.floor(amount * expMultiplier);
      missions.forEach(mission => {
        if (mission.type === "exp_gain" && !mission.completed) {
          mission.progress += amount;
        }
      });
      let leveledUp = false;
      while (exp >= 50 * level * level) {
        exp -= 50 * level * level;
        level++;
        leveledUp = true;
        gems = Math.min(gems + 100, 10000000);
        coins = Math.min(coins + 20, 1000000);
        resultElement.innerHTML = `<p class="text-green-400">Niveau ${level} atteint ! +100 gemmes, +20 pièces</p>`;
      }
      if (leveledUp) {
        missions.forEach(mission => {
          if (mission.type === "level_up" && !mission.completed) {
            mission.progress++;
          }
        });
      }
      checkMissions();
      updateUI();
    }

    function getCharacterFromSpecialBanner(characters) {
      const totalChance = characters.reduce((sum, char) => sum + char.chance, 0);
      let random = Math.random() * totalChance;
      for (const char of characters) {
        random -= char.chance;
        if (random <= 0) {
          return char;
        }
      }
      return characters[characters.length - 1]; // Fallback
    }

    function getCharacterFromStandardBanner() {
        const rand = Math.random();
        let cumulativeChance = 0;

        // 1. Déterminer la rareté
        let chosenRarity = null;
        for (const rarity in BANNER_CONFIG) {
            cumulativeChance += BANNER_CONFIG[rarity].overallChance;
            if (rand <= cumulativeChance) {
                chosenRarity = rarity;
                break;
            }
        }
        if (!chosenRarity) chosenRarity = "Rare"; // Fallback

        const rarityConfig = BANNER_CONFIG[chosenRarity];
        const featuredCharacterNames = currentStandardBanner[chosenRarity] || [];
        const allCharsOfThisRarity = standardCharacters.filter(char => char.rarity === chosenRarity);

        // 2. Déterminer si c'est un personnage en vedette ou non
        const isFeaturedPull = Math.random() < rarityConfig.featuredPoolRatio;

        if (isFeaturedPull && featuredCharacterNames.length > 0) {
            // Tirer parmi les personnages en vedette
            if (chosenRarity === "Mythic" && rarityConfig.featuredRelativeWeights && rarityConfig.featuredRelativeWeights.length === featuredCharacterNames.length) {
                // Utiliser les poids relatifs pour les Mythics vedettes
                const mythicRand = Math.random();
                let mythicCumulative = 0;
                for (let i = 0; i < featuredCharacterNames.length; i++) {
                    mythicCumulative += rarityConfig.featuredRelativeWeights[i];
                    if (mythicRand <= mythicCumulative) {
                        const foundChar = allCharsOfThisRarity.find(c => c.name === featuredCharacterNames[i]);
                        return foundChar || allCharsOfThisRarity[0]; // Fallback si non trouvé
                    }
                }
                // Fallback si la somme des poids n'atteint pas 1 ou autre souci
                const foundChar = allCharsOfThisRarity.find(c => c.name === featuredCharacterNames[0]);
                return foundChar || allCharsOfThisRarity[0];
            } else {
                // Répartition égale pour les autres raretés vedettes
                const randomFeaturedIndex = Math.floor(Math.random() * featuredCharacterNames.length);
                const foundChar = allCharsOfThisRarity.find(c => c.name === featuredCharacterNames[randomFeaturedIndex]);
                return foundChar || allCharsOfThisRarity[0];
            }
        } else {
            // Tirer parmi les personnages non-vedette
            const nonFeaturedChars = allCharsOfThisRarity.filter(char => !featuredCharacterNames.includes(char.name));
            if (nonFeaturedChars.length > 0) {
                const randomNonFeaturedIndex = Math.floor(Math.random() * nonFeaturedChars.length);
                return nonFeaturedChars[randomNonFeaturedIndex];
            } else if (allCharsOfThisRarity.length > 0) {
                // Fallback: si tous les persos de la rareté sont en vedette et qu'on tire un "non-vedette"
                // (ou s'il n'y a pas de non-vedette), on tire quand même un de cette rareté.
                const randomIndex = Math.floor(Math.random() * allCharsOfThisRarity.length);
                return allCharsOfThisRarity[randomIndex];
            }
        }
        
        // Ultime fallback: si rien n'est trouvé (ne devrait pas arriver)
        return standardCharacters.find(c => c.rarity === "Rare") || standardCharacters[0];
    }


    async function animatePull(characters, additionalMessage = '') {
      resultElement.innerHTML = `<p class="text-white">Tirage en cours...</p>`;
      if (animationsEnabled) {
        resultElement.classList.add("animate-pulse");
      }
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Ne pas afficher les personnages, juste nettoyer l'animation
      if (animationsEnabled) {
        resultElement.classList.remove("animate-pulse");
      }

      // Afficher le message de coût (par exemple, "100 gemmes dépensées")
      resultElement.innerHTML = `<p class="text-green-400">${additionalMessage}</p>`;
      
      // Attendre un court instant pour montrer le message de coût
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Revenir au message initial
      resultElement.innerHTML = `<p class="text-white text-lg">Tire pour obtenir des personnages légendaires !</p>`;
    }

    async function pullCharacter() {
        console.log("pullCharacter (standard banner) appelé");
        currentPullType = "standard"; 
        const standardPullCost = 100; // Coût fixe pour un tirage standard x1

        if (pullTickets > 0) {
            openPullMethodModal(currentPullType); // openPullMethodModal vérifiera les gemmes si l'option gemmes est choisie
        } else {
            // Si pas de ticket, tenter directement avec des gemmes
            if (gems < standardPullCost) {
                 resultElement.innerHTML = '<p class="text-red-400">Pas assez de gemmes (100 requis) !</p>';
                 return;
            }

            executePull(false); 
        }
    }

    async function multiPull() {
      console.log("multiPull (standard banner) appelé, gemmes:", gems, "autosellSettings:", autosellSettings);
      const cost = 1000;
      const expectedPulls = 10;
      const expGainForMulti = 100;

      if (gems < cost) {
        resultElement.innerHTML = `<p class="text-red-400">Pas assez de gemmes (${cost} requis) !</p>`;
        console.log("Échec du tirage multiple: pas assez de gemmes. Gemmes actuelles:", gems, "Coût:", cost);
        return;
      }

      gems -= cost;

      missions.forEach(mission => {
          if (mission.type === "spend_gems" && !mission.completed) {
              mission.progress += cost; // Remplacez 'cost' par 'gemCost' dans la fonction executePull
          }
      });

      pullCount += expectedPulls;
      const pulledCharsForDisplay = []; // Pour l'animation
      let autoSoldCharactersInfo = [];
      let hasPulledEpicOrBetter = false; // Pour la garantie d'un Épique minimum

      let pityMessagePart = ""; // Pour stocker le message de Pity

      for (let i = 0; i < expectedPulls; i++) {
        let char = getCharacterFromStandardBanner(); 

        // Logique de garantie d'un Épique ou mieux pour le dernier tirage du multi
        if (i === (expectedPulls - 1) && !hasPulledEpicOrBetter) {
          let attempts = 0;
          while (rarityOrder[char.rarity] < rarityOrder["Épique"] && attempts < 20) {
            char = getCharacterFromStandardBanner();
            attempts++;
          }
        }
        if (rarityOrder[char.rarity] >= rarityOrder["Épique"]) {
          hasPulledEpicOrBetter = true;
        }

        if (char.rarity === "Mythic") {
            missions.forEach(mission => {
                if (mission.type === "mythic_chars" && !mission.completed) {
                    mission.progress++;
                }
            });
        }

        // --- DÉBUT LOGIQUE PITY pour multiPull Standard ---
        standardPityCount++;
        let pulledCharIsMythicOrBetterThisIteration = (rarityOrder[char.rarity] >= rarityOrder.Mythic);

        if (standardPityCount >= STANDARD_MYTHIC_PITY_THRESHOLD && !pulledCharIsMythicOrBetterThisIteration) {
            let mythicsInStandard = standardCharacters.filter(c => c.rarity === "Mythic");
            if (mythicsInStandard.length > 0) {
                char = mythicsInStandard[Math.floor(Math.random() * mythicsInStandard.length)];
                pityMessagePart += ` Pity (tirage ${i+1})! ${char.name} (Mythic) garanti.`; // Ajouter au message global du multi
                pulledCharIsMythicOrBetterThisIteration = true;
                console.log(`Pity (multi standard) tirage ${i+1}: ${char.name} (Mythic) garanti.`);
            } else {
                console.error("PITY ERROR (multi standard): Aucun Mythic à forcer.");
            }
        }

        if (pulledCharIsMythicOrBetterThisIteration) {
            standardPityCount = 0; // Réinitialiser si un Mythic ou mieux est obtenu (naturellement ou par pity)
        }
        // --- FIN LOGIQUE PITY pour multiPull Standard ---
        // `char` est maintenant soit l'original, soit celui du pity.

        const newStatRank = getRandomStatRank(true); 
        const characterWithId = {
            ...char, 
            id: `char_${characterIdCounter++}`,
            level: 1,
            exp: 0,
            locked: false,
            hasEvolved: false,
            curseEffect: 0,
            basePower: char.power, 
            statRank: newStatRank,
            statModifier: statRanks[newStatRank].modifier,
            trait: { id: null, grade: 0 } 
        };
        recalculateCharacterPower(characterWithId); 

        if (!discoveredCharacters.includes(char.name)) {
          discoveredCharacters.push(char.name);
        }

        if (autosellSettings[char.rarity] === true) {
          const rewards = autoSellCharacter(characterWithId);
          autoSoldCharactersInfo.push({ name: char.name, rarity: char.rarity, gems: rewards.gems, coins: rewards.coins });
        } else {
          pulledCharsForDisplay.push(characterWithId); // Pour l'animation
          ownedCharacters.unshift(characterWithId);
          if (!everOwnedCharacters.includes(char.name)) {
            everOwnedCharacters.push(char.name);
          }
        }

        missions.forEach(mission => {
          if (!mission.completed) {
            if (mission.type === "pulls") mission.progress++;
            if (mission.type === "epic_chars" && char.rarity === "Épique") mission.progress++;
            if (mission.type === "legendary_chars" && char.rarity === "Légendaire") mission.progress++;
          }
        });
      } // Fin de la boucle for

      checkMissions();
      let message = `${cost} gemmes dépensées.`;
      if (pityMessagePart) { // Ajouter le message de Pity s'il y en a eu un
          message += pityMessagePart;
      }
      if (autoSoldCharactersInfo.length > 0) {
        const totalAutoSellGems = autoSoldCharactersInfo.reduce((sum, charInfo) => sum + charInfo.gems, 0);
        const totalAutoSellCoins = autoSoldCharactersInfo.reduce((sum, charInfo) => sum + charInfo.coins, 0);
        message += ` ${autoSoldCharactersInfo.length} personnage(s) auto-vendu(s) pour +${totalAutoSellGems} gemmes, +${totalAutoSellCoins} pièces.`;
      }

      await animatePull(pulledCharsForDisplay, message); // Utilise pulledCharsForDisplay pour l'animation
      if (pulledCharsForDisplay.some(c => (c.rarity === "Mythic" || c.rarity === "Secret" || c.rarity === "Vanguard")) && animationsEnabled) {
        confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
      }

      addExp(expGainForMulti);
      updateCharacterDisplay();
      updateIndexDisplay();
      updateUI(); // Mettra à jour l'affichage du Pity
      localStorage.setItem("characterIdCounter", characterIdCounter);
      scheduleSave();
      console.log("multiPull (standard banner) terminé, ownedCharacters:", ownedCharacters.length);
    }

    function specialPull() {
      console.log("specialPull appelé");
      currentPullType = "special";
        if (pullTickets > 0) {
            // Afficher la modale si au moins un ticket est disponible
            pullMethodModal.classList.remove("hidden");
            document.body.classList.add("no-scroll");
        } else {
            // Effectuer un tirage avec des gemmes si aucun ticket n'est disponible
            executePull(false);
        }
    }

    async function executePull(useTicket) {
        console.log("executePull appelé, useTicket:", useTicket, "currentPullType:", currentPullType);
        let message = "";
        let autoSold = false;
        let autoSellRewards = { gems: 0, coins: 0 };
        
        let selectedCharacter;
        let gemCost;
        let expGain;

        // --- DÉBUT LOGIQUE PITY PARTIE 1 : Détermination coût & type ---
        if (currentPullType === "standard") {
            selectedCharacter = getCharacterFromStandardBanner();
            if (selectedCharacter.rarity === "Mythic") {
                missions.forEach(mission => {
                    if (mission.type === "mythic_chars" && !mission.completed) {
                        mission.progress++;
                    }
                });
            }
            gemCost = 100; 
            expGain = 10;
        } else if (currentPullType === "special") {
            selectedCharacter = getCharacterFromSpecialBanner(specialCharacters); 
            gemCost = 150; 
            expGain = 15;
        } else {
            console.error("Type de tirage inconnu:", currentPullType);
            return;
        }
        // --- FIN LOGIQUE PITY PARTIE 1 ---

        if (useTicket) {
            if (pullTickets <= 0) {
                resultElement.innerHTML = '<p class="text-red-400">Pas de tickets disponibles !</p>';
                return;
            }
            pullTickets--;
            inventory["Pass XP"] = Math.max(0, (inventory["Pass XP"] || 0) - 1); 
            message = "Pass utilisé !";
        } else {
            if (gems < gemCost) {
                resultElement.innerHTML = `<p class="text-red-400">Pas assez de gemmes (${gemCost} requis) !</p>`;
                return;
            }
            gems -= gemCost;

            missions.forEach(mission => {
                if (mission.type === "spend_gems" && !mission.completed) {
                    mission.progress += cost; // Remplacez 'cost' par 'gemCost' dans la fonction executePull
                }
            });

            message = `${gemCost} gemmes dépensées.`;
        }

        pullCount++;

        // --- DÉBUT LOGIQUE PITY PARTIE 2 : Vérification et Forçage Pity ---
        let characterPulledIsPityTargetOrBetter = false; // Pour le reset du pity

        if (currentPullType === "standard") {
            standardPityCount++;
            if (rarityOrder[selectedCharacter.rarity] >= rarityOrder.Mythic) { // Mythic ou mieux
                characterPulledIsPityTargetOrBetter = true;
            }

            if (standardPityCount >= STANDARD_MYTHIC_PITY_THRESHOLD && !characterPulledIsPityTargetOrBetter) {
                let mythicsInStandard = standardCharacters.filter(c => c.rarity === "Mythic");
                if (mythicsInStandard.length > 0) {
                    selectedCharacter = mythicsInStandard[Math.floor(Math.random() * mythicsInStandard.length)];
                    message += ` Pity atteint! ${selectedCharacter.name} (Mythic) garanti.`;
                    characterPulledIsPityTargetOrBetter = true; 
                    console.log("Pity Standard (x1) déclenché. Personnage:", selectedCharacter.name);
                } else {
                    console.error("PITY ERROR (standard x1): Aucun Mythic à forcer.");
                }
            }
            if (characterPulledIsPityTargetOrBetter) {
                standardPityCount = 0;
            }
        } else if (currentPullType === "special") {
            specialPityCount++;
            // Vérifie si le personnage tiré naturellement est un "Secret" ou "Vanguard"
            const isSpecialBannerTargetNaturally = specialCharacters.some(sc => sc.name === selectedCharacter.name && (sc.rarity === "Secret" || sc.rarity === "Vanguard"));
            if (isSpecialBannerTargetNaturally) {
                characterPulledIsPityTargetOrBetter = true;
            }

            if (specialPityCount >= SPECIAL_BANNER_PITY_THRESHOLD && !characterPulledIsPityTargetOrBetter) {
                let secretCharsInSpecial = specialCharacters.filter(c => c.rarity === "Secret");
                if (secretCharsInSpecial.length > 0) {
                    selectedCharacter = secretCharsInSpecial[Math.floor(Math.random() * secretCharsInSpecial.length)];
                    message += ` Pity atteint! ${selectedCharacter.name} (Secret) garanti.`;
                    characterPulledIsPityTargetOrBetter = true; // Un Secret est une cible de pity
                    console.log("Pity Spécial (x1) déclenché. Personnage Secret:", selectedCharacter.name);
                } else {
                    // Fallback si aucun Secret n'est défini dans specialCharacters
                    console.warn("PITY WARNING (spécial x1): Aucun personnage 'Secret' trouvé dans la bannière spéciale pour la pity. Tirage normal appliqué.");
                    selectedCharacter = getCharacterFromSpecialBanner(specialCharacters); // Comportement original
                    message += ` Pity atteint! ${selectedCharacter.name} (${selectedCharacter.rarity}) garanti (fallback).`;
                    // Vérifier si le fallback est quand même une cible (Secret ou Vanguard)
                    if (selectedCharacter.rarity === "Secret" || selectedCharacter.rarity === "Vanguard") {
                        characterPulledIsPityTargetOrBetter = true;
                    }
                }
            }
            if (characterPulledIsPityTargetOrBetter) {
                specialPityCount = 0;
            }
        }
        // --- FIN LOGIQUE PITY PARTIE 2 ---
        
        const newStatRank = getRandomStatRank(true); 
        const characterWithId = {
            ...selectedCharacter, 
            id: `char_${characterIdCounter++}`,
            level: 1,
            exp: 0,
            locked: false,
            hasEvolved: false,
            curseEffect: 0,
            basePower: selectedCharacter.power, 
            statRank: newStatRank,
            statModifier: statRanks[newStatRank].modifier,
            trait: { id: null, grade: 0 } 
        };
        recalculateCharacterPower(characterWithId);

        if (!discoveredCharacters.includes(selectedCharacter.name)) {
            discoveredCharacters.push(selectedCharacter.name);
        }

        if (autosellSettings[selectedCharacter.rarity] === true) {
            autoSellRewards = autoSellCharacter(characterWithId);
            autoSold = true;
            message += ` ${selectedCharacter.name} auto-vendu pour +${autoSellRewards.gems} gemmes, +${autoSellRewards.coins} pièces.`;
        } else {
            ownedCharacters.unshift(characterWithId);
            if (!everOwnedCharacters.includes(selectedCharacter.name)) {
                everOwnedCharacters.push(selectedCharacter.name);
            }
        }

        missions.forEach(mission => {
            if (!mission.completed) {
                if (currentPullType === "standard" && mission.type === "pulls") mission.progress++;
                if (currentPullType === "special" && mission.type === "special_pulls") mission.progress++;
                if (mission.type === "epic_chars" && selectedCharacter.rarity === "Épique") mission.progress++;
                if (mission.type === "legendary_chars" && selectedCharacter.rarity === "Légendaire") mission.progress++;
                if (currentPullType === "special" && mission.type === "special_chars") mission.progress++;
            }
        });

        await animatePull(autoSold ? [] : [characterWithId], message);
        if (!autoSold && animationsEnabled && (characterWithId.rarity === "Mythic" || characterWithId.rarity === "Secret" || characterWithId.rarity === "Vanguard")) {
            confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
        }

        addExp(expGain);
        checkMissions();
        updateCharacterDisplay();
        updateIndexDisplay();
        updateItemDisplay();
        updateUI();
        localStorage.setItem("characterIdCounter", characterIdCounter);
        scheduleSave();
        console.log("executePull (x1) terminé, ownedCharacters:", ownedCharacters.length);
    }

    async function specialMultiPull() {
      console.log("specialMultiPull appelé, gemmes:", gems, "autosellSettings:", autosellSettings);
      const cost = 1500;
      const expectedPulls = 10;
      const expGain = 150;

      if (gems < cost) {
        resultElement.innerHTML = '<p class="text-red-400">Pas assez de gemmes (' + cost + ' requis) ! Vous avez ' + gems + '.</p>';
        console.log("Échec du tirage spécial multiple: pas assez de gemmes. Gemmes actuelles:", gems, "Coût:", cost);
        return;
      }

      gems -= cost;

      missions.forEach(mission => {
          if (mission.type === "spend_gems" && !mission.completed) {
              mission.progress += cost; // Remplacez 'cost' par 'gemCost' dans la fonction executePull
          }
      });

      pullCount += expectedPulls;
      const results = []; 
      let autoSoldCharacters = []; 
      let totalAutoSellGems = 0;
      let totalAutoSellCoins = 0;
      let pityMessagePart = ""; 

      for (let i = 0; i < expectedPulls; i++) {
        let char = getCharacterFromSpecialBanner(specialCharacters); 

        // --- DÉBUT LOGIQUE PITY pour specialMultiPull ---
        specialPityCount++;
        // Vérifie si le personnage tiré naturellement est un "Secret" ou "Vanguard"
        let isSpecialBannerTargetPulledThisIteration = specialCharacters.some(sc => sc.name === char.name && (sc.rarity === "Secret" || sc.rarity === "Vanguard"));

        if (specialPityCount >= SPECIAL_BANNER_PITY_THRESHOLD && !isSpecialBannerTargetPulledThisIteration) {
            let secretCharsInSpecial = specialCharacters.filter(c => c.rarity === "Secret");
            if (secretCharsInSpecial.length > 0) {
                char = secretCharsInSpecial[Math.floor(Math.random() * secretCharsInSpecial.length)];
                pityMessagePart += ` Pity (tirage ${i+1})! ${char.name} (Secret) garanti.`;
                isSpecialBannerTargetPulledThisIteration = true; // Un Secret est une cible
                console.log(`Pity (multi spécial) tirage ${i+1}: ${char.name} (Secret) garanti.`);
            } else {
                // Fallback si aucun Secret n'est défini dans specialCharacters
                console.warn(`PITY WARNING (multi spécial tirage ${i+1}): Aucun personnage 'Secret' trouvé dans la bannière spéciale pour la pity. Tirage normal appliqué.`);
                char = getCharacterFromSpecialBanner(specialCharacters); // Comportement original
                pityMessagePart += ` Pity (tirage ${i+1})! ${char.name} (${char.rarity}) garanti (fallback).`;
                // Vérifier si le fallback est quand même une cible (Secret ou Vanguard)
                if (char.rarity === "Secret" || char.rarity === "Vanguard") {
                     isSpecialBannerTargetPulledThisIteration = true;
                }
            }
        }

        if (isSpecialBannerTargetPulledThisIteration) {
            specialPityCount = 0; 
        }
        // --- FIN LOGIQUE PITY pour specialMultiPull ---
        
        const newStatRank = getRandomStatRank(true);
        const characterWithId = {
            ...char, 
            id: `char_${characterIdCounter++}`,
            level: 1,
            exp: 0,
            locked: false,
            hasEvolved: false,
            curseEffect: 0,
            basePower: char.power,
            statRank: newStatRank,
            statModifier: statRanks[newStatRank].modifier,
            trait: { id: null, grade: 0 }
        };
        recalculateCharacterPower(characterWithId);

        if (!discoveredCharacters.includes(char.name)) {
          discoveredCharacters.push(char.name);
        }

        if (autosellSettings[char.rarity] === true) {
          const rewards = autoSellCharacter(characterWithId);
          autoSoldCharacters.push({ ...char, gems: rewards.gems, coins: rewards.coins }); 
          totalAutoSellGems += rewards.gems;
          totalAutoSellCoins += rewards.coins;
        } else {
          results.push(characterWithId); 
          ownedCharacters.unshift(characterWithId);
          if (!everOwnedCharacters.includes(char.name)) {
            everOwnedCharacters.push(char.name);
          }
        }

        missions.forEach(mission => {
          if (!mission.completed) {
            if (mission.type === "special_pulls") mission.progress++;
            if (mission.type === "epic_chars" && char.rarity === "Épique") mission.progress++;
            if (mission.type === "legendary_chars" && char.rarity === "Légendaire") mission.progress++;
            if (mission.type === "special_chars") mission.progress++;
          }
        });
      } // Fin de la boucle for

      checkMissions();

      let message = `${cost} gemmes dépensées.`;
      if (pityMessagePart) { 
          message += pityMessagePart;
      }
      if (autoSoldCharacters.length > 0) {
        message += ` ${autoSoldCharacters.length} personnage(s) auto-vendu(s) pour +${totalAutoSellGems} gemmes, +${totalAutoSellCoins} pièces.`;
      }
      await animatePull(results, message);

      if (results.some(c => (c.rarity === "Mythic" || c.rarity === "Secret" || c.rarity === "Vanguard")) && animationsEnabled) {
        confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
      }

      addExp(expGain);
      updateCharacterDisplay();
      updateIndexDisplay();
      updateUI(); 
      localStorage.setItem("characterIdCounter", characterIdCounter);
      scheduleSave();
      console.log("specialMultiPull terminé, ownedCharacters:", ownedCharacters.length);
    }

    function awardLevelRewards(level) {
        const isLevelCompleted = level.completed; // Vérifie si le niveau est déjà complété
        const rewardMultiplier = isLevelCompleted ? 0.5 : 1; // Réduction à 50 % si déjà complété

        // Appliquer les récompenses avec le multiplicateur
        const gemsReward = Math.floor(level.rewards.gems * rewardMultiplier);
        const coinsReward = level.rewards.coins; // Pas de réduction pour les pièces (optionnel, ajustez si nécessaire)
        const expReward = Math.floor(level.rewards.exp * rewardMultiplier);

        gems += gemsReward;
        coins += coinsReward;
        addExp(expReward);

        // Afficher le résultat avec une indication si réduit
        resultElement.innerHTML = `<p class="text-green-400">Niveau ${level.name} terminé !</p>
            <p class="text-white">+${gemsReward} gemmes${isLevelCompleted ? ' (réduit)' : ''}, +${coinsReward} pièces, +${expReward} EXP${isLevelCompleted ? ' (réduit)' : ''}</p>`;

        // Mettre à jour l'interface
        updateUI();
        scheduleSave();
        }

        // Exemple d'appel dans une fonction de complétion de niveau (à adapter selon votre code)
        function completeLevel(levelId) {
        const level = baseStoryLevels.find(l => l.id === levelId);
        if (level && !level.completed) {
            level.completed = true;
        }
        awardLevelRewards(level);
    }

    function showCharacterStats(id) {
        const char = ownedCharacters.find(c => c.id === id);
        if (!char) return;
        const baseChar = allCharacters.find(c => c.name === char.name);

        const currentCharacterMaxLevel = char.maxLevelCap || 60; // Utiliser maxLevelCap
        const isAtCurrentMaxLevel = char.level >= currentCharacterMaxLevel;
        const expNeeded = isAtCurrentMaxLevel ? 0 : getExpNeededForCharacterLevel(char.level, char.rarity);
        const expPercentage = isAtCurrentMaxLevel ? 100 : Math.min((char.exp / expNeeded) * 100, 100).toFixed(2);

        let curseInfoHtml = '';
        if (char.curseEffect && char.curseEffect !== 0) {
            const referencePowerForPercentage = (char.basePower * char.statModifier);
            let percentageChange = 0;
            if (referencePowerForPercentage !== 0) {
                percentageChange = ((char.curseEffect / referencePowerForPercentage) * 100); // Correction: curseEffect au lieu de char.curseEffect()
            } else if (char.basePower !== 0) {
                percentageChange = ((char.curseEffect / char.basePower) * 100);
            }
            const displayPercentage = percentageChange.toFixed(percentageChange % 1 === 0 ? 0 : (Math.abs(percentageChange) < 1 ? 2 : 1));
            const curseClass = char.curseEffect > 0 ? 'text-green-400' : 'text-red-400';
            const sign = char.curseEffect > 0 ? '+' : '';
            curseInfoHtml = `<p><strong>Malédiction:</strong> <span class="${curseClass}">${sign}${displayPercentage}%</span></p>`;
        }

        let traitInfoHtml = '<p><strong>Trait:</strong> Aucun</p>';
        if (char.trait && char.trait.id && char.trait.grade > 0) {
            const traitDef = TRAIT_DEFINITIONS[char.trait.id];
            if (traitDef && traitDef.grades) {
                const gradeDef = traitDef.grades.find(g => g.grade === char.trait.grade);
                if (gradeDef) {
                    let traitNameDisplay = traitDef.name;
                    if (traitDef.gradeProbabilities && traitDef.gradeProbabilities.length > 0) {
                        traitNameDisplay += ` (Grade ${gradeDef.grade})`;
                    }

                    let nameStyle = ""; // Sera utilisé pour le nom du trait
                    let descriptionClass = "text-xs text-gray-300"; // Classe par défaut pour la description
                    
                    // Spécifiquement pour "Golder" et sa description
                    if (traitDef.id === "golder" && gradeDef.description === "+15% Gemmes & Pièces (Tous modes)") {
                        nameStyle = 'class="text-gold-brilliant"'; // Utilisation de la classe pour le nom
                        descriptionClass = "text-xs text-gold-brilliant"; // Et pour la description
                        // text-shadow est déjà dans la classe .text-gold-brilliant
                        traitInfoHtml = `
                            <p><strong>Trait:</strong> <span ${nameStyle}>${traitNameDisplay}</span></p>
                            ${gradeDef.description ? `<p class="${descriptionClass}"><em>Effet: ${gradeDef.description}</em></p>` : ''}
                        `;
                    } else {
                        traitInfoHtml = `
                            <p><strong>Trait:</strong> ${traitNameDisplay}</p>
                            ${gradeDef.description ? `<p class="${descriptionClass}"><em>Effet: ${gradeDef.description}</em></p>` : ''}
                        `;
                    }
                }
            }
        }

        modalContent.innerHTML = `
            <p><strong>Nom:</strong> ${char.name}</p>
            <p><strong>Rareté:</strong> <span class="${char.rarity === 'Mythic' ? 'rainbow-text' : (char.rarity === 'Secret' ? 'text-secret' : (char.rarity === 'Vanguard' ? 'text-vanguard' : char.color))}">${char.rarity}</span> ${char.locked ? '🔒' : ''}</p>
            <p><strong>Niveau:</strong> ${char.level}${isAtCurrentMaxLevel ? ` (Max Actuel: ${currentCharacterMaxLevel})` : ` / ${currentCharacterMaxLevel}`}</p>
            <p><strong>Puissance:</strong> ${char.power}</p>
            <p><strong><span class='${statRanks[char.statRank]?.color || "text-white"}'>Rang Stat:</span></strong> ${char.statRank}</p>
            ${curseInfoHtml}
            ${traitInfoHtml}
            <p class="mt-2"><strong>EXP:</strong> ${isAtCurrentMaxLevel ? 'Max' : `${char.exp}/${expNeeded}`}</p>
            <div class="w-full bg-gray-700 rounded h-4 mt-2">
                <div class="bg-green-500 h-full rounded transition-all duration-300" style="width: ${expPercentage}%"></div>
            </div>
        `;

        statsModal.classList.remove("hidden");
        enableNoScroll(); 

        fuseButton.disabled = isAtCurrentMaxLevel || isDeleteMode || ownedCharacters.length <= 1 || char.locked;
        fuseButton.classList.toggle("opacity-50", fuseButton.disabled);
        fuseButton.classList.toggle("cursor-not-allowed", fuseButton.disabled);
        fuseButton.onclick = () => startFusion(id);

        const hasPowerItem = Object.entries(inventory).some(([item, quantity]) => quantity > 0 && itemEffects[item]?.power);
        giveItemsButton.disabled = isDeleteMode || (isAtCurrentMaxLevel && !hasPowerItem); 
        giveItemsButton.classList.toggle("opacity-50", giveItemsButton.disabled);
        giveItemsButton.classList.toggle("cursor-not-allowed", giveItemsButton.disabled);
        giveItemsButton.onclick = () => startGiveItems(id);

        const lockButton = document.getElementById("lock-button");
        lockButton.textContent = char.locked ? "Déverrouiller" : "Verrouiller";
        lockButton.disabled = isDeleteMode;
        lockButton.classList.toggle("opacity-50", lockButton.disabled);
        lockButton.classList.toggle("cursor-not-allowed", lockButton.disabled);
        lockButton.classList.toggle("bg-red-500", char.locked); 
        lockButton.classList.toggle("hover:bg-red-600", char.locked);
        lockButton.classList.toggle("bg-gray-500", !char.locked);
        lockButton.classList.toggle("hover:bg-gray-600", !char.locked);
        lockButton.onclick = () => toggleLockCharacter(id); 

        const existingEvolveButton = document.getElementById("evolve-button");
        if (existingEvolveButton) existingEvolveButton.remove(); 

        if (baseChar.evolutionRequirements && baseChar.evolutionRequirements.length > 0 && !char.hasEvolved) { 
            const evolveButton = document.createElement("button");
            evolveButton.id = "evolve-button";
            evolveButton.className = "bg-pink-500 hover:bg-pink-600 text-white py-2 px-4 rounded-lg text-sm sm:text-base";
            evolveButton.textContent = "Évoluer";
            evolveButton.disabled = isDeleteMode || char.locked; 
            evolveButton.classList.toggle("opacity-50", evolveButton.disabled);
            evolveButton.classList.toggle("cursor-not-allowed", evolveButton.disabled);
            evolveButton.onclick = () => startEvolution(id);
            if(fuseButton.parentNode) {
                fuseButton.parentNode.appendChild(evolveButton);
            }
        }
    }
            
    function deleteCharacter(id) {
      const char = ownedCharacters.find(c => c.id === id); // Trouver le personnage
      if (!char) return; // Sécurité

      if (isDeleteMode && !char.locked) {
        if (selectedCharacterIndices.has(id)) {
          selectedCharacterIndices.delete(id);
        } else {
          selectedCharacterIndices.add(id);
        }
        updateCharacterDisplay();
        updateUI();
      } else if (isDeleteMode && char.locked) {
        console.log("Personnage verrouillé, ne peut pas être sélectionné pour suppression.");
        resultElement.innerHTML = `<p class="text-yellow-400">Ce personnage est verrouillé et ne peut pas être supprimé.</p>`;
        setTimeout(() => { resultElement.innerHTML = `<p class="text-white text-lg">Tire pour obtenir des personnages légendaires !</p>`; }, 3000);
      }
    }

    function closeModal() {
      statsModal.classList.add("hidden");
      disableNoScroll(); // <--- AJOUTER CETTE LIGNE
    }

    function toggleDeleteMode() {
      isDeleteMode = !isDeleteMode;
      if (!isDeleteMode) {
        deleteSelectedCharacters();
      }
      selectedCharacterIndices.clear();
      updateCharacterDisplay();
      updateUI();
    }

    function selectCharacter(id) {
      if (isDeleteMode) {
        if (selectedCharacterIndices.has(id)) {
          selectedCharacterIndices.delete(id);
        } else {
          selectedCharacterIndices.add(id);
        }
        updateCharacterDisplay();
        updateUI();
      } else {
        showCharacterStats(id);
      }
    }

    function deleteSelectedCharacters() {
      if (selectedCharacterIndices.size > 0) {
        let totalGemsGained = 0; // Renommé pour clarté
        let totalCoinsGained = 0; // Renommé pour clarté
        const idsToDelete = Array.from(selectedCharacterIndices);
        let actualDeletedCount = 0;

        idsToDelete.forEach(id => {
          const index = ownedCharacters.findIndex(c => c.id === id);
          if (index === -1) return;

          const char = ownedCharacters[index];
          
          if (char.locked) {
            console.log(`Tentative de suppression du personnage verrouillé ${char.name} ignorée.`);
            return; 
          }

          let gemValue = 0;
          let coinValue = 0;

          switch (char.rarity) {
            case "Rare":
              gemValue = 10;
              coinValue = 5;
              break;
            case "Épique":
              gemValue = 50;
              coinValue = 15;
              break;
            case "Légendaire":
              gemValue = 100;
              coinValue = 30;
              break;
            case "Mythic":
              gemValue = 500;
              coinValue = 100;
              break;
            case "Secret": // Assumant que Secret donne aussi des ressources
              gemValue = 1000;
              coinValue = 200;
              break;
            default:
              gemValue = 1; // Fallback minimal
              coinValue = 1;
          }
          
          totalGemsGained += gemValue;
          totalCoinsGained += coinValue; // << CORRECTION ICI: Utiliser totalCoinsGained

          missions.forEach(mission => {
            if (!mission.completed) {
              if (mission.type === "sell_chars") mission.progress++;
              if (mission.type === "sell_rare_chars" && char.rarity === "Rare") mission.progress++;
            }
          });
          actualDeletedCount++;
        });

        // Filtrer ownedCharacters pour retirer ceux qui sont sélectionnés ET non verrouillés
        ownedCharacters = ownedCharacters.filter(char => {
            return !selectedCharacterIndices.has(char.id) || (selectedCharacterIndices.has(char.id) && char.locked);
        });

        if (actualDeletedCount > 0) {
            addGems(totalGemsGained); // Utilise la fonction addGems
            coins = Math.min(coins + totalCoinsGained, 10000000); // << CORRECTION ICI: Ajouter totalCoinsGained
            resultElement.innerHTML = `<p class="text-green-400">${actualDeletedCount} personnage(s) non verrouillé(s) supprimé(s) ! +${totalGemsGained} gemmes, +${totalCoinsGained} pièces</p>`;
        } else {
            resultElement.innerHTML = `<p class="text-yellow-400">Aucun personnage non verrouillé n'a été sélectionné pour la suppression.</p>`;
        }
        
        selectedCharacterIndices.clear();
        checkMissions();
        updateCharacterDisplay();
        updateIndexDisplay();
        updateUI();
        scheduleSave(); // Sauvegarder après modification de coins
      }
    }

    function buyItem(index) {
      const offer = shopOffers[index];
      if (!offer) return;

      if (purchasedOffers.includes(index)) {
        resultElement.innerHTML = '<p class="text-red-400">Cette offre a déjà été achetée !</p>';
        return;
      }

      if (offer.currency === 'gems' && gems < offer.cost) {
        resultElement.innerHTML = '<p class="text-red-400">Pas assez de gemmes !</p>';
        return;
      }
      if (offer.currency === 'coins' && coins < offer.cost) {
        resultElement.innerHTML = '<p class="text-red-400">Pas assez de pièces !</p>';
        return;
      }

      if (offer.currency === 'gems') {
        gems -= offer.cost;
      } else if (offer.currency === 'coins') {
        coins -= offer.cost;
        missions.forEach(mission => {
            if (mission.type === "spend_coins" && !mission.completed) {
                mission.progress += offer.cost;
            }
        });
      }

      purchasedOffers.push(index);
      localStorage.setItem("purchasedOffers", JSON.stringify(purchasedOffers));

      if (soundEnabled) buySound.play();
      missions.forEach(mission => {
        if (mission.type === "shop_purchase" && !mission.completed) {
          mission.progress++;
        }
      });

      switch (offer.type) {
        case 'gems':
            addGems(offer.amount); // Remplace gems += offer.amount
            resultElement.innerHTML = `<p class="text-green-400">Achat réussi ! +${Math.min(offer.amount, 1000000000 - gems)} gemmes</p>`;
            break;
        case 'exp-boost':
          expMultiplier = offer.amount;
          expBoostEndTime = Date.now() + 30 * 60 * 1000;
          setTimeout(() => {
            expMultiplier = 1;
            expBoostEndTime = 0;
            localStorage.setItem("expMultiplier", expMultiplier);
            localStorage.setItem("expBoostEndTime", expBoostEndTime);
            resultElement.innerHTML = `<p class="text-yellow-400">Boost EXP x${offer.amount} terminé !</p>`;
            updateUI();
            updateItemDisplay();
          }, 30 * 60 * 1000);
          resultElement.innerHTML = `<p class="text-green-400">Boost EXP x${offer.amount} activé pour 30 minutes !</p>`;
          break;
        case 'pull-ticket':
          pullTickets += offer.amount;
          inventory["Pass XP"] += offer.amount; // Mettre à jour l'inventaire
          resultElement.innerHTML = `<p class="text-green-400">Achat réussi ! +${offer.amount} ticket(s) de tirage</p>`;
          break;
        case 'special-character':
          const character = specialCharacters.find(char => char.name === (offer.description.includes("Sakura") ? "Sakura" : "Yuki-no-Kami"));
          const characterWithId = { ...char, id: `char_${characterIdCounter++}`, level: 1, exp: 0, locked: false, hasEvolved: false };
          ownedCharacters.unshift(characterWithId);
          updateCharacterDisplay();
          resultElement.innerHTML = `<p class="text-green-400">Personnage spécial ${character.name} débloqué !</p>`;
          break;
      }
      checkMissions();
      updateUI();
      updateShopDisplay();
      updateItemDisplay(); // Mettre à jour l'affichage de l'inventaire
      localStorage.setItem("characterIdCounter", characterIdCounter);
      scheduleSave();
    }

    function checkMissions() {
      missions.forEach(mission => {
        if (mission.progress >= mission.goal && !mission.completed) {
          mission.completed = true;
          addGems(mission.reward.gems); // Remplace gems += mission.reward.gems
          resultElement.innerHTML = `<p class="text-green-400">Mission "${mission.description}" complétée ! +${Math.min(mission.reward.gems, 1000000000 - gems)} gemmes</p>`;
        }
      });
      updateMissions();
      updateUI();
    }

    function canCharacterEvolve(char) {
      if (char.hasEvolved) return false;

      // Utiliser char.originalName si présent (après une première évolution), sinon char.name
      const baseNameToFind = char.originalName || char.name;
      const baseCharDef = allCharacters.find(c => c.name === baseNameToFind);

      if (!baseCharDef || !baseCharDef.evolutionRequirements || baseCharDef.evolutionRequirements.length === 0) {
          return false; // Pas de définition de base ou pas d'exigences d'évolution
      }

      // Vérifier les exigences par rapport à l'inventaire et aux pièces
      return baseCharDef.evolutionRequirements.every(req => {
          if (req.item) {
              return (inventory[req.item] || 0) >= req.quantity;
          } else if (req.coins) {
              return coins >= req.coins;
          }
          return true; // Pour d'autres types d'exigences futures
      });
    }

    function updateCharacterDisplay() {
      if (!ownedCharacters.length && !inventoryFilterName && inventoryFilterRarity === "all" && !inventoryFilterEvolvable && !inventoryFilterLimitBreak && !inventoryFilterCanReceiveExp) {
          characterDisplay.innerHTML = '<p class="text-white col-span-full text-center">Aucun personnage possédé.</p>'; // Modifié pour s'adapter à la grille
          return;
      }

      let filteredCharacters = [...ownedCharacters];

      // Appliquer les filtres
      if (inventoryFilterName) {
          filteredCharacters = filteredCharacters.filter(char =>
              (char.name || "").toLowerCase().includes(inventoryFilterName.toLowerCase())
          );
      }

      if (inventoryFilterRarity !== "all") {
          filteredCharacters = filteredCharacters.filter(char => char.rarity === inventoryFilterRarity);
      }

      if (inventoryFilterEvolvable) {
          filteredCharacters = filteredCharacters.filter(char => canCharacterEvolve(char));
      }

      if (inventoryFilterLimitBreak) {
          filteredCharacters = filteredCharacters.filter(char => {
              const currentMaxCap = char.maxLevelCap || 60;
              return char.level >= currentMaxCap && currentMaxCap < MAX_POSSIBLE_LEVEL_CAP;
          });
      }

      if (inventoryFilterCanReceiveExp) {
          filteredCharacters = filteredCharacters.filter(char => {
              const currentMaxCap = char.maxLevelCap || 60;
              return char.level < currentMaxCap;
          });
      }

      // Trier les personnages
      const sortedAndFilteredCharacters = filteredCharacters.sort((a, b) => {
            let primaryComparison = 0;
            // Tri principal basé sur sortCriteria (contrôlé par le sélecteur de l'inventaire)
            if (sortCriteria === "power") primaryComparison = (b.power || 0) - (a.power || 0);
            else if (sortCriteria === "rarity") primaryComparison = (rarityOrder[b.rarity] ?? -1) - (rarityOrder[a.rarity] ?? -1);
            else if (sortCriteria === "level") primaryComparison = (b.level || 0) - (a.level || 0);
            else if (sortCriteria === "name") primaryComparison = (a.name || "").localeCompare(b.name || "");
            // Si sortCriteria est "none" ou une autre valeur, primaryComparison restera 0

            if (primaryComparison !== 0) return primaryComparison;

            // Tri secondaire fixe pour la stabilité (par nom, ascendant) si le tri principal est égal
            // Ignorer la variable globale sortCriteriaSecondary pour l'inventaire ici.
            return (a.name || "").localeCompare(b.name || "");
        });

      if (!sortedAndFilteredCharacters.length) {
          characterDisplay.innerHTML = '<p class="text-white col-span-full text-center">Aucun personnage ne correspond à vos filtres.</p>'; // Modifié pour s'adapter à la grille
          return;
      }

      characterDisplay.innerHTML = sortedAndFilteredCharacters.map((char) => {
          const isSelected = selectedCharacterIndices.has(char.id);
          let rarityTextColorClass = char.color;
          if (char.rarity === "Mythic") rarityTextColorClass = "rainbow-text";
          else if (char.rarity === "Vanguard") rarityTextColorClass = "text-vanguard";
          else if (char.rarity === "Secret") rarityTextColorClass = "text-secret";
          // ... (autres if/else if pour couleurs de rareté)

          let statRankDisplayHtml = '';
          if (char.statRank && statRanks[char.statRank]) {
              statRankDisplayHtml = `<p class="text-center text-white text-xs">Stat: <span class="${statRanks[char.statRank].color || 'text-white'}">${char.statRank}</span></p>`;
          }

          let cardClasses = `relative p-2 rounded-lg border cursor-pointer`;
          let onclickAction = `showCharacterStats('${char.id}')`;

          if (isDeleteMode) {
              if (char.locked) {
                  cardClasses += ` ${getRarityBorderClass(char.rarity)} opacity-50 cursor-not-allowed`;
              } else {
                  cardClasses += ` ${isSelected ? 'selected-character' : getRarityBorderClass(char.rarity)}`;
                  onclickAction = `deleteCharacter('${char.id}')`;
              }
          } else {
              cardClasses += ` ${getRarityBorderClass(char.rarity)}`;
          }

          return `
          <div class="${cardClasses}" onclick="${onclickAction}">
              ${char.locked ? '<span class="absolute top-1 right-1 text-xl text-white bg-black bg-opacity-50 rounded p-1">🔒</span>' : ''}
              <img src="${char.image}" alt="${char.name}" class="w-full h-32 object-contain rounded">
              <p class="text-center text-white font-semibold mt-2 text-sm">${char.name}</p>
              <p class="text-center ${rarityTextColorClass} text-xs">${char.rarity}</p>
              <p class="text-center text-white text-xs">Niveau: ${char.level} / ${char.maxLevelCap || 60}</p>
              ${statRankDisplayHtml}
              <p class="text-center text-white text-xs">Puissance: ${char.power}</p>
          </div>
          `;
      }).join("");
    }

    function updateCharacterSelectionDisplay() {
      characterSelectionList.innerHTML = "";
      const currentMaxTeamSize = calculateMaxTeamSize();

      const modalTitle = document.getElementById("character-selection-title");
      if (modalTitle) {
          modalTitle.textContent = `Sélectionner ${currentMaxTeamSize} Personnage(s) pour le Combat`;
      }

      // Restaurer les valeurs des filtres depuis les variables globales
      const searchNameInput = document.getElementById("battle-search-name");
      const filterRaritySelect = document.getElementById("battle-filter-rarity");
      if (searchNameInput) searchNameInput.value = battleSearchName;
      if (filterRaritySelect) filterRaritySelect.value = battleFilterRarity;

      let charactersToDisplay = [...ownedCharacters];

      // Appliquer le filtre par nom (utilise la variable globale battleSearchName)
      if (battleSearchName) {
          charactersToDisplay = charactersToDisplay.filter(char => char.name.toLowerCase().includes(battleSearchName));
      }

      // Appliquer le filtre par rareté (utilise la variable globale battleFilterRarity)
      if (battleFilterRarity !== "all") {
          charactersToDisplay = charactersToDisplay.filter(char => char.rarity === battleFilterRarity);
      }

      const sortedCharacters = charactersToDisplay.sort((a, b) => {
        if (battleSortCriteria === "power") { // <--- CORRIGÉ
          return (b.power || 0) - (a.power || 0);
        } else if (battleSortCriteria === "rarity") { // <--- CORRIGÉ
          const rarityAValue = rarityOrder[a.rarity] ?? -1;
          const rarityBValue = rarityOrder[b.rarity] ?? -1;
          return rarityBValue - rarityAValue;
        } else if (battleSortCriteria === "level") { // <--- CORRIGÉ
          return (b.level || 0) - (a.level || 0);
        } else if (battleSortCriteria === "name") { // <--- AJOUTÉ POUR COHÉRENCE
          return (a.name || "").localeCompare(b.name || "");
        }
        return 0;
      });

      const selectedCharacterNames = new Set();
      for (const selectedIdx of selectedBattleCharacters) {
          if(ownedCharacters[selectedIdx]) {
              selectedCharacterNames.add(ownedCharacters[selectedIdx].name);
          }
      }
      
      if (sortedCharacters.length === 0) {
          characterSelectionList.innerHTML = `<p class="text-white col-span-full text-center">Aucun personnage ne correspond à vos filtres.</p>`;
      } else {
          sortedCharacters.forEach((char) => {
              const originalIndex = ownedCharacters.findIndex(c => c.id === char.id);
              if (originalIndex === -1) return;

              const charElement = document.createElement("div");

              let isCurrentlySelected = selectedBattleCharacters.has(originalIndex);
              let isSelectable = true;
              let additionalClasses = "";

              if (!isCurrentlySelected && selectedBattleCharacters.size < currentMaxTeamSize) {
                  if (selectedCharacterNames.has(char.name)) {
                      isSelectable = false;
                      additionalClasses = "non-selectable-for-battle";
                  }
              } else if (!isCurrentlySelected && selectedBattleCharacters.size >= currentMaxTeamSize) {
                  isSelectable = false;
                  additionalClasses = "opacity-50";
              }

              let rarityTextClass = char.color;
              if (char.rarity === "Mythic") rarityTextClass = "rainbow-text";
              else if (char.rarity === "Secret") rarityTextClass = "text-secret";
              else if (char.rarity === "Vanguard") rarityTextClass = "text-vanguard";

              charElement.className = `bg-gray-800 bg-opacity-50 p-4 rounded-lg transition transform hover:scale-105 cursor-pointer border-2 ${getRarityBorderClass(char.rarity)} ${
                  isCurrentlySelected ? 'selected-for-battle' : ''
              } ${additionalClasses}`;
              
              charElement.innerHTML = `
                <img src="${char.image}" alt="${char.name}" class="w-full h-32 object-cover rounded mb-2">
                <p class="${rarityTextClass} font-semibold">${char.name} (<span class="${rarityTextClass}">${char.rarity}</span>, Niv. ${char.level})</p>
                <p class="text-white">Puissance: ${char.power}</p> 
              `;
              
              if (isSelectable || isCurrentlySelected) {
                  charElement.addEventListener("click", () => {
                      selectBattleCharacter(originalIndex);
                  });
              }
              
              characterSelectionList.appendChild(charElement);
          });
      }

      selectedCountElement.textContent = `${selectedBattleCharacters.size}/${currentMaxTeamSize}`;
      confirmSelectionButton.disabled = selectedBattleCharacters.size !== currentMaxTeamSize;
      confirmSelectionButton.classList.toggle("opacity-50", selectedBattleCharacters.size !== currentMaxTeamSize);
      confirmSelectionButton.classList.toggle("cursor-not-allowed", selectedBattleCharacters.size !== currentMaxTeamSize);
      
      const battleSortCriteriaSelect = document.getElementById("battle-sort-criteria");
      if (battleSortCriteriaSelect) battleSortCriteriaSelect.value = battleSortCriteria;
    }

    function selectBattleCharacter(index) {
      const characterToAdd = ownedCharacters[index];
      let currentMaxTeamSize = calculateMaxTeamSize();

      if (selectedBattleCharacters.has(index)) {
          selectedBattleCharacters.delete(index);
      } else {
          // Recalculer la taille max *potentielle* si ce personnage était ajouté
          let potentialSelected = new Set(selectedBattleCharacters);
          potentialSelected.add(index);
          let potentialMaxTeamSize = 3;
          let potentialBonus = 0;
          potentialSelected.forEach(idx => {
              const char = ownedCharacters[idx];
              if (char && char.passive && typeof char.passive.teamSizeBonus === 'number') {
                  potentialBonus = Math.max(potentialBonus, char.passive.teamSizeBonus);
              }
          });
          potentialMaxTeamSize += potentialBonus;

          if (selectedBattleCharacters.size < potentialMaxTeamSize) { // Vérifier par rapport à la taille potentielle
              let alreadySelectedSameName = false;
              for (const selectedIndex of selectedBattleCharacters) {
                  if (ownedCharacters[selectedIndex].name === characterToAdd.name) {
                      alreadySelectedSameName = true;
                      break;
                  }
              }
              if (!alreadySelectedSameName) {
                  selectedBattleCharacters.add(index);
              } else {
                  // console.log(`Personnage ${characterToAdd.name} déjà sélectionné.`);
              }
          }
      }
      updateCharacterSelectionDisplay(); // Ceci va recalculer et réafficher avec la bonne taille max
    }

    function cancelSelection() {
      selectedBattleCharacters.clear();
      characterSelectionModal.classList.add("hidden");
      updateLevelDisplay();
      disableNoScroll();
      updateCharacterSelectionDisplay();
    }

    function startFusion(id) {
      console.log("startFusion appelé avec id:", id);

      // 1. Trouver le personnage d'abord
      const char = ownedCharacters.find(c => c.id === id);
      if (!char) { // S'assurer que le personnage existe
        console.log("Personnage non trouvé pour id:", id);
        resultElement.innerHTML = '<p class="text-red-400">Personnage non trouvé !</p>';
        return;
      }

      // 2. Vérifier le niveau maximum APRÈS avoir trouvé le personnage
      if (char.level >= (char.maxLevelCap || 60)) {
        resultElement.innerHTML = `<p class="text-red-400">${char.name} est déjà à son niveau maximum actuel (${char.maxLevelCap || 60}) et ne peut pas être fusionné !</p>`;
        return;
      }

      // 3. Vérifier s'il y a assez de personnages pour une fusion
      if (ownedCharacters.filter(c => c.id !== currentFusionCharacterId && !c.locked).length < 1 && ownedCharacters.length <=1 ) { // Vérifie s'il y a au moins un autre perso non lock à fusionner
        resultElement.innerHTML = '<p class="text-red-400">Pas assez d\'autres personnages (non verrouillés) pour fusionner !</p>';
        return;
      }


      currentFusionCharacterId = id;
      selectedFusionCharacters.clear();
      statsModal.classList.add("hidden"); // Fermer la modale stats si elle était ouverte
      fusionModal.classList.remove("hidden");
      enableNoScroll(); // Assurer la gestion correcte du scroll

      console.log("Personnage principal pour fusion:", char.name);

      // Assigner directement les gestionnaires d'événements pour éviter l'accumulation
      // et s'assurer qu'ils pointent vers les bonnes fonctions.
      // Pas besoin de removeEventListener si on assigne directement à onclick.
      const confirmBtn = document.getElementById("confirm-fusion");
      const cancelBtn = document.getElementById("cancel-fusion");

      confirmBtn.onclick = () => {
        console.log("Bouton Confirmer Fusion cliqué");
        confirmFusion();
      };
      cancelBtn.onclick = () => {
        console.log("Bouton Annuler Fusion cliqué");
        cancelFusion();
      };

      updateFusionSelectionDisplay();
    }

    function updateFusionSelectionDisplay() {
      fusionSelectionList.innerHTML = "";
      // Filtrez les personnages non verrouillés et différents du personnage principal
      const availableForFusion = ownedCharacters.filter(char => char.id !== currentFusionCharacterId && !char.locked); 

      availableForFusion.forEach((char) => { // Utilisez la liste filtrée
        // if (char.id === currentFusionCharacterId) return; // Ce check est déjà fait par le filter
        const charElement = document.createElement("div");
        charElement.className = `bg-gray-800 bg-opacity-50 p-4 rounded-lg transition transform hover:scale-105 cursor-pointer border-2 ${getRarityBorderClass(char.rarity)} ${
          selectedFusionCharacters.has(char.id) ? 'selected-for-fusion' : ''
        }`;
        charElement.innerHTML = `
          <img src="${char.image}" alt="${char.name}" class="w-full h-32 object-cover rounded mb-2">
          <p class="${char.color} font-semibold">${char.name} (<span class="${char.rarity === 'Mythic' ? 'rainbow-text' : ''}">${char.rarity}</span>, Niv. ${char.level})</p>
          <p class="text-white">Puissance: ${char.power}</p>
        `;
        charElement.addEventListener("click", () => {
          console.log("Clic sur personnage pour fusion, id:", char.id);
          selectFusionCharacter(char.id);
        });
        fusionSelectionList.appendChild(charElement);
      });

      if (availableForFusion.length === 0) {
         fusionSelectionList.innerHTML = '<p class="text-gray-400 col-span-full">Aucun personnage non verrouillé disponible pour la fusion.</p>';
      }

      fusionSelectedCountElement.textContent = selectedFusionCharacters.size;
      confirmFusionButton.disabled = selectedFusionCharacters.size === 0;
      confirmFusionButton.classList.toggle("opacity-50", selectedFusionCharacters.size === 0);
      confirmFusionButton.classList.toggle("cursor-not-allowed", selectedFusionCharacters.size === 0);
    }

    function selectFusionCharacter(id) {
      console.log("selectFusionCharacter appelé avec id:", id);
      if (selectedFusionCharacters.has(id)) {
        selectedFusionCharacters.delete(id);
      } else {
        selectedFusionCharacters.add(id);
      }
      console.log("selectedFusionCharacters après mise à jour:", Array.from(selectedFusionCharacters));
      updateFusionSelectionDisplay();
    }

    function cancelFusion() {
      console.log("cancelFusion appelé");
      selectedFusionCharacters.clear();
      fusionModal.classList.add("hidden");
      document.body.classList.remove("no-scroll");
      updateCharacterDisplay();
    }

    function confirmFusion() {
      console.log("confirmFusion appelé");
      if (selectedFusionCharacters.size === 0) {
        console.log("Aucun personnage sélectionné pour la fusion");
        return;
      }
      const mainChar = ownedCharacters.find(c => c.id === currentFusionCharacterId);
      if (!mainChar) {
        console.log("Personnage principal non trouvé, currentFusionCharacterId:", currentFusionCharacterId);
        resultElement.innerHTML = '<p class="text-red-400">Personnage principal non trouvé !</p>';
        fusionModal.classList.add("hidden");
        document.body.classList.remove("no-scroll");
        return;
      }
      if (mainChar.level >= 100) {
        console.log("Personnage au niveau maximum");
        resultElement.innerHTML = '<p class="text-red-400">Ce personnage est déjà au niveau maximum (100) !</p>';
        fusionModal.classList.add("hidden");
        document.body.classList.remove("no-scroll");
        return;
      }

      const expByRarity = {
        Rare: 25,
        Épique: 50,
        Légendaire: 100,
        Mythic: 200,
        Secret: 300
      };
      let totalExpGained = 0;
      const fusionSummary = {};
      const idsToDelete = Array.from(selectedFusionCharacters);
      idsToDelete.forEach(id => {
        const char = ownedCharacters.find(c => c.id === id);
        if (!char) {
          console.log("Personnage à fusionner non trouvé, id:", id);
          return;
        }
        const expGained = expByRarity[char.rarity] || 25;
        totalExpGained += expGained;
        fusionSummary[char.rarity] = (fusionSummary[char.rarity] || 0) + 1;
      });

      mainChar.basePower += 10;
      addCharacterExp(mainChar, totalExpGained);

      ownedCharacters = ownedCharacters.filter(c => !selectedFusionCharacters.has(c.id));

      missions.forEach(mission => {
          if (mission.type === "fuse_chars" && !mission.completed) {
              mission.progress += idsToDelete.length;
          }
      });

      missions.forEach(mission => {
          if (mission.type === "fuse_chars" && !mission.completed) {
              mission.progress += charactersToFuse.length;
          }
      });

      addExp(totalExpGained);

      const summaryText = Object.entries(fusionSummary)
        .map(([rarity, count]) => `${count} ${rarity} (+${count * expByRarity[rarity]} EXP)`)
        .join(", ");
      resultElement.innerHTML = `
        <p class="text-green-400">Fusion réussie pour ${mainChar.name} !</p>
        <p class="text-white">Puissance augmentée à ${mainChar.power}</p>
        <p class="text-white">${idsToDelete.length} personnage(s) fusionné(s): ${summaryText}</p>
        <p class="text-white">Total +${totalExpGained} EXP gagné pour ${mainChar.name} et le joueur</p>
      `;
      selectedFusionCharacters.clear();
      fusionModal.classList.add("hidden");
      document.body.classList.remove("no-scroll");
      updateCharacterDisplay();
      updateUI();
      scheduleSave();
    }

    function loadOrGenerateStandardBanner() {
        const savedBannerJSON = localStorage.getItem("currentStandardBanner");
        let savedBanner = null;

        if (savedBannerJSON) {
            try {
                savedBanner = JSON.parse(savedBannerJSON);
            } catch (e) {
                console.error("Erreur lors du parsing de la bannière Mythic sauvegardée:", e);
                savedBanner = null;
            }
        }

        let shouldRegenerate = !savedBanner; // Régénérer s'il n'y a pas de bannière sauvegardée

        if (savedBanner && !shouldRegenerate) { // Si une bannière est sauvegardée et qu'on ne doit pas déjà régénérer
            const mythicConfig = BANNER_CONFIG.Mythic;
            // Vérifier la validité de la structure de la bannière
            if (!savedBanner.Mythic || !Array.isArray(savedBanner.Mythic) || savedBanner.Mythic.length !== mythicConfig.numFeatured) {
                console.warn(`Bannière Mythic sauvegardée invalide (structure). Régénération.`);
                shouldRegenerate = true;
            } else {
                for (const charName of savedBanner.Mythic) {
                    const charExists = standardCharacters.find(c => c.name === charName && c.rarity === "Mythic");
                    if (!charExists) {
                        console.warn(`Mythic en vedette "${charName}" n'existe plus ou a une rareté différente. Régénération.`);
                        shouldRegenerate = true;
                        break;
                    }
                }
            }

            // Vérifier l'âge de la bannière si elle est toujours considérée valide structurellement
            if (!shouldRegenerate && savedBanner.generatedAt) {
                if (Date.now() - savedBanner.generatedAt > TWO_HOURS_MS) {
                    console.log("La bannière Mythic sauvegardée a plus de 2 heures. Régénération.");
                    shouldRegenerate = true;
                }
            } else if (!savedBanner.generatedAt) { // Si pas de timestamp, régénérer par sécurité
                 console.warn("Bannière Mythic sauvegardée n'a pas de timestamp 'generatedAt'. Régénération.");
                 shouldRegenerate = true;
            }
        }


        if (shouldRegenerate) {
            console.log("Génération des Mythics en vedette.");
            generateNewStandardBanner();
        } else {
            currentStandardBanner = savedBanner;
            console.log("Mythics en vedette chargés depuis localStorage:", currentStandardBanner);
        }
        updateProbabilitiesDisplay();
    }

    function generateNewStandardBanner() {
        const newBannerData = { Mythic: [], generatedAt: Date.now() }; // Mettre à jour le timestamp
        const mythicConfig = BANNER_CONFIG.Mythic;
        const allMythicChars = standardCharacters.filter(char => char.rarity === "Mythic");

        if (allMythicChars.length < mythicConfig.numFeatured) {
            console.warn(`Pas assez de Mythics (${allMythicChars.length}) pour en mettre ${mythicConfig.numFeatured} en vedette. Utilisation de tous.`);
            newBannerData.Mythic = allMythicChars.map(char => char.name);
        } else {
            const shuffled = [...allMythicChars].sort(() => 0.5 - Math.random());
            newBannerData.Mythic = shuffled.slice(0, mythicConfig.numFeatured).map(char => char.name);
        }
        
        currentStandardBanner = newBannerData;
        localStorage.setItem("currentStandardBanner", JSON.stringify(currentStandardBanner));
        console.log("Nouveaux Mythics en vedette générés et sauvegardés:", currentStandardBanner);
    }

    // Optionnel: Mettre à jour la bannière périodiquement si le jeu reste ouvert
    // Cela n'est pas strictement nécessaire si l'actualisation au chargement suffit.
    // Si vous voulez une mise à jour "en direct" sans recharger la page:
    /*
    setInterval(() => {
        if (currentStandardBanner.generatedAt && (Date.now() - currentStandardBanner.generatedAt > TWO_HOURS_MS)) {
            console.log("Mise à jour automatique de la bannière (jeu ouvert depuis > 2h sans refresh de bannière).");
            generateNewStandardBanner();
            updateProbabilitiesDisplay();
            // Informer potentiellement l'utilisateur que la bannière a changé
            const resultElement = document.getElementById("result"); // S'assurer que resultElement est accessible
            if (resultElement) { // Vérifier si resultElement existe avant de l'utiliser
                 resultElement.innerHTML = '<p class="text-yellow-400">La sélection de personnages en vedette a été mise à jour !</p>';
                 setTimeout(() => {
                    if (resultElement.innerHTML.includes("personnages en vedette a été mise à jour")) {
                         resultElement.innerHTML = '<p class="text-white text-lg">Tire pour obtenir des personnages légendaires !</p>';
                    }
                 }, 5000);
            }
        }
    }, 5 * 60 * 1000); // Vérifier toutes les 5 minutes, par exemple
    */



    // Variable globale pour la largeur de la barre de défilement
    let scrollbarWidth = 0;
    let isNoScrollActive = false;

    // Calculer la largeur de la barre de défilement
    function calculateScrollbarWidth() {
      const outer = document.createElement("div");
      outer.style.visibility = "hidden";
      outer.style.overflow = "scroll";
      outer.style.width = "100px";
      outer.style.position = "absolute";
      outer.style.top = "-9999px";
      document.body.appendChild(outer);
      const inner = document.createElement("div");
      inner.style.width = "100%";
      outer.appendChild(inner);
      scrollbarWidth = outer.offsetWidth - inner.offsetWidth;
      document.body.removeChild(outer);
      return scrollbarWidth || 15;
    }

    // Calculer au chargement
    document.addEventListener("DOMContentLoaded", () => {
      scrollbarWidth = calculateScrollbarWidth();
      console.log("Largeur de la barre de défilement calculée:", scrollbarWidth);
    });

        // Gérer no-scroll
    function enableNoScroll() {
      if (isNoScrollActive) return;
      document.body.classList.add("no-scroll");
      // document.body.style.paddingRight = `${scrollbarWidth}px`; // Ligne commentée/supprimée
      isNoScrollActive = true;
      console.log("no-scroll activé (overflow: hidden appliqué au body)"); // Log optionnel mis à jour
    }

    function disableNoScroll() {
      if (!isNoScrollActive) return;
      document.body.classList.remove("no-scroll");
      // document.body.style.paddingRight = ""; // Ligne commentée/supprimée
      isNoScrollActive = false;
      console.log("no-scroll désactivé (overflow: hidden retiré du body)"); // Log optionnel mis à jour
    }

    // Modale "Donner des objets"
    function startGiveItems(id) {
      console.log("startGiveItems appelé avec id:", id);
      const char = ownedCharacters.find(c => c.id === id);
      if (!char) { // AJOUT: Vérifier si le personnage est au max de son cap actuel
        console.log("Personnage non trouvé pour id:", id);
        resultElement.innerHTML = '<p class="text-red-400">Personnage non trouvé !</p>';
        return;
      }
      const currentCharacterMaxLevel = char.maxLevelCap || 60;
      const isMaxLevel = char.level >= currentCharacterMaxLevel;
      const hasPowerItem = Object.entries(inventory).some(([item, quantity]) => quantity > 0 && itemEffects[item]?.power);

      if (isMaxLevel && !hasPowerItem) {
        resultElement.innerHTML = `<p class="text-red-400">${char.name} est à son niveau maximum actuel (${currentCharacterMaxLevel}) et vous n'avez pas d'objets augmentant la puissance à lui donner.</p>`;
        return; // Ne pas ouvrir la modale
      }
      currentGiveItemsCharacterId = id;
      selectedItemsForGiving.clear();
      statsModal.classList.add("hidden");
      giveItemsModal.classList.remove("hidden");
      enableNoScroll();
      updateItemSelectionDisplay();
    }

    function cancelGiveItems() {
      console.log("cancelGiveItems appelé");
      selectedItemsForGiving.clear();
      giveItemsModal.classList.add("hidden");
      disableNoScroll();
      updateItemDisplay();
    }

    function updateItemSelectionDisplay() {
      itemSelectionList.innerHTML = "";
      const itemImages = {
        "Haricots": "https://static.wikia.nocookie.net/animeadventures/images/6/6c/Senzu_Bean.png/revision/latest?cb=20230101141509",
        "Fluide mystérieux": "https://static.wikia.nocookie.net/animeadventures/images/7/72/Mysterious_Fluid.png/revision/latest?cb=20230101141428",
        "Wisteria Flower": "https://static.wikia.nocookie.net/animeadventures/images/9/95/Wisteria_Flower.png/revision/latest/scale-to-width-down/115?cb=20230101141611",
        "Ramen Bowl": "https://static.wikia.nocookie.net/animeadventures/images/f/fd/Ramen_Bowl.png/revision/latest/scale-to-width-down/115?cb=20230101142002",
        "Ghoul Coffee": "https://static.wikia.nocookie.net/animeadventures/images/d/d4/Ghoul_Coffee.png/revision/latest/scale-to-width-down/115?cb=20230101141346",
        "Soul Candy": "https://static.wikia.nocookie.net/animeadventures/images/3/3c/Soul_Candy.png/revision/latest/scale-to-width-down/115?cb=20230101141254",
        "Cooked Fish": "https://static.wikia.nocookie.net/animeadventures/images/f/f6/Cooked_Fish.png/revision/latest/scale-to-width-down/115?cb=20230101141820",
        "Magical Artifact": "https://static.wikia.nocookie.net/animeadventures/images/0/05/Magical_Artifact.png/revision/latest/scale-to-width-down/115?cb=20230101142122",
        "Magic Pendant": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/5/50/Magic_Pendant.png/revision/latest/scale-to-width-down/200?cb=20241228183321",
        "Crystal": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/3/31/Crystal.png/revision/latest/scale-to-width-down/200?cb=20241108234506",
        "Chocolate Bar's": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/e/ea/Chocolate_Bar%27s.png/revision/latest/scale-to-width-down/200?cb=20250507164414",
        "Curse Talisman": "https://static.wikia.nocookie.net/animeadventures/images/e/eb/Curse_Talisman.png/revision/latest/scale-to-width-down/115?cb=20230101141854",
        "Pièces": "https://via.placeholder.com/150?text=Pièces",
        "Stat Chip": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/d/d4/Stat_Chip.png/revision/latest/scale-to-width-down/200?cb=20240925095125",
        "Tickets de Tirage": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/3/35/Pass_XP.png/revision/latest/scale-to-width-down/200?cb=20240912054111",
        "Cursed Token": "https://via.placeholder.com/150?text=Fragments",
        "Shadow Tracer": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/1/11/Shadow_Trace.png/revision/latest/scale-to-width-down/200?cb=20240925095144",
        "Blood-Red Armor": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/4/42/Blood-Red_Armor.png/revision/latest/scale-to-width-down/200?cb=20240925095521",
        "Head Captain's Coat": "https://static.wikia.nocookie.net/rbx-anime-vanguards/images/7/76/Head_Captain%27s_Coat.png/revision/latest/scale-to-width-down/200?cb=20250301094746",
        "Magic Stone": "https://static.wikia.nocookie.net/animeadventures/images/6/63/Magic_Stone.png/revision/latest/scale-to-width-down/115?cb=20230101141650",
        "Stone Pendant": "https://static.wikia.nocookie.net/animeadventures/images/f/f7/Stone_Pendant.png/revision/latest/scale-to-width-down/115?cb=20230101141922",
        "Alien Core": "https://static.wikia.nocookie.net/animeadventures/images/e/e9/Alien_Core.png/revision/latest?cb=20230129102904",
        "Tavern Piece": "https://static.wikia.nocookie.net/animeadventures/images/c/cc/Tavern_Pie.png/revision/latest?cb=20230606150016",
        "Plume Céleste": "https://png.pngtree.com/png-vector/20250517/ourlarge/pngtree-vibrant-and-detailed-feather-on-white-background-png-image_16308203.png",
        "Sablier Ancien": "https://static.wikia.nocookie.net/animeadventures/images/5/5f/Miracle_Timepiece.png/revision/latest?cb=20221119040302",
        // Ajoutez d'autres images d'objets si nécessaire
      };

      Object.entries(inventory)
        .filter(([item, quantity]) => quantity > 0 && itemEffects[item])
        .forEach(([item, quantity]) => {
          const itemElement = document.createElement("div");
          const selectedQuantity = selectedItemsForGiving.get(item) || 0;
          // Remplace les espaces par des tirets pour un ID HTML valide
          const itemIdSanitized = item.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-]/g, '');


          itemElement.className = `bg-gray-800 bg-opacity-50 p-4 rounded-lg transition transform hover:scale-105 border-2 border-gray-400 ${
            selectedQuantity > 0 ? 'selected-for-giving' : ''
          }`;
          itemElement.innerHTML = `
            <img src="${itemImages[item] || 'https://via.placeholder.com/150?text=Item'}" alt="${item}" class="w-full h-24 object-contain rounded mb-1">
            <p class="text-white font-semibold">${item}</p>
            <p class="text-white">Disponible: ${quantity}</p>
            <p class="text-white">Sélectionné: <span id="selected-qty-${itemIdSanitized}">${selectedQuantity}</span></p>
            <div class="mt-2">
              <input type="range" min="0" max="${quantity}" value="${selectedQuantity}" class="w-full item-slider cursor-pointer" data-item="${item}" data-item-id-sanitized="${itemIdSanitized}">
            </div>
          `;
          itemSelectionList.appendChild(itemElement);
        });

      // Mettre à jour le compteur total et l'état du bouton de confirmation initialement
      const totalSelectedInitial = Array.from(selectedItemsForGiving.values()).reduce((sum, qty) => sum + qty, 0);
      itemSelectedCountElement.textContent = totalSelectedInitial;

      const allInitiallyZero = Array.from(selectedItemsForGiving.values()).every(v => v === 0);
      const nothingInitiallySelected = selectedItemsForGiving.size === 0 || allInitiallyZero;
      confirmGiveItemsButton.disabled = nothingInitiallySelected;
      confirmGiveItemsButton.classList.toggle("opacity-50", nothingInitiallySelected);
      confirmGiveItemsButton.classList.toggle("cursor-not-allowed", nothingInitiallySelected);


      // Attacher les écouteurs d'événements pour les sliders
      document.querySelectorAll(".item-slider").forEach(slider => {
        slider.addEventListener("input", (event) => {
          const item = event.target.dataset.item;
          const itemIdSanitized = event.target.dataset.itemIdSanitized;
          const newQuantity = parseInt(event.target.value, 10);

          const selectedQtySpan = document.getElementById(`selected-qty-${itemIdSanitized}`);
          if (selectedQtySpan) {
            selectedQtySpan.textContent = newQuantity;
          }

          if (newQuantity === 0) {
            selectedItemsForGiving.delete(item);
          } else {
            selectedItemsForGiving.set(item, newQuantity);
          }

          // Mettre à jour le compteur total
          itemSelectedCountElement.textContent = Array.from(selectedItemsForGiving.values()).reduce((sum, qty) => sum + qty, 0);

          // Mettre à jour l'état du bouton de confirmation
          const allZero = Array.from(selectedItemsForGiving.values()).every(v => v === 0);
          const nothingSelected = selectedItemsForGiving.size === 0 || allZero;

          confirmGiveItemsButton.disabled = nothingSelected;
          confirmGiveItemsButton.classList.toggle("opacity-50", nothingSelected);
          confirmGiveItemsButton.classList.toggle("cursor-not-allowed", nothingSelected);

          // Mettre à jour le style de la bordure de la carte de l'objet
          const itemCard = slider.closest('div.bg-gray-800');
          if (itemCard) {
            if (newQuantity > 0) {
              itemCard.classList.add('selected-for-giving');
            } else {
              itemCard.classList.remove('selected-for-giving');
            }
          }
        });
      });
    }

    function cancelGiveItems() {
      console.log("cancelGiveItems appelé");
      selectedItemsForGiving.clear();
      giveItemsModal.classList.add("hidden");
      document.body.classList.remove("no-scroll");
      updateItemDisplay();
    }

    function confirmGiveItems() {
      console.log("confirmGiveItems appelé");
      if (selectedItemsForGiving.size === 0) {
        console.log("Aucun objet sélectionné pour donner");
        return;
      }
      const char = ownedCharacters.find(c => c.id === currentGiveItemsCharacterId);
      if (!char) {
        // ... (message d'erreur existant)
        return;
      }

      let totalExpGained = 0;
      let totalPowerGained = 0;
      const summary = [];
      // --- MODIFIÉ : Vérifier si le personnage peut encore gagner de l'EXP basé sur son maxLevelCap ---
      const canGainExp = char.level < (char.maxLevelCap || 60);

      selectedItemsForGiving.forEach((quantity, item) => {
        const effect = itemEffects[item];
        let itemSummary = `${quantity} ${item} (`;
        let effectsApplied = [];

        // --- MODIFICATION : Ajouter l'EXP seulement si possible ---
        if (effect.exp && canGainExp) {
          totalExpGained += effect.exp * quantity;
          effectsApplied.push(`+${effect.exp * quantity} EXP`);
        } else if (effect.exp && !canGainExp) {
          effectsApplied.push(`EXP ignoré (Niv. Max)`);
        }
        // --- FIN MODIFICATION ---

        if (effect.power) {
          totalPowerGained += effect.power * quantity;
          effectsApplied.push(`+${effect.power * quantity} Puissance`);
