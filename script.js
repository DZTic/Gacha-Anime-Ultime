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

    // Cette ligne force Firestore à utiliser une méthode de communication plus "classique" (Long Polling)
    // au lieu du protocole QUIC. Cela permet de résoudre les erreurs `net::ERR_QUIC_PROTOCOL_ERROR`
    // qui peuvent survenir à cause de configurations réseau, de VPNs ou d'extensions de navigateur.
    db.settings({ experimentalForceLongPolling: true });

    let currentUser = null;
    let isGameInitialized = false; // Pour s'assurer que le jeu n'est initialisé qu'une seule fois

    // Références aux nouveaux éléments HTML
    const appContainer = document.getElementById("app-container");
    const authContainer = document.getElementById("auth-container");
    const gameContainer = document.getElementById("game-container");
    const userStatus = document.getElementById("user-status");

    // --- VARIABLES GLOBALES ENSUITE ---

    // Fonction utilitaire pour parser le JSON de manière sécurisée depuis localStorage
    function safeJsonParse(key, defaultValue, validator = null) {
        const rawValue = localStorage.getItem(key);
        if (rawValue === null) {
            // console.log(`[LocalStorage] Clé "${key}" non trouvée. Utilisation de la valeur par défaut.`);
            return defaultValue;
        }
        try {
            const parsedValue = JSON.parse(rawValue);
            if (validator && !validator(parsedValue)) {
                console.warn(`[LocalStorage] Validation échouée pour la clé "${key}". Valeur parsée:`, parsedValue, `Utilisation de la valeur par défaut.`);
                // localStorage.removeItem(key); // Optionnel: supprimer la clé corrompue
                return defaultValue;
            }
            // console.log(`[LocalStorage] Clé "${key}" chargée avec succès.`);
            return parsedValue;
        } catch (error) {
            console.warn(`[LocalStorage] Erreur de parsing JSON pour la clé "${key}". Valeur brute:`, rawValue, `Erreur:`, error, `Utilisation de la valeur par défaut.`);
            // localStorage.removeItem(key); // Optionnel: supprimer la clé corrompue
            return defaultValue;
        }
    }

    // Fonctions de validation spécifiques (exemples)
    const isValidMissionsArray = (arr) => Array.isArray(arr) && arr.every(m => 
        m && typeof m.id === 'number' && 
        typeof m.description === 'string' &&
        typeof m.type === 'string' &&
        typeof m.goal === 'number' &&
        typeof m.reward === 'object' && m.reward && typeof m.reward.gems === 'number' &&
        typeof m.progress === 'number' &&
        typeof m.completed === 'boolean'
    );

    const isValidShopOffersArray = (arr) => Array.isArray(arr) && arr.every(o =>
        o && typeof o.type === 'string' &&
        typeof o.cost === 'number' &&
        typeof o.currency === 'string' &&
        typeof o.description === 'string'
        // `amount` peut être un nombre ou une chaîne (pour special-character), donc validation plus souple ici
    );
    
    const isValidStoryProgressArray = (arr) => Array.isArray(arr) && arr.every(p =>
        p && typeof p.id === 'number' &&
        typeof p.unlocked === 'boolean' &&
        typeof p.completed === 'boolean'
    );

    const isValidStringArray = (arr) => Array.isArray(arr) && arr.every(s => typeof s === 'string');
    const isValidNumberArray = (arr) => Array.isArray(arr) && arr.every(n => typeof n === 'number');


    let characterIdCounter = parseInt(localStorage.getItem("characterIdCounter") || "0", 10);
    if (isNaN(characterIdCounter)) {
        console.warn("[LocalStorage] 'characterIdCounter' invalide. Réinitialisation à 0.");
        characterIdCounter = 0;
    }

    let gemsRaw = localStorage.getItem("gems");
    let gems;
    if (gemsRaw !== null) {
        gems = parseInt(gemsRaw, 10);
        if (isNaN(gems)) {
            console.warn("[LocalStorage] Valeur de 'gems' invalide:", gemsRaw, ". Réinitialisation à 1000.");
            gems = 1000; 
        }
    } else {
        gems = 1000; 
    }

    function getNumberFromStorage(key, defaultValue) {
        const val = parseInt(localStorage.getItem(key) || defaultValue, 10);
        return isNaN(val) ? defaultValue : val;
    }


    let pullCount = parseInt(localStorage.getItem("pullCount") || "0", 10);
    if (isNaN(pullCount)) {
        console.warn("[LocalStorage] 'pullCount' invalide. Réinitialisation à 0.");
        pullCount = 0;
    }
    
    let ownedCharacters = [];
    const rawOwnedCharactersString = localStorage.getItem("ownedCharacters");
    // console.log("Vérification avant boucle: statRanks est défini?", typeof statRanks !== 'undefined'); 

    if (rawOwnedCharactersString) {
        try {
            const loadedChars = JSON.parse(rawOwnedCharactersString);
            if (Array.isArray(loadedChars)) {
                loadedChars.forEach((char, index) => {
                    try {
                        if (!char || typeof char.name !== 'string' || char.name.trim() === "") {
                            console.warn(`[INIT Char ${index}] Personnage invalide ou nom manquant/vide, skippé:`, char);
                            return;
                        }

                        const nameToFind = char.hasEvolved && char.originalName ? char.originalName : char.name;
                        const baseDefinition = allCharacters.find(c => c.name === nameToFind);
                        if (!baseDefinition) {
                            console.warn(`[INIT Char ${index}] Définition de base non trouvée pour '${nameToFind}' (original: ${char.name}). Skippé.`);
                            return;
                        }
                        const initialPowerFromDefinition = Number(baseDefinition.power) || 0;

                        let basePower = char.basePower;
                        let statRank = char.statRank;
                        let statModifier = char.statModifier;
                        
                        if (!statRank || !statRanks[statRank]) {
                            statRank = getRandomStatRank();
                            statModifier = statRanks[statRank].modifier;
                            console.warn(`[INIT Char ${index}] '${char.name}' avait un statRank invalide. Nouveau statRank: ${statRank}`);
                        } else if (typeof statModifier === 'undefined' || statModifier === null || isNaN(Number(statModifier))) {
                            statModifier = statRanks[statRank].modifier;
                            console.warn(`[INIT Char ${index}] '${char.name}' avait un statModifier invalide. Recalculé à: ${statModifier} pour le rang ${statRank}`);
                        }
                        statModifier = Number(statModifier);
                         if (isNaN(statModifier)) { // Ultime fallback
                            console.error(`[INIT Char ${index}] '${char.name}' FATAL: statModifier est NaN après tentative de correction. Utilisation de 1.0.`);
                            statModifier = 1.0;
                        }


                        if (typeof basePower === 'undefined' || basePower === null || isNaN(Number(basePower)) || Number(basePower) <= 0) {
                            if (initialPowerFromDefinition > 0 && statModifier !== 0) {
                                basePower = initialPowerFromDefinition / statModifier;
                                console.warn(`[INIT Char ${index}] '${char.name}' avait un basePower invalide. Dérivé à: ${basePower} (depuis def:${initialPowerFromDefinition} / mod:${statModifier})`);
                            } else if (initialPowerFromDefinition > 0) {
                                basePower = initialPowerFromDefinition;
                                console.warn(`[INIT Char ${index}] '${char.name}' avait un basePower invalide. Défini à: ${basePower} (directement depuis def:${initialPowerFromDefinition}, statModifier problématique)`);
                            } else {
                                basePower = 50;
                                console.error(`[INIT Char ${index}] '${char.name}' FATAL: basePower et initialPowerFromDefinition invalides. Défini à ${basePower}`);
                            }
                        }
                        basePower = Number(basePower);
                        if (isNaN(basePower) || basePower <= 0) {
                            console.error(`[INIT Char ${index}] '${char.name}' FATAL: basePower est ${basePower} après toutes les corrections. Réinitialisation à 50.`);
                            basePower = 50;
                        }


                        let traitObject = { id: null, grade: 0 };
                        if (char.trait && typeof char.trait === 'object') {
                            let tempTraitId = char.trait.id;
                            let tempTraitGrade = char.trait.grade;

                            if (typeof char.trait.level !== 'undefined' && typeof tempTraitGrade === 'undefined') {
                                tempTraitGrade = Number(char.trait.level);
                                if (isNaN(tempTraitGrade)) tempTraitGrade = 0;
                            }
                            tempTraitGrade = Number(tempTraitGrade) || 0;

                            if (tempTraitId && typeof tempTraitId === 'string' && TRAIT_DEFINITIONS[tempTraitId]) {
                                const traitDef = TRAIT_DEFINITIONS[tempTraitId];
                                if (traitDef.grades && Array.isArray(traitDef.grades) && traitDef.grades.length > 0) {
                                    const maxGradeForTrait = traitDef.grades.length;
                                    if (tempTraitGrade > maxGradeForTrait) {
                                        console.warn(`[INIT Char ${char.name}] Trait ${tempTraitId} grade ${tempTraitGrade} > max ${maxGradeForTrait}. Ajustement.`);
                                        tempTraitGrade = maxGradeForTrait;
                                    }
                                    if (tempTraitGrade > 0) {
                                        traitObject = { id: tempTraitId, grade: tempTraitGrade };
                                    } else {
                                         console.warn(`[INIT Char ${char.name}] Trait ${tempTraitId} avec grade ${tempTraitGrade} (<=0) après validation. Trait remis à null.`);
                                    }
                                } else {
                                     console.warn(`[INIT Char ${char.name}] Trait ${tempTraitId} existe mais n'a pas de définition de grades valide. Trait remis à null.`);
                                }
                            } else if (tempTraitId) {
                                console.warn(`[INIT Char ${char.name}] Trait ID '${tempTraitId}' non trouvé ou invalide dans TRAIT_DEFINITIONS. Trait remis à null.`);
                            }
                        }

                        const newCharData = {
                            ...baseDefinition, 
                            ...char, 
                            id: char.id && typeof char.id === 'string' ? char.id : `char_${characterIdCounter++}`,
                            level: typeof char.level === 'number' && !isNaN(char.level) && char.level > 0 ? char.level : 1,
                            exp: typeof char.exp === 'number' && !isNaN(char.exp) && char.exp >= 0 ? char.exp : 0,
                            locked: typeof char.locked === 'boolean' ? char.locked : false,
                            hasEvolved: typeof char.hasEvolved === 'boolean' ? char.hasEvolved : false,
                            curseEffect: typeof char.curseEffect === 'number' && !isNaN(char.curseEffect) ? char.curseEffect : 0,
                            basePower: basePower, // Déjà validé
                            maxLevelCap: typeof char.maxLevelCap === 'number' && !isNaN(char.maxLevelCap) && char.maxLevelCap >= 60 ? char.maxLevelCap : 60,
                            statRank: statRank, // Déjà validé
                            statModifier: statModifier, // Déjà validé
                            trait: traitObject // Déjà validé
                        };
                        delete newCharData.power; 

                        recalculateCharacterPower(newCharData);

                        if (isNaN(newCharData.power) || newCharData.power <= 0) {
                             console.warn(`[INIT Char ${index}] Puissance INVALIDE pour ${newCharData.name} après recalcul final. Power: ${newCharData.power}. SKIPPED.`);
                             console.log("[INIT Char Detail for Skipped]: ", JSON.parse(JSON.stringify(newCharData)));
                             return;
                        }
                        ownedCharacters.push(newCharData);
                    } catch (errorForChar) {
                        console.error(`[INIT Char ${index}] ERREUR critique lors du traitement du personnage sauvegardé:`, char, errorForChar);
                    }
                });
                if (loadedChars.length !== ownedCharacters.length) {
                    console.warn("[INIT] Attention: Certains personnages de la sauvegarde n'ont pas pu être chargés correctement en raison d'erreurs ou de données invalides.");
                }
            } else {
                console.warn("[INIT] 'ownedCharacters' depuis localStorage n'est pas un tableau. Initialisation à un tableau vide.");
                ownedCharacters = [];
            }
        } catch (e) {
            console.error("[INIT] ERREUR FATALE lors du JSON.parse de 'ownedCharacters'. La sauvegarde des personnages est corrompue et sera réinitialisée.", e);
            ownedCharacters = [];
            // Optionnel: localStorage.removeItem("ownedCharacters");
        }
    } else {
        // console.log("[INIT] 'ownedCharacters' non trouvé dans localStorage. Initialisation à un tableau vide.");
        ownedCharacters = [];
    }
    localStorage.setItem("characterIdCounter", characterIdCounter.toString());


    let level = parseInt(localStorage.getItem("level") || "1", 10);
    if (isNaN(level) || level < 1) { console.warn("[LocalStorage] 'level' invalide. Réinitialisation à 1."); level = 1; }

    let exp = parseInt(localStorage.getItem("exp") || "0", 10);
    if (isNaN(exp) || exp < 0) { console.warn("[LocalStorage] 'exp' invalide. Réinitialisation à 0."); exp = 0; }
    
    let expMultiplier = parseFloat(localStorage.getItem("expMultiplier") || "1");
    if (isNaN(expMultiplier) || expMultiplier < 0) { console.warn("[LocalStorage] 'expMultiplier' invalide. Réinitialisation à 1."); expMultiplier = 1; }

    let pullTickets = parseInt(localStorage.getItem("pullTickets") || "0", 10);
    if (isNaN(pullTickets) || pullTickets < 0) { console.warn("[LocalStorage] 'pullTickets' invalide. Réinitialisation à 0."); pullTickets = 0; }

    let missions = safeJsonParse("missions", [], isValidMissionsArray);
    let isDeleteMode = false;
    let selectedCharacterIndices = new Set(); 
    let shopOffers = safeJsonParse("shopOffers", [], isValidShopOffersArray);

    let shopRefreshTime = parseInt(localStorage.getItem("shopRefreshTime") || (Date.now() + TWO_HOURS_MS).toString(), 10);
    if (isNaN(shopRefreshTime)) { 
        console.warn("[LocalStorage] 'shopRefreshTime' invalide. Réinitialisation."); 
        shopRefreshTime = Date.now() + TWO_HOURS_MS;
    }
    let expBoostEndTime = parseInt(localStorage.getItem("expBoostEndTime") || "0", 10);
    if (isNaN(expBoostEndTime)) { console.warn("[LocalStorage] 'expBoostEndTime' invalide. Réinitialisation à 0."); expBoostEndTime = 0; }

    let storyProgress = (() => {
      const savedProgressString = localStorage.getItem("storyProgress");
      let loadedProgressArray = [];
      if (savedProgressString) {
          try {
              const parsed = JSON.parse(savedProgressString);
              if (isValidStoryProgressArray(parsed)) {
                  loadedProgressArray = parsed;
              } else {
                  console.warn("[LocalStorage] 'storyProgress' n'est pas un tableau valide d'objets de progression. Il sera ignoré.");
              }
          } catch (e) {
              console.error("[LocalStorage] Erreur lors du parsing de storyProgress:", e);
          }
      }

      let currentProgressMap = new Map();
      allGameLevels.forEach(levelDefinition => {
        const savedLevelState = loadedProgressArray.find(sl => sl.id === levelDefinition.id);
        let isUnlockedInitial = levelDefinition.unlocked || false;
        if (levelDefinition.type === 'story' && !levelDefinition.isInfinite) {
            isUnlockedInitial = (levelDefinition.id === 1);
        } else if (levelDefinition.type === 'material' || levelDefinition.type === 'challenge') {
            isUnlockedInitial = true;
        }

        if (savedLevelState && typeof savedLevelState.unlocked === 'boolean' && typeof savedLevelState.completed === 'boolean') {
          currentProgressMap.set(levelDefinition.id, { ...savedLevelState });
        } else {
          currentProgressMap.set(levelDefinition.id, {
            id: levelDefinition.id,
            unlocked: isUnlockedInitial,
            completed: levelDefinition.completed || false
          });
        }
      });

      let currentProgress = Array.from(currentProgressMap.values());
      const storyWorldDefinitions = [...new Set(baseStoryLevels
          .filter(l => l.type === 'story' && !l.isInfinite)
          .map(l => ({ world: l.world, firstId: Math.min(...baseStoryLevels.filter(sl => sl.world === l.world && sl.type === 'story' && !sl.isInfinite).map(sl => sl.id))}))
          .sort((a, b) => a.firstId - b.firstId)
      )];

      for (let i = 0; i < storyWorldDefinitions.length - 1; i++) {
          const currentWorldName = storyWorldDefinitions[i].world;
          const nextWorldName = storyWorldDefinitions[i + 1].world;
          const levelsInCurrentWorldProgress = currentProgress.filter(p => {
              const levelDef = baseStoryLevels.find(lDef => lDef.id === p.id);
              return levelDef && levelDef.world === currentWorldName && levelDef.type === 'story' && !levelDef.isInfinite;
          });

          if (levelsInCurrentWorldProgress.length > 0 && levelsInCurrentWorldProgress.every(p => p.completed)) {
              const levelsInNextWorldDefs = baseStoryLevels.filter(lDef => lDef.world === nextWorldName && lDef.type === 'story' && !lDef.isInfinite);
              if (levelsInNextWorldDefs.length > 0) {
                  const firstLevelOfNextWorldId = Math.min(...levelsInNextWorldDefs.map(l => l.id));
                  const progressForFirstLevelNextWorld = currentProgress.find(p => p.id === firstLevelOfNextWorldId);
                  if (progressForFirstLevelNextWorld && !progressForFirstLevelNextWorld.unlocked) {
                      console.log(`[MIGRATION PROGRESSION] Déblocage du niveau ID ${firstLevelOfNextWorldId} (${levelsInNextWorldDefs.find(l=>l.id === firstLevelOfNextWorldId)?.name}) car le monde ${currentWorldName} est complété.`);
                      progressForFirstLevelNextWorld.unlocked = true;
                  }
              }
          }
      }

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
    if (theme !== "dark" && theme !== "light") {
        console.warn("[LocalStorage] 'theme' invalide. Réinitialisation à 'dark'.");
        theme = "dark";
    }

    let infiniteLevelStartTime = null;
    let everOwnedCharacters = safeJsonParse("everOwnedCharacters", [], isValidStringArray);
    
    // NOUVEAU: Déclaration des variables de preset manquantes
    let defaultBattleTeamId = null; // NOUVEAU: ID de l'équipe par défaut pour les combats
    let sortCriteria = localStorage.getItem("sortCriteria") || "power";
    const validSortCriteria = ["power", "rarity", "level", "name", "none"];
    if (!validSortCriteria.includes(sortCriteria)) {
        console.warn("[LocalStorage] 'sortCriteria' invalide. Réinitialisation à 'power'.");
        sortCriteria = "power";
    }
    let battleSortCriteria = localStorage.getItem("battleSortCriteria") || "power";
    if (!validSortCriteria.includes(battleSortCriteria)) {
        console.warn("[LocalStorage] 'battleSortCriteria' invalide. Réinitialisation à 'power'.");
        battleSortCriteria = "power";
    }

    const defaultInventoryData = {
        "Haricots": 0, "Fluide mystérieux": 0, "Wisteria Flower": 0, "Pass XP": 0,
        "Cursed Token": 0, "Shadow Tracer": 0, "Stat Chip": 0, "Reroll Token": 0, "Divin Wish": 0,
        "Jeton de Guilde": 0,
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
        "Plume Céleste": 0, "Sablier Ancien": 0, "Restricting Headband": 0, "Toil Ribbon": 0, "Red Essence": 0, "Purple Essence": 0,
    };
    // NOUVEAU: Ajout des objets exclusifs au Co-op
    defaultInventoryData["Fragment Étoilé"] = 0;
    defaultInventoryData["Coeur de Nébuleuse"] = 0;
    let inventory = safeJsonParse("inventory", { ...defaultInventoryData }, (inv) => {
        if (typeof inv !== 'object' || inv === null) return false;
        for (const key in defaultInventoryData) {
            if (typeof inv[key] !== 'number' || isNaN(inv[key])) {
                 // Si une clé de l'inventaire par défaut n'est pas un nombre valide dans l'inventaire chargé,
                 // on la corrige ici au lieu de rejeter toute la sauvegarde de l'inventaire.
                console.warn(`[LocalStorage Validation] Clé d'inventaire "${key}" invalide ou manquante. Réinitialisation à la valeur par défaut (${defaultInventoryData[key]}).`);
                inv[key] = defaultInventoryData[key];
            }
        }
        // Vérifier les clés supplémentaires dans l'inventaire chargé qui ne sont pas dans defaultInventoryData
        for (const loadedKey in inv) {
            if (!defaultInventoryData.hasOwnProperty(loadedKey)) {
                console.warn(`[LocalStorage Validation] Clé d'inventaire inconnue "${loadedKey}" trouvée dans la sauvegarde. Elle sera ignorée.`);
                // Pas besoin de la supprimer ici, elle ne sera juste pas utilisée si elle n'est pas dans defaultInventoryData
            }
        }
        return true;
    });
    // Assurer que toutes les clés de l'inventaire par défaut sont présentes
    for (const defaultItemKey in defaultInventoryData) {
        if (!inventory.hasOwnProperty(defaultItemKey) || typeof inventory[defaultItemKey] !== 'number' || isNaN(inventory[defaultItemKey])) {
            inventory[defaultItemKey] = defaultInventoryData[defaultItemKey];
        }
    }
    inventory["Pass XP"] = pullTickets; // Synchroniser avec pullTickets après le chargement

    let selectedItemsForGiving = new Map(); 
    let currentGiveItemsCharacterId = null;
    let currentEvolutionCharacterId = null;
    let selectedEvolutionItems = new Map();
    
    let purchasedOffers = safeJsonParse("purchasedOffers", [], isValidNumberArray);
    const isValidTeamsArray = (arr) => Array.isArray(arr) && arr.every(t =>
        t && typeof t.id === 'string' &&
        typeof t.name === 'string' &&
        Array.isArray(t.characterIds) &&
        t.characterIds.every(id => typeof id === 'string')
    );
    let savedTeams = safeJsonParse("savedTeams", [], isValidTeamsArray);
    let editingTeamId = null;
    let defenseTeamIds = safeJsonParse("defenseTeamIds", [], isValidStringArray);
    let playerPvpPoints = getNumberFromStorage("playerPvpPoints", 0);
    let pvpLogs = [];
    // NOUVEAU: Variables pour les saisons PvP et le mode Brawl
    let playerSeasonData = { highestLeagueName: 'Non classé', seasonId: null };
    let seasonEndDate = null;
    let seasonTimerIntervalId = null;
    let currentBrawlMode = null;
    let currentBattleMode = 'standard'; // 'standard' ou 'brawl'


    let selectedTeamCharacters = new Set();
    let teamEditorSelectedCharacters = new Set();
    let teamEditorSortCriteria = localStorage.getItem("teamEditorSortCriteria") || "power";
    let teamEditorSearchName = localStorage.getItem("teamEditorSearchName") || "";
    let teamEditorFilterRarity = localStorage.getItem("teamEditorFilterRarity") || "all";

    let towerFloor = getNumberFromStorage("towerFloor", 1);
    let currentPvpOpponent = null;
    let pvpResultsListener = null;
    let currentAutofuseCharacterId = null;
    let autofuseSelectedRarities = new Set(); // Sera peuplé par l'UI si sauvegardé, ou vide
    let discoveredCharacters = safeJsonParse("discoveredCharacters", [], isValidStringArray);
    
    let lastUsedBattleTeamIds = safeJsonParse("lastUsedBattleTeamIds", [], isValidStringArray);
    if (lastUsedBattleTeamIds.length > 5) { // Limiter la taille au cas où
        console.warn("[LocalStorage] 'lastUsedBattleTeamIds' trop long. Tronqué.");
        lastUsedBattleTeamIds = lastUsedBattleTeamIds.slice(0,5);
    }


    let currentCurseCharacterId = null;
    let currentStatChangeCharacterId = null; 
    let curseConfirmationCallback = null;
    let statChangeConfirmationCallback = null;
    let statChangeInfoTimeoutId = null;
    let currentTraitCharacterId = null;
    let traitKeepBetterToggleState = false; // Initialisé par l'UI
    let traitConfirmationCallback = null;
    let infoMsgTraitTimeoutId = null;
    let guildActionConfirmationCallback = null;
    let currentLimitBreakCharacterId = null;
    let bannerTimerIntervalId = null;
    // NOUVEAU: Variables pour le mode Co-op
    let currentCoopRoomListener = null;
    let currentCoopBattleListener = null;
    let currentCoopRoomId = null;
    let coopCharacterSelectionCallback = null;
    let publicRoomsListener = null;
    let currentMaxTeamSize = 3; // Recalculé dynamiquement

    let battleSearchName = localStorage.getItem("battleSearchName") || "";
    let battleFilterRarity = localStorage.getItem("battleFilterRarity") || "all";
    const validRarities = ["all", "Rare", "Épique", "Légendaire", "Mythic", "Secret", "Vanguard"];
    if (!validRarities.includes(battleFilterRarity)) {
        console.warn("[LocalStorage] 'battleFilterRarity' invalide. Réinitialisation à 'all'.");
        battleFilterRarity = "all";
    }
    let fusionSearchName = localStorage.getItem("fusionSearchName") || "";
    let fusionFilterRarity = localStorage.getItem("fusionFilterRarity") || "all";
    if (!validRarities.includes(fusionFilterRarity)) {
        console.warn("[LocalStorage] 'fusionFilterRarity' invalide. Réinitialisation à 'all'.");
        fusionFilterRarity = "all";
    }

    if (!validRarities.includes(fusionFilterRarity)) {
        console.warn("[LocalStorage] 'fusionFilterRarity' invalide. Réinitialisation à 'all'.");
        fusionFilterRarity = "all";
    }
    
    let standardPityCount = parseInt(localStorage.getItem("standardPityCount") || "0", 10);
    if (isNaN(standardPityCount) || standardPityCount < 0) { console.warn("[LocalStorage] 'standardPityCount' invalide. Réinitialisation à 0."); standardPityCount = 0; }
    let specialPityCount = parseInt(localStorage.getItem("specialPityCount") || "0", 10);
    if (isNaN(specialPityCount) || specialPityCount < 0) { console.warn("[LocalStorage] 'specialPityCount' invalide. Réinitialisation à 0."); specialPityCount = 0; }
    
    let sortCriteriaSecondary = localStorage.getItem("sortCriteriaSecondary") || "none";
     if (!validSortCriteria.includes(sortCriteriaSecondary)) { // Réutiliser validSortCriteria
        console.warn("[LocalStorage] 'sortCriteriaSecondary' invalide. Réinitialisation à 'none'.");
        sortCriteriaSecondary = "none";
    }

    let inventoryFilterName = localStorage.getItem("inventoryFilterName") || "";
    let inventoryFilterRarity = localStorage.getItem("inventoryFilterRarity") || "all";
    if (!validRarities.includes(inventoryFilterRarity)) {
        console.warn("[LocalStorage] 'inventoryFilterRarity' invalide. Réinitialisation à 'all'.");
        inventoryFilterRarity = "all";
    }
    let inventoryFilterEvolvable = localStorage.getItem("inventoryFilterEvolvable") === "true";
    let inventoryFilterLimitBreak = localStorage.getItem("inventoryFilterLimitBreak") === "true";
    let inventoryFilterCanReceiveExp = localStorage.getItem("inventoryFilterCanReceiveExp") === "true";
    
    let saveTimeoutId = null;
    const SAVE_DELAY_MS = 2000;
    
    // NOUVEAU: Listeners pour les classements en temps réel
    let leaderboardListener = null;
    let pvpLeaderboardListener = null;
    let towerLeaderboardListener = null;
    let guildLeaderboardListener = null;

    let miniGameState = {
        isActive: false, bossMaxHealth: 0, bossCurrentHealth: 0, damagePerClick: 0,
        timer: 30, intervalId: null, levelData: null
    };
    const CRITICAL_CHANCE = 0.1; // 10% chance de coup critique
    const CRITICAL_MULTIPLIER = 2; // Multiplicateur de dégâts critiques
    let isSelectingLevelForMultiAction = false;
    let multiActionState = {
        isRunning: false, type: null, action: null, total: 0, current: 0,
        stopRequested: false, selectedLevelId: null, selectedLevelName: ''
    };
    let disableAutoClickerWarning = localStorage.getItem("disableAutoClickerWarning") === "true";

    // NOUVEAU: Variables pour le bonus de connexion
    let lastLoginDate = null; // Format 'YYYY-MM-DD'
    let loginStreak = 0; // 1-7
    // NOUVEAU: Variables pour les raids
    let raidAttempts = 3;
    let lastRaidAttemptDate = null;
    let mailListener = null;
    let unreadMailCount = 0;

    // NOUVEAU: Variables de Guilde
    let playerGuildId = null;
    let playerGuildData = null;
    let guildDataListener = null; // Pour les données de la guilde
    let guildChatListener = null; // Pour le chat
    const GUILD_MEMBER_LIMIT = 20;
    let activeGuildSubTabId = 'guild-main';
    // NOUVEAU: Variables GvG
    let gvgWarDataListener = null;
    let gvgWarData = null;
    let currentSelectionContext = 'battle'; // 'battle', 'gvg_defense', etc.
    let gvgTimerIntervalId = null;
    // NOUVEAU: Variables pour la phase de combat GvG
    let gvgAttackTokens = 0;
    let currentGvgTargetUid = null;

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
    const sellSelectedButton = document.getElementById("sell-selected-button");
    const secretCountElement = document.getElementById("secret-count");
    const tabButtons = document.querySelectorAll(".tab-button"); // This will include the new tab-stat-change
    const subtabButtons = document.querySelectorAll(".subtab-button"); // Keep this for Play and Inventory subtabs
    const deleteButton = document.getElementById("delete-button");
    const statsModal = document.getElementById("stats-modal");
    const modalContent = document.getElementById("modal-content");
    let activeTabId = "play"; // Onglet actif par défaut
    let activePlaySubTabId = "story"; // Sous-onglet actif par défaut pour "play"
    let activeInventorySubTabId = "units"; // Sous-onglet actif par défaut pour "inventory"
    let activeLeaderboardSubTabId = "leaderboard-player";
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
    const autofuseRarityCheckboxes = { Rare: document.getElementById("autofuse-rare"),
      Épique: document.getElementById("autofuse-epic"),
      Légendaire: document.getElementById("autofuse-legendary"),
      Mythic: document.getElementById("autofuse-mythic"),
      Secret: document.getElementById("autofuse-secret")
    };
    const teamSelectionModal = document.getElementById("team-selection-modal");
    const teamSelectionList = document.getElementById("team-selection-list");
    const teamSelectedCountDisplayElement = document.getElementById("team-selected-count-display");
    const confirmTeamSelectionButton = document.getElementById("confirm-team-selection");
    const cancelTeamSelectionButton = document.getElementById("cancel-team-selection");
    const pullMethodModal = document.getElementById("pull-method-modal"); const pvpTab = document.getElementById('pvp');
    const findOpponentButton = document.getElementById('find-opponent-button');
    
    const pvpRankDisplay = document.getElementById('pvp-rank-display');
    const pvpPointsDisplay = document.getElementById('pvp-points-display');
    const pvpLeaderboard = document.getElementById('pvp-leaderboard');
    const viewPvpLogsButton = document.getElementById('view-pvp-logs-button');
    const pvpLogsModal = document.getElementById('pvp-logs-modal');
    const pvpLogsListContainer = document.getElementById('pvp-logs-list-container');
    const closePvpLogsButton = document.getElementById('close-pvp-logs-button');
    const closePvpReplayButton = document.getElementById('close-pvp-replay-button'); // NOUVEAU: Ajout de la référence au bouton
    const pvpLogsBadge = document.getElementById('pvp-logs-badge');

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
    const summonAnimationModal = document.getElementById('summon-animation-modal');
    const summonCrystalContainer = document.getElementById('summon-crystal-container');
    const summonCrystal = document.getElementById('summon-crystal');
    const summonMultiGrid = document.getElementById('summon-multi-grid');
    const summonRevealArea = document.getElementById('summon-reveal-area');
    const summonResultsGrid = document.getElementById('summon-results-grid');
    const delay = ms => new Promise(res => setTimeout(res, ms));

    // NOUVEAU: Éléments DOM pour la Guilde
    const guildTab = document.getElementById('guild');
    const guildJoinCreateView = document.getElementById('guild-join-create-view');
    const guildMainView = document.getElementById('guild-main-view');
    const guildSearchInput = document.getElementById('guild-search-input');
    const guildSearchButton = document.getElementById('guild-search-button');
    const guildSearchResults = document.getElementById('guild-search-results');
    const openCreateGuildModalButton = document.getElementById('open-create-guild-modal-button');
    const createGuildModal = document.getElementById('create-guild-modal');
    const createGuildNameInput = document.getElementById('create-guild-name-input');
    const confirmCreateGuildButton = document.getElementById('confirm-create-guild-button');
    const cancelCreateGuildButton = document.getElementById('cancel-create-guild-button');
    const guildActionConfirmModal = document.getElementById('guild-action-confirm-modal');
    const guildActionConfirmMessageElement = document.getElementById('guild-action-confirm-message');
    const guildConfirmYesButton = document.getElementById('guild-confirm-yes-button');
    const guildConfirmNoButton = document.getElementById('guild-confirm-no-button');
    // NOUVEAU: Éléments pour la sélection de raid
    const openRaidSelectionButton = document.getElementById('open-raid-selection-button');
    const raidSelectionModal = document.getElementById('raid-selection-modal');
    const raidBossSelectionList = document.getElementById('raid-boss-selection-list');
    const cancelRaidSelectionButton = document.getElementById('cancel-raid-selection-button');

    // NOUVEAU: Éléments DOM pour le Co-op
    const coopTab = document.getElementById('coop');
    const coopLobbyView = document.getElementById('coop-lobby-view');
    const coopDungeonList = document.getElementById('coop-dungeon-list');
    const coopPublicRoomsList = document.getElementById('coop-public-rooms-list');
    const coopRoomView = document.getElementById('coop-room-view');
    const coopRoomTitle = document.getElementById('coop-room-title');
    const coopRoomPlayers = document.getElementById('coop-room-players');
    const coopReadyButton = document.getElementById('coop-ready-button');
    const coopStartBattleButton = document.getElementById('coop-start-battle-button');
    const coopLeaveRoomButton = document.getElementById('coop-leave-room-button');
    const coopBattleModal = document.getElementById('coop-battle-modal');
    const coopBattleBossName = document.getElementById('coop-battle-boss-name');
    const coopBattleBossHealthBar = document.getElementById('coop-battle-boss-health-bar');
    const coopBattleBossHealthText = document.getElementById('coop-battle-boss-health-text');
    const coopBattlePlayersDisplay = document.getElementById('coop-battle-players-display');
    const coopBattleLog = document.getElementById('coop-battle-log');
    const coopBattleAttackButton = document.getElementById('coop-battle-attack-button');

    // NOUVEAU: Éléments pour la gestion d'équipe
    const createNewTeamButton = document.getElementById("create-new-team-button");
    const savedTeamsList = document.getElementById("saved-teams-list");
    const teamEditorModal = document.getElementById("team-editor-modal");
    const teamEditorCharacterList = document.getElementById("team-editor-character-list");
    const teamEditorSelectedCount = document.getElementById("team-editor-selected-count");
    const saveTeamButton = document.getElementById("save-team-button");
    const cancelTeamEditorButton = document.getElementById("cancel-team-editor-button");
    // NOUVEAU: Éléments pour la modale de gestion d'équipe
    const manageTeamsButton = document.getElementById("manage-teams-button");
    const teamsModal = document.getElementById("teams-modal");
    const closeTeamsModalButton = document.getElementById("close-teams-modal-button");
    // Add hide-scrollbar to relevant list containers dynamically
    const listContainersToHideScrollbar = [
        "character-selection-list", "fusion-selection-list", "item-selection-list",
        "evolution-selection-list", "preset-selection-list", "stat-rank-probabilities-content",
        "trait-probabilities-content", "autofuse-character-grid", "curse-character-selection-grid",
        "trait-character-selection-grid", "limit-break-char-selection-grid", "stat-change-char-selection-grid",
        "standard-probabilities", "special-probabilities", "index-display", "evolution-display", 
        "mission-list", "shop-items", "level-list", "legende-level-list", "challenge-level-list", "materiaux-level-list",
        "team-editor-character-list" // NOUVEAU
    ];
    listContainersToHideScrollbar.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add("hide-scrollbar");
    });
    
    const pullSound = new Audio("https://freesound.org/data/previews/270/270333_5121236-lq.mp3");

    /**
     * Crée une promesse qui se résout au prochain clic sur la modale d'invocation.
     * L'écouteur d'événement est nettoyé automatiquement.
     * @returns {Promise<void>}
     */
    const waitForClick = () => {
        return new Promise(resolve => {
            const listener = () => {
                summonAnimationModal.removeEventListener('click', listener);
                resolve();
            };
            summonAnimationModal.addEventListener('click', listener);
        });
    };

    /**
     * Attend soit la fin d'une durée spécifiée, soit un clic de l'utilisateur, 
     * selon ce qui arrive en premier.
     * @param {number} duration - La durée maximale d'attente en millisecondes.
     * @returns {Promise<void>}
     */
    const waitForClickOrDelay = (duration) => {
        const delayPromise = new Promise(resolve => setTimeout(resolve, duration));
        // Promise.race résout dès que la première promesse (le délai ou le clic) est résolue.
        return Promise.race([delayPromise, waitForClick()]);
    };


    function createCharacterCard(char, originalIndex, context) {
        const template = document.getElementById('character-card-template');
        if (!template) {
            console.error("Le template #character-card-template est introuvable !");
            return document.createElement('div');
        }
        const cardClone = template.content.cloneNode(true);
    
        const cardDiv = cardClone.querySelector('.character-card');
        const lockOverlay = cardClone.querySelector('.char-lock-overlay');
        const image = cardClone.querySelector('.char-image');
        const nameEl = cardClone.querySelector('.char-name');
        const rarityEl = cardClone.querySelector('.char-rarity');
        const levelEl = cardClone.querySelector('.char-level');
        const statRankEl = cardClone.querySelector('.char-stat-rank');
        const powerEl = cardClone.querySelector('.char-power');
        const additionalInfoEl = cardClone.querySelector('.char-additional-info');
    
        // --- Common properties ---
        image.src = char.image;
        image.alt = char.name;
    
        let rarityTextColorClass = char.color;
        if (char.rarity === "Mythic") rarityTextColorClass = "rainbow-text";
        else if (char.rarity === "Vanguard") rarityTextColorClass = "text-vanguard";
        else if (char.rarity === "Secret") rarityTextColorClass = "text-secret";
        
        if (char.locked) {
            lockOverlay.classList.remove('hidden');
        }
    
        // Hide all optional elements by default
        levelEl.style.display = 'none';
        statRankEl.style.display = 'none';
        powerEl.style.display = 'none';
        additionalInfoEl.style.display = 'none';
        rarityEl.style.display = 'none';
    
        // --- Context-specific logic ---
        switch (context) {
            case 'inventory':
                cardDiv.classList.add(getRarityBorderClass(char.rarity));
                if (isDeleteMode) {
                    if (char.locked) cardDiv.classList.add('opacity-50', 'cursor-not-allowed');
                    else if (selectedCharacterIndices.has(char.id)) cardDiv.classList.add('selected-character');
                }
                nameEl.textContent = char.name;
                rarityEl.textContent = char.rarity;
                rarityEl.className = `char-rarity text-xs ${rarityTextColorClass}`;
                rarityEl.style.display = 'block';
                levelEl.textContent = `Niveau: ${char.level} / ${char.maxLevelCap || 60}`;
                levelEl.style.display = 'block';
                powerEl.textContent = `Puissance: ${char.power}`;
                powerEl.style.display = 'block';
                if (char.statRank && statRanks[char.statRank]) {
                    statRankEl.innerHTML = `Stat: <span class="${statRanks[char.statRank].color || 'text-white'}">${char.statRank}</span>`;
                    statRankEl.style.display = 'block';
                }
                break;
            case 'battleSelection':
                cardDiv.classList.add(getRarityBorderClass(char.rarity));
                nameEl.textContent = char.name;
                powerEl.textContent = `Puissance: ${char.power}`;
                powerEl.style.display = 'block';

                // Appliquer le style de sélection
                if (selectedBattleCharacters.has(originalIndex)) {
                    cardDiv.classList.add('selected-for-battle');
                }

                // Griser les personnages non sélectionnables (doublons de nom, verrouillés)
                const selectedCharacterNames = new Set(Array.from(selectedBattleCharacters).map(idx => ownedCharacters[idx]?.name).filter(Boolean));
                if (char.locked || (!selectedBattleCharacters.has(originalIndex) && selectedCharacterNames.has(char.name))) {
                    cardDiv.classList.add('non-selectable-for-battle');
                }
                break;
            // Other contexts can be added here to replicate the original function's behavior
            default: // Fallback to a simple display, similar to inventory
                cardDiv.classList.add(getRarityBorderClass(char.rarity));
                nameEl.textContent = char.name;
                rarityEl.textContent = char.rarity;
                rarityEl.className = `char-rarity text-xs ${rarityTextColorClass}`;
                rarityEl.style.display = 'block';
                powerEl.textContent = `Puissance: ${char.power}`;
                powerEl.style.display = 'block';
                break;
        }
    
        // Event listeners
        if (context === 'inventory') {
            cardDiv.addEventListener('click', () => {
                if (isDeleteMode) { if (!char.locked) deleteCharacter(char.id); } 
                else showCharacterStats(char.id);
            });
        } else if (context === 'battleSelection') {
            if (!cardDiv.classList.contains('opacity-50') && !cardDiv.classList.contains('non-selectable-for-battle')) {
                cardDiv.addEventListener("click", () => selectBattleCharacter(originalIndex));
            }
        } else if (context === 'teamSelection') {
            if (!cardDiv.classList.contains('opacity-50') && !cardDiv.classList.contains('non-selectable-for-battle')) {
                cardDiv.addEventListener("click", () => selectTeamCharacter(originalIndex));
            }
        } else if (context === 'fusionSelection') {
            cardDiv.addEventListener("click", () => selectFusionCharacter(char.id));
        } else if (context === 'autofuseGrid') {
            cardDiv.addEventListener("click", () => { currentAutofuseCharacterId = char.id; updateAutofuseDisplay(); });
        } else if (context === 'curseSelection') {
            cardDiv.addEventListener("click", () => selectCurseCharacter(char.id));
        } else if (context === 'traitSelection') {
            cardDiv.addEventListener("click", () => selectTraitCharacter(char.id));
        } else if (context === 'limitBreakSelection') {
            cardDiv.addEventListener("click", () => selectLimitBreakCharacter(char.id));
        } else if (context === 'statChangeSelection') {
            cardDiv.addEventListener("click", () => selectStatChangeCharacter(char.id));
        }
    
        return cardDiv;
    }

    const buySound = new Audio("https://freesound.org/data/previews/156/156859_2048418-lq.mp3");
    const battleSound = new Audio("https://freesound.org/data/previews/270/270330_5121236-lq.mp3");
    const winSound = new Audio('');
    const loseSound = new Audio('');

    // Fonction générique pour encapsuler les gestionnaires d'événements avec try...catch
    function safeEventListener(element, eventType, handlerFn) {
        if (element) {
            element.addEventListener(eventType, (...args) => {
                try {
                    handlerFn(...args);
                } catch (error) {
                    console.error(`[Erreur Inattendue] Événement "${eventType}" sur l'élément "${element.id || element.tagName}":`, error);
                    resultElement.innerHTML = "<p class='text-red-500'>Une erreur inattendue est survenue. Veuillez essayer de rafraîchir la page ou vérifier la console pour plus de détails.</p>";
                }
            });
        } else {
            // console.warn(`safeEventListener: Élément non trouvé pour attacher l'événement ${eventType}.`);
        }
    }


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
            lastLoginDate = null; // NOUVEAU
            loginStreak = 0;      // NOUVEAU
            missions = [];
            shopOffers = [];
            shopRefreshTime = Date.now() + TWO_HOURS_MS;
            expBoostEndTime = 0;
            storyProgress = allGameLevels.map(level => ({
                id: level.id,
                unlocked: level.type === 'challenge' ? true : (level.type === 'material' ? true : (level.type === 'daily' ? true : (level.type === 'story' && level.id === 1))),
                completed: false
            })); savedTeams = [];
            discoveredCharacters = [];
            defenseTeamIds = [];
            playerPvpPoints = 0;
            pvpLogs = [];
            standardPityCount = 0;
            specialPityCount = 0;
            raidAttempts = 3; // NOUVEAU
            lastRaidAttemptDate = null; // NOUVEAU
            lastUsedBattleTeamIds = [];
            playerGuildId = null; // NOUVEAU
            towerFloor = 1;
            autosellSettings = { Rare: false, Épique: false, Légendaire: false, Mythic: false, Secret: false };
            defaultBattleTeamId = null; // NOUVEAU

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
                "Plume Céleste": 0, "Sablier Ancien": 0, "Restricting Headband": 0, "Toil Ribbon": 0, "Red Essence": 0, "Purple Essence": 0,
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
            lastLoginDate = saveData.lastLoginDate || null; // NOUVEAU
            loginStreak = saveData.loginStreak || 0;       // NOUVEAU
            missions = saveData.missions || [];
            shopOffers = saveData.shopOffers || [];
            shopRefreshTime = saveData.shopRefreshTime || (Date.now() + TWO_HOURS_MS);
            expBoostEndTime = saveData.expBoostEndTime || 0;
            storyProgress = saveData.storyProgress || allGameLevels.map(level => ({
                id: level.id,
                unlocked: level.type === 'challenge' ? true : (level.type === 'material' ? true : (level.type === 'daily' ? true : (level.type === 'story' && level.id === 1))),
                completed: false
            }));
            inventory = saveData.inventory || {};
            savedTeams = saveData.savedTeams || [];
            discoveredCharacters = saveData.discoveredCharacters || [];
            defenseTeamIds = saveData.defenseTeamIds || [];
            playerPvpPoints = saveData.playerPvpPoints || 0;
            pvpLogs = saveData.pvpLogs || [];
            standardPityCount = saveData.standardPityCount || 0;
            specialPityCount = saveData.specialPityCount || 0;
            raidAttempts = saveData.raidAttempts ?? 3; // NOUVEAU
            lastRaidAttemptDate = saveData.lastRaidAttemptDate || null; // NOUVEAU
            lastUsedBattleTeamIds = saveData.lastUsedBattleTeamIds || [];
            playerGuildId = saveData.playerGuildId || null; // NOUVEAU
            towerFloor = saveData.towerFloor || 1;
            autosellSettings = saveData.autosellSettings || { Rare: false, Épique: false, Légendaire: false, Mythic: false, Secret: false };
            defaultBattleTeamId = saveData.defaultBattleTeamId || null; // NOUVEAU
            
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
        updateDailyDungeonDisplay();
        updatePvpDisplay();
        updateTowerDisplay();
        updatePvpLogsNotification();
        showTab("play");
        
        isGameInitialized = true;

        loadOrGenerateStandardBanner();

        scheduleSave();

        if (!disableAutoClickerWarning && autoClickerWarningModal) {
            openModal(autoClickerWarningModal);
        }
    }

    // --- NOUVEAU: Fonctions pour le bonus de connexion (CORRECTION) ---
    function isNewDay(lastLoginString) {
        if (!lastLoginString) return true; // Premier login
        const todayString = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'
        return todayString !== lastLoginString;
    }

    function isConsecutiveDay(lastLoginString) {
        if (!lastLoginString) return false; // Pas consécutif si c'est le premier login
        try {
            const lastDate = new Date(lastLoginString);
            const today = new Date();
            // Utiliser UTC pour éviter les problèmes de fuseau horaire
            lastDate.setUTCHours(0, 0, 0, 0);
            today.setUTCHours(0, 0, 0, 0);
            const diffTime = today - lastDate;
            const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
            return diffDays === 1;
        } catch (e) {
            console.error("Erreur lors du parsing de lastLoginString:", lastLoginString, e);
            return false;
        }
    }
    // --- FIN NOUVEAU ---

    // NOUVEAU: Vérifie et affiche le bonus de connexion si nécessaire
    function checkDailyLogin() {
        if (isNewDay(lastLoginDate)) {
            console.log("Nouveau jour de connexion détecté.");
            if (isConsecutiveDay(lastLoginDate)) {
                loginStreak++;
                if (loginStreak > 7) loginStreak = 1; // La boucle recommence après 7 jours
            } else {
                loginStreak = 1; // La série est brisée, on recommence au jour 1
            }
            showDailyLoginModal();
        }
        // NOUVEAU: Reset des tentatives de raid
        if (isNewDay(lastRaidAttemptDate)) {
            console.log("Nouveau jour pour les raids, réinitialisation des tentatives.");
            raidAttempts = 3;
            lastRaidAttemptDate = new Date().toISOString().split('T')[0];
            // Pas besoin de sauvegarder ici, ce sera fait à la prochaine action
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

        if (username.length < 3 || username.length > 15) {
            document.getElementById('auth-error').textContent = "Le pseudo doit contenir entre 3 et 15 caractères.";
            return;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            document.getElementById('auth-error').textContent = "Le pseudo ne peut contenir que des lettres, des chiffres et des underscores (_).";
            return;
        }

        const lowerCaseUsername = username.toLowerCase();
        if (typeof forbiddenNames !== 'undefined' && forbiddenNames.some(forbidden => lowerCaseUsername.includes(forbidden))) {
            document.getElementById('auth-error').textContent = "Ce pseudo contient des mots non autorisés.";
            return;
        }

        try {
            const usernameDocRef = db.collection('usernames').doc(username.toLowerCase());
            const doc = await usernameDocRef.get();

            if (doc.exists) {
                throw new Error("Ce pseudo est déjà utilisé.");
            }

            const email = `${username.toLowerCase()}@gacha-game-ultime.com`;
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            await usernameDocRef.set({
                email: user.email,
                uid: user.uid,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            const leaderboardRef = db.collection('leaderboard').doc(user.uid);
            await leaderboardRef.set({
                username: username,
                playerPvpPoints: 0,
                towerFloor: 1,
                level: 1 
            });

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
        await _performSave();
        
        // Nettoyer les listeners de guilde
        if (guildDataListener) guildDataListener();
        if (guildChatListener) guildChatListener();
        guildDataListener = null;
        guildChatListener = null;
        playerGuildId = null;
        playerGuildData = null;

        // MODIFICATION : Désactiver notre "espion" PvP
        if (pvpResultsListener) {
            pvpResultsListener(); // Ceci arrête l'écoute
            pvpResultsListener = null;
            console.log("[LOGOUT] Listener PvP détaché.");
        }

        if (leaderboardListener) leaderboardListener();
        if (pvpLeaderboardListener) pvpLeaderboardListener();
        if (towerLeaderboardListener) towerLeaderboardListener();
        leaderboardListener = null;
        pvpLeaderboardListener = null;
        towerLeaderboardListener = null;

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
        // S'assurer que les propriétés numériques clés sont bien des nombres au début.
        char.basePower = Number(char.basePower);
        if (isNaN(char.basePower) || char.basePower <= 0) {
            // Essayer de récupérer depuis la définition de base si basePower est invalide
            const baseDefinition = allCharacters.find(c => c.name === (char.originalName || char.name));
            const initialPowerFromDefinition = baseDefinition ? Number(baseDefinition.power) : 0;
            if (initialPowerFromDefinition > 0 && char.statModifier && Number(char.statModifier) !== 0) {
                char.basePower = initialPowerFromDefinition / Number(char.statModifier);
                 console.warn(`[RecalculatePower] '${char.name}' basePower invalide (${char.basePower}). Dérivé à: ${char.basePower} depuis def:${initialPowerFromDefinition} / mod:${char.statModifier}`);
            } else if (initialPowerFromDefinition > 0) {
                char.basePower = initialPowerFromDefinition;
                console.warn(`[RecalculatePower] '${char.name}' basePower invalide (${char.basePower}). Défini à: ${char.basePower} depuis def (statModifier problématique).`);
            } else {
                char.basePower = 50; // Ultime fallback
                console.error(`[RecalculatePower] '${char.name}' FATAL: basePower et initialPowerFromDefinition invalides. Défini à ${char.basePower}`);
            }
             if (isNaN(char.basePower) || char.basePower <= 0) char.basePower = 50; // S'assurer que ce n'est pas NaN/0
        }

        char.curseEffect = Number(char.curseEffect);
        if (isNaN(char.curseEffect)) {
            console.warn(`[RecalculatePower] '${char.name}' curseEffect était NaN. Réinitialisé à 0.`);
            char.curseEffect = 0;
        }

        // Valider et initialiser statRank et statModifier
        if (!char.statRank || !statRanks[char.statRank]) {
            console.warn(`[RecalculatePower] ${char.name} - statRank invalide (${char.statRank}). Assignation de A par défaut.`);
            char.statRank = "A"; 
        }
        // Assurer que statModifier est un nombre et correspond au statRank
        let expectedModifier = statRanks[char.statRank]?.modifier;
        if (typeof expectedModifier === 'undefined') { // Si statRank est toujours invalide après le fallback
            console.error(`[RecalculatePower] ${char.name} - statRank "${char.statRank}" n'a pas de modificateur défini dans statRanks. Utilisation de A.`);
            char.statRank = "A";
            expectedModifier = statRanks["A"].modifier;
        }
        char.statModifier = Number(char.statModifier); // Convertir en nombre
        if (isNaN(char.statModifier) || char.statModifier !== expectedModifier) {
             if (isNaN(char.statModifier)) {
                console.warn(`[RecalculatePower] ${char.name} - statModifier était NaN. Recalculé pour le rang ${char.statRank}.`);
             } else {
                console.warn(`[RecalculatePower] ${char.name} - statModifier (${char.statModifier}) ne correspondait pas au rang ${char.statRank} (${expectedModifier}). Recalculé.`);
             }
            char.statModifier = expectedModifier;
        }
         if (isNaN(char.statModifier)) { // Ultime fallback
            console.error(`[RecalculatePower] ${char.name} - statModifier est NaN même après recalcul. Utilisation de 1.0.`);
            char.statModifier = 1.0;
        }

        let powerBeforeTrait = char.basePower * char.statModifier;
        let traitPowerBonus = 0; 
        let traitPowerMultiplier = 1.0;

        if (char.trait && char.trait.id && typeof char.trait.grade === 'number' && char.trait.grade > 0) {
            const traitDef = TRAIT_DEFINITIONS[char.trait.id];
            if (traitDef && traitDef.grades && Array.isArray(traitDef.grades)) {
                const gradeDef = traitDef.grades.find(g => g.grade === char.trait.grade);
                if (gradeDef) {
                    if (typeof gradeDef.powerBonus === 'number' && !isNaN(gradeDef.powerBonus)) {
                        traitPowerBonus = gradeDef.powerBonus;
                    }
                    if (typeof gradeDef.powerMultiplier === 'number' && !isNaN(gradeDef.powerMultiplier)) {
                        traitPowerMultiplier = 1.0 + gradeDef.powerMultiplier;
                    }
                } else {
                     // console.warn(`[RecalculatePower] ${char.name} - Définition de grade ${char.trait.grade} non trouvée pour trait ${char.trait.id}.`);
                }
            } else {
                 // console.warn(`[RecalculatePower] ${char.name} - Définition de trait ${char.trait.id} ou ses grades sont invalides.`);
            }
        }
        
        let powerAfterTraitMultiplier = powerBeforeTrait * traitPowerMultiplier;
        let powerAfterTraitBonus = powerAfterTraitMultiplier + traitPowerBonus;
        
        char.power = Math.floor(powerAfterTraitBonus) + char.curseEffect;
        char.power = Math.max(1, char.power); // Assurer une puissance minimale de 1

        if (isNaN(char.power) || char.power <= 0) {
            console.error(`[RecalculatePower] ${char.name} - Puissance finale est NaN ou <= 0. Power: ${char.power}. Réinitialisation à 1.`);
            // console.log("Détails du personnage avant réinitialisation de la puissance:", JSON.parse(JSON.stringify(char)));
            char.power = 1; 
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
        openModal(statRankProbabilitiesModal);
    }

    function closeStatRankProbabilitiesModal() {
        closeModalHelper(statRankProbabilitiesModal);
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
      
      if (levelData.type !== 'challenge' && levelData.type !== 'minigame' && levelData.type !== 'daily' && !storyProgress.find(sp => sp.id === id)?.unlocked) {
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

      if (currentLevelId === 'pvp_battle') { /* PvP logic will handle team selection separately */ } else {
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
      
      // NOUVEAU: Vérifier si une équipe par défaut est définie
      if (!teamReady && defaultBattleTeamId) {
        const defaultTeam = savedTeams.find(t => t.id === defaultBattleTeamId);
        if (defaultTeam) {
            const validTeam = defaultTeam.characterIds.every(id => ownedCharacters.find(c => c.id === id));
            if (validTeam && defaultTeam.characterIds.length === 3) { // Pour l'instant, on suppose que les équipes de combat ont 3 membres
                defaultTeam.characterIds.forEach(charId => {
                    const index = ownedCharacters.findIndex(c => c.id === charId);
                    if (index !== -1) selectedBattleCharacters.add(index);
                });
                teamReady = true;
                loadedTeam = Array.from(selectedBattleCharacters).map(index => ownedCharacters[index]);
                console.log("Utilisation de l'équipe par défaut:", loadedTeam.map(c => c.name));
            } else {
                // L'équipe par défaut est invalide (ex: personnage vendu), on la désactive
                defaultBattleTeamId = null;
                resultElement.innerHTML = '<p class="text-yellow-400">Votre équipe par défaut est invalide et a été désactivée.</p>';
            }
        } else {
            defaultBattleTeamId = null; // L'ID de l'équipe par défaut n'existe plus
        }
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
    }

    function closeMultiActionModal() {
        if (multiActionState.isRunning) {
            multiActionState.stopRequested = true; // Demander l'arrêt si on ferme pendant l'exécution
        }
        closeModalHelper(multiActionModal);
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
        
        if (!defaultBattleTeamId && lastUsedBattleTeamIds.length === 0) {
            maLevelsStatus.textContent = "Erreur: Veuillez définir une équipe par défaut ou jouer un niveau une fois manuellement pour définir une équipe.";
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
      closeModalHelper(settingsModal);
      openModal(autofuseModal);
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
      autofuseCharacterGrid.innerHTML = ""; // Clear previous
      const autofuseFragment = document.createDocumentFragment();
      const eligibleForAutofuseBase = ownedCharacters
          .filter(char => char.level < (char.maxLevelCap || 60))
          .sort((a, b) => b.power - a.power);

      if (eligibleForAutofuseBase.length === 0) {
          autofuseCharacterGrid.innerHTML = '<p class="text-gray-400 col-span-full">Aucun personnage éligible (niveau inférieur à son cap actuel) disponible.</p>';
      } else {
          eligibleForAutofuseBase.forEach(char => {
              const cardElement = createCharacterCard(char, -1, 'autofuseGrid');
              autofuseFragment.appendChild(cardElement);
          });
          autofuseCharacterGrid.appendChild(autofuseFragment);
      }

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
      closeModalHelper(autofuseModal);
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
            closeModalHelper(autofuseModal);
            return;
        }
        if (mainChar.level >= 100) {
            console.log("Personnage au niveau maximum");
            resultElement.innerHTML = '<p class="text-red-400">Ce personnage est déjà au niveau maximum (100) !</p>';
            closeModalHelper(autofuseModal);
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

        // Nettoyer les IDs des personnages fusionnés des équipes
        characterIdsToFuse.forEach(deletedId => {
            lastUsedBattleTeamIds = lastUsedBattleTeamIds.filter(id => id !== deletedId);
            savedTeams.forEach(team => {
                team.characterIds = team.characterIds.filter(id => id !== deletedId);
            });
        });
        localStorage.setItem("lastUsedBattleTeamIds", JSON.stringify(lastUsedBattleTeamIds));

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
        closeModalHelper(autofuseModal);
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
      openModal(pullMethodModal);
      pullWithGemsButton.disabled = (pullType === "standard" && gems < 100) || (pullType === "special" && gems < 150);
      pullWithGemsButton.classList.toggle("opacity-50", pullWithGemsButton.disabled);
      pullWithGemsButton.classList.toggle("cursor-not-allowed", pullWithGemsButton.disabled);
      pullWithTicketButton.disabled = pullTickets === 0;
      pullWithTicketButton.classList.toggle("opacity-50", pullWithTicketButton.disabled);
      pullWithTicketButton.classList.toggle("cursor-not-allowed", pullWithTicketButton.disabled);
    }

    function cancelPullMethod() {
      console.log("cancelPullMethod appelé");
      closeModalHelper(pullMethodModal);
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
      openModal(characterSelectionModal); // Corrected: was characterSelectionModal.classList.remove("hidden");
    }

    function openTeamSelectionModal(mode) {
      currentTeamSelectionMode = mode; // 'preset' or 'defense'
      selectedTeamCharacters.clear();
      openModal(teamSelectionModal);
      updateTeamSelectionDisplay();
    }

    function updateTeamSelectionDisplay() {
        teamSelectionList.innerHTML = ""; // Use new element ID

        const maxTeamSize = 3; // For both preset and defense, it's 3.

        const teamModalTitle = document.getElementById("team-selection-modal-title");
        if (teamModalTitle) {
            if (currentTeamSelectionMode === 'preset') {
                teamModalTitle.textContent = `Sélectionner ${maxTeamSize} Personnages pour le Preset`;
            } else if (currentTeamSelectionMode === 'defense') {
                teamModalTitle.textContent = `Sélectionner ${maxTeamSize} Personnages pour l'Équipe de Défense`;
            } else {
                teamModalTitle.textContent = `Sélectionner une Équipe de ${maxTeamSize}`;
            }
        }

        const searchNameInput = document.getElementById("team-search-name");
        const filterRaritySelect = document.getElementById("team-filter-rarity");
        if (searchNameInput) searchNameInput.value = teamSearchName;
        if (filterRaritySelect) filterRaritySelect.value = teamFilterRarity;

        let charactersToDisplay = [...ownedCharacters];

        if (teamSearchName) {
            charactersToDisplay = charactersToDisplay.filter(char => (char.name || "").toLowerCase().includes(teamSearchName));
        }
        if (teamFilterRarity !== "all") {
            charactersToDisplay = charactersToDisplay.filter(char => char.rarity === teamFilterRarity);
        }

        const sortedCharacters = charactersToDisplay.sort((a, b) => {
            if (teamSortCriteria === "power") return (b.power || 0) - (a.power || 0);
            if (teamSortCriteria === "rarity") return (rarityOrder[b.rarity] ?? -1) - (rarityOrder[a.rarity] ?? -1);
            if (teamSortCriteria === "level") return (b.level || 0) - (a.level || 0);
            if (teamSortCriteria === "name") return (a.name || "").localeCompare(b.name || "");
            return 0;
        });
        
        if (sortedCharacters.length === 0) {
            teamSelectionList.innerHTML = `<p class="text-white col-span-full text-center">Aucun personnage ne correspond à vos filtres.</p>`;
        } else {
            const fragment = document.createDocumentFragment();
            sortedCharacters.forEach((char) => {
                const originalIndex = ownedCharacters.findIndex(c => c.id === char.id);
                if (originalIndex === -1) return; 

                const cardElement = createCharacterCard(char, originalIndex, 'teamSelection');
                fragment.appendChild(cardElement);
            });
            teamSelectionList.appendChild(fragment);
        }
        
        if (teamSelectedCountDisplayElement) {
            teamSelectedCountDisplayElement.textContent = `${selectedTeamCharacters.size}/${maxTeamSize}`;
        }
        
        confirmTeamSelectionButton.disabled = selectedTeamCharacters.size !== maxTeamSize;
        confirmTeamSelectionButton.classList.toggle("opacity-50", confirmTeamSelectionButton.disabled);
        confirmTeamSelectionButton.classList.toggle("cursor-not-allowed", confirmTeamSelectionButton.disabled);
        document.getElementById("team-sort-criteria").value = teamSortCriteria;
    }

    function selectTeamCharacter(index) {
        const characterToAdd = ownedCharacters[index];
        const maxTeamSize = 3; // Always 3 for preset and defense

        if (selectedTeamCharacters.has(index)) {
            selectedTeamCharacters.delete(index);
        } else {
            if (selectedTeamCharacters.size < maxTeamSize) {
                let alreadySelectedSameName = false;
                for (const selectedIndex of selectedTeamCharacters) {
                    if (ownedCharacters[selectedIndex].name === characterToAdd.name) {
                        alreadySelectedSameName = true;
                        break;
                    }
                }
                if (!alreadySelectedSameName) {
                    selectedTeamCharacters.add(index);
                } else {
                    console.log(`Team Selection: Character ${characterToAdd.name} (or another with the same name) is already selected.`);
                }
            }
        }
        updateTeamSelectionDisplay();
    }

    function loadPreset() { // This function is for loading the preset into the BATTLE selection
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

    function getPvpRank(points) {
        // Itérer à partir du rang le plus élevé pour trouver le premier pour lequel le joueur se qualifie.
        for (let i = PVP_LEAGUES.length - 1; i >= 0; i--) {
            if (points >= PVP_LEAGUES[i].minPoints) {
                return PVP_LEAGUES[i];
            }
        }
        return PVP_LEAGUES[0]; // Retourner le rang le plus bas par défaut
    }

    function updatePvpDisplay() {
        const rank = getPvpRank(playerPvpPoints);
        pvpRankDisplay.textContent = rank.name;
        pvpRankDisplay.className = `text-4xl font-bold my-4 ${rank.color}`;
        pvpPointsDisplay.textContent = `Points: ${playerPvpPoints}`;

        // Mettre à jour le plus haut rang de la saison
        const currentLeagueIndex = PVP_LEAGUES.findIndex(l => l.name === rank.name);
        const highestLeagueIndex = PVP_LEAGUES.findIndex(l => l.name === playerSeasonData.highestLeagueName);
        if (currentLeagueIndex > highestLeagueIndex) {
            playerSeasonData.highestLeagueName = rank.name;
        }
        document.getElementById('pvp-highest-league').textContent = playerSeasonData.highestLeagueName;

        // Mettre à jour le classement public avec la nouvelle ligue
        if (currentUser) { db.collection('leaderboard').doc(currentUser.uid).update({ playerPvpPoints: playerPvpPoints, pvpLeague: rank.name }).catch(e => {}); }
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
    // Gérer le callback de sélection de personnage pour le mode co-op
    if (coopCharacterSelectionCallback) {
        if (selectedBattleCharacters.size !== 1) {
            resultElement.innerHTML = `<p class="text-red-400">Veuillez sélectionner 1 personnage pour le combat co-op.</p>`;
            return;
        }
        const selectedIndex = selectedBattleCharacters.values().next().value;
        const selectedChar = ownedCharacters[selectedIndex];
        
        coopCharacterSelectionCallback(selectedChar);
        coopCharacterSelectionCallback = null;
        selectedBattleCharacters.clear();
        closeModalHelper(characterSelectionModal);
        return;
    }

    // Réinitialiser le mode de combat par défaut
    currentBattleMode = 'standard';


    // Gérer le contexte de la GvG
    if (currentSelectionContext === 'gvg_defense') {
        if (selectedBattleCharacters.size !== 3) {
            resultElement.innerHTML = `<p class="text-red-400">Une équipe de défense GvG doit contenir exactement 3 personnages.</p>`;
            return;
        }
        const selectedCharsObjects = Array.from(selectedBattleCharacters).map(index => ownedCharacters[index]);
        await setGvgDefense(selectedCharsObjects);
        closeModalHelper(characterSelectionModal);
        currentSelectionContext = 'battle';
        return;
    }

    // NOUVEAU: Gérer le contexte d'attaque GvG
    if (currentSelectionContext === 'gvg_attack') {
        if (selectedBattleCharacters.size !== 3) {
            resultElement.innerHTML = `<p class="text-red-400">Une équipe d'attaque GvG doit contenir exactement 3 personnages.</p>`;
            return;
        }
        const attackerTeam = Array.from(selectedBattleCharacters).map(index => ownedCharacters[index]);
        await executeGvgAttack(attackerTeam);
        closeModalHelper(characterSelectionModal);
        currentSelectionContext = 'battle';
        return;
    }


    let levelData;
    if (typeof currentLevelId === 'string' && currentLevelId.startsWith('tower_')) {
        levelData = window.currentTowerLevelData;
    } else if (currentLevelId === 'pvp_battle') {
        levelData = { id: 'pvp_battle', name: 'Arène PvP', enemy: { name: `l'équipe de ${currentPvpOpponent.name}`, power: currentPvpOpponent.teamPower }, type: 'pvp' };
    } else {
        levelData = allGameLevels.find(l => l.id === currentLevelId);
    }

    const currentMaxTeamSize = calculateMaxTeamSize();

    if (selectedBattleCharacters.size !== currentMaxTeamSize) {
        resultElement.innerHTML = `<p class="text-red-400">Veuillez sélectionner exactement ${currentMaxTeamSize} personnage(s) pour ce combat.</p>`;
        return;
    }

    lastUsedBattleTeamIds = Array.from(selectedBattleCharacters).map(index => ownedCharacters[index].id);
    
    closeModalHelper(characterSelectionModal);

    const selectedCharsObjects = Array.from(selectedBattleCharacters).map(index => ownedCharacters[index]);
    
    if (levelData && levelData.type === 'minigame') {
        launchMiniGame(levelData, selectedCharsObjects);
        return;
    }

    if (currentLevelId === 'raid_battle') {
        executeRaidAttack(selectedCharsObjects);
        return;
    }

    let progress;
    // On ne cherche la progression que pour les niveaux qui en ont une (pas pour le PvP ou la Tour)
    if (levelData && levelData.type !== 'tower' && levelData.type !== 'pvp') {
    progress = storyProgress.find(p => p.id === currentLevelId);
    }
    
    if (!levelData || (levelData.type !== 'tower' && levelData.type !== 'pvp' && !progress)) {
        console.error("Données de niveau ou de progression introuvables. Level ID:", currentLevelId);
        resultElement.innerHTML = `<p class="text-white text-lg">Tire pour obtenir des personnages légendaires !</p>`;
        return;
    }
    
    if (selectedCharsObjects.some(char => char === undefined)) {
        console.error("Un ou plusieurs personnages sélectionnés sont undefined. Indices:", Array.from(selectedBattleCharacters));
        selectedBattleCharacters.clear();
        lastUsedBattleTeamIds = [];
        openModal(characterSelectionModal);
        updateCharacterSelectionDisplay();
        resultElement.innerHTML = '<p class="text-red-500">Erreur de sélection d\'équipe. Veuillez réessayer.</p>';
        return;
    }

    resultElement.innerHTML = `<p class="text-white">${levelData.isInfinite ? 'Plongée dans l\'Abîme Infini...' : 'Combat en cours contre ' + levelData.enemy.name + '...'}</p>`;
    if (animationsEnabled) resultElement.classList.add("animate-pulse");
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

    if (playerScore > enemyScore) {
        if (levelData.type === 'tower') {
            const floorReward = TOWER_CONFIG.rewards.perFloor;
            addGems(floorReward.gems);
            coins += floorReward.coins;
            addExp(floorReward.exp);
            let rewardMessage = `<p>Étage ${towerFloor} terminé ! +${floorReward.gems}G, +${floorReward.coins}P, +${floorReward.exp}EXP.</p>`;

            if (towerFloor > 0 && towerFloor % TOWER_CONFIG.rewards.milestoneFloors === 0) {
                const milestoneReward = TOWER_CONFIG.rewards.milestoneRewards;
                addGems(milestoneReward.gems);
                rewardMessage += `<p class="text-yellow-300">Palier atteint ! +${milestoneReward.gems} Gemmes bonus !</p>`;
                milestoneReward.itemChance.forEach(chance => {
                    if (Math.random() < chance.probability) {
                        const quantity = Math.floor(Math.random() * (chance.maxQuantity - chance.minQuantity + 1)) + chance.minQuantity;
                        inventory[chance.item] = (inventory[chance.item] || 0) + quantity;
                        rewardMessage += `<p class="text-green-400">Vous avez trouvé x${quantity} ${chance.item} !</p>`;
                    }
                });
            }
            battleOutcomeMessage = `<p class="text-green-400 text-2xl font-bold mb-2">Victoire !</p>${rewardMessage}`;
            towerFloor++;

            // --- MODIFICATION ICI ---
            // Mettre à jour le classement public avec le nouvel étage atteint
            if (currentUser) {
                const leaderboardRef = db.collection('leaderboard').doc(currentUser.uid);
                leaderboardRef.update({
                    towerFloor: towerFloor
                }).catch(e => console.error("Erreur de mise à jour du classement Tour:", e));
            }

            } else {
            // Logique pour les niveaux normaux et PvP...
                if (currentLevelId === 'pvp_battle') {
                    let pointsChange = 0; // NOUVEAU
                    if (playerScore > enemyScore) { // VICTOIRE PvP
                        const pointsGained = 10; const pointsLostByDefender = -3;

                        // NOUVEAU: Création du rapport de combat pour le replay
                        const battleReport = {
                            attackerTeam: selectedCharsObjects.map(c => ({ name: c.name, power: c.power, image: c.image, rarity: c.rarity, color: c.color })),
                            defenderTeam: currentPvpOpponent.team,
                            attackerScore: playerScore,
                            defenderScore: enemyScore,
                            outcome: 'victory'
                        };
                        pointsChange = pointsGained; // NOUVEAU
                        playerPvpPoints += pointsGained;
                        battleOutcomeMessage = `<p class="text-green-400 text-2xl font-bold mb-2">Victoire PvP !</p><p class="text-white">Vous avez vaincu ${currentPvpOpponent.name} !</p><p class="text-white">Récompenses: +${pointsGained} Points PvP</p>`;
                        missions.forEach(m => { if (m.type === "pvp_wins" && !m.completed) m.progress++; if (m.type === "pvp_fights" && !m.completed) m.progress++; });

                        pvpLogs.unshift({ id: `log_${Date.now()}_${Math.random()}`, type: 'attack', opponentName: currentPvpOpponent.name, outcome: 'victory', pointsChange: pointsGained, timestamp: Date.now(), read: true });

                        const defenderPlayerSavesRef = db.collection('playerSaves').doc(currentPvpOpponent.id);
                        const defenderInboxRef = defenderPlayerSavesRef.collection('pendingPvpResults');
                        const batch = db.batch();

                        // Ajouter le résultat à la boîte de réception du défenseur pour notification
                        batch.set(defenderInboxRef.doc(), {
                                attackerId: currentUser.uid,
                                attackerName: currentUser.email.split('@')[0],
                                outcome: 'defeat', // Le défenseur a perdu
                                pointsChange: pointsLostByDefender,
                                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                                battleReport: battleReport // NOUVEAU: Ajout du rapport de combat
                        });
                        batch.commit().catch(e => console.error("Erreur lors de l'écriture du résultat pour le défenseur :", e));

                    } else { // DÉFAITE PvP
                        const pointsLost = -5; const pointsGainedByDefender = 3;
                        // NOUVEAU: Création du rapport de combat pour le replay
                        const battleReport = {
                            attackerTeam: selectedCharsObjects.map(c => ({ name: c.name, power: c.power, image: c.image, rarity: c.rarity, color: c.color })),
                            defenderTeam: currentPvpOpponent.team,
                            attackerScore: playerScore,
                            defenderScore: enemyScore,
                            outcome: 'defeat'
                        };
                        const oldPoints = playerPvpPoints; // NOUVEAU
                        playerPvpPoints = Math.max(0, playerPvpPoints + pointsLost); // Add negative value
                        pointsChange = playerPvpPoints - oldPoints; // NOUVEAU
                    battleOutcomeMessage = `<p class="text-red-400 text-2xl font-bold mb-2">Défaite PvP !</p><p class="text-white">Vous avez été vaincu par ${currentPvpOpponent.name} !</p><p class="text-white">Récompenses: ${pointsLost} Points PvP</p>`;
                        missions.forEach(m => { if (m.type === "pvp_fights" && !m.completed) m.progress++; });

                        pvpLogs.unshift({ id: `log_${Date.now()}_${Math.random()}`, type: 'attack', opponentName: currentPvpOpponent.name, outcome: 'defeat', pointsChange: pointsLost, timestamp: Date.now(), read: true });

                        const defenderPlayerSavesRef = db.collection('playerSaves').doc(currentPvpOpponent.id);
                        const defenderInboxRef = defenderPlayerSavesRef.collection('pendingPvpResults');
                        const batch = db.batch();

                        // Ajouter le résultat à la boîte de réception du défenseur pour notification
                        batch.set(defenderInboxRef.doc(), {
                            attackerId: currentUser.uid,
                            attackerName: currentUser.email.split('@')[0],
                            outcome: 'victory', // Le défenseur a gagné
                            pointsChange: pointsGainedByDefender,
                            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                            battleReport: battleReport // NOUVEAU: Ajout du rapport de combat
                        });
                        batch.commit().catch(e => console.error("Erreur lors de l'écriture du résultat pour le défenseur :", e));
                    }

                    // NOUVEAU: Mettre à jour le classement pour l'attaquant
                    if (pointsChange !== 0 && currentUser) {
                        const leaderboardRef = db.collection('leaderboard').doc(currentUser.uid);                        
                        // Utiliser une transaction pour éviter les scores négatifs sur le serveur
                        db.runTransaction(async (transaction) => {
                            const leaderboardDoc = await transaction.get(leaderboardRef);
                            const currentDbPoints = leaderboardDoc.exists ? (leaderboardDoc.data().playerPvpPoints || 0) : 0;
                            const newPoints = Math.max(0, currentDbPoints + pointsChange);
                            transaction.set(leaderboardRef, { 
                                username: currentUser.email.split('@')[0],
                                playerPvpPoints: newPoints,
                                pvpLeague: getPvpRank(newPoints).name
                            }, { merge: true });
                        }).catch(e => console.error("Erreur de mise à jour transactionnelle du classement PvP pour l'attaquant:", e));
                    }

                    findOpponentButton.disabled = false;
                } else { // COMBAT PvE
                    if (playerScore > enemyScore) { // VICTOIRE PvE
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
                        let baseExpRewardForLevel = levelData.rewards.exp;
                        let actualGemsToAward = baseGemsRewardForLevel;
                        let actualExpToAward = baseExpRewardForLevel;
                        let actualCoinsToAward = baseCoinsRewardForLevel;
                        let isRewardReduced = false;
                        const affectedTypesForReduction = ['legendary', 'challenge', 'material'];

                        if (levelData.type === 'story' && !levelData.isInfinite && progress.completed) {
                            actualGemsToAward = Math.floor(baseGemsRewardForLevel * 0.5);
                            actualCoinsToAward = Math.floor(baseCoinsRewardForLevel * 0.5);
                            isRewardReduced = true;
                        } else if (affectedTypesForReduction.includes(levelData.type) && progress.completed) {
                            actualGemsToAward = Math.floor(baseGemsRewardForLevel * 0.5);
                            actualExpToAward = Math.floor(baseExpRewardForLevel * 0.5);
                            isRewardReduced = true;
                        }

                        let fortuneBonusGems = 0, golderBonusGems = 0, golderBonusCoins = 0;
                        selectedCharsObjects.forEach(char => {
                            if (char.trait && char.trait.id && char.trait.grade > 0) {
                                const traitDef = TRAIT_DEFINITIONS[char.trait.id];
                                const gradeDef = traitDef.grades.find(g => g.grade === char.trait.grade);
                                if (gradeDef) {
                                    if (levelData.type === 'story' && char.trait.id === 'fortune' && typeof gradeDef.gemBonusPercentage === 'number') {
                                        fortuneBonusGems += Math.floor(baseGemsRewardForLevel * gradeDef.gemBonusPercentage);
                                    }
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
                        
                        let finalGemsAwarded = actualGemsToAward + fortuneBonusGems + golderBonusGems;
                        let finalCoinsAwarded = actualCoinsToAward + golderBonusCoins;

                        addGems(finalGemsAwarded);
                        coins = Math.min(coins + finalCoinsAwarded, 10000000);
                        addExp(actualExpToAward);
                        selectedCharsObjects.forEach(char => addCharacterExp(char, actualExpToAward));

                        let rewardMessageParts = [];
                        rewardMessageParts.push(`+${finalGemsAwarded} gemmes`);
                        if (isRewardReduced && (levelData.type === 'story' || affectedTypesForReduction.includes(levelData.type))) {
                            rewardMessageParts.push('(réduit)');
                        }
                        if (fortuneBonusGems > 0) rewardMessageParts.push(`(+${fortuneBonusGems} Fortune)`);
                        if (golderBonusGems > 0) rewardMessageParts.push(`(+${golderBonusGems} Golder)`);
                        rewardMessageParts.push(`, +${finalCoinsAwarded} pièces`);
                        if (isRewardReduced && levelData.type === 'story') {
                            rewardMessageParts.push('(réduit)');
                        }
                        if (golderBonusCoins > 0) rewardMessageParts.push(`(+${golderBonusCoins} Golder)`);
                        rewardMessageParts.push(`, +${actualExpToAward} EXP`);
                        if (isRewardReduced && affectedTypesForReduction.includes(levelData.type)) {
                            rewardMessageParts.push('(réduit)');
                        }
                        if (itemRewardText) rewardMessageParts.push(`, ${itemRewardText}`);

                        battleOutcomeMessage = `<p class="text-green-400 text-2xl font-bold mb-2">Victoire !</p><p class="text-white">Victoire contre ${levelData.enemy.name} !</p><p class="text-white">Récompenses: ${rewardMessageParts.join(' ')}</p>`;

                        missions.forEach(mission => {
                            if (!mission.completed) {
                                if (levelData.type === 'story' && mission.type === 'complete_story_levels') mission.progress++;
                                else if (levelData.type === 'legendary' && mission.type === 'complete_legendary_levels') mission.progress++;
                                else if (levelData.type === 'challenge' && mission.type === 'complete_challenge_levels') mission.progress++;
                            }
                        });
                        
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
                        if (animationsEnabled) confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
                        localStorage.setItem("inventory", JSON.stringify(inventory));
                    } else { // DÉFAITE PvE
                        battleOutcomeMessage = `<p class="text-red-400 text-2xl font-bold mb-2">Défaite !</p><p class="text-white">Défaite contre ${levelData.enemy.name} ! Votre puissance: ${playerPower.toFixed(0)} (Score: ${playerScore.toFixed(0)}), Ennemi: ${enemyPower.toFixed(0)} (Score: ${enemyScore.toFixed(0)})</p><p class="text-white">Mieux vous préparer et réessayez !</p>`;
                        selectedCharsObjects.forEach(char => addCharacterExp(char, Math.floor(levelData.rewards.exp / 4)));
                    }
                }
            }
        } // Fin du else pour levelData.isInfinite

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
        updatePvpDisplay();
        updateTowerDisplay();
        updateCharacterDisplay();
        updateIndexDisplay();
        updateUI();
        updateItemDisplay();

        scheduleSave(); // CORRECTION: Appel de la bonne fonction de sauvegarde
    } // Accolade fermante correcte pour confirmSelection

    async function processPendingPvpResults() {
        if (!currentUser) return;

        const playerSavesRef = db.collection('playerSaves').doc(currentUser.uid);
        const resultsRef = playerSavesRef.collection('pendingPvpResults').orderBy('timestamp', 'asc');

        try {
            const querySnapshot = await resultsRef.get();
            if (querySnapshot.empty) return;

            console.log(`[PvP] ${querySnapshot.size} résultat(s) en attente trouvé(s). Traitement en cours...`);
            
            let totalPointsChange = 0;
            const docsToDelete = [];
            const newLogs = [];

            querySnapshot.forEach(doc => {
                const data = doc.data();
                const logTimestamp = data.timestamp ? data.timestamp.toDate() : new Date();
                totalPointsChange += (data.pointsChange || 0);

                newLogs.unshift({
                    id: `log_${logTimestamp.getTime()}_${Math.random()}`,
                    type: 'defense',
                    opponentName: data.attackerName || 'Un joueur',
                    outcome: data.outcome,
                    battleReport: data.battleReport || null, // NOUVEAU: Sauvegarder le rapport de combat
                    pointsChange: data.pointsChange,
                    timestamp: logTimestamp.getTime(),
                    read: false
                });
                docsToDelete.push(doc.ref);
            });

            if (newLogs.length === 0) return;

            // Mettre à jour les logs locaux en premier
            pvpLogs.unshift(...newLogs);
            if (pvpLogs.length > 50) {
                pvpLogs.length = 50;
            }

            // Utiliser une transaction pour mettre à jour les points en toute sécurité sur le serveur
            const leaderboardRef = db.collection('leaderboard').doc(currentUser.uid);
            await db.runTransaction(async (transaction) => {
                const playerSavesDoc = await transaction.get(playerSavesRef);
                
                const currentPoints = playerSavesDoc.exists ? (playerSavesDoc.data().playerPvpPoints || 0) : 0;
                const newPoints = Math.max(0, currentPoints + totalPointsChange);

                // Mettre à jour les deux documents dans la transaction
                transaction.update(playerSavesRef, { 
                    playerPvpPoints: newPoints,
                    pvpLogs: pvpLogs // Sauvegarder le tableau de logs mis à jour
                });
                transaction.set(leaderboardRef, { playerPvpPoints: newPoints }, { merge: true });
            });

            // Supprimer les résultats traités dans un batch séparé
            const deleteBatch = db.batch();
            docsToDelete.forEach(ref => deleteBatch.delete(ref));
            await deleteBatch.commit();
            
            // Mettre à jour la variable de points locale
            playerPvpPoints = Math.max(0, playerPvpPoints + totalPointsChange);
            
            console.log(`[PvP] Traitement des résultats terminé. Nouveaux points : ${playerPvpPoints}`);
            updatePvpDisplay();
            updatePvpLogsNotification();
            updateUI();

        } catch (error) {
            console.error("Erreur lors du traitement des résultats PvP en attente:", error);
        }
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

    function updateDailyDungeonDisplay() {
        const dailyDungeonListElement = document.getElementById("daily-dungeon-list");
        if (!dailyDungeonListElement) return;

        const now = new Date();
        const currentDay = now.getDay(); // 0 for Sunday, 1 for Monday, etc.
        const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

        const dailyDungeons = allGameLevels.filter(l => l.type === 'daily');

        if (dailyDungeons.length === 0) {
            dailyDungeonListElement.innerHTML = "<p class='text-white col-span-full text-center'>Aucun donjon quotidien disponible.</p>";
            return;
        }

        dailyDungeonListElement.innerHTML = dailyDungeons.map(level => {
            const isAvailableToday = level.dayOfWeek === currentDay;
            const progress = storyProgress.find(p => p.id === level.id) || { unlocked: true, completed: false };
            const isDisabled = !isAvailableToday;
            
            let buttonClass = 'bg-gray-600'; // Default for locked
            if (isAvailableToday) {
                buttonClass = 'bg-cyan-600 hover:bg-cyan-700';
            }

            const itemDrops = Array.isArray(level.rewards.itemChance) 
                ? level.rewards.itemChance.map(ic => `${ic.item} (${(ic.probability * 100).toFixed(0)}%)`).join(', ') 
                : (level.rewards.itemChance?.item || 'N/A');

            return `
                <div class="p-3 rounded-lg ${isAvailableToday ? 'bg-gray-700 border-2 border-cyan-500' : 'bg-gray-800 opacity-60'}">
                    <h4 class="text-lg font-bold ${isAvailableToday ? 'text-cyan-300' : 'text-gray-400'}">${level.name}</h4>
                    <p class="text-sm text-gray-400 mb-2">Disponible le : ${days[level.dayOfWeek]}</p>
                    <div class="text-xs text-gray-300 mb-3">
                        <p>Ennemi: ${level.enemy.name} (Puissance: ${level.enemy.power.toLocaleString()})</p>
                        <p>Drops Principaux: ${itemDrops}</p>
                    </div>
                    <button class="level-start-button w-full ${buttonClass} text-white py-2 px-4 rounded-lg transition-colors duration-200 ${isDisabled ? 'cursor-not-allowed' : ''}"
                            data-level-id="${level.id}" ${isDisabled ? 'disabled' : ''}>
                        ${isAvailableToday ? 'Entrer' : 'Indisponible'}
                    </button>
                </div>
            `;
        }).join('');
    }

    function startTowerFloor() {
        const enemyPower = Math.floor(TOWER_CONFIG.baseEnemyPower * Math.pow(TOWER_CONFIG.powerIncreasePerFloor, towerFloor - 1));
        const towerLevelData = { id: `tower_${towerFloor}`, name: `Tour Infinie - Étage ${towerFloor}`, enemy: { name: `Gardien de l'Étage ${towerFloor}`, power: enemyPower }, type: 'tower' };
        currentLevelId = towerLevelData.id;
        window.currentTowerLevelData = towerLevelData;
        selectedBattleCharacters.clear();
        openModal(characterSelectionModal);
        updateCharacterSelectionDisplay();
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
      closeModalHelper(settingsModal);
      console.log("Paramètres sauvegardés:", { soundEnabled, animationsEnabled, theme, autosellSettings });
    }

    function resetGame() {
        console.log("resetGame appelé");
        openModal(resetConfirmModal);
        // La confirmation se fera via le bouton de la modale
    }

    // NOUVEAU: Fonction pour nettoyer les listeners de guilde
    function cleanupGuildListeners() {
        if (guildDataListener) guildDataListener();
        if (guildChatListener) guildChatListener();
        guildDataListener = null;
        guildChatListener = null;
        playerGuildData = null;
    }

    // APRÈS
    async function confirmReset() {
        console.log("Réinitialisation de la partie pour l'utilisateur:", currentUser.uid);
        closeModalHelper(resetConfirmModal);
        closeModalHelper(settingsModal); // NOUVEAU: Ferme la modale des paramètres

        // Supprimer la sauvegarde de la base de données
        if (currentUser) {
            // Utiliser un batch pour supprimer les deux documents atomiquement
            const batch = db.batch();
            const playerSavesRef = db.collection('playerSaves').doc(currentUser.uid);
            const leaderboardRef = db.collection('leaderboard').doc(currentUser.uid);

            batch.delete(playerSavesRef); // Supprime la sauvegarde principale (classements niveau, tour, etc.)
            batch.delete(leaderboardRef); // Supprime la sauvegarde du classement PvP

            await batch.commit();
        }

        // NOUVEAU: Nettoyer les listeners de guilde
        cleanupGuildListeners();
        
        if (leaderboardListener) leaderboardListener();
        if (pvpLeaderboardListener) pvpLeaderboardListener();
        if (towerLeaderboardListener) towerLeaderboardListener();
        leaderboardListener = null;
        pvpLeaderboardListener = null;
        towerLeaderboardListener = null;

        // --- NOUVEAU: Réinitialisation complète des paramètres ---
        // 1. Supprimer les clés de paramètres du localStorage
        localStorage.removeItem("soundEnabled");
        localStorage.removeItem("towerFloor"); localStorage.removeItem("savedTeams");
        localStorage.removeItem("animationsEnabled");
        localStorage.removeItem("theme");
        localStorage.removeItem("autosellSettings");
        localStorage.removeItem("sortCriteria");
        localStorage.removeItem("battleSortCriteria"); localStorage.removeItem("teamEditorSortCriteria");
        localStorage.removeItem("battleSearchName");
        localStorage.removeItem("battleFilterRarity");
        localStorage.removeItem("teamEditorSearchName");
        localStorage.removeItem("teamEditorFilterRarity");
        localStorage.removeItem("fusionSearchName");
        localStorage.removeItem("fusionFilterRarity");
        localStorage.removeItem("inventoryFilterName");
        localStorage.removeItem("inventoryFilterRarity");
        localStorage.removeItem("inventoryFilterEvolvable");
        localStorage.removeItem("inventoryFilterLimitBreak");
        localStorage.removeItem("inventoryFilterCanReceiveExp");
        let fusionSearchName = localStorage.getItem("fusionSearchName") || "";
        let fusionFilterRarity = localStorage.getItem("fusionFilterRarity") || "all";
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
        teamEditorSortCriteria = "power";
        battleSearchName = "";
        battleFilterRarity = "all";
        teamEditorSearchName = "";
        teamEditorFilterRarity = "all";
        fusionSearchName = "";
        fusionFilterRarity = "all";
        inventoryFilterRarity = "all";
        inventoryFilterEvolvable = false;
        inventoryFilterLimitBreak = false;
        inventoryFilterCanReceiveExp = false;
        savedTeams = []; // --- FIN NOUVEAU ---
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
      closeModalHelper(resetConfirmModal);
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
        "Cursed Token": "./images/items/Curse_Tokens.webp",
        "Boost EXP x2": "https://via.placeholder.com/150?text=BoostEXP",
        "Shadow Tracer": "./images/items/Shadow_Tracer.webp",
        "Blood-Red Armor": "./images/items/Blood_Red_Armor.webp",
        "Reroll Token": "./images/items/Trait_Reroll.webp",
        "Jeton de Guilde": "./images/items/Guild_Token.webp",
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
        "Fragment Étoilé": "./images/items/Fragment_Etoile.webp",
        "Coeur de Nébuleuse": "./images/items/Coeur_Nebuleuse.webp",
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
        if (!currentUser || !isGameInitialized) { return; }
        console.log(`%c[SAVE] Déclenchement de la sauvegarde sur Firestore... (Gemmes: ${gems})`, 'color: #7CFC00');
        
        const saveData = {
            username: currentUser.email.split('@')[0],
            characterIdCounter, gems, coins, pullCount, ownedCharacters, level, exp, pullTickets,
            playerSeasonData, // NOUVEAU
            missions, shopOffers, shopRefreshTime, storyProgress, inventory, playerGuildId, towerFloor, defaultBattleTeamId,
            playerPvpPoints, // AJOUT: Sauvegarde des points PvP
            savedTeams, pvpLogs, standardPityCount, specialPityCount,
            lastUsedBattleTeamIds, autosellSettings, expMultiplier, expBoostEndTime, discoveredCharacters, // `characterPreset` et `presetConfirmed` sont supprimés
            everOwnedCharacters, raidAttempts, // NOUVEAU
            lastRaidAttemptDate, // NOUVEAU
            defenseTeamIds, // <-- AJOUTEZ CETTE LIGNE !
            lastLoginDate, // NOUVEAU
            loginStreak,   // NOUVEAU
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
                const saveData = doc.data();
                initializeGameData(saveData);

                // --- AJOUT : Vérification et création du document de classement ---
                const leaderboardRef = db.collection('leaderboard').doc(userId);
                const leaderboardDoc = await leaderboardRef.get();
                if (!leaderboardDoc.exists) {
                    console.log("Migration: Le document de classement n'existe pas pour cet utilisateur. Création en cours...");
                    await leaderboardRef.set({
                        username: saveData.username || currentUser.email.split('@')[0],
                        level: saveData.level || 1,
                        exp: saveData.exp || 0,
                        playerPvpPoints: saveData.playerPvpPoints || 0,
                        towerFloor: saveData.towerFloor || 1
                    });
                }
                // --- FIN DE L'AJOUT ---

                processPendingPvpResults(); 
                // NOUVEAU: Initialisation des systèmes de saison et de brawl
                initializeSeason();
                initializeBrawlMode();

                checkMailbox();
                setupPvpResultsListener(userId);
                
                if (saveData.playerGuildId) {
                    loadAndDisplayGuildData(saveData.playerGuildId);
                }
            } else {
                initializeGameData(null);
                // NOUVEAU: Initialisation pour un nouveau joueur
                initializeSeason();
                initializeBrawlMode();
            }
            checkDailyLogin();
        } catch (error) {
            console.error("Erreur lors du chargement de la progression:", error);
            initializeGameData(null);
            checkDailyLogin();
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
      
      // Logique pour le mode suppression
      deleteButton.textContent = isDeleteMode ? "Quitter le mode suppression" : "Activer le mode suppression";
      deleteButton.classList.toggle("bg-gray-500", isDeleteMode);
      deleteButton.classList.toggle("hover:bg-gray-600", isDeleteMode);
      deleteButton.classList.toggle("bg-red-500", !isDeleteMode);
      deleteButton.classList.toggle("hover:bg-red-600", !isDeleteMode);

      if (isDeleteMode) {
          const count = selectedCharacterIndices.size;
          sellSelectedButton.textContent = `Vendre (${count}) personnage(s)`;
          sellSelectedButton.disabled = count === 0;
          sellSelectedButton.classList.toggle('opacity-50', count === 0);
          sellSelectedButton.classList.toggle('cursor-not-allowed', count === 0);
      }

      // Cacher le bouton "Gérer les Équipes" en mode suppression
      if (manageTeamsButton) {
          manageTeamsButton.classList.toggle('hidden', isDeleteMode);
      }

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
      updatePvpLogsNotification();
    }

    // NOUVEAU: Fonctions pour le bonus de connexion
    function showDailyLoginModal() {
        const modal = document.getElementById('daily-login-modal');
        const grid = document.getElementById('daily-login-grid');
        const actionArea = document.getElementById('daily-login-action');
        if (!modal || !grid || !actionArea) return;

        grid.innerHTML = '';
        dailyLoginRewards.forEach(rewardInfo => {
            const isClaimed = rewardInfo.day < loginStreak;
            const isToday = rewardInfo.day === loginStreak;

            const card = document.createElement('div');
            card.className = 'daily-reward-card';
            if (isClaimed) card.classList.add('claimed');
            if (isToday) card.classList.add('today');

            card.innerHTML = `
                <p class="day-label">Jour ${rewardInfo.day}</p>
                <img src="${rewardInfo.image}" alt="${rewardInfo.description}">
                <p class="reward-label">${rewardInfo.description}</p>
            `;
            grid.appendChild(card);
        });

        actionArea.innerHTML = `<button id="claim-daily-reward-btn" class="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-8 rounded-lg text-xl transition transform hover:scale-105">Réclamer</button>`;
        document.getElementById('claim-daily-reward-btn').addEventListener('click', claimDailyReward);

        openModal(modal);
    }

    function claimDailyReward() {
        const rewardInfo = dailyLoginRewards.find(r => r.day === loginStreak);
        if (!rewardInfo) return;

        const reward = rewardInfo.reward;
        let rewardMessage = "";

        if (reward.gems) { addGems(reward.gems); rewardMessage = `${reward.gems} gemmes`; }
        else if (reward.coins) { coins += reward.coins; rewardMessage = `${reward.coins} pièces`; }
        else if (reward.pullTickets) { pullTickets += reward.pullTickets; inventory["Pass XP"] = (inventory["Pass XP"] || 0) + reward.pullTickets; rewardMessage = `${reward.pullTickets} Ticket(s) de Tirage`; }
        else if (reward.item) { inventory[reward.item] = (inventory[reward.item] || 0) + reward.quantity; rewardMessage = `${reward.quantity}x ${reward.item}`; }

        resultElement.innerHTML = `<p class="text-green-400">Récompense du jour ${loginStreak} réclamée : +${rewardMessage} !</p>`;
        lastLoginDate = new Date().toISOString().split('T')[0];
        closeModalHelper(document.getElementById('daily-login-modal'));
        updateUI();
        updateItemDisplay();
        scheduleSave();
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
        let newLevel = level; // Variable temporaire pour suivre le niveau
        
        // Utiliser newLevel pour le calcul dans la boucle
        while (exp >= 50 * newLevel * newLevel) { 
            exp -= 50 * newLevel * newLevel;
            newLevel++; // Incrémenter le niveau temporaire
            leveledUp = true;
            gems = Math.min(gems + 100, 1000000000); 
            coins = Math.min(coins + 20, 10000000);   
            resultElement.innerHTML = `<p class="text-green-400">Niveau ${newLevel} atteint ! +100 gemmes, +20 pièces</p>`;
        }
        
        if (leveledUp) {
            level = newLevel; // Appliquer le nouveau niveau à la variable globale
            missions.forEach(mission => {
                if (mission.type === "level_up" && !mission.completed) {
                    mission.progress++;
                }
            });
        }

        // Mettre à jour le classement public avec le nouveau niveau ET l'EXP actuelle
        if (currentUser) {
            const leaderboardRef = db.collection('leaderboard').doc(currentUser.uid);
            // Utiliser set avec merge:true pour créer le document s'il n'existe pas, ou le mettre à jour sinon.
            leaderboardRef.set({ level: level, exp: exp }, { merge: true })
                .catch(e => console.error("Erreur de mise à jour du classement Niveau/EXP:", e));
        }

        checkMissions();
        updateUI();
        // La sauvegarde (scheduleSave) sera appelée par l'action parente (combat, etc.)
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

    function createSummonGridCardHTML(char) {
        let rarityTextColorClass = char.color;
        if (char.rarity === "Mythic") rarityTextColorClass = "rainbow-text";
        else if (char.rarity === "Vanguard") rarityTextColorClass = "text-vanguard";
        else if (char.rarity === "Secret") rarityTextColorClass = "text-secret";

        // Structure simple avec des classes uniques pour éviter les conflits
        return `
            <div class="summon-grid-card-inner ${getRarityBorderClass(char.rarity)}">
                <img src="${char.image}" alt="${char.name}" class="summon-grid-card-img" loading="lazy" decoding="async">
                <div class="summon-grid-card-text mt-auto">  <!-- AJOUT DE LA CLASSE "mt-auto" ICI -->
                    <p class="summon-grid-card-name">${char.name}</p>
                    <p class="summon-grid-card-rarity ${rarityTextColorClass}">${char.rarity}</p>
                </div>
            </div>
        `;
    }

    /**
     * Gère l'animation de tirage complète, interactive et adaptative (x1 ou x10).
     * En multi-tirage, un seul clic révèle tous les cristaux qui se retournent pour afficher les personnages.
     * @param {Array<Object>} pulledCharacters - Tableau des personnages obtenus.
     * @param {string} summaryMessage - Message récapitulatif post-animation.
     */
    async function runSummonAnimation(pulledCharacters, summaryMessage = '') {
        if (animationsEnabled) {
            const isMultiPull = pulledCharacters.length > 1;
            openModal(summonAnimationModal);

            // --- INITIALISATION DE L'UI DE LA MODALE ---
            summonResultsGrid.innerHTML = '';
            summonCrystalContainer.classList.toggle('hidden', isMultiPull);
            summonMultiGrid.classList.toggle('hidden', !isMultiPull);
            summonRevealArea.innerHTML = ''; // Nettoyer la zone de la carte du tirage x1

            if (isMultiPull) {
                summonMultiGrid.innerHTML = '';
                pulledCharacters.forEach((char) => {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'summon-grid-crystal-wrapper';
                    const img = document.createElement('img');
                    img.src = './images/items/Crystal.webp';
                    img.className = 'summon-grid-crystal';
                    wrapper.appendChild(img);
                    const cardContainer = document.createElement('div');
                    cardContainer.className = 'summon-grid-card';
                    cardContainer.innerHTML = createSummonGridCardHTML(char);
                    wrapper.appendChild(cardContainer);
                    summonMultiGrid.appendChild(wrapper);
                    const glowClass = rarityOrder[char.rarity] >= rarityOrder['Vanguard'] ? 'glow-vanguard'
                                    : rarityOrder[char.rarity] >= rarityOrder['Secret'] ? 'glow-secret'
                                    : rarityOrder[char.rarity] >= rarityOrder['Mythic'] ? 'glow-mythic'
                                    : null;
                    if (glowClass) {
                        wrapper.classList.add(glowClass);
                    }
                });
                await waitForClick();
                const crystalWrappers = summonMultiGrid.querySelectorAll('.summon-grid-crystal-wrapper');
                for (const wrapper of crystalWrappers) {
                    if (soundEnabled) pullSound.play().catch(e => {});
                    wrapper.classList.add('revealing');
                    await delay(100);
                }
            } else if (pulledCharacters.length === 1) {
                const char = pulledCharacters[0];
                summonRevealArea.innerHTML = '';
                summonCrystalContainer.innerHTML = '';
                const wrapper = document.createElement('div');
                wrapper.className = 'summon-grid-crystal-wrapper';
                const img = document.createElement('img');
                img.src = './images/items/Crystal.webp';
                img.className = 'summon-grid-crystal';
                wrapper.appendChild(img);
                const cardContainer = document.createElement('div');
                cardContainer.className = 'summon-grid-card';
                cardContainer.innerHTML = createSummonGridCardHTML(char);
                wrapper.appendChild(cardContainer);
                const glowClass = rarityOrder[char.rarity] >= rarityOrder['Vanguard'] ? 'glow-vanguard'
                            : rarityOrder[char.rarity] >= rarityOrder['Secret'] ? 'glow-secret'
                            : rarityOrder[char.rarity] >= rarityOrder['Mythic'] ? 'glow-mythic'
                            : rarityOrder[char.rarity] >= rarityOrder['Légendaire'] ? 'glow-legendary'
                            : rarityOrder[char.rarity] >= rarityOrder['Épique'] ? 'glow-epic'
                            : 'glow-rare';
                wrapper.classList.add(glowClass);
                summonCrystalContainer.appendChild(wrapper);
                await waitForClick();
                if (soundEnabled) pullSound.play().catch(()=>{});
                wrapper.classList.add('revealing');
                await delay(600);
            }

            const clickToCloseIndicator = document.createElement('p');
            clickToCloseIndicator.className = 'absolute bottom-4 sm:bottom-20 left-0 right-0 text-center text-white/90 text-lg animate-pulse z-50 drop-shadow-lg';
            clickToCloseIndicator.textContent = 'Cliquez pour continuer';
            summonAnimationModal.appendChild(clickToCloseIndicator);

            await waitForClick();

            clickToCloseIndicator.remove();
            closeModalHelper(summonAnimationModal);

            summonCrystalContainer.classList.remove('hidden');
            summonMultiGrid.classList.add('hidden');

            resultElement.innerHTML = `<p class="text-green-400">${summaryMessage || 'Tirage terminé !'}</p>`;
            setTimeout(() => {
                if (resultElement.innerHTML.includes(summaryMessage) || resultElement.innerHTML.includes('Tirage terminé !')) {
                    resultElement.innerHTML = `<p class="text-white text-lg">Tire pour obtenir des personnages légendaires !</p>`;
                }
            }, 5000);
        } else {
            // Quand les animations sont désactivées, on met juste à jour le message de résultat principal.
            resultElement.innerHTML = `<p class="text-green-400">${summaryMessage || 'Tirage terminé !'}</p>`;

            // Nettoyer le message de résultat après un délai
            setTimeout(() => {
                if (resultElement.innerHTML.includes(summaryMessage) || resultElement.innerHTML.includes('Tirage terminé !')) {
                    resultElement.innerHTML = `<p class="text-white text-lg">Tire pour obtenir des personnages légendaires !</p>`;
                }
            }, 5000);
        }
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

        await runSummonAnimation(pulledCharsForDisplay, message); // MODIFIÉ: On passe isAutoMode
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

        await runSummonAnimation(autoSold ? [] : [characterWithId], message); // MODIFIÉ: On passe isAutoMode
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
        await runSummonAnimation(results, message); // MODIFIÉ: On passe isAutoMode

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
        openModal(statsModal);

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

    // Helper function to open a modal
    function openModal(modalElement) {
        if (modalElement) {
            modalElement.classList.remove("hidden");
            enableNoScroll();
        }
    }

    // Helper function to close a modal (renamed to avoid conflict with closeModalButton)
    function closeModalHelper(modalElement) {
        if (modalElement) {
            modalElement.classList.add("hidden");
            disableNoScroll();
        }
    }

    function closeModal() { // This specific one is for the statsModal via its button
      closeModalHelper(statsModal);
    }

    function toggleDeleteMode() {
        isDeleteMode = !isDeleteMode;
        selectedCharacterIndices.clear(); // Toujours vider la sélection en entrant/sortant du mode

        sellSelectedButton.classList.toggle('hidden', !isDeleteMode);
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
        const trulyDeletedIds = [];
        ownedCharacters = ownedCharacters.filter(char => {
            if (selectedCharacterIndices.has(char.id) && !char.locked) {
                trulyDeletedIds.push(char.id);
                return false; // Supprimer
            }
            return true; // Conserver
        });

        if (actualDeletedCount > 0) { // actualDeletedCount est basé sur la sélection, pas sur trulyDeletedIds
            addGems(totalGemsGained); 
            coins = Math.min(coins + totalCoinsGained, 10000000); 
            resultElement.innerHTML = `<p class="text-green-400">${actualDeletedCount} personnage(s) non verrouillé(s) sélectionné(s) pour suppression ont été supprimé(s) ! +${totalGemsGained} gemmes, +${totalCoinsGained} pièces</p>`;
        
            // Nettoyer les IDs des personnages supprimés de lastUsedBattleTeamIds et characterPreset
            trulyDeletedIds.forEach(deletedId => {
                lastUsedBattleTeamIds = lastUsedBattleTeamIds.filter(id => id !== deletedId);
            savedTeams.forEach(team => { team.characterIds = team.characterIds.filter(id => id !== deletedId); });
            });
            localStorage.setItem("lastUsedBattleTeamIds", JSON.stringify(lastUsedBattleTeamIds));

        } else {
            resultElement.innerHTML = `<p class="text-yellow-400">Aucun personnage non verrouillé n'a été sélectionné pour la suppression ou supprimé.</p>`;
        }
        
        selectedCharacterIndices.clear();
        checkMissions();
        updateCharacterDisplay();
        updateIndexDisplay();
        updateUI();
        scheduleSave(); 
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

    function setupPvpResultsListener(userId) {
        // Si un ancien écouteur est déjà actif, on le désactive pour éviter les doublons
        if (pvpResultsListener) {
            pvpResultsListener();
        }

        const resultsRef = db.collection('playerSaves').doc(userId).collection('pendingPvpResults');

        // C'est ici la magie : .onSnapshot s'exécute à chaque changement
        pvpResultsListener = resultsRef.onSnapshot(querySnapshot => {
            // Si la collection n'est pas vide, ça veut dire qu'on a été attaqué
            if (!querySnapshot.empty) {
                console.log("[PvP Listener] Nouveau(x) résultat(s) de combat détecté(s) !");
                const pvpLogsBadge = document.getElementById('pvp-logs-badge');
                if (pvpLogsBadge) {
                    // On affiche simplement la notification. Le traitement se fera plus tard.
                    pvpLogsBadge.classList.remove('hidden');
                }
            }
        }, error => {
            console.error("[PvP Listener] Erreur d'écoute des résultats PvP:", error);
        });
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
                // Remplacer la création manuelle par un appel à la nouvelle fonction
                const cardDiv = createCharacterCard(char, -1, 'inventory');
                fragment.appendChild(cardDiv); // Ajouter la carte au fragment
            });
        }
        characterDisplay.appendChild(fragment); // Ajouter le fragment au DOM en une seule fois
    }

    function updateCharacterSelectionDisplay() {
        characterSelectionList.innerHTML = ""; // Clear existing content

        // MODIFIÉ: Gérer les différents contextes de sélection (Combat, GvG, Co-op)
        const isGvgDefenseSelection = currentSelectionContext === 'gvg_defense';
        const isCoopSelection = coopCharacterSelectionCallback !== null;
        let currentMaxTeamSize = 3; // Taille par défaut
        let teamCost = 0; // NOUVEAU: Pour le mode Brawl
        if (isCoopSelection) {
            currentMaxTeamSize = 1;
        } else if (isGvgDefenseSelection) {
            currentMaxTeamSize = 3;
        } else {
            currentMaxTeamSize = calculateMaxTeamSize();
        }
        // NOUVEAU: Ajuster la taille max pour le mode Brawl si nécessaire (ici, on garde la même)
        if (currentBattleMode === 'brawl' && currentBrawlMode.rules.maxTeamSize) {
            currentMaxTeamSize = currentBrawlMode.rules.maxTeamSize;
        }

        const modalTitle = document.getElementById("character-selection-title");
        if (modalTitle) {
            if (isCoopSelection) {
                modalTitle.textContent = `Sélectionner 1 Personnage pour le Combat Co-op`;
            } else if (isGvgDefenseSelection) {
                modalTitle.textContent = `Sélectionner 3 Personnages pour la Défense GvG`;
            } else if (currentBattleMode === 'brawl') {
                modalTitle.textContent = `Brawl : ${currentBrawlMode.name}`;
            } else {
                modalTitle.textContent = `Sélectionner ${currentMaxTeamSize} Personnage(s) pour le Combat`;
            }
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

        // NOUVEAU: Filtres spécifiques au mode Brawl
        if (currentBattleMode === 'brawl' && currentBrawlMode) {
            if (currentBrawlMode.rules.maxRarity) {
                const maxRarityOrder = rarityOrder[currentBrawlMode.rules.maxRarity];
                charactersToDisplay = charactersToDisplay.filter(char => rarityOrder[char.rarity] <= maxRarityOrder);
            }
            if (currentBrawlMode.rules.requiredTrait) {
                charactersToDisplay = charactersToDisplay.filter(char => char.trait && char.trait.id === currentBrawlMode.rules.requiredTrait);
            }
        }

        if (currentBattleMode === 'brawl' && currentBrawlMode.rules.maxTotalCost) {
            teamCost = Array.from(selectedBattleCharacters).reduce((sum, index) => sum + (currentBrawlMode.rules.costs[ownedCharacters[index].rarity] || 0), 0);
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
                if (originalIndex === -1) return; // Should not happen if sortedCharacters is derived from ownedCharacters
                // MODIFICATION: Utiliser la nouvelle fonction createCharacterCard
                const cardElement = createCharacterCard(char, originalIndex, 'battleSelection');
                fragment.appendChild(cardElement);
            });
            characterSelectionList.appendChild(fragment);
        }
        
        let countText = `${selectedBattleCharacters.size}/${currentMaxTeamSize}`;
        let isSelectionInvalid = selectedBattleCharacters.size !== currentMaxTeamSize;

        if (currentBattleMode === 'brawl' && currentBrawlMode.rules.maxTotalCost) {
            countText += ` | Coût: ${teamCost}/${currentBrawlMode.rules.maxTotalCost}`;
            if (teamCost > currentBrawlMode.rules.maxTotalCost) {
                isSelectionInvalid = true;
            }
        }

        selectedCountElement.textContent = countText;
        confirmSelectionButton.disabled = isSelectionInvalid;
        confirmSelectionButton.classList.toggle("opacity-50", confirmSelectionButton.disabled);
        confirmSelectionButton.classList.toggle("cursor-not-allowed", confirmSelectionButton.disabled);
        
        const battleSortCriteriaSelect = document.getElementById("battle-sort-criteria");
        if (battleSortCriteriaSelect) battleSortCriteriaSelect.value = battleSortCriteria;
    }

    function selectBattleCharacter(index) {
        const isCoopSelection = coopCharacterSelectionCallback !== null;

        if (isCoopSelection) {
            // Pour le co-op, c'est une sélection unique. Cliquer sélectionne et désélectionne le reste.
            if (selectedBattleCharacters.has(index)) {
                selectedBattleCharacters.delete(index); // Désélectionner si on clique sur le même
            } else {
                selectedBattleCharacters.clear();
                selectedBattleCharacters.add(index);
            }
        } else {
            // Logique de combat normal
            const characterToAdd = ownedCharacters[index];
            if (selectedBattleCharacters.has(index)) {
                selectedBattleCharacters.delete(index);
            } else {
                // Vérifier la taille de l'équipe potentielle
                const potentialTeam = new Set(selectedBattleCharacters).add(index);
                const potentialMaxSize = 3 + Array.from(potentialTeam).reduce((maxBonus, idx) => {
                    const char = ownedCharacters[idx];
                    return Math.max(maxBonus, char?.passive?.teamSizeBonus || 0);
                }, 0);

                // Vérifier les doublons de nom et la taille
                const hasNameDuplicate = Array.from(selectedBattleCharacters).some(idx => ownedCharacters[idx].name === characterToAdd.name);

                if (potentialTeam.size <= potentialMaxSize && !hasNameDuplicate) {
                    // NOUVEAU: Vérification du coût pour le mode Brawl
                    if (currentBattleMode === 'brawl' && currentBrawlMode.rules.maxTotalCost) {
                        const newCost = Array.from(potentialTeam).reduce((sum, index) => sum + (currentBrawlMode.rules.costs[ownedCharacters[index].rarity] || 0), 0);
                        if (newCost > currentBrawlMode.rules.maxTotalCost) {
                            return; // Ne pas ajouter si le coût dépasse
                        }
                    }
                    selectedBattleCharacters.add(index);
                }
            }
        }
        updateCharacterSelectionDisplay();
    }

    function cancelSelection() {
        // NOUVEAU: Gérer l'annulation de la sélection de personnage pour le mode co-op
        if (coopCharacterSelectionCallback) {
            console.log("Annulation de la sélection de personnage en mode co-op.");
            coopCharacterSelectionCallback = null; // Réinitialiser le callback pour éviter des effets de bord
            selectedBattleCharacters.clear();
            closeModalHelper(characterSelectionModal);
            
            // La partie cruciale : quitter (et potentiellement supprimer) la salle
            leaveCoopRoom(); 
            
            return; // Important: arrêter l'exécution ici pour ne pas continuer avec la logique normale
        }

        // Comportement normal pour les autres modes (histoire, pvp, etc.)
        selectedBattleCharacters.clear();
        closeModalHelper(characterSelectionModal);
        updateLevelDisplay();
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
      closeModalHelper(statsModal); // Fermer la modale stats si elle était ouverte
      openModal(fusionModal);

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

        const searchNameInput = document.getElementById("fusion-search-name");
        const filterRaritySelect = document.getElementById("fusion-filter-rarity");
        if (searchNameInput) searchNameInput.value = fusionSearchName;
        if (filterRaritySelect) filterRaritySelect.value = fusionFilterRarity;

        let availableForFusion = ownedCharacters.filter(char => char.id !== currentFusionCharacterId && !char.locked);

        if (fusionSearchName) {
            availableForFusion = availableForFusion.filter(char => (char.name || "").toLowerCase().includes(fusionSearchName));
        }
        if (fusionFilterRarity !== "all") {
            availableForFusion = availableForFusion.filter(char => char.rarity === fusionFilterRarity);
        }

        const fragment = document.createDocumentFragment();
        availableForFusion.forEach((char) => {
            // MODIFICATION: Utiliser la nouvelle fonction createCharacterCard
            const cardElement = createCharacterCard(char, -1, 'fusionSelection');
            fragment.appendChild(cardElement);
        });
        fusionSelectionList.appendChild(fragment);

        if (availableForFusion.length === 0) {
            fusionSelectionList.innerHTML = '<p class="text-gray-400 col-span-full">Aucun personnage non verrouillé disponible pour la fusion (ou correspondant aux filtres).</p>';
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
      closeModalHelper(fusionModal);
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
        closeModalHelper(fusionModal);
        return;
      }
      if (mainChar.level >= 100) {
        console.log("Personnage au niveau maximum");
        resultElement.innerHTML = '<p class="text-red-400">Ce personnage est déjà au niveau maximum (100) !</p>';
        closeModalHelper(fusionModal);
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
      const trulyFusedIds = new Set();
      let charactersSkipped = 0;

      idsToDelete.forEach(id => {
        const char = ownedCharacters.find(c => c.id === id);
        if (!char) {
            console.log("Personnage à fusionner non trouvé, id:", id);
            return;
        }
        // --- AJOUT DE LA VÉRIFICATION ---
        if (char.locked) {
            console.log(`Fusion du personnage verrouillé ${char.name} ignorée.`);
            charactersSkipped++;
            return; // Ne pas traiter ce personnage
        }
        // --- FIN DE L'AJOUT ---

        const expGained = expByRarity[char.rarity] || 25;
        totalExpGained += expGained;
        fusionSummary[char.rarity] = (fusionSummary[char.rarity] || 0) + 1;
        trulyFusedIds.add(id); // Ajouter seulement si non verrouillé
      });

      addCharacterExp(mainChar, totalExpGained);

      // --- MODIFICATION : Filtrer en utilisant le nouveau Set ---
      ownedCharacters = ownedCharacters.filter(c => !trulyFusedIds.has(c.id));

        // Nettoyer les IDs des personnages fusionnés de lastUsedBattleTeamIds et characterPreset
        idsToDelete.forEach(deletedId => {
            lastUsedBattleTeamIds = lastUsedBattleTeamIds.filter(id => id !== deletedId);
            savedTeams.forEach(team => {
                team.characterIds = team.characterIds.filter(id => id !== deletedId);
            });
        });
        localStorage.setItem("lastUsedBattleTeamIds", JSON.stringify(lastUsedBattleTeamIds));


      missions.forEach(mission => {
          if (mission.type === "fuse_chars" && !mission.completed) {
                mission.progress += idsToDelete.length;
          }
      });

        // Cette deuxième boucle semble redondante si charactersToFuse est le même que idsToDelete.
        // Si charactersToFuse est différent (par exemple, avant le filtrage par locked), alors c'est ok.
        // En supposant que idsToDelete est la liste définitive des personnages à fusionner :
        // missions.forEach(mission => {
        //     if (mission.type === "fuse_chars" && !mission.completed) {
        //         mission.progress += charactersToFuse.length; 
        //     }
        // });

      addExp(totalExpGained);

      const summaryText = Object.entries(fusionSummary)
        .map(([rarity, count]) => `${count} ${rarity} (+${count * expByRarity[rarity]} EXP)`)
        .join(", ");
      resultElement.innerHTML = `
        <p class="text-green-400">Fusion réussie pour ${mainChar.name} !</p><p class="text-white">Puissance augmentée à ${mainChar.power}</p>
        <p class="text-white">${idsToDelete.length} personnage(s) fusionné(s): ${summaryText}</p>
        <p class="text-white">Total +${totalExpGained} EXP gagné pour ${mainChar.name} et le joueur</p>
      `;
      selectedFusionCharacters.clear();
      closeModalHelper(fusionModal);
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

    // Fonctions utilitaires pour les modales
    function openModal(modalElement) {
        if (modalElement) {
            modalElement.classList.remove("hidden");
            enableNoScroll();
        }
    }

    function closeModalHelper(modalElement) {
        if (modalElement) {
            modalElement.classList.add("hidden");
            disableNoScroll();
        }
    }

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
        "Gem": "./images/items/Gem.webp", // Placeholder
        "Gold": "./images/items/Gold.webp", // Placeholder
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

    // NOUVEAU: Fonctions pour les Saisons et Ligues PvP
    function initializeSeason() {
        if (seasonTimerIntervalId) clearInterval(seasonTimerIntervalId);

        const now = new Date();
        const currentSeasonId = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
        
        seasonEndDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));

        if (playerSeasonData.seasonId && playerSeasonData.seasonId !== currentSeasonId) {
            console.log(`Nouvelle saison détectée ! Fin de la saison ${playerSeasonData.seasonId}.`);
            processSeasonEnd();
        }
        
        playerSeasonData.seasonId = currentSeasonId;

        const timerElement = document.getElementById('pvp-season-timer');
        const updateTimer = () => {
            const timeLeft = seasonEndDate.getTime() - Date.now();
            if (timeLeft <= 0) {
                timerElement.textContent = "Saison terminée !";
                clearInterval(seasonTimerIntervalId);
            } else {
                const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
                const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                timerElement.textContent = `${days}j ${hours}h`;
            }
        };
        updateTimer();
        seasonTimerIntervalId = setInterval(updateTimer, 60 * 60 * 1000);
    }

    async function processSeasonEnd() {
        const league = PVP_LEAGUES.find(l => l.name === playerSeasonData.highestLeagueName) || PVP_LEAGUES[0];
        const rewards = league.seasonRewards;

        let rewardMessage = `Récompenses pour avoir atteint la ligue ${league.name} :`;
        let rewardsForMail = {};

        if (rewards.gems) { rewardMessage += ` +${rewards.gems} gemmes`; rewardsForMail.gems = rewards.gems; }
        if (rewards.coins) { rewardMessage += ` +${rewards.coins} pièces`; rewardsForMail.coins = rewards.coins; }
        if (rewards.items) {
            rewardMessage += rewards.items.map(i => ` +${i.quantity} ${i.item}`).join(',');
            rewardsForMail.items = rewards.items;
        }

        if (currentUser) {
            const mailRef = db.collection('playerSaves').doc(currentUser.uid).collection('mailbox').doc();
            await mailRef.set({
                subject: `Fin de la Saison PvP ${playerSeasonData.seasonId}`,
                body: rewardMessage,
                rewards: rewardsForMail,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        playerPvpPoints = 0;
        playerSeasonData = { highestLeagueName: 'Non classé', seasonId: null };
        
        updatePvpDisplay();
        scheduleSave();
    }

    // NOUVEAU: Fonctions pour le mode Brawl
    function initializeBrawlMode() {
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const weekNumber = Math.ceil((((now - startOfYear) / 86400000) + startOfYear.getDay() + 1) / 7);
        currentBrawlMode = BRAWL_MODES[weekNumber % BRAWL_MODES.length];

        document.getElementById('brawl-mode-name').textContent = currentBrawlMode.name;
        document.getElementById('brawl-mode-description').textContent = currentBrawlMode.description;
    }

    // NOUVEAU: Fonction pour afficher le replay PvP
    function showPvpReplay(battleReport) {
        const contentEl = document.getElementById('pvp-replay-content');
        if (!battleReport) {
            contentEl.innerHTML = `<p class="text-center text-red-400">Données de replay non disponibles pour ce combat.</p>`;
            openModal(document.getElementById('pvp-replay-modal'));
            return;
        }

        const renderTeam = (team) => team.map(char => `
            <div class="replay-char-card border-2 ${getRarityBorderClass(char.rarity)}">
                <img src="${char.image}" alt="${char.name}" class="w-12 h-12 rounded">
                <div><p class="${char.color} font-semibold">${char.name}</p><p class="text-xs text-gray-300">Puissance: ${char.power.toLocaleString()}</p></div>
            </div>`).join('');

        contentEl.innerHTML = `
            <div class="replay-grid mb-4">
                <div class="replay-team attacker">${renderTeam(battleReport.attackerTeam)}</div>
                <div class="replay-vs">VS</div>
                <div class="replay-team defender">${renderTeam(battleReport.defenderTeam)}</div>
            </div>
            <div class="text-center border-t border-gray-600 pt-4">
                <p>Score Attaquant: <span class="font-bold">${Math.round(battleReport.attackerScore).toLocaleString()}</span></p>
                <p>Score Défenseur: <span class="font-bold">${Math.round(battleReport.defenderScore).toLocaleString()}</span></p>
                <p class="text-2xl font-bold mt-4 ${battleReport.outcome === 'victory' ? 'text-green-400' : 'text-red-400'}">${battleReport.outcome === 'victory' ? 'VICTOIRE DE L\'ATTAQUANT' : 'DÉFAITE DE L\'ATTAQUANT'}</p>
            </div>
        `;
        openModal(document.getElementById('pvp-replay-modal'));
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
            const fragment = document.createDocumentFragment();
          availableCharacters.sort((a, b) => b.power - a.power).forEach(c => {
                // MODIFICATION: Utiliser la nouvelle fonction createCharacterCard
                const cardElement = createCharacterCard(c, -1, 'limitBreakSelection');
                fragment.appendChild(cardElement);
          });
            limitBreakCharSelectionGridElement.appendChild(fragment);
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

    function updateStatChangeTabDisplay() {
        const statChipCountElement = document.getElementById("stat-chip-count");
        if (statChipCountElement) {
            statChipCountElement.textContent = inventory["Stat Chip"] || 0;
        }

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
            const fragment = document.createDocumentFragment();
            availableCharacters.sort((a,b) => (statRanks[b.statRank]?.order || 0) - (statRanks[a.statRank]?.order || 0) || b.power - a.power)
            .forEach(c => {
                // MODIFICATION: Utiliser la nouvelle fonction createCharacterCard
                const cardElement = createCharacterCard(c, -1, 'statChangeSelection');
                fragment.appendChild(cardElement);
            });
            charSelectionGrid.appendChild(fragment);
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

    function toggleLockCharacter(id) {
        const charIndex = ownedCharacters.findIndex(c => c.id === id);
        if (charIndex === -1) return;
        const char = ownedCharacters[charIndex];

        // NOUVELLE VÉRIFICATION: Empêcher le déverrouillage manuel si le personnage est dans l'équipe de défense.
        if (char.locked && defenseTeamIds.includes(id)) {
            resultElement.innerHTML = `<p class="text-yellow-400">Impossible de déverrouiller. Ce personnage est dans votre équipe de défense. Changez votre équipe de défense pour le libérer.</p>`;
            // On ne ferme pas la modale pour que l'utilisateur voie le message.
            return;
        }

        // Si la vérification passe, on peut inverser l'état de verrouillage.
        char.locked = !char.locked;

        // Mettre à jour le texte et le style du bouton de verrouillage dans la modale
        const lockButton = document.getElementById("lock-button");
        if (lockButton) {
            lockButton.textContent = char.locked ? "Déverrouiller" : "Verrouiller";
            lockButton.disabled = isDeleteMode;
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
            fuseButton.disabled = char.level >= (char.maxLevelCap || 60) || isDeleteMode || ownedCharacters.length <= 1 || char.locked;
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
        // Si l'onglet demandé est déjà actif et visible, ne rien faire.
        // Exception: si on re-clique sur "play" ou "inventory", on veut s'assurer que le bon sous-onglet est visible.
        if (activeTabId === tabId && !document.getElementById(tabId)?.classList.contains("hidden")) {
            if (tabId === "play") {
                showSubTab(activePlaySubTabId || "story");
            } else if (tabId === "inventory") {
                showSubTab(activeInventorySubTabId || "units");
            }
            return;
        }

        // --- NOUVEAU: Détacher les listeners des classements en temps réel ---
        // Si on quitte l'onglet "leaderboard"
        if (activeTabId === 'leaderboard') {
            if (leaderboardListener) {
                console.log("[Listener] Détachement du listener du classement joueur.");
                leaderboardListener();
                leaderboardListener = null;
            }
            if (guildLeaderboardListener) {
                console.log("[Listener] Détachement du listener du classement guilde.");
                guildLeaderboardListener();
                guildLeaderboardListener = null;
            }
        }
        // Si on quitte l'onglet "play" ET que le sous-onglet "pvp" était actif
        if (activeTabId === 'play' && activePlaySubTabId === 'pvp' && pvpLeaderboardListener) {
            console.log("[Listener] Détachement du listener du classement PvP (changement d'onglet principal).");
            pvpLeaderboardListener();
            pvpLeaderboardListener = null;
        }
        if (activeTabId === 'play' && activePlaySubTabId === 'tour' && towerLeaderboardListener) {
            console.log("[Listener] Détachement du listener du classement Tour (changement d'onglet principal).");
            towerLeaderboardListener();
            towerLeaderboardListener = null;
        }
        // NOUVEAU: Détacher le listener des salles publiques co-op quand on quitte l'onglet Play
        if (activeTabId === 'play' && activePlaySubTabId === 'coop' && publicRoomsListener) {
            console.log("[Listener] Détachement du listener des salles co-op (changement d'onglet principal).");
            publicRoomsListener();
            publicRoomsListener = null;
        }
        // --- FIN NOUVEAU ---

        // Cacher l'ancien onglet actif s'il y en a un et qu'il n'est pas le même que le nouveau
        if (activeTabId && activeTabId !== tabId) {
            const oldTab = document.getElementById(activeTabId);
            if (oldTab) {
                oldTab.classList.add("hidden");
            }
        }

        document.body.classList.remove("curse-tab-active-bg");

        const tabToShow = document.getElementById(tabId);
        if (tabToShow) {
            tabToShow.classList.remove("hidden");
        } else {
            console.error(`showTab: Onglet avec ID "${tabId}" non trouvé.`);
            return;
        }

        activeTabId = tabId;

        const allVisibleTabButtons = document.querySelectorAll(".tab-button:not(.hidden)");
        allVisibleTabButtons.forEach(btn => {
            btn.classList.toggle("border-blue-500", btn.dataset.tab === tabId);
            btn.classList.toggle("border-transparent", btn.dataset.tab !== tabId);
        });

        if (tabId === "inventory") {
            // Restaurer le dernier sous-onglet actif de l'inventaire ou afficher "units" par défaut
            showSubTab(activeInventorySubTabId || "units");
        } else if (tabId === "play") {
            // Restaurer le dernier sous-onglet actif de "jouer" ou afficher "story" par défaut
            showSubTab(activePlaySubTabId || "story");
        } else if (tabId === "leaderboard") {
            // Restaurer le dernier sous-onglet actif de "classement" ou afficher "joueurs" par défaut
            showSubTab(activeLeaderboardSubTabId || "leaderboard-player");
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
        } else if (tabId === "guild") {
            updateGuildDisplay();
        } else {
            if (isDeleteMode) {
                isDeleteMode = false;
                selectedCharacterIndices.clear();
                updateCharacterDisplay();
            }
        }
        updateUI();
    }

    async function updateLeaderboard() {
        const leaderboardContent = document.getElementById("leaderboard-content");
        leaderboardContent.innerHTML = '<p class="text-white text-center">Chargement du classement...</p>';

        // Détacher l'ancien listener s'il existe
        if (leaderboardListener) {
            leaderboardListener();
            leaderboardListener = null;
        }

        try {
            // --- MODIFICATION MAJEURE ICI ---
            // Interroger la collection 'leaderboard' publique, pas 'playerSaves'
            const query = db.collection('leaderboard')
                .orderBy('level', 'desc') // Trier par niveau
                .orderBy('exp', 'desc')   // Puis par EXP (pour départager)
                .limit(100);

            // Utiliser onSnapshot pour un classement en temps réel
            leaderboardListener = query.onSnapshot(querySnapshot => {
                const players = [];
                querySnapshot.forEach(doc => {
                    const data = doc.data();
                    // S'assurer que les données nécessaires sont présentes
                    if (data.username && typeof data.level === 'number' && typeof data.exp === 'number') {
                        players.push({
                            uid: doc.id,
                            name: data.username,
                            level: data.level,
                            exp: data.exp
                        });
                    }
                });

                if (players.length === 0) {
                    leaderboardContent.innerHTML = '<p class="text-white text-center">Le classement est vide pour le moment.</p>';
                    return;
                }

                // Construire le tableau HTML
                leaderboardContent.innerHTML = `
                    <table class="w-full text-white">
                        <thead>
                            <tr class="text-left">
                                <th class="p-2">Rang</th>
                                <th class="p-2">Nom</th>
                                <th class="p-2">Niveau</th>
                                <th class="p-2">EXP</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${players.map((p, index) => `
                                <tr class="${p.uid === currentUser?.uid ? 'bg-yellow-500 text-black' : ''}">
                                    <td class="p-2">${index + 1}</td>
                                    <td class="p-2">${p.name}</td>
                                    <td class="p-2">${p.level}</td>
                                    <td class="p-2">${p.exp.toLocaleString()}</td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                `;
            }, (error) => { // Gérer les erreurs du listener
                console.error("Erreur lors du chargement du classement:", error);
                leaderboardContent.innerHTML = '<p class="text-red-500 text-center">Impossible de charger le classement. Veuillez réessayer plus tard.</p>';
                if (error.code === 'failed-precondition') {
                    leaderboardContent.innerHTML += '<p class="text-yellow-400 text-center text-sm mt-2">Note: Un index Firestore est requis. Vérifiez la console du navigateur pour un lien de création d\'index (level desc, exp desc).</p>';
                }
                if (leaderboardListener) {
                    leaderboardListener(); // Détacher le listener en cas d'erreur
                    leaderboardListener = null;
                }
            });
            // --- FIN DE LA MODIFICATION ---

        } catch (error) {
            console.error("Erreur lors de la configuration du listener de classement:", error);
            leaderboardContent.innerHTML = '<p class="text-red-500 text-center">Erreur de configuration du classement.</p>';
        }
    }

    async function updateGuildLeaderboard() {
        const guildLeaderboardContent = document.getElementById("guild-leaderboard-content");
        if (!guildLeaderboardContent) return;
    
        guildLeaderboardContent.innerHTML = '<p class="text-white text-center">Chargement du classement des guildes...</p>';
    
        if (guildLeaderboardListener) {
            guildLeaderboardListener();
            guildLeaderboardListener = null;
        }
    
        try {
            const query = db.collection('guilds')
                .orderBy('exp', 'desc')
                .limit(100);
    
            guildLeaderboardListener = query.onSnapshot(querySnapshot => {
                const guilds = [];
                querySnapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.name && typeof data.exp === 'number') {
                        guilds.push({
                            id: doc.id,
                            name: data.name,
                            exp: data.exp,
                            level: getGuildLevelFromExp(data.exp),
                            members: Object.keys(data.members || {}).length
                        });
                    }
                });
    
                if (guilds.length === 0) {
                    guildLeaderboardContent.innerHTML = '<p class="text-white text-center">Le classement des guildes est vide.</p>';
                    return;
                }
    
                guildLeaderboardContent.innerHTML = `
                    <table class="w-full text-white">
                        <thead>
                            <tr class="text-left">
                                <th class="p-2">Rang</th>
                                <th class="p-2">Nom</th>
                                <th class="p-2">Niveau</th>
                                <th class="p-2">EXP</th>
                                <th class="p-2">Membres</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${guilds.map((g, index) => `
                                <tr class="${g.id === playerGuildId ? 'bg-yellow-500 text-black' : ''}">
                                    <td class="p-2">${index + 1}</td>
                                    <td class="p-2">${g.name}</td>
                                    <td class="p-2">${g.level}</td>
                                    <td class="p-2">${g.exp.toLocaleString()}</td>
                                    <td class="p-2">${g.members}/${GUILD_MEMBER_LIMIT}</td>
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                `;
            }, (error) => {
                console.error("Erreur lors du chargement du classement des guildes:", error);
                guildLeaderboardContent.innerHTML = '<p class="text-red-500 text-center">Impossible de charger le classement des guildes.</p>';
                if (error.code === 'failed-precondition') {
                    guildLeaderboardContent.innerHTML += '<p class="text-yellow-400 text-center text-sm mt-2">Note: Un index Firestore pour `exp` dans la collection `guilds` est peut-être requis.</p>';
                }
                if (guildLeaderboardListener) {
                    guildLeaderboardListener();
                    guildLeaderboardListener = null;
                }
            });
        } catch (error) {
            console.error("Erreur de configuration du listener de classement de guilde:", error);
            guildLeaderboardContent.innerHTML = '<p class="text-red-500 text-center">Erreur de configuration du classement.</p>';
        }
    }

    async function updatePvpLeaderboard() {
        const pvpLeaderboardEl = document.getElementById('pvp-leaderboard');
        if (!pvpLeaderboardEl) return;

        pvpLeaderboardEl.innerHTML = '<p class="text-white text-center">Chargement du classement PvP...</p>';
        
        if (pvpLeaderboardListener) {
            pvpLeaderboardListener();
        }

        const query = db.collection('leaderboard')
            .orderBy('playerPvpPoints', 'desc')
            .limit(100);

        pvpLeaderboardListener = query.onSnapshot(querySnapshot => {
            if (querySnapshot.empty) {
                pvpLeaderboardEl.innerHTML = '<p class="text-white text-center">Le classement PvP est vide.</p>';
                return;
            }

            const players = querySnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));

            pvpLeaderboardEl.innerHTML = `
                <table class="w-full text-white text-sm">
                    <thead>
                        <tr class="text-left border-b border-gray-600">
                            <th class="p-2">Rang</th>
                            <th class="p-2">Nom</th>
                            <th class="p-2">Points</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${players.map((p, index) => `
                            <tr class="border-b border-gray-700 ${p.uid === currentUser?.uid ? 'bg-yellow-500 bg-opacity-30' : ''}">
                                <td class="p-2">${index + 1}</td>
                                <td class="p-2">${p.username}</td>
                                <td class="p-2">${(p.playerPvpPoints || 0).toLocaleString()}</td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            `;
        }, error => {
            console.error("Erreur de lecture du classement PvP:", error);
            pvpLeaderboardEl.innerHTML = '<p class="text-red-500">Impossible de charger le classement PvP.</p>';
            if (error.code === 'failed-precondition') {
                pvpLeaderboardEl.innerHTML += '<p class="text-yellow-400 text-center text-xs mt-2">Note: Un index Firestore pour `playerPvpPoints` dans la collection `leaderboard` est peut-être requis.</p>';
            }
        });
    }

    async function updateTowerLeaderboard() {
        const towerLeaderboardEl = document.getElementById('tower-leaderboard');
        if (!towerLeaderboardEl) return;

        towerLeaderboardEl.innerHTML = '<p class="text-white text-center">Chargement du classement de la Tour...</p>';

        if (towerLeaderboardListener) {
            towerLeaderboardListener();
        }
        
        // --- MODIFICATION ICI : On interroge la collection 'leaderboard' ---
        const query = db.collection('leaderboard')
                .orderBy('towerFloor', 'desc')
                .limit(100);

        towerLeaderboardListener = query.onSnapshot(querySnapshot => {
            const players = [];
            querySnapshot.forEach(doc => {
                const data = doc.data();
                // On vérifie que les données nécessaires sont présentes
                if (data.username && typeof data.towerFloor === 'number') {
                    players.push({
                        uid: doc.id,
                        name: data.username,
                        floor: data.towerFloor
                    });
                }
            });

            if (players.length === 0) {
                towerLeaderboardEl.innerHTML = '<p class="text-white text-center">Le classement de la Tour est vide.</p>';
                return;
            }

            towerLeaderboardEl.innerHTML = `
                <table class="w-full text-white text-sm">
                    <thead>
                        <tr class="text-left border-b border-gray-600">
                            <th class="p-2">Rang</th>
                            <th class="p-2">Nom</th>
                            <th class="p-2">Étage</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${players.map((p, index) => `
                            <tr class="border-b border-gray-700 ${p.uid === currentUser?.uid ? 'bg-yellow-500 bg-opacity-30' : ''}">
                                <td class="p-2">${index + 1}</td>
                                <td class="p-2">${p.name}</td>
                                <td class="p-2">${p.floor.toLocaleString()}</td>
                            </tr>
                        `).join("")}
                    </tbody>
                </table>
            `;

        }, error => {
            console.error("Erreur lors du chargement du classement de la Tour:", error);
            towerLeaderboardEl.innerHTML = '<p class="text-red-500 text-center">Impossible de charger le classement de la Tour.</p>';
            if (error.code === 'failed-precondition') {
                towerLeaderboardEl.innerHTML += '<p class="text-yellow-400 text-center text-xs mt-2">Note: Un index Firestore pour `towerFloor` est peut-être requis. Vérifiez la console du navigateur pour un lien.</p>';
            }
            if (towerLeaderboardListener) {
                towerLeaderboardListener();
                towerLeaderboardListener = null;
            }
        });
    }

    async function findOpponent() {
        resultElement.innerHTML = `<p class="text-yellow-400">Recherche d'un adversaire...</p>`;
        
        // MODIFICATION: Désactiver les deux boutons et créer une fonction pour les réactiver
        const brawlButton = document.getElementById('play-brawl-button');
        findOpponentButton.disabled = true;
        if (brawlButton) brawlButton.disabled = true;

        const reEnableButtons = () => {
            findOpponentButton.disabled = false;
            if (brawlButton) brawlButton.disabled = false;
        };

        try {
            let query;

            if (currentBattleMode === 'brawl') {
                // Pour le Brawl, on cherche des joueurs de manière plus aléatoire
                const randomId = db.collection('leaderboard').doc().id;
                query = db.collection('leaderboard')
                    .where(firebase.firestore.FieldPath.documentId(), '>=', randomId)
                    .limit(20);
            } else {
                // Logique de matchmaking standard
                const points = playerPvpPoints;
                const range = 500;
                const minPoints = Math.max(0, points - range);
                const maxPoints = points + range;

                query = db.collection('leaderboard')
                    .where('playerPvpPoints', '>=', minPoints)
                    .where('playerPvpPoints', '<=', maxPoints)
                    .limit(20);
            }

            let querySnapshot = await query.get();
            let potentialOpponents = [];

            querySnapshot.forEach(doc => {
                if (doc.id !== currentUser.uid && doc.data().defenseTeam) {
                    potentialOpponents.push({ id: doc.id, ...doc.data() });
                }
            });

            // Fallback pour le mode brawl si la première requête aléatoire ne donne rien
            if (currentBattleMode === 'brawl' && potentialOpponents.length < 1) {
                const fallbackQuery = db.collection('leaderboard').limit(20);
                querySnapshot = await fallbackQuery.get();
                querySnapshot.forEach(doc => {
                    if (doc.id !== currentUser.uid && doc.data().defenseTeam && !potentialOpponents.some(p => p.id === doc.id)) {
                        potentialOpponents.push({ id: doc.id, ...doc.data() });
                    }
                });
            }

            if (potentialOpponents.length === 0) {
                resultElement.innerHTML = `<p class="text-gray-400">Aucun adversaire trouvé. Réessayez dans un instant.</p>`;
                reEnableButtons();
                return;
            }

            const opponentData = potentialOpponents[Math.floor(Math.random() * potentialOpponents.length)];
            const opponentTeamPower = opponentData.defenseTeam.reduce((sum, char) => sum + (char.power || 0), 0);

            currentPvpOpponent = { id: opponentData.id, name: opponentData.username, team: opponentData.defenseTeam, teamPower: opponentTeamPower };

            resultElement.innerHTML = `<p class="text-green-400">Adversaire trouvé : ${currentPvpOpponent.name} (Puissance: ${currentPvpOpponent.teamPower})</p>`;
            await startPvpBattle();

        } catch (error) {
            console.error("Erreur lors de la recherche d'un adversaire PvP:", error);
            resultElement.innerHTML = `<p class="text-red-500">Erreur lors de la recherche d'un adversaire.</p>`;
            reEnableButtons();
            if (error.code === 'failed-precondition') {
                resultElement.innerHTML += '<p class="text-yellow-400 text-xs">Un index Firestore est peut-être requis. Vérifiez la console.</p>';
            }
        }
    }

    async function startPvpBattle() {
        if (!currentPvpOpponent) {
            resultElement.innerHTML = `<p class="text-red-500">Erreur : Pas d'adversaire PvP sélectionné.</p>`;
            return;
        }
        currentLevelId = 'pvp_battle';
        selectedBattleCharacters.clear();

        // NOUVEAU: Vérifier si une équipe de défense valide est définie
        if (defenseTeamIds && defenseTeamIds.length === 3) {
            const defenseTeamChars = defenseTeamIds.map(id => ownedCharacters.find(c => c.id === id));

            // Vérifier si tous les personnages de l'équipe de défense sont toujours possédés
            if (defenseTeamChars.every(c => c)) {
                console.log("[PvP] Équipe de défense valide trouvée. Lancement direct du combat.");

                // Remplir selectedBattleCharacters avec les index des personnages de l'équipe de défense
                defenseTeamIds.forEach(id => {
                    const index = ownedCharacters.findIndex(c => c.id === id);
                    if (index !== -1) {
                        selectedBattleCharacters.add(index);
                    }
                });

                // S'assurer que l'équipe est complète avant de continuer
                if (selectedBattleCharacters.size === 3) {
                    await confirmSelection(); // Lancer le combat directement
                    return; // Quitter la fonction pour ne pas ouvrir la modale de sélection
                } else {
                    console.warn("[PvP] L'équipe de défense a été trouvée mais n'a pas pu être chargée correctement. Passage à la sélection manuelle.");
                    selectedBattleCharacters.clear(); // Vider la sélection partielle
                }
            } else {
                console.log("[PvP] Équipe de défense invalide (personnage manquant). Passage à la sélection manuelle.");
            }
        } else {
            console.log("[PvP] Aucune équipe de défense définie. Passage à la sélection manuelle.");
        }

        // Comportement par défaut : ouvrir la sélection manuelle si aucune équipe de défense valide n'est trouvée
        openModal(characterSelectionModal);
        updateCharacterSelectionDisplay();
    }

    function updatePvpLogsNotification() {
        if (!pvpLogsBadge) return;
        const hasUnread = pvpLogs.some(log => !log.read);
        pvpLogsBadge.classList.toggle('hidden', !hasUnread);
    }

    async function openPvpLogsModal() {
        // Étape 1 : On force le traitement des résultats en attente AVANT d'ouvrir la modale.
        await processPendingPvpResults();

        // Étape 2 : Maintenant que les logs sont à jour, on met à jour l'affichage et on marque comme lu.
        updatePvpLogsDisplay();
        
        let changed = false;
        pvpLogs.forEach(log => {
            if (!log.read) {
                log.read = true;
                changed = true;
            }
        });

        if (changed) {
            updatePvpLogsNotification();
            scheduleSave();
        }

        openModal(pvpLogsModal);
    }

    function updatePvpLogsDisplay() {
        if (!pvpLogsListContainer) return;
        if (pvpLogs.length === 0) {
            pvpLogsListContainer.innerHTML = '<p class="text-gray-400 text-center">Aucun combat récent.</p>';
            return;
        }
        const sortedLogs = [...pvpLogs].sort((a, b) => b.timestamp - a.timestamp);
        pvpLogsListContainer.innerHTML = sortedLogs.map(log => {
            const date = new Date(log.timestamp).toLocaleString('fr-FR');
            const isVictory = log.outcome === 'victory';
            const actionText = log.type === 'attack' ? `Vous avez attaqué <strong>${log.opponentName}</strong>` : `<strong>${log.opponentName}</strong> vous a attaqué`;
            const outcomeText = isVictory ? 'Victoire' : 'Défaite';
            const pointsText = `${log.pointsChange > 0 ? '+' : ''}${log.pointsChange} points`;            
            // NOUVEAU: Ajout du bouton Replay
            const replayButtonHtml = log.battleReport ? `<button class="view-replay-button bg-blue-700 hover:bg-blue-800 text-white text-xs py-1 px-2 rounded mt-2" data-log-id="${log.id}">Replay</button>` : '';

            return `<div class="p-3 rounded-lg mb-2 ${log.read ? 'bg-gray-700 bg-opacity-40' : 'bg-blue-900 bg-opacity-50 border border-blue-500'}">
                        <div class="flex justify-between items-center"><p class="font-bold ${isVictory ? 'text-green-400' : 'text-red-400'}">${outcomeText}</p><p class="text-xs text-gray-400">${date}</p></div>
                        <p class="text-white mt-1">${actionText}</p><p class="text-white text-sm">${pointsText}</p>${replayButtonHtml}
                    </div>`;
        }).join('');
    }

    // --- NOUVEAU: Fonctions de gestion d'équipe ---

    function updateTeamsModalDisplay() {
        const savedTeamsList = document.getElementById('saved-teams-list');
        if (!savedTeamsList) return; savedTeamsList.innerHTML = "";
        if (savedTeams.length === 0) {
            savedTeamsList.innerHTML = '<p class="text-gray-400 text-center">Aucune équipe sauvegardée. Créez-en une !</p>';
            return;
        }

        savedTeams.forEach(team => {
            const teamCharacters = team.characterIds.map(id => ownedCharacters.find(c => c.id === id)).filter(Boolean);
            const isDefenseTeam = defenseTeamIds.length === team.characterIds.length && defenseTeamIds.every(id => team.characterIds.includes(id));
            const isDefaultTeam = team.id === defaultBattleTeamId; // NOUVEAU

            const teamCard = document.createElement('div');
            teamCard.className = `saved-team-card ${isDefenseTeam ? 'border-blue-500' : (isDefaultTeam ? 'default-team-card' : 'border-gray-600')} cursor-pointer hover:bg-gray-700 transition-colors duration-200`;
            teamCard.dataset.teamId = team.id;
            teamCard.innerHTML = `
                <div class="saved-team-header pointer-events-none">
                    <h3 class="saved-team-name">${team.name}</h3>
                    ${isDefaultTeam ? '<span class="text-xs bg-yellow-500 text-black font-bold py-1 px-2 rounded">Par Défaut</span>' : ''}
                    ${isDefenseTeam ? '<span class="text-xs bg-blue-500 text-white font-bold py-1 px-2 rounded">Équipe de Défense</span>' : ''}
                </div>
                <div class="saved-team-characters pointer-events-none">
                    ${teamCharacters.map(char => `
                        <img src="${char.image}" alt="${char.name}" title="${char.name} (Puissance: ${char.power})" class="saved-team-char-icon ${getRarityBorderClass(char.rarity)}">
                    `).join('')}
                    ${teamCharacters.length < team.characterIds.length ? '<p class="text-red-500 text-xs">Un ou plusieurs personnages de cette équipe ne sont plus possédés.</p>' : ''}
                </div>
                <div class="saved-team-actions">
                    <button class="load-team-btn bg-blue-600 hover:bg-blue-700 text-white text-sm py-1 px-3 rounded" data-team-id="${team.id}">Charger</button>
                    <button class="set-default-btn bg-green-600 hover:bg-green-700 text-white text-sm py-1 px-3 rounded ${isDefaultTeam ? 'opacity-50 cursor-not-allowed' : ''}" data-team-id="${team.id}" ${isDefaultTeam ? 'disabled' : ''}>Par Défaut</button>
                    <button class="set-defense-btn bg-purple-600 hover:bg-purple-700 text-white text-sm py-1 px-3 rounded ${isDefenseTeam ? 'opacity-50 cursor-not-allowed' : ''}" data-team-id="${team.id}" ${isDefenseTeam ? 'disabled' : ''}>Définir en Défense</button>
                </div>
            `;
            savedTeamsList.appendChild(teamCard);
        });
    }

    function openTeamEditor(teamId) {
        editingTeamId = teamId;
        teamEditorSelectedCharacters.clear();
        const nameInput = document.getElementById('team-editor-name-input');
        const deleteButton = document.getElementById('delete-team-in-editor-btn');

        if (teamId) {
            const team = savedTeams.find(t => t.id === teamId);
            if (team) {
                nameInput.value = team.name;
                team.characterIds.forEach(id => {
                    if (ownedCharacters.some(c => c.id === id)) {
                        teamEditorSelectedCharacters.add(id);
                    }
                });
            }
            deleteButton.classList.remove('hidden');
            deleteButton.onclick = () => {
                deleteTeam(teamId);
                closeModalHelper(teamEditorModal);
            };
        } else {
            nameInput.value = "";
            deleteButton.classList.add('hidden');
        }
        updateTeamEditorDisplay();
        openModal(teamEditorModal);
    }

    function updateTeamEditorDisplay() {
        const characterList = document.getElementById('team-editor-character-list');
        characterList.innerHTML = "";
        const teamBeingEdited = editingTeamId ? savedTeams.find(t => t.id === editingTeamId) : null;

        let charactersToDisplay = [...ownedCharacters];
        if (teamEditorSearchName) {
            charactersToDisplay = charactersToDisplay.filter(char => char.name.toLowerCase().includes(teamEditorSearchName));
        }
        if (teamEditorFilterRarity !== "all") {
            charactersToDisplay = charactersToDisplay.filter(char => char.rarity === teamEditorFilterRarity);
        }

        const sortedCharacters = charactersToDisplay.sort((a, b) => {
            if (teamEditorSortCriteria === "power") return b.power - a.power;
            if (teamEditorSortCriteria === "rarity") return rarityOrder[b.rarity] - rarityOrder[a.rarity];
            if (teamEditorSortCriteria === "level") return b.level - a.level;
            return 0;
        });

        const selectedCharacterNames = new Set(
            Array.from(teamEditorSelectedCharacters).map(id => ownedCharacters.find(c => c.id === id)?.name).filter(Boolean)
        );

        const fragment = document.createDocumentFragment();
        sortedCharacters.forEach(char => {
            const card = document.createElement('div');
            const isSelected = teamEditorSelectedCharacters.has(char.id);
            const isLocked = char.locked;
            const isPartOfCurrentlyEditedTeam = teamBeingEdited ? teamBeingEdited.characterIds.includes(char.id) : false;

            const isDisabled = isLocked || 
                (!isSelected && teamEditorSelectedCharacters.size >= 3) || 
                (!isSelected && selectedCharacterNames.has(char.name));
            
            card.className = `relative p-2 rounded-lg border cursor-pointer ${getRarityBorderClass(char.rarity)} ${isSelected ? 'selected-for-battle' : ''} ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`;
            card.innerHTML = `
                <img src="${char.image}" alt="${char.name}" class="w-full h-24 object-contain rounded mb-2">
                <p class="${char.color} font-semibold text-xs text-center">${char.name}</p>
                <p class="text-white text-xs text-center">P: ${char.power}</p>
            `;
            if (!isDisabled) {
                card.addEventListener('click', () => selectTeamEditorCharacter(char.id));
            }
            fragment.appendChild(card);
        });
        characterList.appendChild(fragment);

        document.getElementById('team-editor-selected-count').textContent = `${teamEditorSelectedCharacters.size}/3`;
        const name = document.getElementById('team-editor-name-input').value.trim();
        const saveButton = document.getElementById('save-team-button');
        saveButton.disabled = teamEditorSelectedCharacters.size !== 3 || !name;
        saveButton.classList.toggle('opacity-50', saveButton.disabled);
        saveButton.classList.toggle('cursor-not-allowed', saveButton.disabled);
    }

    function selectTeamEditorCharacter(charId) {
        const char = ownedCharacters.find(c => c.id === charId);
        if (!char) return;

        const teamBeingEdited = editingTeamId ? savedTeams.find(t => t.id === editingTeamId) : null;
        const isPartOfCurrentlyEditedTeam = teamBeingEdited ? teamBeingEdited.characterIds.includes(char.id) : false;
        if (char.locked && !isPartOfCurrentlyEditedTeam) {
            resultElement.innerHTML = `<p class="text-yellow-400">Ce personnage est verrouillé (probablement dans l'équipe de défense) et ne peut pas être ajouté à une autre équipe.</p>`;
            return;
        }

        if (teamEditorSelectedCharacters.has(charId)) {
            teamEditorSelectedCharacters.delete(charId);
        } else {
            if (teamEditorSelectedCharacters.size < 3) {
                const selectedNames = new Set(Array.from(teamEditorSelectedCharacters).map(id => ownedCharacters.find(c => c.id === id)?.name));
                if (!selectedNames.has(char.name)) {
                    teamEditorSelectedCharacters.add(charId);
                }
            }
        }
        updateTeamEditorDisplay();
    }

    function saveTeam() {
        const nameInput = document.getElementById('team-editor-name-input');
        const name = nameInput.value.trim();

        if (!name) {
            resultElement.innerHTML = '<p class="text-red-400">Veuillez donner un nom à votre équipe.</p>';
            return;
        }
        if (teamEditorSelectedCharacters.size !== 3) {
            resultElement.innerHTML = '<p class="text-red-400">Une équipe doit contenir exactement 3 personnages.</p>';
            return;
        }

        const characterIds = Array.from(teamEditorSelectedCharacters);

        if (editingTeamId) {
            // Update existing team
            const team = savedTeams.find(t => t.id === editingTeamId);
            if (team) {
                team.name = name;
                team.characterIds = characterIds;
            }
        } else {
            // Create new team
            const newTeam = {
                id: `team_${Date.now()}`,
                name: name,
                characterIds: characterIds
            };
            savedTeams.push(newTeam);
        }

        editingTeamId = null;
        closeModalHelper(teamEditorModal);
        updateTeamsModalDisplay();
        scheduleSave();
    }

    // NOUVEAU: Définir une équipe par défaut pour les combats
    function setDefaultBattleTeam(teamId) {
        const team = savedTeams.find(t => t.id === teamId);
        if (!team) return;
        defaultBattleTeamId = teamId;
        resultElement.innerHTML = `<p class="text-green-400">L'équipe "${team.name}" est maintenant votre équipe par défaut pour les combats.</p>`;
        updateTeamsModalDisplay();
        scheduleSave();
    }

    function loadTeamForBattle(teamId) {
        const team = savedTeams.find(t => t.id === teamId);
        if (!team) {
            resultElement.innerHTML = '<p class="text-red-400">Équipe non trouvée.</p>';
            return;
        }

        const teamCharacters = team.characterIds.map(id => ownedCharacters.find(c => c.id === id));
        if (teamCharacters.some(c => !c)) {
            resultElement.innerHTML = '<p class="text-red-400">Cette équipe contient des personnages que vous ne possédez plus.</p>';
            return;
        }

        lastUsedBattleTeamIds = [...team.characterIds];
        resultElement.innerHTML = `<p class="text-green-400">L'équipe "${team.name}" est prête pour le prochain combat.</p>`;
        closeModalHelper(teamsModal);
        showTab('play');
    }

    function deleteTeam(teamId) {
        const teamIndex = savedTeams.findIndex(t => t.id === teamId);
        if (teamIndex > -1) {
            const deletedTeam = savedTeams[teamIndex];
            savedTeams.splice(teamIndex, 1);

            const isDefenseTeam = defenseTeamIds.length === deletedTeam.characterIds.length && defenseTeamIds.every(id => deletedTeam.characterIds.includes(id));
            if (isDefenseTeam) {
            // Déverrouiller les personnages de l'équipe de défense supprimée
            deletedTeam.characterIds.forEach(charId => {
                const charToUnlock = ownedCharacters.find(c => c.id === charId);
                if (charToUnlock) charToUnlock.locked = false;
            });
                defenseTeamIds = [];
            }
            // NOUVEAU: Vérifier si l'équipe supprimée était l'équipe par défaut
            if (deletedTeam.id === defaultBattleTeamId) {
                defaultBattleTeamId = null;
                resultElement.innerHTML = `<p class="text-yellow-400">L'équipe par défaut a été supprimée et désactivée.</p>`;
            }

            // NOUVEAU: Vérifier si l'équipe supprimée était la dernière équipe utilisée
            const isLastUsedTeam = lastUsedBattleTeamIds.length === deletedTeam.characterIds.length && lastUsedBattleTeamIds.every(id => deletedTeam.characterIds.includes(id));
            if (isLastUsedTeam) {
                lastUsedBattleTeamIds = [];
                console.log("L'équipe supprimée était la dernière équipe utilisée. Elle a été désélectionnée.");
                resultElement.innerHTML = `<p class="text-yellow-400">L'équipe supprimée était votre dernière équipe utilisée et a été désélectionnée pour les prochains combats.</p>`;
            }

            updateTeamsModalDisplay();
            updateCharacterDisplay();
            scheduleSave();
        }
    }

    function setDefenseTeam(teamId) {
        const team = savedTeams.find(t => t.id === teamId);
        if (!team || team.characterIds.length !== 3) {
            resultElement.innerHTML = '<p class="text-red-400">Cette équipe est invalide pour la défense.</p>';
            return;
        }
        
        const teamCharacters = team.characterIds.map(id => ownedCharacters.find(c => c.id === id));
        if (teamCharacters.some(c => !c)) {
            resultElement.innerHTML = '<p class="text-red-400">Cette équipe contient des personnages que vous ne possédez plus.</p>';
            return;
        }

        // Déverrouiller l'ancienne équipe
        defenseTeamIds.forEach(charId => {
            if (!team.characterIds.includes(charId)) {
                const charToUnlock = ownedCharacters.find(c => c.id === charId);
                if (charToUnlock) charToUnlock.locked = false;
            }
        });

        defenseTeamIds = [...team.characterIds];

        // Verrouiller la nouvelle équipe
        defenseTeamIds.forEach(charId => {
            const charToLock = ownedCharacters.find(c => c.id === charId);
            if (charToLock) charToLock.locked = true;
        });

        // Sauvegarder une version simplifiée de l'équipe dans le classement public
        if (currentUser) {
            const defenseTeamForLeaderboard = teamCharacters.map(char => ({
                name: char.name,
                power: char.power,
                image: char.image,
                rarity: char.rarity,
                color: char.color
            }));
            
            db.collection('leaderboard').doc(currentUser.uid).update({
                defenseTeam: defenseTeamForLeaderboard
            }).catch(e => console.error("Erreur de mise à jour de l'équipe de défense dans le classement:", e));
        }

        resultElement.innerHTML = `<p class="text-green-400">L'équipe "${team.name}" est maintenant votre équipe de défense. Ses membres sont verrouillés.</p>`;
        updateTeamsModalDisplay();
        updateCharacterDisplay();
        scheduleSave();
    }

    function renderRaidBossView(raidData) {
        const raidBossView = document.getElementById('guild-raid-boss-view');
        const bossDef = raidBosses.find(b => b.id === raidData.bossId);
        if (!bossDef) {
            raidBossView.innerHTML = `<p class="text-red-500">Erreur: Définition du boss de raid introuvable.</p>`;
            return;
        }
        const healthPercentage = (raidData.currentHealth / bossDef.totalHealth) * 100;
        const endTime = new Date(raidData.startTime.seconds * 1000 + bossDef.durationDays * 24 * 60 * 60 * 1000);
        const timeLeftMs = endTime - Date.now();
        raidBossView.innerHTML = ` <h3 class="text-2xl text-purple-300 font-bold text-center mb-2">${bossDef.name}</h3> <p class="text-center text-gray-400 mb-4">Temps restant: ${timeLeftMs > 0 ? formatTime(timeLeftMs) : 'Terminé'}</p> <img src="${bossDef.image}" alt="${bossDef.name}" class="mx-auto h-48 mb-4"> <div class="w-full bg-gray-900 rounded-full h-8 border-2 border-purple-400 mt-2 relative"> <div class="bg-red-600 h-full rounded-full transition-all duration-100 ease-linear" style="width: ${healthPercentage}%;"></div> <span class="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center text-white font-bold">${raidData.currentHealth.toLocaleString()} / ${bossDef.totalHealth.toLocaleString()}</span> </div> <div class="text-center mt-6"> <button id="attack-raid-boss-button" class="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-lg text-xl transition transform hover:scale-105"> Attaquer ! </button> </div> <div class="mt-6"> <h4 class="text-lg font-semibold text-white mb-2">Meilleurs contributeurs</h4> <ul id="raid-contributors-list" class="text-gray-300 space-y-1"> <li>1. PlayerOne - 1,234,567 Dégâts</li> <li>2. PlayerTwo - 987,654 Dégâts</li> </ul> </div> `;
        document.getElementById('attack-raid-boss-button').addEventListener('click', attackRaidBoss);
    }

    function listenForGuildData(guildId) {
        if (guildDataListener) guildDataListener(); // Detach old listener

        const guildRef = db.collection('guilds').doc(guildId);
        console.log(`[GUILD] Setting up listener for guild data: ${guildId}`);
        guildDataListener = guildRef.onSnapshot(doc => {
            if (doc.exists) {
                console.log("[GUILD] Guild data updated:", doc.data());
                playerGuildData = doc.data();
                if (activeTabId === 'guild') {
                    updateGuildDisplay();
                }
            } else {
                console.warn("[GUILD] Guild data gone. Player might have been kicked or guild deleted.");
                // Handle case where guild is deleted while player is in it
                playerGuildId = null;
                playerGuildData = null;
                cleanupGuildListeners();
                if (activeTabId === 'guild') {
                    updateGuildDisplay();
                }
                // Also update player save data
                if (currentUser) {
                    db.collection('playerSaves').doc(currentUser.uid).update({ playerGuildId: null });
                }
            }
        }, error => {
            console.error("[GUILD] Error listening to guild data:", error);
        });
    }

    function listenForGuildChat(guildId) {
        if (guildChatListener) guildChatListener(); // Detach old listener

        const chatRef = db.collection('guilds').doc(guildId).collection('chat').orderBy('timestamp', 'desc').limit(50);
        console.log(`[GUILD] Setting up listener for guild chat: ${guildId}`);
        guildChatListener = chatRef.onSnapshot(snapshot => {
            const chatMessagesElement = document.getElementById('guild-chat-messages');
            if (!chatMessagesElement) return; // View not rendered

            if (snapshot.empty) {
                chatMessagesElement.innerHTML = '<p class="text-gray-400 text-center">Aucun message. Soyez le premier !</p>';
                return;
            }

            chatMessagesElement.innerHTML = snapshot.docs.map(doc => {
                const msg = doc.data();
                const date = msg.timestamp ? new Date(msg.timestamp.seconds * 1000).toLocaleTimeString() : '';
                // Basic XSS protection
                const sender = document.createElement('span');
                sender.textContent = msg.senderName;
                const message = document.createElement('span');
                message.textContent = msg.message;

                return `<div class="text-sm mb-1 break-words">
                            <span class="text-gray-400 text-xs">[${date}]</span>
                            <strong class="text-blue-300">${sender.innerHTML}:</strong>
                            <span class="text-white">${message.innerHTML}</span>
                        </div>`;
            }).join('');

        }, error => {
            console.error("[GUILD] Error listening to guild chat:", error);
            const chatMessagesElement = document.getElementById('guild-chat-messages');
            if (chatMessagesElement) {
                chatMessagesElement.innerHTML = '<p class="text-red-500 text-center">Erreur de chargement du chat.</p>';
            }
        });
    }

    async function sendGuildChatMessage() {
        const input = document.getElementById('guild-chat-input');
        if (!input) return;
        const message = input.value.trim();
        if (message.length === 0 || !playerGuildId) return;

        input.disabled = true;
        try {
            await db.collection('guilds').doc(playerGuildId).collection('chat').add({
                senderId: currentUser.uid,
                senderName: currentUser.email.split('@')[0],
                message: message,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            input.value = '';
        } catch (error) {
            console.error("Error sending chat message:", error);
            resultElement.innerHTML = `<p class="text-red-500">Erreur d'envoi du message.</p>`;
        } finally {
            input.disabled = false;
            input.focus();
        }
    }

    async function contributeToGuild() {
        const input = document.getElementById('guild-contribution-input');
        if (!input) return;
        const amount = parseInt(input.value, 10);

        if (isNaN(amount) || amount <= 0) {
            resultElement.innerHTML = `<p class="text-yellow-400">Veuillez entrer un montant valide.</p>`;
            return;
        }
        if (coins < amount) {
            resultElement.innerHTML = `<p class="text-red-400">Vous n'avez pas assez de pièces.</p>`;
            return;
        }

        input.disabled = true;
        const guildRef = db.collection('guilds').doc(playerGuildId);

        try {
            // Utiliser une transaction pour assurer la cohérence
            await db.runTransaction(async (transaction) => {
                const guildDoc = await transaction.get(guildRef);
                if (!guildDoc.exists) throw new Error("La guilde n'existe plus.");
                
                // Mettre à jour les pièces du joueur (localement, sera sauvegardé)
                coins -= amount;
                // Mettre à jour l'EXP de la guilde dans la transaction
                transaction.update(guildRef, {
                    exp: firebase.firestore.FieldValue.increment(amount)
                });
            });

            // Mettre à jour la mission de contribution
            missions.forEach(mission => {
                if (mission.type === "contribute_to_guild" && !mission.completed) {
                    mission.progress += amount;
                }
            });
            checkMissions();

            resultElement.innerHTML = `<p class="text-green-400">Merci ! Vous avez contribué ${amount.toLocaleString()} pièces à la guilde.</p>`;
            updateUI(); // Mettre à jour l'affichage des pièces
            scheduleSave();
            input.value = '';

        } catch (error) {
            console.error("Erreur de contribution:", error);
            resultElement.innerHTML = `<p class="text-red-500">Erreur lors de la contribution: ${error.message}</p>`;
        } finally {
            input.disabled = false;
        }
    }

    // --- NOUVEAU: Fonctions de Guilde ---

    function getGuildLevelFromExp(exp) {
        let level = 0;
        const sortedLevels = Object.keys(GUILD_LEVEL_THRESHOLDS).map(Number).sort((a, b) => a - b);
        for (const lvl of sortedLevels) {
            if (exp >= GUILD_LEVEL_THRESHOLDS[lvl]) {
                level = lvl;
            } else {
                break;
            }
        }
        return level;
    }

    async function updateGuildDisplay() {
        if (playerGuildId && playerGuildData) { 
            guildJoinCreateView.classList.add('hidden');
            guildMainView.classList.remove('hidden');
            showGuildSubTab(activeGuildSubTabId);
        } else {
            guildJoinCreateView.classList.remove('hidden');
            guildMainView.classList.add('hidden');
        }
    }

    function showGuildSubTab(subtabId) {
        activeGuildSubTabId = subtabId;

        // Cacher tous les panneaux de sous-onglets de manière plus robuste
        const subtabPanels = document.querySelectorAll('#guild-subtab-content > div');
        subtabPanels.forEach(panel => {
            if (panel) panel.classList.add('hidden');
        });

        // Construire le bon ID et vérifier son existence
        const panelIdToShow = subtabId + '-subtab';
        const panelToShow = document.getElementById(panelIdToShow);

        if (panelToShow) {
            panelToShow.classList.remove('hidden');
        } else {
            console.error(`Panneau de sous-onglet de guilde introuvable : ${panelIdToShow}. Affichage de l'onglet principal par défaut.`);
            const mainPanel = document.getElementById('guild-main-subtab');
            if (mainPanel) mainPanel.classList.remove('hidden');
            activeGuildSubTabId = 'guild-main'; // Réinitialiser l'onglet actif en cas d'erreur
        }

        // Mettre à jour le style des boutons en utilisant la variable d'état (qui peut avoir été corrigée)
        document.querySelectorAll('.guild-subtab-button').forEach(btn => {
            btn.classList.toggle('border-blue-500', btn.dataset.subtab === activeGuildSubTabId);
            btn.classList.toggle('border-transparent', btn.dataset.subtab !== activeGuildSubTabId);
        });

        // Appeler les fonctions de rendu spécifiques
        if (activeGuildSubTabId === 'guild-main') {
            renderGuildMainView(playerGuildData);
        } else if (activeGuildSubTabId === 'guild-raid') {
            renderGuildRaidView(playerGuildData);
        } else if (activeGuildSubTabId === 'guild-gvg') {
            renderGvgView(playerGuildData);
        }
    }

    async function loadAndDisplayGuildData(guildId) {
        playerGuildId = guildId;
        listenForGuildData(guildId);
        listenForGuildChat(guildId);
    }

    function renderGuildMainView(data) {
        const guildContentGrid = document.getElementById('guild-content-grid');
        const username = currentUser.email.split('@')[0];
        const isOwner = data.ownerId === currentUser.uid;

        document.getElementById('guild-name-display').textContent = data.name;
        const currentLevel = getGuildLevelFromExp(data.exp);
        const expForNextLevel = GUILD_LEVEL_THRESHOLDS[currentLevel + 1] || data.exp;
        document.getElementById('guild-level-exp-display').innerHTML = `Niveau <span id="guild-level-display">${currentLevel}</span> (<span id="guild-exp-display">${data.exp.toLocaleString()}</span> / <span id="guild-exp-needed-display">${expForNextLevel.toLocaleString()}</span> EXP)`;

        // Construction de l'interface principale de la guilde
        guildContentGrid.innerHTML = `
            <!-- Colonne principale (Chat & Contribution) -->
            <div>
                <div class="bg-gray-700 bg-opacity-50 p-4 rounded-lg mb-4">
                    <h3 class="text-xl text-white font-bold mb-2">Chat de Guilde</h3>
                    <div id="guild-chat-messages" class="guild-chat-messages mb-2">
                        <p class="text-gray-400 text-center">Chargement des messages...</p>
                    </div>
                    <div class="flex gap-2">
                        <input type="text" id="guild-chat-input" class="flex-grow p-2 bg-gray-900 text-white rounded border border-gray-600" placeholder="Votre message...">
                        <button id="guild-send-chat-button" class="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg">Envoyer</button>
                    </div>
                </div>
                <div class="bg-gray-700 bg-opacity-50 p-4 rounded-lg">
                    <h3 class="text-xl text-white font-bold mb-2">Contribuer à la Guilde</h3>
                    <p class="text-sm text-gray-300 mb-2">Chaque pièce donnée ajoute 1 EXP à la guilde.</p>
                    <div class="flex gap-2">
                        <input type="number" id="guild-contribution-input" min="1" class="flex-grow p-2 bg-gray-900 text-white rounded border border-gray-600" placeholder="Montant en pièces...">
                        <button id="guild-contribute-button" class="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-2 px-4 rounded-lg">Contribuer</button>
                    </div>
                </div>
            </div>

            <!-- Colonne latérale (Membres & Bonus) -->
            <div>
                <div class="bg-gray-700 bg-opacity-50 p-4 rounded-lg mb-4">
                    <h3 class="text-xl text-white font-bold mb-2">Membres (${Object.keys(data.members || {}).length} / ${GUILD_MEMBER_LIMIT})</h3>
                    <ul id="guild-member-list" class="guild-member-list space-y-1 text-white">
                        ${Object.entries(data.members || {}).map(([uid, memberData]) => `
                            <li class="flex justify-between items-center p-1 rounded ${uid === data.ownerId ? 'bg-yellow-500 bg-opacity-20' : ''}">
                                <span>${memberData.name} ${uid === data.ownerId ? '👑' : ''}</span>
                                <span class="text-xs text-gray-400">Niv. ${memberData.level}</span>
                            </li>
                        `).join('')}
                    </ul>
                </div>
                <div class="bg-gray-700 bg-opacity-50 p-4 rounded-lg">
                    <h3 class="text-xl text-white font-bold mb-2">Bonus de Guilde</h3>
                    <ul id="guild-perks-list" class="guild-perks-list space-y-1 text-white">
                        ${Object.entries(GUILD_PERKS).map(([level, perk]) => `
                            <li class="${currentLevel >= parseInt(level) ? 'text-green-400' : 'text-gray-500'}">
                                <strong>Niv. ${level}:</strong> ${perk.description}
                            </li>
                        `).join('')}
                    </ul>
                </div>
            </div>
        `;

        // Attacher les écouteurs d'événements spécifiques à cette vue
        document.getElementById('guild-send-chat-button').addEventListener('click', sendGuildChatMessage);
        document.getElementById('guild-chat-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendGuildChatMessage();
        });
        document.getElementById('guild-contribute-button').addEventListener('click', contributeToGuild);
        // NOUVEAU: Écouteur pour quitter la guilde
        const leaveButton = document.getElementById('leave-guild-button');
        if (leaveButton) leaveButton.addEventListener('click', leaveGuild);
    }

    function renderGuildRaidView(data) {
        const isOwner = data.ownerId === currentUser.uid;
        const raidBossView = document.getElementById('guild-raid-boss-view');
        const noRaidView = document.getElementById('guild-no-raid-view');
        const openRaidBtn = document.getElementById('open-raid-selection-button');
    
        if (data.activeRaid) {
            noRaidView.classList.add('hidden');
            raidBossView.classList.remove('hidden');
            renderRaidBossView(data.activeRaid);
        } else {
            noRaidView.classList.remove('hidden');
            raidBossView.classList.add('hidden');
            openRaidBtn.disabled = !isOwner;
        }
    }

    async function searchGuilds() {
        const searchTerm = guildSearchInput.value.trim();
        if (searchTerm.length < 3) {
            guildSearchResults.innerHTML = `<p class="text-yellow-400">Veuillez entrer au moins 3 caractères pour rechercher.</p>`;
            return;
        }
        guildSearchResults.innerHTML = `<p class="text-white">Recherche en cours...</p>`;

        try {
            const querySnapshot = await db.collection('guilds').where('name', '>=', searchTerm).where('name', '<=', searchTerm + '\uf8ff').limit(10).get();
            if (querySnapshot.empty) {
                guildSearchResults.innerHTML = `<p class="text-gray-400">Aucune guilde trouvée.</p>`;
                return;
            }
            guildSearchResults.innerHTML = querySnapshot.docs.map(doc => {
                const guild = doc.data();
                const isFull = Object.keys(guild.members || {}).length >= GUILD_MEMBER_LIMIT;
                return `
                    <div class="bg-gray-700 p-3 rounded-lg flex justify-between items-center">
                        <div>
                            <p class="text-white font-semibold">${guild.name}</p>
                            <p class="text-sm text-gray-400">Membres: ${Object.keys(guild.members || {}).length}/${GUILD_MEMBER_LIMIT} | Niveau: ${getGuildLevelFromExp(guild.exp)}</p>
                        </div>
                        <button class="join-guild-button bg-blue-500 hover:bg-blue-600 text-white py-1 px-3 rounded-lg text-sm ${isFull ? 'opacity-50 cursor-not-allowed' : ''}" data-guild-id="${doc.id}" data-guild-name="${guild.name}" ${isFull ? 'disabled' : ''}>
                            ${isFull ? 'Pleine' : 'Rejoindre'}
                        </button>
                    </div>
                `;
            }).join('');
        } catch (error) {
            console.error("Erreur de recherche de guilde:", error);
            guildSearchResults.innerHTML = `<p class="text-red-500">Erreur lors de la recherche.</p>`;
        }
    }

    async function joinGuild(guildId, guildName) {
        if (playerGuildId) {
            resultElement.innerHTML = `<p class="text-red-400">Vous êtes déjà dans une guilde.</p>`;
            return;
        }
        
        const guildRef = db.collection('guilds').doc(guildId);
        const playerRef = db.collection('playerSaves').doc(currentUser.uid);

        try {
            await db.runTransaction(async (transaction) => {
                const guildDoc = await transaction.get(guildRef);
                if (!guildDoc.exists) throw new Error("La guilde n'existe plus.");
                
                const guildData = guildDoc.data();
                if (Object.keys(guildData.members || {}).length >= GUILD_MEMBER_LIMIT) {
                    throw new Error("La guilde est pleine.");
                }

                const username = currentUser.email.split('@')[0];
                const newMemberData = { name: username, level: level };
                transaction.update(guildRef, { [`members.${currentUser.uid}`]: newMemberData });
                transaction.update(playerRef, { playerGuildId: guildId });
            });

            resultElement.innerHTML = `<p class="text-green-400">Vous avez rejoint la guilde "${guildName}" !</p>`;
            await loadAndDisplayGuildData(guildId);
            scheduleSave();

        } catch (error) {
            console.error("Erreur pour rejoindre la guilde:", error);
            resultElement.innerHTML = `<p class="text-red-500">Impossible de rejoindre la guilde: ${error.message}</p>`;
        }
    }

    function openCreateGuildModal() {
        if (coins < 10000) {
            resultElement.innerHTML = `<p class="text-red-400">Il vous faut 10,000 pièces pour créer une guilde.</p>`;
            return;
        }
        openModal(createGuildModal);
    }

    async function createGuild() {
        const guildName = createGuildNameInput.value.trim();
        if (guildName.length < 3 || guildName.length > 20) {
            resultElement.innerHTML = `<p class="text-red-400">Le nom de la guilde doit faire entre 3 et 20 caractères.</p>`;
            return;
        }
        if (coins < 10000) {
            resultElement.innerHTML = `<p class="text-red-400">Pas assez de pièces.</p>`;
            return;
        }

        // Vérifier si le nom est déjà pris
        const guildsRef = db.collection('guilds');
        const querySnapshot = await guildsRef.where('name', '==', guildName).get();
        if (!querySnapshot.empty) {
            resultElement.innerHTML = `<p class="text-red-400">Ce nom de guilde est déjà pris.</p>`;
            return;
        }

        coins -= 10000;
        const username = currentUser.email.split('@')[0];
        const newGuildData = {
            name: guildName,
            ownerId: currentUser.uid,
            gvg: { status: 'peace', wins: 0, losses: 0 }, // NOUVEAU
            guildTokens: 0, // NOUVEAU
            exp: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            members: {
                [currentUser.uid]: { name: username, level: level }
            }
        };

        try {
            const docRef = await guildsRef.add(newGuildData);
            playerGuildId = docRef.id;
            await db.collection('playerSaves').doc(currentUser.uid).update({ playerGuildId: docRef.id });
            
            resultElement.innerHTML = `<p class="text-green-400">Guilde "${guildName}" créée avec succès !</p>`;
            closeModalHelper(createGuildModal);
            await loadAndDisplayGuildData(playerGuildId);

            updateUI();
            scheduleSave();

        } catch (error) {
            console.error("Erreur de création de guilde:", error);
            resultElement.innerHTML = `<p class="text-red-500">Erreur lors de la création de la guilde.</p>`;
            coins += 10000; // Rembourser
        }
    }

    function openGuildActionConfirmModal(message, callback) {
        guildActionConfirmMessageElement.textContent = message;
        guildActionConfirmationCallback = callback;
        openModal(guildActionConfirmModal);
    }

    function closeGuildActionConfirmModal() {
        closeModalHelper(guildActionConfirmModal);
        guildActionConfirmationCallback = null;
    }

    async function leaveGuild() {
        if (!playerGuildId || !playerGuildData) return;

        const isOwner = playerGuildData.ownerId === currentUser.uid;
        const memberCount = Object.keys(playerGuildData.members || {}).length;

        if (isOwner && memberCount > 1) {
            resultElement.innerHTML = `<p class="text-red-400">Vous ne pouvez pas quitter la guilde car vous en êtes le propriétaire. Veuillez d'abord transférer la propriété ou dissoudre la guilde (fonctionnalité à venir).</p>`;
            return;
        }

        const confirmMessage = `Êtes-vous sûr de vouloir quitter la guilde "${playerGuildData.name}" ?` + (isOwner ? " Cela la dissoudra car vous êtes le dernier membre." : "");

        const userConfirmed = await new Promise(resolve => {
            guildActionConfirmationCallback = (confirmed) => resolve(confirmed);
            openGuildActionConfirmModal(confirmMessage, guildActionConfirmationCallback);
        });
        guildActionConfirmationCallback = null; // Clean up

        if (!userConfirmed) {
            resultElement.innerHTML = `<p class="text-blue-400">Action annulée.</p>`;
            return;
        }

        const guildIdToLeave = playerGuildId; 

        cleanupGuildListeners();
        playerGuildId = null; // Mettre à jour l'état local

        const guildRef = db.collection('guilds').doc(guildIdToLeave);
        const playerRef = db.collection('playerSaves').doc(currentUser.uid);

        try {
            if (isOwner && memberCount === 1) {
                // Dissoudre la guilde
                await guildRef.delete();
            } else {
                // Juste quitter
                await guildRef.update({
                    [`members.${currentUser.uid}`]: firebase.firestore.FieldValue.delete()
                });
            }

            // Mettre à jour la sauvegarde du joueur
            await playerRef.update({ playerGuildId: null });

            resultElement.innerHTML = `<p class="text-green-400">Vous avez quitté la guilde.</p>`;
            
            // Nettoyer l'état local
            playerGuildId = null;
            cleanupGuildListeners();
            updateGuildDisplay(); // Mettre à jour l'UI pour afficher la vue "rejoindre/créer"
            scheduleSave();

        } catch (error) {
            console.error("Erreur pour quitter la guilde:", error);
            resultElement.innerHTML = `<p class="text-red-500">Une erreur est survenue en quittant la guilde.</p>`;
        }
    }

    function openRaidSelectionModal() {
        if (!playerGuildData || playerGuildData.ownerId !== currentUser.uid) return;
        if (playerGuildData.activeRaid) {
            resultElement.innerHTML = `<p class="text-yellow-400">Un raid est déjà en cours !</p>`;
            return;
        }

        raidBossSelectionList.innerHTML = raidBosses.map(boss => {
            const canAfford = (playerGuildData.guildTokens || 0) >= boss.cost;
            return `
                <div class="bg-gray-700 p-4 rounded-lg flex items-center justify-between">
                    <div>
                        <h4 class="text-lg font-bold text-white">${boss.name}</h4>
                        <p class="text-sm text-gray-300">Santé: ${boss.totalHealth.toLocaleString()}</p>
                        <p class="text-sm text-gray-300">Coût: ${boss.cost} Jetons de Guilde</p>
                    </div>
                    <button class="start-raid-button bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-lg ${!canAfford ? 'opacity-50 cursor-not-allowed' : ''}" data-boss-id="${boss.id}" ${!canAfford ? 'disabled' : ''}>
                        Lancer
                    </button>
                </div>
            `;
        }).join('');

        openModal(raidSelectionModal);
    }

    async function startRaid(bossId) {
        const bossDef = raidBosses.find(b => b.id === bossId);
        if (!bossDef || !playerGuildId || !playerGuildData || playerGuildData.ownerId !== currentUser.uid) return;

        if ((playerGuildData.guildTokens || 0) < bossDef.cost) {
            resultElement.innerHTML = `<p class="text-red-400">La guilde n'a pas assez de Jetons de Guilde.</p>`;
            return;
        }

        const guildRef = db.collection('guilds').doc(playerGuildId);
        const newRaidData = {
            bossId: bossId,
            currentHealth: bossDef.totalHealth,
            startTime: firebase.firestore.FieldValue.serverTimestamp(),
            contributors: {},
            status: 'active'
        };

        try {
            await guildRef.update({
                activeRaid: newRaidData,
                guildTokens: firebase.firestore.FieldValue.increment(-bossDef.cost)
            });
            resultElement.innerHTML = `<p class="text-green-400">Le raid contre ${bossDef.name} a commencé !</p>`;
            closeModalHelper(raidSelectionModal);
        } catch (error) {
            console.error("Erreur lors du lancement du raid:", error);
            resultElement.innerHTML = `<p class="text-red-500">Erreur lors du lancement du raid.</p>`;
        }
    }

    async function attackRaidBoss() {
        if (raidAttempts <= 0) {
            resultElement.innerHTML = `<p class="text-red-400">Vous n'avez plus de tentatives de raid pour aujourd'hui.</p>`;
            return;
        }
        currentLevelId = 'raid_battle';
        openModal(characterSelectionModal);
        updateCharacterSelectionDisplay();
    }

    async function executeRaidAttack(team) {
        if (!playerGuildId || !playerGuildData.activeRaid) return;

        const damage = team.reduce((sum, char) => sum + char.power, 0);
        const guildRef = db.collection('guilds').doc(playerGuildId);
        const username = currentUser.email.split('@')[0];

        try {
            await db.runTransaction(async (transaction) => {
                const guildDoc = await transaction.get(guildRef);
                if (!guildDoc.exists || !guildDoc.data().activeRaid) throw new Error("Le raid n'est plus actif.");

                const currentRaid = guildDoc.data().activeRaid;
                const newHealth = Math.max(0, currentRaid.currentHealth - damage);

                transaction.update(guildRef, {
                    [`activeRaid.currentHealth`]: newHealth,
                    [`activeRaid.contributors.${currentUser.uid}.damage`]: firebase.firestore.FieldValue.increment(damage),
                    [`activeRaid.contributors.${currentUser.uid}.name`]: username
                });

                if (newHealth <= 0 && currentRaid.status === 'active') {
                    transaction.update(guildRef, { 'activeRaid.status': 'completed' });
                }
            });

            raidAttempts--;
            lastRaidAttemptDate = new Date().toISOString().split('T')[0];
            resultElement.innerHTML = `<p class="text-green-400">Vous avez infligé ${damage.toLocaleString()} dégâts au boss !</p>`;
            
            const updatedGuildData = (await guildRef.get()).data();
            if (updatedGuildData.activeRaid.status === 'completed') {
                resultElement.innerHTML += `<p class="text-yellow-400 font-bold">VICTOIRE ! Le boss a été vaincu ! Distribution des récompenses...</p>`;
                await processRaidRewards(updatedGuildData, updatedGuildData.activeRaid);
            }

        } catch (error) {
            console.error("Erreur lors de l'attaque du raid:", error);
            resultElement.innerHTML = `<p class="text-red-500">Erreur d'attaque: ${error.message}</p>`;
        }
        scheduleSave();
    }

    async function processRaidRewards(guildData, raidData) {
        const bossDef = raidBosses.find(b => b.id === raidData.bossId);
        if (!bossDef) return;

        const batch = db.batch();
        const contributors = Object.entries(raidData.contributors || {}).map(([uid, data]) => ({ uid, ...data })).sort((a, b) => b.damage - a.damage);

        // 1. Récompenses de victoire pour tous les membres
        for (const memberId in guildData.members) {
            const mailRef = db.collection('playerSaves').doc(memberId).collection('mailbox').doc();
            batch.set(mailRef, {
                subject: `Victoire contre ${bossDef.name} !`,
                body: `Votre guilde a vaincu le boss ! Voici vos récompenses de victoire.`,
                rewards: bossDef.rewards.victory,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        // 2. Récompenses de participation pour les contributeurs
        for (const contributor of contributors) {
            const mailRef = db.collection('playerSaves').doc(contributor.uid).collection('mailbox').doc();
            batch.set(mailRef, {
                subject: `Participation au raid ${bossDef.name}`,
                body: `Merci pour votre participation !`,
                rewards: bossDef.rewards.participation,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        // 3. Récompenses de classement
        const sortedRanks = bossDef.rewards.ranking.sort((a, b) => a.rank - b.rank);
        let lastRankTier = 0;
        for (const rankTier of sortedRanks) {
            const topContributorsForTier = contributors.slice(lastRankTier, rankTier.rank);
            for (const contributor of topContributorsForTier) {
                const mailRef = db.collection('playerSaves').doc(contributor.uid).collection('mailbox').doc();
                batch.set(mailRef, {
                    subject: `Classement du raid ${bossDef.name}`,
                    body: `Félicitations pour votre classement (Top ${rankTier.rank}) !`,
                    rewards: rankTier.rewards,
                    timestamp: firebase.firestore.FieldValue.serverTimestamp()
                });
            }
            lastRankTier = rankTier.rank;
        }

        // 4. Nettoyer le raid actif
        batch.update(db.collection('guilds').doc(playerGuildId), { activeRaid: firebase.firestore.FieldValue.delete() });

        try {
            await batch.commit();
            console.log("Récompenses de raid distribuées avec succès.");
        } catch (error) {
            console.error("Erreur lors de la distribution des récompenses de raid:", error);
        }
    }

    function checkMailbox() {
        if (!currentUser) return;
        if (mailListener) mailListener();

        const mailRef = db.collection('playerSaves').doc(currentUser.uid).collection('mailbox');
        mailListener = mailRef.onSnapshot(snapshot => {
            unreadMailCount = snapshot.size;
            const badge = document.getElementById('mailbox-badge');
            if (badge) {
                badge.classList.toggle('hidden', unreadMailCount === 0);
            }
        });
    }

    async function openMailbox() {
        const mailList = document.getElementById('mailbox-list');
        const claimAllBtn = document.getElementById('claim-all-mail-button');
        mailList.innerHTML = '<p class="text-gray-400">Chargement...</p>';
        openModal(document.getElementById('mailbox-modal'));

        const mailRef = db.collection('playerSaves').doc(currentUser.uid).collection('mailbox').orderBy('timestamp', 'desc');
        const snapshot = await mailRef.get();

        if (snapshot.empty) {
            mailList.innerHTML = '<p class="text-gray-400 text-center">Votre boîte aux lettres est vide.</p>';
            claimAllBtn.disabled = true;
            return;
        }

        mailList.innerHTML = snapshot.docs.map(doc => {
            const mail = doc.data();
            const rewards = mail.rewards;
            let rewardText = [];
            if (rewards.gems) rewardText.push(`${rewards.gems} Gemmes`);
            if (rewards.coins) rewardText.push(`${rewards.coins.toLocaleString()} Pièces`);
            if (rewards.guildTokens) rewardText.push(`${rewards.guildTokens} Jetons de Guilde`);
            if (rewards.items) rewardText.push(...rewards.items.map(i => `${i.quantity}x ${i.item}`));

            return `<div class="bg-gray-700 p-3 rounded-lg"><h5 class="font-bold text-white">${mail.subject}</h5><p class="text-sm text-gray-300">${mail.body}</p><p class="text-sm text-yellow-300 mt-1">Récompenses: ${rewardText.join(', ')}</p></div>`;
        }).join('');
        claimAllBtn.disabled = false;
    }

    async function claimAllMail() {
        const mailRef = db.collection('playerSaves').doc(currentUser.uid).collection('mailbox');
        const snapshot = await mailRef.get();
        if (snapshot.empty) return;

        const batch = db.batch();
        let totalRewards = { gems: 0, coins: 0, guildTokens: 0, items: {} };

        snapshot.docs.forEach(doc => {
            const mail = doc.data();
            const rewards = mail.rewards;
            if (rewards.gems) totalRewards.gems += rewards.gems;
            if (rewards.coins) totalRewards.coins += rewards.coins;
            if (rewards.guildTokens) totalRewards.guildTokens += rewards.guildTokens;
            if (rewards.items) {
                rewards.items.forEach(item => {
                    totalRewards.items[item.item] = (totalRewards.items[item.item] || 0) + item.quantity;
                });
            }
            batch.delete(doc.ref);
        });

        addGems(totalRewards.gems);
        coins += totalRewards.coins;
        inventory["Jeton de Guilde"] = (inventory["Jeton de Guilde"] || 0) + totalRewards.guildTokens;
        for (const [itemName, quantity] of Object.entries(totalRewards.items)) {
            inventory[itemName] = (inventory[itemName] || 0) + quantity;
        }

        try {
            await batch.commit();
            resultElement.innerHTML = `<p class="text-green-400">Toutes les récompenses ont été réclamées !</p>`;
            closeModalHelper(document.getElementById('mailbox-modal'));
            updateUI();
            updateItemDisplay();
            scheduleSave();
        } catch (error) {
            console.error("Erreur lors de la réclamation des récompenses:", error);
        }
    }

    // --- NOUVEAU: Fonctions pour la GvG ---

    function renderGvgView(guildData) {
        if (gvgTimerIntervalId) {
            clearInterval(gvgTimerIntervalId);
            gvgTimerIntervalId = null;
        }

        const peaceView = document.getElementById('gvg-peace-view');
        const prepView = document.getElementById('gvg-preparation-view');
        const combatView = document.getElementById('gvg-combat-view');
        
        peaceView.classList.add('hidden');
        prepView.classList.add('hidden');
        combatView.classList.add('hidden');
    
        const gvgState = guildData.gvg || { status: 'peace' };
    
        switch (gvgState.status) {
            case 'preparation':
                prepView.classList.remove('hidden');
                listenForGvgWarData(gvgState.currentWarId);
                break;
            case 'combat':
                combatView.classList.remove('hidden');
                listenForGvgWarData(gvgState.currentWarId); // Décommenté pour la phase de combat
                break;
            case 'peace':
            default:
                peaceView.classList.remove('hidden');
                const matchmakingButton = document.getElementById('gvg-matchmaking-button');
                matchmakingButton.disabled = guildData.ownerId !== currentUser.uid;
                document.getElementById('gvg-wins').textContent = guildData.gvg?.wins || 0;
                document.getElementById('gvg-losses').textContent = guildData.gvg?.losses || 0;
                break;
        }
    }

    async function listenForGvgWarData(warId) {
        if (gvgWarDataListener) gvgWarDataListener(); // Détache l'ancien listener

        const warRef = db.collection('gvgWars').doc(warId);

        try {
            // Étape 1 : Essayer de récupérer le document une seule fois pour vérifier son existence
            const initialDoc = await warRef.get();

            if (!initialDoc.exists) {
                // Le document n'existe pas. On nettoie immédiatement l'état de la guilde.
                console.warn(`[GvG Listener] Le document de guerre (ID: ${warId}) n'a pas été trouvé. Réinitialisation de l'état de la guilde.`);
                if (playerGuildId) {
                    db.collection('guilds').doc(playerGuildId).update({
                        'gvg.status': 'peace',
                        'gvg.currentWarId': firebase.firestore.FieldValue.delete(),
                        'gvg.opponentGuildId': firebase.firestore.FieldValue.delete(),
                        'gvg.opponentGuildName': firebase.firestore.FieldValue.delete()
                    }).catch(err => console.error("Échec de la réinitialisation de l'état GvG de la guilde:", err));
                }
                return; // On arrête la fonction ici, pas besoin de créer un listener qui échouerait
            }

            // Étape 2 : Si le document existe, on peut attacher le listener en toute sécurité
            gvgWarDataListener = warRef.onSnapshot(doc => {
                if (doc.exists) {
                    gvgWarData = { id: doc.id, ...doc.data() };
                    
                    // Gérer la transition de phase si le temps est écoulé
                    if (gvgWarData.status === 'preparation' && gvgWarData.prepEndTime && gvgWarData.prepEndTime.toDate() < new Date()) {
                        if (playerGuildData.ownerId === currentUser.uid) {
                            console.log("Phase de préparation terminée. Passage au combat.");
                            switchToGvgCombatPhase(); // Assurez-vous que cette fonction existe et est correcte
                        }
                        return;
                    }

                    // Appeler la bonne fonction de rendu en fonction de l'état
                    if (gvgWarData.status === 'preparation') {
                        renderGvgPreparationView(gvgWarData);
                    } else if (gvgWarData.status === 'combat') {
                        const attacksMade = gvgWarData.battlefield[currentUser.uid]?.attacksMade || 0;
                        gvgAttackTokens = GVG_CONFIG.ATTACK_TOKENS_PER_WAR - attacksMade;
                        renderGvgCombatView(gvgWarData);
                    }
                } else {
                    // Ce cas se produit si le document est supprimé PENDANT que l'on écoute
                    console.warn(`[GvG Listener] Le document de guerre (ID: ${warId}) a été supprimé. Réinitialisation.`);
                    if (playerGuildId) {
                        db.collection('guilds').doc(playerGuildId).update({
                            'gvg.status': 'peace',
                            'gvg.currentWarId': firebase.firestore.FieldValue.delete(),
                            'gvg.opponentGuildId': firebase.firestore.FieldValue.delete(),
                            'gvg.opponentGuildName': firebase.firestore.FieldValue.delete()
                        }).catch(err => console.error("Échec de la réinitialisation de l'état GvG:", err));
                    }
                }
            }, error => {
                // Ce bloc d'erreur est toujours utile pour d'autres types d'erreurs
                console.error("Erreur d'écoute des données GvG:", error);
            });

        } catch (error) {
            // Cette erreur se produira si le .get() initial échoue pour des raisons de permission
            console.error(`[GvG Listener] Erreur initiale de permission/lecture pour la guerre (ID: ${warId}):`, error);
            if (playerGuildId) {
                db.collection('guilds').doc(playerGuildId).update({
                    'gvg.status': 'peace',
                    'gvg.currentWarId': firebase.firestore.FieldValue.delete(),
                    'gvg.opponentGuildId': firebase.firestore.FieldValue.delete(),
                    'gvg.opponentGuildName': firebase.firestore.FieldValue.delete()
                }).catch(err => console.error("Échec de la réinitialisation de l'état GvG après erreur de get():", err));
            }
        }
    }

     function renderGvgPreparationView(warData) {
         const friendlyBattlefield = document.getElementById('gvg-friendly-battlefield');
         const enemyBattlefield = document.getElementById('gvg-enemy-battlefield');
         const friendlyGuildNameEl = document.getElementById('gvg-friendly-guild-name');
         const enemyGuildNameEl = document.getElementById('gvg-enemy-guild-name');
         const prepTimerEl = document.getElementById('gvg-prep-timer');
     
         const friendlyGuildInfo = warData.guildA.id === playerGuildId ? warData.guildA : warData.guildB;
         const enemyGuildInfo = warData.guildA.id === playerGuildId ? warData.guildB : warData.guildA;
     
         friendlyGuildNameEl.textContent = friendlyGuildInfo.name;
         enemyGuildNameEl.textContent = enemyGuildInfo.name;
     
         friendlyBattlefield.innerHTML = '';
         enemyBattlefield.innerHTML = '';
     
         const battlefieldNodes = warData.battlefield || {};
     
         Object.entries(battlefieldNodes).forEach(([uid, nodeData]) => {
             const isFriendly = nodeData.guildId === playerGuildId;
             const targetGrid = isFriendly ? friendlyBattlefield : enemyBattlefield;
             
             const nodeElement = document.createElement('div');
             let nodeClasses = `gvg-player-node ${isFriendly ? 'friendly' : 'enemy'}`;
             
             let contentHtml = `<p class="player-name">${nodeData.name}</p>`;
     
             if (nodeData.isSet) {
                 const teamPower = nodeData.defenseTeam.reduce((sum, char) => sum + char.power, 0);
                 contentHtml += `<div class="flex justify-center gap-1 mt-2">
                     ${nodeData.defenseTeam.map(char => `<img src="${char.image}" alt="${char.name}" title="${char.name}" class="w-8 h-8 rounded-full border-2 ${getRarityBorderClass(char.rarity)}">`).join('')}
                 </div>`;
                 contentHtml += `<p class="team-power mt-1">Puissance: ${teamPower.toLocaleString()}</p>`;
             }
     
             if (isFriendly && uid === currentUser.uid) {
                 if (nodeData.isSet) {
                     nodeClasses += ' cursor-pointer hover:bg-gray-700 transition-colors duration-200 gvg-player-node-editable';
                     nodeElement.dataset.uid = uid;
                     contentHtml += `<p class="text-xs text-yellow-400 mt-2">Cliquez pour modifier</p>`;
                 } else {
                     contentHtml += `<button class="gvg-set-defense-btn mt-2 bg-green-600 hover:bg-green-700 text-white text-xs py-1 px-2 rounded" data-uid="${uid}">Définir Défense</button>`;
                 }
             } else if (!nodeData.isSet) {
                 contentHtml += `<p class="text-yellow-400 text-xs mt-1">En attente...</p>`;
             }
             
             nodeElement.className = nodeClasses;
             nodeElement.innerHTML = contentHtml;
             targetGrid.appendChild(nodeElement);
         });
 
         if (warData.prepEndTime && prepTimerEl) {
             if (gvgTimerIntervalId) clearInterval(gvgTimerIntervalId);
             const updateTimer = () => {
                 const timeLeftMs = warData.prepEndTime.toDate() - Date.now();
                 if (timeLeftMs <= 0) {
                     prepTimerEl.textContent = "Terminé !";
                     clearInterval(gvgTimerIntervalId);
                 } else {
                     prepTimerEl.textContent = formatTime(timeLeftMs);
                 }
             };
             updateTimer();
             gvgTimerIntervalId = setInterval(updateTimer, 1000);
         }
     }

    async function startGvgMatchmaking() {
        if (!playerGuildData || playerGuildData.ownerId !== currentUser.uid) return;
        resultElement.innerHTML = '<p class="text-yellow-400">Lancement d\'une guerre de guilde de test...</p>';
    
        const battlefield = {};
        Object.entries(playerGuildData.members).forEach(([uid, memberData]) => {
            battlefield[uid] = { guildId: playerGuildId, name: memberData.name, isSet: false, health: 3, defenseTeam: [] };
        });
    
        const opponentGuildId = 'opponent_mock_id';
        const opponentGuildName = 'Les Ombres Silencieuses';
        const opponentMembers = { 'mock_player_1': { name: 'ShadowSlayer' }, 'mock_player_2': { name: 'NightBlade' }, 'mock_player_3': { name: 'VoidWalker' } };
        Object.entries(opponentMembers).forEach(([uid, memberData]) => {
            battlefield[uid] = { guildId: opponentGuildId, name: memberData.name, isSet: true, health: 3, defenseTeam: [] };
        });
    
        const prepEndTime = new Date();
        prepEndTime.setHours(prepEndTime.getHours() + 24);
    
        const newWarData = {
            status: 'preparation',
            guildA: { id: playerGuildId, name: playerGuildData.name, score: 0 },
            guildB: { id: opponentGuildId, name: opponentGuildName, score: 0 },
            battlefield: battlefield,
            prepEndTime: firebase.firestore.Timestamp.fromDate(prepEndTime),
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
    
        try {
            const warDocRef = await db.collection('gvgWars').add(newWarData);
            await db.collection('guilds').doc(playerGuildId).update({
                'gvg.status': 'preparation', 'gvg.currentWarId': warDocRef.id,
                'gvg.opponentGuildId': opponentGuildId, 'gvg.opponentGuildName': opponentGuildName
            });
            resultElement.innerHTML = `<p class="text-green-400">Guerre de guilde contre ${opponentGuildName} initialisée !</p>`;
        } catch (error) {
            console.error("Erreur lors du lancement de la GvG:", error);
            resultElement.innerHTML = `<p class="text-red-500">Erreur lors du lancement de la guerre.</p>`;
        }
    }

    async function setGvgDefense(teamObjects) {
        if (!gvgWarData || !playerGuildData.gvg || playerGuildData.gvg.status !== 'preparation') return;
        const minimalTeam = teamObjects.map(char => ({ id: char.id, name: char.name, power: char.power, image: char.image, rarity: char.rarity, level: char.level, color: char.color }));
        const warRef = db.collection('gvgWars').doc(gvgWarData.id);
        try {
            await warRef.update({ [`battlefield.${currentUser.uid}.isSet`]: true, [`battlefield.${currentUser.uid}.defenseTeam`]: minimalTeam });
            resultElement.innerHTML = `<p class="text-green-400">Équipe de défense GvG définie avec succès !</p>`;
        } catch (error) {
            console.error("Erreur lors de la définition de la défense GvG:", error);
            resultElement.innerHTML = `<p class="text-red-500">Erreur lors de la sauvegarde de l'équipe de défense.</p>`;
        }
    }

     function handleGvgBattlefieldClick(e) {
         const button = e.target.closest('.gvg-set-defense-btn');
         const editableNode = e.target.closest('.gvg-player-node-editable');
         
         let targetElement = null;
         if (button) {
             targetElement = button;
         } else if (editableNode) {
             targetElement = editableNode;
         }
 
         if (targetElement) {
             const uid = targetElement.dataset.uid;
             if (!uid || uid !== currentUser.uid) return;
     
             currentSelectionContext = 'gvg_defense';
             selectedBattleCharacters.clear();
     
             if (gvgWarData && gvgWarData.battlefield && gvgWarData.battlefield[uid] && gvgWarData.battlefield[uid].isSet) {
                 const defenseTeam = gvgWarData.battlefield[uid].defenseTeam;
                 if (defenseTeam && defenseTeam.length > 0) {
                     defenseTeam.forEach(defChar => {
                         const indexInOwned = ownedCharacters.findIndex(ownedChar => ownedChar.id === defChar.id);
                         if (indexInOwned !== -1) {
                             selectedBattleCharacters.add(indexInOwned);
                         }
                     });
                 }
             }
     
             openModal(characterSelectionModal);
             updateCharacterSelectionDisplay();
         }
     }

    // NOUVEAU: Fonction pour afficher la vue de combat GvG
    function renderGvgCombatView(warData) {
        const friendlyBattlefield = document.getElementById('gvg-combat-friendly-battlefield');
        const enemyBattlefield = document.getElementById('gvg-combat-enemy-battlefield');
        const friendlyGuildNameEl = document.getElementById('gvg-combat-friendly-guild-name');
        const enemyGuildNameEl = document.getElementById('gvg-combat-enemy-guild-name');
        const combatTimerEl = document.getElementById('gvg-combat-timer');
        const attackTokensEl = document.getElementById('gvg-attack-tokens');

        const friendlyGuildInfo = warData.guildA.id === playerGuildId ? warData.guildA : warData.guildB;
        const enemyGuildInfo = warData.guildA.id === playerGuildId ? warData.guildB : warData.guildA;

        friendlyGuildNameEl.textContent = friendlyGuildInfo.name;
        enemyGuildNameEl.textContent = enemyGuildInfo.name;
        attackTokensEl.textContent = gvgAttackTokens;

        friendlyBattlefield.innerHTML = '';
        enemyBattlefield.innerHTML = '';

        const battlefieldNodes = warData.battlefield || {};

        Object.entries(battlefieldNodes).forEach(([uid, nodeData]) => {
            const isFriendly = nodeData.guildId === playerGuildId;
            const targetGrid = isFriendly ? friendlyBattlefield : enemyBattlefield;
            const isDefeated = nodeData.health <= 0;

            const nodeElement = document.createElement('div');
            let nodeClasses = `gvg-player-node ${isFriendly ? 'friendly' : 'enemy'} ${isDefeated ? 'defeated' : ''}`;
            if (!isFriendly && !isDefeated && gvgAttackTokens > 0) {
                nodeClasses += ' attackable';
            }

            let hpDisplay = '<div class="player-hp">';
            for (let i = 0; i < 3; i++) {
                hpDisplay += `<div class="hp-point ${i < nodeData.health ? '' : 'lost'}"></div>`;
            }
            hpDisplay += '</div>';

            let contentHtml = `<p class="player-name">${nodeData.name}</p>${hpDisplay}`;
            if (nodeData.isSet) {
                const teamPower = nodeData.defenseTeam.reduce((sum, char) => sum + (char.power || 0), 0);
                contentHtml += `<div class="flex justify-center gap-1 mt-2">
                    ${nodeData.defenseTeam.map(char => `<img src="${char.image}" alt="${char.name}" title="${char.name}" class="w-8 h-8 rounded-full border-2 ${getRarityBorderClass(char.rarity)}">`).join('')}
                </div>`;
                contentHtml += `<p class="team-power mt-1">Puissance: ${teamPower.toLocaleString()}</p>`;
            } else {
                contentHtml += `<p class="text-yellow-400 text-xs mt-1">Pas de défense</p>`;
            }

            nodeElement.className = nodeClasses;
            nodeElement.innerHTML = contentHtml;
            nodeElement.dataset.uid = uid;
            targetGrid.appendChild(nodeElement);
        });

        if (warData.combatEndTime && combatTimerEl) {
            if (gvgTimerIntervalId) clearInterval(gvgTimerIntervalId);
            const updateTimer = () => {
                const timeLeftMs = warData.combatEndTime.toDate() - Date.now();
                if (timeLeftMs <= 0) {
                    combatTimerEl.textContent = "Terminé !";
                    clearInterval(gvgTimerIntervalId);
                    if (playerGuildData.ownerId === currentUser.uid) {
                        endGvgWarByTimeout();
                    }
                } else {
                    combatTimerEl.textContent = formatTime(timeLeftMs);
                }
            };
            updateTimer();
            gvgTimerIntervalId = setInterval(updateTimer, 1000);
        }
    }

    // NOUVEAU: Gérer les clics sur le champ de bataille en phase de combat
    function handleGvgCombatClick(e) {
        const node = e.target.closest('.gvg-player-node.attackable');
        if (!node) return;

        const targetUid = node.dataset.uid;
        if (targetUid) {
            startGvgAttack(targetUid);
        }
    }

    // NOUVEAU: Lancer une attaque GvG
    function startGvgAttack(targetUid) {
        if (gvgAttackTokens <= 0) {
            resultElement.innerHTML = `<p class="text-red-400">Vous n'avez plus de jetons d'attaque.</p>`;
            return;
        }
        if (!gvgWarData || !gvgWarData.battlefield[targetUid] || gvgWarData.battlefield[targetUid].health <= 0) {
            resultElement.innerHTML = `<p class="text-red-400">Cette cible ne peut pas être attaquée.</p>`;
            return;
        }

        currentGvgTargetUid = targetUid;
        currentSelectionContext = 'gvg_attack';
        selectedBattleCharacters.clear();
        openModal(characterSelectionModal);
        updateCharacterSelectionDisplay();
    }

    // NOUVEAU: Exécuter la logique de combat pour une attaque GvG
    async function executeGvgAttack(attackerTeam) {
        if (!currentGvgTargetUid || !gvgWarData) return;

        const defenderNode = gvgWarData.battlefield[currentGvgTargetUid];
        if (!defenderNode || !defenderNode.isSet) {
            resultElement.innerHTML = `<p class="text-red-400">L'adversaire n'a pas défini d'équipe de défense.</p>`;
            return;
        }

        const attackerPower = attackerTeam.reduce((sum, char) => sum + char.power, 0);
        const defenderPower = defenderNode.defenseTeam.reduce((sum, char) => sum + (char.power || 0), 0);

        const attackerScore = attackerPower * (1 + (Math.random() * 0.1));
        const defenderScore = defenderPower * (1 + (Math.random() * 0.1));

        const isVictory = attackerScore > defenderScore;

        resultElement.innerHTML = `<p class="text-white">Attaque contre ${defenderNode.name} en cours...</p>`;
        if (soundEnabled) battleSound.play();
        await new Promise(resolve => setTimeout(resolve, 1500));

        if (isVictory) {
            resultElement.innerHTML = `<p class="text-green-400 text-2xl font-bold">Victoire !</p><p class="text-white">Vous avez vaincu ${defenderNode.name} !</p>`;
            if (animationsEnabled) confetti({ particleCount: 150, spread: 90, origin: { y: 0.6 } });
        } else {
            resultElement.innerHTML = `<p class="text-red-400 text-2xl font-bold">Défaite !</p><p class="text-white">Vous avez été vaincu par ${defenderNode.name}.</p>`;
        }

        await processGvgAttackResult(isVictory);
    }

    // NOUVEAU: Mettre à jour les données de guerre après une attaque
    async function processGvgAttackResult(isVictory) {
        const warRef = db.collection('gvgWars').doc(gvgWarData.id);
        const attackerUid = currentUser.uid;

        try {
            await db.runTransaction(async (transaction) => {
                const warDoc = await transaction.get(warRef);
                if (!warDoc.exists) throw new Error("La guerre n'existe plus.");

                const currentWarData = warDoc.data();
                const battlefield = currentWarData.battlefield;

                const attacksMade = battlefield[attackerUid].attacksMade || 0;
                if (attacksMade >= GVG_CONFIG.ATTACK_TOKENS_PER_WAR) {
                    throw new Error("Plus de jetons d'attaque.");
                }

                transaction.update(warRef, { [`battlefield.${attackerUid}.attacksMade`]: attacksMade + 1 });

                if (isVictory) {
                    const currentWins = battlefield[attackerUid].wins || 0;
                    transaction.update(warRef, { [`battlefield.${attackerUid}.wins`]: currentWins + 1 });
                    
                    const defenderHealth = battlefield[currentGvgTargetUid].health;
                    if (defenderHealth > 0) {
                        transaction.update(warRef, { [`battlefield.${currentGvgTargetUid}.health`]: defenderHealth - 1 });
                    }
                }
            });
            
            const updatedWarDoc = await warRef.get();
            if (updatedWarDoc.exists) {
                gvgWarData = { id: updatedWarDoc.id, ...updatedWarDoc.data() };
                checkGvgVictory(gvgWarData);
            }

        } catch (error) {
            console.error("Erreur lors du traitement du résultat de l'attaque GvG:", error);
            resultElement.innerHTML = `<p class="text-red-500">Erreur lors de l'attaque: ${error.message}</p>`;
        }
    }

    // NOUVEAU: Vérifier si la guerre est terminée
    function checkGvgVictory(warData) {
        const guildA_Id = warData.guildA.id;
        const guildB_Id = warData.guildB.id;

        let guildA_NodesAlive = 0;
        let guildB_NodesAlive = 0;

        Object.values(warData.battlefield).forEach(node => {
            if (node.health > 0) {
                if (node.guildId === guildA_Id) {
                    guildA_NodesAlive++;
                } else if (node.guildId === guildB_Id) {
                    guildB_NodesAlive++;
                }
            }
        });

        if (guildA_NodesAlive === 0) {
            endGvgWar(guildB_Id, guildA_Id, warData);
        } else if (guildB_NodesAlive === 0) {
            endGvgWar(guildA_Id, guildB_Id, warData);
        }
    }

    // --- FIN: Fonctions de Guilde ---

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
        } else if (document.getElementById("leaderboard")?.contains(document.getElementById(subtabId))) {
            parentTabId = "leaderboard";
            activeSubTabVarName = "activeLeaderboardSubTabId";
            currentSubtabButtonsSelector = '#leaderboard .subtab-button';
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

            // --- NOUVEAU: Détacher le listener du classement PvP si on quitte ce sous-onglet ---
            if (parentTabId === 'play' && currentActiveSubTabId === 'pvp' && pvpLeaderboardListener) {
                console.log("[Listener] Détachement du listener du classement PvP (changement de sous-onglet).");
                pvpLeaderboardListener();
                pvpLeaderboardListener = null;
            }
            if (parentTabId === 'play' && currentActiveSubTabId === 'tour' && towerLeaderboardListener) {
                console.log("[Listener] Détachement du listener du classement Tour (changement de sous-onglet).");
                towerLeaderboardListener();
                towerLeaderboardListener = null;
            }
            if (parentTabId === 'leaderboard' && currentActiveSubTabId === 'leaderboard-player' && leaderboardListener) {
                console.log("[Listener] Détachement du listener du classement joueur (changement de sous-onglet).");
                leaderboardListener();
                leaderboardListener = null;
            }
            if (parentTabId === 'leaderboard' && currentActiveSubTabId === 'leaderboard-guild' && guildLeaderboardListener) {
                console.log("[Listener] Détachement du listener du classement guilde (changement de sous-onglet).");
                guildLeaderboardListener();
                guildLeaderboardListener = null;
            }
            // NOUVEAU: Détacher le listener des salles publiques co-op quand on quitte l'onglet
            if (parentTabId === 'play' && currentActiveSubTabId === 'coop' && publicRoomsListener) {
                console.log("[Listener] Détachement du listener des salles co-op (changement de sous-onglet).");
                publicRoomsListener();
                publicRoomsListener = null;
            }
            // --- FIN NOUVEAU ---
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
        } else if (parentTabId === "inventory" && subtabId === "items") { // Pas de logique spécifique ici, c'est ok
        } else if (parentTabId === "play" && subtabId === "pvp") { // CORRECTION
             updatePvpDisplay();
             updatePvpLeaderboard();
        } else if (parentTabId === "play" && subtabId === "quotidien") {
             updateDailyDungeonDisplay();
        } else if (parentTabId === "play" && subtabId === "tour") {
             updateTowerDisplay();
        } else if (parentTabId === "leaderboard" && subtabId === "leaderboard-player") {
            updateLeaderboard();
        } else if (parentTabId === "leaderboard" && subtabId === "leaderboard-guild") {
            updateGuildLeaderboard();
        } else if (parentTabId === "play" && subtabId === "coop") {
             updateCoopLobbyDisplay();
        }
        // updateCharacterDisplay() est appelé dans les fonctions ci-dessus si nécessaire, ou pour désactiver le mode suppression
        updateUI(); // Mise à jour générale de l'UI
    }

    function updateTowerDisplay() {
        const currentFloorEl = document.getElementById('tower-current-floor');
        const enemyPowerEl = document.getElementById('tower-enemy-power');
        const rewardsInfoEl = document.getElementById('tower-rewards-info');
        const startButton = document.getElementById('start-tower-floor-button');

        if (!currentFloorEl || !enemyPowerEl || !rewardsInfoEl || !startButton) return;

        currentFloorEl.textContent = towerFloor;

        const enemyPower = Math.floor(TOWER_CONFIG.baseEnemyPower * Math.pow(TOWER_CONFIG.powerIncreasePerFloor, towerFloor - 1));
        enemyPowerEl.textContent = `Puissance: ${enemyPower.toLocaleString()}`;

        let rewardsHtml = `<ul class="list-disc list-inside">`;
        const floorReward = TOWER_CONFIG.rewards.perFloor;
        rewardsHtml += `<li>${floorReward.gems} Gemmes, ${floorReward.coins} Pièces, ${floorReward.exp} EXP</li>`;

        if (towerFloor > 0 && towerFloor % TOWER_CONFIG.rewards.milestoneFloors === 0) {
            rewardsHtml += `<li class="text-yellow-300 font-bold">Étage Palier ! Récompenses Bonus :</li>`;
            const milestoneReward = TOWER_CONFIG.rewards.milestoneRewards;
            rewardsHtml += `<ul class="list-disc list-inside ml-4">`;
            rewardsHtml += `<li>+${milestoneReward.gems} Gemmes</li>`;
            milestoneReward.itemChance.forEach(chance => { rewardsHtml += `<li>${chance.item} (${chance.probability * 100}%)</li>`; });
            rewardsHtml += `</ul>`;
        }
        rewardsHtml += `</ul>`;
        rewardsInfoEl.innerHTML = rewardsHtml;
        updateTowerLeaderboard();
    }

    // --- NOUVEAU: Fonctions pour le mode Co-op ---

    function cleanupCoopListeners() {
        // MODIFIÉ: Ne nettoie que les listeners de la salle/bataille active.
        // Le listener du lobby (`publicRoomsListener`) n'est PAS touché ici.
        // Cela corrige un bug critique où, après avoir quitté une salle, le lobby
        // ne recevait plus de mises à jour en temps réel (nouvelles salles, etc.),
        // obligeant les joueurs à rafraîchir la page.
        if (currentCoopRoomListener) {
            currentCoopRoomListener();
            currentCoopRoomListener = null;
        }
        if (currentCoopBattleListener) {
            currentCoopBattleListener();
            currentCoopBattleListener = null;
        }
        currentCoopRoomId = null;
        coopCharacterSelectionCallback = null; // S'assurer que le callback est aussi nettoyé.
        coopLobbyView.classList.remove('hidden'); // Retour à la vue du lobby
        coopRoomView.classList.add('hidden'); // Cacher la vue de la salle
        closeModalHelper(coopBattleModal); // Fermer la modale de combat si elle est ouverte
    }

    async function updateCoopLobbyDisplay() {
        cleanupStaleCoopRooms(); // Exécuter le nettoyage à chaque fois que le lobby est affiché

        if (!coopDungeonList || !coopPublicRoomsList) return;

        const coopDungeons = allGameLevels.filter(l => l.type === 'coop');
        // MODIFICATION: Nouvelle structure pour la création de salle avec sélection de difficulté
        coopDungeonList.innerHTML = coopDungeons.map(dungeon => `
            <div class="coop-dungeon-card">
                <h5 class="text-lg font-bold text-white">${dungeon.name}</h5>
                <p class="text-xs text-gray-400 mt-1">Donjon pour ${dungeon.maxPlayers} joueurs.</p>
                <div class="mt-3 space-y-2">
                    <select class="coop-difficulty-select w-full bg-gray-700 text-white p-2 rounded" data-dungeon-id="${dungeon.id}">
                        ${dungeon.difficulties.map(d => `<option value="${d.level}">${d.level} (Boss: ${d.enemy.power.toLocaleString()})</option>`).join('')}
                    </select>
                    <button class="create-coop-room-button w-full bg-violet-600 hover:bg-violet-700 text-white font-bold py-2 px-4 rounded-lg" data-dungeon-id="${dungeon.id}">
                        Créer une Salle
                    </button>
                </div>
            </div>
        `).join('');

        if (publicRoomsListener) publicRoomsListener();
        
        publicRoomsListener = db.collection('coopRooms').where('status', '==', 'waiting').limit(20)
            .onSnapshot(snapshot => {
                if (snapshot.empty) {
                    coopPublicRoomsList.innerHTML = '<p class="text-gray-400 text-center">Aucune salle publique. Créez-en une !</p>';
                    return;
                }
                coopPublicRoomsList.innerHTML = snapshot.docs.map(doc => {
                    const room = doc.data();
                    const dungeon = allGameLevels.find(l => l.id === room.dungeonId);
                    // MODIFICATION: Utiliser la difficulté pour obtenir le max de joueurs
                    const maxPlayers = dungeon.maxPlayers; // La taille de l'équipe est définie par le donjon, pas la difficulté
                    const isFull = Object.keys(room.players).length >= maxPlayers;
                    return `
                        <div class="bg-gray-700 p-3 rounded-lg flex justify-between items-center">
                            <div>
                                <p class="text-white font-semibold">${room.hostName}'s Room - ${dungeon.name} (${room.difficulty})</p>
                                <p class="text-sm text-gray-400">Joueurs: ${Object.keys(room.players).length}/${maxPlayers}</p>
                            </div>
                            <button class="join-coop-room-button bg-blue-500 hover:bg-blue-600 text-white py-1 px-3 rounded-lg text-sm ${isFull ? 'opacity-50 cursor-not-allowed' : ''}" data-room-id="${doc.id}" ${isFull ? 'disabled' : ''}>
                                ${isFull ? 'Pleine' : 'Rejoindre'}
                            </button>
                        </div>
                    `;
                }).join('');
            }, error => {
                console.error("Error fetching co-op rooms:", error);
                coopPublicRoomsList.innerHTML = '<p class="text-red-500 text-center">Erreur de chargement des salles.</p>';
            });
    }

    async function createCoopRoom(dungeonId, difficulty) {
        if (!currentUser) return;
        const dungeon = allGameLevels.find(l => l.id === dungeonId);
        if (!dungeon) return;

        const username = currentUser.email.split('@')[0];
        const newRoom = {
            hostId: currentUser.uid,
            hostName: username,
            dungeonId: dungeonId,
            difficulty: difficulty, // NOUVEAU
            status: 'waiting',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            players: {
                [currentUser.uid]: { name: username, isReady: false, character: null }
            }
        };

        try {
            const roomRef = await db.collection('coopRooms').add(newRoom);
            await joinCoopRoom(roomRef.id, true);
        } catch (error) {
            console.error("Error creating co-op room:", error);
            resultElement.innerHTML = `<p class="text-red-500">Erreur lors de la création de la salle.</p>`;
        }
    }

    async function joinCoopRoom(roomId, isHost = false) {
        if (!currentUser) return;
        const roomRef = db.collection('coopRooms').doc(roomId);
        
        try {
            await db.runTransaction(async (transaction) => {
                const roomDoc = await transaction.get(roomRef);
                if (!roomDoc.exists) throw new Error("La salle n'existe plus.");
                
                const roomData = roomDoc.data();
                const dungeon = allGameLevels.find(l => l.id === roomData.dungeonId); // La taille de l'équipe est définie par le donjon, pas la difficulté
                
                if (Object.keys(roomData.players).length >= dungeon.maxPlayers && !isHost) {
                    throw new Error("La salle est pleine.");
                }

                if (!isHost) {
                    const username = currentUser.email.split('@')[0];
                    transaction.update(roomRef, {
                        [`players.${currentUser.uid}`]: { name: username, isReady: false, character: null }
                    });
                }
            });

            listenToCoopRoom(roomId);

            coopCharacterSelectionCallback = (character) => {
                const charData = {
                    id: character.id, name: character.name, rarity: character.rarity,
                    power: character.power, image: character.image, color: character.color
                };
                roomRef.update({ [`players.${currentUser.uid}.character`]: charData });
            };
            selectedBattleCharacters.clear();
            openModal(characterSelectionModal);
            updateCharacterSelectionDisplay();

        } catch (error) {
            console.error("Error joining co-op room:", error);
            resultElement.innerHTML = `<p class="text-red-500">Impossible de rejoindre: ${error.message}</p>`;
        }
    }

    function listenToCoopRoom(roomId) {
        if (currentCoopRoomListener) currentCoopRoomListener();

        currentCoopRoomListener = db.collection('coopRooms').doc(roomId)
            .onSnapshot(doc => {
                if (doc.exists) {
                    currentCoopRoomId = doc.id;
                    const roomData = doc.data();
                    
                    // NOUVEAU: Vérifier si un joueur s'est déconnecté pendant le combat
                    if (roomData.status === 'in-progress' && roomData.battleState?.playerCountAtStart) {
                        const currentPlayersInRoom = Object.keys(roomData.players).length;
                        if (currentPlayersInRoom < roomData.battleState.playerCountAtStart) {
                            // Un joueur a quitté. L'hôte met fin au combat.
                            if (roomData.hostId === currentUser.uid) {
                                console.log("Un joueur a quitté pendant le combat. Annulation par l'hôte.");
                                doc.ref.update({
                                    status: 'failed',
                                    'battleState.battleLog': firebase.firestore.FieldValue.arrayUnion("Un joueur a quitté. Le combat est annulé.")
                                }).catch(e => console.error("Erreur lors de l'annulation du combat:", e));
                            }
                            // Les autres clients recevront la mise à jour 'failed' et leur combat se terminera.
                            return;
                        }
                    }
                    
                    // Gérer l'affichage en fonction de l'état de la salle
                    if (roomData.status === 'waiting') {
                        renderCoopRoom(roomData);
                    }
 
                    // Si le combat commence (la modale n'est pas encore visible)
                    if (roomData.status === 'in-progress' && coopBattleModal.classList.contains('hidden')) {
                        launchCoopBattle(roomData);
                    // Si le combat est en cours (la modale est déjà visible), on met juste l'UI à jour
                    } else if (roomData.status === 'in-progress' && !coopBattleModal.classList.contains('hidden')) {
                        updateCoopBattleUI(roomData);
                    // Si le combat est terminé
                    } else if (roomData.status === 'completed' || roomData.status === 'failed') {
                        if(!coopBattleModal.classList.contains('hidden')) {
                            endCoopBattle(roomData.status === 'completed', roomData);
                        }
                    }
                } else {
                    resultElement.innerHTML = `<p class="text-yellow-400">La salle co-op a été dissoute (l'hôte a peut-être quitté).</p>`;
                    cleanupCoopListeners();
                }
            }, error => {
                console.error("Error listening to co-op room:", error);
                cleanupCoopListeners();
            });
    }

    function renderCoopRoom(roomData) {
        coopLobbyView.classList.add('hidden');
        coopRoomView.classList.remove('hidden');
        const dungeon = allGameLevels.find(l => l.id === roomData.dungeonId);
        // NOUVEAU: Utiliser la difficulté pour le titre
        coopRoomTitle.textContent = `Salle pour ${dungeon.name} (${roomData.difficulty})`;

        coopRoomPlayers.innerHTML = Object.entries(roomData.players).map(([uid, playerData]) => {
            const isHost = uid === roomData.hostId;
            return `
                <div class="coop-room-player-card ${playerData.isReady ? 'ready' : ''} ${isHost ? 'host' : ''}">
                    <p class="player-name font-bold text-white">${playerData.name}</p>
                    ${playerData.character ? `
                        <img src="${playerData.character.image}" alt="${playerData.character.name}" class="h-24 mx-auto my-2">
                        <p class="text-sm ${playerData.character.color}">${playerData.character.name}</p>
                        <p class="text-xs text-gray-300">Puissance: ${playerData.character.power.toLocaleString()}</p>
                    ` : '<p class="text-gray-400 my-4">Sélection...</p>'}
                    <p class="text-sm font-semibold ${playerData.isReady ? 'text-green-400' : 'text-yellow-400'}">${playerData.isReady ? 'Prêt' : 'Pas prêt'}</p>
                </div>
            `;
        }).join('');

        const allReady = Object.values(roomData.players).every(p => p.isReady);
        const isHost = currentUser.uid === roomData.hostId;
        coopStartBattleButton.classList.toggle('hidden', !isHost || !allReady);
    }

    async function leaveCoopRoom() {
        if (!currentCoopRoomId || !currentUser) return;
        const roomRef = db.collection('coopRooms').doc(currentCoopRoomId);

        try {
            await db.runTransaction(async (transaction) => {
                const roomDoc = await transaction.get(roomRef);
                if (!roomDoc.exists) {
                    return; // La salle a déjà été supprimée, rien à faire.
                }

                const roomData = roomDoc.data();
                const currentPlayers = roomData.players || {};
                const isHost = roomData.hostId === currentUser.uid;

                // Si l'hôte quitte, ou si le joueur qui part est le dernier, on supprime la salle.
                if (isHost || Object.keys(currentPlayers).length <= 1) {
                    console.log(`[Co-op Leave] Suppression de la salle ${currentCoopRoomId} car l'hôte ou le dernier joueur est parti.`);
                    transaction.delete(roomRef);
                } else {
                    // Sinon, on retire simplement le joueur de la liste.
                    console.log(`[Co-op Leave] Retrait du joueur ${currentUser.uid} de la salle ${currentCoopRoomId}.`);
                    transaction.update(roomRef, {
                        [`players.${currentUser.uid}`]: firebase.firestore.FieldValue.delete()
                    });
                }
            });
            // Il n'y a plus de bloc "finally" ici.
        } catch (error) {
            console.error("Erreur en quittant/supprimant la salle:", error);
            // En cas d'erreur, on peut vouloir nettoyer localement
            cleanupCoopListeners();
        }
    }

    async function setCoopReadyStatus(isReady) {
        if (!currentCoopRoomId || !currentUser) return;
        const roomRef = db.collection('coopRooms').doc(currentCoopRoomId);
        const player = (await roomRef.get()).data().players[currentUser.uid];
        if (!player.character) {
            resultElement.innerHTML = `<p class="text-red-400">Veuillez d'abord sélectionner un personnage.</p>`;
            return;
        }
        await roomRef.update({ [`players.${currentUser.uid}.isReady`]: isReady });
        coopReadyButton.textContent = isReady ? "Pas Prêt" : "Prêt";
        coopReadyButton.onclick = () => setCoopReadyStatus(!isReady);
    }

    // --- FIN: Fonctions pour le mode Co-op ---

    // --- NOUVEAU: Fonctions de nettoyage pour le Co-op ---
    async function cleanupStaleCoopRooms() {
        console.log("[Co-op Cleanup] Vérification des salles obsolètes...");
        // Les salles en attente depuis plus d'une heure seront considérées comme obsolètes
        const oneHourAgoMillis = Date.now() - 3600 * 1000;

        // MODIFICATION: Nous utilisons une requête plus simple pour éviter la nécessité d'un index composite,
        // ce qui peut être une source d'erreurs silencieuses pour les listeners.
        // Le filtrage par date se fait maintenant côté client.
        const waitingRoomsQuery = db.collection('coopRooms').where('status', '==', 'waiting');

        try {
            const snapshot = await waitingRoomsQuery.get();
            if (snapshot.empty) {
                // Il n'y a aucune salle en attente, donc aucune n'est obsolète.
                return;
            }

            let deletedCount = 0;
            const batch = db.batch();
            snapshot.docs.forEach(doc => {
                const room = doc.data();
                // Filtrage par date côté client
                if (room.createdAt && room.createdAt.toMillis() < oneHourAgoMillis) {
                    batch.delete(doc.ref);
                    deletedCount++;
                }
            });
            if (deletedCount > 0) {
                await batch.commit();
                console.log(`[Co-op Cleanup] ${deletedCount} salle(s) obsolète(s) supprimée(s) avec succès.`);
            }
        } catch (error) {
            console.error("Erreur lors du nettoyage des salles co-op obsolètes:", error);
            if (error.code === 'failed-precondition') {
                console.warn("Un index Firestore est requis pour le nettoyage des salles co-op. Veuillez vérifier la console du navigateur pour un lien permettant de le créer.");
            }
        }
    }

    // --- NOUVEAU: Fonctions pour le COMBAT Co-op ---
    async function startCoopBattle() {
        if (!currentCoopRoomId || !currentUser) return;

        const roomRef = db.collection('coopRooms').doc(currentCoopRoomId);
        try {
            const roomDoc = await roomRef.get();
            if (!roomDoc.exists) throw new Error("La salle n'existe plus.");

            const roomData = roomDoc.data();
            if (roomData.hostId !== currentUser.uid) {
                console.warn("Seul l'hôte peut démarrer le combat.");
                return;
            }

            const allReady = Object.values(roomData.players).every(p => p.isReady);
            if (!allReady) {
                resultElement.innerHTML = `<p class="text-red-400">Tous les joueurs ne sont pas prêts.</p>`;
                return;
            }

            const dungeon = allGameLevels.find(l => l.id === roomData.dungeonId);
            const difficultyData = dungeon.difficulties.find(d => d.level === roomData.difficulty);
            if (!dungeon || !difficultyData) throw new Error("Données du donjon ou de la difficulté introuvables.");

            const playerCount = Object.keys(roomData.players).length;
            const battleState = {
                bossMaxHealth: difficultyData.enemy.power,
                playerCountAtStart: playerCount,
                bossCurrentHealth: difficultyData.enemy.power,
                battleLog: [`Le combat contre ${difficultyData.enemy.name} commence !`],
                lastActionTimestamp: firebase.firestore.FieldValue.serverTimestamp(),
                // NOUVEAU: Initialisation des mécaniques
                mechanics: difficultyData.mechanics,
                mechanicState: null, // Aucune mécanique active au début
                lastMechanicCheckTimestamp: firebase.firestore.FieldValue.serverTimestamp()
            };

            await roomRef.update({
                status: 'in-progress',
                battleState: battleState
            });
            // Le listener onSnapshot déclenchera launchCoopBattle pour tous les joueurs.
        } catch (error) {
            console.error("Erreur lors du démarrage du combat co-op:", error);
            resultElement.innerHTML = `<p class="text-red-500">Erreur: ${error.message}</p>`;
        }
    }

    function launchCoopBattle(roomData) {
        if (!roomData || !roomData.battleState) return;
        const dungeon = allGameLevels.find(l => l.id === roomData.dungeonId);
        const difficultyData = dungeon.difficulties.find(d => d.level === roomData.difficulty);
        if (!dungeon || !difficultyData) return;

        console.log("Lancement de l'interface de combat co-op pour tous les joueurs.");
        coopLobbyView.classList.add('hidden');
        coopRoomView.classList.add('hidden');

        coopBattleBossName.textContent = difficultyData.enemy.name;
        updateCoopBattleUI(roomData);

        openModal(coopBattleModal);
    }

    function updateCoopBattleUI(roomData) {
        if (!roomData || !roomData.battleState) return;

        const { bossCurrentHealth, bossMaxHealth, battleLog, mechanicState } = roomData.battleState;
        const healthPercentage = (bossCurrentHealth / bossMaxHealth) * 100;

        coopBattleBossHealthBar.style.width = `${healthPercentage}%`;
        coopBattleBossHealthText.textContent = `${bossCurrentHealth.toLocaleString()} / ${bossMaxHealth.toLocaleString()}`;

        coopBattlePlayersDisplay.innerHTML = Object.entries(roomData.players).map(([uid, player]) => {
            // NOUVEAU: Mettre en évidence le joueur ciblé
            const isTargeted = mechanicState?.type === 'targeted_attack' && mechanicState.targetUid === uid;
            return `
                <div class="coop-room-player-card ${isTargeted ? 'targeted-player' : ''}">
                    <p class="player-name font-bold text-white">${player.name}</p>
                    ${player.character ? `
                        <img src="${player.character.image}" alt="${player.character.name}" class="h-20 mx-auto my-1">
                        <p class="text-xs ${player.character.color}">${player.character.name}</p>
                    ` : ''}
                </div>
            `;
        }).join('');

        coopBattleLog.innerHTML = (battleLog || []).map(log => `<p>${log}</p>`).join('');
        coopBattleLog.scrollTop = coopBattleLog.scrollHeight;

        // NOUVEAU: Gérer l'affichage de l'alerte de mécanique
        const mechanicAlert = document.getElementById('coop-battle-mechanic-alert');
        if (mechanicState) {
            mechanicAlert.classList.remove('hidden', 'mechanic-alert-targeted', 'mechanic-alert-vulnerable');
            mechanicAlert.classList.add('mechanic-alert');
            let alertText = '';
            if (mechanicState.type === 'targeted_attack') {
                const targetName = roomData.players[mechanicState.targetUid]?.name || 'un joueur';
                alertText = `Le boss cible ${targetName} ! Brisez sa posture ! (${mechanicState.damageDealt.toLocaleString()} / ${mechanicState.threshold.toLocaleString()})`;
                mechanicAlert.classList.add('mechanic-alert-targeted');
            } else if (mechanicState.type === 'vulnerability_phase') {
                alertText = `Le boss est vulnérable à l'essence ${mechanicState.requiredEssence} !`;
                mechanicAlert.classList.add('mechanic-alert-vulnerable');
            } else if (mechanicState.type === 'summon_adds') {
                const addCount = mechanicState.adds.filter(a => a.health > 0).length;
                alertText = `Le boss a invoqué ${addCount} sbire(s) ! Éliminez-les !`;
                mechanicAlert.classList.add('mechanic-alert-targeted');
            }
            mechanicAlert.textContent = alertText;
        } else {
            mechanicAlert.classList.add('hidden');
        }
    }

    async function coopAttack() {
        if (!currentCoopRoomId || !currentUser) return;

        const roomRef = db.collection('coopRooms').doc(currentCoopRoomId);
        coopBattleAttackButton.disabled = true;

        try {
        await db.runTransaction(async (transaction) => {
            const roomDoc = await transaction.get(roomRef);
            if (!roomDoc.exists) throw new Error("Le combat n'existe plus.");

            let roomData = roomDoc.data();
            if (roomData.status !== 'in-progress') return;

            const player = roomData.players[currentUser.uid];
            if (!player || !player.character) throw new Error("Données du joueur introuvables.");

            const dungeon = allGameLevels.find(l => l.id === roomData.dungeonId);
            const difficultyData = dungeon.difficulties.find(d => d.level === roomData.difficulty);
            let battleState = roomData.battleState;
            let newLogEntries = [];
            let damageDealt = player.character.power;
            const now = Date.now();

            // --- GESTION DES MÉCANIQUES ACTIVES ---
            if (battleState.mechanicState) {
                const mechanic = battleState.mechanicState;
                const mechanicDef = difficultyData.mechanics.find(m => m.type === mechanic.type);

                // Mécanique: Attaque Ciblée
                if (mechanic.type === 'targeted_attack') {
                    mechanic.damageDealt += damageDealt;
                    newLogEntries.push(`${player.name} attaque la posture du boss et inflige ${damageDealt.toLocaleString()} dégâts de posture !`);
                    if (mechanic.damageDealt >= mechanic.threshold) {
                        newLogEntries.push(`POSTURE BRISÉE ! L'attaque dévastatrice du boss est annulée !`);
                        battleState.mechanicState = null; // Fin de la mécanique
                    }
                }
                // Mécanique: Phase de Vulnérabilité
                else if (mechanic.type === 'vulnerability_phase') {
                    if (player.character.essence === mechanic.requiredEssence) {
                        damageDealt *= mechanicDef.damageMultiplier; // Dégâts massifs
                        newLogEntries.push(`${player.name} exploite la vulnérabilité du boss pour ${damageDealt.toLocaleString()} dégâts !`);
                        battleState.bossCurrentHealth = Math.max(0, battleState.bossCurrentHealth - damageDealt);
                    } else {
                        newLogEntries.push(`${player.name} attaque, mais le boss est insensible à cette essence ! (0 dégâts)`);
                    }
                }
                // Mécanique: Invocation de Sbires
                else if (mechanic.type === 'summon_adds') {
                    const activeAddIndex = mechanic.adds.findIndex(add => add.health > 0);
                    if (activeAddIndex !== -1) {
                        mechanic.adds[activeAddIndex].health -= damageDealt;
                        newLogEntries.push(`${player.name} attaque un sbire et inflige ${damageDealt.toLocaleString()} dégâts.`);
                        if (mechanic.adds[activeAddIndex].health <= 0) {
                            newLogEntries.push(`Un sbire a été éliminé !`);
                            if (mechanic.adds.every(add => add.health <= 0)) {
                                newLogEntries.push(`Tous les sbires ont été éliminés !`);
                                battleState.mechanicState = null; // Fin de la mécanique
                            }
                        }
                    } else {
                         // Normalement, ne devrait pas arriver si la mécanique est bien gérée
                        newLogEntries.push(`Tous les sbires sont déjà éliminés. L'attaque touche le boss.`);
                        battleState.bossCurrentHealth = Math.max(0, battleState.bossCurrentHealth - damageDealt);
                    }
                }
            } 
            // --- ATTAQUE NORMALE (AUCUNE MÉCANIQUE ACTIVE) ---
            else {
                battleState.bossCurrentHealth = Math.max(0, battleState.bossCurrentHealth - damageDealt);
                newLogEntries.push(`${player.name} attaque et inflige ${damageDealt.toLocaleString()} dégâts !`);
            }

            // --- VÉRIFICATION DE VICTOIRE ---
            let newStatus = roomData.status;
            if (battleState.bossCurrentHealth <= 0) {
                newStatus = 'completed';
                newLogEntries.push("Le boss a été vaincu !");
                battleState.mechanicState = null; // Nettoyer l'état de la mécanique en cas de victoire
            }

            // --- DÉCLENCHEMENT D'UNE NOUVELLE MÉCANIQUE (si aucune n'est active et boss vivant) ---
            const lastCheckTime = battleState.lastMechanicCheckTimestamp?.toMillis() || 0;
            const timeSinceLastCheck = (now - lastCheckTime) / 1000;

            if (!battleState.mechanicState && newStatus === 'in-progress' && difficultyData.mechanics.length > 0) {
                const possibleMechanics = difficultyData.mechanics.filter(m => timeSinceLastCheck >= m.triggerInterval);
                if (possibleMechanics.length > 0) {
                    const chosenMechanic = possibleMechanics[Math.floor(Math.random() * possibleMechanics.length)];
                    battleState.lastMechanicCheckTimestamp = firebase.firestore.Timestamp.fromMillis(now);

                    if (chosenMechanic.type === 'targeted_attack') {
                        const playerUids = Object.keys(roomData.players);
                        const targetUid = playerUids[Math.floor(Math.random() * playerUids.length)];
                        battleState.mechanicState = { type: 'targeted_attack', targetUid: targetUid, threshold: chosenMechanic.breakThreshold, damageDealt: 0, endTime: firebase.firestore.Timestamp.fromMillis(now + chosenMechanic.duration * 1000) };
                        const targetName = roomData.players[targetUid]?.name || 'un joueur';
                        newLogEntries.push(`ALERTE: Le boss cible ${targetName} pour une attaque dévastatrice ! Brisez sa posture !`);
                    } 
                    else if (chosenMechanic.type === 'vulnerability_phase') {
                        const essences = ["Red", "Blue", "Yellow", "Green", "Purple", "Pink"];
                        const requiredEssence = essences[Math.floor(Math.random() * essences.length)];
                        battleState.mechanicState = { type: 'vulnerability_phase', requiredEssence: requiredEssence, endTime: firebase.firestore.Timestamp.fromMillis(now + chosenMechanic.duration * 1000) };
                        newLogEntries.push(`ALERTE: Le boss change d'aura et devient vulnérable à l'essence ${requiredEssence} !`);
                    }
                    else if (chosenMechanic.type === 'summon_adds') {
                        battleState.mechanicState = { type: 'summon_adds', adds: Array(chosenMechanic.count).fill(null).map(() => ({ health: chosenMechanic.addPower })) };
                        newLogEntries.push(`ALERTE: Le boss invoque ${chosenMechanic.count} sbires !`);
                    }
                }
            }
            
            // --- MISE À JOUR FINALE ---
            const finalBattleLog = [...(battleState.battleLog || []), ...newLogEntries];
            while (finalBattleLog.length > 20) finalBattleLog.shift();

            transaction.update(roomRef, {
                'battleState.bossCurrentHealth': battleState.bossCurrentHealth,
                'battleState.battleLog': finalBattleLog,
                'battleState.mechanicState': battleState.mechanicState,
                'battleState.lastMechanicCheckTimestamp': battleState.lastMechanicCheckTimestamp,
                'status': newStatus
            });
        });
        } catch (error) {
            console.error("Erreur lors de l'attaque en co-op:", error);
        } finally {
            setTimeout(() => { coopBattleAttackButton.disabled = false; }, 1000);
        }
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
    
    function calculateMaxTeamSizeForMode() {
        if (currentTeamSelectionMode === 'preset' || currentTeamSelectionMode === 'defense') {
            return 3;
        }
        // Fallback to battle selection logic
        return calculateMaxTeamSize();
    }

    function openStatChangeConfirmModal(message, callback) {
        statChangeConfirmMessageElement.textContent = message;
        statChangeConfirmationCallback = callback;
        openModal(statChangeConfirmContinueModal); // Affiche la modale
    }

    function closeStatChangeConfirmModal() {
        closeModalHelper(statChangeConfirmContinueModal);
        statChangeConfirmationCallback = null;
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
            const fragment = document.createDocumentFragment();
            availableCharacters.sort((a, b) => b.power - a.power).forEach(c => {
                // MODIFICATION: Utiliser la nouvelle fonction createCharacterCard
                const cardElement = createCharacterCard(c, -1, 'traitSelection');
                fragment.appendChild(cardElement);
            });
            traitCharacterSelectionGridElement.appendChild(fragment);
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
        const fragment = document.createDocumentFragment();
        availableCharacters.sort((a, b) => b.power - a.power).forEach(char => {
            // MODIFICATION: Utiliser la nouvelle fonction createCharacterCard
            const cardElement = createCharacterCard(char, -1, 'curseSelection');
            fragment.appendChild(cardElement);
        });
        curseCharacterSelectionGridElement.appendChild(fragment);
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
        openModal(curseConfirmContinueModal); // Empêcher le défilement de l'arrière-plan
    }

    function closeCurseConfirmModal() {
        closeModalHelper(curseConfirmContinueModal);
        curseConfirmationCallback = null; // Réinitialiser le callback
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
        openModal(miniGameModal);
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
        closeModalHelper(miniGameModal);
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

        openModal(traitProbabilitiesModal);
    }

    function closeTraitProbabilitiesModal() {
        closeModalHelper(traitProbabilitiesModal);
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
      sellSelectedButton.addEventListener('click', deleteSelectedCharacters);
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
    cancelEvolutionButton.addEventListener("click", cancelEvolution); confirmEvolutionButton.addEventListener("click", confirmEvolution);
    document.getElementById("apply-stat-change-button").addEventListener("click", applyStatChange);
    document.getElementById("stat-change-search").addEventListener("input", updateStatChangeTabDisplay);
    document.getElementById("curse-char-search").addEventListener("input", updateCurseTabDisplay);
    statRankInfoButton.addEventListener("click", openStatRankProbabilitiesModal);
    closeStatRankProbabilitiesModalButton.addEventListener("click", closeStatRankProbabilitiesModal);
    viewPvpLogsButton.addEventListener('click', async () => {
        // Étape 1 : On force le traitement des résultats en attente AVANT d'ouvrir la modale.
        // L'utilisation de "await" garantit que nous attendons que ce soit terminé.
        await processPendingPvpResults();

        pvpLogsListContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('view-replay-button')) {
                const log = pvpLogs.find(l => l.id === e.target.dataset.logId);
                if (log) showPvpReplay(log.battleReport);
            }
        });
        // Étape 2 : Maintenant que les logs sont à jour, on ouvre la modale.
        openPvpLogsModal();
    });
    closePvpLogsButton.addEventListener('click', () => closeModalHelper(pvpLogsModal));
    gameContainer.addEventListener('click', (event) => {
        // On utilise .closest() pour vérifier si le clic a eu lieu sur notre bouton
        // ou sur un de ses éléments enfants (comme du texte ou une icône).
        
        // Pour le bouton "Trouver un adversaire"
        if (event.target.closest('#find-opponent-button')) {
            currentBattleMode = 'standard';
            findOpponent();
        }
        
        // Vous pouvez ajouter d'autres boutons ici si vous rencontrez le même problème avec eux.
        // Par exemple :
        // if (event.target.closest('#un-autre-bouton-problematique')) {
        //     maFonctionPourCetAutreBouton();
        // }

        // NOUVEAU: Bouton pour le mode Brawl
        if (event.target.closest('#play-brawl-button')) {
            currentBattleMode = 'brawl';
            findOpponent();
        }
    });
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
      openModal(probabilitiesModal);
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
      closeModalHelper(probabilitiesModal);
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
        closeModalHelper(curseConfirmContinueModal);
    });

    curseConfirmNoButton.addEventListener("click", () => {
        if (curseConfirmationCallback) {
            curseConfirmationCallback(false); // L'utilisateur a annulé
        }
        closeModalHelper(curseConfirmContinueModal);
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
        closeModalHelper(statChangeConfirmContinueModal);
    });

    statChangeConfirmNoButton.addEventListener("click", () => {
        if (statChangeConfirmationCallback) {
            statChangeConfirmationCallback(false);
        }
        closeModalHelper(statChangeConfirmContinueModal);
    });

    traitKeepBetterToggle.addEventListener("change", () => {
        traitKeepBetterToggleState = traitKeepBetterToggle.checked; // Mettre à jour la variable globale si vous en avez une (optionnel ici)
        updateTraitTabDisplay(); // Mettre à jour pour activer/désactiver les checkboxes et le bouton
    });

    traitActionConfirmYesButton.addEventListener("click", () => {
        if (traitConfirmationCallback) {
            traitConfirmationCallback(true);
        }
        closeModalHelper(traitActionConfirmModal);
    });

    traitActionConfirmNoButton.addEventListener("click", () => {
        if (traitConfirmationCallback) {
            traitConfirmationCallback(false);
        }
        closeModalHelper(traitActionConfirmModal);
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
    // NOUVEAU: Écouteurs pour la gestion d'équipe
    // CORRECTION: Ajout de vérifications pour éviter les erreurs si un bouton est manquant dans le HTML
    if (createNewTeamButton) createNewTeamButton.addEventListener("click", () => openTeamEditor(null));
    if (manageTeamsButton) manageTeamsButton.addEventListener("click", () => {
        openModal(teamsModal);
        updateTeamsModalDisplay();
    });
    if (closeTeamsModalButton) closeTeamsModalButton.addEventListener("click", () => {
        closeModalHelper(teamsModal);
    });
    if (cancelTeamEditorButton) cancelTeamEditorButton.addEventListener("click", () => closeModalHelper(teamEditorModal));
    if (saveTeamButton) saveTeamButton.addEventListener("click", saveTeam);

    if (savedTeamsList) savedTeamsList.addEventListener('click', (e) => {
        const button = e.target.closest('button');
        const card = e.target.closest('.saved-team-card');

        // Si un bouton est cliqué, on gère son action spécifique
        if (button) {
            const teamId = button.dataset.teamId;
            if (!teamId) return;

            if (button.classList.contains('load-team-btn')) {
                loadTeamForBattle(teamId);
            } else if (button.classList.contains('set-defense-btn')) {
                setDefenseTeam(teamId);
            } else if (button.classList.contains('set-default-btn')) {
                setDefaultBattleTeam(teamId);
            }
            return;
        }

        // Si la carte est cliquée (mais pas un bouton), on ouvre l'éditeur
        if (card) {
            const teamId = card.dataset.teamId;
            if (teamId) { openTeamEditor(teamId); }
        }
    });

    document.getElementById("team-editor-sort-criteria").addEventListener("change", (e) => {
        teamEditorSortCriteria = e.target.value;
        updateTeamEditorDisplay();
    });
    document.getElementById("team-editor-search-name").addEventListener("input", (e) => {
        teamEditorSearchName = e.target.value.toLowerCase();
        updateTeamEditorDisplay();
    });
    document.getElementById("team-editor-filter-rarity").addEventListener("change", (e) => {
        teamEditorFilterRarity = e.target.value;
        updateTeamEditorDisplay();
    });
    // CORRECTION : Ajout de l'écouteur pour le champ de nom de l'équipe
    const teamEditorNameInput = document.getElementById('team-editor-name-input');
    if (teamEditorNameInput) {
        teamEditorNameInput.addEventListener('input', updateTeamEditorDisplay);
    }

    // NOUVEAU: Écouteurs pour la sélection de raid
    openRaidSelectionButton.addEventListener('click', openRaidSelectionModal);
    cancelRaidSelectionButton.addEventListener('click', () => closeModalHelper(raidSelectionModal));
    raidBossSelectionList.addEventListener('click', (e) => {
        if (e.target.classList.contains('start-raid-button')) {
            startRaid(e.target.dataset.bossId);
        }
    });

    // NOUVEAU: Écouteurs d'événements pour la guilde
    openCreateGuildModalButton.addEventListener('click', openCreateGuildModal);
    cancelCreateGuildButton.addEventListener('click', () => closeModalHelper(createGuildModal));
    confirmCreateGuildButton.addEventListener('click', createGuild);
    guildSearchButton.addEventListener('click', searchGuilds);
    guildSearchResults.addEventListener('click', (e) => {
        if (e.target.classList.contains('join-guild-button')) {
            joinGuild(e.target.dataset.guildId, e.target.dataset.guildName);
        }
    });

    document.querySelectorAll('.guild-subtab-button').forEach(btn => {
        btn.addEventListener('click', () => showGuildSubTab(btn.dataset.subtab));
    });

    guildConfirmYesButton.addEventListener("click", () => {
        if (guildActionConfirmationCallback) {
            guildActionConfirmationCallback(true);
        }
        closeGuildActionConfirmModal();
    });

    guildConfirmNoButton.addEventListener("click", () => {
        if (guildActionConfirmationCallback) {
            guildActionConfirmationCallback(false);
        }
        closeGuildActionConfirmModal();
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
    document.getElementById("daily-dungeon-list").addEventListener('click', handleLevelStartClick);

    // NOUVEAU: Fermeture de la modale d'avertissement
    if (coopTab) {
        coopTab.addEventListener('click', (e) => {
            const createButton = e.target.closest('.create-coop-room-button');
            const joinButton = e.target.closest('.join-coop-room-button');
            if (createButton) {
                const dungeonId = parseInt(createButton.dataset.dungeonId, 10);
                // MODIFICATION: Récupérer la difficulté sélectionnée
                const difficultySelect = createButton.parentElement.querySelector('.coop-difficulty-select');
                if (!difficultySelect) {
                    console.error("Impossible de trouver le sélecteur de difficulté pour ce bouton.");
                    return;
                }
                const difficulty = difficultySelect.value;
                createCoopRoom(dungeonId, difficulty);
            }
            if (joinButton) {
                const roomId = joinButton.dataset.roomId;
                joinCoopRoom(roomId);
            }
        });
    }
     const autoClickerModalCloseButton = document.getElementById('auto-clicker-modal-close-button');
    if (autoClickerModalCloseButton) {
        autoClickerModalCloseButton.addEventListener('click', () => {
            closeModalHelper(autoClickerWarningModal);
        });
    }

    if(coopReadyButton) coopReadyButton.addEventListener('click', () => setCoopReadyStatus(true));
    if(coopLeaveRoomButton) coopLeaveRoomButton.addEventListener('click', leaveCoopRoom);
    if(coopStartBattleButton) coopStartBattleButton.addEventListener('click', startCoopBattle);
    if(coopBattleAttackButton) coopBattleAttackButton.addEventListener('click', coopAttack);

    document.getElementById('start-tower-floor-button').addEventListener('click', startTowerFloor);
    populateTargetStatRanks();
    populateTargetTraits();
    closePvpReplayButton.addEventListener('click', () => closeModalHelper(document.getElementById('pvp-replay-modal')));

    // NOUVEAU: Écouteur pour le champ de bataille GvG (délégation d'événements)
    const gvgPreparationView = document.getElementById('gvg-preparation-view');
    if (gvgPreparationView) {
        gvgPreparationView.addEventListener('click', handleGvgBattlefieldClick);
    }
    // NOUVEAU: Écouteur pour le champ de bataille de combat GvG
    const gvgCombatView = document.getElementById('gvg-combat-view');
    if (gvgCombatView) {
        gvgCombatView.addEventListener('click', handleGvgCombatClick);
    }

    // NOUVEAU: Écouteur pour le matchmaking GvG
    const gvgMatchmakingButton = document.getElementById('gvg-matchmaking-button');
    if (gvgMatchmakingButton) {
        gvgMatchmakingButton.addEventListener('click', startGvgMatchmaking);
    }

    // NOUVEAU: Écouteur pour le bouton de rapport de bug
    const bugReportButton = document.getElementById('bug-report-button');
    if (bugReportButton) {
        bugReportButton.addEventListener('click', () => {
            // TODO: REMPLACEZ CE LIEN PAR LE LIEN DE VOTRE FORMULAIRE DE RAPPORT DE BUG
            const bugReportUrl = 'https://noteforms.com/forms/formulaire-0qx5gb';
            window.open(bugReportUrl, '_blank');
        });
    }

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
                // NOUVEAU: Attacher le listener de la boîte aux lettres
                checkMailbox();
                loadProgress(user.uid);
            }

        } else {
            // L'utilisateur est déconnecté
            currentUser = null;
            console.log("Aucun utilisateur connecté.");

            // NOUVEAU: Nettoyer le listener de la boîte aux lettres
            if (mailListener) {
                mailListener();
                mailListener = null;
            }

            // NOUVEAU: Nettoyer les données de guilde à la déconnexion
            cleanupGuildListeners();
            // MODIFIÉ: Nettoyage complet des listeners co-op à la déconnexion
            if (publicRoomsListener) {
                console.log("[Listener] Détachement du listener des salles publiques (déconnexion).");
                publicRoomsListener();
                publicRoomsListener = null;
            }
            cleanupCoopListeners(); // Nettoie la salle/bataille active s'il y en a une
            playerGuildId = null;

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