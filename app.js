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
const selectAllButton = document.getElementById("selectAllButton");
const deselectAllButton = document.getElementById("deselectAllButton");
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
  showLoading("Loading all properties with full details...");
  currentPage = 1;
  allProperties = [];

  // Auto-load all properties first
  await loadAllProperties();

  // Now load full details for all properties
  await loadAllPropertyDetails();

  // Now render everything
  filteredProperties = allProperties;
  renderProperties();
  hideLoading();

  if (allProperties.length > 0) {
    showCompletionMessage();
  }
} // Auto-load all properties from all pages
async function loadAllProperties() {
  let keepLoading = true;

  while (keepLoading) {
    await loadProperties();
    keepLoading = hasMorePages;
    if (keepLoading) {
      currentPage++;
      // Update loading message
      showLoading(
        `Loading properties... ${loadedProperties}/${totalProperties || "?"}`
      );
    }
  }
}

// Load properties from API
async function loadProperties() {
  if (isLoading) return;

  isLoading = true;
  loadMoreBtn.disabled = true;

  try {
    const response = await fetch(
      `/api/properties?page=${currentPage}&per_page=100`
    );
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

    // Update totals display
    updateProgress();

    // Check if there are more pages
    hasMorePages = data.meta.current_page < data.meta.last_page;

    // Don't render during auto-load, wait until all are loaded
    loadMoreContainer.style.display = "none";
  } catch (error) {
    console.error("Error loading properties:", error);
    showError(error.message, "LOAD_ERROR");
    hideLoading();
  }

  isLoading = false;
  loadMoreBtn.disabled = false;
}

// Load full details for all properties
async function loadAllPropertyDetails() {
  const total = allProperties.length;
  let loaded = 0;

  showLoading(`Loading full details for all properties... 0/${total}`);

  // Load details in batches to avoid overwhelming the API
  const batchSize = 5;
  for (let i = 0; i < allProperties.length; i += batchSize) {
    const batch = allProperties.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (property) => {
        try {
          const response = await fetch(`/api/property/${property.id}`);
          const data = await response.json();

          if (response.ok && !data.error) {
            // Update property with full details
            const index = allProperties.findIndex((p) => p.id === property.id);
            if (index !== -1) {
              allProperties[index] = {
                ...allProperties[index],
                ...data.data,
                _detailsLoaded: true,
              };
            }
          }
        } catch (error) {
          console.error(
            `Failed to load details for property ${property.id}:`,
            error
          );
        }

        loaded++;
        showLoading(`Loading full details... ${loaded}/${total}`);
      })
    );
  }
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

// Handle search - focuses on property name and address only
function handleSearch() {
  const query = searchBox.value.toLowerCase().trim();

  if (query === "") {
    filteredProperties = allProperties;
  } else {
    filteredProperties = allProperties.filter((property) => {
      // Primary: Search by property name
      const nameMatch = property.name?.toLowerCase().includes(query) || false;
      const publicNameMatch =
        property.public_name?.toLowerCase().includes(query) || false;
      // Secondary: Search by address (with null check)
      const addressMatch =
        property.address?.display?.toLowerCase().includes(query) || false;

      return nameMatch || publicNameMatch || addressMatch;
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

// Create property card HTML - compact table-like design
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
        <div class="property-content-compact">
            <div class="property-row">
                <div class="property-info">
                    <input type="checkbox" class="property-checkbox" 
                           onchange="togglePropertySelection('${property.id}')"
                           ${
                             selectedProperties.has(property.id)
                               ? "checked"
                               : ""
                           }>
                    <div class="property-text">
                        <h4 class="property-title-compact">${
                          property.name || "Unnamed Property"
                        }</h4>
                        ${
                          property.public_name
                            ? `<span class="property-name-compact">${property.public_name}</span>`
                            : ""
                        }
                        <span class="property-status ${statusClass}">${statusText}</span>
                    </div>
                </div>
                
                <div class="property-specs">
                    <span>🏠 ${property.property_type || "N/A"}</span>
                    <span>🛏️ ${property.capacity?.bedrooms || 0}br</span>
                    <span>🛁 ${property.capacity?.bathrooms || 0}ba</span>
                </div>
                
                <div class="property-address-compact">
                    📍 ${property.address?.display || "Address not available"}
                </div>
                
                <div class="property-details-status">
                    ${
                      property._detailsLoaded
                        ? '<span class="details-loaded">✅ Full Details</span>'
                        : ""
                    }
                </div>
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

  // Show/hide select/deselect all buttons
  const visibleProperties =
    filteredProperties.length > 0 || searchBox.value.trim() !== ""
      ? filteredProperties
      : allProperties;

  const allVisibleSelected =
    visibleProperties.length > 0 &&
    visibleProperties.every((p) => selectedProperties.has(p.id));

  if (allVisibleSelected && count > 0) {
    selectAllButton.style.display = "none";
    deselectAllButton.style.display = "inline-block";
  } else {
    selectAllButton.style.display = "inline-block";
    deselectAllButton.style.display = "none";
  }

  // Update card styling
  document.querySelectorAll(".property-card").forEach((card) => {
    const propertyId = card.dataset.propertyId;
    const checkbox = card.querySelector(".property-checkbox");
    if (selectedProperties.has(propertyId)) {
      card.classList.add("selected");
      if (checkbox) checkbox.checked = true;
    } else {
      card.classList.remove("selected");
      if (checkbox) checkbox.checked = false;
    }
  });
}

// Select all visible properties (in search results)
function selectAllVisible() {
  const propertiesToSelect =
    filteredProperties.length > 0 || searchBox.value.trim() !== ""
      ? filteredProperties
      : allProperties;

  propertiesToSelect.forEach((property) => {
    selectedProperties.add(property.id);
  });

  updateSelectionUI();
}

// Deselect all properties
function deselectAll() {
  selectedProperties.clear();
  updateSelectionUI();
}

// Copy selected properties to clipboard
async function copySelectedProperties() {
  if (selectedProperties.size === 0) return;

  const selectedData = allProperties.filter((property) =>
    selectedProperties.has(property.id)
  );

  showLoading(`Copying ${selectedData.length} properties with full details...`);

  try {
    const jsonData = JSON.stringify(selectedData, null, 2);
    await navigator.clipboard.writeText(jsonData);

    // Visual feedback
    const originalText = copyButton.textContent;
    copyButton.textContent = "✅ Copied!";
    hideLoading();

    setTimeout(() => {
      copyButton.textContent = originalText;
    }, 2000);
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    hideLoading();

    // Fallback: show data in a modal or new window
    const jsonData = JSON.stringify(selectedData, null, 2);
    const newWindow = window.open("", "_blank");
    newWindow.document.write(`
            <html>
                <head><title>Selected Properties Data</title></head>
                <body>
                    <h3>Selected Properties JSON Data (Full Details)</h3>
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

// Show completion message
function showCompletionMessage() {
  progressInfo.style.display = "block";
  progressInfo.style.backgroundColor = "#d4edda";
  progressInfo.style.color = "#155724";
  progressText.textContent = `✅ All ${totalProperties} properties loaded successfully!`;

  // Hide after 3 seconds
  setTimeout(() => {
    progressInfo.style.display = "none";
    progressInfo.style.backgroundColor = "white";
    progressInfo.style.color = "#333";
  }, 3000);
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
