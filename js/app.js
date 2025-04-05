const API_KEY = '2513780f43144ed4af50de002121dea4';
const API_URL = 'https://api.spoonacular.com/recipes';

// DOM elements - Basic UI
const searchInput = document.getElementById('search');
const searchBtn = document.getElementById('searchBtn');
const resultsDiv = document.getElementById('results');
const recipeDetailDiv = document.getElementById('recipe-detail');
const favoritesContainer = document.getElementById('favorites-container');
const favoritesList = document.getElementById('favorites-list');
const favoritesLink = document.getElementById('favoritesLink');
const randomRecipeBtn = document.getElementById('randomRecipe');
const loadingIndicator = document.getElementById('loading');
const notificationEl = document.getElementById('notification') || createNotificationElement();
const featuredSlider = document.querySelector('.featured-slider');
const loadMoreBtn = document.getElementById('loadMore');

// DOM elements - Navigation
const navLinks = document.querySelectorAll('.nav-links a');
const sectionContainers = document.querySelectorAll('.section-container');
const themeToggle = document.getElementById('themeToggle') || createThemeToggle();

// DOM elements - Filters
const cuisineFilter = document.getElementById('cuisine');
const dietFilter = document.getElementById('diet');
const typeFilter = document.getElementById('type');
const maxTimeFilter = document.getElementById('maxTime');
const timeValueDisplay = document.getElementById('timeValue');
const resetFiltersBtn = document.getElementById('resetFilters');
const toggleFiltersBtn = document.getElementById('toggleFilters');
const filtersBody = document.querySelector('.filters-body');
const trendingTags = document.querySelectorAll('.trending-tags .tag');

// State
let favorites = JSON.parse(localStorage.getItem('favorites')) || [];
let currentRecipe = null;
let resultsOffset = 0;
let currentSearchParams = {};
let isDarkTheme = localStorage.getItem('darkTheme') === 'true';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  init();
});

// Create notification element if not present
function createNotificationElement() {
  const notification = document.createElement('div');
  notification.id = 'notification';
  notification.className = 'notification hidden';
  notification.innerHTML = `
    <i class="notification-icon"></i>
    <p class="notification-message"></p>
  `;
  document.body.appendChild(notification);
  return notification;
}

// Create theme toggle button if not present
function createThemeToggle() {
  const toggle = document.createElement('button');
  toggle.id = 'themeToggle';
  toggle.innerHTML = '<i class="fas fa-moon"></i>';
  const navRight = document.querySelector('.nav-right');
  if (navRight) {
    navRight.prepend(toggle);
  }
  return toggle;
}

// Event Listeners - Basic
searchBtn.addEventListener('click', () => searchRecipes(true));
searchInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') searchRecipes(true);
});

if (favoritesLink) {
  favoritesLink.addEventListener('click', (e) => {
    e.preventDefault();
    showSection('favorites');
    showFavorites();
  });
}

if (randomRecipeBtn) {
  randomRecipeBtn.addEventListener('click', getRandomRecipe);
}

if (loadMoreBtn) {
  loadMoreBtn.addEventListener('click', loadMoreRecipes);
}

// Event Listeners - Filters
if (cuisineFilter) cuisineFilter.addEventListener('change', () => searchRecipes(true));
if (dietFilter) dietFilter.addEventListener('change', () => searchRecipes(true));
if (typeFilter) typeFilter.addEventListener('change', () => searchRecipes(true));
if (maxTimeFilter) maxTimeFilter.addEventListener('input', updateTimeValue);
if (resetFiltersBtn) resetFiltersBtn.addEventListener('click', resetFilters);
if (toggleFiltersBtn) toggleFiltersBtn.addEventListener('click', toggleFilters);

// Trending tags event listeners
if (trendingTags) {
  trendingTags.forEach(tag => {
    tag.addEventListener('click', (e) => {
      e.preventDefault();
      const searchTerm = tag.dataset.search;
      searchInput.value = searchTerm;
      searchRecipes(true);
    });
  });
}

// Event Listeners - Navigation
navLinks.forEach(link => {
  if (link.id !== 'randomRecipe') {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const section = link.dataset.section;
      showSection(section);
    });
  }
});

// Theme toggle
if (themeToggle) {
  themeToggle.addEventListener('click', toggleTheme);
}

