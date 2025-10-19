// Application state
let allProperties = [];
let filteredProperties = [];
let selectedProperties = new Set();
let currentPage = 1;
let isLoading = false;
let hasMorePages = true;
let totalProperties = 0;
let loadedProperties = 0;

// DOM elements
const searchBox = document.getElementById("searchBox");
const propertiesGrid = document.getElementById("propertiesGrid");
const selectedCount = document.getElementById("selectedCount");
const copyButton = document.getElementById("copyButton");
const loadMoreBtn = document.getElementById("loadMoreBtn");
const loadMoreContainer = document.getElementById("loadMoreContainer");
const progressInfo = document.getElementById("progressInfo");
const progressText = document.getElementById("progressText");
const errorBanner = document.getElementById("errorBanner");
const errorMessage = document.getElementById("errorMessage");
const noResults = document.getElementById("noResults");

// Initialize the application
document.addEventListener("DOMContentLoaded", function () {
  searchBox.addEventListener("input", debounce(handleSearch, 300));
  loadInitialProperties();
});

// Load initial batch of properties
async function loadInitialProperties() {
  showLoading("Loading properties...");
  currentPage = 1;
  allProperties = [];
  await loadProperties();
}

// Load properties from API
async function loadProperties() {
  if (isLoading) return;

  isLoading = true;
  loadMoreBtn.disabled = true;

  try {
    const response = await fetch(`/api/properties?page=${currentPage}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to load properties");
    }

    if (data.error) {
      showError(data.message, data.error);
      hideLoading();
      return;
    }

    // Update totals
    totalProperties = data.meta.total;
    loadedProperties += data.data.length;

    // Add new properties to our collection
    allProperties.push(...data.data);

    // Update UI
    updateProgress();

    // Re-apply current search to include new data
    handleSearch();

    // Check if there are more pages
    hasMorePages = data.meta.current_page < data.meta.last_page;

    if (hasMorePages) {
      loadMoreContainer.style.display = "block";
    } else {
      loadMoreContainer.style.display = "none";
    }

    hideLoading();
  } catch (error) {
    console.error("Error loading properties:", error);
    showError(error.message, "LOAD_ERROR");
    hideLoading();
  }

  isLoading = false;
  loadMoreBtn.disabled = false;
}

// Load more properties
async function loadMoreProperties() {
  if (!hasMorePages || isLoading) return;

  showLoading(
    `Loading more properties... (${loadedProperties}/${totalProperties})`
  );
  currentPage++;
  await loadProperties();
}

// Handle search - focuses on property name and location/area only
function handleSearch() {
  const query = searchBox.value.toLowerCase().trim();

  if (query === "") {
    filteredProperties = allProperties;
  } else {
    filteredProperties = allProperties.filter((property) => {
      return (
        // Search by property name (both internal name and public name)
        property.name.toLowerCase().includes(query) ||
        property.public_name.toLowerCase().includes(query) ||
        // Search by area/location (address display, city, state)
        property.address.display.toLowerCase().includes(query) ||
        property.address.city.toLowerCase().includes(query) ||
        property.address.state.toLowerCase().includes(query)
      );
    });
  }

  renderProperties();
}

// Render properties in the grid
function renderProperties() {
  const propertiesToShow =
    filteredProperties.length > 0 || searchBox.value.trim() !== ""
      ? filteredProperties
      : allProperties;

  propertiesGrid.innerHTML = "";

  if (propertiesToShow.length === 0) {
    if (allProperties.length === 0 && !isLoading) {
      noResults.style.display = "block";
    }
    return;
  }

  noResults.style.display = "none";

  propertiesToShow.forEach((property) => {
    const propertyCard = createPropertyCard(property);
    propertiesGrid.appendChild(propertyCard);
  });

  updateSelectionUI();
}

// Create property card HTML
function createPropertyCard(property) {
  const card = document.createElement("div");
  card.className = "property-card";
  card.dataset.propertyId = property.id;

  if (selectedProperties.has(property.id)) {
    card.classList.add("selected");
  }

  const statusClass = property.listed ? "status-listed" : "status-unlisted";
  const statusText = property.listed ? "Listed" : "Unlisted";

  card.innerHTML = `
        <img src="${property.picture || "/placeholder.jpg"}" 
             alt="${property.public_name}" 
             class="property-image"
             onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzUwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjhmOWZhIi8+CiAgPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNiIgZmlsbD0iIzZjNzU3ZCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4=';">
        
        <div class="property-content">
            <div class="property-header">
                <div>
                    <h3 class="property-title">${property.public_name}</h3>
                    <p class="property-name">${property.name}</p>
                    <span class="property-status ${statusClass}">${statusText}</span>
                </div>
                <input type="checkbox" class="property-checkbox" 
                       onchange="togglePropertySelection('${property.id}')"
                       ${selectedProperties.has(property.id) ? "checked" : ""}>
            </div>
            
            <div class="property-details">
                <div class="detail-item">
                    <span class="detail-label">Guests:</span>
                    <span class="detail-value">${property.capacity.max}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Bedrooms:</span>
                    <span class="detail-value">${
                      property.capacity.bedrooms
                    }</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Bathrooms:</span>
                    <span class="detail-value">${
                      property.capacity.bathrooms
                    }</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Type:</span>
                    <span class="detail-value">${property.property_type}</span>
                </div>
            </div>
            
            <div class="property-address">
                📍 ${property.address.display}
            </div>
            
            <div class="property-actions">
                <button class="btn-details" onclick="loadPropertyDetails('${
                  property.id
                }')" 
                        id="details-${property.id}">
                    📊 Load Full Details
                </button>
            </div>
        </div>
    `;

  return card;
}

// Toggle property selection
function togglePropertySelection(propertyId) {
  if (selectedProperties.has(propertyId)) {
    selectedProperties.delete(propertyId);
  } else {
    selectedProperties.add(propertyId);
  }

  updateSelectionUI();
}

// Update selection UI
function updateSelectionUI() {
  const count = selectedProperties.size;
  selectedCount.textContent = `${count} selected`;
  copyButton.disabled = count === 0;

  // Update card styling
  document.querySelectorAll(".property-card").forEach((card) => {
    const propertyId = card.dataset.propertyId;
    if (selectedProperties.has(propertyId)) {
      card.classList.add("selected");
    } else {
      card.classList.remove("selected");
    }
  });
}

// Load detailed property information
async function loadPropertyDetails(propertyId) {
  const button = document.getElementById(`details-${propertyId}`);
  const originalText = button.textContent;

  try {
    button.textContent = "⏳ Loading...";
    button.disabled = true;

    const response = await fetch(`/api/property/${propertyId}`);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Failed to load property details");
    }

    if (data.error) {
      throw new Error(data.message);
    }

    // Update the property in our collection with detailed data
    const propertyIndex = allProperties.findIndex((p) => p.id === propertyId);
    if (propertyIndex !== -1) {
      allProperties[propertyIndex] = {
        ...allProperties[propertyIndex],
        ...data.data,
        _detailsLoaded: true,
      };

      // Re-render if this property is currently visible
      if (filteredProperties.length > 0) {
        const filteredIndex = filteredProperties.findIndex(
          (p) => p.id === propertyId
        );
        if (filteredIndex !== -1) {
          filteredProperties[filteredIndex] = allProperties[propertyIndex];
        }
      }
    }

    button.textContent = "✅ Details Loaded";
    button.style.backgroundColor = "#d4edda";
    button.style.color = "#155724";
  } catch (error) {
    console.error("Error loading property details:", error);
    button.textContent = "❌ Load Failed";
    button.style.backgroundColor = "#f8d7da";
    button.style.color = "#721c24";
    showError(
      `Failed to load details for property: ${error.message}`,
      "DETAILS_ERROR"
    );
  }
}

// Copy selected properties to clipboard
async function copySelectedProperties() {
  if (selectedProperties.size === 0) return;

  const selectedData = allProperties.filter((property) =>
    selectedProperties.has(property.id)
  );

  try {
    const jsonData = JSON.stringify(selectedData, null, 2);
    await navigator.clipboard.writeText(jsonData);

    // Visual feedback
    const originalText = copyButton.textContent;
    copyButton.textContent = "✅ Copied!";
    setTimeout(() => {
      copyButton.textContent = originalText;
    }, 2000);
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);

    // Fallback: show data in a modal or new window
    const jsonData = JSON.stringify(selectedData, null, 2);
    const newWindow = window.open("", "_blank");
    newWindow.document.write(`
            <html>
                <head><title>Selected Properties Data</title></head>
                <body>
                    <h3>Selected Properties JSON Data</h3>
                    <p>Copy the data below:</p>
                    <textarea style="width: 100%; height: 400px;">${jsonData}</textarea>
                </body>
            </html>
        `);
  }
}

// Update progress information
function updateProgress() {
  if (totalProperties > 0) {
    progressText.textContent = `Loaded ${loadedProperties} of ${totalProperties} properties`;
  }
}

// Show loading state
function showLoading(message) {
  progressInfo.style.display = "block";
  progressText.textContent = message;
  hideError();
}

// Hide loading state
function hideLoading() {
  progressInfo.style.display = "none";
}

// Show error message
function showError(message, type) {
  errorMessage.textContent = message;
  errorBanner.classList.add("show");

  // Auto-hide error after 10 seconds
  setTimeout(hideError, 10000);
}

// Hide error message
function hideError() {
  errorBanner.classList.remove("show");
}

// Debounce function for search
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}
