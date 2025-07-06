    // --- NOUVEAU: Initialisation de Firebase ---
    // TODO: COLLEZ VOTRE CONFIGURATION FIREBASE ICI
    const firebaseConfig = {
        apiKey: "AIzaSyDcNkyF9_fUdfzX5pv2V9Q-SzKQhGEbP-g",
        authDomain: "jeu-gacha-93e4e.firebaseapp.com",
        projectId: "jeu-gacha-93e4e",
        storageBucket: "jeu-gacha-93e4e.firebasestorage.app",
        messagingSenderId: "521750081576",
        appId: "1:521750081576:web:6d8c26a2a67eb92b57451d"
    };

    // Initialiser Firebase
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
            gems = 1000; // Valeur par défaut si localStorage est corrompu
        }
    } else {
        gems = 1000; // Valeur par défaut pour un nouveau joueur
    }
    let coins = parseInt(localStorage.getItem("coins")) || 0;
    let pullCount = parseInt(localStorage.getItem("pullCount")) || 0;
    
    // Chargement et validation des personnages possédés depuis localStorage
    let ownedCharacters = [];
    const rawOwnedCharactersString = localStorage.getItem("ownedCharacters");
    console.log("Vérification avant boucle: statRanks est défini?", typeof statRanks !== 'undefined'); // LOG DE CONTRÔLE

    if (rawOwnedCharactersString) {
        try {
            const loadedChars = JSON.parse(rawOwnedCharactersString); // Tenter de parser la chaîne JSON
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
                        
                        // Gestion du statRank et statModifier
                        if (!statRank || !statRanks[statRank]) { // Si statRank est invalide ou non défini
                            statRank = getRandomStatRank(); // Assigner un rang aléatoire
                            statModifier = statRanks[statRank].modifier;
                            console.warn(`[INIT Char ${index}] '${char.name}' avait un statRank invalide. Nouveau statRank: ${statRank}`);
                        } else if (typeof statModifier === 'undefined' || statModifier === null || isNaN(Number(statModifier))) {
                            // Si statModifier est invalide mais statRank est bon, recalculer statModifier
                            statModifier = statRanks[statRank].modifier;
                            console.warn(`[INIT Char ${index}] '${char.name}' avait un statModifier invalide. Recalculé à: ${statModifier} pour le rang ${statRank}`);
                        }
                        statModifier = Number(statModifier); // S'assurer que c'est un nombre

                        // Gestion de basePower
                        if (typeof basePower === 'undefined' || basePower === null || isNaN(Number(basePower)) || Number(basePower) <= 0) {
                            if (initialPowerFromDefinition && statModifier && statModifier !== 0) {
                                basePower = initialPowerFromDefinition / statModifier;
                                console.warn(`[INIT Char ${index}] '${char.name}' avait un basePower invalide. Dérivé à: ${basePower} (depuis def:${initialPowerFromDefinition} / mod:${statModifier})`);
                            } else if (initialPowerFromDefinition) {
                                basePower = initialPowerFromDefinition; // Fallback si statModifier est aussi problématique
                                console.warn(`[INIT Char ${index}] '${char.name}' avait un basePower invalide. Défini à: ${basePower} (directement depuis def:${initialPowerFromDefinition}, statModifier problématique)`);
                            } else {
                                basePower = 50; // Ultime fallback
                                console.error(`[INIT Char ${index}] '${char.name}' FATAL: basePower et initialPowerFromDefinition invalides. Défini à ${basePower}`);
                            }
                        }
                        basePower = Number(basePower); // S'assurer que c'est un nombre

                        // Migration et validation des traits
                        let traitObject = { id: null, grade: 0 };
                        if (char.trait) {
                            let tempTraitId = char.trait.id;
                            let tempTraitGrade = char.trait.grade;

                            // Migration de 'level' vers 'grade'
                            if (typeof char.trait.level !== 'undefined' && typeof tempTraitGrade === 'undefined') {
                                tempTraitGrade = Number(char.trait.level) > 0 ? Number(char.trait.level) : 0;
                            }
                            tempTraitGrade = Number(tempTraitGrade) || 0;

                            if (tempTraitId && TRAIT_DEFINITIONS[tempTraitId]) {
                                const traitDef = TRAIT_DEFINITIONS[tempTraitId];
                                if (traitDef.grades && traitDef.grades.length > 0) {
                                    const maxGradeForTrait = traitDef.grades.length;
                                    if (tempTraitGrade > maxGradeForTrait) {
                                        console.warn(`[INIT Char ${char.name}] Trait ${tempTraitId} avait un grade ${tempTraitGrade} > max ${maxGradeForTrait}. Ajustement.`);
                                        tempTraitGrade = maxGradeForTrait;
                                    }
                                    if (tempTraitGrade > 0) {
                                        traitObject = { id: tempTraitId, grade: tempTraitGrade };
                                    } else {
                                         console.warn(`[INIT Char ${char.name}] Trait ${tempTraitId} avec grade ${tempTraitGrade} (<=0) après migration/validation. Trait remis à null.`);
                                    }
                                } else {
                                     console.warn(`[INIT Char ${char.name}] Trait ${tempTraitId} existe mais n'a pas de définition de grades. Trait remis à null.`);
                                }
                            } else if (tempTraitId) {
                                console.warn(`[INIT Char ${char.name}] Trait ID '${tempTraitId}' non trouvé dans TRAIT_DEFINITIONS. Trait remis à null.`);
                            }
                        }


                        const newCharData = {
                            ...(baseDefinition ? baseDefinition : {}), // Copie superficielle de la définition de base
                            ...char, // Copie superficielle des propriétés sauvegardées (écrase celles de baseDefinition si conflit)
                            id: char.id || `char_${characterIdCounter++}`,
                            level: Number(char.level) || 1,
                            exp: Number(char.exp) || 0,
                            locked: char.locked || false,
                            hasEvolved: char.hasEvolved || false,
                            curseEffect: Number(char.curseEffect) || 0,
                            basePower: basePower,
                            maxLevelCap: Number(char.maxLevelCap) || 60,
                            statRank: statRank,
                            statModifier: statModifier,
                            trait: traitObject 
                        };
                        delete newCharData.power; // S'assurer que l'ancienne puissance est retirée avant recalcul

                        recalculateCharacterPower(newCharData); // Recalculer la puissance avec les données validées/migrées

                        if (isNaN(newCharData.power) || newCharData.power <= 0) {
                             console.warn(`[INIT Char ${index}] Puissance INVALIDE pour ${newCharData.name} après recalcul et validation. Power: ${newCharData.power}. SKIPPED.`);
                             console.log("[INIT Char Detail for Skipped]: ", JSON.parse(JSON.stringify(newCharData))); // Log détaillé
                             return; // Ne pas ajouter le personnage si la puissance est toujours invalide
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
              const progress = currentProgress.find(p => p.id === stdLevel.id);
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
    let isSelectingLevelForMultiAction = false;
    let multiActionState = {
        isRunning: false,
        type: null, // 'pulls' ou 'levels'
        action: null, // 'standard-1', 'standard-10', ou un levelId
        total: 0,
        current: 0,
        stopRequested: false,
        selectedLevelId: null,
        selectedLevelName: ''
    };
    let disableAutoClickerWarning = localStorage.getItem("disableAutoClickerWarning") === "true";

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
    let activeTabId = "play"; // Onglet actif par défaut
    let activePlaySubTabId = "story"; // Sous-onglet actif par défaut pour "play"
    let activeInventorySubTabId = "units"; // Sous-onglet actif par défaut pour "inventory"
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
    let reusableDamageNumberElement = null; // For mini-game optimization
    let autoClickerWarningShown = localStorage.getItem("autoClickerWarningShown") === "true";
    let clickTracker = {
        pull: [],
        level: [],
    };
    const CLICK_THRESHOLD = 10; // Clics pour déclencher
    const CLICK_TIMEFRAME_MS = 2000; // Fenêtre de temps en ms (2 secondes)
    const multiActionButton = document.getElementById("multi-action-button");
    const multiActionModal = document.getElementById("multi-action-modal");
    const maTabButtons = document.querySelectorAll(".ma-tab-button");
    const maPullsTab = document.getElementById("ma-pulls-tab");
    const maLevelsTab = document.getElementById("ma-levels-tab");
    const maPullsRepetitionsInput = document.getElementById("ma-pulls-repetitions");
    const maPullsStatus = document.getElementById("ma-pulls-status");
    const maStartPullsButton = document.getElementById("ma-start-pulls");
    const maStopPullsButton = document.getElementById("ma-stop-pulls");
    const maSelectedLevelDisplay = document.getElementById("ma-selected-level-display");
    const maSelectLevelButton = document.getElementById("ma-select-level-button");
    const maLevelsRepetitionsInput = document.getElementById("ma-levels-repetitions");
    const maLevelsStatus = document.getElementById("ma-levels-status");
    const maStartLevelsButton = document.getElementById("ma-start-levels");
    const maStopLevelsButton = document.getElementById("ma-stop-levels");
    const maCloseButton = document.getElementById("ma-close");
    const disableAutoClickerWarningCheckbox = document.getElementById("disable-autoclicker-warning");
    const autoClickerWarningModal = document.getElementById('auto-clicker-warning-modal');

    
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
            
            // CORRECTION: Générer les missions et offres de boutique initiales pour une nouvelle partie
            updateMissionPool();
            updateShopOffers();

        // Cas 2: Chargement d'une partie existante
        } else {
            console.log("Sauvegarde trouvée, chargement de la progression.");
            
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
            inventory = saveData.inventory || {};
            discoveredCharacters = saveData.discoveredCharacters || [];
            characterPreset = saveData.characterPreset || [];
            presetConfirmed = saveData.presetConfirmed || false;
            standardPityCount = saveData.standardPityCount || 0;
            specialPityCount = saveData.specialPityCount || 0;
            lastUsedBattleTeamIds = saveData.lastUsedBattleTeamIds || [];
            autosellSettings = saveData.autosellSettings || { Rare: false, Épique: false, Légendaire: false, Mythic: false, Secret: false };
            
            // CORRECTION: S'assurer que les missions et la boutique ne sont pas vides (utile pour les anciennes sauvegardes)
            if (missions.length === 0) {
                updateMissionPool();
            }
            if (shopOffers.length === 0) {
                updateShopOffers();
            }
            
            if (inventory) {
                inventory["Pass XP"] = pullTickets;
            }
        }

        updateLegendeDisplay();
        updateChallengeDisplay();
        updateMaterialFarmDisplay();
        updateShopDisplay();
        updateMissions();
        applySettings();
        updateTimer();
        updateUI();
        updateCharacterDisplay();
        updateItemDisplay();
        updateIndexDisplay();
        updateEvolutionDisplay();
        updateStatChangeTabDisplay();
        updateCurseTabDisplay();
        updateTraitTabDisplay();
        updateLimitBreakTabDisplay();
        updateLevelDisplay();
        showTab("play");
        
        isGameInitialized = true;

        loadOrGenerateStandardBanner();

        scheduleSave();

        if (!disableAutoClickerWarning && autoClickerWarningModal) {
            autoClickerWarningModal.classList.remove('hidden');
            enableNoScroll();
        }
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
        // Assurer que les valeurs numériques de base sont valides
        char.basePower = Number(char.basePower) || 0;
        char.curseEffect = Number(char.curseEffect) || 0;

        // Valider et initialiser statRank et statModifier
        if (!char.statRank || !statRanks[char.statRank]) {
            console.warn(`RecalculatePower: ${char.name} - statRank invalide (${char.statRank}). Assignation de A par défaut.`);
            char.statRank = "A"; 
            char.statModifier = statRanks["A"].modifier;
        } else if (typeof char.statModifier !== 'number' || isNaN(char.statModifier)) {
            console.warn(`RecalculatePower: ${char.name} - statModifier invalide (${char.statModifier}) pour rang ${char.statRank}. Recalcul.`);
            char.statModifier = statRanks[char.statRank].modifier;
        }
        // S'assurer que statModifier est un nombre
        char.statModifier = Number(char.statModifier);
        if (isNaN(char.statModifier)) { // Ultime fallback pour statModifier
            console.error(`RecalculatePower: ${char.name} - statModifier est NaN même après tentative de correction. Utilisation de 1.0.`);
            char.statModifier = 1.0;
        }


        let powerBeforeTrait = char.basePower * char.statModifier;
        let traitPowerBonus = 0; 
        let traitPowerMultiplier = 1.0;

        if (char.trait && char.trait.id && typeof char.trait.grade === 'number' && char.trait.grade > 0) {
            const traitDef = TRAIT_DEFINITIONS[char.trait.id];
            // Vérifier si traitDef et traitDef.grades existent
            if (traitDef && traitDef.grades && Array.isArray(traitDef.grades)) {
                const gradeDef = traitDef.grades.find(g => g.grade === char.trait.grade);
                if (gradeDef) {
                    if (typeof gradeDef.powerBonus === 'number') {
                        traitPowerBonus = gradeDef.powerBonus;
                    }
                    if (typeof gradeDef.powerMultiplier === 'number') {
                        traitPowerMultiplier = 1.0 + gradeDef.powerMultiplier;
                    }
                } else {
                    // console.warn(`RecalculatePower: ${char.name} - Définition de grade ${char.trait.grade} non trouvée pour trait ${char.trait.id}.`);
                }
            } else {
                // console.warn(`RecalculatePower: ${char.name} - Définition de trait ${char.trait.id} ou ses grades sont invalides.`);
            }
        }
        
        let powerAfterTraitMultiplier = powerBeforeTrait * traitPowerMultiplier;
        let powerAfterTraitBonus = powerAfterTraitMultiplier + traitPowerBonus;
        
        char.power = Math.floor(powerAfterTraitBonus) + char.curseEffect; // curseEffect est déjà un nombre
        char.power = Math.max(1, char.power); // Assurer une puissance minimale de 1

        // Ultime vérification pour NaN ou puissance <= 0
        if (isNaN(char.power) || char.power <= 0) {
            console.error(`RecalculatePower: ${char.name} - Puissance finale est NaN ou <= 0. Power: ${char.power}. Réinitialisation à 1.`);
            console.log("Détails du personnage avant réinitialisation de la puissance:", JSON.parse(JSON.stringify(char)));
            
            // Tentative de récupération plus simple si basePower est le problème
            if (isNaN(char.basePower) || char.basePower <= 0) {
                 const baseDefinitionForFallback = allCharacters.find(c => c.name === (char.originalName || char.name));
                 char.basePower = baseDefinitionForFallback ? Number(baseDefinitionForFallback.power) : 50;
                 console.warn(`RecalculatePower: ${char.name} - basePower était ${char.basePower}, réinitialisé à ${baseDefinitionForFallback ? baseDefinitionForFallback.power : 50}`);
                 // Relancer un calcul simple sans traits/curses pour cette fois
                 powerBeforeTrait = char.basePower * char.statModifier;
                 char.power = Math.max(1, Math.floor(powerBeforeTrait));
            } else {
                 char.power = 1; // Si basePower semble OK, alors le problème est ailleurs, fallback à 1.
            }
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
                // La modification est ici : on utilise data-attributes au lieu de onclick
                return `<button class="level-start-button bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}" data-level-id="${level.id}" data-is-infinite="${level.isInfinite || false}" ${isDisabled ? 'disabled' : ''}>${buttonText}</button>`;
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
                if (!legendaryProgress) {
                    legendaryProgress = { id: legendaryLevelForWorld.id, unlocked: false, completed: false };
                    storyProgress.push(legendaryProgress);
                }

                if (worldCompleted && !legendaryProgress.unlocked) {
                    legendaryProgress.unlocked = true;
                }

                const isDisabled = !legendaryProgress.unlocked;
                const buttonText = `${legendaryLevelForWorld.name} ${legendaryProgress.completed ? '(Terminé)' : ''}`;

                const levelDiv = document.createElement('div');
                levelDiv.className = 'mb-6';
                
                // --- MODIFICATION APPLIQUÉE ICI ---
                levelDiv.innerHTML = `
                    <h3 class="text-xl text-white font-bold mb-2">${worldName} - Défi Légendaire</h3>
                    <div class="grid gap-4">
                        <button class="level-start-button bg-yellow-600 hover:bg-yellow-700 text-white py-2 px-4 rounded-lg ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}"
                                data-level-id="${legendaryLevelForWorld.id}" ${isDisabled ? 'disabled' : ''}>
                            ${buttonText}
                        </button>
                        ${isDisabled && !worldCompleted ? `<p class="text-sm text-gray-400">Terminez tous les niveaux du monde "${worldName}" pour débloquer ce défi.</p>` : ''}
                    </div>
                `;
                // --- FIN DE LA MODIFICATION ---
                
                legendeLevelListElement.appendChild(levelDiv);
                foundLegendaryLevel = true;
            }
        });

        if (!foundLegendaryLevel) {
            legendeLevelListElement.innerHTML = "<p class='text-white'>Aucun défi légendaire disponible pour le moment. Terminez des mondes pour les déverrouiller !</p>";
        }
        scheduleSave();
    }

    async function startLevel(id, useLastTeam = false) {
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
      if (isSelectingLevelForMultiAction) {
            const levelData = allGameLevels.find(l => l.id === id);
            if (levelData) {
                multiActionState.selectedLevelId = id;
                multiActionState.selectedLevelName = levelData.name;
                isSelectingLevelForMultiAction = false;
                
                // Rouvrir la modale et mettre à jour son affichage
                multiActionModal.classList.remove("hidden");
                enableNoScroll();
                maSelectedLevelDisplay.textContent = `Niveau sélectionné : ${levelData.name}`;
                maSelectedLevelDisplay.classList.remove("text-red-500");
            }
            return; // Ne pas continuer avec le lancement normal du niveau
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

    function openMultiActionModal() {
        if (multiActionState.isRunning) return; // Ne pas ouvrir si une action est déjà en cours
        resetMultiActionState();
        updateMultiActionModalUI();
        multiActionModal.classList.remove('hidden');
        enableNoScroll();
    }

    function closeMultiActionModal() {
        if (multiActionState.isRunning) {
            multiActionState.stopRequested = true; // Demander l'arrêt si on ferme pendant l'exécution
        }
        multiActionModal.classList.add('hidden');
        disableNoScroll();
        isSelectingLevelForMultiAction = false;
    }

    function resetMultiActionState() {
        multiActionState = {
            isRunning: false,
            type: null,
            action: null,
            total: 0,
            current: 0,
            stopRequested: false,
            selectedLevelId: null,
            selectedLevelName: ''
        };
    }

    function showMultiActionTab(tabId) {
        maPullsTab.classList.add('hidden');
        maLevelsTab.classList.add('hidden');
        document.getElementById(`ma-${tabId}-tab`).classList.remove('hidden');

        maTabButtons.forEach(btn => {
            btn.classList.toggle("border-blue-500", btn.dataset.tab === tabId);
            btn.classList.toggle("border-transparent", btn.dataset.tab !== tabId);
        });
    }

    function updateMultiActionModalUI() {
        // État des boutons de lancement/arrêt
        maStartPullsButton.classList.toggle('hidden', multiActionState.isRunning);
        maStopPullsButton.classList.toggle('hidden', !multiActionState.isRunning || multiActionState.type !== 'pulls');
        maStartLevelsButton.classList.toggle('hidden', multiActionState.isRunning);
        maStopLevelsButton.classList.toggle('hidden', !multiActionState.isRunning || multiActionState.type !== 'levels');
        
        // Griser les inputs pendant l'exécution
        maPullsRepetitionsInput.disabled = multiActionState.isRunning;
        maLevelsRepetitionsInput.disabled = multiActionState.isRunning;
        maSelectLevelButton.disabled = multiActionState.isRunning;
        document.querySelectorAll('input[name="ma-pull-type"]').forEach(radio => radio.disabled = multiActionState.isRunning);
        
        // Mettre à jour les statuts
        if (multiActionState.type === 'pulls') {
            maPullsStatus.textContent = multiActionState.isRunning ? `En cours: ${multiActionState.current} / ${multiActionState.total}` : '';
        }
        if (multiActionState.type === 'levels') {
            maLevelsStatus.textContent = multiActionState.isRunning ? `En cours: ${multiActionState.current} / ${multiActionState.total}` : '';
        }
    }

    async function startMultiPulls() {
        const pullTypeRadio = document.querySelector('input[name="ma-pull-type"]:checked');
        if (!pullTypeRadio) {
            maPullsStatus.textContent = "Erreur: Veuillez sélectionner un type de tirage.";
            return;
        }
        
        const repetitions = parseInt(maPullsRepetitionsInput.value, 10);
        // MODIFICATION ICI
        if (isNaN(repetitions) || repetitions < 1 || repetitions > 1000) {
            maPullsStatus.textContent = "Erreur: Nombre de répétitions invalide (doit être entre 1 et 1000).";
            return;
        }
        
        multiActionState.isRunning = true;
        multiActionState.type = 'pulls';
        multiActionState.action = pullTypeRadio.value;
        multiActionState.total = repetitions;
        multiActionState.current = 0;
        multiActionState.stopRequested = false;
        
        updateMultiActionModalUI();
        await runMultiActionLoop();
    }

    async function startMultiLevels() {
        if (!multiActionState.selectedLevelId) {
            maLevelsStatus.textContent = "Erreur: Aucun niveau sélectionné.";
            return;
        }
        
        if (!presetConfirmed && lastUsedBattleTeamIds.length === 0) {
            maLevelsStatus.textContent = "Erreur: Veuillez configurer un Preset ou jouer un niveau une fois manuellement pour définir une équipe.";
            return;
        }

        const repetitions = parseInt(maLevelsRepetitionsInput.value, 10);
        // MODIFICATION ICI
        if (isNaN(repetitions) || repetitions < 1 || repetitions > 1000) {
            maLevelsStatus.textContent = "Erreur: Nombre de répétitions invalide (doit être entre 1 et 1000).";
            return;
        }

        multiActionState.isRunning = true;
        multiActionState.type = 'levels';
        multiActionState.action = multiActionState.selectedLevelId;
        multiActionState.total = repetitions;
        multiActionState.current = 0;
        multiActionState.stopRequested = false;
        
        updateMultiActionModalUI();
        await runMultiActionLoop();
    }

    // --- DANS LE FICHIER script.js ---

    // DANS script.js

    async function runMultiActionLoop() {
        const DELAY_BETWEEN_ACTIONS = 50; 

        for (let i = 1; i <= multiActionState.total; i++) {
            if (multiActionState.stopRequested) {
                resultElement.innerHTML = `<p class="text-yellow-400">Actions multiples arrêtées par l'utilisateur.</p>`;
                break;
            }

            multiActionState.current = i;
            updateMultiActionModalUI();
            
            let wasSuccessful = false;

            switch(multiActionState.action) {
                case 'standard-1':
                    currentPullType = "standard";
                    wasSuccessful = await executePull(false, true);
                    break;
                case 'standard-10':
                    wasSuccessful = await multiPull(true);
                    break;
                case 'special-1':
                    currentPullType = "special";
                    wasSuccessful = await executePull(false, true);
                    break;
                case 'special-10':
                    wasSuccessful = await specialMultiPull(true);
                    break;
                default: // C'est un ID de niveau
                    await startLevel(multiActionState.action, true);
                    wasSuccessful = true;
                    break;
            }
            
            if (!wasSuccessful) {
                maPullsStatus.textContent = `Arrêté: Ressources insuffisantes.`;
                maLevelsStatus.textContent = `Arrêté: Ressources insuffisantes.`;
                console.log("Actions multiples arrêtées en raison de ressources insuffisantes.");
                break;
            }

            await new Promise(r => setTimeout(r, DELAY_BETWEEN_ACTIONS));
        }
        
        const statusElement = multiActionState.type === 'pulls' ? maPullsStatus : maLevelsStatus;
        if (!statusElement.textContent.includes("Arrêté")) {
            statusElement.textContent = `Terminé. ${multiActionState.current} sur ${multiActionState.total} actions effectuées.`;
        }
        
        resetMultiActionState();
        updateMultiActionModalUI();
        scheduleSave(); 
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
              <img src="${char.image}" alt="${char.name}" class="w-full h-32 object-cover rounded mb-2" loading="lazy" decoding="async">
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
            <img src="${char.image}" alt="${char.name}" class="w-full h-24 object-cover rounded mb-2" loading="lazy" decoding="async">
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
        presetSelectionList.innerHTML = ""; // Clear existing content
        const currentFunctionalMaxPresetTeamSize = calculateMaxPresetTeamSize();

        const presetModalTitle = document.getElementById("preset-selection-modal-title");
        if (presetModalTitle) {
            presetModalTitle.textContent = `Sélectionner ${currentFunctionalMaxPresetTeamSize} Personnage(s) pour le Preset`;
        }

        const searchNameInputPreset = document.getElementById("preset-search-name");
        const filterRaritySelectPreset = document.getElementById("preset-filter-rarity");
        if (searchNameInputPreset) searchNameInputPreset.value = presetSearchName;
        if (filterRaritySelectPreset) filterRaritySelectPreset.value = presetFilterRarity;

        let charactersToDisplayForPreset = [...ownedCharacters];

        if (presetSearchName) {
            charactersToDisplayForPreset = charactersToDisplayForPreset.filter(char => (char.name || "").toLowerCase().includes(presetSearchName));
        }
        if (presetFilterRarity !== "all") {
            charactersToDisplayForPreset = charactersToDisplayForPreset.filter(char => char.rarity === presetFilterRarity);
        }

        const sortedCharacters = charactersToDisplayForPreset.sort((a, b) => {
            if (presetSortCriteria === "power") return (b.power || 0) - (a.power || 0);
            if (presetSortCriteria === "rarity") return (rarityOrder[b.rarity] ?? -1) - (rarityOrder[a.rarity] ?? -1);
            if (presetSortCriteria === "level") return (b.level || 0) - (a.level || 0);
            if (presetSortCriteria === "name") return (a.name || "").localeCompare(b.name || "");
            return 0;
        });

        const selectedPresetCharacterNames = new Set();
        selectedPresetCharacters.forEach(idx => {
            if (ownedCharacters[idx]) selectedPresetCharacterNames.add(ownedCharacters[idx].name);
        });
        
        if (sortedCharacters.length === 0) {
            presetSelectionList.innerHTML = `<p class="text-white col-span-full text-center">Aucun personnage ne correspond à vos filtres.</p>`;
        } else {
            const fragment = document.createDocumentFragment();
            sortedCharacters.forEach((char) => {
                const originalIndex = ownedCharacters.findIndex(c => c.id === char.id);
                if (originalIndex === -1) return;

                const charElement = document.createElement("div");
                let isCurrentlySelectedInPreset = selectedPresetCharacters.has(originalIndex);
                let isSelectableForPreset = true;
                let additionalClassesPreset = [];

                if (!isCurrentlySelectedInPreset && selectedPresetCharacters.size < currentFunctionalMaxPresetTeamSize) {
                    if (selectedPresetCharacterNames.has(char.name)) {
                        isSelectableForPreset = false;
                        additionalClassesPreset.push("non-selectable-for-battle");
                    }
                } else if (!isCurrentlySelectedInPreset && selectedPresetCharacters.size >= currentFunctionalMaxPresetTeamSize) {
                    isSelectableForPreset = false;
                    additionalClassesPreset.push("opacity-50");
                }

                let rarityTextClass = char.color;
                if (char.rarity === "Mythic") rarityTextClass = "rainbow-text";
                else if (char.rarity === "Secret") rarityTextClass = "text-secret";
                else if (char.rarity === "Vanguard") rarityTextClass = "text-vanguard";

                charElement.className = `bg-gray-800 bg-opacity-50 p-4 rounded-lg transition transform hover:scale-105 cursor-pointer border-2 ${getRarityBorderClass(char.rarity)} ${isCurrentlySelectedInPreset ? 'selected-for-battle' : ''} ${additionalClassesPreset.join(' ')}`;

                const img = document.createElement('img');
                img.src = char.image;
                img.alt = char.name;
                img.className = 'w-full h-32 object-contain rounded mb-2';
                img.loading = 'lazy';
                img.decoding = 'async';
                charElement.appendChild(img);

                const nameP = document.createElement('p');
                nameP.className = `${rarityTextClass} font-semibold`;
                nameP.innerHTML = `${char.name} (<span class="${rarityTextClass}">${char.rarity}</span>, Niv. ${char.level})`;
                charElement.appendChild(nameP);

                const powerP = document.createElement('p');
                powerP.className = 'text-white';
                powerP.textContent = `Puissance: ${char.power}`;
                charElement.appendChild(powerP);

                if (isSelectableForPreset || isCurrentlySelectedInPreset) {
                    charElement.addEventListener("click", () => {
                        selectPresetCharacter(originalIndex);
                    });
                }
                fragment.appendChild(charElement);
            });
            presetSelectionList.appendChild(fragment);
        }
        
        if (presetSelectedCountDisplayElement) {
            presetSelectedCountDisplayElement.textContent = `${selectedPresetCharacters.size}/${currentFunctionalMaxPresetTeamSize}`;
        }
        
        confirmPresetButton.disabled = selectedPresetCharacters.size !== currentFunctionalMaxPresetTeamSize;
        confirmPresetButton.classList.toggle("opacity-50", confirmPresetButton.disabled);
        confirmPresetButton.classList.toggle("cursor-not-allowed", confirmPresetButton.disabled);
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
                <img src="${char.image}" alt="${char.name}" class="w-full h-32 object-cover rounded" loading="lazy" decoding="async">
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
                let baseExpRewardForLevel = levelData.rewards.exp; // Renommé pour clarté

                let actualGemsToAward = baseGemsRewardForLevel;
                let actualExpToAward = baseExpRewardForLevel;
                let actualCoinsToAward = baseCoinsRewardForLevel; // Pour l'instant, les pièces ne sont pas réduites

                let isRewardReduced = false;
                const affectedTypesForReduction = ['legendary', 'challenge', 'material'];

                if (affectedTypesForReduction.includes(levelData.type) && progress.completed) {
                    actualGemsToAward = Math.floor(baseGemsRewardForLevel * 0.5);
                    actualExpToAward = Math.floor(baseExpRewardForLevel * 0.5);
                    // actualCoinsToAward = Math.floor(baseCoinsRewardForLevel * 0.5); // Décommentez si les pièces doivent aussi être réduites
                    isRewardReduced = true;
                }

                // La logique pour les traits (Fortune, Golder) doit s'appliquer aux récompenses DE BASE, avant la réduction pour complétion répétée.
                let fortuneBonusGems = 0, golderBonusGems = 0, golderBonusCoins = 0;
                selectedCharsObjects.forEach(char => {
                    if (char.trait && char.trait.id && char.trait.grade > 0) {
                        const traitDef = TRAIT_DEFINITIONS[char.trait.id];
                        const gradeDef = traitDef.grades.find(g => g.grade === char.trait.grade);
                        if (gradeDef) {
                            // Le bonus de Fortune s'applique UNIQUEMENT aux niveaux d'histoire, donc pas affecté par la nouvelle logique de réduction.
                            if (levelData.type === 'story' && char.trait.id === 'fortune' && typeof gradeDef.gemBonusPercentage === 'number') {
                                fortuneBonusGems += Math.floor(baseGemsRewardForLevel * gradeDef.gemBonusPercentage);
                            }
                            // Le bonus Golder s'applique à tous les modes, sur les récompenses de base.
                            if (char.trait.id === 'golder') {
                                if (typeof gradeDef.gemBonusPercentageAllModes === 'number') {
                                    golderBonusGems += Math.floor(baseGemsRewardForLevel * gradeDef.gemBonusPercentageAllModes);
                                }
                                if (typeof gradeDef.coinBonusPercentageAllModes === 'number') {
                                    golderBonusCoins += Math.floor(baseCoinsRewardForLevel * gradeDef.coinBonusPercentageAllModes);
                                }
                            }
                        }
                    }
                });
                
                // Les bonus des traits sont ajoutés aux récompenses *potentiellement réduites*
                let finalGemsAwarded = actualGemsToAward + fortuneBonusGems + golderBonusGems;
                let finalCoinsAwarded = actualCoinsToAward + golderBonusCoins;

                addGems(finalGemsAwarded);
                coins = Math.min(coins + finalCoinsAwarded, 10000000);
                addExp(actualExpToAward); // L'EXP du joueur est basée sur l'EXP (potentiellement réduite) du niveau
                selectedCharsObjects.forEach(char => addCharacterExp(char, actualExpToAward)); // De même pour l'EXP des personnages

                let rewardMessageParts = [];
                rewardMessageParts.push(`+${finalGemsAwarded} gemmes`);
                if (isRewardReduced && affectedTypesForReduction.includes(levelData.type)) {
                    rewardMessageParts.push('(réduit)');
                }
                if (fortuneBonusGems > 0) rewardMessageParts.push(`(+${fortuneBonusGems} Fortune)`);
                if (golderBonusGems > 0) rewardMessageParts.push(`(+${golderBonusGems} Golder)`);
                
                rewardMessageParts.push(`, +${finalCoinsAwarded} pièces`);
                if (golderBonusCoins > 0) rewardMessageParts.push(`(+${golderBonusCoins} Golder)`);

                rewardMessageParts.push(`, +${actualExpToAward} EXP`);
                 if (isRewardReduced && affectedTypesForReduction.includes(levelData.type)) {
                    rewardMessageParts.push('(réduit)');
                }

                if (itemRewardText) rewardMessageParts.push(`, ${itemRewardText}`);

                battleOutcomeMessage = `<p class="text-green-400 text-2xl font-bold mb-2">Victoire !</p><p class="text-white">Victoire contre ${levelData.enemy.name} !</p><p class="text-white">Récompenses: ${rewardMessageParts.join(' ')}</p>`;

                // La logique de progression des missions et de déblocage des niveaux reste après.
                // L'état `progress.completed` sera mis à jour APRÈS cette attribution.
                missions.forEach(mission => {
                    if (!mission.completed) {
                        if (levelData.type === 'story' && mission.type === 'complete_story_levels') mission.progress++;
                        else if (levelData.type === 'legendary' && mission.type === 'complete_legendary_levels') mission.progress++;
                        else if (levelData.type === 'challenge' && mission.type === 'complete_challenge_levels') mission.progress++;
                        // Ajouter ici une condition pour les missions de type 'material' si elles existent
                    }
                });
                
                // IMPORTANT: Mettre à jour progress.completed APRÈS avoir déterminé les récompenses
                // pour que la PREMIÈRE complétion donne les récompenses complètes.
                if (!progress.completed) {
                    progress.completed = true;
                }

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
            
            let buttonClass = 'bg-purple-600 hover:bg-purple-700';
            if(level.type === 'minigame') {
                buttonClass = 'bg-red-600 hover:bg-red-700 border-2 border-yellow-400';
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
            
            // --- MODIFICATION APPLIQUÉE ICI ---
            levelDiv.innerHTML = `
                <h3 class="text-xl text-white font-bold mb-2">${level.world}</h3>
                <div class="grid gap-2">
                    <button class="level-start-button ${buttonClass} text-white py-2 px-4 rounded-lg transition-colors duration-200 ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}"
                            data-level-id="${level.id}" ${isDisabled ? 'disabled' : ''}>
                        ${buttonText}
                    </button>
                    <div class="text-xs text-gray-300 px-2">
                    <p>Ennemi: ${level.enemy.name} (Vie: ${level.enemy.power.toLocaleString()})</p>
                    <p>Récompenses: ${level.rewards.gems}G, ${level.rewards.coins}P, ${level.rewards.exp}EXP</p>
                    ${itemDropText}
                    </div>
                </div>
            `;
            // --- FIN DE LA MODIFICATION ---
            
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
      if (disableAutoClickerWarningCheckbox) {
          disableAutoClickerWarningCheckbox.checked = disableAutoClickerWarning;
      }
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
      if (disableAutoClickerWarningCheckbox) {
          disableAutoClickerWarning = disableAutoClickerWarningCheckbox.checked;
          localStorage.setItem("disableAutoClickerWarning", disableAutoClickerWarning);
      }
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

    // APRÈS
    async function confirmReset() {
        console.log("Réinitialisation de la partie pour l'utilisateur:", currentUser.uid);
        resetConfirmModal.classList.add("hidden");
        settingsModal.classList.add("hidden"); // NOUVEAU: Ferme la modale des paramètres

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
        disableAutoClickerWarning = false;
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
        
        showTab('play'); // NOUVEAU: Affiche l'onglet "Jouer"

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
        "Haricots": "./images/items/Haricot.webp",
        "Fluide mystérieux": "./images/items/Mysterious_Fluid.webp",
        "Wisteria Flower": "./images/items/Wisteria_Flower.webp",
        "Ramen Bowl": "./images/items/Ramen_Bowl.webp",
        "Ghoul Coffee": "./images/items/Ghoul_Coffee.webp",
        "Soul Candy": "./images/items/Soul_Candy.webp",
        "Cooked Fish": "./images/items/Cooked_Fish.webp",
        "Magical Artifact": "./images/items/Magical_Artifact.webp",
        "Chocolate Bar's": "./images/items/Chocolate_Bar.webp",
        "Curse Talisman": "./images/items/Curse_Talisman.webp",
        "Pièces": "https://via.placeholder.com/150?text=Pièces",
        "Pass XP": "./images/items/Pass_XP.webp",
        "Stat Chip": "./images/items/Stat_Chip.webp",
        "Cursed Token": "./images/items/Cursed_Token.webp",
        "Boost EXP x2": "https://via.placeholder.com/150?text=BoostEXP",
        "Shadow Tracer": "./images/items/Shadow_Tracer.webp",
        "Blood-Red Armor": "./images/items/Blood_Red_Armor.webp",
        "Reroll Token": "./images/items/Trait_Reroll.webp",
        "Divin Wish": "./images/items/Divin_Wish.webp",
        "Hellsing Arms": "./images/items/Hellsing_Arms.webp",
        "Green Essence": "./images/items/Green_Essence.webp",
        "Yellow Essence": "./images/items/Yellow_Essence.webp",    
        "Red Essence": "././images/items/Red_Essence.webp",
        "Blue Essence": "./images/items/Blue_Essence.webp",
        "Pink Essence": "./images/items/Pink_Essence.webp",
        "Rainbow Essence": "./images/items/Rainbow_Essence.webp",
        "Crystal": "./images/items/Crystal.webp",
        "Purple Essence": "./images/items/Purple_Essence.webp",
        "Magic Pendant": "./images/items/Magic_Pendant.webp",
        "Head Captain's Coat": "./images/items/Head_Captain_Coat.webp",
        "Broken Sword": "./images/items/Broken_Sword.webp",
        "Chipped Blade": "./images/items/Chipped_Blade.webp",
        "Cast Blades": "./images/items/Cast_Blades.webp",
        "Hardened Blood": "./images/items/Hardened_Blood.webp",
        "Silverite Sword": "./images/items/Silverite_Sword.webp",
        "Cursed Finger": "./images/items/Cursed_Finger.webp",
        "Magma Stone": "./images/items/Magma_Stone.webp",
        "Magic Stone": "./images/items/Magic_Stone.webp",
        "Broken Pendant": "./images/items/Broken_Pendant.webp",
        "Stone Pendant": "./images/items/Stone_Pendant.webp",
        "Demon Beads": "./images/items/Demon_Beads.webp",
        "Nichirin Cleavers": "./images/items/Nichirin_Cleavers.webp",
        "Tavern Piece": "./images/items/Tavern_Piece.webp",
        "Blue Chakra": "./images/items/Blue_Chakra.webp",
        "Red Chakra": "./images/items/Red_Chakra.webp",
        "Skin Patch": "./images/items/Skin_Patch.webp",
        "Snake Scale": "./images/items/Snake_Scale.webp",
        "Senzu Bean": "./images/items/Senzu_Bean.webp",
        "Holy Corpse Eyes": "././images/items/Holy_Corpse_Eyes.webp",
        "Holy Corpse Arms": "./images/items/Holy_Corpse_Arms.webp",
        "Completed Holy Corpse": "./images/items/Completed_Holy_Corpse.webp",
        "Gorgon's Blindfold": "./images/items/Gorgons_Blindfold.webp",
        "Caster's Headpiece": "./images/items/Casters_Headpiece.webp",
        "Avalon": "./images/items/Avalon.webp",
        "Goddess' Sword": "./images/items/Goddess_Sword.webp",
        "Blade of Death": "./images/items/Blade_of_Death.webp",
        "Berserker's Blade": "./images/items/Berserkers_Blade.webp",
        "Shunpo Spirit": "./images/items/Shunpo_Spirit.webp",
        "Energy Arrow": "./images/items/Energy_Arrow.webp",
        "Hair Ornament": "./images/items/Hair_Ornament.webp",
        "Bucket Hat": "./images/items/Bucket_Hat.webp",
        "Horn of Salvation": "./images/items/Horn_of_Salvation.webp",
        "Energy Bone": "./images/items/Energy_Bone.webp",
        "Prison Chair": "./images/items/Prison_Chair.webp",
        "Rotara Earring 2": "././images/items/Rotara_Earring_2.webp",
        "Rotara Earring 1": "./images/items/Rotara_Earring_1.webp",
        "Z Blade": "./images/items/Z_Blade.webp",
        "Champ's Belt": "./images/items/Champs_Belt.webp",
        "Dog Bone": "./images/items/Dog_Bone.webp",
        "Six Eyes": "./images/items/Six_Eyes.webp",
        "Tome of Wisdom": "./images/items/Tome_of_Wisdom.webp",
        "Corrupted Visor": "./images/items/Corrupted_Visor.webp",
        "Tainted Ribbon": "./images/items/Tainted_Ribbon.webp",
        "Demon Chalice": "./images/items/Demon_Chalice.webp",
        "Essence of the Spirit King": "./images/items/Essence_of_the_Spirit_King.webp",
        "Ring of Friendship": "./images/items/Ring_of_Friendship.webp",
        "Red Jewel": "./images/items/Red_Jewel.webp",
        "Majan Essence": "./images/items/Majan_Essence.webp",
        "Donut": "./images/items/Donut.webp",
        "Atomic Essence": "./images/items/Atomic_Essence.webp",
        "Plume Céleste": "./images/items/Plume_Celeste.webp",
        "Sablier Ancien": "./images/items/Sablier_Ancien.webp",
        "Restricting Headband": "./images/items/Restricting_Headband.webp",
        "Toil Ribbon" : "./images/items/Toil_Ribbon.webp",
    };
    
      let itemsHtmlOutput = "";

      if (expMultiplier > 1 && now < expBoostEndTime) {
        itemsHtmlOutput += `
          <div class="bg-gray-700 bg-opacity-40 p-2 rounded-lg border border-gray-600 flex flex-col items-center justify-around text-center h-full min-h-[140px] sm:min-h-[160px]">
            <img src="${itemImages['Boost EXP x2']}" alt="Boost EXP x2" class="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded mb-1" loading="lazy" decoding="async">
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
            <img src="${itemImages[item] || 'https://via.placeholder.com/150?text=Item'}" alt="${item}" class="w-16 h-16 sm:w-20 sm:h-20 object-contain rounded mb-1" loading="lazy" decoding="async">
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
        gems = Math.min(gems + 100, 1000000000); // Plafond harmonisé pour les gemmes
        coins = Math.min(coins + 20, 10000000);   // Plafond harmonisé pour les pièces
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

    async function animatePull(characters, additionalMessage = '', isAutoMode = false) {
        const delay = isAutoMode ? 50 : 1000; // 50ms en mode auto, 1s sinon

        resultElement.innerHTML = `<p class="text-white">Tirage en cours...</p>`;
        if (animationsEnabled && !isAutoMode) { // Ne pas pulser en mode auto
            resultElement.classList.add("animate-pulse");
        }
        await new Promise(resolve => setTimeout(resolve, delay));

        if (animationsEnabled && !isAutoMode) {
            resultElement.classList.remove("animate-pulse");
        }

        resultElement.innerHTML = `<p class="text-green-400">${additionalMessage}</p>`;
        
        // En mode auto, on ne veut pas attendre pour voir le message "gemmes dépensées"
        if (!isAutoMode) {
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        // Revenir au message initial (géré ailleurs pour ne pas écraser les messages importants)
        // C'est mieux de laisser la fonction appelante gérer le nettoyage de `resultElement`
    }

    async function pullCharacter() {
        console.log("pullCharacter (standard banner) appelé pour un tirage direct");
        currentPullType = "standard";
        const standardPullCost = 100;

        if (pullTickets > 0) {
            // S'il y a des tickets, on les utilise en priorité
            executePull(true); // true signifie "utiliser un ticket"
        } else if (gems >= standardPullCost) {
            // Sinon, s'il y a assez de gemmes, on les utilise
            executePull(false); // false signifie "utiliser des gemmes"
        } else {
            // Sinon, on affiche une erreur car aucune ressource n'est disponible
            resultElement.innerHTML = '<p class="text-red-400">Pas assez de tickets ou de gemmes (100 requis) !</p>';
        }
    }

    async function multiPull(isAutoMode = false) {
        console.log("multiPull (standard banner) appelé, gemmes:", gems, "autosellSettings:", autosellSettings, "isAutoMode:", isAutoMode);
        const cost = 1000;
        const expectedPulls = 10;
        const expGainForMulti = 100;

        if (gems < cost) {
            resultElement.innerHTML = `<p class="text-red-400">Pas assez de gemmes (${cost} requis) !</p>`;
            console.log("Échec du tirage multiple: pas assez de gemmes. Gemmes actuelles:", gems, "Coût:", cost);
            return false;
        }

        gems -= cost;

        missions.forEach(mission => {
            if (mission.type === "spend_gems" && !mission.completed) {
                mission.progress += cost;
            }
        });

        pullCount += expectedPulls;
        const pulledCharsForDisplay = [];
        let autoSoldCharactersInfo = [];
        let hasPulledEpicOrBetter = false;

        let pityMessagePart = "";

        for (let i = 0; i < expectedPulls; i++) {
            let char = getCharacterFromStandardBanner(); 

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

            standardPityCount++;
            let pulledCharIsMythicOrBetterThisIteration = (rarityOrder[char.rarity] >= rarityOrder.Mythic);

            if (standardPityCount >= STANDARD_MYTHIC_PITY_THRESHOLD && !pulledCharIsMythicOrBetterThisIteration) {
                let mythicsInStandard = standardCharacters.filter(c => c.rarity === "Mythic");
                if (mythicsInStandard.length > 0) {
                    char = mythicsInStandard[Math.floor(Math.random() * mythicsInStandard.length)];
                    pityMessagePart += ` Pity (tirage ${i+1})! ${char.name} (Mythic) garanti.`;
                    pulledCharIsMythicOrBetterThisIteration = true;
                    console.log(`Pity (multi standard) tirage ${i+1}: ${char.name} (Mythic) garanti.`);
                } else {
                    console.error("PITY ERROR (multi standard): Aucun Mythic à forcer.");
                }
            }

            if (pulledCharIsMythicOrBetterThisIteration) {
                standardPityCount = 0;
            }
            
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
                pulledCharsForDisplay.push(characterWithId);
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
        }

        checkMissions();
        let message = `${cost} gemmes dépensées.`;
        if (pityMessagePart) {
            message += pityMessagePart;
        }
        if (autoSoldCharactersInfo.length > 0) {
            const totalAutoSellGems = autoSoldCharactersInfo.reduce((sum, charInfo) => sum + charInfo.gems, 0);
            const totalAutoSellCoins = autoSoldCharactersInfo.reduce((sum, charInfo) => sum + charInfo.coins, 0);
            message += ` ${autoSoldCharactersInfo.length} personnage(s) auto-vendu(s) pour +${totalAutoSellGems} gemmes, +${totalAutoSellCoins} pièces.`;
        }

        await animatePull(pulledCharsForDisplay, message, isAutoMode); // MODIFIÉ: On passe isAutoMode
        if (pulledCharsForDisplay.some(c => (c.rarity === "Mythic" || c.rarity === "Secret" || c.rarity === "Vanguard")) && animationsEnabled) {
            confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
        }

        addExp(expGainForMulti);
        updateCharacterDisplay();
        updateIndexDisplay();
        updateUI();
        localStorage.setItem("characterIdCounter", characterIdCounter);
        scheduleSave();
        console.log("multiPull (standard banner) terminé, ownedCharacters:", ownedCharacters.length);
        return true;
    }

    function specialPull() {
        console.log("specialPull appelé pour un tirage direct");
        currentPullType = "special";
        const specialPullCost = 150;

        if (pullTickets > 0) {
            // Priorité aux tickets
            executePull(true);
        } else if (gems >= specialPullCost) {
            // Sinon, on utilise les gemmes
            executePull(false);
        } else {
            // Sinon, erreur
            resultElement.innerHTML = '<p class="text-red-400">Pas assez de tickets ou de gemmes (150 requis) !</p>';
        }
    }

    async function executePull(useTicket, isAutoMode = false) {
        console.log("executePull appelé, useTicket:", useTicket, "currentPullType:", currentPullType, "isAutoMode:", isAutoMode);
        let message = "";
        let autoSold = false;
        let autoSellRewards = { gems: 0, coins: 0 };
        
        let selectedCharacter;
        let gemCost;
        let expGain;

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
            return false;
        }

        if (useTicket) {
            if (pullTickets <= 0) {
                resultElement.innerHTML = '<p class="text-red-400">Pas de tickets disponibles !</p>';
                return false;
            }
            pullTickets--;
            inventory["Pass XP"] = Math.max(0, (inventory["Pass XP"] || 0) - 1); 
            message = "Pass utilisé !";
        } else {
            if (gems < gemCost) {
                resultElement.innerHTML = `<p class="text-red-400">Pas assez de gemmes (${gemCost} requis) !</p>`;
                return false;
            }
            gems -= gemCost;
            missions.forEach(mission => {
                if (mission.type === "spend_gems" && !mission.completed) {
                    mission.progress += gemCost;
                }
            });
            message = `${gemCost} gemmes dépensées.`;
        }

        pullCount++;

        let characterPulledIsPityTargetOrBetter = false;

        if (currentPullType === "standard") {
            standardPityCount++;
            if (rarityOrder[selectedCharacter.rarity] >= rarityOrder.Mythic) {
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
            const isSpecialBannerTargetNaturally = specialCharacters.some(sc => sc.name === selectedCharacter.name && (sc.rarity === "Secret" || sc.rarity === "Vanguard"));
            if (isSpecialBannerTargetNaturally) {
                characterPulledIsPityTargetOrBetter = true;
            }

            if (specialPityCount >= SPECIAL_BANNER_PITY_THRESHOLD && !characterPulledIsPityTargetOrBetter) {
                let secretCharsInSpecial = specialCharacters.filter(c => c.rarity === "Secret");
                if (secretCharsInSpecial.length > 0) {
                    selectedCharacter = secretCharsInSpecial[Math.floor(Math.random() * secretCharsInSpecial.length)];
                    message += ` Pity atteint! ${selectedCharacter.name} (Secret) garanti.`;
                    characterPulledIsPityTargetOrBetter = true;
                    console.log("Pity Spécial (x1) déclenché. Personnage Secret:", selectedCharacter.name);
                } else {
                    console.warn("PITY WARNING (spécial x1): Aucun personnage 'Secret' trouvé dans la bannière spéciale pour la pity. Tirage normal appliqué.");
                    selectedCharacter = getCharacterFromSpecialBanner(specialCharacters);
                    message += ` Pity atteint! ${selectedCharacter.name} (${selectedCharacter.rarity}) garanti (fallback).`;
                    if (selectedCharacter.rarity === "Secret" || selectedCharacter.rarity === "Vanguard") {
                        characterPulledIsPityTargetOrBetter = true;
                    }
                }
            }
            if (characterPulledIsPityTargetOrBetter) {
                specialPityCount = 0;
            }
        }
        
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

        await animatePull(autoSold ? [] : [characterWithId], message, isAutoMode); // MODIFIÉ: On passe isAutoMode
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
        return true;
    }

    async function specialMultiPull(isAutoMode = false) {
        console.log("specialMultiPull appelé, gemmes:", gems, "autosellSettings:", autosellSettings, "isAutoMode:", isAutoMode);
        const cost = 1500;
        const expectedPulls = 10;
        const expGain = 150;

        if (gems < cost) {
            resultElement.innerHTML = '<p class="text-red-400">Pas assez de gemmes (' + cost + ' requis) ! Vous avez ' + gems + '.</p>';
            console.log("Échec du tirage spécial multiple: pas assez de gemmes. Gemmes actuelles:", gems, "Coût:", cost);
            return false;
        }

        gems -= cost;

        missions.forEach(mission => {
            if (mission.type === "spend_gems" && !mission.completed) {
                mission.progress += cost;
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

            specialPityCount++;
            let isSpecialBannerTargetPulledThisIteration = specialCharacters.some(sc => sc.name === char.name && (sc.rarity === "Secret" || sc.rarity === "Vanguard"));

            if (specialPityCount >= SPECIAL_BANNER_PITY_THRESHOLD && !isSpecialBannerTargetPulledThisIteration) {
                let secretCharsInSpecial = specialCharacters.filter(c => c.rarity === "Secret");
                if (secretCharsInSpecial.length > 0) {
                    char = secretCharsInSpecial[Math.floor(Math.random() * secretCharsInSpecial.length)];
                    pityMessagePart += ` Pity (tirage ${i+1})! ${char.name} (Secret) garanti.`;
                    isSpecialBannerTargetPulledThisIteration = true;
                    console.log(`Pity (multi spécial) tirage ${i+1}: ${char.name} (Secret) garanti.`);
                } else {
                    console.warn(`PITY WARNING (multi spécial tirage ${i+1}): Aucun personnage 'Secret' trouvé dans la bannière spéciale pour la pity. Tirage normal appliqué.`);
                    char = getCharacterFromSpecialBanner(specialCharacters);
                    pityMessagePart += ` Pity (tirage ${i+1})! ${char.name} (${char.rarity}) garanti (fallback).`;
                    if (char.rarity === "Secret" || char.rarity === "Vanguard") {
                        isSpecialBannerTargetPulledThisIteration = true;
                    }
                }
            }

            if (isSpecialBannerTargetPulledThisIteration) {
                specialPityCount = 0; 
            }
            
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
        }

        checkMissions();

        let message = `${cost} gemmes dépensées.`;
        if (pityMessagePart) { 
            message += pityMessagePart;
        }
        if (autoSoldCharacters.length > 0) {
            message += ` ${autoSoldCharacters.length} personnage(s) auto-vendu(s) pour +${totalAutoSellGems} gemmes, +${totalAutoSellCoins} pièces.`;
        }
        await animatePull(results, message, isAutoMode); // MODIFIÉ: On passe isAutoMode

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
        return true;
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

    // APRÈS
    function updateCharacterDisplay() {
        if (!ownedCharacters.length && !inventoryFilterName && inventoryFilterRarity === "all" && !inventoryFilterEvolvable && !inventoryFilterLimitBreak && !inventoryFilterCanReceiveExp) {
            characterDisplay.innerHTML = '<p class="text-white col-span-full text-center">Aucun personnage possédé.</p>';
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
            if (sortCriteria === "power") primaryComparison = (b.power || 0) - (a.power || 0);
            else if (sortCriteria === "rarity") primaryComparison = (rarityOrder[b.rarity] ?? -1) - (rarityOrder[a.rarity] ?? -1);
            else if (sortCriteria === "level") primaryComparison = (b.level || 0) - (a.level || 0);
            else if (sortCriteria === "name") primaryComparison = (a.name || "").localeCompare(b.name || "");
            if (primaryComparison !== 0) return primaryComparison;
            return (a.name || "").localeCompare(b.name || "");
        });

        characterDisplay.innerHTML = ''; // Clear existing content first
        const fragment = document.createDocumentFragment(); // Créer un DocumentFragment

        if (!sortedAndFilteredCharacters.length) {
            const p = document.createElement('p');
            p.className = 'text-white col-span-full text-center';
            p.textContent = 'Aucun personnage ne correspond à vos filtres.';
            fragment.appendChild(p);
        } else {
            sortedAndFilteredCharacters.forEach((char) => {
                const cardDiv = document.createElement('div');
                const isSelected = selectedCharacterIndices.has(char.id);
                let rarityTextColorClass = char.color;
                if (char.rarity === "Mythic") rarityTextColorClass = "rainbow-text";
                else if (char.rarity === "Vanguard") rarityTextColorClass = "text-vanguard";
                else if (char.rarity === "Secret") rarityTextColorClass = "text-secret";

                let cardClasses = ['relative', 'p-2', 'rounded-lg', 'border', 'cursor-pointer'];
                
                if (isDeleteMode) {
                    if (char.locked) {
                        cardClasses.push(getRarityBorderClass(char.rarity), 'opacity-50', 'cursor-not-allowed');
                    } else {
                        cardClasses.push(isSelected ? 'selected-character' : getRarityBorderClass(char.rarity));
                    }
                } else {
                    cardClasses.push(getRarityBorderClass(char.rarity));
                }
                cardDiv.className = cardClasses.join(' ');

                cardDiv.addEventListener('click', () => {
                    if (isDeleteMode) {
                        if (!char.locked) {
                            deleteCharacter(char.id);
                        }
                    } else {
                        showCharacterStats(char.id);
                    }
                });

                if (char.locked) {
                    const lockSpan = document.createElement('span');
                    lockSpan.className = 'absolute top-1 right-1 text-xl text-white bg-black bg-opacity-50 rounded p-1';
                    lockSpan.textContent = '🔒';
                    cardDiv.appendChild(lockSpan);
                }

                const img = document.createElement('img');
                img.src = char.image;
                img.alt = char.name;
                img.className = 'w-full h-auto object-contain rounded';
                img.loading = 'lazy';
                img.decoding = 'async';
                cardDiv.appendChild(img);

                const nameP = document.createElement('p');
                nameP.className = 'text-center text-white font-semibold mt-1 text-sm';
                nameP.textContent = char.name;
                cardDiv.appendChild(nameP);

                const rarityP = document.createElement('p');
                rarityP.className = `text-center ${rarityTextColorClass} text-xs`;
                rarityP.textContent = char.rarity;
                cardDiv.appendChild(rarityP);

                const levelP = document.createElement('p');
                levelP.className = 'text-center text-white text-xs';
                levelP.textContent = `Niveau: ${char.level} / ${char.maxLevelCap || 60}`;
                cardDiv.appendChild(levelP);

                if (char.statRank && statRanks[char.statRank]) {
                    const statRankP = document.createElement('p');
                    statRankP.className = 'text-center text-white text-xs';
                    statRankP.innerHTML = `Stat: <span class="${statRanks[char.statRank].color || 'text-white'}">${char.statRank}</span>`;
                    cardDiv.appendChild(statRankP);
                }

                const powerP = document.createElement('p');
                powerP.className = 'text-center text-white text-xs';
                powerP.textContent = `Puissance: ${char.power}`;
                cardDiv.appendChild(powerP);
                
                fragment.appendChild(cardDiv); // Ajouter la carte au fragment
            });
        }
        characterDisplay.appendChild(fragment); // Ajouter le fragment au DOM en une seule fois
    }

    function updateCharacterSelectionDisplay() {
        characterSelectionList.innerHTML = ""; // Clear existing content
        const currentMaxTeamSize = calculateMaxTeamSize();

        const modalTitle = document.getElementById("character-selection-title");
        if (modalTitle) {
            modalTitle.textContent = `Sélectionner ${currentMaxTeamSize} Personnage(s) pour le Combat`;
        }

        const searchNameInput = document.getElementById("battle-search-name");
        const filterRaritySelect = document.getElementById("battle-filter-rarity");
        if (searchNameInput) searchNameInput.value = battleSearchName;
        if (filterRaritySelect) filterRaritySelect.value = battleFilterRarity;

        let charactersToDisplay = [...ownedCharacters];

        if (battleSearchName) {
            charactersToDisplay = charactersToDisplay.filter(char => (char.name || "").toLowerCase().includes(battleSearchName));
        }
        if (battleFilterRarity !== "all") {
            charactersToDisplay = charactersToDisplay.filter(char => char.rarity === battleFilterRarity);
        }

        const sortedCharacters = charactersToDisplay.sort((a, b) => {
            if (battleSortCriteria === "power") return (b.power || 0) - (a.power || 0);
            if (battleSortCriteria === "rarity") return (rarityOrder[b.rarity] ?? -1) - (rarityOrder[a.rarity] ?? -1);
            if (battleSortCriteria === "level") return (b.level || 0) - (a.level || 0);
            if (battleSortCriteria === "name") return (a.name || "").localeCompare(b.name || "");
            return 0;
        });

        const selectedCharacterNames = new Set();
        selectedBattleCharacters.forEach(idx => {
            if (ownedCharacters[idx]) selectedCharacterNames.add(ownedCharacters[idx].name);
        });

        if (sortedCharacters.length === 0) {
            characterSelectionList.innerHTML = `<p class="text-white col-span-full text-center">Aucun personnage ne correspond à vos filtres.</p>`;
        } else {
            const fragment = document.createDocumentFragment();
            sortedCharacters.forEach((char) => {
                const originalIndex = ownedCharacters.findIndex(c => c.id === char.id);
                if (originalIndex === -1) return;

                const charElement = document.createElement("div");
                let isCurrentlySelected = selectedBattleCharacters.has(originalIndex);
                let isSelectable = true;
                let additionalClasses = [];

                if (!isCurrentlySelected && selectedBattleCharacters.size < currentMaxTeamSize) {
                    if (selectedCharacterNames.has(char.name)) {
                        isSelectable = false;
                        additionalClasses.push("non-selectable-for-battle");
                    }
                } else if (!isCurrentlySelected && selectedBattleCharacters.size >= currentMaxTeamSize) {
                    isSelectable = false;
                    additionalClasses.push("opacity-50");
                }

                let rarityTextClass = char.color;
                if (char.rarity === "Mythic") rarityTextClass = "rainbow-text";
                else if (char.rarity === "Secret") rarityTextClass = "text-secret";
                else if (char.rarity === "Vanguard") rarityTextClass = "text-vanguard";

                charElement.className = `bg-gray-800 bg-opacity-50 p-4 rounded-lg transition transform hover:scale-105 cursor-pointer border-2 ${getRarityBorderClass(char.rarity)} ${isCurrentlySelected ? 'selected-for-battle' : ''} ${additionalClasses.join(' ')}`;

                const img = document.createElement('img');
                img.src = char.image;
                img.alt = char.name;
                img.className = 'w-full h-32 object-contain rounded mb-2'; // h-32 for consistency
                img.loading = 'lazy';
                img.decoding = 'async';
                // Already had loading='lazy' and decoding='async' here from a previous similar function.
                // This is just to ensure it's consistent if it was missed.
                charElement.appendChild(img);

                const nameP = document.createElement('p');
                nameP.className = `${rarityTextClass} font-semibold`;
                // Use innerHTML for the span part to keep rainbow/secret text
                nameP.innerHTML = `${char.name} (<span class="${rarityTextClass}">${char.rarity}</span>, Niv. ${char.level})`;
                charElement.appendChild(nameP);

                const powerP = document.createElement('p');
                powerP.className = 'text-white';
                powerP.textContent = `Puissance: ${char.power}`;
                charElement.appendChild(powerP);

                if (isSelectable || isCurrentlySelected) {
                    charElement.addEventListener("click", () => {
                        selectBattleCharacter(originalIndex);
                    });
                }
                fragment.appendChild(charElement);
            });
            characterSelectionList.appendChild(fragment);
        }
        
        selectedCountElement.textContent = `${selectedBattleCharacters.size}/${currentMaxTeamSize}`;
        confirmSelectionButton.disabled = selectedBattleCharacters.size !== currentMaxTeamSize;
        confirmSelectionButton.classList.toggle("opacity-50", confirmSelectionButton.disabled);
        confirmSelectionButton.classList.toggle("cursor-not-allowed", confirmSelectionButton.disabled);
        
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
          <img src="${char.image}" alt="${char.name}" class="w-full h-32 object-cover rounded mb-2" loading="lazy" decoding="async">
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
      disableNoScroll(); // Utilisation de disableNoScroll
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
      disableNoScroll(); // Utilisation de disableNoScroll
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
        "Haricots": "./images/items/Haricot.webp",
        "Fluide mystérieux": "./images/items/Mysterious_Fluid.webp",
        "Wisteria Flower": "./images/vWisteria_Flower.webp",
        "Ramen Bowl": "./images/items/Ramen_Bowl.webp",
        "Ghoul Coffee": "./images/items/Ghoul_Coffee.webp",
        "Soul Candy": "./images/items/Soul_Candy.webp",
        "Cooked Fish": "./images/vCooked_Fish.webp",
        "Magical Artifact": "./images/vMagical_Artifact.webp",
        "Magic Pendant": "./images/items/Magic_Pendant.webp",
        "Crystal": "./images/items/Crystal.webp",
        "Chocolate Bar's": "./images/items/Chocolate_Bar.webp",
        "Curse Talisman": "./images/items/Curse_Talisman.webp",
        "Pièces": "https://via.placeholder.com/150?text=Pièces",
        "Stat Chip": "./images/items/Stat_Chip.webp",
        "Tickets de Tirage": "./images/items/Tickets_de_Tirage.webp",
        "Cursed Token": "https://via.placeholder.com/150?text=Fragments",
        "Shadow Tracer": "./images/items/Shadow_Tracer.webp ",
        "Blood-Red Armor": "./images/vBlood-Red_Armor.webp",
        "Head Captain's Coat": "./images/items/Head_Captain's_Coat.webp",
        "Magic Stone": "./images/items/Magic_Stone.webp",
        "Stone Pendant": "./images/items/Stone_Pendant.webp",
        "Alien Core": "./images/items/Alien_Core.webp",
        "Tavern Piece": "./images/items/Tavern_Piece.webp",
        "Plume Céleste": "./images/items/Plume_Céleste.webp",
        "Sablier Ancien": "./images/items/Sablier_Ancien.webp",
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
        }
        inventory[item] -= quantity;
        itemSummary += effectsApplied.join(', ') + ')';
        summary.push(itemSummary);
      });

      // Appeler addCharacterExp seulement si de l'EXP a été calculée et si nécessaire
      if (totalExpGained > 0) {
         addCharacterExp(char, totalExpGained); // La fonction gère le cap interne
      }
      if (totalPowerGained > 0) {
            char.basePower += totalPowerGained; // MODIFIÉ: Affecte basePower
            recalculateCharacterPower(char);  // MODIFIÉ: Recalculer
        }

      // --- MODIFICATION : Message de résultat plus précis ---
      resultElement.innerHTML = `
        <p class="text-green-400">Objets donnés à ${char.name} (Niv. ${char.level}) !</p>
        ${totalExpGained > 0 ? `<p class="text-white">EXP ajoutée: ${totalExpGained}</p>` : (selectedItemsForGiving.has(item => itemEffects[item]?.exp) && !canGainExp ? `<p class="text-yellow-400">EXP des objets ignorée (Niveau Max atteint).</p>` : '')}
        ${totalPowerGained > 0 ? `<p class="text-white">Puissance augmentée à ${char.power}</p>` : ''}
        <p class="text-white">Objets utilisés: ${summary.join(", ")}</p>
      `;
      // --- FIN MODIFICATION ---

      selectedItemsForGiving.clear();
      giveItemsModal.classList.add("hidden");
      disableNoScroll();
      updateCharacterDisplay();
      updateItemDisplay();
      updateUI();
      scheduleSave();
    }

    function updateLimitBreakTabDisplay() {
      console.log("--- updateLimitBreakTabDisplay ---");

      // Vérification des éléments DOM essentiels
      if (!transcendenceOrbCountElement) {
          console.error("ERREUR: transcendenceOrbCountElement est null! L'élément HTML avec l'ID 'transcendence-orb-count' est manquant ou non chargé.");
          // Vous pourriez afficher un message d'erreur dans l'onglet lui-même si c'est critique
          if (limitBreakElement) limitBreakElement.innerHTML = "<p class='text-red-500'>Erreur: Impossible d'afficher le compteur d'orbes.</p>";
          return;
      }
      if (!limitBreakSelectedCharDisplayElement) {
          console.error("ERREUR: limitBreakSelectedCharDisplayElement est null!");
          return;
      }
      if (!limitBreakCharSelectionGridElement) {
          console.error("ERREUR: limitBreakCharSelectionGridElement est null!");
          return;
      }
      if (!applyLimitBreakButton) {
          console.error("ERREUR: applyLimitBreakButton est null!");
          return;
      }
      if (!inventory) {
          console.error("ERREUR: L'objet inventory n'est pas défini !");
          transcendenceOrbCountElement.textContent = "Erreur";
          return;
      }


      transcendenceOrbCountElement.textContent = inventory["Divin Wish"] || 0;
      const searchInput = document.getElementById("limit-break-char-search"); // Peut être null si l'ID est incorrect ou l'élément n'est pas dans l'onglet
      const searchTerm = searchInput ? searchInput.value.toLowerCase() : "";

      let char = null;
      if (currentLimitBreakCharacterId) {
          char = ownedCharacters.find(c => c.id === currentLimitBreakCharacterId);
      }

      if (char) {
          const currentCharacterMaxLevel = char.maxLevelCap || 60;
          limitBreakSelectedCharDisplayElement.innerHTML = `
              <div class="bg-gray-800 bg-opacity-50 p-3 rounded-lg border-2 ${getRarityBorderClass(char.rarity)} w-full max-w-xs mx-auto">
                  <img src="${char.image}" alt="${char.name}" class="w-full h-28 object-contain rounded mb-1" loading="lazy" decoding="async">
                  <p class="${char.color} font-semibold text-center text-sm">${char.name} (${char.rarity})</p>
                  <p class="text-white text-center text-xs">Niveau: ${char.level} / ${currentCharacterMaxLevel}</p>
                  <p class="text-white text-center text-xs">Puissance: ${char.power}</p>
                  ${currentCharacterMaxLevel >= MAX_POSSIBLE_LEVEL_CAP ? '<p class="text-center text-yellow-400 text-xs font-bold">Cap Max Atteint!</p>' : ''}
              </div>
          `;
      } else {
          limitBreakSelectedCharDisplayElement.innerHTML = '<p class="text-gray-400">Aucun personnage sélectionné.</p>';
      }

      limitBreakCharSelectionGridElement.innerHTML = "";
      const availableCharacters = ownedCharacters.filter(c => c.name.toLowerCase().includes(searchTerm));

      if (availableCharacters.length === 0) {
          limitBreakCharSelectionGridElement.innerHTML = `<p class="text-gray-400 col-span-full">${searchTerm ? 'Aucun personnage trouvé pour "' + searchTerm + '".' : 'Aucun personnage.'}</p>`;
      } else {
          availableCharacters.sort((a, b) => b.power - a.power).forEach(c => {
              const charElement = document.createElement("div");
              const currentMax = c.maxLevelCap || 60;
              const isAtCurrentCap = c.level >= currentMax;
              const canBreakLimit = isAtCurrentCap && currentMax < MAX_POSSIBLE_LEVEL_CAP && (inventory["Divin Wish"] || 0) >= LIMIT_BREAK_COST;

              charElement.className = `bg-gray-800 bg-opacity-50 p-2 rounded-lg transition transform hover:scale-105 cursor-pointer border-2
                  ${currentLimitBreakCharacterId === c.id ? 'border-amber-500' : (getRarityBorderClass(c.rarity) || 'border-gray-600 hover:border-gray-500')}
                  ${!isAtCurrentCap && currentMax < MAX_POSSIBLE_LEVEL_CAP ? 'opacity-60' : ''} 
                  ${currentMax >= MAX_POSSIBLE_LEVEL_CAP ? 'opacity-40' : ''}`;

              charElement.innerHTML = `
                  <img src="${c.image}" alt="${c.name}" class="w-full h-20 object-contain rounded mb-1" loading="lazy" decoding="async">
                  <p class="${c.rarity === 'Secret' ? 'text-secret' : c.color} font-semibold text-xs text-center">${c.name} ${c.locked ? '🔒' : ''}</p>
                  <p class="text-white text-xs text-center">Niv: ${c.level} / ${currentMax}</p>
                  ${currentMax >= MAX_POSSIBLE_LEVEL_CAP ? '<p class="text-yellow-500 text-xs text-center">Cap Ultime Atteint</p>' : (isAtCurrentCap ? (canBreakLimit ? '<p class="text-green-400 text-xs text-center">Prêt pour Limit Break</p>' : '<p class="text-red-400 text-xs text-center">Orbes manquants</p>') : `<p class="text-gray-400 text-xs text-center">Atteindre Niv. ${currentMax}</p>`)}
              `;
              charElement.addEventListener("click", () => selectLimitBreakCharacter(c.id));
              limitBreakCharSelectionGridElement.appendChild(charElement);
          });
      }

      const isCharacterSelected = char !== null;
      const hasOrbs = (inventory["Divin Wish"] || 0) >= LIMIT_BREAK_COST;
      const characterAtCap = isCharacterSelected && char.level >= (char.maxLevelCap || 60);
      const notAtHardCap = isCharacterSelected && (char.maxLevelCap || 60) < MAX_POSSIBLE_LEVEL_CAP;

      applyLimitBreakButton.disabled = !(isCharacterSelected && hasOrbs && characterAtCap && notAtHardCap);
      applyLimitBreakButton.classList.toggle("opacity-50", applyLimitBreakButton.disabled);
      applyLimitBreakButton.classList.toggle("cursor-not-allowed", applyLimitBreakButton.disabled);
      console.log("--- Fin updateLimitBreakTabDisplay ---");
    }

    function selectLimitBreakCharacter(charId) {
        currentLimitBreakCharacterId = (currentLimitBreakCharacterId === charId) ? null : charId;
        updateLimitBreakTabDisplay();
    }

    function applyLimitBreak() {
        if (!currentLimitBreakCharacterId || (inventory["Divin Wish"] || 0) < LIMIT_BREAK_COST) return;
        const charIndex = ownedCharacters.findIndex(c => c.id === currentLimitBreakCharacterId);
        if (charIndex === -1) return;
        const char = ownedCharacters[charIndex];
        if (char.level < (char.maxLevelCap || 60) || (char.maxLevelCap || 60) >= MAX_POSSIBLE_LEVEL_CAP) return;

        inventory["Divin Wish"]--;

        missions.forEach(mission => {
            if (mission.type === "limit_break_char" && !mission.completed) {
                mission.progress++;
            }
        });

        char.maxLevelCap = (char.maxLevelCap || 60) + LIMIT_BREAK_LEVEL_INCREASE;
        
        resultElement.innerHTML = `<p class="text-amber-400">${char.name} a brisé ses limites ! Nouveau cap: ${char.maxLevelCap}.</p>`;
        if (animationsEnabled) confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#F59E0B', '#FBBF24', '#FCD34D'] });
        
        updateLimitBreakTabDisplay();
        updateCharacterDisplay();
        updateItemDisplay();
        updateUI();
        scheduleSave();
    }

    function startEvolution(id) {
        console.log("startEvolution appelé avec id:", id);
        const char = ownedCharacters.find(c => c.id === id);
        if (!char) {
            console.log("Personnage non trouvé pour id:", id);
            resultElement.innerHTML = '<p class="text-red-400">Personnage non trouvé !</p>';
            return;
        }
        if (char.hasEvolved) {
            resultElement.innerHTML = `<p class="text-yellow-400">${char.name} a déjà évolué et ne peut pas évoluer à nouveau.</p>`;
            return;
        }
        const baseChar = allCharacters.find(c => c.name === char.name);
        if (!baseChar.evolutionRequirements || baseChar.evolutionRequirements.length === 0) {
            resultElement.innerHTML = '<p class="text-red-400">Ce personnage ne peut pas évoluer !</p>';
            return;
        }
        currentEvolutionCharacterId = id;
        selectedEvolutionItems.clear();
        statsModal.classList.add("hidden");
        evolutionModal.classList.remove("hidden");
        enableNoScroll();
        updateEvolutionSelectionDisplay();
    }

    function updateEvolutionSelectionDisplay() {
        const char = ownedCharacters.find(c => c.id === currentEvolutionCharacterId);
        if (!char) return;

        const baseChar = allCharacters.find(c => c.name === char.name);
        const requirements = baseChar.evolutionRequirements || [];

        // Afficher les exigences, y compris le coût en pièces
        evolutionRequirementsElement.innerHTML = `
        <p><strong>Exigences pour évoluer ${char.name} (${char.rarity}):</strong></p>
        ${requirements.length > 0 ? `
        <ul class="list-disc pl-5">
            ${requirements.map(req => {
            if (req.item) {
                const available = inventory[req.item] || 0;
                const sufficient = available >= req.quantity;
                return `<li class="${sufficient ? 'text-green-400' : 'text-red-400'}">${req.quantity} ${req.item} (Possédé: ${available})</li>`;
            } else if (req.coins) {
                const sufficient = coins >= req.coins;
                return `<li class="${sufficient ? 'text-green-400' : 'text-red-400'}">${req.coins} Pièces (Possédé: ${coins})</li>`;
            }
            return '';
            }).join('')}
        </ul>
        ` : '<p class="text-white">Aucune exigence d\'évolution pour ce personnage.</p>'}
        `;

        evolutionSelectionList.innerHTML = "";
        const itemImages = {
        "Haricots": "./images/items/Haricots.webp",
        "Fluide mystérieux": "./images/items/Mysterious_Fluid.webp",
        "Pièces": "./images/items/Gold.webp",
        "Tickets de Tirage": "./images/items/Tickets_de_Tirage.webp",
        "Cursed Token": "./images/items/Cursed_Token.webp",
        "Shadow Tracer": "./images/items/Shadow_Tracer.webp",
        "Blood-Red Armor": "./images/items/Blood-Red_Armor.webp",
        "Green Essence": "./images/items/Green_Essence.webp",
        "Yellow Essence": "./images/items/Yellow_Essence.webp",
        "Purple Essence": "./images/items/Purple_Essence.webp",
        "Red Essence": "./images/items/Red_Essence.webp",
        "Blue Essence": "./images/items/Blue_Essence.webp",
        "Pink Essence": "./images/items/Pink_Essence.webp",
        "Rainbow Essence": "./images/items/Rainbow_Essence.webp",
        "Head Captain's Coat": "./images/items/Head_Captain's_Coat.webp",
        "Broken Sword": "./images/items/Broken_Sword.webp",
        "Chipped Blade": "./images/items/Chipped_Blade.webp",
        "Cast Blades": "./images/items/Cast_Blades.webp",
        "Hellsing Arms": "./images/items/Hellsing_Arms.webp",
        "Hardened Blood": "./images/items/Hardened_Blood.webp",
        "Silverite Sword": "./images/items/Silverite_Sword.webp",
        "Cursed Finger": "./images/items/Cursed_Finger.webp",
        "Magma Stone": "./images/items/Magma_Stone.webp",
        "Broken Pendant": "./images/items/Broken_Pendant.webp",
        "Demon Beads": "./images/items/Demon_Beads.webp",
        "Broken Heart": "./images/items/Broken_Heart.webp",
        "Nichirin Cleavers": "./images/items/Nichirin_Cleavers.webp",
        "Blue Chakra": "./images/items/Blue_Chakra.webp",
        "Red Chakra": "./images/items/Red_Chakra.webp",
        "Skin Patch": "./images/items/Skin_Patch.webp",
        "Snake Scale": "./images/items/Snake_Scale.webp",
        "Senzu Bean": "./images/items/Senzu_Bean.webp",
        "Holy Corpse Eyes": "./images/items/Holy_Corpse_Eyes.webp",
        "Holy Corpse Arms": "./images/items/Holy_Corpse_Arms.webp",
        "Completed Holy Corpse": "./images/items/Completed_Holy_Corpse.webp",
        "Gorgon's Blindfold": "./images/items/Gorgons_Blindfold.webp",
        "Caster's Headpiece": "./images/items/Casters_Headpiece.webp",
        "Avalon": "./images/items/Avalon.webp",
        "Goddess' Sword": "./images/items/Goddess_Sword.webp",
        "Blade of Death": "./images/items/Blade_of_Death.webp",
        "Berserker's Blade": "./images/items/Berserkers_Blade.webp",
        "Shunpo Spirit": "./images/items/Shunpo_Spirit.webp",
        "Energy Arrow": "./images/items/Energy_Arrow.webp",
        "Hair Ornament": "./images/items/Hair_Ornament.webp",
        "Bucket Hat": "./images/items/Bucket_Hat.webp",
        "Horn of Salvation": "./images/items/Horn_of_Salvation.webp",
        "Energy Bone": "./images/items/Energy_Bone.webp",
        "Prison Chair": "./images/items/Prison_Chair.webp",
        "Rotara Earring 2": "./images/items/Rotara_Earring_2.webp",
        "Rotara Earring 1": "./images/items/Rotara_Earring_1.webp",
        "Z Blade": "./images/items/Z_Blade.webp",
        "Champ's Belt": "./images/items/Champs_Belt.webp",
        "Dog Bone": "./images/items/Dog_Bone.webp",
        "Six Eyes": "./images/items/Six_Eyes.webp",
        "Tome of Wisdom": "./images/items/Tome_of_Wisdom.webp",
        "Corrupted Visor": "./images/items/Corrupted_Visor.webp",
        "Tainted Ribbon": "./images/items/Tainted_Ribbon.webp",
        "Demon Chalice": "./images/items/Demon_Chalice.webp",
        "Essence of the Spirit King": "./images/items/Essence_of_the_Spirit_King.webp",
        "Ring of Friendship": "./images/items/Ring_of_Friendship.webp",
        "Red Jewel": "././images/items/Red_Jewel.webp",
        "Majan Essence": "./images/items/Majan_Essence.webp",
        "Donut": "./images/items/Donut.webp",
        "Atomic Essence": "./images/items/Atomic_Essence.webp",
        "Restricting Headband": "./images/items/Restricting_Headband.webp",
        "Toil Ribbon" : "./images/items/Toil_Ribbon.webp",
        };
      
        requirements.forEach(req => {
        if (!req.item) return; // Ignorer les exigences de pièces pour la sélection d'objets
        const item = req.item;
        const quantity = req.quantity;
        const availableQuantity = inventory[item] || 0;
        const selectedQuantity = selectedEvolutionItems.get(item) || 0;
        const itemElement = document.createElement("div");
        itemElement.className = `bg-gray-800 bg-opacity-50 p-4 rounded-lg transition transform hover:scale-105 cursor-pointer border-2 border-gray-400 ${
            selectedQuantity > 0 ? 'selected-for-evolution' : ''
        }`;
        itemElement.innerHTML = `
            <img src="${itemImages[item]}" alt="${item}" class="w-full h-24 object-contain rounded mb-1" loading="lazy" decoding="async">
            <p class="text-white font-semibold">${item}</p>
            <p class="text-white">Requis: ${quantity}</p>
            <p class="text-white">Disponible: ${availableQuantity}</p>
            <p class="text-white">Sélectionné: ${selectedQuantity}</p>
            <div class="flex gap-2 mt-2">
            <button class="bg-blue-500 hover:bg-blue-600 text-white py-1 px-2 rounded-lg decrease-evolution-item" data-item="${item}">-</button>
            <button class="bg-blue-500 hover:bg-blue-600 text-white py-1 px-2 rounded-lg increase-evolution-item" data-item="${item}">+</button>
            </div>
        `;
        evolutionSelectionList.appendChild(itemElement);
        });

        // Vérifier si toutes les exigences sont satisfaites, y compris les pièces
        const canEvolve = requirements.every(req => {
        if (req.item) {
            return (selectedEvolutionItems.get(req.item) || 0) >= req.quantity;
        } else if (req.coins) {
            return coins >= req.coins;
        }
        return true;
        });
        evolutionSelectedCountElement.textContent = Array.from(selectedEvolutionItems.values()).reduce((sum, qty) => sum + qty, 0);
        confirmEvolutionButton.disabled = !canEvolve;
        confirmEvolutionButton.classList.toggle("opacity-50", !canEvolve);
        confirmEvolutionButton.classList.toggle("cursor-not-allowed", !canEvolve);

        // Attacher les écouteurs pour les boutons +/-
        document.querySelectorAll(".increase-evolution-item").forEach(button => {
        button.addEventListener("click", () => {
            const item = button.dataset.item;
            selectEvolutionItem(item, 1);
        });
        });
        document.querySelectorAll(".decrease-evolution-item").forEach(button => {
        button.addEventListener("click", () => {
            const item = button.dataset.item;
            selectEvolutionItem(item, -1);
        });
        });
    }

    function selectEvolutionItem(item, change) {
        const char = ownedCharacters.find(c => c.id === currentEvolutionCharacterId);
        if (!char) return;
        const baseChar = allCharacters.find(c => c.name === char.name);
        const requirements = baseChar.evolutionRequirements || [];
        const req = requirements.find(r => r.item === item);
        if (!req) return;
        const currentQuantity = selectedEvolutionItems.get(item) || 0;
        const availableQuantity = inventory[item] || 0;
        const maxQuantity = req.quantity;
        const newQuantity = Math.max(0, Math.min(currentQuantity + change, Math.min(availableQuantity, maxQuantity)));
        if (newQuantity === 0) {
            selectedEvolutionItems.delete(item);
        } else {
            selectedEvolutionItems.set(item, newQuantity);
        }
        updateEvolutionSelectionDisplay();
    }

    function cancelEvolution() {
      console.log("cancelEvolution appelé");
      selectedEvolutionItems.clear();
      evolutionModal.classList.add("hidden");
      disableNoScroll();
      updateEvolutionDisplay();
    }

    function confirmEvolution() {
      const charIndex = ownedCharacters.findIndex(c => c.id === currentEvolutionCharacterId);
      if (charIndex === -1) {
          resultElement.innerHTML = '<p class="text-red-400">Personnage non trouvé !</p>';
          evolutionModal.classList.add("hidden");
          disableNoScroll();
          return;
      }
      const char = ownedCharacters[charIndex]; // Obtenir la référence directe à l'objet

      const baseCharDefinition = allCharacters.find(c => c.name === (char.originalName || char.name));
      if (!baseCharDefinition) {
          resultElement.innerHTML = '<p class="text-red-400">Erreur de configuration du personnage de base !</p>';
          evolutionModal.classList.add("hidden");
          disableNoScroll();
          return;
      }

      const requirements = baseCharDefinition.evolutionRequirements || [];
      const canEvolve = requirements.every(req => {
          if (req.item) {
              return (selectedEvolutionItems.get(req.item) || 0) >= req.quantity;
          } else if (req.coins) {
              return coins >= req.coins;
          }
          return true; // Pour des exigences futures qui ne sont ni item ni coins
      });

      if (!canEvolve) {
          resultElement.innerHTML = '<p class="text-red-400">Exigences d\'évolution non satisfaites !</p>';
          // Garder la modale ouverte pour que l'utilisateur voie ce qui manque
          return;
      }
      if (char.hasEvolved) {
          resultElement.innerHTML = `<p class="text-yellow-400">${char.name} a déjà évolué.</p>`;
          evolutionModal.classList.add("hidden");
          disableNoScroll();
          return;
      }

      const evolutionData = baseCharDefinition.evolutionData;
      let evolutionMessageParts = [];

      if (evolutionData) {
          // Stocker le nom original seulement si ce n'est pas déjà fait ET si le nom va effectivement changer
          if (!char.originalName && evolutionData.newName && evolutionData.newName !== char.name) {
              char.originalName = char.name;
          }

          if (evolutionData.newName) {
              char.name = evolutionData.newName;
              evolutionMessageParts.push(`nommé ${char.name}`);
          }
          if (evolutionData.newImage) {
              char.image = evolutionData.newImage;
          }
          if (typeof evolutionData.basePowerIncrease === 'number') {
              char.basePower = (char.basePower || 0) + evolutionData.basePowerIncrease;
              evolutionMessageParts.push(`puissance de base augmentée de ${evolutionData.basePowerIncrease}`);
          }
          if (evolutionData.newRarity) {
              char.rarity = evolutionData.newRarity;
              // S'assurer que la couleur est bien celle de la NOUVELLE rareté
              if (evolutionData.newColor) {
                  char.color = evolutionData.newColor;
              } else {
                  // Fallback si newColor n'est pas spécifié dans evolutionData
                  const rarityColors = { "Rare": "text-gray-400", "Épique": "text-purple-400", "Légendaire": "text-yellow-400", "Mythic": "rainbow-text", "Secret": "text-secret" };
                  char.color = rarityColors[char.rarity] || "text-white";
              }
              evolutionMessageParts.push(`rareté à ${char.rarity}`);
          }

          if (evolutionData.additionalEffects) {
              for (const [effect, value] of Object.entries(evolutionData.additionalEffects)) {
                  if (typeof char[effect] === 'number') {
                      char[effect] = (char[effect] || 0) + value;
                  } else {
                      char[effect] = value;
                  }
                  evolutionMessageParts.push(`${effect} augmenté(e)`);
              }
          }
      } else {
          // Fallback si evolutionData n'existe pas (ne devrait pas arriver si bien configuré)
          const fallbackPowerBonus = 100;
          char.basePower = (char.basePower || 0) + fallbackPowerBonus;
          evolutionMessageParts.push(`puissance augmentée (fallback +${fallbackPowerBonus})`);
          console.warn(`EvolutionData manquant pour ${baseCharDefinition.name}, application d'un bonus de puissance fallback.`);
      }

      char.hasEvolved = true; // Marquer comme évolué

      // AJOUTER CE BLOC POUR LA MISSION
      missions.forEach(mission => {
          if (mission.type === "evolve_char" && !mission.completed) {
              mission.progress++;
          }
      });

      // Recalculer la puissance APRÈS toutes les modifications de basePower, statModifier (si la rareté le change), etc.
      recalculateCharacterPower(char); // Ceci met à jour char.power

      // Déduire les objets et les pièces de l'inventaire
      let coinsUsed = 0;
      selectedEvolutionItems.forEach((quantity, item) => {
          inventory[item] = (inventory[item] || 0) - quantity;
          if (inventory[item] < 0) inventory[item] = 0; // S'assurer de ne pas avoir de quantité négative
      });
      requirements.forEach(req => {
          if (req.coins) {
              coins -= req.coins;
              coinsUsed = req.coins;
          }
      });

      // Construire le message de résultat
      let resultText = `<p class="text-green-400">Évolution réussie pour ${char.name} !</p>`;
      if (evolutionMessageParts.length > 0) {
          resultText += `<p class="text-white">Le personnage a été ${evolutionMessageParts.join(', ')}.</p>`;
      }
      resultText += `<p class="text-white">Nouvelle Puissance totale: ${char.power}</p>`; // Afficher la puissance MISE À JOUR
      resultText += `<p class="text-white">Ressources utilisées: ${[
          ...Array.from(selectedEvolutionItems.entries()).map(([item, qty]) => `${qty} ${item}`),
          coinsUsed > 0 ? `${coinsUsed} Pièces` : ''
      ].filter(Boolean).join(", ")}</p>`;

      resultElement.innerHTML = resultText;

      if (animationsEnabled) {
          confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 }, colors: ['#EC4899', '#DB2777', '#FBCFE8'] });
      }
      if (soundEnabled) { /* Si vous avez un son d'évolution: evolutionSound.play(); */ }

      // Nettoyage et mise à jour de l'UI
      selectedEvolutionItems.clear();
      evolutionModal.classList.add("hidden");
      disableNoScroll();

      updateEvolutionDisplay();   // Pour rafraîchir la liste des persos encore évoluables
      updateCharacterDisplay();   // Pour rafraîchir l'inventaire principal avec le perso évolué
      updateItemDisplay();        // Pour refléter les objets consommés
      updateIndexDisplay();       // Si le nom ou l'image change dans l'index
      updateUI();                 // Pour les stats générales (gemmes, pièces, etc.)
      scheduleSave();             // Sauvegarder toutes les modifications
    }

    function updateEvolutionDisplay() {
      const eligibleCharacters = ownedCharacters.filter(char => {
          // Pour un personnage non évolué, char.name EST son nom de base.
          // La recherche de baseChar devrait donc fonctionner avec char.name.
          const baseChar = allCharacters.find(c => c.name === char.name);

          if (!baseChar) {
              // Si aucune définition de base n'est trouvée pour le nom actuel du personnage,
              // il ne peut pas être considéré pour l'évolution (cela pourrait arriver pour des noms évolués
              // ou des données incohérentes, mais !char.hasEvolved devrait déjà filtrer les noms évolués).
              return false;
          }

          // Le personnage est éligible s'il a des conditions d'évolution
          // ET si CETTE INSTANCE du personnage n'a PAS ENCORE évolué.
          const hasRequirements = baseChar.evolutionRequirements && baseChar.evolutionRequirements.length > 0;
          const notYetEvolved = !char.hasEvolved;

          return hasRequirements && notYetEvolved;
      });

      if (!eligibleCharacters.length) {
          evolutionDisplay.innerHTML = '<p class="text-white">Aucun personnage éligible pour l\'évolution pour le moment.</p>';
          return;
      }

      // Trier les personnages éligibles (votre logique de tri existante)
      const sortedCharacters = eligibleCharacters.sort((a, b) => {
          if (sortCriteria === "power") {
              return b.power - a.power;
          } else if (sortCriteria === "rarity") {
              return rarityOrder[b.rarity] - rarityOrder[a.rarity];
          } else if (sortCriteria === "level") {
              return b.level - a.level;
          }
          return 0;
      });

      evolutionDisplay.innerHTML = sortedCharacters.map(char => {
          // Pour l'affichage, on utilise toujours char.name qui est le nom de base ici,
          // car on a filtré pour n'avoir que les personnages non évolués.
          const baseCharForDisplay = allCharacters.find(c => c.name === char.name);
          const requirements = baseCharForDisplay.evolutionRequirements || []; // S'assurer que requirements existe

          // Vérifier si toutes les exigences matérielles (items + pièces) sont satisfaites
          // Cette vérification est pour l'affichage ("Évolution possible" / "Exigences non satisfaites")
          // La vérification finale se fait dans startEvolution/confirmEvolution.
          let canEvolveDisplayCheck = true; // Supposons que oui initialement
          if (requirements.length > 0) {
              canEvolveDisplayCheck = requirements.every(req => {
                  if (req.item) {
                      return (inventory[req.item] || 0) >= req.quantity;
                  } else if (req.coins) {
                      return coins >= req.coins;
                  }
                  return true; // Pour les exigences futures
              });
          } else {
              canEvolveDisplayCheck = false; // S'il n'y a pas d'requirements, il ne peut pas évoluer par ce biais
          }


          let rarityTextColorClass = char.color;
          if (char.rarity === "Mythic") rarityTextColorClass = "rainbow-text";
          else if (char.rarity === "Secret") rarityTextColorClass = "text-secret";

          return `
          <div class="relative p-2 rounded-lg border ${getRarityBorderClass(char.rarity)} cursor-pointer" 
              onclick="startEvolution('${char.id}')">
              <img src="${char.image}" alt="${char.name}" class="w-full h-32 object-contain rounded" loading="lazy" decoding="async">
              <p class="text-center text-white font-semibold mt-2">${char.name}</p>
              <p class="text-center ${rarityTextColorClass}">${char.rarity}</p>
              <p class="text-center text-white">Niveau: ${char.level}</p>
              <p class="text-center text-white">Puissance: ${char.power}</p>
              <p class="text-center text-sm ${canEvolveDisplayCheck ? 'text-green-400' : 'text-red-400'}">${canEvolveDisplayCheck ? 'Prêt à évoluer' : 'Matériaux manquants'}</p>
          </div>
          `;
      }).join("");
    }

    function toggleLockCharacter(id) {
        const charIndex = ownedCharacters.findIndex(c => c.id === id);
        if (charIndex === -1) return;

        ownedCharacters[charIndex].locked = !ownedCharacters[charIndex].locked; // Inverse l'état locked
        const char = ownedCharacters[charIndex]; // Récupère le personnage mis à jour

        // Mettre à jour le texte et le style du bouton de verrouillage dans la modale
        const lockButton = document.getElementById("lock-button");
        if (lockButton) {
            lockButton.textContent = char.locked ? "Déverrouiller" : "Verrouiller";
            lockButton.disabled = isDeleteMode; // Le bouton lock/unlock lui-même ne doit pas être désactivé par l'état lock
            lockButton.classList.toggle("opacity-50", lockButton.disabled);
            lockButton.classList.toggle("cursor-not-allowed", lockButton.disabled);
            lockButton.classList.toggle("bg-red-500", char.locked);
            lockButton.classList.toggle("hover:bg-red-600", char.locked);
            lockButton.classList.toggle("bg-gray-500", !char.locked);
            lockButton.classList.toggle("hover:bg-gray-600", !char.locked);
        }

        // --- AJOUT : Mettre à jour explicitement l'état des autres boutons ---
        const fuseButton = document.getElementById("fuse-button");
        const evolveButton = document.getElementById("evolve-button"); // Peut exister ou non
        const giveItemsButton = document.getElementById("give-items-button");

        if (fuseButton) {
            fuseButton.disabled = char.level >= 100 || isDeleteMode || ownedCharacters.length <= 1 || char.locked;
            fuseButton.classList.toggle("opacity-50", fuseButton.disabled);
            fuseButton.classList.toggle("cursor-not-allowed", fuseButton.disabled);
        }
        if (evolveButton) {
            evolveButton.disabled = isDeleteMode || char.locked;
            evolveButton.classList.toggle("opacity-50", evolveButton.disabled);
            evolveButton.classList.toggle("cursor-not-allowed", evolveButton.disabled);
        }
        // Donner objets n'est pas affecté par le verrouillage, seulement par le mode suppression
        if (giveItemsButton) {
            giveItemsButton.disabled = isDeleteMode;
            giveItemsButton.classList.toggle("opacity-50", giveItemsButton.disabled);
            giveItemsButton.classList.toggle("cursor-not-allowed", giveItemsButton.disabled);
        }
        // --- FIN DE L'AJOUT ---

        console.log(`Personnage ${char.name} ${char.locked ? 'verrouillé' : 'déverrouillé'}.`);
        updateCharacterDisplay(); // Met à jour l'affichage de l'inventaire pour montrer/cacher l'icône
        scheduleSave(); // Sauvegarde le nouvel état
    }

        function showTab(tabId) {
        if (activeTabId === tabId && !document.getElementById(tabId)?.classList.contains("hidden")) {
             // Si l'onglet demandé est déjà actif et visible, ne rien faire, sauf si c'est un rechargement forcé (non géré ici)
             // ou si l'onglet est "play" ou "inventory" qui ont des sous-onglets à potentiellement réinitialiser.
            if (tabId === "play" && document.getElementById("story")?.classList.contains("hidden")) {
                showSubTab("story"); // Réinitialiser au sous-onglet par défaut si aucun n'est visible
            } else if (tabId === "inventory" && document.getElementById("units")?.classList.contains("hidden")) {
                showSubTab("units"); // Réinitialiser au sous-onglet par défaut
            }
            return; 
        }

        // Cacher l'ancien onglet actif s'il y en a un et qu'il n'est pas le même que le nouveau
        if (activeTabId && activeTabId !== tabId) {
            const oldTab = document.getElementById(activeTabId);
            if (oldTab) {
                oldTab.classList.add("hidden");
            }
        }

        // Retirer la classe spéciale d'arrière-plan du body par défaut
        // (sera réappliquée si l'onglet "curse" est sélectionné et que le thème est sombre)
        document.body.classList.remove("curse-tab-active-bg");

        // Afficher le contenu de l'onglet sélectionné
        const tabToShow = document.getElementById(tabId);
        if (tabToShow) {
            tabToShow.classList.remove("hidden");
        } else {
            console.error(`showTab: Onglet avec ID "${tabId}" non trouvé.`);
            return; // Ne pas continuer si l'onglet n'existe pas
        }

        activeTabId = tabId; // Mettre à jour l'onglet actif

        // Mettre à jour l'apparence des boutons d'onglet
        const allVisibleTabButtons = document.querySelectorAll(".tab-button:not(.hidden)");
        allVisibleTabButtons.forEach(btn => {
            btn.classList.toggle("border-blue-500", btn.dataset.tab === tabId);
            btn.classList.toggle("border-transparent", btn.dataset.tab !== tabId);
        });

        // Logique spécifique à chaque onglet lors de son affichage
        if (tabId === "inventory") {
            showSubTab("units"); // Toujours afficher le sous-onglet par défaut "units"
        } else if (tabId === "play") {
            showSubTab("story"); // Toujours afficher le sous-onglet par défaut "story"
        } else if (tabId === "index") {
            updateIndexDisplay();
        } else if (tabId === "evolution") {
            updateEvolutionDisplay();
        } else if (tabId === "stat-change") {
            updateStatChangeTabDisplay();
        } else if (tabId === "curse") {
            updateCurseTabDisplay();
            if (theme === "dark") {
                document.body.classList.add("curse-tab-active-bg");
            }
        } else if (tabId === "trait") {
            updateTraitTabDisplay();
        } else if (tabId === "limit-break") {
            updateLimitBreakTabDisplay();
        } else {
            // Pour les autres onglets (missions, shop), s'assurer que le mode suppression est désactivé
            if (isDeleteMode) {
                isDeleteMode = false;
                selectedCharacterIndices.clear();
                updateCharacterDisplay(); // Pour enlever le style de sélection des cartes
            }
        }
        updateUI(); // Mettre à jour les éléments généraux de l'UI
    }


    function showSubTab(subtabId) {
        let parentTabId = null;
        let activeSubTabVarName = null; // Nom de la variable globale pour le sous-onglet actif de ce parent
        let currentSubtabButtonsSelector = null;

        // Déterminer l'onglet parent et la variable de sous-onglet actif correspondante
        if (document.getElementById("play")?.contains(document.getElementById(subtabId))) {
            parentTabId = "play";
            activeSubTabVarName = "activePlaySubTabId";
            currentSubtabButtonsSelector = '#play .subtab-button';
        } else if (document.getElementById("inventory")?.contains(document.getElementById(subtabId))) {
            parentTabId = "inventory";
            activeSubTabVarName = "activeInventorySubTabId";
            currentSubtabButtonsSelector = '#inventory .subtab-button';
        } else {
            console.warn(`showSubTab: Impossible de déterminer l'onglet parent pour le sous-onglet ${subtabId}`);
            // Afficher le sous-onglet directement s'il n'appartient pas à un parent connu (comportement de repli)
            const subTabElementDirect = document.getElementById(subtabId);
            if (subTabElementDirect) subTabElementDirect.classList.remove("hidden");
            return;
        }

        let currentActiveSubTabId = window[activeSubTabVarName];

        // Si le sous-onglet demandé est déjà actif et visible, ne rien faire
        if (currentActiveSubTabId === subtabId && !document.getElementById(subtabId)?.classList.contains("hidden")) {
            return;
        }

        // Cacher l'ancien sous-onglet actif (s'il existe et est différent)
        if (currentActiveSubTabId && currentActiveSubTabId !== subtabId) {
            const oldSubTab = document.getElementById(currentActiveSubTabId);
            if (oldSubTab) {
                oldSubTab.classList.add("hidden");
            }
        }

        // Afficher le nouveau sous-onglet
        const subTabElement = document.getElementById(subtabId);
        if (subTabElement) {
            subTabElement.classList.remove("hidden");
            window[activeSubTabVarName] = subtabId; // Mettre à jour la variable globale du sous-onglet actif
        } else {
            console.error(`showSubTab: Sous-onglet avec ID "${subtabId}" non trouvé.`);
            return;
        }

        // Mettre à jour l'apparence des boutons de sous-onglet
        if (currentSubtabButtonsSelector) {
            const subtabButtons = document.querySelectorAll(currentSubtabButtonsSelector);
            subtabButtons.forEach(btn => {
                btn.classList.toggle("border-blue-500", btn.dataset.subtab === subtabId);
                btn.classList.toggle("border-transparent", btn.dataset.subtab !== subtabId);
            });
        }

        // Logique spécifique après l'affichage du sous-onglet
        if (parentTabId === "inventory" && subtabId !== "units") {
            // Si on n'est pas dans le sous-onglet "units" de l'inventaire, désactiver le mode suppression
            if (isDeleteMode) {
                isDeleteMode = false;
                selectedCharacterIndices.clear();
                updateCharacterDisplay(); // Pour rafraîchir l'affichage des cartes
            }
        } else if (parentTabId === "play" && subtabId === "story") {
             updateLevelDisplay();
        } else if (parentTabId === "play" && subtabId === "legende") {
             updateLegendeDisplay();
        } else if (parentTabId === "play" && subtabId === "challenge") {
             updateChallengeDisplay();
        } else if (parentTabId === "play" && subtabId === "materiaux") {
             updateMaterialFarmDisplay();
        } else if (parentTabId === "inventory" && subtabId === "items") {
             updateItemDisplay();
        }
        // updateCharacterDisplay() est appelé dans les fonctions ci-dessus si nécessaire, ou pour désactiver le mode suppression
        updateUI(); // Mise à jour générale de l'UI
    }

    function updateStatChangeTabDisplay() {
        document.getElementById("stat-chip-count").textContent = inventory["Stat Chip"] || 0;
        const selectedCharDisplay = document.getElementById("stat-change-selected-char-display");
        const charSelectionGrid = document.getElementById("stat-change-char-selection-grid");
        const applyButton = document.getElementById("apply-stat-change-button");
        const searchInput = document.getElementById("stat-change-search");
        const searchTerm = searchInput.value.toLowerCase();

        let disableApplyButton = !currentStatChangeCharacterId || (inventory["Stat Chip"] || 0) < 1;
        let char = null;

        clearTimeout(statChangeInfoTimeoutId);
        statChangeInfoTimeoutId = null;

        if (resultElement.innerHTML.includes("Info: Le personnage") || resultElement.innerHTML.includes("Info:")) {
            resultElement.innerHTML = `<p class="text-white text-lg">Tire pour obtenir des personnages légendaires !</p>`;
        }

        if (currentStatChangeCharacterId) {
            char = ownedCharacters.find(c => c.id === currentStatChangeCharacterId);
            if (char) {
                selectedCharDisplay.innerHTML = `
                    <div class="bg-gray-800 bg-opacity-50 p-4 rounded-lg border-2 ${statRanks[char.statRank]?.borderColor || 'border-gray-400'} w-full max-w-xs mx-auto">
                        <img src="${char.image}" alt="${char.name}" class="w-full h-32 object-contain rounded mb-2" loading="lazy" decoding="async">
                        <p class="${char.color} font-semibold text-center">${char.name} (${char.rarity}) ${char.locked ? '🔒' : ''}</p>
                        <p class="text-white text-center">Niv: ${char.level}, P: ${char.power}</p>
                        <p class="text-center font-bold ${statRanks[char.statRank]?.color || 'text-white'}">Stat Actuel: ${char.statRank}</p>
                    </div>
                `;

                const currentRankIsSSS = (char.statRank === "SSS");
                const currentSelectedTargetRanks = Array.from(statTargetRanksSelectionElement.querySelectorAll(".stat-target-rank-checkbox:checked")).map(cb => cb.value);
                
                let infoMsgContent = "";

                if (currentRankIsSSS) {
                    infoMsgContent = `Info: ${char.name} a le rang SSS. "Changer Stat" demandera confirmation.`;
                } else if (statKeepBetterToggle.checked && currentSelectedTargetRanks.length > 0 && currentSelectedTargetRanks.includes(char.statRank)) {
                    infoMsgContent = `Info: ${char.name} a le rang cible coché "${char.statRank}". "Changer Stat" demandera confirmation pour continuer à chercher d'autres cibles (ou le même rang).`;
                }
                // Si aucune des conditions ci-dessus n'est remplie, aucun message d'info spécifique lié à une cible atteinte ou SSS.
                // Le bouton reste actif tant qu'il y a des chips.

                if (infoMsgContent && (inventory["Stat Chip"] || 0) >= 1 && !disableApplyButton) {
                     if (!resultElement.innerHTML.includes("Changement de Stat pour") && 
                         !resultElement.innerHTML.includes("Changement de stat annulé") &&
                         !resultElement.innerHTML.includes("malédiction") && 
                         !resultElement.innerHTML.includes("a été maudit")) {
                        resultElement.innerHTML = `<p class="text-blue-400">${infoMsgContent}</p>`;
                        statChangeInfoTimeoutId = setTimeout(() => {
                            if (resultElement.innerHTML.includes("Info:")) {
                                resultElement.innerHTML = `<p class="text-white text-lg">Tire pour obtenir des personnages légendaires !</p>`;
                            }
                            statChangeInfoTimeoutId = null;
                        }, 7000);
                    }
                }
            } else { // char non trouvé
                selectedCharDisplay.innerHTML = '<p class="text-gray-400">Personnage non trouvé.</p>';
                currentStatChangeCharacterId = null;
                disableApplyButton = true;
            }
        } else { // Aucun perso sélectionné
            selectedCharDisplay.innerHTML = '<p class="text-gray-400">Aucun personnage sélectionné.</p>';
            disableApplyButton = true;
        }

        charSelectionGrid.innerHTML = "";
        const availableCharacters = ownedCharacters
            .filter(c => c.name.toLowerCase().includes(searchTerm));

        if (availableCharacters.length === 0) {
            charSelectionGrid.innerHTML = `<p class="text-gray-400 col-span-full">${searchTerm ? 'Aucun personnage trouvé pour "' + searchTerm + '".' : 'Aucun personnage disponible.'}</p>`;
        } else {
            availableCharacters.sort((a,b) => (statRanks[b.statRank]?.order || 0) - (statRanks[a.statRank]?.order || 0) || b.power - a.power)
            .forEach(c => {
                const charElement = document.createElement("div");
                charElement.className = `bg-gray-800 bg-opacity-50 p-2 rounded-lg transition transform hover:scale-105 cursor-pointer border-2 
                    ${currentStatChangeCharacterId === c.id ? 'border-green-500' : (statRanks[c.statRank]?.borderColor || 'border-gray-600')}
                    hover:border-gray-500`;
                charElement.innerHTML = `
                    <img src="${c.image}" alt="${c.name}" class="w-full h-24 object-contain rounded mb-1" loading="lazy" decoding="async">
                    <p class="${c.rarity === 'Secret' ? 'text-secret' : c.color} font-semibold text-xs text-center">${c.name} ${c.locked ? '🔒' : ''}</p>
                    <p class="text-white text-xs text-center ${statRanks[c.statRank]?.color || 'text-white'}">Stat: ${c.statRank}</p>
                    <p class="text-white text-xs text-center">P: ${c.power}</p>
                `;
                charElement.addEventListener("click", () => {
                  selectStatChangeCharacter(c.id);
                });
                charSelectionGrid.appendChild(charElement);
            });
        }

        // La logique de disableApplyButton est maintenant plus simple:
        // elle est vraie si pas de perso sélectionné ou pas de chips.
        // Les confirmations dans applyStatChange gèrent les cas SSS ou cible cochée.
        applyButton.disabled = disableApplyButton;
        applyButton.classList.toggle("opacity-50", disableApplyButton);
        applyButton.classList.toggle("cursor-not-allowed", disableApplyButton);

        const checkboxesDisabled = !statKeepBetterToggle.checked;
        statTargetRanksSelectionElement.classList.toggle("stat-target-ranks-disabled", checkboxesDisabled);
        statTargetRanksSelectionElement.querySelectorAll(".stat-target-rank-checkbox").forEach(cb => {
            cb.disabled = checkboxesDisabled;
            if (checkboxesDisabled) {
                cb.checked = false; 
            }
        });
    }

    function calculateMaxTeamSize() {
      let baseSize = 3;
      let bonus = 0;
      selectedBattleCharacters.forEach(index => {
          const char = ownedCharacters[index];
          // AJOUT DE LA VÉRIFICATION : s'assurer que char existe ET qu'il a un passif valide
          if (char && char.passive && typeof char.passive.teamSizeBonus === 'number') {
              bonus = Math.max(bonus, char.passive.teamSizeBonus);
          }
      });
      return baseSize + bonus;
    }
    
    function calculateMaxPresetTeamSize() { // NOUVELLE FONCTION
      let baseSize = 3;
      let bonus = 0;
      selectedPresetCharacters.forEach(index => { // Utilise selectedPresetCharacters
          const char = ownedCharacters[index];
          if (char && char.passive && typeof char.passive.teamSizeBonus === 'number') {
              bonus = Math.max(bonus, char.passive.teamSizeBonus);
          }
      });
      return baseSize + bonus;
    }

    function openStatChangeConfirmModal(message, callback) {
        statChangeConfirmMessageElement.textContent = message;
        statChangeConfirmationCallback = callback;
        statChangeConfirmContinueModal.classList.remove("hidden"); // Affiche la modale
        enableNoScroll();
    }

    function closeStatChangeConfirmModal() {
        statChangeConfirmContinueModal.classList.add("hidden");
        statChangeConfirmationCallback = null;
        disableNoScroll();
    }

    function selectStatChangeCharacter(id) {
        currentStatChangeCharacterId = (currentStatChangeCharacterId === id) ? null : id;
        updateStatChangeTabDisplay();
    }

    async function applyStatChange() {
        if (!currentStatChangeCharacterId) {
            resultElement.innerHTML = '<p class="text-red-400">Veuillez sélectionner un personnage.</p>';
            return;
        }
        if ((inventory["Stat Chip"] || 0) < 1) {
            resultElement.innerHTML = '<p class="text-red-400">Vous n\'avez pas de Stat Chips !</p>';
            return;
        }

        const charIndex = ownedCharacters.findIndex(c => c.id === currentStatChangeCharacterId);
        if (charIndex === -1) {
            resultElement.innerHTML = '<p class="text-red-400">Personnage sélectionné non trouvé !</p>';
            currentStatChangeCharacterId = null;
            updateStatChangeTabDisplay();
            return;
        }

        const char = ownedCharacters[charIndex];
        const oldStatRank = char.statRank;
        const selectedTargetRanks = Array.from(statTargetRanksSelectionElement.querySelectorAll(".stat-target-rank-checkbox:checked")).map(cb => cb.value);
        let needsConfirmation = false;
        let confirmMessage = "";

        // Confirmation si SSS
        if (oldStatRank === "SSS") {
            needsConfirmation = true;
            confirmMessage = `Le personnage ${char.name} a déjà le rang de stat exceptionnel "SSS". Si vous continuez, un Stat Chip sera utilisé et un nouveau rang (qui pourrait être inférieur) sera appliqué. Êtes-vous sûr ?`;
        } 
        // Confirmation si le toggle "garder si meilleur" est coché ET que le rang actuel est une des cibles cochées
        else if (statKeepBetterToggle.checked && selectedTargetRanks.length > 0 && selectedTargetRanks.includes(oldStatRank)) {
            needsConfirmation = true;
            confirmMessage = `Le personnage ${char.name} a déjà le rang de stat "${oldStatRank}", qui est l'un de vos rangs cibles cochés. Voulez-vous vraiment utiliser un Stat Chip pour tenter un autre rang ? Le nouveau rang obtenu sera appliqué.`;
        }

        if (needsConfirmation) {
            const userConfirmed = await new Promise(resolve => {
                statChangeConfirmationCallback = (confirmed) => resolve(confirmed);
                openStatChangeConfirmModal(confirmMessage, statChangeConfirmationCallback);
            });
            statChangeConfirmationCallback = null; 

            if (!userConfirmed) {
                resultElement.innerHTML = `<p class="text-blue-400">Changement de stat annulé. Aucun Stat Chip utilisé.</p>`;
                updateStatChangeTabDisplay(); 
                return; 
            }
        }
        
        // S'assurer que le chip est toujours disponible après une confirmation asynchrone
        if ((inventory["Stat Chip"] || 0) < 1) { 
             resultElement.innerHTML = '<p class="text-red-500">Erreur : Plus de Stat Chips disponibles après confirmation.</p>';
             updateStatChangeTabDisplay();
             return;
        }
        
        inventory["Stat Chip"]--;

        missions.forEach(mission => {
            if (mission.type === "change_stat_rank" && !mission.completed) {
                mission.progress++;
            }
        });
        
        const newStatRankKey = getRandomStatRank(); // Obtenir un nouveau rang aléatoire
        
        // Le nouveau rang est TOUJOURS appliqué ici
        char.statRank = newStatRankKey;
        char.statModifier = statRanks[newStatRankKey].modifier;
        recalculateCharacterPower(char);

        let resultMessageContent = `
            <p class="text-green-400">Changement de Stat pour ${char.name} !</p>
            <p class="text-white"><span class="font-semibold">Ancien:</span> ${oldStatRank} -> <span class="font-semibold ${statRanks[newStatRankKey]?.color || ''}">Nouveau:</span> ${newStatRankKey}</p>
            <p class="text-white">Nouvelle Puissance: ${char.power}</p>
        `;

        // Message additionnel si le toggle était coché et le résultat n'est pas une cible
        if (statKeepBetterToggle.checked && !selectedTargetRanks.includes(newStatRankKey) && selectedTargetRanks.length > 0) {
            resultMessageContent += `<p class="text-yellow-300 text-sm">(Le rang obtenu "${newStatRankKey}" n'était pas une cible cochée, mais a été appliqué.)</p>`;
        } else if (statKeepBetterToggle.checked && selectedTargetRanks.includes(newStatRankKey)) {
             resultMessageContent += `<p class="text-green-300 text-sm">(Le rang obtenu "${newStatRankKey}" est une cible cochée !)</p>`;
        }


        resultElement.innerHTML = resultMessageContent + `<p class="text-white">1 Stat Chip utilisé.</p>`;
        
        const newStatRankOrder = statRanks[newStatRankKey]?.order || 0;
        const oldStatRankOrder = statRanks[oldStatRank]?.order || 0;

        if (animationsEnabled && newStatRankOrder > oldStatRankOrder ) {
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#22c55e', '#facc15', '#f97316'] });
        } else if (animationsEnabled && newStatRankOrder < oldStatRankOrder && (oldStatRank === "SSS" || (statKeepBetterToggle.checked && selectedTargetRanks.includes(oldStatRank)) ) ) {
            // Peut-être une petite animation "négative" si on perd un rang SSS ou une cible
            // Pour l'instant, pas d'animation spécifique pour la perte.
        }
        
        if (soundEnabled) { /* play some sound */ }
        
        updateStatChangeTabDisplay(); 
        updateCharacterDisplay();
        updateItemDisplay();
        updateUI();
        scheduleSave();
    }

    function updateMaterialFarmDisplay() {
        const materialLevelListElement = document.getElementById("materiaux-level-list");
        if (!materialLevelListElement) {
            console.error("Élément 'materiaux-level-list' non trouvé !");
            return;
        }

        materialLevelListElement.innerHTML = "";
        materialLevelListElement.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-4";

        if (materialFarmLevels.length === 0) {
            materialLevelListElement.innerHTML = "<p class='text-white col-span-full text-center'>Aucun niveau de farm de matériaux disponible.</p>";
            return;
        }

        const groupedByWorld = materialFarmLevels.reduce((acc, level) => {
            (acc[level.world] = acc[level.world] || []).push(level);
            return acc;
        }, {});

        Object.entries(groupedByWorld).forEach(([worldName, levels]) => {
            const worldColumnDiv = document.createElement('div');
            
            const worldTitle = document.createElement('h3');
            worldTitle.className = 'text-xl text-white font-bold mb-4';
            worldTitle.textContent = `${worldName} - Farm`;
            worldColumnDiv.appendChild(worldTitle);

            const buttonsContainer = document.createElement('div');
            buttonsContainer.className = 'flex flex-col gap-4';
            
            levels.forEach(level => {
                const progress = storyProgress.find(p => p.id === level.id) || { unlocked: true, completed: false };
                const isDisabled = !progress.unlocked;
                const buttonText = level.name;

                const itemDrops = Array.isArray(level.rewards.itemChance) 
                    ? level.rewards.itemChance.map(ic => ic.item).join(', ') 
                    : (level.rewards.itemChance?.item || 'N/A');

                const levelWrapper = document.createElement('div');
                
                // --- MODIFICATION APPLIQUÉE ICI ---
                levelWrapper.innerHTML = `
                    <button class="level-start-button w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg transition-colors duration-200 ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}"
                            data-level-id="${level.id}" ${isDisabled ? 'disabled' : ''}>
                        ${buttonText}
                    </button>
                    <div class="text-xs text-gray-300 px-2 mt-1">
                        <p>Ennemi: ${level.enemy.name} (Puissance: ${level.enemy.power})</p>
                        <p>Drop possible: ${itemDrops}</p>
                    </div>
                `;
                // --- FIN DE LA MODIFICATION ---
                
                buttonsContainer.appendChild(levelWrapper);
            });

            worldColumnDiv.appendChild(buttonsContainer);
            materialLevelListElement.appendChild(worldColumnDiv);
        });
        }

    function updateTraitTabDisplay() {
        traitEssenceCountElement.textContent = inventory["Reroll Token"] || 0;
        const searchInput = document.getElementById("trait-char-search");
        const searchTerm = searchInput.value.toLowerCase();

        let char = null;
        if (currentTraitCharacterId) {
            char = ownedCharacters.find(c => c.id === currentTraitCharacterId);
        }

        // Gérer le message d'info qui pourrait être affiché dans resultElement
        clearTimeout(infoMsgTraitTimeoutId); 
        infoMsgTraitTimeoutId = null;
        let infoMsgContentForDisplay = ""; 

        // Afficher le personnage sélectionné pour l'onglet Traits
        if (char) {
            let currentTraitNameHtml = "Aucun trait actif.";
            let currentTraitDescriptionHtml = "";

            if (char.trait && char.trait.id && char.trait.grade > 0) {
                const traitDef = TRAIT_DEFINITIONS[char.trait.id];
                if (traitDef && traitDef.grades) {
                    const gradeDef = traitDef.grades.find(g => g.grade === char.trait.grade);
                    if (gradeDef) {
                        let traitNameDisplay = traitDef.name;
                        let nameHtmlClass = ""; // Sera utilisé pour le nom du trait
                        let descriptionHtmlClass = "text-xs text-gray-300"; // Classe par défaut

                        if (traitDef.gradeProbabilities && traitDef.gradeProbabilities.length > 0) {
                            traitNameDisplay += ` (Grade ${gradeDef.grade})`;
                        }
                        
                        if (traitDef.id === 'golder' && gradeDef.description === "+15% Gemmes & Pièces (Tous modes)") {
                            nameHtmlClass = 'class="text-gold-brilliant"';
                            descriptionHtmlClass = "text-xs text-gold-brilliant";
                        } else if (traitDef.id === 'monarch') {
                            // Vous pouvez ajouter un style spécial pour Monarch ici si désiré
                            // nameHtmlClass = 'class="text-purple-400 font-bold"'; // Exemple
                        }
                        currentTraitNameHtml = `<span ${nameHtmlClass}>${traitNameDisplay}</span>`;
                        currentTraitDescriptionHtml = `<p class="${descriptionHtmlClass}"><em>${gradeDef.description}</em></p>`;
                    }
                }
            }
            traitSelectedCharacterDisplayElement.innerHTML = `
                <div class="bg-gray-800 bg-opacity-50 p-3 rounded-lg border-2 ${getRarityBorderClass(char.rarity)} w-full max-w-xs mx-auto">
                    <img src="${char.image}" alt="${char.name}" class="w-full h-28 object-contain rounded mb-1" loading="lazy" decoding="async">
                    <p class="${char.color} font-semibold text-center text-sm">${char.name} (${char.rarity})</p>
                    <p class="text-white text-center text-xs">Niv: ${char.level}, P: ${char.power}</p>
                    <p class="text-white text-center text-xs">Trait: ${currentTraitNameHtml}</p>
                    ${currentTraitDescriptionHtml}
                </div>
            `;
            
            // Logique pour le message d'info concernant les traits cibles
            const currentTraitId = char.trait?.id;
            const currentTraitGrade = char.trait?.grade;
            const currentTraitDef = currentTraitId ? TRAIT_DEFINITIONS[currentTraitId] : null;

            if (traitKeepBetterToggle.checked && currentTraitId && currentTraitGrade > 0 && currentTraitDef) {
                const selectedTargetCheckboxes = Array.from(traitTargetSelectionElement.querySelectorAll(".trait-target-checkbox:checked"));
                const selectedTargetValues = selectedTargetCheckboxes.map(cb => cb.value);
                
                let currentTraitValueForCheck = null;
                if (currentTraitDef.gradeProbabilities && currentTraitDef.gradeProbabilities.length > 0) { 
                    currentTraitValueForCheck = `${currentTraitId}_${currentTraitGrade}`;
                } else { 
                    currentTraitValueForCheck = currentTraitId;
                }

                if (selectedTargetValues.includes(currentTraitValueForCheck)) {
                    let traitNameDisplayInfo = currentTraitDef.name;
                    if (currentTraitDef.gradeProbabilities && currentTraitDef.gradeProbabilities.length > 0) {
                        traitNameDisplayInfo += ` G${currentTraitGrade}`;
                    }
                    infoMsgContentForDisplay = `Info: ${char.name} a le trait cible coché "${traitNameDisplayInfo}". "Appliquer Trait" demandera confirmation.`;
                }
            }
        } else { // Aucun personnage sélectionné
            traitSelectedCharacterDisplayElement.innerHTML = '<p class="text-gray-400">Aucun personnage sélectionné.</p>';
        }
        
        // Afficher le message d'info si pertinent et si les conditions le permettent
        if (infoMsgContentForDisplay && (inventory["Reroll Token"] || 0) >= APPLY_NEW_TRAIT_COST && char) {
            // Vérifier que le message actuel n'est pas déjà un message important d'une autre feature
            if (!resultElement.innerHTML.includes("appliqué") && 
                !resultElement.innerHTML.includes("remplacé") && 
                !resultElement.innerHTML.includes("enlevé") &&
                !resultElement.innerHTML.includes("Changement de Stat") &&
                !resultElement.innerHTML.includes("malédiction") &&
                !resultElement.innerHTML.includes("Info: Le personnage")) { // Évite de remplacer un message d'info de curse/stat
               resultElement.innerHTML = `<p class="text-blue-400">${infoMsgContentForDisplay}</p>`;
               infoMsgTraitTimeoutId = setTimeout(() => {
                   if (resultElement.innerHTML.includes(infoMsgContentForDisplay)) { // Vérifie si c'est TOUJOURS ce message
                        resultElement.innerHTML = `<p class="text-white text-lg">Tire pour obtenir des personnages légendaires !</p>`;
                   }
                   infoMsgTraitTimeoutId = null;
               }, 7000);
           }
        } else if (resultElement.innerHTML.startsWith('<p class="text-blue-400">Info: ') && resultElement.innerHTML.includes("trait cible coché")) {
            // Si un message d'info de trait était là et n'est plus pertinent (ex: perso désélectionné)
            if (!infoMsgContentForDisplay && char === null) { // Uniquement si aucun nouveau message d'info et aucun perso
                if (!resultElement.innerHTML.includes("Changement de Stat") && !resultElement.innerHTML.includes("malédiction")) {
                     resultElement.innerHTML = `<p class="text-white text-lg">Tire pour obtenir des personnages légendaires !</p>`;
                }
            }
        }


        // Grille de sélection des personnages
        traitCharacterSelectionGridElement.innerHTML = "";
        const availableCharacters = ownedCharacters.filter(c =>
            c.name.toLowerCase().includes(searchTerm)
        );

        if (availableCharacters.length === 0) {
            traitCharacterSelectionGridElement.innerHTML = `<p class="text-gray-400 col-span-full">${searchTerm ? 'Aucun personnage trouvé pour "' + searchTerm + '".' : 'Aucun personnage disponible.'}</p>`;
        } else {
            availableCharacters.sort((a, b) => b.power - a.power).forEach(c => {
                const charElement = document.createElement("div");
                charElement.className = `bg-gray-800 bg-opacity-50 p-2 rounded-lg transition transform hover:scale-105 cursor-pointer border-2
                    ${currentTraitCharacterId === c.id ? 'selected-for-trait' : (getRarityBorderClass(c.rarity) || 'border-gray-600 hover:border-gray-500')}`;

                let traitDisplayMini = '';
                if (c.trait && c.trait.id && c.trait.grade > 0) {
                    const tDef = TRAIT_DEFINITIONS[c.trait.id];
                    if (tDef) {
                        const gradeDefMini = tDef.grades.find(g => g.grade === c.trait.grade);
                        let traitNameMini = tDef.name;
                        let miniTextColorClass = 'text-emerald-400'; 
                        
                        if (tDef.id === 'golder' && gradeDefMini?.description === "+15% Gemmes & Pièces (Tous modes)") {
                           miniTextColorClass = 'text-gold-brilliant'; 
                        }

                        if (tDef.gradeProbabilities && tDef.gradeProbabilities.length > 0) { 
                            traitDisplayMini = `<p class="text-xs text-center ${miniTextColorClass}">${traitNameMini} G${c.trait.grade}</p>`;
                        } else { 
                            traitDisplayMini = `<p class="text-xs text-center ${miniTextColorClass}">${traitNameMini}</p>`;
                        }
                    }
                }

                charElement.innerHTML = `
                    <img src="${c.image}" alt="${c.name}" class="w-full h-20 object-contain rounded mb-1" loading="lazy" decoding="async">
                    <p class="${c.rarity === 'Secret' ? 'text-secret' : c.color} font-semibold text-xs text-center">${c.name} ${c.locked ? '🔒' : ''}</p>
                    <p class="text-white text-xs text-center">P: ${c.power}</p>
                    ${traitDisplayMini}
                `;
                charElement.addEventListener("click", () => selectTraitCharacter(c.id));
                traitCharacterSelectionGridElement.appendChild(charElement);
            });
        }

        // Activer/désactiver les checkboxes cibles
        const checkboxesDisabledTrait = !traitKeepBetterToggle.checked;
        traitTargetSelectionElement.classList.toggle("trait-target-disabled", checkboxesDisabledTrait);
        traitTargetSelectionElement.querySelectorAll(".trait-target-checkbox").forEach(cb => {
            cb.disabled = checkboxesDisabledTrait;
            if (checkboxesDisabledTrait) {
                cb.checked = false; 
            }
        });
        
        displayTraitActions(char); // Mettre à jour les boutons d'action en fonction du personnage sélectionné
    }

    function populateTargetTraits() {
        traitTargetSelectionElement.innerHTML = "";
        Object.entries(TRAIT_DEFINITIONS)
            .sort(([,a], [,b]) => (a.order || 0) - (b.order || 0)) // Trier par 'order'
            .forEach(([traitId, traitDef]) => {
                if (traitDef.grades && traitDef.grades.length > 0) {
                    const isMultiGrade = traitDef.gradeProbabilities && traitDef.gradeProbabilities.length > 0;

                    if (isMultiGrade) { // Pour les traits multi-grades (Force, Fortune)
                        traitDef.grades.forEach(gradeDef => {
                            const uniqueValue = `${traitId}_${gradeDef.grade}`;
                            const label = document.createElement("label");
                            label.className = `flex items-center p-1.5 rounded hover:bg-gray-600 transition-colors duration-150`;
                            
                            let displayName = traitDef.name;
                            let nameClass = 'text-white';
                            // Actuellement, Golder est mono-grade. Si un trait multi-grade devenait brillant,
                            // une logique similaire à celle des mono-grades serait nécessaire ici.

                            label.innerHTML = `
                                <input type="checkbox" value="${uniqueValue}" class="trait-target-checkbox mr-2 h-4 w-4 text-emerald-400 border-gray-400 rounded focus:ring-transparent">
                                <img src="${traitDef.image || 'https://via.placeholder.com/16?text=T'}" alt="${displayName}" class="w-4 h-4 mr-1 object-contain">
                                <span class="text-xs ${nameClass}">${displayName} G${gradeDef.grade}</span>
                            `;
                            const checkbox = label.querySelector('.trait-target-checkbox');
                            checkbox.addEventListener('change', () => {
                                if (traitKeepBetterToggle.checked) {
                                    updateTraitTabDisplay(); 
                                }
                            });
                            traitTargetSelectionElement.appendChild(label);
                        });
                    } else { // Pour les traits à grade unique
                        const uniqueValue = traitId; 
                        const label = document.createElement("label");
                        label.className = `flex items-center p-1.5 rounded hover:bg-gray-600 transition-colors duration-150`;
                        
                        let displayName = traitDef.name;
                        let nameClass = 'text-white';
                        if (traitDef.id === 'golder' && traitDef.grades[0]?.description === "+15% Gemmes & Pièces (Tous modes)") {
                            nameClass = 'text-gold-brilliant';
                        } else if (traitDef.id === 'monarch') { 
                            // Exemple: si Monarch doit avoir un style spécial
                            // nameClass = 'text-purple-400 font-bold'; // ou une autre classe
                        }


                        label.innerHTML = `
                            <input type="checkbox" value="${uniqueValue}" class="trait-target-checkbox mr-2 h-4 w-4 text-emerald-400 border-gray-400 rounded focus:ring-transparent">
                            <img src="${traitDef.image || 'https://via.placeholder.com/16?text=T'}" alt="${displayName}" class="w-4 h-4 mr-1 object-contain">
                            <span class="text-xs ${nameClass}">${displayName}</span>
                        `;
                        const checkbox = label.querySelector('.trait-target-checkbox');
                        checkbox.addEventListener('change', () => {
                            if (traitKeepBetterToggle.checked) {
                                updateTraitTabDisplay();
                            }
                        });
                        traitTargetSelectionElement.appendChild(label);
                    }
                }
            });
    }

    function openTraitActionConfirmModal(message, callback) {
        traitActionConfirmMessageElement.textContent = message;
        traitConfirmationCallback = callback;
        traitActionConfirmModal.classList.remove("hidden");
        enableNoScroll();
    }

    function closeTraitActionConfirmModal() {
        traitActionConfirmModal.classList.add("hidden");
        traitConfirmationCallback = null;
        disableNoScroll();
    }


    function selectTraitCharacter(charId) {
        currentTraitCharacterId = (currentTraitCharacterId === charId) ? null : charId;
        updateTraitTabDisplay();
    }

    function displayTraitActions(character) {
        const actionsContainer = document.getElementById('trait-actions-container');
        actionsContainer.innerHTML = ""; 

        const actionsTitle = document.createElement('h3');
        actionsTitle.className = "text-lg text-white font-semibold mb-3";
        actionsTitle.textContent = "Actions :";
        actionsContainer.appendChild(actionsTitle);

        const buttonsFlexContainer = document.createElement('div');
        buttonsFlexContainer.className = "flex flex-col md:flex-row md:flex-wrap md:items-center gap-3";
        actionsContainer.appendChild(buttonsFlexContainer);

        const rerollTokenCount = inventory["Reroll Token"] || 0;
        const APPLY_NEW_TRAIT_COST = 1; // Coût pour appliquer/écraser un trait

        const isCharSelected = character !== null;
        // const hasActiveTrait = isCharSelected && character.trait && character.trait.id && character.trait.grade > 0; // Plus nécessaire pour la logique du bouton principal

        // --- Bouton principal : Toujours "Appliquer Trait Aléatoire" ---
        const primaryActionButton = document.createElement('button');
        primaryActionButton.id = "primary-trait-action-button";
        primaryActionButton.className = "font-bold py-2 px-4 rounded-lg transition transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed";
        
        // Le texte du bouton est toujours le même, indique juste le coût
        primaryActionButton.textContent = `Appliquer Trait Aléatoire (${APPLY_NEW_TRAIT_COST} Reroll Token)`;
        primaryActionButton.classList.add("bg-sky-500", "hover:bg-sky-600", "text-white");

        // Désactivé si pas de personnage sélectionné, pas assez de tokens, ou aucun trait défini dans le jeu
        primaryActionButton.disabled = !isCharSelected || rerollTokenCount < APPLY_NEW_TRAIT_COST || Object.keys(TRAIT_DEFINITIONS).length === 0;

        if (!isCharSelected) {
            primaryActionButton.title = "Sélectionnez un personnage";
        } else if (rerollTokenCount < APPLY_NEW_TRAIT_COST) {
            primaryActionButton.title = "Reroll Token insuffisants";
        } else if (Object.keys(TRAIT_DEFINITIONS).length === 0) {
            primaryActionButton.title = "Aucun trait n'est défini dans le jeu";
        }
        
        // L'action est toujours d'essayer d'appliquer un nouveau trait (qui écrasera l'ancien si existant)
        primaryActionButton.addEventListener('click', () => tryRandomTrait()); // On ne passe plus 'true' ou 'false'

        buttonsFlexContainer.appendChild(primaryActionButton);

        // Le bouton "Enlever le Trait" n'est plus créé.
    }

    function getRandomTraitIdByProbability() {
        const traitIds = Object.keys(TRAIT_DEFINITIONS);
        if (traitIds.length === 0) return null;

        let randomNumber = Math.random();
        let cumulativeProbability = 0;

        for (const traitId of traitIds) {
            const traitDef = TRAIT_DEFINITIONS[traitId];
            if (traitDef && typeof traitDef.probability === 'number') {
                cumulativeProbability += traitDef.probability;
                if (randomNumber <= cumulativeProbability) {
                    return traitId;
                }
            } else {
                console.warn(`Trait ${traitId} n'a pas de probabilité définie ou est mal configuré.`);
            }
        }
        // Fallback si la somme des probabilités n'est pas 1 ou en cas d'erreur
        console.warn("Fallback dans getRandomTraitIdByProbability - la somme des probabilités n'est peut-être pas 1 ou une erreur de configuration.");
        return traitIds[Math.floor(Math.random() * traitIds.length)];
    }

    async function tryRandomTrait() {
        if (!currentTraitCharacterId) {
            resultElement.innerHTML = '<p class="text-red-400">Aucun personnage sélectionné.</p>';
            return;
        }
        const charIndex = ownedCharacters.findIndex(c => c.id === currentTraitCharacterId);
        if (charIndex === -1) {
            resultElement.innerHTML = '<p class="text-red-400">Erreur: Personnage non trouvé.</p>';
            return;
        }
        const character = ownedCharacters[charIndex];

        const APPLY_COST = 1; 
        if ((inventory["Reroll Token"] || 0) < APPLY_COST) {
            resultElement.innerHTML = `<p class="text-red-400">Pas assez de Reroll Token (${APPLY_COST} requis).</p>`;
            return;
        }

        let needsConfirmation = false;
        let confirmMessage = "";
        const currentTraitId = character.trait?.id;
        const currentTraitGrade = character.trait?.grade;
        const currentTraitDef = currentTraitId ? TRAIT_DEFINITIONS[currentTraitId] : null;


        if (traitKeepBetterToggle.checked && currentTraitId && currentTraitGrade > 0 && currentTraitDef) {
            const selectedTargetCheckboxes = Array.from(traitTargetSelectionElement.querySelectorAll(".trait-target-checkbox:checked"));
            const selectedTargetValues = selectedTargetCheckboxes.map(cb => cb.value);
            
            let currentTraitValueForCheck = null;
            if (currentTraitDef.gradeProbabilities && currentTraitDef.gradeProbabilities.length > 0) { 
                currentTraitValueForCheck = `${currentTraitId}_${currentTraitGrade}`;
            } else { 
                currentTraitValueForCheck = currentTraitId;
            }

            if (selectedTargetValues.includes(currentTraitValueForCheck)) {
                needsConfirmation = true;
                let traitNameDisplay = currentTraitDef.name;
                if (currentTraitDef.gradeProbabilities && currentTraitDef.gradeProbabilities.length > 0) {
                    traitNameDisplay += ` G${currentTraitGrade}`;
                }
                confirmMessage = `Le personnage ${character.name} a déjà le trait cible "${traitNameDisplay}". Voulez-vous vraiment utiliser un Reroll Token pour tenter un autre trait ? Le nouveau trait obtenu sera appliqué.`;
            }
        }

        if (needsConfirmation) {
            const userConfirmed = await new Promise(resolve => {
                traitConfirmationCallback = (confirmed) => resolve(confirmed);
                openTraitActionConfirmModal(confirmMessage, traitConfirmationCallback); // Utilise la nouvelle modale
            });
            traitConfirmationCallback = null;

            if (!userConfirmed) {
                resultElement.innerHTML = `<p class="text-blue-400">Application de trait annulée. Aucun Reroll Token utilisé.</p>`;
                updateTraitTabDisplay();
                return;
            }
        }
        
        if ((inventory["Reroll Token"] || 0) < APPLY_COST) {
            resultElement.innerHTML = '<p class="text-red-500">Erreur : Plus de Reroll Tokens disponibles après confirmation.</p>';
            updateTraitTabDisplay();
            return;
        }

        inventory["Reroll Token"] -= APPLY_COST;

        missions.forEach(mission => {
            if (mission.type === "apply_trait" && !mission.completed) {
                mission.progress++;
            }
        });

        const randomTraitId = getRandomTraitIdByProbability();
        if (!randomTraitId) {
            resultElement.innerHTML = `<p class="text-yellow-400">Aucun trait n'a pu être tiré.</p>`;
            inventory["Reroll Token"] += APPLY_COST; 
            updateTraitTabDisplay();
            return;
        }

        const newTraitDef = TRAIT_DEFINITIONS[randomTraitId];
        if (!newTraitDef || !newTraitDef.grades || newTraitDef.grades.length === 0) {
            resultElement.innerHTML = `<p class="text-red-500">Erreur de configuration pour le trait ${randomTraitId}.</p>`;
            inventory["Reroll Token"] += APPLY_COST; 
            updateTraitTabDisplay();
            return;
        }

        const chosenGrade = getRandomGradeForTrait(newTraitDef);

        const oldTraitExisted = character.trait && character.trait.id && character.trait.grade > 0;
        const oldTraitName = oldTraitExisted && TRAIT_DEFINITIONS[character.trait.id] ? (TRAIT_DEFINITIONS[character.trait.id].name) : null;
        const oldTraitGrade = oldTraitExisted ? character.trait.grade : null;
        const oldTraitDef = oldTraitExisted && TRAIT_DEFINITIONS[character.trait.id] ? TRAIT_DEFINITIONS[character.trait.id] : null;

        character.trait = { id: randomTraitId, grade: chosenGrade.grade };
        recalculateCharacterPower(character);

        let message = "";
        if (oldTraitExisted && oldTraitName && oldTraitDef) {
            message = `<p class="text-orange-400">Trait ${oldTraitName}${oldTraitDef.gradeProbabilities && oldTraitDef.gradeProbabilities.length > 0 ? ` (Grade ${oldTraitGrade})` : ''} remplacé sur ${character.name}!</p>`;
        } else {
            message = `<p class="text-green-400">Trait aléatoire appliqué à ${character.name}!</p>`;
        }
        message += `<p class="text-white">Nouveau trait: ${newTraitDef.name}${newTraitDef.gradeProbabilities && newTraitDef.gradeProbabilities.length > 0 ? ` (Grade ${chosenGrade.grade})` : ''}.</p>`;
        message += `<p class="text-white">Effet: ${chosenGrade.description}</p>`;
        message += `<p class="text-white">Nouvelle Puissance: ${character.power}. Coût: ${APPLY_COST} Reroll Token.</p>`;
        resultElement.innerHTML = message;

        if (animationsEnabled) confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 }, colors: ['#3B82F6', '#8B5CF6'] });
        
        updateTraitTabDisplay();
        updateCharacterDisplay();
        updateItemDisplay();
        updateUI();
        scheduleSave();
    }

    function upgradeSpecificTrait(traitIdToUpgrade) {
        // Cette fonction est appelée si le personnage a déjà le trait traitIdToUpgrade et qu'il n'est pas au max.
        if (!currentTraitCharacterId) { /* ... error ... */ return; }
        const charIndex = ownedCharacters.findIndex(c => c.id === currentTraitCharacterId);
        if (charIndex === -1) { /* ... error ... */ return; }
        const character = ownedCharacters[charIndex];

        if (!character.trait || character.trait.id !== traitIdToUpgrade || character.trait.level === 0) {
            resultElement.innerHTML = `<p class="text-red-400">Le personnage n'a pas ce trait actif ou une erreur s'est produite.</p>`;
            return;
        }

        const traitDef = TRAIT_DEFINITIONS[traitIdToUpgrade];
        if (!traitDef) { /* ... error ... */ return; }

        const currentLevel = character.trait.level;
        if (currentLevel >= traitDef.maxLevel) {
            resultElement.innerHTML = `<p class="text-yellow-400">${traitDef.name} est déjà au niveau maximum.</p>`;
            return;
        }

        const nextLevelInfo = traitDef.effectsPerLevel.find(e => e.level === currentLevel + 1);
        if (!nextLevelInfo) {
            resultElement.innerHTML = `<p class="text-red-500">Erreur de configuration pour le prochain niveau de ${traitDef.name}.</p>`;
            return;
        }

        if ((inventory["Reroll Token"] || 0) < nextLevelInfo.cost) {
            resultElement.innerHTML = `<p class="text-red-400">Pas assez de Reroll Token (${nextLevelInfo.cost} requis pour améliorer).</p>`;
            return;
        }

        inventory["Reroll Token"] -= nextLevelInfo.cost;
        character.trait.level++; // Incrémenter le niveau du trait existant
        recalculateCharacterPower(character);

        resultElement.innerHTML = `
            <p class="text-green-400">Trait ${traitDef.name} amélioré au Niv. ${character.trait.level} pour ${character.name}!</p>
            <p class="text-white">Effet: ${nextLevelInfo.description}</p>
            <p class="text-white">Nouvelle Puissance: ${character.power}. Coût: ${nextLevelInfo.cost} Essences.</p>
        `;

        if (animationsEnabled) confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 }, colors: ['#10B981', '#6EE7B7'] });

        updateTraitTabDisplay();
        updateCharacterDisplay();
        updateItemDisplay();
        updateUI();
        scheduleSave();
    }

    function rerollTrait() {
        if (!currentTraitCharacterId) {
            resultElement.innerHTML = '<p class="text-red-400">Aucun personnage sélectionné.</p>';
            return;
        }
        const charIndex = ownedCharacters.findIndex(c => c.id === currentTraitCharacterId);
        if (charIndex === -1) {
            resultElement.innerHTML = '<p class="text-red-400">Erreur: Personnage non trouvé.</p>';
            return;
        }
        const character = ownedCharacters[charIndex];

        if (!character.trait || !character.trait.id || character.trait.grade === 0) { // MODIFIÉ: .grade
            resultElement.innerHTML = '<p class="text-yellow-400">Le personnage n\'a pas de trait actif à changer.</p>';
            return;
        }

        const REROLL_TRAIT_COST = 2;
        if ((inventory["Reroll Token"] || 0) < REROLL_TRAIT_COST) {
            resultElement.innerHTML = `<p class="text-red-400">Pas assez de Reroll Token (${REROLL_TRAIT_COST} requis pour changer).</p>`;
            return;
        }

        const currentTraitId = character.trait.id;
        const oldTraitName = TRAIT_DEFINITIONS[currentTraitId]?.name || "Trait Précédent";

        const availableNewTraitIds = Object.keys(TRAIT_DEFINITIONS).filter(id => id !== currentTraitId);

        if (availableNewTraitIds.length === 0 && Object.keys(TRAIT_DEFINITIONS).length <= 1) {
             resultElement.innerHTML = `<p class="text-yellow-400">Aucun autre type de trait disponible pour un changement. (Actuellement ${Object.keys(TRAIT_DEFINITIONS).length} trait(s) défini(s) au total)</p>`;
            return;
        }
        
        let randomNewTraitId;
        if (availableNewTraitIds.length > 0) {
            randomNewTraitId = availableNewTraitIds[Math.floor(Math.random() * availableNewTraitIds.length)];
        } else { // S'il n'y a pas d'AUTRE trait, on re-tire le même type de trait (mais potentiellement un grade différent)
            randomNewTraitId = currentTraitId;
        }


        inventory["Reroll Token"] -= REROLL_TRAIT_COST;
        
        const newTraitDef = TRAIT_DEFINITIONS[randomNewTraitId];
        if (!newTraitDef || !newTraitDef.grades || newTraitDef.grades.length === 0) {
            resultElement.innerHTML = `<p class="text-red-500">Erreur de configuration pour le nouveau trait ${randomNewTraitId}.</p>`;
            inventory["Reroll Token"] += REROLL_TRAIT_COST; // Rembourser
            updateTraitTabDisplay();
            return;
        }

        // Assigner un grade aléatoire (1, 2, ou 3) pour le nouveau trait basé sur ses probabilités
        const chosenGrade = getRandomGradeForTrait(newTraitDef); // MODIFIÉ ICI
        
        character.trait = { id: randomNewTraitId, grade: chosenGrade.grade };
        recalculateCharacterPower(character);

        let message = `<p class="text-green-400">Trait changé aléatoirement pour ${character.name}!</p>`;
        if (randomNewTraitId === currentTraitId) {
            message += `<p class="text-white">Le trait ${oldTraitName} a été re-tiré avec un nouveau Grade ${chosenGrade.grade}.</p>`;
        } else {
            message += `<p class="text-white">Ancien trait (${oldTraitName}) remplacé par ${newTraitDef.name} (Grade ${chosenGrade.grade}).</p>`;
        }
        message += `<p class="text-white">Effet: ${chosenGrade.description}</p>`;
        message += `<p class="text-white">Nouvelle Puissance: ${character.power}. Coût: ${REROLL_TRAIT_COST} Reroll Token.</p>`;
        resultElement.innerHTML = message;

        if (animationsEnabled) confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 }, colors: ['#F97316', '#FDBA74'] });
        
        updateTraitTabDisplay();
        updateCharacterDisplay();
        updateItemDisplay();
        updateUI();
        scheduleSave();
    }


    function removeTrait() {
        if (!currentTraitCharacterId) { /* ... error ... */ return; }
        const charIndex = ownedCharacters.findIndex(c => c.id === currentTraitCharacterId);
        if (charIndex === -1) { /* ... error ... */ return; }
        const character = ownedCharacters[charIndex];

        if (!character.trait || !character.trait.id || character.trait.level === 0) {
            resultElement.innerHTML = `<p class="text-yellow-400">${character.name} n'a pas de trait actif à enlever.</p>`;
            return;
        }
        if ((inventory["Reroll Token"] || 0) < TRAIT_REMOVAL_COST) {
            resultElement.innerHTML = `<p class="text-red-400">Pas assez de Reroll Token pour enlever le trait (${TRAIT_REMOVAL_COST} requis).</p>`;
            return;
        }

        inventory["Reroll Token"] -= TRAIT_REMOVAL_COST;
        const removedTraitName = TRAIT_DEFINITIONS[character.trait.id]?.name || "Trait Inconnu";
        character.trait = { id: null, level: 0 };
        recalculateCharacterPower(character);

        resultElement.innerHTML = `
            <p class="text-orange-400">Le trait ${removedTraitName} a été enlevé de ${character.name}.</p>
            <p class="text-white">Nouvelle Puissance: ${character.power}. Coût: ${TRAIT_REMOVAL_COST} Reroll Token.</p>
        `;

        updateTraitTabDisplay();
        updateCharacterDisplay();
        updateItemDisplay();
        updateUI();
        scheduleSave();
    }

    function updateCurseTabDisplay() {
      cursedTokenCountElement.textContent = inventory["Cursed Token"] || 0;
      const searchInputCurse = document.getElementById("curse-char-search");
      const searchTermCurse = searchInputCurse.value.toLowerCase();

      // Afficher le personnage sélectionné pour la malédiction
      if (currentCurseCharacterId) {
        const char = ownedCharacters.find(c => c.id === currentCurseCharacterId);
        if (char) {
          let selectedCurseInfoHtml = ''; // HTML pour l'info de la malédiction du perso sélectionné
          if (char.curseEffect && char.curseEffect !== 0) {
              const basePowerForSelected = char.basePower * char.statModifier;
              let percentageChangeSelected = 0;
              if (basePowerForSelected !== 0) {
                   percentageChangeSelected = ((char.curseEffect / basePowerForSelected) * 100);
              } else if (char.basePower !== 0) {
                   percentageChangeSelected = ((char.curseEffect / char.basePower) * 100);
              }
              const displayPercentageSelected = percentageChangeSelected.toFixed(percentageChangeSelected % 1 === 0 ? 0 : (Math.abs(percentageChangeSelected) < 1 ? 2 : 1));
              const curseClassSelected = char.curseEffect > 0 ? 'text-green-400' : 'text-red-400';
              const signSelected = char.curseEffect > 0 ? '+' : '';
              selectedCurseInfoHtml = `<p class="text-white text-center">Curse: <span class="${curseClassSelected}">${signSelected}${displayPercentageSelected}%</span></p>`;
          }

          curseSelectedCharacterDisplayElement.innerHTML = `
            <div class="bg-gray-800 bg-opacity-50 p-4 rounded-lg border-2 ${getRarityBorderClass(char.rarity)} w-full max-w-xs mx-auto">
              <img src="${char.image}" alt="${char.name}" class="w-full h-32 object-contain rounded mb-2" loading="lazy" decoding="async">
              <p class="${char.color} font-semibold text-center">${char.name} (<span class="${char.rarity === 'Mythic' ? 'rainbow-text' : ''}">${char.rarity}</span>, Niv. ${char.level})</p>
              <p class="text-white text-center">Puissance: ${char.power}</p>
              ${selectedCurseInfoHtml}
            </div>
          `;
        } else {
          curseSelectedCharacterDisplayElement.innerHTML = '<p class="text-gray-400">Personnage non trouvé.</p>';
          currentCurseCharacterId = null; 
        }
      } else {
        curseSelectedCharacterDisplayElement.innerHTML = '<p class="text-gray-400">Aucun personnage sélectionné.</p>';
      }

      // Remplir la grille de sélection des personnages
      curseCharacterSelectionGridElement.innerHTML = "";
      const availableCharacters = ownedCharacters.filter(char => 
          char.name.toLowerCase().includes(searchTermCurse)
      ); 

      if (availableCharacters.length === 0) {
        curseCharacterSelectionGridElement.innerHTML = `<p class="text-gray-400 col-span-full">${searchTermCurse ? 'Aucun personnage trouvé pour "' + searchTermCurse + '".' : 'Aucun personnage disponible pour la malédiction.'}</p>`;
      } else {
        availableCharacters.sort((a, b) => b.power - a.power).forEach(char => {
          const charElement = document.createElement("div");
          charElement.className = `bg-gray-800 bg-opacity-50 p-2 rounded-lg transition transform hover:scale-105 cursor-pointer border-2 ${
            currentCurseCharacterId === char.id ? 'selected-for-curse' : (getRarityBorderClass(char.rarity) || 'border-gray-600 hover:border-gray-500')
          }`; 
          
          let curseDisplayHtml = '';
            if (char.curseEffect && char.curseEffect !== 0) {
                const basePowerForCurseDisplay = (char.basePower || char.power) * (char.statModifier || 1); // Fallback pour basePower et statModifier
                let cursePercentage = 0;
                if (basePowerForCurseDisplay !== 0) {
                    cursePercentage = (char.curseEffect / basePowerForCurseDisplay) * 100;
                } else if ((char.basePower || char.power) !== 0) { 
                    cursePercentage = (char.curseEffect / (char.basePower || char.power)) * 100;
                }
                const displayCursePercentage = cursePercentage.toFixed(cursePercentage % 1 === 0 ? 0 : (Math.abs(cursePercentage) < 0.1 ? 2 : 1));
                const curseColor = char.curseEffect > 0 ? 'text-green-400' : 'text-red-400';
                const curseSign = char.curseEffect > 0 ? '+' : '';
                curseDisplayHtml = `, <span class="text-xs ${curseColor}">Curse: ${curseSign}${displayCursePercentage}%</span>`;
            }

          charElement.innerHTML = `
            <img src="${char.image}" alt="${char.name}" class="w-full h-24 object-contain rounded mb-1" loading="lazy" decoding="async">
            <p class="${char.rarity === 'Secret' ? 'text-secret' : char.color} font-semibold text-xs text-center">${char.name} ${char.locked ? '🔒' : ''}</p>
            <p class="text-white text-xs text-center">
              <span class="${char.rarity === 'Mythic' ? 'rainbow-text' : (char.rarity === 'Secret' ? 'text-secret' : '')}">${char.rarity}</span>, 
              P: ${char.power}${curseDisplayHtml}
            </p>
          `;
          charElement.addEventListener("click", () => {
            selectCurseCharacter(char.id);
          });
          curseCharacterSelectionGridElement.appendChild(charElement);
        });
      }

      let disableApplyCurseButton = !currentCurseCharacterId || (inventory["Cursed Token"] || 0) < 1;
      
      if (currentCurseCharacterId && curseKeepBetterToggle.checked) {
          const char = ownedCharacters.find(c => c.id === currentCurseCharacterId);
          if (char) {
              const basePowerForCheck = (char.basePower || char.power) * (char.statModifier || 1);
              let currentCurseEffectPercentageForCheck = 0;
              if ((char.curseEffect || 0) !== 0 && basePowerForCheck !== 0) {
                  currentCurseEffectPercentageForCheck = ((char.curseEffect || 0) / basePowerForCheck) * 100;
              }

              const minTargetPercentageCheck = parseFloat(curseMinPercentageInput.value);

              if (currentCurseEffectPercentageForCheck >= minTargetPercentageCheck) {
                  // Le bouton reste actif, mais on informe l'utilisateur.
                  // La pop-up gérera la confirmation avant d'utiliser un token.
                  if ((inventory["Cursed Token"] || 0) >= 1 && resultElement.innerHTML.indexOf("malédiction cible") === -1) {
                      resultElement.innerHTML = `<p class="text-blue-400">Info: Le personnage ${char.name} a déjà un effet de malédiction (${currentCurseEffectPercentageForCheck.toFixed(1)}%) qui atteint ou dépasse votre cible. Utiliser "Apply Curse" demandera confirmation.</p>`;
                      setTimeout(() => {
                          if (resultElement.innerHTML.includes("Info: Le personnage")) {
                              resultElement.innerHTML = `<p class="text-white text-lg">Tire pour obtenir des personnages légendaires !</p>`;
                          }
                      }, 7000);
                  }
              }
          }
      }

      applyCurseButton.disabled = disableApplyCurseButton;
      applyCurseButton.classList.toggle("opacity-50", applyCurseButton.disabled);
      applyCurseButton.classList.toggle("cursor-not-allowed", applyCurseButton.disabled);
      
      curseMinPercentageInput.disabled = !curseKeepBetterToggle.checked;
      if (!curseKeepBetterToggle.checked) {
        curseMinPercentageInput.classList.add("opacity-50", "cursor-not-allowed");
      } else {
        curseMinPercentageInput.classList.remove("opacity-50", "cursor-not-allowed");
      }
    }

    // NOUVELLE FONCTION : selectCurseCharacter
    function selectCurseCharacter(id) {
      if (currentCurseCharacterId === id) { // Déselectionner si on clique sur le même
        currentCurseCharacterId = null;
      } else {
        currentCurseCharacterId = id;
      }
      updateCurseTabDisplay();
    }

    // NOUVELLE FONCTION : applyCurse
    async function applyCurse() {
      if (!currentCurseCharacterId) {
        resultElement.innerHTML = '<p class="text-red-400">Veuillez sélectionner un personnage !</p>';
        return;
      }
      if ((inventory["Cursed Token"] || 0) < 1) {
        resultElement.innerHTML = '<p class="text-red-400">Vous n\'avez pas de Cursed Tokens !</p>';
        return;
      }

      const charIndex = ownedCharacters.findIndex(c => c.id === currentCurseCharacterId);
      if (charIndex === -1) {
        resultElement.innerHTML = '<p class="text-red-400">Personnage sélectionné non trouvé !</p>';
        currentCurseCharacterId = null;
        updateCurseTabDisplay();
        return;
      }

      const char = ownedCharacters[charIndex];
      
      if (typeof char.basePower === 'undefined' || char.basePower <= 0) {
          char.basePower = char.power > (char.curseEffect || 0) ? char.power - (char.curseEffect || 0) : (char.power / (char.statModifier || 1));
          if (char.basePower <= 0) char.basePower = 50; // Ultime fallback
          console.warn(`basePower manquant ou invalide pour ${char.name}, recalculé à ${char.basePower}`);
          recalculateCharacterPower(char); // S'assurer que la puissance est à jour avant de maudire
      }
      if (typeof char.statModifier === 'undefined') {
          char.statModifier = statRanks[char.statRank]?.modifier || 1;
      }


      let needsCurseConfirmation = false;
      let curseConfirmMessage = "";
      const basePowerWithStatForCheck = char.basePower * char.statModifier;
      let currentCurseEffectPercentageForCheck = 0;

      if ((char.curseEffect || 0) !== 0 && basePowerWithStatForCheck !== 0) {
          currentCurseEffectPercentageForCheck = ((char.curseEffect || 0) / basePowerWithStatForCheck) * 100;
      }

      if (curseKeepBetterToggle.checked) {
        const minTargetPercentageCheck = parseFloat(curseMinPercentageInput.value);
        if (currentCurseEffectPercentageForCheck >= minTargetPercentageCheck) {
          needsCurseConfirmation = true;
          curseConfirmMessage = `Le personnage ${char.name} a déjà un effet de malédiction de ${currentCurseEffectPercentageForCheck.toFixed(1)}%, ce qui est supérieur ou égal à votre cible de ${minTargetPercentageCheck}%. Voulez-vous vraiment utiliser un Cursed Token pour tenter d'obtenir un autre effet ? La nouvelle malédiction sera appliquée quel que soit son effet.`;
        }
      }
      
      console.log(`[applyCurse] currentCurseEffectPercentageForCheck: ${currentCurseEffectPercentageForCheck.toFixed(1)}%, curseKeepBetterToggle.checked: ${curseKeepBetterToggle.checked}, needsCurseConfirmation: ${needsCurseConfirmation}`);

      if (needsCurseConfirmation) {
        console.log(`[applyCurse] Ouverture de la modale de confirmation de malédiction avec le message : "${curseConfirmMessage}"`);
        const userConfirmed = await new Promise(resolve => {
          curseConfirmationCallback = (confirmed) => resolve(confirmed);
          openCurseConfirmModal(curseConfirmMessage, curseConfirmationCallback);
        });
        curseConfirmationCallback = null;

        if (!userConfirmed) {
          resultElement.innerHTML = `<p class="text-blue-400">Application de la malédiction annulée. Aucun Cursed Token n'a été utilisé.</p>`;
          updateCurseTabDisplay();
          return; 
        }
      } else {
        console.log(`[applyCurse] Aucune confirmation de malédiction nécessaire.`);
      }
      
      if ((inventory["Cursed Token"] || 0) < 1) { 
           resultElement.innerHTML = '<p class="text-red-500">Erreur : Plus de Cursed Tokens disponibles pour cette tentative.</p>';
           updateCurseTabDisplay();
           return;
      }

      inventory["Cursed Token"]--; 

      missions.forEach(mission => {
          if (mission.type === "curse_char" && !mission.completed) {
              mission.progress++;
          }
      });

      const powerBeforeThisCurse = char.power; 
      // const currentCurseEffectValue = char.curseEffect || 0; // Plus utilisé directement pour la décision d'appliquer

      const basePowerWithStat = char.basePower * char.statModifier;
      // Générer un effet de malédiction entre -20% et +20% de la puissance de base (avant malédiction mais après stat rank)
      const percentageChangeRandom = (Math.random() * 0.40) - 0.20; // De -0.20 à +0.20
      const newPowerDeltaFromCurse = Math.round(basePowerWithStat * percentageChangeRandom);

      let newCurseEffectPercentage = 0;
      if (basePowerWithStat !== 0) {
          newCurseEffectPercentage = (newPowerDeltaFromCurse / basePowerWithStat) * 100;
      } else if (char.basePower !== 0) { // Fallback
          newCurseEffectPercentage = (newPowerDeltaFromCurse / char.basePower) * 100;
      }
      
      // La nouvelle malédiction est TOUJOURS appliquée si on arrive ici
      char.curseEffect = newPowerDeltaFromCurse;
      recalculateCharacterPower(char); 

      const displayPercentageForResult = newCurseEffectPercentage.toFixed(newCurseEffectPercentage % 1 === 0 ? 0 : (Math.abs(newCurseEffectPercentage) < 0.1 ? 2 : 1));
      const signForResult = newPowerDeltaFromCurse >= 0 ? '+' : '';

      resultElement.innerHTML = `
        <p class="text-green-400">${char.name} a été maudit !</p>
        <p class="text-white">Puissance avant cette malédiction: ${powerBeforeThisCurse}.</p>
        <p class="text-white">Effet de la nouvelle malédiction: <span class="${newPowerDeltaFromCurse >= 0 ? 'text-green-400' : 'text-red-400'}">${signForResult}${displayPercentageForResult}%</span>.</p>
        <p class="text-white">Nouvelle Puissance totale: ${char.power}.</p>
        <p class="text-white">1 Cursed Token utilisé.</p>
      `;
      if (animationsEnabled && Math.abs(newPowerDeltaFromCurse) > basePowerWithStat * 0.05) { // Confetti pour les changements notables
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#7F00FF', '#000000', '#DC143C'] });
      }
      
      if (soundEnabled) { /* curseSound.play(); */ } 

      updateCurseTabDisplay();
      updateCharacterDisplay(); 
      updateItemDisplay(); 
      updateUI();
      scheduleSave();
    }

    function openCurseConfirmModal(message, callback) {
        curseConfirmMessageElement.textContent = message;
        curseConfirmationCallback = callback; // Stocker la fonction à appeler après le choix
        curseConfirmContinueModal.classList.remove("hidden");
        enableNoScroll(); // Empêcher le défilement de l'arrière-plan
    }

    function closeCurseConfirmModal() {
        curseConfirmContinueModal.classList.add("hidden");
        curseConfirmationCallback = null; // Réinitialiser le callback
        disableNoScroll(); // Rétablir le défilement
    }

    function launchMiniGame(levelData, selectedTeam) {
        console.log("Lancement du mini-jeu avec le niveau:", levelData.name);

        // 1. Calculer les paramètres du jeu
        miniGameState.levelData = levelData;
        miniGameState.bossMaxHealth = levelData.enemy.power;
        miniGameState.bossCurrentHealth = levelData.enemy.power;
        miniGameState.damagePerClick = selectedTeam.reduce((sum, char) => sum + char.power, 0);
        miniGameState.timer = 30;
        miniGameState.isActive = false;

        // 2. Initialiser l'affichage
        document.getElementById('mini-game-title').textContent = levelData.name;
        document.getElementById('mini-game-boss-name').textContent = levelData.enemy.name;
        
        // NOUVELLE LIGNE : Met à jour dynamiquement l'image du boss
        document.getElementById('mini-game-boss-image').src = levelData.enemy.image || './images/default-boss.png'; // Utilise une image par défaut si non spécifiée

        miniGameTimerEl.textContent = miniGameState.timer;
        miniGameHealthBar.style.width = '100%';
        miniGameHealthText.textContent = `${miniGameState.bossCurrentHealth.toLocaleString()} / ${miniGameState.bossMaxHealth.toLocaleString()}`;

        // 3. Afficher le bon écran et la modale
        miniGameStartScreen.classList.remove('hidden');
        miniGameMainScreen.classList.add('hidden');
        miniGameResultScreen.classList.add('hidden');
        miniGameModal.classList.remove('hidden');
        enableNoScroll();
    }

    function startMiniGame() {
        console.log("Début du timer et du jeu.");
        miniGameState.isActive = true;

        miniGameStartScreen.classList.add('hidden');
        miniGameMainScreen.classList.remove('hidden');

        miniGameState.intervalId = setInterval(() => {
            miniGameState.timer--;
            miniGameTimerEl.textContent = miniGameState.timer;

            if (miniGameState.timer <= 0) {
                endMiniGame(false); // Défaite
            }
        }, 1000);
    }

    function handleBossClick(event) {
        if (!miniGameState.isActive) return;

        // Appliquer les dégâts
        miniGameState.bossCurrentHealth -= miniGameState.damagePerClick;

        // Effet visuel sur le boss
        miniGameBossImage.classList.add('hit');
        setTimeout(() => miniGameBossImage.classList.remove('hit'), 75);

        // Afficher un numéro de dégât flottant (optimisé)
        if (!reusableDamageNumberElement) {
            reusableDamageNumberElement = document.createElement('div');
            reusableDamageNumberElement.className = 'damage-number';
            miniGameDamageContainer.appendChild(reusableDamageNumberElement);
        }
        
        reusableDamageNumberElement.textContent = `-${miniGameState.damagePerClick.toLocaleString()}`;
        const rect = miniGameClickArea.getBoundingClientRect(); // Recalculate rect in case of scroll/resize
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // Reset animation by removing and re-adding the element or class
        reusableDamageNumberElement.style.animation = 'none';
        reusableDamageNumberElement.offsetHeight; // Trigger reflow
        reusableDamageNumberElement.style.animation = ''; 
        reusableDamageNumberElement.style.left = `${x - 20 + (Math.random() * 40 - 20)}px`; // Add some jitter
        reusableDamageNumberElement.style.top = `${y - 30 + (Math.random() * 20 - 10)}px`;
        reusableDamageNumberElement.style.opacity = '1'; // Ensure it's visible

        // Hide after animation (CSS animation should handle fade out)
        // The CSS animation 'damage-popup' has 'forwards', so it will stay at opacity 0.
        // We just need to make sure we can restart it.

        // Mettre à jour la barre de vie
        if (miniGameState.bossCurrentHealth <= 0) {
            miniGameState.bossCurrentHealth = 0;
            updateHealthBar();
            endMiniGame(true); // Victoire
        } else {
            updateHealthBar();
        }
    }

    function updateHealthBar() {
        const healthPercentage = (miniGameState.bossCurrentHealth / miniGameState.bossMaxHealth) * 100;
        miniGameHealthBar.style.width = `${healthPercentage}%`;
        miniGameHealthText.textContent = `${miniGameState.bossCurrentHealth.toLocaleString()} / ${miniGameState.bossMaxHealth.toLocaleString()}`;
    }

    function endMiniGame(isVictory) {
        clearInterval(miniGameState.intervalId);
        miniGameState.isActive = false;

        const resultTitleEl = document.getElementById('mini-game-result-title');
        const resultRewardsEl = document.getElementById('mini-game-result-rewards');
        
        if (isVictory) {
            resultTitleEl.textContent = "Victoire !";
            resultTitleEl.className = "text-4xl font-bold mb-4 text-green-400";

            // Appliquer les récompenses
            const rewards = miniGameState.levelData.rewards;
            addGems(rewards.gems);
            coins += rewards.coins;
            addExp(rewards.exp);
            
            let rewardText = `Vous avez gagné : +${rewards.gems} gemmes, +${rewards.coins} pièces, +${rewards.exp} EXP.`;

            // Gérer le drop d'objet
            if (rewards.itemChance && Math.random() < rewards.itemChance.probability) {
                const item = rewards.itemChance.item;
                const quantity = rewards.itemChance.minQuantity; // Pour la simplicité
                inventory[item] = (inventory[item] || 0) + quantity;
                rewardText += ` Et +${quantity} ${item} !`;
            }

            resultRewardsEl.textContent = rewardText;
            if (animationsEnabled) confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });

        } else {
            resultTitleEl.textContent = "Temps Écoulé !";
            resultTitleEl.className = "text-4xl font-bold mb-4 text-red-500";
            resultRewardsEl.textContent = "Vous n'avez pas réussi à vaincre le boss à temps. Améliorez votre équipe et réessayez !";
        }

        // Afficher l'écran de résultat
        miniGameMainScreen.classList.add('hidden');
        miniGameResultScreen.classList.remove('hidden');

        // Mettre à jour l'UI principale et sauvegarder
        updateCharacterDisplay();
        updateUI();
        saveProgress();
    }

    function closeMiniGame() {
        miniGameModal.classList.add('hidden');
        disableNoScroll();
        selectedBattleCharacters.clear(); // Vider la sélection après avoir fini
    }


    function openTraitProbabilitiesModal() {
        traitProbabilitiesContent.innerHTML = ""; // Vider le contenu précédent

        const introDiv = document.createElement("div");
        introDiv.className = "text-white mb-3 text-sm";
        introDiv.innerHTML = `
            <p>Ces probabilités s'appliquent lors de l'obtention d'un <strong>nouveau trait aléatoire via le bouton "Appliquer Trait Aléatoire"</strong> (coût: ${APPLY_NEW_TRAIT_COST} Reroll Token).</p>
            <p>Les probabilités ci-dessous indiquent la chance d'obtenir chaque <strong>type</strong> de trait. Pour les traits "Force" et "Fortune", le grade (1, 2, ou 3) est ensuite déterminé aléatoirement selon les probabilités spécifiques à ce grade (cliquez pour voir les détails). Les autres traits ont un effet unique.</p>
        `;
        traitProbabilitiesContent.appendChild(introDiv);

        const totalDefinedProbability = Object.values(TRAIT_DEFINITIONS).reduce((sum, traitDef) => sum + (traitDef.probability || 0), 0);
        let probabilitySumForDisplay = 0;

        Object.entries(TRAIT_DEFINITIONS).forEach(([traitId, traitDef]) => {
            if (traitDef.grades && traitDef.grades.length > 0) {
                const typePercentage = (traitDef.probability * 100).toFixed(traitDef.probability < 0.01 ? 2 : 1);
                probabilitySumForDisplay += traitDef.probability;

                const typeProbDiv = document.createElement("div");
                typeProbDiv.className = "p-2 bg-gray-700 rounded mb-2";

                let typeHtml = "";

                const isMultiGradeTrait = (traitId === "strength" || traitId === "fortune") && traitDef.gradeProbabilities && traitDef.gradeProbabilities.length > 0;

                if (isMultiGradeTrait) {
                    // ... (partie pour les traits multi-grades, inchangée)
                    typeHtml = `
                        <details class="cursor-pointer">
                            <summary class="flex justify-between items-center mb-1 list-none focus:outline-none group">
                                <span class="flex items-center">
                                    <img src="${traitDef.image || 'https://via.placeholder.com/24?text=T'}" alt="${traitDef.name}" class="w-6 h-6 mr-2 object-contain">
                                    <span class="text-white font-semibold group-hover:text-blue-300">${traitDef.name}</span>
                                    <svg class="w-4 h-4 ml-2 text-gray-400 group-open:rotate-90 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                                </span>
                                <span class="text-white">${typePercentage}%</span>
                            </summary>
                            <div class="pl-4 mt-1 border-l-2 border-gray-600 text-xs">`;

                    traitDef.gradeProbabilities.forEach(gp => {
                        const gradeDefDetails = traitDef.grades.find(g => g.grade === gp.grade);
                        typeHtml += `
                            <div class="flex justify-between items-center py-0.5">
                                <span class="text-gray-300">Grade ${gp.grade}${gradeDefDetails ? `: ${gradeDefDetails.description}` : ''}</span>
                                <span class="text-gray-300">${(gp.probability * 100).toFixed(0)}% de chance pour ce grade</span>
                            </div>
                        `;
                    });
                    typeHtml += `
                            </div>
                        </details>`;
                } else { // Trait à grade unique
                    typeHtml = `
                        <div class="flex justify-between items-center mb-1">
                            <span class="flex items-center">
                                <img src="${traitDef.image || 'https://via.placeholder.com/24?text=T'}" alt="${traitDef.name}" class="w-6 h-6 mr-2 object-contain">
                                <span class="text-white font-semibold">${traitDef.name}</span>
                            </span>
                            <span class="text-white">${typePercentage}%</span>
                        </div>`;

                    if (traitDef.grades && traitDef.grades.length > 0) {
                        const gradeDefDetails = traitDef.grades[0];
                        if (gradeDefDetails && gradeDefDetails.description) {
                            let textColorClass = 'text-gray-300'; // Couleur par défaut
                            // Vérifier si la description correspond à celle à mettre en surbrillance
                            if (gradeDefDetails.description === "+15% Gemmes & Pièces (Tous modes)") {
                                textColorClass = 'text-gold-brilliant'; // Utilise la nouvelle classe CSS
                            }
                            typeHtml += `
                                <div class="pl-4 border-l-2 border-gray-600 text-xs">
                                    <div class="py-0.5">
                                        <span class="${textColorClass}">Effet: ${gradeDefDetails.description}</span>
                                    </div>
                                </div>`;
                        }
                    }
                }

                typeProbDiv.innerHTML = typeHtml;
                traitProbabilitiesContent.appendChild(typeProbDiv);
            }
        });

        if (Math.abs(probabilitySumForDisplay - 1.0) > 0.001 && Object.keys(TRAIT_DEFINITIONS).length > 0) {
            const warningDiv = document.createElement("div");
            warningDiv.className = "mt-3 p-2 bg-yellow-700 text-yellow-200 text-xs rounded";
            warningDiv.textContent = `Attention : La somme des probabilités des types de traits est de ${(probabilitySumForDisplay * 100).toFixed(1)}%, ce qui n'est pas 100%. Les probabilités pourraient être normalisées ou imprévisibles.`;
            traitProbabilitiesContent.appendChild(warningDiv);
        }

        traitProbabilitiesModal.classList.remove("hidden");
        enableNoScroll();
    }

    function closeTraitProbabilitiesModal() {
        traitProbabilitiesModal.classList.add("hidden");
        disableNoScroll();
    }

    tabButtons.forEach(btn => {
      btn.addEventListener("click", () => showTab(btn.dataset.tab));
    });

    subtabButtons.forEach(btn => {
      btn.addEventListener("click", () => showSubTab(btn.dataset.subtab));
    });

    document.getElementById("battle-sort-criteria").addEventListener("change", () => {
      battleSortCriteria = document.getElementById("battle-sort-criteria").value;
      localStorage.setItem("battleSortCriteria", battleSortCriteria);
      updateCharacterSelectionDisplay();
    });

    pullWithGemsButton.addEventListener("click", () => {
      pullMethodModal.classList.add("hidden");
      document.body.classList.remove("no-scroll");
      executePull(false);
    });
    pullWithTicketButton.addEventListener("click", () => {
      pullMethodModal.classList.add("hidden");
      document.body.classList.remove("no-scroll");
      executePull(true);
    });
    curseKeepBetterToggle.addEventListener("change", () => {
        updateCurseTabDisplay(); // Mettre à jour l'affichage pour activer/désactiver l'input
    });
    document.getElementById("battle-search-name").addEventListener("input", (e) => {
      battleSearchName = e.target.value.toLowerCase();
      localStorage.setItem("battleSearchName", battleSearchName);
      updateCharacterSelectionDisplay();
    });
    document.getElementById("battle-filter-rarity").addEventListener("change", (e) => {
      battleFilterRarity = e.target.value;
      localStorage.setItem("battleFilterRarity", battleFilterRarity);
      updateCharacterSelectionDisplay();
    });
    // Filtres pour la modale de sélection de preset
    document.getElementById("preset-search-name").addEventListener("input", (e) => {
      presetSearchName = e.target.value.toLowerCase();
      localStorage.setItem("presetSearchName", presetSearchName);
      updatePresetSelectionDisplay();
    });
    document.getElementById("preset-filter-rarity").addEventListener("change", (e) => {
      presetFilterRarity = e.target.value;
      localStorage.setItem("presetFilterRarity", presetFilterRarity);
      updatePresetSelectionDisplay();
    });
    // Filtres pour la modale de fusion
    document.getElementById("fusion-search-name").addEventListener("input", (e) => {
      fusionSearchName = e.target.value.toLowerCase();
      localStorage.setItem("fusionSearchName", fusionSearchName);
      updateFusionSelectionDisplay();
    });
    document.getElementById("fusion-filter-rarity").addEventListener("change", (e) => {
      fusionFilterRarity = e.target.value;
      localStorage.setItem("fusionFilterRarity", fusionFilterRarity);
      updateFusionSelectionDisplay();
    });

    cancelPullMethodButton.addEventListener("click", cancelPullMethod);
    pullButton.addEventListener("click", pullCharacter);
    multiPullButton.addEventListener("click", multiPull);
    specialPullButton.addEventListener("click", specialPull);
    document.getElementById("special-multi-pull-button").addEventListener("click", specialMultiPull);
    deleteButton.addEventListener("click", toggleDeleteMode);
    closeModalButton.addEventListener("click", closeModal);
    cancelSelectionButton.addEventListener("click", cancelSelection);
    confirmSelectionButton.addEventListener("click", confirmSelection);
    cancelFusionButton.addEventListener("click", cancelFusion);
    confirmFusionButton.addEventListener("click", confirmFusion);
    settingsButton.addEventListener("click", () => settingsModal.classList.remove("hidden"));
    saveSettingsButton.addEventListener("click", saveSettings);
    closeSettingsButton.addEventListener("click", () => settingsModal.classList.add("hidden"));
    resetGameButton.addEventListener("click", resetGame);
    confirmResetButton.addEventListener("click", confirmReset);
    cancelResetButton.addEventListener("click", cancelReset);
    cancelGiveItemsButton.addEventListener("click", cancelGiveItems);
    confirmGiveItemsButton.addEventListener("click", confirmGiveItems);
    cancelEvolutionButton.addEventListener("click", cancelEvolution);
    confirmEvolutionButton.addEventListener("click", confirmEvolution);
    document.getElementById("open-preset-modal-button").addEventListener("click", openPresetSelectionModal);
    document.getElementById("apply-stat-change-button").addEventListener("click", applyStatChange);
    document.getElementById("stat-change-search").addEventListener("input", updateStatChangeTabDisplay);
    document.getElementById("curse-char-search").addEventListener("input", updateCurseTabDisplay);
    statRankInfoButton.addEventListener("click", openStatRankProbabilitiesModal);
    closeStatRankProbabilitiesModalButton.addEventListener("click", closeStatRankProbabilitiesModal);
    autofuseSettingsButton.addEventListener("click", startAutofuse);
    cancelAutofuseButton.addEventListener("click", cancelAutofuse);
    confirmAutofuseButton.addEventListener("click", confirmAutofuse);
    traitCharSearchInput.addEventListener("input", updateTraitTabDisplay);
    document.getElementById("limit-break-char-search").addEventListener("input", updateLimitBreakTabDisplay);
    applyLimitBreakButton.addEventListener("click", applyLimitBreak);
    applyCurseButton.addEventListener("click", applyCurse);
    miniGameStartButton.addEventListener('click', startMiniGame);
    miniGameBossImage.addEventListener('click', handleBossClick);
    miniGameCloseButton.addEventListener('click', closeMiniGame);
    document.getElementById("character-selection-title").textContent = `Sélectionner ${currentMaxTeamSize} Personnage(s) pour le Combat`;
    multiActionButton.addEventListener('click', openMultiActionModal);
    maCloseButton.addEventListener('click', closeMultiActionModal);
    maTabButtons.forEach(btn => {
        btn.addEventListener('click', () => showMultiActionTab(btn.dataset.tab));
    });

    maStartPullsButton.addEventListener('click', startMultiPulls);
    maStopPullsButton.addEventListener('click', () => { multiActionState.stopRequested = true; });

    maStartLevelsButton.addEventListener('click', startMultiLevels);
    maStopLevelsButton.addEventListener('click', () => { multiActionState.stopRequested = true; });

    maSelectLevelButton.addEventListener('click', () => {
        isSelectingLevelForMultiAction = true;
        multiActionModal.classList.add('hidden');
        disableNoScroll(); // <<< MODIFICATION AJOUTÉE ICI
        showTab('play'); // Emmener l'utilisateur vers l'onglet des niveaux
        resultElement.innerHTML = `<p class="text-yellow-300">Veuillez cliquer sur un niveau pour le sélectionner pour les actions multiples.</p>`;
    });

    // Ouvrir la modale
    infoButton.addEventListener("click", () => {
      probabilitiesModal.classList.remove("hidden");
      enableNoScroll();
      updateProbabilitiesDisplay(); // Ceci va créer l'élément #standard-banner-timer
      showProbTab("standard");

      // Démarrer le minuteur dynamique pour la bannière standard
      if (bannerTimerIntervalId) clearInterval(bannerTimerIntervalId); // Nettoyer un ancien intervalle au cas où
      bannerTimerIntervalId = setInterval(() => {
        // Toujours re-chercher le span dans le DOM car updateProbabilitiesDisplay peut le recréer
        const timerSpanInTitle = document.getElementById("standard-banner-timer-title");

        if (timerSpanInTitle && currentStandardBanner && currentStandardBanner.generatedAt) {
            const nextChangeTime = currentStandardBanner.generatedAt + TWO_HOURS_MS;
            let timeLeftMs = Math.max(0, nextChangeTime - Date.now());
            
            timerSpanInTitle.textContent = formatTime(timeLeftMs);

            if (timeLeftMs <= 0) {
                // Vérifier si la modale est visible et que l'onglet n'est pas caché
                if (!probabilitiesModal.classList.contains("hidden") && !document.hidden) {
                    console.log("Minuteur atteint 0. Régénération de la bannière et mise à jour de l'affichage.");
                    loadOrGenerateStandardBanner(); // Ceci met à jour currentStandardBanner.generatedAt
                    updateProbabilitiesDisplay(); // Ceci redessinera le H3 et son span de minuteur avec la nouvelle valeur.
                                                 // Le prochain tick de l'intervalle trouvera le *nouveau* span.
                }
            }
        } else if (timerSpanInTitle) {
            timerSpanInTitle.textContent = "Calcul...";
          }
      }, 1000);
    });

    // Fermer la modale
    closeProbabilitiesButton.addEventListener("click", () => {
      probabilitiesModal.classList.add("hidden");
      disableNoScroll();
      if (bannerTimerIntervalId) { // Effacer l'intervalle lorsque la modale est fermée
        clearInterval(bannerTimerIntervalId);
        bannerTimerIntervalId = null;
      }
    });

    // Gérer les onglets
    probTabButtons.forEach(btn => {
      btn.addEventListener("click", () => showProbTab(btn.dataset.tab));
    });

    Object.entries(autofuseRarityCheckboxes).forEach(([rarity, checkbox]) => {
      checkbox.addEventListener("change", () => selectAutofuseRarity(rarity, checkbox.checked));
    });

     curseConfirmYesButton.addEventListener("click", () => {
        if (curseConfirmationCallback) {
            curseConfirmationCallback(true); // L'utilisateur a confirmé
        }
        closeCurseConfirmModal();
    });

    curseConfirmNoButton.addEventListener("click", () => {
        if (curseConfirmationCallback) {
            curseConfirmationCallback(false); // L'utilisateur a annulé
        }
        closeCurseConfirmModal();
    });

    if (traitProbabilitiesInfoButton) { // Vérifier si l'élément existe (au cas où)
        traitProbabilitiesInfoButton.addEventListener("click", openTraitProbabilitiesModal);
    }
    if (closeTraitProbabilitiesModalButton) {
        closeTraitProbabilitiesModalButton.addEventListener("click", closeTraitProbabilitiesModal);
    }

    statKeepBetterToggle.addEventListener("change", updateStatChangeTabDisplay);
    
    statChangeConfirmYesButton.addEventListener("click", () => {
        if (statChangeConfirmationCallback) {
            statChangeConfirmationCallback(true);
        }
        closeStatChangeConfirmModal();
    });

    statChangeConfirmNoButton.addEventListener("click", () => {
        if (statChangeConfirmationCallback) {
            statChangeConfirmationCallback(false);
        }
        closeStatChangeConfirmModal();
    });

    traitKeepBetterToggle.addEventListener("change", () => {
        traitKeepBetterToggleState = traitKeepBetterToggle.checked; // Mettre à jour la variable globale si vous en avez une (optionnel ici)
        updateTraitTabDisplay(); // Mettre à jour pour activer/désactiver les checkboxes et le bouton
    });

    traitActionConfirmYesButton.addEventListener("click", () => {
        if (traitConfirmationCallback) {
            traitConfirmationCallback(true);
        }
        closeTraitActionConfirmModal();
    });

    traitActionConfirmNoButton.addEventListener("click", () => {
        if (traitConfirmationCallback) {
            traitConfirmationCallback(false);
        }
        closeTraitActionConfirmModal();
    });

    const inventoryFilterNameInput = document.getElementById("inventory-filter-name");
    if (inventoryFilterNameInput) {
        inventoryFilterNameInput.value = inventoryFilterName; // Initialiser avec la valeur sauvegardée
        inventoryFilterNameInput.addEventListener("input", (e) => {
            inventoryFilterName = e.target.value;
            localStorage.setItem("inventoryFilterName", inventoryFilterName);
            updateCharacterDisplay();
        });
    }

    const inventoryFilterRaritySelect = document.getElementById("inventory-filter-rarity");
    if (inventoryFilterRaritySelect) {
        inventoryFilterRaritySelect.value = inventoryFilterRarity; // Initialiser
        inventoryFilterRaritySelect.addEventListener("change", (e) => {
            inventoryFilterRarity = e.target.value;
            localStorage.setItem("inventoryFilterRarity", inventoryFilterRarity);
            updateCharacterDisplay();
        });
    }

    const inventorySortCriteriaSelect = document.getElementById("sort-criteria-secondary"); // L'ID HTML reste le même pour l'instant
      if (inventorySortCriteriaSelect) {
          inventorySortCriteriaSelect.value = sortCriteria; // Initialiser avec la valeur de sortCriteria (le tri principal)
          inventorySortCriteriaSelect.addEventListener("change", (e) => {
              sortCriteria = e.target.value; // Met à jour sortCriteria (le tri principal)
              localStorage.setItem("sortCriteria", sortCriteria); // Sauvegarde le tri principal
              updateCharacterDisplay();
          });
    }

    const inventoryFilterEvolvableCheckbox = document.getElementById("inventory-filter-evolvable");
    if (inventoryFilterEvolvableCheckbox) {
        inventoryFilterEvolvableCheckbox.checked = inventoryFilterEvolvable; // Initialiser
        inventoryFilterEvolvableCheckbox.addEventListener("change", (e) => {
            inventoryFilterEvolvable = e.target.checked;
            localStorage.setItem("inventoryFilterEvolvable", inventoryFilterEvolvable);
            updateCharacterDisplay();
        });
    }

    const inventoryFilterLimitBreakCheckbox = document.getElementById("inventory-filter-limitbreak");
    if (inventoryFilterLimitBreakCheckbox) {
        inventoryFilterLimitBreakCheckbox.checked = inventoryFilterLimitBreak; // Initialiser
        inventoryFilterLimitBreakCheckbox.addEventListener("change", (e) => {
            inventoryFilterLimitBreak = e.target.checked;
            localStorage.setItem("inventoryFilterLimitBreak", inventoryFilterLimitBreak);
            updateCharacterDisplay();
        });
    }

    const inventoryFilterCanReceiveExpCheckbox = document.getElementById("inventory-filter-canreceiveexp");
    if (inventoryFilterCanReceiveExpCheckbox) {
        inventoryFilterCanReceiveExpCheckbox.checked = inventoryFilterCanReceiveExp; // Initialiser
        inventoryFilterCanReceiveExpCheckbox.addEventListener("change", (e) => {
            inventoryFilterCanReceiveExp = e.target.checked;
            localStorage.setItem("inventoryFilterCanReceiveExp", inventoryFilterCanReceiveExp);
            updateCharacterDisplay();
        });
    }

    applyCurseButton.addEventListener("click", applyCurse);
    document.getElementById("load-preset-button").addEventListener("click", loadPreset);
    document.getElementById("confirm-preset").addEventListener("click", confirmPreset);
    document.getElementById("cancel-preset").addEventListener("click", cancelPreset);
    document.getElementById("preset-sort-criteria").addEventListener("change", () => {
      presetSortCriteria = document.getElementById("preset-sort-criteria").value;
      localStorage.setItem("presetSortCriteria", presetSortCriteria);
      updatePresetSelectionDisplay();
    });

    // --- DANS LE FICHIER script.js ---

    function handleLevelStartClick(event) {
        const button = event.target.closest('.level-start-button');
        if (!button) return;

        const levelId = parseInt(button.dataset.levelId);
        
        if (isSelectingLevelForMultiAction) {
            const levelData = allGameLevels.find(l => l.id === levelId);
            if (levelData) {
                multiActionState.selectedLevelId = levelId;
                multiActionState.selectedLevelName = levelData.name;
                isSelectingLevelForMultiAction = false;
                
                // Rouvrir la modale et mettre à jour son affichage
                multiActionModal.classList.remove("hidden");
                enableNoScroll();
                maSelectedLevelDisplay.textContent = `Niveau sélectionné : ${levelData.name}`;
                maSelectedLevelDisplay.classList.remove("text-red-500");
            }
            // Très important : on arrête l'exécution ici pour ne pas lancer un combat normal.
            return; 
        }

        const isInfinite = button.dataset.isInfinite === 'true';

        if (isInfinite) {
            startInfiniteLevel(levelId);
        } else {
            startLevel(levelId);
        }
    }

    levelListElement.addEventListener('click', handleLevelStartClick);
    document.getElementById("legende-level-list").addEventListener('click', handleLevelStartClick);
    document.getElementById("challenge-level-list").addEventListener('click', handleLevelStartClick);
    document.getElementById("materiaux-level-list").addEventListener('click', handleLevelStartClick);

    // NOUVEAU: Fermeture de la modale d'avertissement
     const autoClickerModalCloseButton = document.getElementById('auto-clicker-modal-close-button');
    if (autoClickerModalCloseButton) {
        autoClickerModalCloseButton.addEventListener('click', () => {
            if (autoClickerWarningModal) {
                autoClickerWarningModal.classList.add('hidden');
                disableNoScroll();
            }
        });
    }

    populateTargetStatRanks();
    populateTargetTraits();

    auth.onAuthStateChanged(user => {
        if (user) {
            // L'utilisateur est connecté
            currentUser = user;
            // Extraire le pseudo de l'email synthétique
            const username = user.email.split('@')[0];
            console.log("Utilisateur connecté:", username);

            // Afficher l'état de l'utilisateur et cacher les formulaires
            document.getElementById('user-email').textContent = username; // MODIFIÉ ICI
            authContainer.classList.add('hidden');
            userStatus.classList.remove('hidden');
            gameContainer.classList.remove('hidden');
            
            // Charger la progression du joueur
            if (!isGameInitialized) {
                loadProgress(user.uid);
            }

        } else {
            // L'utilisateur est déconnecté
            currentUser = null;
            console.log("Aucun utilisateur connecté.");

            // Cacher le jeu et le statut, afficher les formulaires
            isGameInitialized = false;
            gameContainer.classList.add('hidden');
            userStatus.classList.add('hidden');
            authContainer.classList.remove('hidden');
            document.getElementById('login-view').classList.remove('hidden');
            document.getElementById('signup-view').classList.add('hidden');
        }
    });

    // Initialiser l'interface d'authentification
    setupAuthUI();