// Initialize the application
function init() {
  // Apply saved theme first
  setTheme();
  
  // Add WebView-specific adjustments
  handleWebViewSpecifics();
  
  // Add scroll observer for animation effects
  addScrollObserver();
  
  // Display featured and popular recipes
  fetchPopularRecipes()
    .catch(error => {
      console.error('Error initializing app:', error);
      showNotification('Failed to load recipes. Please try again.', 'error');
    });
  
  // Initialize time filter display
  if (timeValueDisplay && maxTimeFilter) {
    updateTimeValue();
  }
  
  // Hide loading initially
  hideLoading();
}

// Add this function to handle WebView specifics
function handleWebViewSpecifics() {
  // Check if running in Android WebView
  if (navigator.userAgent.includes('wv') || 
      navigator.userAgent.includes('Android') && navigator.userAgent.includes('Version')) {
    
    // Add a class to identify WebView
    document.body.classList.add('in-app-webview');
    
    // Set a CSS variable with the estimated status bar height
    // Different Android versions and devices have different status bar heights
    let statusBarHeight = 24; // Default estimate
    
    // Try to detect taller status bars on various devices
    if (window.innerWidth > 400 && window.devicePixelRatio >= 2.5) {
      statusBarHeight = 32; // Higher density screens often have taller status bars
    }
    
    document.documentElement.style.setProperty('--status-bar-height', `${statusBarHeight}px`);
    
    // Add resize listener to handle orientation changes
    window.addEventListener('resize', () => {
      // Small delay to ensure all orientation changes complete
      setTimeout(() => {
        document.body.style.height = `${window.innerHeight}px`;
      }, 300);
    });
    
    // Initial height setting
    document.body.style.height = `${window.innerHeight}px`;
  }
}

// Show loading indicator with improved animation
function showLoading() {
  if (loadingIndicator) {
    loadingIndicator.classList.remove('hidden');
    document.body.classList.add('modal-open');
    
    // Add loading text
    const spinnerContainer = loadingIndicator.querySelector('.spinner-container');
    if (!spinnerContainer) {
      // Create spinner container if it doesn't exist
      const container = document.createElement('div');
      container.className = 'spinner-container';
      container.innerHTML = `
        <div class="spinner"></div>
        <p>Finding deliciousness...</p>
      `;
      loadingIndicator.appendChild(container);
    }
  }
}

// Hide loading indicator with smooth transition
function hideLoading() {
  if (loadingIndicator) {
    // Add fade-out animation
    loadingIndicator.style.opacity = '0';
    
    // Remove after animation completes
    setTimeout(() => {
      loadingIndicator.classList.add('hidden');
      document.body.classList.remove('modal-open');
      loadingIndicator.style.opacity = '1';
    }, 300);
  }
}

// Show notification with type (success, error, info)
function showNotification(message, type = 'success') {
  if (!notificationEl) return;
  
  let icon = 'fas fa-check-circle';
  if (type === 'error') icon = 'fas fa-exclamation-circle';
  if (type === 'info') icon = 'fas fa-info-circle';
  
  notificationEl.querySelector('.notification-icon').className = `notification-icon ${icon}`;
  notificationEl.querySelector('.notification-message').textContent = message;
  
  // Add appropriate class
  notificationEl.className = `notification notification-${type}`;
  
  // Show notification with animation
  setTimeout(() => {
    notificationEl.classList.add('show');
  }, 10);
  
  // Hide after timeout
  setTimeout(() => {
    notificationEl.classList.remove('show');
    setTimeout(() => {
      notificationEl.className = 'notification hidden';
    }, 300);
  }, 3000);
}

