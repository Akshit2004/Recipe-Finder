const API_BASE_URL = 'https://www.themealdb.com/api/json/v1/1';

const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const recipeContainer = document.getElementById('recipe-container');
const savedRecipesContainer = document.getElementById('saved-recipes-container');
const loadingElement = document.getElementById('loading');
const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
const navLinks = document.querySelector('.nav-links');
const themeSwitch = document.getElementById('theme-switch');
const quickSearchTags = document.querySelectorAll('.quick-search-tag');
const featuredCarousel = document.getElementById('featured-recipes-carousel');
const categoriesContainer = document.getElementById('categories-container');
const autocompleteContainer = document.getElementById('autocomplete-container');

const gridViewBtn = document.querySelector('.grid-view-btn');
const listViewBtn = document.querySelector('.list-view-btn');

const state = {
    currentView: 'grid',
    savedRecipes: JSON.parse(localStorage.getItem('savedRecipes')) || {},
    darkMode: localStorage.getItem('darkMode') === 'true',
    currentSearch: ''
};

function initializeApp() {
    if (state.darkMode) {
        document.documentElement.setAttribute('data-theme', 'dark');
        themeSwitch.checked = true;
    }
    loadFeaturedRecipes();
    loadCategories();
    updateSavedRecipesView();
    updateSavedRecipeCount();
    populateFooterCategories();
    setupEventListeners();
    setupAutocomplete();
}

function setupEventListeners() {
    searchBtn.addEventListener('click', handleSearch);
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            handleSearch();
        }
    });
    quickSearchTags.forEach(tag => {
        tag.addEventListener('click', function(e) {
            e.preventDefault();
            const searchTerm = this.dataset.search;
            searchInput.value = searchTerm;
            handleSearch();
        });
    });
    mobileMenuBtn.addEventListener('click', function() {
        this.classList.toggle('active');
        navLinks.classList.toggle('active');
        document.body.classList.toggle('menu-open');
    });
    document.addEventListener('click', function(e) {
        if (navLinks.classList.contains('active') && 
            !e.target.closest('.nav-links') && 
            !e.target.closest('.mobile-menu-btn')) {
            mobileMenuBtn.classList.remove('active');
            navLinks.classList.remove('active');
            document.body.classList.remove('menu-open');
        }
    });
    const carouselTrack = document.querySelector('.carousel-track');
    if (carouselTrack) {
        carouselTrack.addEventListener('touchstart', function(e) {
            touchStartX = e.changedTouches[0].screenX;
        }, {passive: true});
        carouselTrack.addEventListener('touchend', function(e) {
            touchEndX = e.changedTouches[0].screenX;
            handleSwipe();
        }, {passive: true});
    }
    const style = document.createElement('style');
    style.textContent = `
        body.menu-open {
            overflow: hidden;
            position: fixed;
            width: 100%;
        }
    `;
    document.head.appendChild(style);
    themeSwitch.addEventListener('change', toggleDarkMode);
    gridViewBtn.addEventListener('click', () => setView('grid'));
    listViewBtn.addEventListener('click', () => setView('list'));
    document.querySelector('.prev-btn').addEventListener('click', () => moveCarousel('prev'));
    document.querySelector('.next-btn').addEventListener('click', () => moveCarousel('next'));
    const newsletterForm = document.getElementById('newsletter-form');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const email = this.querySelector('input[type="email"]').value;
            alert(`Thank you! ${email} has been subscribed to our newsletter.`);
            this.reset();
        });
    }
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            if (this.getAttribute('href') !== '#') {
                e.preventDefault();
                if (navLinks.classList.contains('active')) {
                    mobileMenuBtn.classList.remove('active');
                    navLinks.classList.remove('active');
                }
                if (this.getAttribute('href') === '#saved') {
                    document.getElementById('saved').classList.remove('hidden');
                }
                document.querySelector(this.getAttribute('href')).scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });
    window.addEventListener('scroll', handleScrollAnimations);
    const feedbackForm = document.getElementById('feedback-form');
    const ratingIcons = document.querySelectorAll('.rating-icons i');
    const satisfactionRatingField = document.getElementById('satisfaction-rating');
    if (feedbackForm) {
        feedbackForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const formData = new FormData(this);
            const submitBtn = this.querySelector('button[type="submit"]');
            const originalBtnText = submitBtn.textContent;
            submitBtn.textContent = "Sending...";
            submitBtn.disabled = true;
            fetch(this.action, {
                method: 'POST',
                body: formData,
                headers: {
                    'Accept': 'application/json'
                }
            })
            .then(response => {
                if (response.ok) {
                    feedbackForm.reset();
                    ratingIcons.forEach(icon => {
                        icon.classList.remove('selected');
                    });
                    if (satisfactionRatingField) {
                        satisfactionRatingField.value = '';
                    }
                    showToast('Thank you for your feedback!');
                } else {
                    throw new Error('Form submission failed');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showToast('Something went wrong. Please try again later.');
            })
            .finally(() => {
                submitBtn.textContent = originalBtnText;
                submitBtn.disabled = false;
            });
        });
    }
    if (ratingIcons) {
        ratingIcons.forEach(icon => {
            icon.addEventListener('click', function() {
                ratingIcons.forEach(i => i.classList.remove('selected'));
                const rating = parseInt(this.dataset.rating);
                ratingIcons.forEach(i => {
                    if (parseInt(i.dataset.rating) <= rating) {
                        i.classList.add('selected');
                    }
                });
                if (satisfactionRatingField) {
                    satisfactionRatingField.value = rating;
                }
            });
        });
    }
    searchInput.addEventListener('keydown', handleAutocompleteKeydown);
    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !autocompleteContainer.contains(e.target)) {
            hideAutocomplete();
        }
    });
}

