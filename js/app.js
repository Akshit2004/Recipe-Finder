// API Constants
const API_KEY = '2513780f43144ed4af50de002121dea4'; 
const API_URL = 'https://api.spoonacular.com/recipes';

// DOM Elements
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const cuisineFilter = document.getElementById('cuisine-filter');
const dietFilter = document.getElementById('diet-filter');
const resultsContainer = document.getElementById('results-container');
const recipeDetailsContainer = document.getElementById('recipe-details');
const themeBtn = document.getElementById('theme-btn');
const loader = document.getElementById('loader');
const html = document.documentElement;

// Theme Toggle
function initTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const storedTheme = localStorage.getItem('theme');
    
    if (storedTheme) {
        html.setAttribute('data-theme', storedTheme);
    } else if (prefersDark) {
        html.setAttribute('data-theme', 'dark');
    }
}

initTheme();

themeBtn.addEventListener('click', () => {
    const currentTheme = html.getAttribute('data-theme') || 'light';
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    // Add rotation animation on click
    themeBtn.style.animation = 'none';
    setTimeout(() => {
        themeBtn.style.animation = 'rotate 0.5s ease';
    }, 5);
});

// Event Listeners
searchBtn.addEventListener('click', searchRecipes);
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        searchRecipes();
    }
});

// Search Recipes Function
async function searchRecipes() {
    const searchTerm = searchInput.value.trim();
    if (!searchTerm) return;

    const cuisine = cuisineFilter.value;
    const diet = dietFilter.value;

    try {
        showLoader();
        resultsContainer.style.opacity = '0';
        
        let url = `${API_URL}/complexSearch?apiKey=${API_KEY}&query=${searchTerm}&number=12`;
        if (cuisine) url += `&cuisine=${cuisine}`;
        if (diet) url += `&diet=${diet}`;

        const response = await fetch(url);
        const data = await response.json();

        if (data.results && data.results.length > 0) {
            displayRecipes(data.results);
        } else {
            hideLoader();
            resultsContainer.innerHTML = '<p class="no-results">No recipes found. Try a different search.</p>';
            resultsContainer.style.opacity = '1';
        }
    } catch (error) {
        console.error('Error fetching recipes:', error);
        hideLoader();
        resultsContainer.innerHTML = '<p class="error-message">Failed to fetch recipes. Please try again.</p>';
        resultsContainer.style.opacity = '1';
    }
}

// Display Recipes Function
function displayRecipes(recipes) {
    hideLoader();
    resultsContainer.innerHTML = '';
    recipeDetailsContainer.style.display = 'none';

    recipes.forEach((recipe, index) => {
        const recipeCard = document.createElement('div');
        recipeCard.className = 'recipe-card';
        recipeCard.style.animationDelay = `${index * 0.1}s`;
        recipeCard.addEventListener('click', () => getRecipeDetails(recipe.id));

        recipeCard.innerHTML = `
            <img src="${recipe.image}" alt="${recipe.title}" class="recipe-img">
            <div class="recipe-info">
                <h3 class="recipe-title">${recipe.title}</h3>
            </div>
        `;

        resultsContainer.appendChild(recipeCard);
    });

    // Fade in results container
    resultsContainer.style.opacity = '1';
    
    // Smooth scroll to results
    setTimeout(() => {
        resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 300);
}

// Get Recipe Details Function
async function getRecipeDetails(id) {
    try {
        showLoader();
        
        const url = `${API_URL}/${id}/information?apiKey=${API_KEY}`;
        const response = await fetch(url);
        const recipe = await response.json();

        displayRecipeDetails(recipe);
    } catch (error) {
        console.error('Error fetching recipe details:', error);
        hideLoader();
        recipeDetailsContainer.innerHTML = `
            <div class="error-message">
                <h3>Error loading recipe details</h3>
                <button class="back-btn" onclick="backToResults()">Back to Results</button>
            </div>
        `;
        recipeDetailsContainer.style.display = 'block';
    }
}

// Display Recipe Details Function
function displayRecipeDetails(recipe) {
    hideLoader();
    resultsContainer.style.display = 'none';
    
    // First make sure container is ready to be animated
    recipeDetailsContainer.style.opacity = '0';
    recipeDetailsContainer.style.transform = 'translateY(40px)';
    recipeDetailsContainer.style.display = 'block';
    
    const ingredients = recipe.extendedIngredients.map(ingredient => 
        `<li>${ingredient.original}</li>`
    ).join('');

    const instructions = recipe.analyzedInstructions[0]?.steps.map(step => 
        `<li>${step.step}</li>`
    ).join('') || '<li>No instructions available</li>';

    recipeDetailsContainer.innerHTML = `
        <div class="recipe-header">
            <img src="${recipe.image}" alt="${recipe.title}" class="recipe-detail-img">
            <div class="recipe-detail-info">
                <h2>${recipe.title}</h2>
                <p><strong>Ready in:</strong> ${recipe.readyInMinutes} minutes</p>
                <p><strong>Servings:</strong> ${recipe.servings}</p>
                <div class="recipe-tags">
                    ${recipe.vegetarian ? '<span class="tag">Vegetarian</span>' : ''}
                    ${recipe.vegan ? '<span class="tag">Vegan</span>' : ''}
                    ${recipe.glutenFree ? '<span class="tag">Gluten-free</span>' : ''}
                    ${recipe.dairyFree ? '<span class="tag">Dairy-free</span>' : ''}
                </div>
            </div>
        </div>
        
        <div class="recipe-ingredients">
            <h3>Ingredients</h3>
            <ul>${ingredients}</ul>
        </div>
        
        <div class="recipe-instructions">
            <h3>Instructions</h3>
            <ol>${instructions}</ol>
        </div>
        
        <button class="back-btn" onclick="backToResults()">Back to Results</button>
    `;
    
    // Trigger animation after a short delay
    setTimeout(() => {
        recipeDetailsContainer.style.opacity = '1';
        recipeDetailsContainer.style.transform = 'translateY(0)';
    }, 50);
    
    // Smooth scroll to details
    setTimeout(() => {
        recipeDetailsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 300);
}

// Back to Results Function
function backToResults() {
    // Add animation
    recipeDetailsContainer.style.opacity = '0';
    recipeDetailsContainer.style.transform = 'translateY(40px)';
    
    setTimeout(() => {
        recipeDetailsContainer.style.display = 'none';
        resultsContainer.style.display = 'grid';
        resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 300);
}

// Loader functions
function showLoader() {
    loader.style.display = 'flex';
}

function hideLoader() {
    loader.style.display = 'none';
}

// Skeleton loading for recipe cards
function createSkeletonCard() {
    return `
        <div class="recipe-card">
            <div class="recipe-img skeleton" style="height: 200px;"></div>
            <div class="recipe-info">
                <div class="skeleton" style="height: 24px; width: 80%; margin-bottom: 10px;"></div>
                <div class="skeleton" style="height: 16px; width: 60%;"></div>
            </div>
        </div>
    `;
}

// Apply animations when the page loads
window.addEventListener('DOMContentLoaded', () => {
    // Allow CSS animations to kick in naturally
    document.body.classList.add('loaded');
});

// Initial message with animation
resultsContainer.innerHTML = `
    <p class="welcome-message">
        Search for delicious recipes using the search bar above!
        <span class="accent-text">Bon Appétit!</span>
    </p>
`;