// Show different sections
function showSection(sectionName) {
  navLinks.forEach(link => {
    if (link.dataset.section === sectionName) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
  
  sectionContainers.forEach(section => {
    if (section.id.includes(sectionName)) {
      // Fade in animation
      section.style.opacity = '0';
      section.classList.add('active-section');
      setTimeout(() => {
        section.style.opacity = '1';
      }, 10);
    } else {
      section.classList.remove('active-section');
    }
  });
  
  if (recipeDetailDiv) {
    recipeDetailDiv.classList.add('hidden');
  }
  
  // Handle special section behaviors
  if (sectionName === 'favorites') {
    showFavorites();
  }
}

// Toggle theme with smooth transition
function toggleTheme() {
  isDarkTheme = !isDarkTheme;
  localStorage.setItem('darkTheme', isDarkTheme);
  setTheme();
}

// Apply theme based on saved preference
function setTheme() {
  if (isDarkTheme) {
    document.body.classList.add('dark-theme');
    if (themeToggle) themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
  } else {
    document.body.classList.remove('dark-theme');
    if (themeToggle) themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
  }
}

// Update time value display
function updateTimeValue() {
  if (maxTimeFilter && timeValueDisplay) {
    timeValueDisplay.textContent = `${maxTimeFilter.value} min`;
  }
}

// Reset all filters
function resetFilters() {
  if (cuisineFilter) cuisineFilter.value = '';
  if (dietFilter) dietFilter.value = '';
  if (typeFilter) typeFilter.value = '';
  if (maxTimeFilter) {
    maxTimeFilter.value = 60;
    updateTimeValue();
  }
  searchRecipes(true);
}

// Toggle filters visibility on mobile
function toggleFilters() {
  if (filtersBody) {
    filtersBody.classList.toggle('show');
    
    if (toggleFiltersBtn) {
      toggleFiltersBtn.innerHTML = filtersBody.classList.contains('show') 
        ? '<i class="fas fa-chevron-up"></i>' 
        : '<i class="fas fa-sliders-h"></i>';
    }
  }
}

// Fetch popular recipes
async function fetchPopularRecipes() {
  try {
    showLoading();
    
    // Mix of recent and trending recipes for variety
    const response = await fetch(`${API_URL}/random?apiKey=${API_KEY}&number=12`);
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    
    const data = await response.json();
    displayRecipes(data.recipes);
    
    // Also display featured recipes if that element exists
    if (featuredSlider) {
      displayFeaturedRecipes(data.recipes.slice(0, 4));
    }
    
  } catch (error) {
    console.error('Error fetching popular recipes:', error);
    showNotification('Failed to load recipes. Please check your internet connection.', 'error');
    
    if (resultsDiv) {
      resultsDiv.innerHTML = `
        <div class="error-container">
          <i class="fas fa-exclamation-circle"></i>
          <p>Failed to load recipes. Please try again later.</p>
          <button class="btn btn-primary retry-btn">Retry</button>
        </div>
      `;
      
      resultsDiv.querySelector('.retry-btn').addEventListener('click', fetchPopularRecipes);
    }
  } finally {
    hideLoading();
  }
}

// Display featured recipes in a special section
function displayFeaturedRecipes(recipes) {
  if (!featuredSlider) return;
  
  featuredSlider.innerHTML = '';
  
  recipes.forEach(recipe => {
    const recipeCard = document.createElement('div');
    recipeCard.className = 'recipe-card featured';
    
    recipeCard.innerHTML = `
      <div class="card-badge">Featured</div>
      <img src="${recipe.image || 'https://via.placeholder.com/480x360?text=No+Image'}" alt="${recipe.title}">
      <div class="card-content">
        <h3>${recipe.title}</h3>
        <div class="meta-info">
          <span><i class="fas fa-clock"></i> ${recipe.readyInMinutes} min</span>
          <span><i class="fas fa-utensils"></i> ${recipe.servings} servings</span>
        </div>
        <div class="tags">
          ${recipe.vegetarian ? '<span class="tag">Vegetarian</span>' : ''}
          ${recipe.vegan ? '<span class="tag">Vegan</span>' : ''}
          ${recipe.glutenFree ? '<span class="tag">Gluten Free</span>' : ''}
        </div>
        <div class="card-buttons">
          <button class="view-btn" data-id="${recipe.id}">View Recipe</button>
          <button class="fav-btn ${favorites.some(fav => fav.id === recipe.id) ? 'active' : ''}" data-id="${recipe.id}">
            <i class="fas ${favorites.some(fav => fav.id === recipe.id) ? 'fa-heart' : 'fa-heart'}"></i>
          </button>
        </div>
      </div>
    `;
    
    // Add event listeners
    recipeCard.querySelector('.view-btn').addEventListener('click', () => {
      fetchRecipeDetails(recipe.id);
    });
    
    recipeCard.querySelector('.fav-btn').addEventListener('click', (e) => {
      toggleFavorite(recipe);
      const btn = e.currentTarget;
      btn.classList.toggle('active');
      const icon = btn.querySelector('i');
      icon.classList.toggle('fa-heart');
    });
    
    featuredSlider.appendChild(recipeCard);
  });
}

// Search recipes
async function searchRecipes(resetOffset = false) {
  const query = searchInput ? searchInput.value.trim() : '';
  const cuisine = cuisineFilter ? cuisineFilter.value : '';
  const diet = dietFilter ? dietFilter.value : '';
  const type = typeFilter ? typeFilter.value : '';
  const maxReadyTime = maxTimeFilter ? maxTimeFilter.value : '';
  
  // Don't search if all parameters are empty
  if (!query && !cuisine && !diet && !type) {
    return;
  }
  
  // Reset offset for new searches
  if (resetOffset) {
    resultsOffset = 0;
  }
  
  // Save current search parameters
  currentSearchParams = { query, cuisine, diet, type, maxReadyTime };
  
  showLoading();
  hideDetail();
  hideFavorites();
  
  try {
    let url = `${API_URL}/complexSearch?apiKey=${API_KEY}&addRecipeInformation=true&number=12&offset=${resultsOffset}`;
    
    if (query) url += `&query=${encodeURIComponent(query)}`;
    if (cuisine) url += `&cuisine=${encodeURIComponent(cuisine)}`;
    if (diet) url += `&diet=${encodeURIComponent(diet)}`;
    if (type) url += `&type=${encodeURIComponent(type)}`;
    if (maxReadyTime) url += `&maxReadyTime=${maxReadyTime}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Only clear previous results if this is a new search
    if (resetOffset && resultsDiv) {
      resultsDiv.innerHTML = '';
    }
    
    displayRecipes(data.results, resetOffset);
    
    // Update load more button
    if (loadMoreBtn) {
      if (data.totalResults > resultsOffset + data.results.length) {
        loadMoreBtn.classList.remove('hidden');
      } else {
        loadMoreBtn.classList.add('hidden');
      }
    }
    
    // Scroll to results if this is a new search
    if (resetOffset) {
      const contentSection = document.getElementById('contentSection');
      if (contentSection) {
        contentSection.scrollIntoView({ behavior: 'smooth' });
      }
    }
    
  } catch (error) {
    console.error('Error searching recipes:', error);
    showNotification('Failed to search recipes. Please try again.', 'error');
    
    if (resultsDiv) {
      resultsDiv.innerHTML = `
        <div class="error-container">
          <i class="fas fa-search"></i>
          <p>No recipes found or an error occurred. Try different search terms.</p>
          <button class="btn btn-secondary" id="clearSearch">Clear Search</button>
        </div>
      `;
      
      document.getElementById('clearSearch').addEventListener('click', () => {
        if (searchInput) searchInput.value = '';
        resetFilters();
      });
    }
  } finally {
    hideLoading();
  }
}

// Load more recipes
function loadMoreRecipes() {
  resultsOffset += 12;
  searchRecipes(false);
}

// Get random recipe
async function getRandomRecipe() {
  showLoading();
  hideDetail();
  hideFavorites();
  
  try {
    const response = await fetch(`${API_URL}/random?apiKey=${API_KEY}&number=1`);
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.recipes && data.recipes.length > 0) {
      displayRecipeDetail(data.recipes[0]);
      showNotification('Here\'s a surprise recipe for you!', 'info');
    } else {
      throw new Error('No recipe found');
    }
  } catch (error) {
    console.error('Error fetching random recipe:', error);
    showNotification('Failed to get a random recipe. Please try again.', 'error');
  } finally {
    hideLoading();
  }
}

// Display recipes with modern cards
function displayRecipes(recipes, isNewSearch = true) {
  if (!resultsDiv) return;
  
  if (!recipes || recipes.length === 0) {
    if (isNewSearch) {
      resultsDiv.innerHTML = `
        <div class="empty-results">
          <img src="https://img.icons8.com/cotton/100/000000/no-food.png"/>
          <p>No recipes found. Try different search terms.</p>
        </div>
      `;
    }
    return;
  }
  
  recipes.forEach(recipe => {
    const isFavorite = favorites.some(fav => fav.id === recipe.id);
    
    const recipeCard = document.createElement('div');
    recipeCard.className = 'recipe-card';
    recipeCard.dataset.id = recipe.id;
    
    // Enhance card with additional info
    recipeCard.innerHTML = `
      <img src="${recipe.image || 'https://via.placeholder.com/400x300?text=No+Image'}" alt="${recipe.title}">
      <div class="card-content">
        <h3>${recipe.title}</h3>
        <div class="meta-info">
          <span><i class="fas fa-clock"></i> ${recipe.readyInMinutes} min</span>
          <span><i class="fas fa-utensils"></i> ${recipe.servings} servings</span>
          ${recipe.healthScore ? `<span><i class="fas fa-heartbeat"></i> ${recipe.healthScore}%</span>` : ''}
        </div>
        <div class="tags">
          ${recipe.vegetarian ? '<span class="tag">Vegetarian</span>' : ''}
          ${recipe.vegan ? '<span class="tag">Vegan</span>' : ''}
          ${recipe.glutenFree ? '<span class="tag">Gluten Free</span>' : ''}
          ${recipe.dairyFree ? '<span class="tag">Dairy Free</span>' : ''}
        </div>
        <div class="card-buttons">
          <button class="view-btn" data-id="${recipe.id}">View Recipe</button>
          <button class="fav-btn ${isFavorite ? 'active' : ''}" data-id="${recipe.id}">
            <i class="fas ${isFavorite ? 'fa-heart' : 'fa-heart'}"></i>
          </button>
        </div>
      </div>
    `;
    
    // Add event listeners with modern effects
    recipeCard.querySelector('.view-btn').addEventListener('click', () => {
      recipeCard.classList.add('card-clicked');
      setTimeout(() => {
        fetchRecipeDetails(recipe.id);
      }, 200);
    });
    
    recipeCard.querySelector('.fav-btn').addEventListener('click', (e) => {
      toggleFavorite(recipe);
      const btn = e.currentTarget;
      btn.classList.toggle('active');
      
      // Show notification based on action
      if (btn.classList.contains('active')) {
        showNotification(`Added ${recipe.title} to favorites!`, 'success');
      } else {
        showNotification(`Removed ${recipe.title} from favorites`, 'info');
      }
    });
    
    resultsDiv.appendChild(recipeCard);
    
    // Add fade-in animation with staggered delay
    setTimeout(() => {
      recipeCard.classList.add('show');
    }, 50 * resultsDiv.children.length);
  });
}

// Fetch recipe details
async function fetchRecipeDetails(id) {
  showLoading();
  
  try {
    const response = await fetch(`${API_URL}/${id}/information?apiKey=${API_KEY}&includeNutrition=true`);
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    
    const recipe = await response.json();
    displayRecipeDetail(recipe);
    
    // Save to recent views
    saveToRecentViews(recipe);
    
  } catch (error) {
    console.error('Error fetching recipe details:', error);
    showNotification('Failed to load recipe details. Please try again.', 'error');
  } finally {
    hideLoading();
  }
}

// Save to recent views for history
function saveToRecentViews(recipe) {
  const recentViews = JSON.parse(localStorage.getItem('recentViews')) || [];
  
  // Remove if already exists
  const filtered = recentViews.filter(item => item.id !== recipe.id);
  
  // Add to beginning (most recent)
  filtered.unshift({
    id: recipe.id,
    title: recipe.title,
    image: recipe.image,
    readyInMinutes: recipe.readyInMinutes,
    servings: recipe.servings,
    timestamp: new Date().getTime()
  });
  
  // Keep only last 10
  const trimmed = filtered.slice(0, 10);
  localStorage.setItem('recentViews', JSON.stringify(trimmed));
}

// Display recipe detail with enhanced UI
function displayRecipeDetail(recipe) {
  if (!recipeDetailDiv) return;
  
  resultsDiv.classList.add('hidden');
  recipeDetailDiv.classList.remove('hidden');
  
  const isFavorite = favorites.some(fav => fav.id === recipe.id);
  
  // Save current recipe
  currentRecipe = recipe;
  
  // Create nutritional info if available
  let nutritionHTML = '';
  if (recipe.nutrition && recipe.nutrition.nutrients) {
    const mainNutrients = ['Calories', 'Fat', 'Carbohydrates', 'Protein', 'Fiber', 'Sugar'];
    nutritionHTML = `
      <div class="nutrition-info">
        <h3><i class="fas fa-chart-pie"></i> Nutritional Information</h3>
        <div class="nutrient-grid">
          ${recipe.nutrition.nutrients.filter(n => mainNutrients.includes(n.name)).map(nutrient => `
            <div class="nutrient">
              <div class="nutrient-value">${Math.round(nutrient.amount)}${nutrient.unit}</div>
              <div class="nutrient-name">${nutrient.name}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }
  
  // Create ingredients list with quantities and units
  const ingredientsHTML = recipe.extendedIngredients ? recipe.extendedIngredients.map(ingredient => `
    <li>
      <span class="ingredient-amount">${ingredient.amount} ${ingredient.unit}</span>
      <span class="ingredient-name">${ingredient.original}</span>
    </li>
  `).join('') : '';
  
  // Process instructions - either from steps or from plain text
  let instructionsHTML = '';
  if (recipe.analyzedInstructions && recipe.analyzedInstructions.length > 0 && recipe.analyzedInstructions[0].steps) {
    instructionsHTML = recipe.analyzedInstructions[0].steps.map(step => `
      <li>
        <div class="step-number">${step.number}</div>
        <div class="step-text">${step.step}</div>
      </li>
    `).join('');
  } else if (recipe.instructions) {
    // Split by periods and create steps
    const steps = recipe.instructions.split('.').filter(s => s.trim() !== '');
    instructionsHTML = steps.map((step, index) => `
      <li>
        <div class="step-number">${index + 1}</div>
        <div class="step-text">${step.trim()}.</div>
      </li>
    `).join('');
  } else {
    instructionsHTML = '<li><div class="step-number">!</div><div class="step-text">No instructions available.</div></li>';
  }
  
  // Dish types and cuisines
  const dishTypesHTML = recipe.dishTypes && recipe.dishTypes.length > 0 ? 
    recipe.dishTypes.map(type => `<span class="detail-tag">${type}</span>`).join('') : '';
    
  const cuisinesHTML = recipe.cuisines && recipe.cuisines.length > 0 ? 
    recipe.cuisines.map(cuisine => `<span class="detail-tag">${cuisine}</span>`).join('') : '';
  
  recipeDetailDiv.innerHTML = `
    <div class="detail-header">
      <h2>${recipe.title}</h2>
      <button class="back-btn"><i class="fas fa-arrow-left"></i> Back</button>
    </div>
    
    <div class="recipe-media">
      <img src="${recipe.image || 'https://via.placeholder.com/800x600?text=No+Image'}" alt="${recipe.title}">
      <div class="recipe-actions">
        <button id="detail-fav-btn" class="${isFavorite ? 'active' : ''}" title="${isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
          <i class="fas ${isFavorite ? 'fa-heart' : 'fa-heart'}"></i>
        </button>
        <button id="share-btn" title="Share recipe"><i class="fas fa-share-alt"></i></button>
        <button id="print-btn" title="Print recipe"><i class="fas fa-print"></i></button>
      </div>
    </div>
    
    <div class="recipe-meta">
      <div class="meta-item">
        <i class="fas fa-clock"></i>
        <div>
          <span class="meta-title">Prep Time</span>
          <span class="meta-value">${recipe.readyInMinutes} min</span>
        </div>
      </div>
      <div class="meta-item">
        <i class="fas fa-utensils"></i>
        <div>
          <span class="meta-title">Servings</span>
          <span class="meta-value">${recipe.servings}</span>
        </div>
      </div>
      <div class="meta-item">
        <i class="fas fa-fire"></i>
        <div>
          <span class="meta-title">Calories</span>
          <span class="meta-value">${recipe.nutrition?.nutrients?.find(n => n.name === 'Calories')?.amount.toFixed(0) || 'N/A'}</span>
        </div>
      </div>
      <div class="meta-item">
        <i class="fas fa-heart-pulse"></i>
        <div>
          <span class="meta-title">Health Score</span>
          <span class="meta-value">${recipe.healthScore}/100</span>
        </div>
      </div>
    </div>
    
    ${dishTypesHTML || cuisinesHTML ? `
      <div class="recipe-tags">
        ${dishTypesHTML ? `<div class="tag-group"><span class="tag-title">Dish Type:</span>${dishTypesHTML}</div>` : ''}
        ${cuisinesHTML ? `<div class="tag-group"><span class="tag-title">Cuisine:</span>${cuisinesHTML}</div>` : ''}
      </div>
    ` : ''}
    
    ${recipe.summary ? `
      <div class="recipe-summary">
        <h3><i class="fas fa-info-circle"></i> About this recipe</h3>
        <p>${recipe.summary.replace(/<\/?[^>]+(>|$)/g, "")}</p>
      </div>
    ` : ''}
    
    <div class="recipe-content">
      <div class="recipe-ingredients">
        <h3><i class="fas fa-shopping-basket"></i> Ingredients</h3>
        <ul class="ingredients-list">
          ${ingredientsHTML}
        </ul>
      </div>
      
      <div class="recipe-instructions">
        <h3><i class="fas fa-list-ol"></i> Instructions</h3>
        <ol class="instructions-list">
          ${instructionsHTML}
        </ol>
      </div>
    </div>
    
    ${nutritionHTML}
    
    <div class="cooking-cta">
      <button id="start-cooking"><i class="fas fa-chef-hat"></i> Start Cooking Mode</button>
    </div>
  `;
  
  // Back button event
  recipeDetailDiv.querySelector('.back-btn').addEventListener('click', hideDetail);
  
  // Favorite button event with animation
  const favBtn = recipeDetailDiv.querySelector('#detail-fav-btn');
  favBtn.addEventListener('click', () => {
    toggleFavorite(recipe);
    favBtn.classList.toggle('active');
    if (favBtn.classList.contains('active')) {
      showNotification(`Added ${recipe.title} to favorites!`, 'success');
    } else {
      showNotification(`Removed ${recipe.title} from favorites`, 'info');
    }
  });
  
  // Share button
  const shareBtn = recipeDetailDiv.querySelector('#share-btn');
  if (shareBtn) {
    shareBtn.addEventListener('click', () => shareRecipe(recipe));
  }
  
  // Print button
  const printBtn = recipeDetailDiv.querySelector('#print-btn');
  if (printBtn) {
    printBtn.addEventListener('click', () => printRecipe(recipe));
  }
  
  // Scroll to top of detail view
  recipeDetailDiv.scrollIntoView({ behavior: 'smooth' });
}

// Share recipe functionality
function shareRecipe(recipe) {
  if (navigator.share) {
    navigator.share({
      title: recipe.title,
      text: `Check out this ${recipe.title} recipe!`,
      url: window.location.href,
    }).then(() => {
      showNotification('Recipe shared!', 'success');
    }).catch(console.error);
  } else {
    // Fallback for browsers that don't support Web Share API
    const shareURL = encodeURIComponent(window.location.href);
    const shareText = encodeURIComponent(`Check out this ${recipe.title} recipe!`);
    
    const shareModal = document.createElement('div');
    shareModal.className = 'share-modal';
    shareModal.innerHTML = `
      <div class="share-content">
        <h3>Share this recipe</h3>
        <div class="share-buttons">
          <a href="https://twitter.com/intent/tweet?text=${shareText}&url=${shareURL}" target="_blank" class="share-btn twitter">
            <i class="fab fa-twitter"></i> Twitter
          </a>
          <a href="https://www.facebook.com/sharer/sharer.php?u=${shareURL}" target="_blank" class="share-btn facebook">
            <i class="fab fa-facebook"></i> Facebook
          </a>
          <a href="https://pinterest.com/pin/create/button/?url=${shareURL}&media=${encodeURIComponent(recipe.image)}&description=${shareText}" target="_blank" class="share-btn pinterest">
            <i class="fab fa-pinterest"></i> Pinterest
          </a>
          <a href="mailto:?subject=${encodeURIComponent(recipe.title)}&body=${shareText}%20${shareURL}" class="share-btn email">
            <i class="fas fa-envelope"></i> Email
          </a>
        </div>
        <button class="btn btn-secondary close-share">Close</button>
      </div>
    `;
    
    document.body.appendChild(shareModal);
    setTimeout(() => shareModal.classList.add('show'), 10);
    
    shareModal.querySelector('.close-share').addEventListener('click', () => {
      shareModal.classList.remove('show');
      setTimeout(() => shareModal.remove(), 300);
    });
  }
}

// Print recipe functionality
function printRecipe(recipe) {
  const printWindow = window.open('', '_blank');
  
  // Create optimized print version
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${recipe.title} - Culinary Quest</title>
      <style>
        body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #ff3b3b; }
        img { max-width: 100%; height: auto; margin: 20px 0; }
        .recipe-meta { display: flex; flex-wrap: wrap; gap: 20px; margin: 20px 0; }
        .meta-item { display: flex; align-items: center; }
        .ingredients-list, .instructions-list { padding-left: 20px; }
        .ingredients-list li { margin-bottom: 8px; }
        .instructions-list li { margin-bottom: 15px; }
        @media print {
          a { text-decoration: none; color: #333; }
          button { display: none; }
        }
      </style>
    </head>
    <body>
      <h1>${recipe.title}</h1>
      <img src="${recipe.image}" alt="${recipe.title}" />
      
      <div class="recipe-meta">
        <div class="meta-item">
          <strong>Prep Time:</strong> ${recipe.readyInMinutes} minutes
        </div>
        <div class="meta-item">
          <strong>Servings:</strong> ${recipe.servings}
        </div>
      </div>
      
      <h2>Ingredients</h2>
      <ul class="ingredients-list">
        ${recipe.extendedIngredients.map(ingredient => `
          <li>${ingredient.original}</li>
        `).join('')}
      </ul>
      
      <h2>Instructions</h2>
      <ol class="instructions-list">
        ${recipe.analyzedInstructions && recipe.analyzedInstructions[0]?.steps ? 
          recipe.analyzedInstructions[0].steps.map(step => `
            <li>${step.step}</li>
          `).join('') : 
          recipe.instructions.split('.').filter(s => s.trim() !== '').map(step => `
            <li>${step.trim()}.</li>
          `).join('')
        }
      </ol>
      
      <div class="footer">
        <p>Printed from Culinary Quest</p>
      </div>
      
      <script>
        window.onload = function() {
          window.print();
        }
      </script>
    </body>
    </html>
  `);
  
  printWindow.document.close();
}

// Toggle favorite
function toggleFavorite(recipe) {
  const index = favorites.findIndex(fav => fav.id === recipe.id);
  
  if (index === -1) {
    // Add to favorites
    favorites.push({
      id: recipe.id,
      title: recipe.title,
      image: recipe.image,
      readyInMinutes: recipe.readyInMinutes,
      servings: recipe.servings,
      healthScore: recipe.healthScore,
      vegetarian: recipe.vegetarian,
      vegan: recipe.vegan,
      glutenFree: recipe.glutenFree,
      dairyFree: recipe.dairyFree,
      timestamp: new Date().getTime()
    });
  } else {
    // Remove from favorites
    favorites.splice(index, 1);
  }
  
  // Save to local storage
  localStorage.setItem('favorites', JSON.stringify(favorites));
  
  // Update favorites display if visible
  if (!favoritesContainer.classList.contains('hidden')) {
    showFavorites();
  }
}

// Show favorites
function showFavorites() {
  hideDetail();
  
  if (!favoritesList) return;
  
  favoritesList.innerHTML = '';
  
  if (favorites.length === 0) {
    favoritesList.innerHTML = `
      <div class="empty-favorites">
        <img src="https://img.icons8.com/cotton/100/000000/hearts--v1.png"/>
        <p>You have no favorite recipes yet.</p>
        <button class="btn btn-primary" id="exploreRecipes">Explore Recipes</button>
      </div>
    `;
    
    document.getElementById('exploreRecipes')?.addEventListener('click', () => {
      showSection('home');
    });
    
    return;
  }
  
  // Sort favorites by timestamp (newest first)
  const sortedFavorites = [...favorites].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  
  sortedFavorites.forEach(recipe => {
    const recipeCard = document.createElement('div');
    recipeCard.className = 'recipe-card';
    
    recipeCard.innerHTML = `
      <img src="${recipe.image || 'https://via.placeholder.com/400x300?text=No+Image'}" alt="${recipe.title}">
      <div class="card-content">
        <h3>${recipe.title}</h3>
        <div class="meta-info">
          <span><i class="fas fa-clock"></i> ${recipe.readyInMinutes} min</span>
          <span><i class="fas fa-utensils"></i> ${recipe.servings} servings</span>
          ${recipe.healthScore ? `<span><i class="fas fa-heartbeat"></i> ${recipe.healthScore}%</span>` : ''}
        </div>
        <div class="tags">
          ${recipe.vegetarian ? '<span class="tag">Vegetarian</span>' : ''}
          ${recipe.vegan ? '<span class="tag">Vegan</span>' : ''}
          ${recipe.glutenFree ? '<span class="tag">Gluten Free</span>' : ''}
          ${recipe.dairyFree ? '<span class="tag">Dairy Free</span>' : ''}
        </div>
        <div class="card-buttons">
          <button class="view-btn" data-id="${recipe.id}">View Recipe</button>
          <button class="fav-btn active" data-id="${recipe.id}">
            <i class="fas fa-heart"></i>
          </button>
        </div>
      </div>
    `;
    
    recipeCard.querySelector('.view-btn').addEventListener('click', () => {
      fetchRecipeDetails(recipe.id);
    });
    
    recipeCard.querySelector('.fav-btn').addEventListener('click', (e) => {
      toggleFavorite(recipe);
      recipeCard.classList.add('fade-out');
      
      setTimeout(() => {
        // Check if this was the last favorite removed
        if (favorites.length === 0) {
          showFavorites(); // Refresh to show empty state
        } else {
          recipeCard.remove();
        }
      }, 300);
    });
    
    favoritesList.appendChild(recipeCard);
    
    // Add staggered fade-in animation
    setTimeout(() => {
      recipeCard.classList.add('show');
    }, 50 * favoritesList.children.length);
  });
}

// Hide detail
function hideDetail() {
  if (recipeDetailDiv) {
    recipeDetailDiv.classList.add('hidden');
  }
  if (resultsDiv) {
    resultsDiv.classList.remove('hidden');
  }
}

// Hide favorites
function hideFavorites() {
  if (favoritesContainer) {
    favoritesContainer.classList.add('hidden');
  }
}

// Add scroll observer for animation effects
function addScrollObserver() {
  if (!('IntersectionObserver' in window)) return;
  
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('scrolled-into-view');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });
  
  // Observe recipe cards, sections, etc.
  document.querySelectorAll('.recipe-card, .section-title, .recipe-meta, .recipe-content > div').forEach(el => {
    observer.observe(el);
  });
}

// Initialize on page load
init();