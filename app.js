// Initialize markdown-it library for text formatting
// Enable HTML, automatic link detection, and typographic replacements
const md = window.markdownit({
    html: true,        // Allow HTML tags in source
    linkify: true,     // Convert URL-like text to links
    typographer: true  // Enable language-neutral replacement + quotes beautification
});

/**
 * BRTResearchAssistant Class
 * A chatbot interface for helping students with biology research projects
 * Integrates with Google's Gemini API for generating responses
 */
class BRTResearchAssistant {
    /**
     * Initialize the research assistant with API key, system prompt, and UI elements
     * Sets up event listeners and loads any existing conversation
     */
    constructor() {
        // API key for Google's Gemini LLM
        this.API_KEY = 'AIzaSyAQIEl0WjcwBqMayHbbQ1hhr96msm4lSIY';
        
        // Define the system prompt that sets the assistant's role and behavior
        this.systemPrompt = `### Role
You are an expert scientific researcher who has years of experience in conducting systematic literature reviews, meta-analyses of different topics, and writing research project proposals. You pride yourself on incredible accuracy and attention to detail. You always stick to the facts in the sources provided and never make up new facts.

As an expert scientific researcher, you will help students from the Nueva School's Biology Research Teams (BRT) elective write research project proposals. You must ensure their proposals follow the research proposal guidelines and do not use infeasible biological assays. You can only assist them with literature searches, novel research question ideation, methodology discovery, and proposal drafting. Do NOT generate research questions for the student. When a student is stuck, you must provide them with actionable next steps in alignment with the research proposal guidelines.

### Research Proposal Guidelines
Research Proposal Purpose: The research proposal should demonstrate why a research project is worth pursuing. It will also help you clarify and articulate your experimental goals and methodology. You must answer the following:
Relevance: Demonstrate your project’s novelty and its significance to the field or to broader aims.
Context: Demonstrate your familiarity with the previous research and theory related to your topic of interest. Have you read widely enough to feel confident in your choices regarding your question, hypotheses, and methods?
Approach: Demonstrate that you have thought carefully about procedures, equipment, experimental controls, data collection methods, and data analysis. Why is your approach the best one to take to address your research question?
Achievability: It should be possible to make significant progress on your proposed project within one school year. Your project should have the right scope for a group of 3-4 students to address in 1-2 school years (not too large or too small in scope). Be sure that we have or could acquire (within budget) the tools needed for your experimental approach. All proposals should work with either C. elegans, D. melanogaster, or BSL-1-safe pathogens.

Research Proposal Structure:
Title and author(s)
Abstract (brief summary)
Background & Significance
Research Aims
References

How to get started:
Read primary scientific literature within your subject area of interest.
If you are stuck, see the following topics: Pathogen recognition & innate immune system; serotonin signaling; microbiome/host interactions; olfactory recognition, discrimination, and learning; odor avoidance vs attraction; feeding/starvation/foraging behaviors & metabolic pathways; transgenerational epigenetic inheritance; mechanosensory behaviors/pathways; memory/learning/decision-making; sleep; environmental stressor responses (thermal, osmotic, desiccation); pheromones/ascarosides; chemical communication mechanisms; disease mechanisms/modeling; lifespan/aging; germline stem cells in testes; short and long-term memory; feeding/starvation/foraging behaviors; metabolic pathways; social behaviors; mating behaviors
Identify gaps in the current knowledge and use these templates to formulate a research question: What is the relationship between X and Y? What is the role of X in Y? W​​hat is the impact of X on Y? How does X influence Y? 
Generate hypotheses that might serve as answers to your research question. Often there is one broad/overarching hypothesis that you feel is supported by previous research, which can be broken down into more specific hypotheses that could each be addressed in an Aim. Keep in mind that there are likely other possible “answers” to your research question aside from your main hypothesis. Thinking about alternative hypotheses will help you to design better experiments.
Begin writing in the follow order: Draft Research Question, Hypotheses & Specific Aims → Outline Background & Significance section → Draft Research Aims section → Draft Background & Significance section → Draft Abstract → Solicit feedback and revise

Checklist for completion:
Does my proposal contain all the above listed sections?
Have I included all the necessary citations, both in-line and in a references section at the end? Citations are required for referencing any work or concepts that you did not personally establish.
Is my overarching hypothesis clearly stated in both my Abstract and in my Background/Significance?
Are my aims clearly stated in both my Abstract and in my Research Aims section?

### Feasible biological assays
Behavioral assays: Learning, decision-making, memory, sleep, chemotaxis, locomotion, feeding, egg-laying
Lifespan studies
Lipid content (worms only)
Drug interventions
Fly crosses (fruit flies only)
Molecular cloning/DNA manipulation
Gene expression via qPCR

### Response Instructions
- You will respond like an academic colleague. You will always be very economical with words, but you will not compromise on clarity and precision of your answers.
- You will never say you are an AI model since I already know that. Repeating it is a waste of both time and resources.

### Constraints
1. Restrictive Role Focus: You do not answer questions or perform tasks that are not related to your role and training data.
`;
        
        // Get references to DOM elements
        this.chatMessages = document.getElementById('chatMessages');
        this.userInput = document.getElementById('userInput');
        this.sendButton = document.getElementById('sendButton');
        
        // Create delete conversation button
        this.deleteButton = document.createElement('button');
        this.deleteButton.textContent = 'Delete Conversation';
        this.deleteButton.className = 'delete-button';
        
        // Initialize conversation history array
        this.history = [];
        
        // Load any existing conversation from localStorage
        this.loadConversation();
        
        // Set up event listeners and UI
        this.init();
    }

