# Gacha Anime Ultime

✨ **Gacha Anime Ultime** ✨ est une simulation de jeu de gacha sous forme de page web unique, jouable directement dans votre navigateur. Collectionnez des personnages inspirés de l'univers de l'anime, faites-les monter en niveau, évoluer, gérez leurs statistiques et leurs traits, combattez dans différents modes de jeu et agrandissez votre collection !

Ce projet sert d'exemple complet pour la construction d'une application interactive complexe utilisant uniquement HTML, CSS (avec Tailwind CSS) et JavaScript, en s'appuyant sur le `localStorage` du navigateur pour la persistance des données.

Pour acceder au jeu : [Gacha-Anime-Ultime](https://DZTic.github.io/gacha-anime-ultime/V75.html)

## Table des Matières

*   [Fonctionnalités](#fonctionnalités)
*   [Comment Jouer](#comment-jouer)
*   [Technologies Utilisées](#technologies-utilisées)
*   [Installation](#installation)
*   [Sauvegarde et Persistance](#sauvegarde-et-persistance)
*   [Version Actuelle](#version-actuelle)
*   [Plans Futurs](#plans-futurs)
*   [Contribuer](#contribuer)

## Fonctionnalités

Ce jeu inclut une variété de mécaniques courantes dans les jeux de gacha/RPG modernes :

*   **Système de Gacha :**
    *   Bannières Standard et Spéciale.
    *   Tirages uniques (x1) et multiples (x10) utilisant des Gemmes ou des Tickets de Tirage.
    *   Système de Pity pour garantir des personnages de haute rareté (Mythic sur Standard, Secret/Vanguard sur Bannière Spéciale).
    *   Affichage des probabilités pour chaque bannière.
*   **Collection et Gestion des Personnages :**
    *   Collectionnez des personnages de diverses raretés (Rare, Épique, Légendaire, Mythic, Secret, Vanguard).
    *   Statistiques détaillées des personnages (Niveau, Puissance, Rareté, Rang Stat, Malédiction, Trait).
    *   Vue de l'Inventaire avec options de filtrage et de tri.
    *   Verrouiller/Déverrouiller les personnages pour éviter une utilisation accidentelle.
    *   Fonctionnalité de Vente Automatique pour les tirages indésirables selon la rareté.
    *   Multifusion (Autofuse) pour faire monter le niveau d'un personnage sélectionné en utilisant d'autres unités comme matériaux.
*   **Progression des Personnages :**
    *   Gagnez de l'EXP pour les personnages via les combats et la consommation d'objets/unités.
    *   Faites monter le niveau des personnages pour augmenter leur puissance.
    *   **Fusion :** Consommez d'autres personnages pour gagner de l'EXP et augmenter la puissance de base.
    *   **Évolution :** Faites évoluer certains personnages vers un palier ou une forme supérieure en utilisant des matériaux spécifiques et des pièces.
    *   **Donner des Objets :** Consommez des objets pour donner de l'EXP ou augmenter directement la puissance des personnages.
    *   **Changement de Stat :** Utilisez des Stat Chips pour relancer le Rang Stat (C à SSS) d'un personnage, affectant son multiplicateur de puissance.
    *   **Malédiction (Curse) :** Utilisez des Cursed Tokens pour appliquer un effet de malédiction aléatoire (% négatif ou positif à la puissance). Peut relancer les malédictions.
    *   **Traits :** Utilisez des Reroll Tokens pour obtenir un Trait aléatoire (ex: Force, Fortune, Berserk, Looter, Golder, Monarch) ou relancer un trait existant. Les Traits fournissent divers bonus (puissance dans des modes spécifiques, gain de ressources).
    *   **Briser les Limites (Limit Break) :** Utilisez des Divin Wishes pour augmenter le niveau maximum d'un personnage au-delà de 60, jusqu'à 100.
*   **Modes de Jeu :**
    *   **Histoire :** Progressez à travers des niveaux séquentiels dans différents mondes, en combattant des ennemis. Déverrouillez les niveaux et mondes suivants après les avoir terminés.
    *   **Légende :** Défiez des versions légendaires difficiles des niveaux d'histoire pour des récompenses accrues.
    *   **Challenge :** Affrontez des scénarios de combat uniques avec des récompenses spécifiques.
    *   **Matériaux :** Affrontez des niveaux conçus spécifiquement pour laisser tomber des matériaux d'évolution.
    *   **Abîme Infini :** (Pas encore entièrement implémenté dans le code fourni, mais la structure suggère un mode de survie).
*   **Gestion d'Équipe :**
    *   Sélectionnez une équipe pour le combat, avec une taille d'équipe dynamique basée sur les compétences passives des personnages (comme Vanguard).
    *   Sauvegardez et chargez des préréglages d'équipe (presets).
*   **Économie et Ressources :**
    *   Gérez les Gemmes (devise premium) et les Pièces (devise douce).
    *   Gagnez des ressources grâce aux combats, aux missions, à la vente d'unités et à la boutique.
*   **Boutique :**
    *   Offres chronométrées d'objets et de ressources qui se renouvellent périodiquement.
*   **Missions :**
    *   Missions quotidiennes/périodiques chronométrées avec divers objectifs et récompenses en Gemmes.
*   **Index :**
    *   Visualisez tous les personnages découvrables, indiquant ceux que vous possédez.
*   **Paramètres :**
    *   Activer/Désactiver le son et les animations.
    *   Changer entre les thèmes Sombre et Clair.
    *   Configurer les paramètres de Vente Automatique et de Multifusion.
    *   Option pour réinitialiser toutes les données du jeu.
*   **Persistance :**
    *   Toute la progression du jeu (devises, personnages, inventaire, paramètres, progression) est automatiquement sauvegardée en utilisant le `localStorage` de votre navigateur.

## Comment Jouer

1.  **Obtenez le code :** Clonez ou téléchargez ce dépôt sur votre machine locale.
2.  **Ouvrez le jeu :** Naviguez jusqu'au dossier téléchargé et ouvrez le fichier `V75.html` dans votre navigateur web préféré (comme Chrome, Firefox, Edge, etc.).
3.  **Commencez à Jouer :** Le jeu se chargera directement dans votre navigateur.
    *   Utilisez les Gemmes (ou Tickets de Tirage) dans les onglets "Tirer" pour obtenir des personnages.
    *   Allez dans "Inventaire" pour visualiser et gérer vos personnages et objets.
    *   Visitez "Shop" et "Missions" pour les récompenses quotidiennes et les tâches.
    *   Renforcez vos personnages par la Fusion, l'Évolution, Donner des Objets, Changement de Stat, Malédiction, Traits et Briser les Limites.
    *   Défiez les niveaux dans l'onglet "Jouer" pour gagner des ressources et progresser dans l'histoire.
    *   Explorez les autres onglets comme "Index" et "Paramètres".

## Technologies Utilisées

*   **HTML5 :** Structure de l'interface du jeu.
*   **CSS3 :** Stylisation, incluant les animations et les thèmes.
*   **Tailwind CSS :** Un framework CSS utility-first utilisé via CDN pour une stylisation rapide.
*   **JavaScript :** Logique de jeu principale, manipulation de l'interface utilisateur, gestion des événements, gestion des données et stockage persistant (`localStorage`).
*   **Canvas Confetti :** Utilisé via CDN pour des animations de célébration lors de tirages réussis ou de victoires.
*   **Hébergement d'Images Externe :** Les images des personnages et de certains objets sont liées depuis des sources externes (comme Fandom/Wikia).

## Installation

Aucune installation traditionnelle n'est requise.

1.  Clonez le dépôt :
    ```bash
    git clone https://github.com/VOTRE_NOM_UTILISATEUR/gacha-anime-ultime.git
    ```
    (Remplacez `VOTRE_NOM_UTILISATEUR/gacha-anime-ultime.git` par l'URL réelle du dépôt si vous clonez depuis un fork).
2.  Naviguez vers le répertoire du projet :
    ```bash
    cd gacha-anime-ultime
    ```
3.  Ouvrez le fichier HTML dans votre navigateur :
    ```bash
    # Sous Windows
    explorer V75.html

    # Sous macOS
    open V75.html

    # Sous Linux
    xdg-open V75.html
    ```
    Alternativement, ouvrez simplement le fichier `V75.html` depuis votre explorateur de fichiers.

## Sauvegarde et Persistance

Votre progression de jeu est automatiquement sauvegardée dans le `localStorage` de votre navigateur. Cela signifie :

*   Votre progression persistera entre les sessions *sur le même navigateur*.
*   Supprimer les données de site de votre navigateur pour la page effacera votre progression.
*   Jouer en mode Incognito/Privé empêchera la sauvegarde.
*   La progression *n'est pas* synchronisée entre différents navigateurs ou appareils.

Vous pouvez réinitialiser manuellement vos données de jeu via le menu "Paramètres".

## Version Actuelle

Ce code est basé sur la version `V75` du projet.

## Plans Futurs

Basé sur le code existant et la nature de tels jeux, les développements futurs potentiels pourraient inclure :

*   Plus de personnages, d'objets et de chemins d'évolution.
*   Expansion des modes de jeu (ex: Guildes, Raids, simulations PvP).
*   Mécaniques et capacités de personnages plus complexes.
*   Amélioration de l'UI/UX et des animations.
*   Refactorisation du code pour une meilleure modularité et maintenabilité.

## Contribuer

Les contributions sont les bienvenues ! Si vous trouvez des bugs, avez des suggestions d'amélioration ou souhaitez ajouter des fonctionnalités :

1.  Forkez le dépôt.
2.  Créez une nouvelle branche (`git checkout -b feature/votre-fonctionnalite`).
3.  Faites vos modifications.
4.  Commitez vos modifications (`git commit -m 'feat: ajouter une fonctionnalite geniale'`).
5.  Poussez vers la branche (`git push origin feature/votre-fonctionnalite`).
6.  Ouvrez une Pull Request.

Veuillez suivre un style de code standard et contribuer de manière constructive.


Amusez-vous bien avec le Gacha ! 🎉