function debounce(func, delay) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

function setupAutocomplete() {
    searchInput.addEventListener('input', debounce(function() {
        const query = this.value.trim();
        if (query.length < 2) {
            hideAutocomplete();
            return;
        }
        fetchAutocompleteSuggestions(query);
    }, 300));
}

async function fetchAutocompleteSuggestions(query) {
    try {
        const response = await fetch(`${API_BASE_URL}/search.php?f=${query.charAt(0)}`);
        const data = await response.json();
        if (!data.meals) {
            showNoSuggestions();
            return;
        }
        const filteredMeals = data.meals.filter(meal => 
            meal.strMeal.toLowerCase().includes(query.toLowerCase())
        ).slice(0, 6);
        if (filteredMeals.length === 0) {
            showNoSuggestions();
            return;
        }
        displayAutocompleteSuggestions(filteredMeals);
    } catch (error) {
        console.error('Error fetching autocomplete suggestions:', error);
        hideAutocomplete();
    }
}

function displayAutocompleteSuggestions(meals) {
    autocompleteContainer.innerHTML = '';
    meals.forEach((meal, index) => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        item.setAttribute('data-index', index);
        item.setAttribute('data-id', meal.idMeal);
        item.innerHTML = `
            <i class="fas fa-utensils suggestion-icon"></i>
            ${meal.strMeal}
            <span class="suggestion-type">${meal.strCategory} | ${meal.strArea}</span>
        `;
        item.addEventListener('click', function() {
            selectAutocompleteSuggestion(meal.strMeal, meal.idMeal);
        });
        autocompleteContainer.appendChild(item);
    });
    showAutocomplete();
}

function showNoSuggestions() {
    autocompleteContainer.innerHTML = `
        <div class="no-suggestions">
            No matching recipes found
        </div>
    `;
    showAutocomplete();
}

function showAutocomplete() {
    autocompleteContainer.style.display = 'block';
}

function hideAutocomplete() {
    autocompleteContainer.style.display = 'none';
}

function selectAutocompleteSuggestion(mealName, mealId) {
    searchInput.value = mealName;
    hideAutocomplete();
    handleSearch();
}