    /**
     * Initialize event listeners and set up initial UI state
     * Handles message sending, conversation deletion, and auto-saving
     */
    init() {
        // Add click listener for send button
        this.sendButton.addEventListener('click', () => this.sendMessage());
        
        // Add enter key listener for input field (excluding shift+enter)
        this.userInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Add delete button to UI and its click listener
        this.chatMessages.parentElement.insertBefore(this.deleteButton, this.chatMessages);
        this.deleteButton.addEventListener('click', () => this.deleteConversation());
    
        // Show welcome message if no existing conversation
        if (this.history.length === 0) {
            this.addMessage("Hello! I'm your BRT research project assistant...", 'bot');
        }

        // Auto-save conversation when tab becomes inactive
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.saveConversation();
            }
        });

        // Auto-save before page unload
        window.addEventListener('beforeunload', () => {
            this.saveConversation();
        });
    }

    /**
     * Save current conversation state to localStorage
     * Stores both message history and visual message elements
     */
    saveConversation() {
        const conversationState = {
            history: this.history,
            messages: Array.from(this.chatMessages.children).map(msg => ({
                text: msg.innerHTML,
                className: msg.className
            }))
        };
        localStorage.setItem('brtConversation', JSON.stringify(conversationState));
    }

    /**
     * Load saved conversation from localStorage and restore UI state
     * Recreates message elements and restores conversation history
     */
    loadConversation() {
        const saved = localStorage.getItem('brtConversation');
        if (saved) {
            const state = JSON.parse(saved);
            this.history = state.history;
            state.messages.forEach(msg => {
                const messageDiv = document.createElement('div');
                messageDiv.className = msg.className;
                messageDiv.innerHTML = msg.text;
                this.chatMessages.appendChild(messageDiv);
            });
        }
    }

    /**
     * Delete current conversation after confirmation
     * Clears localStorage, history array, and UI messages
     */
    deleteConversation() {
        if (confirm('Are you sure you want to delete this conversation?')) {
            localStorage.removeItem('brtConversation');
            this.history = [];
            this.chatMessages.innerHTML = '';
            this.addMessage("Hello! I'm your BRT research project assistant...", 'bot');
        }
    }

    /**
     * Handle sending a new message
     * Validates input, shows loading state, and generates response
     */
    async sendMessage() {
        const userMessage = this.userInput.value.trim();
        if (!userMessage) return;

        // Verify API key exists
        if (!this.API_KEY) {
            this.showError('Please add your API key in the app.js file');
            return;
        }

        // Update UI state
        this.setLoading(true);
        this.addMessage(userMessage, 'user');
        this.userInput.value = '';

        try {
            // Create message container and generate response
            const messageDiv = document.createElement('div');
            messageDiv.className = 'message bot-message';
            this.chatMessages.appendChild(messageDiv);
            
            const response = await this.generateContentStream(userMessage, messageDiv);
            this.saveConversation();
        } catch (error) {
            console.error('Error:', error);
            this.showError('An error occurred while fetching the response');
        }

        this.setLoading(false);
    }

    /**
     * Generate response using Gemini API with streaming text display
     * @param {string} prompt - User's input message
     * @param {HTMLElement} messageDiv - Container for bot's response
     * @returns {Promise<string>} The complete response text
     */
    async generateContentStream(prompt, messageDiv) {
        // Prepare request body with system prompt and user message
        const requestBody = {
            contents: [{
                role: 'user',
                parts: [{ text: this.systemPrompt }]
            }, {
                role: 'user',
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2048,
                topP: 0.8,
                topK: 40
            }
        };

        // Include conversation history if it exists
        if (this.history.length > 0) {
            requestBody.contents.splice(1, 0, ...this.history);
        }

        // Make API request
        const response = await fetch(
            'https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=' + this.API_KEY,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            }
        );

        if (!response.ok) {
            throw new Error('API request failed');
        }

        const data = await response.json();
        
        // Process and display response with word-by-word animation
        if (data.candidates && data.candidates[0].content) {
            const fullResponse = data.candidates[0].content.parts[0].text;
            
            let displayedText = '';
            const words = fullResponse.split(' ');
            
            // Animate text display word by word
            for (let i = 0; i < words.length; i++) {
                displayedText += words[i] + ' ';
                messageDiv.innerHTML = md.render(displayedText);
                this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
                await new Promise(resolve => setTimeout(resolve, 50));
            }

            this.updateHistory(prompt, fullResponse);
            return fullResponse;
        } else {
            throw new Error('Invalid response format');
        }
    }

    /**
     * Update conversation history with new messages
     * Maintains a rolling window of the last 10 message pairs
     * @param {string} userMessage - User's input message
     * @param {string} botMessage - Bot's response message
     */
    updateHistory(userMessage, botMessage) {
        this.history.push(
            { role: 'user', parts: [{ text: userMessage }] },
            { role: 'model', parts: [{ text: botMessage }] }
        );
        
        // Keep only the last 10 message pairs
        if (this.history.length > 10) {
            this.history = this.history.slice(-10);
        }
    }

    /**
     * Add a new message to the chat UI
     * @param {string} text - Message content
     * @param {string} sender - Message sender ('user' or 'bot')
     */
    addMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}-message`;
        
        // Convert markdown to HTML for display
        const htmlContent = md.render(text);
        messageDiv.innerHTML = htmlContent;
        
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    /**
     * Display an error message in the chat UI
     * @param {string} message - Error message to display
     */
    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        this.chatMessages.appendChild(errorDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    /**
     * Update UI elements to reflect loading state
     * @param {boolean} isLoading - Whether the app is in a loading state
     */
    setLoading(isLoading) {
        this.sendButton.disabled = isLoading;
        this.userInput.disabled = isLoading;
        this.sendButton.textContent = isLoading ? 'Sending...' : 'Send';
    }
}

// Initialize the assistant when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    new BRTResearchAssistant();
});
