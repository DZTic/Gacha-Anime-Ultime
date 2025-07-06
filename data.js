const standardCharacters = [
        { name: "Goku", rarity: "Rare", color: "text-gray-400", image: "./images/perso/goku.webp", power: 350, level: 1 },
        { name: "Naruto", rarity: "Rare", color: "text-gray-400", image: "./images/perso/naruto.png", power: 370, level: 1 },
        { name: "Luffy", rarity: "Rare", color: "text-gray-400", image: "./images/perso/luffy.webp", power: 370, level: 1 },
        { name: "Ichigo", rarity: "Rare", color: "text-gray-400", image: "./images/perso/ichigo.webp", power: 360, level: 1 },
        { name: "Sanji", rarity: "Rare", color: "text-gray-400", image: "./images/perso/sanji.webp", power: 355, level: 1 },
        { name: "Crocodile", rarity: "Épique", color: "text-purple-400", image: "./images/perso/crocodile.webp", power: 550, level: 1 },
        { name: "Killua", rarity: "Épique", color: "text-purple-400", image: "./images/perso/killua.webp", power: 550, level: 1 },
        { name: "Picolo", rarity: "Épique", color: "text-purple-400", image: "./images/perso/picolo.webp", power: 560, level: 1 },
        { name: "Zenitsu", rarity: "Épique", color: "text-purple-400", image: "./images/perso/zenitsu.webp", power: 570, level: 1 },
        { name: "Goku Black", rarity: "Légendaire", color: "text-yellow-400", image: "./images/perso/goku black.webp", power: 800, level: 1 },
        { name: "Gon", rarity: "Légendaire", color: "text-yellow-400", image: "./images/perso/gon.webp", power: 820, level: 1 },
        { name: "Kizaru", rarity: "Légendaire", color: "text-yellow-400", image: "./images/perso/kizaru.webp", power: 820, level: 1 },
        { name: "Itachi", rarity: "Légendaire", color: "text-yellow-400", image: "./images/perso/itachi.webp", power: 820, level: 1 },
        { name: "Pain", rarity: "Légendaire", color: "text-yellow-400", image: "./images/perso/pain.webp", power: 850, level: 1 },
        { name: "Toge", rarity: "Légendaire", color: "text-yellow-400", image: "./images/perso/toge.webp", power: 860, level: 1 },
        {
          name: "Sung Jin Wu",
          rarity: "Mythic",
          color: "rainbow-text",
          image: "./images/perso/sung jin wu.webp",
          power: 1250,
          level: 1,
          evolutionRequirements: [ { item: "Shadow Tracer", quantity: 3 }, { coins: 50000 }, { item: "Green Essence", quantity: 20 }, { item: "Yellow Essence", quantity: 20 }, { item: "Pink Essence", quantity: 20 }, { item: "Rainbow Essence", quantity: 10 } ],
          evolutionData: {
              newName: "Sung Jin Wu (Monarch)",
              newImage: "./images/evolve/sung jin wu monarch.webp",
              basePowerIncrease: 500
          }
        },
        {
            name: "Satoru Gojo",
            rarity: "Mythic",
            color: "rainbow-text",
            image: "./images/perso/gojo.webp",
            power: 1100,
            level: 1,
            evolutionRequirements: [ { item: "Six Eyes", quantity: 5 }, { item: "Green Essence", quantity: 40 }, { item: "Blue Essence", quantity: 30 }, { item: "Red Essence", quantity: 30 }, { item: "Rainbow Essence", quantity: 10 }, { coins: 100000 } ],
            evolutionData: {
                newName: "Satoru Gojo (Infinity)",
                newImage: "./images/evolve/satoru gojo (infinity).webp",
                basePowerIncrease: 800, 
                newRarity: "Secret",   
                newColor: "text-secret" 
            }
        },
        {
          name: "Archer",
          rarity: "Mythic",
          color: "rainbow-text",
          image: "./images/perso/archer.png",
          power: 1200,
          level: 1,
          evolutionRequirements: [ { item: "Cast Blades", quantity: 5 }, { coins: 50000 }, { item: "Green Essence", quantity: 20 }, { item: "Yellow Essence", quantity: 20 }, { item: "Blue Essence", quantity: 20 }, { item: "Purple Essence", quantity: 20 }, { item: "Red Essence", quantity: 20 }, { item: "Rainbow Essence", quantity: 10 } ],
          evolutionData: {
              newName: "Archer (Counter Spirit)",
              newImage: "./images/evolve/archer (counter spirit).webp",
              basePowerIncrease: 500
          }
        },
        {
          name: "Cha Hae-In",
          rarity: "Mythic",
          color: "rainbow-text",
          image: "./images/perso/cha.png    ",
          power: 1080,
          level: 1,
          evolutionRequirements: [ { item: "Broken Sword", quantity: 5 }, { item: "Green Essence", quantity: 20 }, { item: "Blue Essence", quantity: 20 }, { item: "Purple Essence", quantity: 20 }, { item: "Rainbow Essence", quantity: 10 }, { coins: 75000 } ],
          evolutionData: {
              newName: "Cha Hae-In (Sword Dance)",
              newImage: "./images/evolve/cha hae-in (sword dance).webp",
              basePowerIncrease: 500
          }
        },
        {
          name: "Kenpachi Zaraki",
          rarity: "Mythic",
          color: "rainbow-text",
          image: "./images/perso/kenpachi.webp",
          power: 1150,
          level: 1,
          evolutionRequirements: [ { item: "Chipped Blade", quantity: 5 }, { item: "Green Essence", quantity: 20 }, { item: "Yellow Essence", quantity: 20 }, { item: "Red Essence", quantity: 20 }, { item: "Purple Essence", quantity: 20 }, { item: "Rainbow Essence", quantity: 10 }, { coins: 75000 } ],
          evolutionData: {
              newName: "Kenpachi Zaraki (Shikai)",
              newImage: "./images/evolve/kenpachi zaraki (shikai).webp",
              basePowerIncrease: 500
          }
        },
        {
            name: "Choso",
            rarity: "Mythic",
            color: "rainbow-text",
            image: "./images/perso/choso.png",
            power: 1180,
            level: 1,
            evolutionRequirements: [ { item: "Hardened Blood", quantity: 5 }, { item: "Green Essence", quantity: 20 }, { item: "Blue Essence", quantity: 20 }, { item: "Red Essence", quantity: 20 }, { item: "Pink Essence", quantity: 20 }, { item: "Purple Essence", quantity: 20 }, { item: "Rainbow Essence", quantity: 10 }, { coins: 75000 } ],
            evolutionData: {
                newName: "Choso (Blood Curse)",
                newImage: "./images/evolve/choso (blood curse).webp",
                basePowerIncrease: 590
            }
        },
        {
          name: "Yuji Itadori", 
          rarity: "Mythic",
          color: "rainbow-text",
          image: "./images/perso/itadori.webp",
          power: 1220,
          level: 1,
          evolutionRequirements: [ { item: "Cursed Finger", quantity: 5 }, { item: "Green Essence", quantity: 20 }, { item: "Yellow Essence", quantity: 20 }, { item: "Pink Essence", quantity: 20 }, { item: "Red Essence", quantity: 20 }, { item: "Rainbow Essence", quantity: 10 }, { coins: 75000 } ],
          evolutionData: {
              newName: "Sukuna",
              newImage: "./images/evolve/sukuna.webp",
              basePowerIncrease: 600,
              newRarity: "Secret",
              newColor: "text-secret"
          }
        },
        {
            name: "Jogo",
            rarity: "Mythic",
            color: "rainbow-text",
            image: "./images/perso/jogo.webp",
            power: 1240,
            level: 1,
            evolutionRequirements: [ { item: "Magma Stone", quantity: 5 }, { item: "Green Essence", quantity: 20 }, { item: "Yellow Essence", quantity: 20 }, { item: "Purple Essence", quantity: 20 }, { item: "Rainbow Essence", quantity: 10 }, { coins: 50000 } ],
            evolutionData: {
                newName: "Jogo (Volcanic)",
                newImage: "./images/evolve/jogo (volcanic).webp",
                basePowerIncrease: 580
            }
        },
        {
            name: "Aoi Todo",
            rarity: "Mythic",
            color: "rainbow-text",
            image: "./images/perso/todo.webp",
            power: 1120,
            level: 1,
            evolutionRequirements: [ { item: "Broken Pendant", quantity: 5 }, { item: "Green Essence", quantity: 20 }, { item: "Blue Essence", quantity: 20 }, { item: "Yellow Essence", quantity: 20 }, { item: "Purple Essence", quantity: 20 }, { item: "Rainbow Essence", quantity: 10 }, { coins: 50000 } ],
            evolutionData: {
                newName: "Aoi Todo (Unleashed)",
                newImage: "./images/evolve/aoi todo (unleashed).webp",
                basePowerIncrease: 600
            }
        },
        {
            name: "Akaza",
            rarity: "Mythic",
            color: "rainbow-text",
            image: "./images/perso/akaza.png",
            power: 1280,
            level: 1,
            evolutionRequirements: [ { item: "Demon Beads", quantity: 5 }, { item: "Green Essence", quantity: 20 }, { item: "Blue Essence", quantity: 20 }, { item: "Yellow Essence", quantity: 20 }, { item: "Purple Essence", quantity: 20 }, { item: "Pink Essence", quantity: 10 }, { item: "Red Essence", quantity: 20 }, { item: "Rainbow Essence", quantity: 10 }, { coins: 50000 } ],
            evolutionData: {
                newName: "Akaza (Destructive)",
                newImage: "./images/evolve/akaza (destructive).webp",
                basePowerIncrease: 620
            }
        },
        {
            name: "Tengen Uzui",
            rarity: "Mythic",
            color: "rainbow-text",
            image: "./images/perso/tengen.webp",
            power: 1230,
            level: 1,
            evolutionRequirements: [ { item: "Nichirin Cleavers", quantity: 5 }, { item: "Green Essence", quantity: 20 }, { item: "Blue Essence", quantity: 20 }, { item: "Yellow Essence", quantity: 20 }, { item: "Purple Essence", quantity: 20 }, { item: "Rainbow Essence", quantity: 10 }, { coins: 50000 } ],
            evolutionData: {
                newName: "Tengen Uzui (Flashiness)",
                newImage: "./images/evolve/tengen uzui (flashiness).webp",
                basePowerIncrease: 590
            }
        },
        {
            name: "Naruto (Sage)",
            rarity: "Mythic",
            color: "rainbow-text",
            image: "./images/perso/naruto (sage).webp",
            power: 1270,
            level: 1,
            evolutionRequirements: [ { item: "Blue Chakra", quantity: 5 }, { item: "Red Chakra", quantity: 5 }, { item: "Green Essence", quantity: 20 }, { item: "Blue Essence", quantity: 20 }, { item: "Pink Essence", quantity: 20 }, { item: "Rainbow Essence", quantity: 10 }, { coins: 50000 } ],
            evolutionData: {
                newName: "Naruto (Six Tails)",
                newImage: "./images/evolve/Naruto (Six Tails).webp",
                basePowerIncrease: 610
            }
        },
        {
            name: "Obito Uchiha",
            rarity: "Mythic",
            color: "rainbow-text",
            image: "./images/perso/obito.webp",
            power: 1240,
            level: 1,
            evolutionRequirements: [ { item: "Skin Patch", quantity: 5 }, { item: "Green Essence", quantity: 20 }, { item: "Purple Essence", quantity: 20 }, { item: "Yellow Essence", quantity: 20 }, { item: "Rainbow Essence", quantity: 10 }, { coins: 50000 } ],
            evolutionData: {
                newName: "Obito Uchiha (Awakened)",
                newImage: "./images/evolve/Obito Uchiha (Awakened).webp",
                basePowerIncrease: 600
            }
        },
        {
            name: "Sasuke (Hebi)",
            rarity: "Mythic",
            color: "rainbow-text",
            image: "./images/perso/sasuke (hebi).webp",
            power: 1250,
            level: 1,
            evolutionRequirements: [ { item: "Snake Scale", quantity: 5 }, { item: "Green Essence", quantity: 20 }, { item: "Pink Essence", quantity: 20 }, { item: "Red Essence", quantity: 20 }, { item: "Rainbow Essence", quantity: 10 }, { coins: 50000 } ],
            evolutionData: {
                newName: "Sasuke (Storm)",
                newImage: "./images/evolve/Sasuke (Storm).webp",
                basePowerIncrease: 610
            }
        },
        {
            name: "Vegeta (Super)",
            rarity: "Mythic",
            color: "rainbow-text",
            image: "./images/perso/vegeta (super).webp",
            power: 1290,
            level: 1,
            evolutionRequirements: [ { item: "Senzu Bean", quantity: 5 }, { item: "Green Essence", quantity: 20 }, { item: "Blue Essence", quantity: 20 }, { item: "Yellow Essence", quantity: 20 }, { item: "Rainbow Essence", quantity: 10 }, { coins: 50000 } ],
            evolutionData: {
                newName: "Vegeta (Super Awakened)",
                newImage: "./images/evolve/Vegeta (Super Awakened).webp",
                basePowerIncrease: 620
            }
        },
        {
          name: "Alucard",
          rarity: "Secret",
          color: "text-yellow-400",
          image: "./images/perso/alucard.png",
          power: 1400,
          level: 1,
          evolutionRequirements: [ { item: "Hellsing Arms", quantity: 5 }, { item: "Green Essence", quantity: 20 }, { item: "Yellow Essence", quantity: 20 }, { item: "Red Essence", quantity: 20 }, { item: "Purple Essence", quantity: 20 }, { item: "Rainbow Essence", quantity: 10 }, { coins: 100000 } ],
          evolutionData: {
              newName: "Alucard (Vampire King)",
              newImage: "./images/evolve/Alucard (Vampire King).webp",
              basePowerIncrease: 750
          }
        },
        {
          name: "Yamamoto",
          rarity: "Secret",
          color: "text-yellow-400",
          image: "./images/perso/yamamoto.webp",
          power: 1500,
          level: 1,
          evolutionRequirements: [ { item: "Head Captain's Coat", quantity: 5 }, { coins: 100000 }, { item: "Green Essence", quantity: 20 }, { item: "Red Essence", quantity: 20 }, { item: "Purple Essence", quantity: 20 }, { item: "Rainbow Essence", quantity: 10 } ],
          evolutionData: {
              newName: "Yamamoto (Captain)",
              newImage: "./images/evolve/Yamamoto (Captain).webp",
              basePowerIncrease: 750
          }
        },
        {
          name: "Regnaw", 
          rarity: "Secret",
          color: "text-yellow-400", 
          image: "./images/perso/regnaw.webp",
          power: 1510, 
          level: 1,
          evolutionRequirements: [ { item: "Silverite Sword", quantity: 1 }, { item: "Green Essence", quantity: 20 }, { item: "Yellow Essence", quantity: 20 }, { item: "Blue Essence", quantity: 20 }, { item: "Purple Essence", quantity: 20 }, { item: "Red Essence", quantity: 20 }, { item: "Rainbow Essence", quantity: 10 }, { coins: 100000 } ],
          evolutionData: {
              newName: "Regnaw (Rage)",
              newImage: "./images/evolve/Regnaw (Rage).webp",
              basePowerIncrease: 750
          }
        },
        {
          name: "Giro",
          rarity: "Mythic",
          color: "rainbow-text",
          image: "./images/perso/giro.webp",
          power: 1250,
          level: 1,
          evolutionRequirements: [ { item: "Holy Corpse Eyes", quantity: 5 }, { item: "Green Essence", quantity: 20 }, { item: "Blue Essence", quantity: 20 }, { item: "Yellow Essence", quantity: 20 }, { item: "Purple Essence", quantity: 20 }, { item: "Rainbow Essence", quantity: 10 }, { coins: 50000 } ],
          evolutionData: {
            newName: "Giro (Ball Breaker)",
            newImage: "./images/evolve/Giro (Ball Breaker).webp",
            basePowerIncrease: 550
          }
        },
        {
          name: "Johnni",
          rarity: "Mythic",
          color: "rainbow-text",
          image: "./images/perso/johnni.webp",
          power: 1260,
          level: 1,
          evolutionRequirements: [ { item: "Holy Corpse Arms", quantity: 1 }, { item: "Green Essence", quantity: 20 }, { item: "Blue Essence", quantity: 20 }, { item: "Purple Essence", quantity: 20 }, { item: "Pink Essence", quantity: 20 }, { item: "Rainbow Essence", quantity: 10 }, { coins: 50000 } ],
          evolutionData: {
            newName: "Johnni (Infinite Spin)",
            newImage: "./images/evolve/Johnni (Infinite Spin).webp",
            basePowerIncrease: 600
          }
        },
        {
          name: "Valentine",
          rarity: "Mythic",
          color: "rainbow-text",
          image: "./images/perso/valentine.webp",
          power: 1300,
          level: 1,
          evolutionRequirements: [ { item: "Completed Holy Corpse", quantity: 5 }, { item: "Green Essence", quantity: 20 }, { item: "Purple Essence", quantity: 20 }, { item: "Pink Essence", quantity: 20 }, { item: "Red Essence", quantity: 20 }, { item: "Rainbow Essence", quantity: 10 }, { coins: 750000 } ],
          evolutionData: {
            newName: "Valentine (Love Train)",
            newImage: "./images/evolve/Valentine (Love Train).webp",
            basePowerIncrease: 700,
            newRarity: "Secret",
            newColor: "text-secret"
          }
        },
        {
          name: "Medusa",
          rarity: "Mythic",
          color: "rainbow-text",
          image: "./images/perso/medusa.webp",
          power: 1280,
          level: 1,
          evolutionRequirements: [ { item: "Gorgon's Blindfold", quantity: 5 }, { item: "Green Essence", quantity: 20 }, { item: "Yellow Essence", quantity: 20 }, { item: "Purple Essence", quantity: 20 }, { item: "Pink Essence", quantity: 20 }, { item: "Red Essence", quantity: 20 }, { item: "Rainbow Essence", quantity: 10 }, { coins: 50000 } ],
          evolutionData: {
            newName: "Medusa (Gorgon)",
            newImage: "./images/evolve/Medusa (Gorgon).webp",
            basePowerIncrease: 580
          }
        },
        {
          name: "Medea",
          rarity: "Mythic",
          color: "rainbow-text",
          image: "./images/perso/medea.webp",
          power: 1290,
          level: 1,
          evolutionRequirements: [ { item: "Caster's Headpiece", quantity: 5 }, { item: "Green Essence", quantity: 20 }, { item: "Blue Essence", quantity: 20 }, { item: "Yellow Essence", quantity: 20 }, { item: "Purple Essence", quantity: 20 }, { item: "Pink Essence", quantity: 20 }, { item: "Rainbow Essence", quantity: 10 }, { coins: 50000 } ],
          evolutionData: {
            newName: "Medea (Witch of Betrayal)",
            newImage: "./images/evolve/Medea (Witch of Betrayal).webp",
            basePowerIncrease: 590
          }
        },
        {
          name: "Saber",
          rarity: "Mythic",
          color: "rainbow-text",
          image: "./images/perso/saber.webp",
          power: 1300,
          level: 1,
          evolutionRequirements: [ { item: "Avalon", quantity: 5 }, { item: "Green Essence", quantity: 20 }, { item: "Yellow Essence", quantity: 20 }, { item: "Blue Essence", quantity: 20 }, { item: "Purple Essence", quantity: 20 }, { item: "Red Essence", quantity: 20 }, { item: "Rainbow Essence", quantity: 10 }, { coins: 50000 } ],
          evolutionData: {
            newName: "Saber (King of Knights)",
            newImage: "./images/evolve/Saber (King of Knights).webp",
            basePowerIncrease: 610
          }
        },
        {
          name: "Ishtar",
          rarity: "Mythic",
          color: "rainbow-text",
          image: "./images/perso/ishtar.webp",
          power: 1300,
          level: 1,
          evolutionRequirements: [ { item: "Goddess' Sword", quantity: 5 }, { item: "Green Essence", quantity: 20 }, { item: "Blue Essence", quantity: 20 }, { item: "Yellow Essence", quantity: 20 }, { item: "Purple Essence", quantity: 20 }, { item: "Red Essence", quantity: 20 }, { item: "Rainbow Essence", quantity: 10 }, { coins: 50000 } ],
          evolutionData: {
            newName: "Ishtar (Divinity)",
            newImage: "./images/evolve/Ishtar (Divinity).webp",
            basePowerIncrease: 600
          }
        },
        {
          name: "Cu Chulainn",
          rarity: "Mythic",
          color: "rainbow-text",
          image: "./images/perso/cu chulainn.webp",
          power: 1290,
          level: 1,
          evolutionRequirements: [ { item: "Blade of Death", quantity: 5 }, { item: "Green Essence", quantity: 20 }, { item: "Blue Essence", quantity: 20 }, { item: "Yellow Essence", quantity: 20 }, { item: "Purple Essence", quantity: 20 }, { item: "Pink Essence", quantity: 20 }, { item: "Red Essence", quantity: 20 }, { item: "Rainbow Essence", quantity: 10 }, { coins: 50000 } ],
          evolutionData: {
            newName: "Cu Chulainn (Child of Light)",
            newImage: "./images/evolve/Cu Chulainn (Child of Light)",
            basePowerIncrease: 580
          }
        },
        {
          name: "Lilia",
          rarity: "Mythic",
          color: "rainbow-text",
          image: "./images/perso/lilia.webp",
          power: 1310,
          level: 1,
          evolutionRequirements: [ { item: "Berserker's Blade", quantity: 5 }, { item: "Green Essence", quantity: 20 }, { item: "Yellow Essence", quantity: 20 }, { item: "Pink Essence", quantity: 20 }, { item: "Purple Essence", quantity: 20 }, { item: "Red Essence", quantity: 20 }, { item: "Rainbow Essence", quantity: 10 }, { coins: 50000 } ],
          evolutionData: {
            newName: "Lilia and Berserker",
            newImage: "./images/evolve/Lilia and Berserker.webp",
            basePowerIncrease: 600
          }
        },
        {
          name: "Yoruichi",
          rarity: "Mythic",
          color: "rainbow-text",
          image: "./images/perso/yoruichi.webp",
          power: 1330,
          level: 1,
          evolutionRequirements: [ { item: "Shunpo Spirit", quantity: 5 }, { item: "Green Essence", quantity: 20 }, { item: "Yellow Essence", quantity: 20 }, { item: "Purple Essence", quantity: 20 }, { item: "Red Essence", quantity: 20 }, { item: "Rainbow Essence", quantity: 10 }, { coins:50000 } ],
          evolutionData: {
            newName: "Yoruichi (Raijin)",
            newImage: "./images/evolve/Yoruichi (Raijin).webp",
            basePowerIncrease: 620
          }
        },
        {
          name: "Uryu",
          rarity: "Mythic",
          color: "rainbow-text",
          image: "./images/perso/uryu.webp",
          power: 1340,
          level: 1,
          evolutionRequirements: [ { item: "Energy Arrow", quantity: 5 }, { item: "Green Essence", quantity: 20 }, { item: "Blue Essence", quantity: 20 }, { item: "Yellow Essence", quantity: 20 }, { item: "Pink Essence", quantity: 20 }, { item: "Rainbow Essence", quantity: 10 }, { coins: 50000 } ],
          evolutionData: {
            newName: "Uryu (Antithesis)",
            newImage: "./images/evolve/Uryu (Antithesis).webp",
            basePowerIncrease: 630
          }
        },
        {
          name: "Orihime",
          rarity: "Mythic",
          color: "rainbow-text",
          image: "./images/perso/orihime.webp",
          power: 1260,
          level: 1,
          evolutionRequirements: [ { item: "Hair Ornament", quantity: 5 }, { item: "Green Essence", quantity: 20 }, { item: "Blue Essence", quantity: 20 }, { item: "Purple Essence", quantity: 20 }, { item: "Pink Essence", quantity: 20 }, { item: "Rainbow Essence", quantity: 10 }, { coins: 50000 } ],
          evolutionData: {
            newName: "Orihime (Faith)",
            newImage: "./images/evolve/Orihime (Faith).webp",
            basePowerIncrease: 570
          }
        },
         {
          name: "Kisuke",
          rarity: "Mythic",
          color: "rainbow-text",
          image: "./images/perso/kisuke.webp",
          power: 1280,
          level: 1,
          evolutionRequirements: [ { item: "Bucket Hat", quantity: 5 }, { item: "Green Essence", quantity: 20 }, { item: "Purple Essence", quantity: 20 }, { item: "Pink Essence", quantity: 20 }, { item: "Red Essence", quantity: 20 }, { item: "Rainbow Essence", quantity: 10 }, { coins: 50000 } ],
          evolutionData: {
            newName: "Kisuke (Scientist)",
            newImage: "./images/evolve/Kisuke (Scientist).webp",
            basePowerIncrease: 590
          }
        },
        {
          name: "Ichigo (True Release)",
          rarity: "Mythic",
          color: "rainbow-text",
          image: "./images/perso/ichigo (true release).webp",
          power: 1350,
          level: 1,
          evolutionRequirements: [ { item: "Horn of Salvation", quantity: 5 }, { item: "Green Essence", quantity: 20 }, { item: "Blue Essence", quantity: 20 }, { item: "Purple Essence", quantity: 20 }, { item: "Red Essence", quantity: 20 }, { item: "Rainbow Essence", quantity: 5 }, { coins: 50000 } ],
          evolutionData: {
            newName: "Ichigo (Savior)",
            newImage: "./images/evolve/Ichigo (Savior).webp",
            basePowerIncrease: 650 
          }
        },
        {
          name: "Giselle",
          rarity: "Mythic",
          color: "rainbow-text",
          image: "./images/perso/giselle.webp",
          power: 1270,
          level: 1,
          evolutionRequirements: [ { item: "Energy Bone", quantity: 1 }, { item: "Green Essence", quantity: 30 }, { item: "Purple Essence", quantity: 15 }, { item: "Blue Essence", quantity: 20 }, { item: "Yellow Essence", quantity: 12 }, { item: "Rainbow Essence", quantity: 2 }, { coins:50000 } ],
          evolutionData: {
            newName: "Giselle (Zombie)",
            newImage: "./images/evolve/Giselle (Zombie).webp",
            basePowerIncrease: 580
          }
        },
        {
          name: "Aizen",
          rarity: "Mythic",
          color: "rainbow-text",
          image: "./images/perso/aizen.webp",
          power: 1320,
          level: 1,
          evolutionRequirements: [ { item: "Prison Chair", quantity: 1 }, { item: "Green Essence", quantity: 30 }, { item: "Blue Essence", quantity: 12 }, { item: "Yellow Essence", quantity: 12 }, { item: "Purple Essence", quantity: 15 }, { item: "Rainbow Essence", quantity: 2 }, { coins: 75000 } ],
            evolutionData: {
                newName: "Aizen (Aura)",
                newImage: "./images/evolve/Aizen (Aura).webp",
                basePowerIncrease: 730,
                newRarity: "Secret",
                newColor: "text-secret"
            }
        },
        {
            name: "Goku (Angel)",
            rarity: "Mythic",
            color: "rainbow-text",
            image: "./images/perso/goku (angel).webp",
            power: 1300,
            level: 1,
            evolutionRequirements: [ { item: "Rotara Earring 2", quantity: 1 }, { item: "Rotara Earring 1", quantity: 1 }, { item: "Green Essence", quantity: 40 }, { item: "Red Essence", quantity: 30 }, { item: "Blue Essence", quantity: 30 }, { item: "Rainbow Essence", quantity: 3 }, { coins: 75000 } ],
            evolutionData: {
                newName: "Roku (Super 3)",
                newImage: "./images/evolve/Goku (Super 3).webp",
                basePowerIncrease: 850,
                newRarity: "Secret",
                newColor: "text-secret"
            }
        },
        {
            name: "Gohan (Adult)",
            rarity: "Mythic",
            color: "rainbow-text",
            image: "./images/perso/gohan (adult).webp",
            power: 1300,
            level: 1,
            evolutionRequirements: [ { item: "Z Blade", quantity: 12 }, { item: "Green Essence", quantity: 30 }, { item: "Red Essence", quantity: 10 }, { item: "Purple Essence", quantity: 5 }, { item: "Yellow Essence", quantity: 5 }, { item: "Blue Essence", quantity: 15 }, { item: "Rainbow Essence", quantity: 1 }, { coins: 50000 } ],
            evolutionData: {
                newName: "Ultimate Gohan",
                newImage: "./images/evolve/Ultimate Gohan.webp",
                basePowerIncrease: 700
            }
        },
        {
            name: "Hercules",
            rarity: "Mythic",
            color: "rainbow-text",
            image: "./images/perso/hercules.webp",
            power: 1280,
            level: 1,
            evolutionRequirements: [ { item: "Champ's Belt", quantity: 12 }, { item: "Green Essence", quantity: 30 }, { item: "Red Essence", quantity: 15 }, { item: "Purple Essence", quantity: 20 }, { item: "Blue Essence", quantity: 5 }, { item: "Yellow Essence", quantity: 15 }, { item: "Rainbow Essence", quantity: 1 }, { coins: 50000 } ],
            evolutionData: {
                newName: "Hercules and Mr Boo",
                newImage: "./images/evolve/Hercules and Mr Boo.webp",
                basePowerIncrease: 650
            }
        },
        {
            name: "Delta",
            rarity: "Mythic",
            color: "rainbow-text",
            image: "./images/perso/delta.webp",
            power: 1250,
            level: 1,
            evolutionRequirements: [ { item: "Dog Bone", quantity: 1 }, { item: "Green Essence", quantity: 30 }, { item: "Red Essence", quantity: 20 }, { item: "Pink Essence", quantity: 20 }, { item: "Rainbow Essence", quantity: 1 }, { coins: 50000 } ],
            evolutionData: {
                newName: "Delta (Hunt)",
                newImage: "./images/evolve/Delta (Hunt).webp",
                basePowerIncrease: 600
            }
        },
        {
            name: "Subaru Natsuki",
            rarity: "Secret",
            color: "text-secret",
            image: "./images/perso/subaru.webp",
            power: 1500,
            level: 1,
            evolutionRequirements: [ { item: "Tome of Wisdom", quantity: 1 }, { coins: 100000 } ],
            evolutionData: {
                newName: "Subaru Natsuki (Contract)", 
                newImage: "./images/evolve/Subaru Natsuki (Contract).webp",
                basePowerIncrease: 800,
            }
        },
        {
            name: "Artoria Pendragon (Alternate)",
            rarity: "Secret",
            color: "text-secret", 
            image: "./images/perso/artoria pendragon (alternate).webp",
            power: 1510,
            level: 1,
            evolutionRequirements: [ { item: "Corrupted Visor", quantity: 1 }, { item: "Green Essence", quantity: 40 }, { item: "Blue Essence", quantity: 12 }, { item: "Yellow Essence", quantity: 12 }, { item: "Red Essence", quantity: 15 }, { item: "Rainbow Essence", quantity: 1 }, { coins: 30000 } ],
            evolutionData: {
                newName: "Artoria Pendragon (Black Tyrant)",
                newImage: "./images/evolve/Artoria Pendragon (Black Tyrant).webp",
                basePowerIncrease: 900,
            }
        },
        {
            name: "Sakura Matou",
            rarity: "Secret",
            color: "text-secret",
            image: "./images/perso/sakura.webp",
            power: 1550,
            level: 1,
            evolutionRequirements: [ { item: "Tainted Ribbon", quantity: 1 }, { item: "Green Essence", quantity: 40 }, { item: "Yellow Essence", quantity: 12 }, { item: "Pink Essence", quantity: 15 }, { item: "Red Essence", quantity: 12 }, { item: "Rainbow Essence", quantity: 1 }, { coins: 100000 } ],
            evolutionData: {
                newName: "Sakura (Angra Mainyu)",
                newImage: "./images/evolve/Sakura (Angra Mainyu).webp",
                basePowerIncrease: 950,
            }
        },
        {
            name: "Esdeath",
            rarity: "Secret",
            color: "text-secret",
            image: "./images/perso/esdeath.webp",
            power: 1520,
            level: 1,
            evolutionRequirements: [ { item: "Demon Chalice", quantity: 1 }, { coins: 100000 } ],
            evolutionData: {
                newName: "Esdeath (Romantic)",
                newImage: "./images/evolve/Esdeath (Romantic).webp",
                basePowerIncrease: 800,
            }
        },
        {
            name: "Yhwach",
            rarity: "Secret",
            color: "text-secret",
            image: "./images/perso/yhwach.webp",
            power: 1530, 
            level: 1,
            evolutionRequirements: [ { item: "Essence of the Spirit King", quantity: 1 }, { item: "Green Essence", quantity: 40 }, { item: "Blue Essence", quantity: 12 }, { item: "Purple Essence", quantity: 15 }, { item: "Red Essence", quantity: 12 }, { item: "Rainbow Essence", quantity: 1 }, { coins: 30000 } ],
            evolutionData: {
                newName: "Yhwach (Almighty)",
                newImage: "./images/evolve/Yhwach (Almighty).webp",
                basePowerIncrease: 790,
            }
        },
        {
            name: "Frieren",
            rarity: "Secret",
            color: "text-secret",
            image: "./images/perso/frieren.webp",
            power: 1520,
            level: 1,
            evolutionRequirements: [ { item: "Ring of Friendship", quantity: 1 }, { coins: 10000 } ],
            evolutionData: {
                newName: "Frieren (Teacher)",
                newImage: "./images/evolve/Frieren (Teacher).webp",
                basePowerIncrease: 780,
            }
        },
        {
            name: "Choi Jong-In",
            rarity: "Secret",
            color: "text-secret",
            image: "./images/perso/choi jong-in.png",
            power: 1550, 
            level: 1,
            evolutionRequirements: [ { item: "Red Jewel", quantity: 5 }, { item: "Green Essence", quantity: 40 }, { item: "Blue Essence", quantity: 12 }, { item: "Purple Essence", quantity: 12 }, { item: "Red Essence", quantity: 20 }, { item: "Rainbow Essence", quantity: 1 }, { coins: 100000 } ],
            evolutionData: {
                newName: "Choi Jong-In (Guild Leader)", 
                newImage: "./images/evolve/Choi Jong-In (Guild Leader).webp",
                basePowerIncrease: 800,
            }
        },
        {
            name: "Boo",
            rarity: "Secret",
            color: "text-secret",
            image: "./images/perso/boo.png  ",
            power: 1550,
            level: 1,
            evolutionRequirements: [ { item: "Majan Essence", quantity: 12 }, { item: "Green Essence", quantity: 40 }, { item: "Red Essence", quantity: 12 }, { item: "Pink Essence", quantity: 20 }, { item: "Blue Essence", quantity: 12 }, { item: "Rainbow Essence", quantity: 2 }, { coins: 30000 } ],
            evolutionData: {
                newName: "Boo (Evil)",
                newImage: "./images/evolve/Boo (Evil).webp",
                basePowerIncrease: 830,
            }
        },
        {
            name: "Katakuri",
            rarity: "Secret",
            color: "text-secret",
            image: "./images/perso/katakuri.png",
            power: 1750,
            level: 1,
            evolutionRequirements: [ { item: "Donut", quantity: 5 }, { coins: 100000 } ],
            evolutionData: {
                newName: "Katakuri (Mochi)",
                newImage: "./images/evolve/Katakuri (Mochi).webp",
                basePowerIncrease: 800,
            }
        },
        {
            name: "Cid Kagenou",
            rarity: "Secret",
            color: "text-secret",
            image: "./images/perso/cid kagenou.png",
            power: 1580,
            level: 1,
            evolutionRequirements: [ { item: "Atomic Essence", quantity: 1 }, { item: "Green Essence", quantity: 40 }, { item: "Red Essence", quantity: 30 }, { item: "Blue Essence", quantity: 30 }, { item: "Rainbow Essence", quantity: 3 }, { coins: 30000 } ],
            evolutionData: {
                newName: "Shadow", 
                newImage: "./images/evolve/shadow.webp",
                basePowerIncrease: 800,
            }
        },
        {
            name: "NotGoodGuy",
            rarity: "Mythic",
            color: "rainbow-text",
            image: "./images/perso/notgoodguy.png",
            power: 1260,
            level: 1,
            evolutionRequirements: [ { item: "Restricting Headband", quantity: 12 }, { item: "Green Essence", quantity: 30 }, { item: "Purple Essence", quantity: 20 }, { item: "Red Essence", quantity: 20 }, { item: "Rainbow Essence", quantity: 1 }, { coins: 15000 } ],
            evolutionData: {
                newName: "NotGoodGuy (Free)",
                newImage: "./images/evolve/NotGoodGuy (Free).webp",
                basePowerIncrease: 650
            }
        },
        {
            name: "Kazzy",
            rarity: "Mythic",
            color: "rainbow-text",
            image: "./images/perso/kazzy.webp",
            power: 1300,
            level: 1,
            evolutionRequirements: [ { item: "Toil Ribbon", quantity: 12 }, { item: "Green Essence", quantity: 40 }, { item: "Blue Essence", quantity: 20 }, { item: "Red Essence", quantity: 30 }, { item: "Rainbow Essence", quantity: 3 }, { coins: 30000 } ],
            evolutionData: {
                newName: "Kazzy (Queen)",
                newImage: "./images/evolve/Kazzy (Queen).webp",
                basePowerIncrease: 600,
            }
        },
      ];

    // --- MODIFICATION ICI ---
    // Ajout de la propriété `chance` à chaque personnage
        const specialCharacters = [
        {
          name: "Gogeta's Super Saiyan 4",
          rarity: "Vanguard",
          color: "text-vanguard",
          image: "./images/perso/gogeta's super saiyan 4.png",
          power: 1850,
          level: 1,
          passive: { teamSizeBonus: 2 },
          chance: 0.00001 // 0.00001% de chance (1 sur 100,000)
        },  
        {
            name: "Igris",
            rarity: "Secret",
            color: "text-yellow-400",
            image: "./images/perso/igris.webp",
            power: 1450,
            level: 1,
            evolutionRequirements: [ { item: "Blood-Red Armor", quantity: 5 }, { item: "Green Essence", quantity: 20 }, { item: "Blue Essence", quantity: 20 }, { item: "Red Essence", quantity: 20 }, { item: "Pink Essence", quantity: 20 }, { item: "Rainbow Essence", quantity: 10 }, { coins: 100000 } ],
            evolutionData: {
                newName: "Igris (Elite Knight)",
                newImage: "./images/evolve/Igris (Elite Knight).webp",
                basePowerIncrease: 800
            },
            chance: 0.0000125 // 0.00125% de chance (1 sur 80,000)
        },
        { name: "Majin Boo (Evil)", rarity: "Secret", color: "text-secret", image: "./images/perso/majin boo (evil).webp", power: 1550, level: 1, chance: 0.0000125 },
        { name: "Buuhan (Evil)", rarity: "Secret", color: "text-secret", image: "./images/perso/buuhan (evil).png", power: 1560, level: 1, chance: 0.0000125 },
        { name: "Boockleo (Evil)", rarity: "Secret", color: "text-secret", image: "./images/perso/boockleo (evil).png", power: 1570, level: 1, chance: 0.0000125 },
        { name: "Super Boo (Evil)", rarity: "Secret", color: "text-secret", image: "./images/perso/super boo (evil).webp", power: 1520, level: 1, chance: 0.0000125 },
        { name: "Kid Boo (Evil)", rarity: "Secret", color: "text-secret", image: "./images/perso/kid boo (evil).webp", power: 1580, level: 1, chance: 0.0000125 },
        { name: "Super Vegetto", rarity: "Secret", color: "text-secret", image: "./images/perso/super vegetto.webp", power: 1585, level: 1, chance: 0.0000125 },
        { name: "Cid", rarity: "Secret", color: "text-secret", image: "./images/perso/cid.png", power: 1650, level: 1, chance: 0.0000125 },
        { name: "Kaze-sensei", rarity: "Légendaire", color: "text-purple-400", image: "https://via.placeholder.com/150?text=Kaze", power: 800, level: 1 },
        { name: "Mizu-chan", rarity: "Épique", color: "text-blue-400", image: "https://via.placeholder.com/150?text=Mizu", power: 500, level: 1 },
        { name: "Tsuchi-kun", rarity: "Rare", color: "text-gray-400", image: "https://via.placeholder.com/150?text=Tsuchi", power: 360, level: 1 },
        { name: "Sakura", rarity: "Légendaire", color: "text-pink-400", image: "https://via.placeholder.com/150?text=Sakura", power: 850, level: 1 }
    ];

    const allCharacters = [...standardCharacters, ...specialCharacters];

    const shopItemPool = [
      { type: 'gems', amount: 500, cost: 50, currency: 'coins', description: "500 gemmes" }, { type: 'gems', amount: 1200, cost: 100, currency: 'coins', description: "1200 gemmes" }, { type: 'gems', amount: 3000, cost: 200, currency: 'coins', description: "3000 gemmes" }, { type: 'pull-ticket', amount: 1, cost: 80, currency: 'coins', description: "Ticket de Tirage x1" }, { type: 'pull-ticket', amount: 3, cost: 200, currency: 'coins', description: "Ticket de Tirage x3" }, { type: 'exp-boost', amount: 2, cost: 200, currency: 'coins', description: "Boost EXP x2 (30 min)" },
    ];

    const missionPool = [
    // Missions existantes
    { id: 1, description: "Effectuer 5 tirages standards", type: "pulls", goal: 5, reward: { gems: 200 } },
    { id: 2, description: "Obtenir 3 personnages épiques", type: "epic_chars", goal: 3, reward: { gems: 300 } },
    { id: 3, description: "Vendre 5 personnages", type: "sell_chars", goal: 5, reward: { gems: 150 } },
    { id: 4, description: "Effectuer 3 tirages spéciaux", type: "special_pulls", goal: 3, reward: { gems: 250 } },
    { id: 5, description: "Gagner 500 EXP de joueur", type: "exp_gain", goal: 500, reward: { gems: 100 } },
    { id: 6, description: "Acheter 1 objet dans la boutique", type: "shop_purchase", goal: 1, reward: { gems: 120 } },
    { id: 7, description: "Obtenir 1 personnage légendaire", type: "legendary_chars", goal: 1, reward: { gems: 400 } },
    { id: 8, description: "Atteindre le niveau de joueur 5", type: "level_up", goal: 5, reward: { gems: 300 } },
    { id: 9, description: "Effectuer 15 tirages (tous types)", type: "pulls", goal: 15, reward: { gems: 350 } },
    { id: 10, description: "Vendre 5 personnages rares", type: "sell_rare_chars", goal: 5, reward: { gems: 200 } },
    { id: 11, description: "Obtenir 2 personnages de la bannière spéciale", type: "special_chars", goal: 2, reward: { gems: 280 } },
    { id: 12, description: "Gagner 1000 EXP de joueur", type: "exp_gain", goal: 1000, reward: { gems: 200 } },
    { id: 13, description: "Acheter 3 objets dans la boutique", type: "shop_purchase", goal: 3, reward: { gems: 240 } },
    // NOUVELLES MISSIONS
    { id: 14, description: "Faire évoluer un personnage", type: "evolve_char", goal: 1, reward: { gems: 500 } },
    { id: 15, description: "Terminer 5 niveaux du mode Histoire", type: "complete_story_levels", goal: 5, reward: { gems: 250 } },
    { id: 16, description: "Dépenser 5000 gemmes", type: "spend_gems", goal: 5000, reward: { gems: 300 } },
    { id: 17, description: "Fusionner 10 personnages", type: "fuse_chars", goal: 10, reward: { gems: 150 } },
    { id: 18, description: "Terminer 1 niveau du mode Légende", type: "complete_legendary_levels", goal: 1, reward: { gems: 350 } },
    { id: 19, description: "Utiliser 3 Stat Chips", type: "change_stat_rank", goal: 3, reward: { gems: 200 } },
    { id: 20, description: "Obtenir 1 personnage Mythic", type: "mythic_chars", goal: 1, reward: { gems: 800 } },
    { id: 21, description: "Briser les limites d'un personnage", type: "limit_break_char", goal: 1, reward: { gems: 400 } },
    { id: 22, description: "Appliquer 3 malédictions", type: "curse_char", goal: 3, reward: { gems: 200 } },
    { id: 23, description: "Appliquer 3 traits à des personnages", type: "apply_trait", goal: 3, reward: { gems: 200 } },
    { id: 24, description: "Terminer 1 niveau du mode Challenge", type: "complete_challenge_levels", goal: 1, reward: { gems: 150 } },
    { id: 25, description: "Dépenser 10 000 pièces", type: "spend_coins", goal: 10000, reward: { gems: 150 } }
  ];

    const baseStoryLevels = [
      // Monde 1
      { id: 1, world: "Royaume des Ombres", name: "Niveau 1: Guerrier des Ombres", enemy: { name: "Ombre", power: 250}, rewards: { gems: 80, coins: 100, exp: 50 }, unlocked: true, completed: false, type: 'story' }, 
      { id: 2, world: "Royaume des Ombres", name: "Niveau 2: Gardien de la Forêt", enemy: { name: "Sylve", power: 350 }, rewards: { gems: 80, coins: 100, exp: 60 }, unlocked: false, completed: false, type: 'story' }, 
      { id: 3, world: "Royaume des Ombres", name: "Niveau 3: Seigneur des Flammes", enemy: { name: "Ignis", power: 500 }, rewards: { gems: 80, coins: 100, exp: 70 }, unlocked: false, completed: false, type: 'story' }, 
      { id: 4, world: "Royaume des Ombres", name: "Niveau 4: Maître des Tempêtes", enemy: { name: "Tempestas", power: 700 }, rewards: { gems: 80, coins: 100, exp: 80 }, unlocked: false, completed: false, type: 'story' }, 
      { id: 5, world: "Royaume des Ombres", name: "Niveau 5: Roi Démon", enemy: { name: "Demonis", power: 900 }, rewards: { gems: 150, coins: 80, exp: 90 }, unlocked: false, completed: false, type: 'story' }, 
      { id: 6, world: "Royaume des Ombres", name: "Niveau 6: Spectre Lunaire", enemy: { name: "Lunaris", power: 1100}, rewards: { gems: 80, coins: 100, exp: 100 }, unlocked: false, completed: false, type: 'story' },
      // Monde 2
      { id: 7, world: "Empire de Cristal", name: "Niveau 1: Sentinelle de Quartz", enemy: { name: "Quartzis", power: 1400}, rewards: { gems: 80, coins: 100, exp: 110 }, unlocked: false, completed: false, type: 'story' }, 
      { id: 8, world: "Empire de Cristal", name: "Niveau 2: Garde de Saphir", enemy: { name: "Sapphira", power: 1350}, rewards: { gems: 80, coins: 100, exp: 120 }, unlocked: false, completed: false, type: 'story' }, 
      { id: 9, world: "Empire de Cristal", name: "Niveau 3: Chevalier d'Émeraude", enemy: { name: "Emeraldis", power: 1500}, rewards: { gems: 80, coins: 100, exp: 130 }, unlocked: false, completed: false, type: 'story' }, 
      { id: 10, world: "Empire de Cristal", name: "Niveau 4: Seigneur de Rubis", enemy: { name: "Rubius", power: 1650}, rewards: { gems: 80, coins: 100, exp: 140 }, unlocked: false, completed: false, type: 'story' }, 
      { id: 11, world: "Empire de Cristal", name: "Niveau 5: Roi de Diamant", enemy: { name: "Diamantis", power: 1800}, rewards: { gems: 80, coins: 100, exp: 150 }, unlocked: false, completed: false, type: 'story' }, 
      { id: 12, world: "Empire de Cristal", name: "Niveau 6: Oracle de Cristal", enemy: { name: "Crystalia", power: 1950}, rewards: { gems: 80, coins: 100, exp: 160 }, unlocked: false, completed: false, type: 'story' },
      // Monde 3
      { id: 13, world: "Profondeurs Abyssales", name: "Niveau 1: Ombre des Fonds", enemy: { name: "Abyssal Shade", power: 2100}, rewards: { gems: 80, coins: 100, exp: 170 }, unlocked: false, completed: false, type: 'story' }, 
      { id: 14, world: "Profondeurs Abyssales", name: "Niveau 2: Kraken des Mers", enemy: { name: "Krakenis", power: 2250}, rewards: { gems: 80, coins: 100, exp: 180 }, unlocked: false, completed: false, type: 'story' }, 
      { id: 15, world: "Profondeurs Abyssales", name: "Niveau 3: Serpent des Abysses", enemy: { name: "Serpentra", power: 2400}, rewards: { gems: 80, coins: 100, exp: 190 }, unlocked: false, completed: false, type: 'story' }, 
      { id: 16, world: "Profondeurs Abyssales", name: "Niveau 4: Gardien des Coraux", enemy: { name: "Coralith", power: 2550}, rewards: { gems: 80, coins: 100, exp: 200 }, unlocked: false, completed: false, type: 'story' }, 
      { id: 17, world: "Profondeurs Abyssales", name: "Niveau 5: Léviathan", enemy: { name: "Leviathos", power: 2700}, rewards: { gems: 80, coins: 180, exp: 100 }, unlocked: false, completed: false, type: 'story' }, 
      { id: 18, world: "Profondeurs Abyssales", name: "Niveau 6: Dieu des Abysses", enemy: { name: "Abyssara", power: 2850}, rewards: { gems: 80, coins: 100, exp: 220 }, unlocked: false, completed: false, type: 'story' },
      // Monde 4
      { id: 19, world: "Pics Célestes", name: "Niveau 1: Aigle des Cieux", enemy: { name: "Skywing", power: 3000}, rewards: { gems: 80, coins: 100, exp: 230 }, unlocked: false, completed: false, type: 'story' }, 
      { id: 20, world: "Pics Célestes", name: "Niveau 2: Gardien des Nuages", enemy: { name: "Cloudius", power: 3150}, rewards: { gems: 80, coins: 100, exp: 240 }, unlocked: false, completed: false, type: 'story' }, 
      { id: 21, world: "Pics Célestes", name: "Niveau 3: Phénix Étoilé", enemy: { name: "Starphoenix", power: 3300}, rewards: { gems: 80, coins: 100, exp: 250 }, unlocked: false, completed: false, type: 'story' }, 
      { id: 22, world: "Pics Célestes", name: "Niveau 4: Dragon des Cieux", enemy: { name: "Skydra", power: 3450}, rewards: { gems: 80, coins: 100, exp: 260 }, unlocked: false, completed: false, type: 'story' }, 
      { id: 23, world: "Pics Célestes", name: "Niveau 5: Ange Céleste", enemy: { name: "Celestia", power: 3600}, rewards: { gems: 80, coins: 100, exp: 270 }, unlocked: false, completed: false, type: 'story' }, 
      { id: 24, world: "Pics Célestes", name: "Niveau 6: Empereur des Étoiles", enemy: { name: "Starex", power: 3750}, rewards: { gems: 80, coins: 100, exp: 280 }, unlocked: false, completed: false, type: 'story' },
      // Monde 5
      { id: 25, world: "Déserts du Vide", name: "Niveau 1: Ombre du Néant", enemy: { name: "Voidshade", power: 3900}, rewards: { gems: 80, coins: 100, exp: 290 }, unlocked: false, completed: false, type: 'story' }, 
      { id: 26, world: "Déserts du Vide", name: "Niveau 2: Vagabond du Vide", enemy: { name: "Voidwalker", power: 4050}, rewards: { gems: 80, coins: 100, exp: 300 }, unlocked: false, completed: false, type: 'story' }, 
      { id: 27, world: "Déserts du Vide", name: "Niveau 3: Spectre du Chaos", enemy: { name: "Chaospecter", power: 4200}, rewards: { gems: 80, Coins: 100, exp: 310 }, unlocked: false, completed: false, type: 'story' }, 
      { id: 28, world: "Déserts du Vide", name: "Niveau 4: Titan du Néant", enemy: { name: "Voidtitan", power: 4350}, rewards: { gems: 80, coins: 100, exp: 320 }, unlocked: false, completed: false, type: 'story' }, 
      { id: 29, world: "Déserts du Vide", name: "Niveau 5: Démon du Vide", enemy: { name: "Voidemon", power: 4500}, rewards: { gems: 80, coins: 100, exp: 330 }, unlocked: false, completed: false, type: 'story' }, 
      { id: 30, world: "Déserts du Vide", name: "Niveau 6: Seigneur du Néant", enemy: { name: "Voidrex", power: 4650}, rewards: { gems: 80, coins: 100, exp: 340 }, unlocked: false, completed: false, type: 'story' },
      // Monde 6
      { id: 31, world: "Éclipse Éternelle", name: "Niveau 1: Ombre de l'Éclipse", enemy: { name: "Ecliptor", power: 4800}, rewards: { gems: 80, coins: 100, exp: 350 }, unlocked: false, completed: false, type: 'story' }, 
      { id: 32, world: "Éclipse Éternelle", name: "Niveau 2: Gardien de l'Ombre", enemy: { name: "Shadowguard", power: 4950}, rewards: { gems: 80, coins: 100, exp: 360 }, unlocked: false, completed: false, type: 'story' }, 
      { id: 33, world: "Éclipse Éternelle", name: "Niveau 3: Spectre Solaire", enemy: { name: "Solarspecter", power: 5100}, rewards: { gems: 80, coins: 100, exp: 370 }, unlocked: false, completed: false, type: 'story' }, 
      { id: 34, world: "Éclipse Éternelle", name: "Niveau 4: Dragon de l'Éclipse", enemy: { name: "Eclipsera", power: 5250}, rewards: { gems: 80, coins: 100, exp: 380 }, unlocked: false, completed: false, type: 'story' }, 
      { id: 35, world: "Éclipse Éternelle", name: "Niveau 5: Roi de l'Ombre", enemy: { name: "Shadowrex", power: 5400}, rewards: { gems: 80, coins: 100, exp: 390 }, unlocked: false, completed: false, type: 'story' }, 
      { id: 36, world: "Éclipse Éternelle", name: "Niveau 6: Dieu de l'Éclipse", enemy: { name: "Eclipsegod", power: 5550}, rewards: { gems: 80, coins: 100, exp: 400 }, unlocked: false, completed: false, type: 'story' },
      // Monde 7  
      { id: 37, world: "Forêt Éthérée", name: "Niveau 1: Esspirit du Bosquet", enemy: { name: "Sylvaris", power: 5700}, rewards: { gems: 80, coins: 100, exp: 410 }, unlocked: false, completed: false, type: 'story' }, 
      { id: 38, world: "Forêt Éthérée", name: "Niveau 2: Gardien de l'Arbre-Monde", enemy: { name: "Arborius", power: 5850}, rewards: { gems: 80, coins: 100, exp: 420 }, unlocked: false, completed: false, type: 'story' }, 
      { id: 39, world: "Forêt Éthérée", name: "Niveau 3: Fée des Brumes", enemy: { name: "Mistalia", power: 6000}, rewards: { gems: 80, coins: 100, exp: 430 }, unlocked: false, completed: false, type: 'story' }, 
      { id: 40, world: "Forêt Éthérée", name: "Niveau 4: Chaman des Anciens", enemy: { name: "Elderglow", power: 6150}, rewards: { gems: 80, coins: 100, exp: 440 }, unlocked: false, completed: false, type: 'story' }, 
      { id: 41, world: "Forêt Éthérée", name: "Niveau 5: Entité Sylvestre", enemy: { name: "Forestheart", power: 6300}, rewards: { gems: 80, coins: 100, exp: 450 }, unlocked: false, completed: false, type: 'story' }, 
      { id: 42, world: "Forêt Éthérée", name: "Niveau 6: Reine Éthérée", enemy: { name: "Aetheria", power: 6450}, rewards: { gems: 80, coins: 100, exp: 460 }, unlocked: false, completed: false, type: 'story' },
      // Monde 8
      { id: 43, world: "Cieux Fracturés", name: "Niveau 1: Éclaireur des Étoiles", enemy: { name: "Starseeker", power: 6600}, rewards: { gems: 80, coins: 100, exp: 470 }, unlocked: false, completed: false, type: 'story' }, 
      { id: 44, world: "Cieux Fracturés", name: "Niveau 2: Sentinelle Cosmique", enemy: { name: "Cosmara", power: 6750}, rewards: { gems: 80, coins: 100, exp: 480 }, unlocked: false, completed: false, type: 'story' }, 
      { id: 45, world: "Cieux Fracturés", name: "Niveau 3: Guerrier des Novas", enemy: { name: "Novablade", power: 6900}, rewards: { gems: 80, coins: 100, exp: 490 }, unlocked: false, completed: false, type: 'story' }, 
      { id: 46, world: "Cieux Fracturés", name: "Niveau 4: Titan Stellaire", enemy: { name: "Starforge", power: 7050}, rewards: { gems: 80, coins: 100, exp: 500 }, unlocked: false, completed: false, type: 'story' }, 
      { id: 47, world: "Cieux Fracturés", name: "Niveau 5: Héraut du Cosmos", enemy: { name: "Cosmoherald", power: 7200}, rewards: { gems: 80, coins: 100, exp: 510 }, unlocked: false, completed: false, type: 'story' }, 
      { id: 48, world: "Cieux Fracturés", name: "Niveau 6: Empereur Fracturé", enemy: { name: "Skyshatter", power: 7350}, rewards: { gems: 80, coins: 100, exp: 520 }, unlocked: false, completed: false, type: 'story' },
       // Monde 9: Ruines Volcaniques
      { id: 50, world: "Ruines Volcaniques", name: "Niveau 1: Gardien de Cendre", enemy: { name: "Cinderguard", power: 7500}, rewards: { gems: 80, coins: 100, exp: 530 }, unlocked: false, completed: false, type: 'story' },
      { id: 51, world: "Ruines Volcaniques", name: "Niveau 2: Salamandre de Lave", enemy: { name: "Lavascale", power: 7650}, rewards: { gems: 80, coins: 100, exp: 540 }, unlocked: false, completed: false, type: 'story' },
      { id: 52, world: "Ruines Volcaniques", name: "Niveau 3: Golem Magmatique", enemy: { name: "Magmacore", power: 7800}, rewards: { gems: 80, coins: 100, exp: 550 }, unlocked: false, completed: false, type: 'story' },
      { id: 53, world: "Ruines Volcaniques", name: "Niveau 4: Drake de Soufre", enemy: { name: "Sulfurdrake", power: 7950}, rewards: { gems: 80, coins: 100, exp: 560 }, unlocked: false, completed: false, type: 'story' },
      { id: 54, world: "Ruines Volcaniques", name: "Niveau 5: Seigneur du Volcan", enemy: { name: "Volcanus Rex", power: 8100}, rewards: { gems: 80, coins: 100, exp: 570 }, unlocked: false, completed: false, type: 'story' },
      { id: 55, world: "Ruines Volcaniques", name: "Niveau 6: Esprit Incandescent", enemy: { name: "Blazespirit", power: 8250}, rewards: { gems: 80, coins: 100, exp: 580 }, unlocked: false, completed: false, type: 'story' },

      // Monde 10: Cité Céleste Engloutie
      { id: 56, world: "Cité Céleste Engloutie", name: "Niveau 1: Sentinelle Aquatique", enemy: { name: "Aquaguardian", power: 8400}, rewards: { gems: 80, coins: 100, exp: 590 }, unlocked: false, completed: false, type: 'story' },
      { id: 57, world: "Cité Céleste Engloutie", name: "Niveau 2: Spectre des Profondeurs", enemy: { name: "Deepwraith", power: 8550}, rewards: { gems: 80, coins: 100, exp: 600 }, unlocked: false, completed: false, type: 'story' },
      { id: 58, world: "Cité Céleste Engloutie", name: "Niveau 3: Léviathan Ancien", enemy: { name: "Elder Leviathan", power: 8700}, rewards: { gems: 80, coins: 100, exp: 610 }, unlocked: false, completed: false, type: 'story' },
      { id: 59, world: "Cité Céleste Engloutie", name: "Niveau 4: Oracle Submergé", enemy: { name: "Sunken Oracle", power: 8850}, rewards: { gems: 80, coins: 100, exp: 620 }, unlocked: false, completed: false, type: 'story' },
      { id: 60, world: "Cité Céleste Engloutie", name: "Niveau 5: Roi Noyé", enemy: { name: "Drowned King", power: 9000}, rewards: { gems: 80, coins: 100, exp: 630 }, unlocked: false, completed: false, type: 'story' },
      { id: 61, world: "Cité Céleste Engloutie", name: "Niveau 6: Titan des Abysses Célestes", enemy: { name: "Skyabyss Titan", power: 9150}, rewards: { gems: 80, coins: 100, exp: 640 }, unlocked: false, completed: false, type: 'story' },

      // NOUVEAU MONDE 11: Royaume des Douceurs
      { id: 62, world: "Royaume des Douceurs", name: "Niveau 1: Sentinelle Guimauve", enemy: { name: "Marshmallow Guard", power: 9300}, rewards: { gems: 80, coins: 100, exp: 650 }, unlocked: false, completed: false, type: 'story' },
      { id: 63, world: "Royaume des Douceurs", name: "Niveau 2: Golem de Pain d'Épice", enemy: { name: "Gingerbread Golem", power: 9450}, rewards: { gems: 80, coins: 100, exp: 660 }, unlocked: false, completed: false, type: 'story' },
      { id: 64, world: "Royaume des Douceurs", name: "Niveau 3: Dragon de Sucre Filé", enemy: { name: "Spun Sugar Dragon", power: 9600}, rewards: { gems: 80, coins: 100, exp: 670 }, unlocked: false, completed: false, type: 'story' },
      { id: 65, world: "Royaume des Douceurs", name: "Niveau 4: Sorcière des Bonbons", enemy: { name: "Candy Witch", power: 9750}, rewards: { gems: 80, coins: 100, exp: 680 }, unlocked: false, completed: false, type: 'story' },
      { id: 66, world: "Royaume des Douceurs", name: "Niveau 5: Roi Chocolat", enemy: { name: "Chocolate King", power: 9900}, rewards: { gems: 80, coins: 100, exp: 690 }, unlocked: false, completed: false, type: 'story' },
      { id: 67, world: "Royaume des Douceurs", name: "Niveau 6: Déesse des Desserts", enemy: { name: "Dessert Goddess", power: 10050}, rewards: { gems: 80, coins: 100, exp: 700 }, unlocked: false, completed: false, type: 'story' },

      // NOUVEAU MONDE 12: Ruines Éthérées
      { id: 68, world: "Ruines Éthérées", name: "Niveau 1: Gardien Silencieux", enemy: { name: "Silent Sentinel", power: 10200}, rewards: { gems: 80, coins: 100, exp: 710 }, unlocked: false, completed: false, type: 'story' },
      { id: 69, world: "Ruines Éthérées", name: "Niveau 2: Spectre Flottant", enemy: { name: "Floating Wraith", power: 10350}, rewards: { gems: 80, coins: 100, exp: 720 }, unlocked: false, completed: false, type: 'story' },
      { id: 70, world: "Ruines Éthérées", name: "Niveau 3: Golem Ancien", enemy: { name: "Ancient Golem", power: 10500}, rewards: { gems: 80, coins: 100, exp: 730 }, unlocked: false, completed: false, type: 'story' },
      { id: 71, world: "Ruines Éthérées", name: "Niveau 4: Oracle Perdu", enemy: { name: "Lost Oracle", power: 10650}, rewards: { gems: 80, coins: 100, exp: 740 }, unlocked: false, completed: false, type: 'story' },
      { id: 72, world: "Ruines Éthérées", name: "Niveau 5: Esprit Vengeur", enemy: { name: "Vengeful Spirit", power: 10800}, rewards: { gems: 80, coins: 100, exp: 750 }, unlocked: false, completed: false, type: 'story' },
      { id: 73, world: "Ruines Éthérées", name: "Niveau 6: Maître des Ruines", enemy: { name: "Ruin Master", power: 10950}, rewards: { gems: 80, coins: 100, exp: 760 }, unlocked: false, completed: false, type: 'story' },

      // NOUVEAU MONDE 13: Vallée des Murmures
      { id: 74, world: "Vallée des Murmures", name: "Niveau 1: Gardien des Échos", enemy: { name: "Echo Warden", power: 11100}, rewards: { gems: 80, coins: 100, exp: 770 }, unlocked: false, completed: false, type: 'story' },
      { id: 75, world: "Vallée des Murmures", name: "Niveau 2: Esprit du Vent", enemy: { name: "Wind Spirit", power: 11250}, rewards: { gems: 80, coins: 100, exp: 780 }, unlocked: false, completed: false, type: 'story' },
      { id: 76, world: "Vallée des Murmures", name: "Niveau 3: Voix Ancestrale", enemy: { name: "Ancestral Voice", power: 11400}, rewards: { gems: 80, coins: 100, exp: 790 }, unlocked: false, completed: false, type: 'story' },
      { id: 77, world: "Vallée des Murmures", name: "Niveau 4: Chaman de la Vallée", enemy: { name: "Valley Shaman", power: 11550}, rewards: { gems: 80, coins: 100, exp: 800 }, unlocked: false, completed: false, type: 'story' },
      { id: 78, world: "Vallée des Murmures", name: "Niveau 5: Titan Murmurant", enemy: { name: "Whispering Titan", power: 11700}, rewards: { gems: 80, coins: 100, exp: 810 }, unlocked: false, completed: false, type: 'story' },
      { id: 79, world: "Vallée des Murmures", name: "Niveau 6: Souverain des Murmures", enemy: { name: "Whisper Sovereign", power: 11850}, rewards: { gems: 80, coins: 100, exp: 820 }, unlocked: false, completed: false, type: 'story' },

      // NOUVEAU MONDE 14: Néant Cosmique
      { id: 80, world: "Néant Cosmique", name: "Niveau 1: Vagabond Stellaire", enemy: { name: "Stellar Drifter", power: 12000}, rewards: { gems: 80, coins: 100, exp: 830 }, unlocked: false, completed: false, type: 'story' },
      { id: 81, world: "Néant Cosmique", name: "Niveau 2: Entité du Vide", enemy: { name: "Void Entity", power: 12150}, rewards: { gems: 80, coins: 100, exp: 840 }, unlocked: false, completed: false, type: 'story' },
      { id: 82, world: "Néant Cosmique", name: "Niveau 3: Gardien Galactique", enemy: { name: "Galactic Warden", power: 12300}, rewards: { gems: 80, coins: 100, exp: 850 }, unlocked: false, completed: false, type: 'story' },
      { id: 83, world: "Néant Cosmique", name: "Niveau 4: Conquérant Xéno", enemy: { name: "Xeno Conqueror", power: 12450}, rewards: { gems: 80, coins: 100, exp: 860 }, unlocked: false, completed: false, type: 'story' },
      { id: 84, world: "Néant Cosmique", name: "Niveau 5: Abomination Cosmique", enemy: { name: "Cosmic Abomination", power: 12600}, rewards: { gems: 80, coins: 100, exp: 870 }, unlocked: false, completed: false, type: 'story' },
      { id: 85, world: "Néant Cosmique", name: "Niveau 6: Seigneur du Néant", enemy: { name: "Overlord of the Void", power: 12750}, rewards: { gems: 80, coins: 100, exp: 880 }, unlocked: false, completed: false, type: 'story' },

      // NOUVEAU MONDE 15: Bastion des Chevaliers
      { id: 86, world: "Bastion des Chevaliers", name: "Niveau 1: Sentinelle en Armure", enemy: { name: "Armored Sentinel", power: 12900}, rewards: { gems: 80, coins: 100, exp: 890 }, unlocked: false, completed: false, type: 'story' },
      { id: 87, world: "Bastion des Chevaliers", name: "Niveau 2: Chevalier Vagabond", enemy: { name: "Knight Errant", power: 13050}, rewards: { gems: 80, coins: 100, exp: 900 }, unlocked: false, completed: false, type: 'story' },
      { id: 88, world: "Bastion des Chevaliers", name: "Niveau 3: Capitaine de la Garde", enemy: { name: "Captain of the Guard", power: 13200}, rewards: { gems: 80, coins: 100, exp: 910 }, unlocked: false, completed: false, type: 'story' },
      { id: 89, world: "Bastion des Chevaliers", name: "Niveau 4: Paladin Sacré", enemy: { name: "Holy Paladin", power: 13350}, rewards: { gems: 80, coins: 100, exp: 920 }, unlocked: false, completed: false, type: 'story' },
      { id: 90, world: "Bastion des Chevaliers", name: "Niveau 5: Grand Maître Chevalier", enemy: { name: "Grand Knightmaster", power: 13500}, rewards: { gems: 80, coins: 100, exp: 930 }, unlocked: false, completed: false, type: 'story' },
      { id: 91, world: "Bastion des Chevaliers", name: "Niveau 6: Roi Chevalier Héroïque", enemy: { name: "Heroic Knight King", power: 13650}, rewards: { gems: 80, coins: 100, exp: 940 }, unlocked: false, completed: false, type: 'story' },
      
      // Monde 16: Forteresse Céleste
      { id: 92, world: "Forteresse Céleste", name: "Niveau 1: Gardien Ailé", enemy: { name: "Aegis Alatus", power: 13800}, rewards: { gems: 80, coins: 100, exp: 950 }, unlocked: false, completed: false, type: 'story' },
      { id: 93, world: "Forteresse Céleste", name: "Niveau 2: Sentinelle de Lumière", enemy: { name: "Lux Vigilo", power: 13950}, rewards: { gems: 80, coins: 100, exp: 960 }, unlocked: false, completed: false, type: 'story' },
      { id: 94, world: "Forteresse Céleste", name: "Niveau 3: Archonte Céleste", enemy: { name: "Archon Caelum", power: 14100}, rewards: { gems: 80, coins: 100, exp: 970 }, unlocked: false, completed: false, type: 'story' },
      { id: 95, world: "Forteresse Céleste", name: "Niveau 4: Paladin des Étoiles", enemy: { name: "Stella Paladinus", power: 14250}, rewards: { gems: 80, coins: 100, exp: 980 }, unlocked: false, completed: false, type: 'story' },
      { id: 96, world: "Forteresse Céleste", name: "Niveau 5: Juge Divin", enemy: { name: "Divinus Iudex", power: 14400}, rewards: { gems: 80, coins: 100, exp: 990 }, unlocked: false, completed: false, type: 'story' },
      { id: 97, world: "Forteresse Céleste", name: "Niveau 6: Roi-Soleil", enemy: { name: "Sol Invictus Rex", power: 14550}, rewards: { gems: 80, coins: 100, exp: 1000 }, unlocked: false, completed: false, type: 'story' },

      // Monde 17: Ruines Oubliées du Temps
      { id: 98, world: "Ruines Oubliées du Temps", name: "Niveau 1: Spectre Temporel", enemy: { name: "Chronospecter", power: 15000}, rewards: { gems: 80, coins: 100, exp: 1010 }, unlocked: false, completed: false, type: 'story' },
      { id: 99, world: "Ruines Oubliées du Temps", name: "Niveau 2: Gardien des Éons", enemy: { name: "Aeon Custos", power: 15150}, rewards: { gems: 80, coins: 100, exp: 1020 }, unlocked: false, completed: false, type: 'story' },
      { id: 100, world: "Ruines Oubliées du Temps", name: "Niveau 3: Golem de Paradoxe", enemy: { name: "Paradox Golem", power: 15300}, rewards: { gems: 80, coins: 100, exp: 1030 }, unlocked: false, completed: false, type: 'story' },
      { id: 101, world: "Ruines Oubliées du Temps", name: "Niveau 4: Oracle des Âges", enemy: { name: "Saeculum Oraculum", power: 15450}, rewards: { gems: 80, coins: 100, exp: 1040 }, unlocked: false, completed: false, type: 'story' },
      { id: 102, world: "Ruines Oubliées du Temps", name: "Niveau 5: Titan Oublié", enemy: { name: "Oblitus Titan", power: 15600}, rewards: { gems: 80, coins: 100, exp: 1050 }, unlocked: false, completed: false, type: 'story' },
      { id: 103, world: "Ruines Oubliées du Temps", name: "Niveau 6: Seigneur du Temps", enemy: { name: "Dominus Temporis", power: 15750}, rewards: { gems: 80, coins: 100, exp: 1060 }, unlocked: false, completed: false, type: 'story' },

      { id: 120, world: "Abîme Infini", name: "Niveau Infini: Abîme Éternel", enemy: { name: "Entité Infinie", power: 7500}, rewards: { gemsPerMinute: 10 }, unlocked: false, completed: false, isInfinite: true }
    ];
    const legendaryStoryLevels = [
        { id: 1001, world: "Royaume des Ombres", name: "Défi Légendaire: Roi des Ombres Éveillé", enemy: { name: "Rex Umbra Validus", power: 5000}, rewards: { gems: 500, coins: 250, exp: 1000, itemChance: { item: "Green Essence", probability: 0.01, minQuantity: 1, maxQuantity: 3 } }, type: 'legendary', unlocked: false, completed: false },
        { id: 1002, world: "Empire de Cristal", name: "Défi Légendaire: Cœur de Cristal Pur", enemy: { name: "Crystallus Prime Validus", power: 7500}, rewards: { gems: 750, coins: 375, exp: 1500, itemChance: { item: "Red Essence", probability: 0.01, minQuantity: 1, maxQuantity: 3} }, type: 'legendary', unlocked: false, completed: false },
        { id: 1003, world: "Profondeurs Abyssales", name: "Défi Légendaire: Abomination des Profondeurs", enemy: { name: "Abyss Lord Validus", power: 10000}, rewards: { gems: 1000, coins: 500, exp: 2000, itemChance: { item: "Blue Essence", probability: 0.01, minQuantity: 1, maxQuantity: 3 } }, type: 'legendary', unlocked: false, completed: false},
        { id: 1004, world: "Pics Célestes", name: "Défi Légendaire: Souverain des Cieux", enemy: { name: "Sky Emperor Validus", power: 12500}, rewards: { gems: 1250, coins: 625, exp: 2500, itemChance: { item: "Pink Essence", probability: 0.01, minQuantity: 1, maxQuantity: 3 } }, type: 'legendary', unlocked: false, completed: false},
        { id: 1005, world: "Déserts du Vide", name: "Défi Légendaire: Entité du Vide Ancestrale", enemy: { name: "Void Ancient Validus", power: 15000}, rewards: { gems: 1500, coins: 750, exp: 3000, itemChance: { item: "Yellow Essence", probability: 0.01, minQuantity: 1, maxQuantity: 3 } }, type: 'legendary', unlocked: false, completed: false},
        { id: 1006, world: "Éclipse Éternelle", name: "Défi Légendaire: Dévoreur d'Éclipse", enemy: { name: "Eclipse Eater Validus", power: 17500}, rewards: { gems: 1750, coins: 875, exp: 3500, itemChance: {item: "Purple Essence", probability: 0.01, minQuantity: 1, maxQuantity: 3} }, type: 'legendary', unlocked: false, completed: false},
        { id: 1007, world: "Forêt Éthérée", name: "Défi Légendaire: Esprit Millénaire de la Forêt", enemy: { name: "Millennial Forest Spirit Validus", power: 20000}, rewards: { gems: 2000, coins: 1000, exp: 4000, itemChance: { item: "Rainbow Essence", probability: 0.005, minQuantity: 1, maxQuantity: 2 } }, type: 'legendary', unlocked: false, completed: false},
        { id: 1008, world: "Cieux Fracturés", name: "Défi Légendaire: Briseur de Cosmos", enemy: { name: "Cosmos Breaker Validus", power: 22500}, rewards: { gems: 2250, coins: 1125, exp: 4500, itemChance: [ { item: "Shadow Tracer", probability: 1, minQuantity: 1, maxQuantity: 1 }, { item: "Silverite Sword", probability: 0.0004, minQuantity: 1, maxQuantity: 2 } ] }, type: 'legendary', unlocked: false, completed: false},
        { id: 1009, world: "Ruines Volcaniques", name: "Défi Légendaire: Cœur du Volcan Ancien", enemy: { name: "Ignis Primordialis Validus", power: 25000}, rewards: { gems: 2500, coins: 1250, exp: 5000, itemChance: [ { item : "Blood-Red Armor", probability: 0.0004, minQuantity: 1, maxQuantity: 1 }, { item: "Cast Blades", probability: 0.0004, minQuantity: 1, maxQuantity: 2 } ] }, type: 'legendary', unlocked: false, completed: false},
        { id: 1010, world: "Cité Céleste Engloutie", name: "Défi Légendaire: Titan des Mers Étoilées", enemy: { name: "Stellamaris Titan Validus", power: 27500}, rewards: { gems: 2750, coins: 1375, exp: 5500, itemChance: [ { item: "Hellsing Arms", probability: 0.0004, minQuantity: 1, maxQuantity: 1 }, { item: "Broken Sword", probability: 0.0004, minQuantity: 1, maxQuantity: 2  } ] }, type: 'legendary', unlocked: false, completed: false},
        { id: 1011, world: "Royaume des Douceurs", name: "Défi Légendaire: Festin Apocalyptique", enemy: { name: "Seigneur Sucre Sombre Validus", power: 30000 }, rewards: { gems: 3000, coins: 1500, exp: 6000, itemChance: [ { item: "Head Captain's Coat", probability: 0.0004, minQuantity: 1, maxQuantity: 1 }, { item: "Chipped Blade", probability: 0.0004, minQuantity: 1, maxQuantity: 1 } ] }, type: 'legendary', unlocked: false, completed: false },
        { id: 1012, world: "Ruines Éthérées", name: "Défi Légendaire: L'Écho Éthéré", enemy: { name: "Custode Éthéré Validus", power: 32500 }, rewards: { gems: 3250, coins: 1625, exp: 6500, itemChance: [ { item: "Cursed Finger", probability: 0.0004, minQuantity: 1, maxQuantity: 1 }, { item: "Magma Stone", probability: 0.0004, minQuantity: 1, maxQuantity: 1 } ] }, type: 'legendary', unlocked: false, completed: false },
        { id: 1013, world: "Vallée des Murmures", name: "Défi Légendaire: Silence Assourdissant", enemy: { name: "Entité du Silence Validus", power: 35000 }, rewards: { gems: 3500, coins: 1750, exp: 7000, itemChance: [ { item: "Broken Pendant", probability: 0.0004, minQuantity: 1, maxQuantity: 1 }, { item: "Demon Beads", probability: 0.0004, minQuantity: 1, maxQuantity: 1 } ] }, type: 'legendary', unlocked: false, completed: false },
        { id: 1014, world: "Néant Cosmique", name: "Défi Légendaire: Singularité Menaçante", enemy: { name: "Singularité Primordiale Validus", power: 37500 }, rewards: { gems: 3750, coins: 1875, exp: 7500, itemChance: [ { item: "Nichirin Cleavers", probability: 0.0004, minQuantity: 1, maxQuantity: 1 }, { item: "Skin Patch", probability: 0.0004, minQuantity: 1, maxQuantity: 1 } ] }, type: 'legendary', unlocked: false, completed: false },
        { id: 1015, world: "Bastion des Chevaliers", name: "Défi Légendaire: Le Serment du Chevalier Éternel", enemy: { name: "Chevalier Éternel Validus", power: 40000 }, rewards: { gems: 4000, coins: 2000, exp: 8000, itemChance: [ { item: "Blue Chakra", probability: 0.0004, minQuantity: 1, maxQuantity: 1 }, { item: "Red Chakra", probability: 0.0004, minQuantity: 1, maxQuantity: 1 } ] }, type: 'legendary', unlocked: false, completed: false },
        { id: 1016, world: "Forteresse Céleste", name: "Défi Légendaire: Gardien Suprême des Cieux", enemy: { name: "Caelum Supremus Validus", power: 42500}, rewards: { gems: 4250, coins: 2125, exp: 8500, itemChance: [ { item: "Atomic Essence", probability: 0.0002, minQuantity: 1, maxQuantity: 1 }, { item: "Divin Wish", probability: 0.0002, minQuantity: 1, maxQuantity: 1 } ] }, type: 'legendary', unlocked: false, completed: false },
        { id: 1017, world: "Ruines Oubliées du Temps", name: "Défi Légendaire: Entité Temporelle Primordiale", enemy: { name: "Primordius Chronos Validus", power: 45000}, rewards: { gems: 4500, coins: 2250, exp: 9000, itemChance: [ { item: "Atomic Essence", probability: 0.0002, minQuantity: 1, maxQuantity: 1 }, { item: "Divin Wish", probability: 0.0002, minQuantity: 1, maxQuantity: 1 } ] }, type: 'legendary', unlocked: false, completed: false },
    ];
    const storyLevels = [...baseStoryLevels, ...legendaryStoryLevels];

    const challengeLevels = [
      { id: 201, world: "Challenge Unique", name: "Défi: Vague d'ennemis", enemy: { name: "Horde Mixte", power: 3000}, rewards: { gems: 100, coins: 50, exp: 200, itemChance: { item: "Cursed Token", probability: 0.01, minQuantity: 1, maxQuantity: 1 } }, type: 'challenge', unlocked: true, completed: false },
      { id: 202, world: "Challenge Unique", name: "Défi: Boss Résistant", enemy: { name: "Golem Ancien", power: 6000}, rewards: { gems: 200, coins: 100, exp: 400, itemChance: { item: "Stat Chip", probability: 0.01, minQuantity: 1, maxQuantity: 1 }}, type: 'challenge', unlocked: true, completed: false },
      { id: 203, world: "Challenge Unique", name: "Défi: Gardien Véloce", enemy: { name: "Gardien Véloce", power: 7500}, rewards: { gems: 150, coins: 75, exp: 300, itemChance: {item: "Reroll Token", probability: 0.01, minQuantity: 1, maxQuantity: 1} }, type: 'challenge', unlocked: true, completed: false },
      { id: 204, world: "Challenge Avancé", name: "Défi: Briser les Limites", enemy: { name: "Gardien Ancestral", power: 8000 }, rewards: { gems: 250, coins: 125, exp: 500, itemChance: { item: "Divin Wish", probability: 0.01, minQuantity: 1, maxQuantity: 1 } }, type: 'challenge', unlocked: true, completed: false },
      { 
        id: 205,
        world: "Challenge Jouable", 
        name: "Défi: Boss Tapper", 
        enemy: { 
          name: "Titan Tapper", 
          power: 100000, 
          image: "./images/perso/titan-tapper.png"
        }, 
        rewards: { gems: 150, coins: 150, exp: 500, itemChance: { item: "Reroll Token", probability: 0.25, minQuantity: 1, maxQuantity: 1 } },
        type: 'minigame',
        unlocked: true, 
        completed: false 
      },
    ];

    const materialFarmLevels = [
      {
        id: 301,
        world: "Antre du Gardien des Essences",
        name: "Farm: Snake Scale et Gorgon's Blindfold",
        enemy: { name: "Gardien des Essences", power: 5000 },
        rewards: {
          gems: 80, coins: 120, exp: 30,
          itemChance: [{ item: "Snake Scale", probability: 0.02, minQuantity: 1, maxQuantity: 1 }, { item: "Gorgon's Blindfold", probability: 0.02, minQuantity: 1, maxQuantity: 1 }]
        },
        type: 'material',
        unlocked: true,
        completed: false
      },
      {
        id: 302,
        world: "Domaine du Spectre d'Ombre",
        name: "Farm: Senzu Bean et Caster's Headpiece",
        enemy: { name: "Spectre d'Ombre", power: 6000 },
        rewards: {
          gems: 80, coins: 120, exp: 30,
          itemChance: [{ item: "Senzu Bean", probability: 0.02, minQuantity: 1, maxQuantity: 1 }, { item: "Caster's Headpiece", probability: 0.02, minQuantity: 1, maxQuantity: 1 }]
        },
        type: 'material',
        unlocked: true,
        completed: false
      },
      {
        id: 303,
        world: "Fosse de l'Abomination Maudite",
        name: "Farm: Holy Corpse Eyes et Holy Corpse Arms",
        enemy: { name: "Abomination Maudite", power: 7000 },
        rewards: {
          gems: 80, coins: 120, exp: 30,
          itemChance: [{ item: "Holy Corpse Eyes", probability: 0.02, minQuantity: 1, maxQuantity: 1 }, { item: "Holy Corpse Arms", probability: 0.02, minQuantity: 1, maxQuantity: 1 }]
        },
        type: 'material',
        unlocked: true,
        completed: false
      },
      {
        id: 304,
        world: "Forge du Forgeron Ancien",
        name: "Farm: Completed Holy Corpse et Avalon",
        enemy: { name: "Forgeron Ancien", power: 8000 },
        rewards: {
          gems: 80, coins: 120, exp: 40,
          itemChance: [{ item: "Completed Holy Corpse", probability: 0.02, minQuantity: 1, maxQuantity: 1 }, { item: "Avalon", probability: 0.02, minQuantity: 1, maxQuantity: 1 }]
        },
        type: 'material',
        unlocked: true,
        completed: false
      },
      {
        id: 305,
        world: "Poste du Veilleur Éthéré",
        name: "Farm: Goddess' Sword et Blade of Death",
        enemy: { name: "Veilleur Éthéré", power: 6000 },
        rewards: {
          gems: 80, coins: 120, exp: 35,
          itemChance: [{ item: "Goddess' Sword", probability: 0.02, minQuantity: 1, maxQuantity: 1 },  { item: "Blade of Death", probability: 0.02, minQuantity: 1, maxQuantity: 1 }]
        },
        type: 'material',
        unlocked: true, 
        completed: false
      },
      {
        id: 306,
        world: "Crypte du Gardien Squelettique",
        name: "Farm: Berserker's Blade et Shunpo Spirit",
        enemy: { name: "Gardien Squelettique", power: 6200 },
        rewards: {
          gems: 80, coins: 120, exp: 35,
          itemChance: [{ item: "Berserker's Blade", probability: 0.02, minQuantity: 1, maxQuantity: 1 }, { item: "Shunpo Spirit", probability: 0.02, minQuantity: 1, maxQuantity: 1 }]
        },
        type: 'material',
        unlocked: true,
        completed: false
      },
      {
        id: 314,
        world: "Chenil du Cerbère Spectral",
        name: "Farm: Six Eyes et Tome of Wisdom",
        enemy: { name: "Cerbère Spectral", power: 7600 },
        rewards: {
          gems: 80, coins: 120, exp: 45,
          itemChance: [{ item: "Six Eyes", probability: 0.02, minQuantity: 1, maxQuantity: 1 }, { item: "Tome of Wisdom", probability: 0.02, minQuantity: 1, maxQuantity: 1 }]
        },
        type: 'material',
        unlocked: true,
        completed: false
      },
      {
        id: 315,
        world: "Sanctuaire de l'Oracle Ancien",
        name: "Farm: Corrupted Visor et Tainted Ribbon",
        enemy: { name: "Oracle Ancien", power: 8500 },
        rewards: {
          gems: 80, coins: 120, exp: 50,
          itemChance: [{ item: "Corrupted Visor", probability: 0.02, minQuantity: 1, maxQuantity: 1 }, { item: "Tainted Ribbon", probability: 0.02, minQuantity: 1, maxQuantity: 1 }]
        },
        type: 'material',
        unlocked: true,
        completed: false
      },
      {
        id: 316,
        world: "Atelier de l'Esprit du Forgeron",
        name: "Farm: Demon Chalice et Essence of the Spirit King",
        enemy: { name: "Esprit du Forgeron", power: 8800 },
        rewards: {
          gems: 80, coins: 120, exp: 52,
          itemChance: [{ item: "Demon Chalice", probability: 0.02, minQuantity: 1, maxQuantity: 1 }, { item: "Essence of the Spirit King", probability: 0.02, minQuantity: 1, maxQuantity: 1 }]
        },
        type: 'material',
        unlocked: true,
        completed: false
      },
      {
        id: 317,
        world: "Arène du Champion Déchu",
        name: "Farm: Ring of Friendship et Red Jewel",
        enemy: { name: "Champion Déchu", power: 9000 },
        rewards: {
          gems: 80, coins: 120, exp: 55,
          itemChance: [ { item: "Ring of Friendship", probability: 0.02, minQuantity: 1, maxQuantity: 1 }, { item: "Red Jewel", probability: 0.02, minQuantity: 1, maxQuantity: 1 } ]
        },
        type: 'material',
        unlocked: true,
        completed: false
      },
      {
        id: 318,
        world: "Caveau du Gardien des Reliques",
        name: "Farm: Majan Essence et Donut",
        enemy: { name: "Gardien des Reliques Sombres", power: 9200 },
        rewards: {
          gems: 80, coins: 120, exp: 58,
          itemChance: [ { item: "Majan Essence", probability: 0.02, minQuantity: 1, maxQuantity: 1 }, { item: "Donut", probability: 0.02, minQuantity: 1, maxQuantity: 1 } ]
        },
        type: 'material',
        unlocked: true,
        completed: false
      },
      {
        id: 319,
        world: "Tombeau du Spectre Royal",
        name: "Farm: Atomic Essence",
        enemy: { name: "Spectre Royal", power: 9500 },
        rewards: {
          gems: 80, coins: 120, exp: 60,
          itemChance: [{ item: "Atomic Essence", probability: 0.02, minQuantity: 1, maxQuantity: 1 }]
        },
        type: 'material',
        unlocked: true,
        completed: false
      },
      {
        id: 307,
        world: "Autel de l'Esprit du Sanctuaire",
        name: "Farm: Energy Arrow et Hair Ornament",
        enemy: { name: "Esprit du Sanctuaire", power: 6500 },
        rewards: {
          gems: 80, coins: 120, exp: 38,
          itemChance: [{ item: "Energy Arrow", probability: 0.02, minQuantity: 1, maxQuantity: 1 }, { item: "Hair Ornament", probability: 0.02, minQuantity: 1, maxQuantity: 1 }] 
        },
        type: 'material',
        unlocked: true,
        completed: false
      },
      {
        id: 308,
        world: "Enclume du Forgeron Céleste",
        name: "Farm: Bucket Hat et Horn of Salvation",
        enemy: { name: "Forgeron Céleste Déchu", power: 6800 },
        rewards: {
          gems: 80, coins: 120, exp: 40,
          itemChance: [{ item: "Bucket Hat", probability: 0.02, minQuantity: 1, maxQuantity: 1 }, { item: "Horn of Salvation", probability: 0.02, minQuantity: 1, maxQuantity: 1 }]
        },
        type: 'material',
        unlocked: true,
        completed: false
      },
      {
        id: 309,
        world: "Scriptorium de l'Archiviste",
        name: "Farm: Energy Bone et Z Blade",
        enemy: { name: "Archiviste Spectral", power: 7000 },
        rewards: {
          gems: 80, coins: 120, exp: 42,
          itemChance: [{ item: "Energy Bone", probability: 0.02, minQuantity: 1, maxQuantity: 1 }, { item: "Z Blade", probability: 0.02, minQuantity: 1, maxQuantity: 1 }]
        },
        type: 'material',
        unlocked: true,
        completed: false
      },
      {
        id: 310,
        world: "Dojo du Maître Poussiéreux",
        name: "Farm: Bucket Hat et Prison Chair",
        enemy: { name: "Maître Poussiéreux", power: 7200 },
        rewards: {
          gems: 80, coins: 120, exp: 43,
          itemChance: [{ item: "Bucket Hat", probability: 0.016, minQuantity: 1, maxQuantity: 1 }, { item: "Prison Chair", probability: 0.016, minQuantity: 1, maxQuantity: 1 }]
        },
        type: 'material',
        unlocked: true,
        completed: false
      },
       {
        id: 311,
        world: "Trône du Gardien Scintillant",
        name: "Farm: Toil Ribbon",
        enemy: { name: "Gardien Scintillant", power: 7500 },
        rewards: {
            gems: 80, coins: 120, exp: 45,
            itemChance: [{ item: "Toil Ribbon", probability: 0.8, minQuantity: 1, maxQuantity: 3 }]
        },
        type: 'material',
        unlocked: true,
        completed: false
      },
      {
        id: 312,
        world: "Champ de Bataille Ancestral",
        name: "Farm: Rotara Earring 1 et Rotara Earring 2",
        enemy: { name: "Guerrier Ancestral", power: 7800 },
        rewards: {
          gems: 80, coins: 120, exp: 46,
          itemChance: [{ item: "Rotara Earring 1", probability: 0.02, minQuantity: 1, maxQuantity: 1 }, { item: "Rotara Earring 2", probability: 0.02, minQuantity: 1, maxQuantity: 1 }]
        },
        type: 'material',
        unlocked: true,
        completed: false
      },
      {
        id: 313, 
        world: "Temple de la Divinité Gardienne",
        name: "Farm: Champ's Belt et Dog Bone",
        enemy: { name: "Divinité Gardienne", power: 8200 },
        rewards: {
          gems: 80, coins: 120, exp: 48,
          itemChance: [{ item: "Champ's Belt", probability: 0.02, minQuantity: 1, maxQuantity: 1 }, { item: "Dog Bone", probability: 0.02, minQuantity: 1, maxQuantity: 1 }]
        },
        type: 'material',
        unlocked: true,
        completed: false
      },
      {
        id: 320,
        world: "Cuisine du Chef Pâtissier Fou",
        name: "Farm: Donut et Essence de Majin",
        enemy: { name: "Chef Pâtissier Fou", power: 9300 },
        rewards: {
          gems: 80, coins: 120, exp: 58,
          itemChance: [
            { item: "Donut", probability: 0.025, minQuantity: 1, maxQuantity: 2 },
            { item: "Essence de Majin", probability: 0.01, minQuantity: 1, maxQuantity: 1 }
          ]
        },
        type: 'material',
        unlocked: true,
        completed: false
      },
      {
        id: 321,
        world: "Geôles du Gardien du Château",
        name: "Farm: Restricting Headband",
        enemy: { name: "Gardien du Château", power: 9400 },
        rewards: {
          gems: 80, coins: 120, exp: 58,
          itemChance: [
            { item: "Restricting Headband", probability: 0.8, minQuantity: 1, maxQuantity: 1 }
          ]
        },
        type: 'material',
        unlocked: true,
        completed: false
      }
    ];

    const allGameLevels = [...baseStoryLevels, ...legendaryStoryLevels, ...challengeLevels, ...materialFarmLevels];

    const worldRewards = [
      { world: 1, item: "Haricots", minQuantity: 2, maxQuantity: 4 },
      { world: 2, item: "Fluide mystérieux", minQuantity: 3, maxQuantity: 6 },
      { world: 3, item: "Ramen Bowl", minQuantity: 5, maxQuantity: 10 },
      { world: 4, item: "Ghoul Coffee", minQuantity: 1, maxQuantity: 3 },
      { world: 5, item: "Soul Candy", minQuantity: 1, maxQuantity: 3 },
      { world: 6, item: "Cooked Fish", minQuantity: 1, maxQuantity: 3 },
      { world: 7, item: "Magical Artifact", minQuantity: 1, maxQuantity: 2 },
      { world: 8, item: "Curse Talisman", minQuantity: 1, maxQuantity: 2 },
      { world: 9, item: "Magic Pendant", minQuantity: 1, maxQuantity: 2 },
      { world: 10, item: "Crystal", minQuantity: 1, maxQuantity: 2 },
      { world: 11, item: "Chocolate Bar's", minQuantity: 1, maxQuantity: 2 },
      { world: 12, item: "Magic Stone", minQuantity: 1, maxQuantity: 2 },
      { world: 13, item: "Stone Pendant", minQuantity: 1, maxQuantity: 2 },
      { world: 14, item: "Alien Core", minQuantity: 1, maxQuantity: 2 },
      { world: 15, item: "Tavern Pie", minQuantity: 1, maxQuantity: 2 },
      { world: 16, item: "Plume Céleste", minQuantity: 1, maxQuantity: 2 },
      { world: 17, item: "Sablier Ancien", minQuantity: 1, maxQuantity: 2 },
    ];

    const itemEffects = {
      "Haricots": { exp: 50 },
      "Fluide mystérieux": { exp: 100 },
      "Ramen Bowl": { exp: 150 },
      "Ghoul Coffee": { exp: 200 },
      "Soul Candy": { exp: 250 },
      "Cooked Fish": { exp: 300 },
      "Magical Artifact": { exp: 350 },
      "Curse Talisman": { exp: 400 },
      "Crystal": { exp: 450 },
      "Magic Pendant": { exp: 500 },
      "Chocolate Bar's": { exp: 550 },
      "Magic Stone": { exp: 600 },
      "Stone Pendant": { exp: 650 },
      "Alien Core": { exp: 700 },
      "Tavern Pie": { exp: 750 },
      "Plume Céleste": { exp: 950 },
      "Sablier Ancien": { exp: 1000 },
    };

    const BANNER_CONFIG = {
        Secret:     { overallChance: 0.000025 }, // 0.0025% (inchangé)
        Mythic:     { overallChance: 0.00005,  numFeatured: 3, featuredPoolRatio: 0.85, featuredRelativeWeights: [0.33 / 1.16, 0.33 / 1.16, 0.50 / 1.16] },
        Légendaire: { overallChance: 0.01 },    // 1% (inchangé)
        Épique:     { overallChance: 0.05 },    // 5% (inchangé)
        // La probabilité pour Rare est calculée pour que la somme totale soit 1.
        // Somme des autres: 0.000025 (Secret) + 0.002 (Mythic) + 0.01 (Légendaire) + 0.05 (Épique) = 0.062025
        // Donc, Rare = 1 - 0.062025 = 0.937975
        Rare:       { overallChance: 0.937975 } // NOUVEAU: 93.7975%
    };

    const statRanks = {
        "C":   { modifier: 0.85, color: "text-gray-400",  order: 1, borderColor: "border-gray-400" },
        "B":   { modifier: 0.92, color: "text-sky-400",   order: 2, borderColor: "border-sky-400" },
        "A":   { modifier: 1.0,  color: "text-lime-400",  order: 3, borderColor: "border-lime-400" },
        "S":   { modifier: 1.08, color: "text-amber-400", order: 4, borderColor: "border-amber-400" },
        "SS":  { modifier: 1.15, color: "text-orange-500",order: 5, borderColor: "border-orange-500" }, 
        "SSS": { modifier: 1.25, color: "text-rose-500",  order: 6, borderColor: "border-rose-500" }
    };
    
    const statRankProbabilities = [
        { rank: "C",   probability: 0.40 }, // 40 / 100
        { rank: "B",   probability: 0.30 }, // 30 / 100
        { rank: "A",   probability: 0.20 }, // 20 / 100
        { rank: "S",   probability: 0.09 }, //  9 / 100
        { rank: "SS",  probability: 0.009 }, // 0.9 / 100
        { rank: "SSS", probability: 0.001 }  //  0.1 / 100
    ];
    
    const rarityOrder = {
      "Rare": 1,
      "Épique": 2,
      "Légendaire": 3,
      "Mythic": 4,
      "Secret": 5,
      "Vanguard": 6
    };
    const rarityExpMultipliers = {
      "Rare": 1.0,
      "Épique": 1.5,
      "Légendaire": 2.0,
      "Mythic": 3.0,
      "Secret": 4.0,
      "Vanguard": 5.0
    };

    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

    const TRAIT_DEFINITIONS = {
        "strength": {
            id: "strength",
            name: "Force",
            image: "./images/traits/Superior.png", // Placeholder image
            probability: 0.48, // Adjusted probability
            order: 1,
            gradeProbabilities: [
                { grade: 1, probability: 0.55 },
                { grade: 2, probability: 0.33 },
                { grade: 3, probability: 0.11 }
            ],
            grades: [
                { grade: 1, description: "+5% Puissance (Tous modes)", powerMultiplier: 0.05 },
                { grade: 2, description: "+10% Puissance (Tous modes)", powerMultiplier: 0.10 },
                { grade: 3, description: "+15% Puissance (Tous modes)", powerMultiplier: 0.15 }
            ]
        },
        "fortune": {
            id: "fortune",
            name: "Fortune",
            image: "./images/traits/Fortune.png", // Placeholder image
            probability: 0.48, // Adjusted probability
            order: 1,
            gradeProbabilities: [
                { grade: 1, probability: 0.55 },
                { grade: 2, probability: 0.33 },
                { grade: 3, probability: 0.11 }
            ],
            grades: [
                { grade: 1, description: "+5% Gemmes (Mode Histoire)", gemBonusPercentage: 0.10 },
                { grade: 2, description: "+15% Gemmes (Mode Histoire)", gemBonusPercentage: 0.15 },
                { grade: 3, description: "+25% Gemmes (Mode Histoire)", gemBonusPercentage: 0.25 }
            ]
        },
        "berserk": {
            id: "berserk",
            name: "Berserk",
            image: "./images/traits/Reaper.png", // Placeholder image
            probability: 0.01, // Assigned probability
            order: 2,
            // No gradeProbabilities for single-grade trait
            grades: [
                { grade: 1, description: "+25% Puissance (Mode Infini)", powerMultiplierInfinite: 0.25 }
            ]
        },
        "legends": {
            id: "legends",
            name: "Héros de Légende", // "Legends" from image, translated for consistency
            image: "./images/traits/Divine.png", // Placeholder image
            probability: 0.01, // Assigned probability
            order: 3,
            grades: [
                { grade: 1, description: "+25% Puissance (Mode Légende)", powerMultiplierLegend: 0.25 }
            ]
        },
        "challenge_master": {
            id: "challenge_master",
            name: "Maître des Challenges",
            image: "./images/traits/Celestial.png", // Placeholder image
            probability: 0.01,
            order: 4,
            grades: [
                { grade: 1, description: "+25% Puissance (Mode Challenge)", powerMultiplierChallenge: 0.25 }
            ]
        },
        "looter": {
            id: "looter",
            name: "Looter",
            image: "https://cdn.icon-icons.com/icons2/1465/PNG/512/558lootbox_100983.png", // Placeholder image
            probability: 0.006,
            order: 5,
            grades: [
                { grade: 1, description: "+30% Taux de Drop Items (Mode Histoire)", itemDropRateStoryBonusPercentage: 0.30 }
            ]
        },
        "golder": {
            id: "golder",
            name: "Golden", // "Golder" from image
            image: "./images/traits/Golden.png", // Placeholder image
            probability: 0.003, // Assigned probability
            order: 6,
            grades: [
                { grade: 1, description: "+40% Gemmes & Pièces (Tous modes)", gemBonusPercentageAllModes: 0.40, coinBonusPercentageAllModes: 0.40 }
            ]
        },
        "monarch": {
            id: "monarch",
            name: "Monarque",
            image: "./images/traits/Soverign.png", // Placeholder image
            probability: 0.001, 
            order: 7,
            grades: [
                { grade: 1, description: "+40% Puissance (Tous modes)", powerMultiplier: 0.40 }
            ]
        }
    };