function handleAutocompleteKeydown(e) {
    const items = autocompleteContainer.querySelectorAll('.autocomplete-item');
    if (!items.length || autocompleteContainer.style.display === 'none') return;
    const selectedItem = autocompleteContainer.querySelector('.autocomplete-item.selected');
    let selectedIndex = -1;
    if (selectedItem) {
        selectedIndex = parseInt(selectedItem.getAttribute('data-index'));
    }
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (selectedIndex < items.length - 1) {
            if (selectedItem) selectedItem.classList.remove('selected');
            items[selectedIndex + 1].classList.add('selected');
            ensureVisible(items[selectedIndex + 1]);
        }
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (selectedIndex > 0) {
            if (selectedItem) selectedItem.classList.remove('selected');
            items[selectedIndex - 1].classList.add('selected');
            ensureVisible(items[selectedIndex - 1]);
        }
    } else if (e.key === 'Enter') {
        if (selectedItem) {
            e.preventDefault();
            const mealName = selectedItem.textContent.trim().split('\n')[0].trim();
            const mealId = selectedItem.getAttribute('data-id');
            selectAutocompleteSuggestion(mealName, mealId);
        }
    } else if (e.key === 'Escape') {
        hideAutocomplete();
    }
}

function ensureVisible(element) {
    const container = autocompleteContainer;
    const containerTop = container.scrollTop;
    const containerBottom = containerTop + container.clientHeight;
    const elementTop = element.offsetTop;
    const elementBottom = elementTop + element.clientHeight;
    if (elementTop < containerTop) {
        container.scrollTop = elementTop;
    } else if (elementBottom > containerBottom) {
        container.scrollTop = elementBottom - container.clientHeight;
    }
}

async function handleSearch() {
    const query = searchInput.value.trim();
    if (query.length === 0) {
        alert('Please enter a search term');
        return;
    }
    state.currentSearch = query;
    showLoading();
    clearResults();
    hideAutocomplete();
    if (window.innerWidth < 768) {
        document.activeElement.blur();
    }
    try {
        let recipes = await fetchRecipesByName(query);
        if (!recipes || recipes.length === 0) {
            recipes = await fetchRecipesByFirstLetter(query.charAt(0));
        }
        displayRecipes(recipes);
        document.getElementById('search-results').scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
        console.error('Error fetching recipes:', error);
        recipeContainer.innerHTML = `
            <div class="error-message">
                <i class="fas fa-exclamation-circle"></i>
                <p>Failed to load recipes. Please try again later.</p>
                <p class="error-details">Error: ${error.message}</p>
            </div>
        `;
    } finally {
        hideLoading();
    }
}

async function fetchRecipesByName(query) {
    try {
        const response = await fetch(`${API_BASE_URL}/search.php?s=${encodeURIComponent(query)}`);
        if (!response.ok) {
            throw new Error(`API returned status: ${response.status}`);
        }
        const data = await response.json();
        return data.meals || [];
    } catch (error) {
        console.error('Error in fetchRecipesByName:', error);
        throw error;
    }
}

async function fetchRecipesByFirstLetter(letter) {
    try {
        const response = await fetch(`${API_BASE_URL}/search.php?f=${encodeURIComponent(letter)}`);
        if (!response.ok) {
            throw new Error(`API returned status: ${response.status}`);
        }
        const data = await response.json();
        return data.meals || [];
    } catch (error) {
        console.error('Error in fetchRecipesByFirstLetter:', error);
        return [];
    }
}

async function fetchRecipes(query) {
    try {
        const recipes = await fetchRecipesByName(query);
        return recipes;
    } catch (error) {
        console.error('Error in fetchRecipes:', error);
        return [];
    }
}

