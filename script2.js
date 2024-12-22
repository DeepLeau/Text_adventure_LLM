import { pipeline } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.1.2';

let generator; 
let history = []; 
let retriever; 

async function initialize() {
    const loadingStatus = document.getElementById("loading-status");
    loadingStatus.textContent = "Loading model and retriever...";
    console.log("Loading model and retriever...");

    generator = await pipeline('text-generation', 'onnx-community/Llama-3.2-1B-Instruct-q4f16', {
        device: 'webgpu',
    });

    // Initializing RAG
    retriever = async (query) => {
        const response = await fetch('/documents.json'); 
        const documents = await response.json();
        return documents.filter(doc => doc.content.includes(query));
    };

    console.log("Model and retriever loaded");
    loadingStatus.textContent = "Model and retriever loaded";
    document.getElementById("generate-story").disabled = false; 
}

async function generateStory() {
    if (!generator || !retriever) {
        console.error("Generator or retriever is not initialized.");
        return;
    }

    const statusText = document.getElementById("status-text");
    statusText.style.display = "block";
    console.log("Generating story...");

    const historyMessages = history.map(entry => `Choix: ${entry.choice}`).join('\n');

    // Request to retrieve additional information using RAG
    const query = history.length > 0 ? history[history.length - 1].choice : "Governor murder Nebraska 18th century";
    const retrievedDocs = await retriever(query);

    if (!retrievedDocs.length) {
        console.warn("No documents retrieved. Proceeding without additional context.");
    }

    const retrievedText = retrievedDocs.map((doc, index) => `Document ${index + 1}: ${doc.content}`).join('\n\n');
    console.log("Retrieved context formatted:", retrievedText);

    const messages = [
        { role: "system", content: "You are a detective in 18th century Omaha, Nebraska. You just discovered that the governor was killed in strange circumstances. Use historical data and retrieved documents to enhance the story. You are responsible for creating an immersive narrative based on the player's choices and the retrieved context. Ensure the retrieved content is integrated seamlessly." },
        { role: "user", content: `Choices history:\n${historyMessages}\n\nRetrieved context:\n${retrievedText}\n\nGenerate a story based on the above.` }
    ];

    try {
        const output = await generator(messages, { max_new_tokens: 240 });
        const generatedText = output[0].generated_text[2].content;
        console.log("Generated story:", generatedText);

        if (generatedText.includes("Game Over") || generatedText.includes("You have found the murderer")) {
            console.log("Game over condition met.");
            document.getElementById("choices-container").innerHTML = "<p>Game over. You have solved the mystery!</p>";
            return;
        }

        statusText.style.display = "none";
        document.getElementById("story").textContent = generatedText;
        console.log("Story displayed in the UI.");

        await generateChoices(generatedText);

    } catch (error) {
        console.error("Error generating story:", error);
    }
}


// Generate 3 choices
async function generateChoices(story) {
    const choicesMessage = [
        { role: "system", content: "Generate exactly three distinct actions/choices that the player can take in the current story. Each action should be clear and concise, presented on a separate line without any additional comments, formatting, or symbols. Use this format: Action 1:... Action 2:... Action 3:..." },
        { role: "user", content: story }
    ];

    document.getElementById("choices-container").textContent = "Generating Choices...";
    console.log("Generating choices...");
    const choicesOutput = await generator(choicesMessage, { max_new_tokens: 150 });
    const choicesText = choicesOutput[0].generated_text[2].content;
    console.log(choicesText);

    const choiceRegex = /Action \d+:\s*(.*?)(?=(Action \d+:|$))/gs;
    const choices = [];
    let match;
    while ((match = choiceRegex.exec(choicesText)) !== null) {
        choices.push(match[1].trim());
    }

    const choicesContainer = document.getElementById("choices-container");
    choicesContainer.innerHTML = '';
    choices.forEach(choice => {
        const button = document.createElement("button");
        button.textContent = choice;
        button.onclick = () => handleChoice(choice);
        choicesContainer.appendChild(button);
    });
}

// Update History
function updateHistoryDisplay() {
    const historyList = document.getElementById("history-list");
    historyList.innerHTML = ''; 

    history.forEach(entry => {
        const listItem = document.createElement("li");
        listItem.textContent = entry.choice; 
        historyList.appendChild(listItem);
    });
}

// Manage choices
function handleChoice(choice) {
    console.log("User chose:", choice);
    document.getElementById("choices-container").innerHTML = '';
    history.push({ "choice": choice });
    console.log("history:", history);
    updateHistoryDisplay();
    generateStory(); 
}

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("generate-story").onclick = () => {
        document.getElementById("setup-container").style.display = "none";
        document.getElementById("game-container").style.display = "flex";
        generateStory(); 
    };

    initialize();
});
