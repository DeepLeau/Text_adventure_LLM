import { pipeline } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.1.2';

let generator; // Déclarez la variable ici pour qu'elle soit accessible dans tout le script
let history = []; // Initialisez history comme un tableau

async function initialize() {
    const loadingStatus = document.getElementById("loading-status");
    loadingStatus.textContent = "Loading model...";
    console.log("Loading model...");
    
    // Initialisez le générateur ici
    generator = await pipeline('text-generation', 'onnx-community/Llama-3.2-1B-Instruct-q4f16', {
        device: 'webgpu',
    });
    
    console.log("Model loaded");
    loadingStatus.textContent = "Model loaded";
    document.getElementById("generate-story").disabled = false; // Réactivez le bouton
}

// Fonction pour résumer un texte
async function summarizeText(text) {
    const summaryMessage = [
        { role: "system", content: "Summarize the following text into a single concise sentence. You have max 40 words." },
        { role: "user", content: text }
    ];
    
    try {
        const summaryOutput = await generator(summaryMessage, { max_new_tokens: 50 });
        const summaryText = summaryOutput[0].generated_text[2].content;
        console.log("Summary generated:", summaryText);
        return summaryText;
    } catch (error) {
        console.error("Error summarizing text:", error);
        return "Résumé indisponible.";
    }
}

// Fonction pour générer l'histoire
async function generateStory() {
    if (!generator) {
        console.error("Generator is not initialized.");
        return;
    }
    
    const statusText = document.getElementById("status-text");
    statusText.style.display = "block";
    console.log("Generating story...");

    // Message pour générer l'histoire
    const messages = [
        { role: "system", content: "You are a detective in 18th century Omaha, Nebraska. Generate a concise narrative that begins with the detective arriving at a tavern and discovering a murder mystery. The story should include key characters and a plot that leads to a suspenseful situation. Avoid dialogues and keep the narrative under 240 words." },
        { role: "user", content: "Generate a story based on the player's choices." }
    ];

    console.log("Messages prepared for generation:", messages);

    try {
        const output = await generator(messages, { max_new_tokens: 240 });
        const generatedText = output[0].generated_text[2].content;
        console.log("Generated story:", generatedText);

        // Vérifier les conditions de fin
        if (generatedText.includes("Game Over") || generatedText.includes("You found the culprit")) {
            console.log("Game over condition met.");
            document.getElementById("choices-container").innerHTML = "<p>Fin du jeu.</p>";
            return;
        }

        statusText.style.display = "none";
        document.getElementById("story").textContent = generatedText;
        console.log("Story displayed in the UI.");

        // Générer les choix
        await generateChoices(generatedText);

    } catch (error) {
        console.error("Error generating story:", error);
    }
}

// Fonction pour générer les choix
async function generateChoices(story) {
    const choicesMessage = [
        { role: "system", content: "Generate exactly three distinct actions/choices that the player can take in the current murder mystery scenario. Each action should be clear and concise, presented as 'Action 1:...', 'Action 2:...', 'Action 3:...'. Ensure that the actions are relevant to the story and do not include any additional comments or formatting." },
        { role: "user", content: story }
    ];

    document.getElementById("choices-container").textContent = "Generating Choices...";
    console.log("Generating choices...");
    
    const choicesOutput = await generator(choicesMessage, { max_new_tokens: 150 });
    const choicesText = choicesOutput[0].generated_text[2].content;
    console.log("Generated choices text:", choicesText);

    // Utiliser un regex pour extraire uniquement les actions
    const choiceRegex = /Action \d+:\s*(.*?)(?=(Action \d+:|$))/gs;
    const choices = [];
    let match;
    while ((match = choiceRegex.exec(choicesText)) !== null) {
        choices.push(match[1].trim());
    }

    // Vérifiez si nous avons exactement trois choix
    if (choices.length < 3) {
        console.warn("Less than three choices generated. Filling with default options.");
        while (choices.length < 3) {
            choices.push("Default action " + (choices.length + 1)); // Remplir avec des actions par défaut si nécessaire
        }
    }

    const choicesContainer = document.getElementById("choices-container");
    choicesContainer.innerHTML = ''; // Réinitialiser le conteneur des choix
    choices.forEach(choice => {
        const button = document.createElement("button");
        button.textContent = choice;
        button.onclick = () => handleChoice(choice);
        choicesContainer.appendChild(button);
    });
}

// Fonction pour mettre à jour l'affichage de l'historique
function updateHistoryDisplay() {
    const historyList = document.getElementById("history-list");
    historyList.innerHTML = ''; // Réinitialiser la liste de l'historique

    history.forEach(entry => {
        const listItem = document.createElement("li");
        listItem.textContent = entry.choice; // Afficher le choix du joueur
        historyList.appendChild(listItem);
    });
}

// Gestion du choix
function handleChoice(choice) {
    console.log("User chose:", choice);
    document.getElementById("choices-container").innerHTML = '';
    history.push({"choice": choice});
    console.log("history:", history);
    updateHistoryDisplay();
    generateStory(); // Générer une nouvelle histoire basée sur le choix
}

// Écouteur pour démarrer l'histoire
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("generate-story").onclick = () => {
        document.getElementById("setup-container").style.display = "none";
        document.getElementById("game-container").style.display = "flex";
        generateStory(); // Démarre directement l'histoire sans scénario
    };

    // Appelez la fonction d'initialisation
    initialize();
});