function displayRecipes(recipes) {
    if (!recipes || recipes.length === 0) {
        recipeContainer.innerHTML = `
            <div class="no-results">
                <i class="fas fa-search"></i>
                <p>No recipes found for "${state.currentSearch}". Try a different search term.</p>
                <button class="primary-btn" onclick="resetSearch()">Clear Search</button>
            </div>
        `;
        return;
    }
    recipes.forEach(recipe => {
        const recipeCard = document.createElement('div');
        recipeCard.className = 'recipe-card';
        const isSaved = state.savedRecipes[recipe.idMeal] !== undefined;
        let ingredientCount = 0;
        for (let i = 1; i <= 20; i++) {
            if (recipe[`strIngredient${i}`] && recipe[`strIngredient${i}`].trim() !== '') {
                ingredientCount++;
            }
        }
        let tagsArray = [];
        if (recipe.strTags) {
            tagsArray = recipe.strTags.split(',').slice(0, 3);
        } else {
            tagsArray = [recipe.strCategory];
        }
        const bookmarkClass = isSaved ? 'active' : '';
        const bookmarkIcon = isSaved ? 'fas' : 'far';
        recipeCard.innerHTML = `
            <button class="bookmark-btn ${bookmarkClass}" data-id="${recipe.idMeal}" aria-label="Save recipe">
                <i class="${bookmarkIcon} fa-bookmark"></i>
            </button>
            <div class="recipe-image">
                <img src="${recipe.strMealThumb}" alt="${recipe.strMeal}" loading="lazy">
            </div>
            <div class="recipe-info">
                <h3 class="recipe-title">${recipe.strMeal}</h3>
                <div class="recipe-details">
                    <span><i class="fas fa-globe"></i> ${recipe.strArea || 'Various'}</span>
                    <span><i class="fas fa-list"></i> ${ingredientCount} ingredients</span>
                </div>
                <div class="recipe-tags">
                    ${tagsArray.map(tag => `<span class="tag">${tag.trim()}</span>`).join('')}
                </div>
                <div class="recipe-actions">
                    <a href="#" class="view-recipe primary" data-id="${recipe.idMeal}">View Recipe</a>
                </div>
            </div>
        `;
        recipeContainer.appendChild(recipeCard);
        const bookmarkBtn = recipeCard.querySelector('.bookmark-btn');
        const viewRecipeBtn = recipeCard.querySelector('.view-recipe');
        bookmarkBtn.addEventListener('click', () => toggleBookmark(recipe.idMeal, bookmarkBtn, recipe));
        viewRecipeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showRecipeDetails(recipe.idMeal);
        });
        setTimeout(() => {
            recipeCard.classList.add('animate');
        }, 100);
    });
}

function toggleBookmark(id, button, recipe) {
    if (state.savedRecipes[id]) {
        delete state.savedRecipes[id];
        button.classList.remove('active');
        button.querySelector('i').classList.replace('fas', 'far');
        showToast('Recipe removed from your saved collection');
    } else {
        state.savedRecipes[id] = {
            id: recipe.idMeal,
            name: recipe.strMeal,
            image: recipe.strMealThumb,
            area: recipe.strArea || 'Various',
            category: recipe.strCategory,
            dateAdded: new Date().toISOString()
        };
        button.classList.add('active');
        button.querySelector('i').classList.replace('far', 'fas');
        showToast('Recipe saved to your collection!');
    }
    localStorage.setItem('savedRecipes', JSON.stringify(state.savedRecipes));
    updateSavedRecipeCount();
    if (!document.getElementById('saved').classList.contains('hidden')) {
        updateSavedRecipesView();
    }
}

function showToast(message) {
    let toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container';
        document.body.appendChild(toastContainer);
    }
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('show');
    }, 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 3000);
}

function updateSavedRecipeCount() {
    const savedCount = Object.keys(state.savedRecipes).length;
    const savedLink = document.getElementById('saved-link');
    if (savedCount > 0) {
        if (!savedLink.querySelector('.badge')) {
            const badge = document.createElement('span');
            badge.className = 'badge';
            savedLink.appendChild(badge);
        }
        savedLink.querySelector('.badge').textContent = savedCount;
    } else {
        const badge = savedLink.querySelector('.badge');
        if (badge) {
            badge.remove();
        }
    }
}

function updateSavedRecipesView() {
    const container = document.getElementById('saved-recipes-container');
    container.innerHTML = '';
    const savedRecipes = Object.values(state.savedRecipes);
    if (savedRecipes.length === 0) {
        container.innerHTML = `
            <p class="no-saved-message">You haven't saved any recipes yet. Click the bookmark icon on any recipe to save it for later.</p>
        `;
        return;
    }
    savedRecipes.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
    savedRecipes.forEach(recipe => {
        const recipeCard = document.createElement('div');
        recipeCard.className = 'recipe-card';
        recipeCard.innerHTML = `
            <button class="bookmark-btn active" data-id="${recipe.id}" aria-label="Remove recipe">
                <i class="fas fa-bookmark"></i>
            </button>
            <div class="recipe-image">
                <img src="${recipe.image}" alt="${recipe.name}" loading="lazy">
            </div>
            <div class="recipe-info">
                <h3 class="recipe-title">${recipe.name}</h3>
                <div class="recipe-details">
                    <span><i class="fas fa-globe"></i> ${recipe.area}</span>
                    <span><i class="fas fa-tag"></i> ${recipe.category}</span>
                </div>
                <div class="recipe-actions">
                    <a href="#" class="view-recipe primary" data-id="${recipe.id}">View Recipe</a>
                    <button class="view-recipe secondary remove-btn" data-id="${recipe.id}">Remove</button>
                </div>
            </div>
        `;
        container.appendChild(recipeCard);
        const bookmarkBtn = recipeCard.querySelector('.bookmark-btn');
        const viewBtn = recipeCard.querySelector('.view-recipe.primary');
        const removeBtn = recipeCard.querySelector('.remove-btn');
        bookmarkBtn.addEventListener('click', () => {
            toggleBookmark(recipe.id, bookmarkBtn);
            recipeCard.classList.add('removing');
            setTimeout(() => {
                recipeCard.remove();
                if (container.children.length === 0) {
                    updateSavedRecipesView();
                }
            }, 300);
        });
        viewBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showRecipeDetails(recipe.id);
        });
        removeBtn.addEventListener('click', () => {
            delete state.savedRecipes[recipe.id];
            localStorage.setItem('savedRecipes', JSON.stringify(state.savedRecipes));
            updateSavedRecipeCount();
            recipeCard.classList.add('removing');
            setTimeout(() => {
                recipeCard.remove();
                if (container.children.length === 0) {
                    updateSavedRecipesView();
                }
                showToast('Recipe removed from your saved collection');
            }, 300);
        });
    });
}

async function loadFeaturedRecipes() {
    try {
        const response = await fetch(`${API_BASE_URL}/randomselection.php`);
        const data = await response.json();
        if (!data.meals) {
            const response = await fetch(`${API_BASE_URL}/filter.php?c=Dessert`);
            const data = await response.json();
            if (!data.meals) {
                throw new Error('Failed to fetch featured recipes');
            }
            displayFeaturedRecipes(data.meals.slice(0, 6));
            return;
        }
        displayFeaturedRecipes(data.meals);
    } catch (error) {
        console.error('Error loading featured recipes:', error);
        const fallbackRecipes = [
            {
                idMeal: "52772",
                strMeal: "Teriyaki Chicken Casserole",
                strCategory: "Chicken",
                strArea: "Japanese",
                strMealThumb: "https://www.themealdb.com/images/media/meals/wvpsxx1468256321.jpg"
            },
            {
                idMeal: "52854",
                strMeal: "Pancakes",
                strCategory: "Dessert",
                strArea: "American",
                strMealThumb: "https://www.themealdb.com/images/media/meals/rwuyqx1511383174.jpg"
            },
            {
                idMeal: "52844",
                strMeal: "Lasagne",
                strCategory: "Pasta",
                strArea: "Italian",
                strMealThumb: "https://www.themealdb.com/images/media/meals/wtsvxx1511296896.jpg"
            },
            {
                idMeal: "52929",
                strMeal: "Timbits",
                strCategory: "Dessert",
                strArea: "Canadian",
                strMealThumb: "https://www.themealdb.com/images/media/meals/txsupu1511815755.jpg"
            },
            {
                idMeal: "52948",
                strMeal: "Keleya Zaara",
                strCategory: "Lamb",
                strArea: "Tunisian",
                strMealThumb: "https://www.themealdb.com/images/media/meals/8x09hy1560460923.jpg"
            },
            {
                idMeal: "52971",
                strMeal: "Kafteji",
                strCategory: "Vegetarian",
                strArea: "Tunisian",
                strMealThumb: "https://www.themealdb.com/images/media/meals/1bsv1q1560459826.jpg"
            }
        ];
        displayFeaturedRecipes(fallbackRecipes);
    }
}

function displayFeaturedRecipes(recipes) {
    featuredCarousel.innerHTML = '';
    recipes.forEach(recipe => {
        const isSaved = state.savedRecipes[recipe.idMeal] !== undefined;
        const bookmarkClass = isSaved ? 'active' : '';
        const bookmarkIcon = isSaved ? 'fas' : 'far';
        const carouselItem = document.createElement('li');
        carouselItem.className = 'carousel-item';
        carouselItem.innerHTML = `
            <div class="recipe-card">
                <button class="bookmark-btn ${bookmarkClass}" data-id="${recipe.idMeal}" aria-label="Save recipe">
                    <i class="${bookmarkIcon} fa-bookmark"></i>
                </button>
                <div class="recipe-image">
                    <img src="${recipe.strMealThumb}" alt="${recipe.strMeal}" loading="lazy">
                </div>
                <div class="recipe-info">
                    <h3 class="recipe-title">${recipe.strMeal}</h3>
                    <div class="recipe-details">
                        <span><i class="fas fa-globe"></i> ${recipe.strArea || 'Various'}</span>
                        <span><i class="fas fa-tag"></i> ${recipe.strCategory}</span>
                    </div>
                    <div class="recipe-actions">
                        <a href="#" class="view-recipe primary" data-id="${recipe.idMeal}">View Recipe</a>
                    </div>
                </div>
            </div>
        `;
        featuredCarousel.appendChild(carouselItem);
        const bookmarkBtn = carouselItem.querySelector('.bookmark-btn');
        const viewRecipeBtn = carouselItem.querySelector('.view-recipe');
        bookmarkBtn.addEventListener('click', () => toggleBookmark(recipe.idMeal, bookmarkBtn, recipe));
        viewRecipeBtn.addEventListener('click', (e) => {
            e.preventDefault();
            showRecipeDetails(recipe.idMeal);
        });
    });
}

function moveCarousel(direction) {
    const carouselItems = document.querySelectorAll('.carousel-item');
    if (carouselItems.length === 0) return;
    const itemWidth = carouselItems[0].offsetWidth + parseInt(getComputedStyle(carouselItems[0]).marginLeft) * 2;
    let currentPosition = featuredCarousel.style.transform ? 
        parseInt(featuredCarousel.style.transform.match(/-?\d+/)[0]) : 0;
    const containerWidth = featuredCarousel.parentElement.offsetWidth;
    const visibleItems = Math.max(1, Math.floor(containerWidth / itemWidth));
    if (direction === 'prev') {
        currentPosition = Math.min(0, currentPosition + itemWidth);
    } else {
        const maxOffset = -(Math.max(0, carouselItems.length - visibleItems)) * itemWidth;
        currentPosition = Math.max(maxOffset, currentPosition - itemWidth);
    }
    featuredCarousel.style.transform = `translateX(${currentPosition}px)`;
}

async function loadCategories() {
    try {
        const response = await fetch(`${API_BASE_URL}/categories.php`);
        const data = await response.json();
        if (!data.categories) {
            throw new Error('Failed to fetch categories');
        }
        displayCategories(data.categories);
    } catch (error) {
        console.error('Error loading categories:', error);
        categoriesContainer.innerHTML = `
            <div class="error-message">
                <p>Failed to load categories. Please try again later.</p>
            </div>
        `;
    }
}

function displayCategories(categories) {
    categoriesContainer.innerHTML = '';
    categories.forEach(category => {
        const categoryCard = document.createElement('div');
        categoryCard.className = 'category-card';
        categoryCard.innerHTML = `
            <div class="category-image">
                <img src="${category.strCategoryThumb}" alt="${category.strCategory}" loading="lazy">
            </div>
            <div class="category-info">
                <h3 class="category-name">${category.strCategory}</h3>
                <p class="category-count">Explore recipes</p>
            </div>
        `;
        categoriesContainer.appendChild(categoryCard);
        categoryCard.addEventListener('click', () => {
            searchInput.value = category.strCategory;
            handleSearch();
        });
    });
}

function populateFooterCategories(categories) {
    const footerCategories = document.getElementById('footer-categories');
    if (!footerCategories) return;
    footerCategories.innerHTML = '';
    if (!categories) {
        fetch(`${API_BASE_URL}/categories.php`)
            .then(response => response.json())
            .then(data => {
                if (data.categories) {
                    const randomCategories = shuffleArray(data.categories).slice(0, 5);
                    appendFooterCategories(randomCategories);
                }
            })
            .catch(error => console.error('Error fetching footer categories:', error));
        return;
    }
    const randomCategories = shuffleArray(categories).slice(0, 5);
    appendFooterCategories(randomCategories);
}

function appendFooterCategories(categories) {
    const footerCategories = document.getElementById('footer-categories');
    if (!footerCategories) return;
    categories.forEach(category => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = '#';
        a.textContent = category.strCategory;
        a.addEventListener('click', (e) => {
            e.preventDefault();
            searchInput.value = category.strCategory;
            handleSearch();
            window.scrollTo({
                top: document.getElementById('search-results').offsetTop - 100,
                behavior: 'smooth'
            });
        });
        li.appendChild(a);
        footerCategories.appendChild(li);
    });
}

function resetSearch() {
    searchInput.value = '';
    clearResults();
}

function toggleDarkMode() {
    state.darkMode = !state.darkMode;
    document.documentElement.setAttribute('data-theme', state.darkMode ? 'dark' : 'light');
    localStorage.setItem('darkMode', state.darkMode);
    showToast(`${state.darkMode ? 'Dark' : 'Light'} mode activated`);
}

function setView(viewType) {
    state.currentView = viewType;
    if (viewType === 'grid') {
        recipeContainer.className = 'grid-view';
        gridViewBtn.classList.add('active');
        listViewBtn.classList.remove('active');
    } else {
        recipeContainer.className = 'list-view';
        listViewBtn.classList.add('active');
        gridViewBtn.classList.remove('active');
    }
}

async function showRecipeDetails(id) {
    showLoading();
    try {
        const response = await fetch(`${API_BASE_URL}/lookup.php?i=${id}`);
        const data = await response.json();
        if (!data.meals || data.meals.length === 0) {
            alert('Recipe details not found');
            hideLoading();
            return;
        }
        const recipe = data.meals[0];
        const isSaved = state.savedRecipes[recipe.idMeal] !== undefined;
        const bookmarkClass = isSaved ? 'active' : '';
        const bookmarkIcon = isSaved ? 'fas' : 'far';
        let ingredientsList = '<div class="ingredients-grid">';
        let ingredientCount = 0;
        for (let i = 1; i <= 20; i++) {
            if (recipe[`strIngredient${i}`] && recipe[`strIngredient${i}`].trim() !== '') {
                const ingredient = recipe[`strIngredient${i}`];
                const measure = recipe[`strMeasure${i}`] || '';
                ingredientsList += `
                    <div class="ingredient-item">
                        <div class="ingredient-icon">${i}</div>
                        <div class="ingredient-text">
                            <strong>${ingredient}</strong>
                            <div>${measure}</div>
                        </div>
                    </div>
                `;
                ingredientCount++;
            }
        }
        ingredientsList += '</div>';
        let instructions = '<ol class="instructions-list">';
        const steps = recipe.strInstructions
            .split(/\r?\n/)
            .filter(step => step.trim() !== '')
            .map(step => step.trim());
        steps.forEach(step => {
            instructions += `<li class="instruction-step">${step}</li>`;
        });
        instructions += '</ol>';
        const modal = document.createElement('div');
        modal.className = 'recipe-modal';
        modal.innerHTML = `
            <div class="recipe-modal-content">
                <span class="close-modal">&times;</span>
                <div class="recipe-modal-header">
                    <h2>${recipe.strMeal}</h2>
                    <p class="recipe-category">${recipe.strCategory} | ${recipe.strArea}</p>
                </div>
                <div class="recipe-modal-body">
                    <div class="recipe-actions" style="text-align: right; margin-bottom: 1rem;">
                        <button class="bookmark-btn-big ${bookmarkClass}" data-id="${recipe.idMeal}">
                            <i class="${bookmarkIcon} fa-bookmark"></i> 
                            ${isSaved ? 'Saved' : 'Save Recipe'}
                        </button>
                    </div>
                    <img src="${recipe.strMealThumb}" alt="${recipe.strMeal}">
                    <div class="recipe-details-grid">
                        <div class="detail-item">
                            <div class="detail-label">Category</div>
                            <div class="detail-value"><i class="fas fa-tag"></i> ${recipe.strCategory}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Cuisine</div>
                            <div class="detail-value"><i class="fas fa-globe"></i> ${recipe.strArea}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Ingredients</div>
                            <div class="detail-value"><i class="fas fa-list"></i> ${ingredientCount} items</div>
                        </div>
                    </div>
                    <h3>Ingredients</h3>
                    ${ingredientsList}
                    <h3>Instructions</h3>
                    ${instructions}
                    ${recipe.strYoutube ? `
                    <div class="video-container">
                        <a href="${recipe.strYoutube}" target="_blank" class="video-link">
                            <i class="fab fa-youtube"></i> Watch Video Tutorial
                        </a>
                    </div>` : ''}
                    ${recipe.strSource ? `
                    <div class="source-link">
                        <p>Source: <a href="${recipe.strSource}" target="_blank">${new URL(recipe.strSource).hostname}</a></p>
                    </div>` : ''}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        modal.querySelector('.close-modal').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
        const bookmarkBtn = modal.querySelector('.bookmark-btn-big');
        bookmarkBtn.addEventListener('click', () => {
            const isCurrentlySaved = bookmarkBtn.classList.contains('active');
            if (isCurrentlySaved) {
                delete state.savedRecipes[id];
                bookmarkBtn.classList.remove('active');
                bookmarkBtn.querySelector('i').classList.replace('fas', 'far');
                bookmarkBtn.innerHTML = '<i class="far fa-bookmark"></i> Save Recipe';
            } else {
                state.savedRecipes[id] = {
                    id: recipe.idMeal,
                    name: recipe.strMeal,
                    image: recipe.strMealThumb,
                    area: recipe.strArea || 'Various',
                    category: recipe.strCategory,
                    dateAdded: new Date().toISOString()
                };
                bookmarkBtn.classList.add('active');
                bookmarkBtn.querySelector('i').classList.replace('far', 'fas');
                bookmarkBtn.innerHTML = '<i class="fas fa-bookmark"></i> Saved';
            }
            localStorage.setItem('savedRecipes', JSON.stringify(state.savedRecipes));
            updateSavedRecipeCount();
            document.querySelectorAll(`.bookmark-btn[data-id="${id}"]`).forEach(btn => {
                if (state.savedRecipes[id]) {
                    btn.classList.add('active');
                    btn.querySelector('i').classList.replace('far', 'fas');
                } else {
                    btn.classList.remove('active');
                    btn.querySelector('i').classList.replace('fas', 'far');
                }
            });
        });
    } catch (error) {
        console.error('Error fetching recipe details:', error);
        alert('Failed to load recipe details. Please try again.');
    } finally {
        hideLoading();
    }
}

function handleScrollAnimations() {
    const scrollableElements = document.querySelectorAll('.recipe-card, .category-card, .section-header');
    scrollableElements.forEach(element => {
        const elementPosition = element.getBoundingClientRect().top;
        const screenPosition = window.innerHeight / 1.2;
        if (elementPosition < screenPosition) {
            element.classList.add('animate');
        }
    });
}

function showLoading() {
    loadingElement.classList.remove('hidden');
    recipeContainer.innerHTML = '';
}

function hideLoading() {
    loadingElement.classList.add('hidden');
}

function clearResults() {
    recipeContainer.innerHTML = '';
}

function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

document.addEventListener('DOMContentLoaded', initializeApp);
