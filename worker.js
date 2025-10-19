// Cloudflare Worker for Hospitable Properties Viewer
// Provides progressive loading, search, selection, clipboard functionality, and basic authentication

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);

  // Handle login form submission
  if (url.pathname === "/login" && request.method === "POST") {
    return handleLogin(request);
  }

  // Public routes (no authentication required)
  if (url.pathname === "/login" || url.pathname === "/styles.css") {
    return handlePublicRoutes(request);
  }

  // Check authentication for all other routes
  const authResult = await checkAuthentication(request);
  if (!authResult.authenticated) {
    return authResult.response;
  }

  // Authenticated routes
  if (url.pathname === "/" || url.pathname === "/index.html") {
    return getFileResponse("index.html");
  }

  if (url.pathname === "/app.js") {
    return getFileResponse("app.js");
  }

  if (url.pathname === "/api/properties") {
    return handlePropertiesAPI(request);
  }

  if (url.pathname.startsWith("/api/property/")) {
    return handlePropertyDetailsAPI(request);
  }

  return new Response("Not Found", { status: 404 });
}

// Authentication functions
async function checkAuthentication(request) {
  const cookies = parseCookies(request.headers.get("Cookie") || "");
  const sessionToken = cookies["session_token"];

  if (!sessionToken || sessionToken !== getValidSessionToken()) {
    // Redirect to login page
    return {
      authenticated: false,
      response: new Response("", {
        status: 302,
        headers: {
          Location: "/login",
        },
      }),
    };
  }

  return { authenticated: true };
}

async function handleLogin(request) {
  try {
    const formData = await request.formData();
    const username = formData.get("username");
    const password = formData.get("password");

    // Check credentials
    if (!AUTH_USERNAME || !AUTH_PASSWORD) {
      return new Response("", {
        status: 302,
        headers: {
          Location: "/login?error=config",
        },
      });
    }

    if (username === AUTH_USERNAME && password === AUTH_PASSWORD) {
      // Create session token
      const sessionToken = getValidSessionToken();

      return new Response("", {
        status: 302,
        headers: {
          Location: "/",
          "Set-Cookie": `session_token=${sessionToken}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400`,
        },
      });
    } else {
      return new Response("", {
        status: 302,
        headers: {
          Location: "/login?error=invalid",
        },
      });
    }
  } catch (error) {
    return new Response("", {
      status: 302,
      headers: {
        Location: "/login?error=error",
      },
    });
  }
}

function parseCookies(cookieHeader) {
  const cookies = {};
  if (cookieHeader) {
    cookieHeader.split(";").forEach((cookie) => {
      const [name, value] = cookie.trim().split("=");
      if (name && value) {
        cookies[name] = decodeURIComponent(value);
      }
    });
  }
  return cookies;
}

function getValidSessionToken() {
  // Generate a simple session token based on credentials and date
  // In production, you'd want something more secure
  const today = new Date().toDateString();
  return btoa(`${AUTH_USERNAME}:${today}`).replace(/[^a-zA-Z0-9]/g, "");
}

async function handlePublicRoutes(request) {
  const url = new URL(request.url);

  if (url.pathname === "/login") {
    return getFileResponse("login.html");
  }

  if (url.pathname === "/styles.css") {
    return getFileResponse("styles.css");
  }

  return new Response("Not Found", { status: 404 });
}

function getFileResponse(filename) {
  const content = getFileContent(filename);
  const contentType = getContentType(filename);

  return new Response(content, {
    headers: { "Content-Type": contentType },
  });
}

function getContentType(filename) {
  if (filename.endsWith(".html")) return "text/html";
  if (filename.endsWith(".css")) return "text/css";
  if (filename.endsWith(".js")) return "application/javascript";
  return "text/plain";
}

async function handlePropertiesAPI(request) {
  const url = new URL(request.url);
  const page = url.searchParams.get("page") || "1";

  try {
    // Check if API token exists
    if (!HOSPITABLE_API_TOKEN) {
      return new Response(
        JSON.stringify({
          error: "API_TOKEN_MISSING",
          message:
            "Hospitable API token not configured. Please set the HOSPITABLE_API_TOKEN secret in Cloudflare Workers.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const apiUrl = `https://public.api.hospitable.com/v2/properties?page=${page}`;
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${HOSPITABLE_API_TOKEN}`,
      },
    });

    if (!response.ok) {
      let errorMessage = "API request failed";
      let errorType = "API_ERROR";

      if (response.status === 401) {
        errorType = "AUTHENTICATION_ERROR";
        errorMessage = "Authentication failed. Please check your API token.";
      } else if (response.status === 403) {
        errorType = "AUTHORIZATION_ERROR";
        errorMessage = "Access forbidden. Please check your API permissions.";
      } else if (response.status === 429) {
        errorType = "RATE_LIMIT_ERROR";
        errorMessage = "Rate limit exceeded. Please try again later.";
      }

      return new Response(
        JSON.stringify({
          error: errorType,
          message: errorMessage,
          status: response.status,
        }),
        {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "NETWORK_ERROR",
        message:
          "Failed to connect to Hospitable API. Please check your internet connection.",
        details: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

async function handlePropertyDetailsAPI(request) {
  const url = new URL(request.url);
  const propertyId = url.pathname.split("/").pop();

  try {
    if (!HOSPITABLE_API_TOKEN) {
      return new Response(
        JSON.stringify({
          error: "API_TOKEN_MISSING",
          message: "Hospitable API token not configured.",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const apiUrl = `https://public.api.hospitable.com/v2/properties/${propertyId}?include=listings,details`;
    const response = await fetch(apiUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${HOSPITABLE_API_TOKEN}`,
      },
    });

    if (!response.ok) {
      let errorMessage = "Failed to fetch property details";
      let errorType = "API_ERROR";

      if (response.status === 401) {
        errorType = "AUTHENTICATION_ERROR";
        errorMessage = "Authentication failed. Please check your API token.";
      } else if (response.status === 404) {
        errorType = "NOT_FOUND_ERROR";
        errorMessage = "Property not found.";
      }

      return new Response(
        JSON.stringify({
          error: errorType,
          message: errorMessage,
          status: response.status,
        }),
        {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "NETWORK_ERROR",
        message: "Failed to fetch property details.",
        details: error.message,
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

function getFileContent(filename) {
  switch (filename) {
    case "index.html":
      return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hospitable Properties Viewer</title>
    <link rel="stylesheet" href="/styles.css">
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏠 Hospitable Properties Viewer</h1>
            <p>Browse, search, and export property details with progressive loading</p>
        </div>
        
        <div class="error-banner" id="errorBanner">
            <strong>Error:</strong> <span id="errorMessage"></span>
        </div>
        
        <div class="controls">
            <input type="text" class="search-box" id="searchBox" placeholder="Search properties by name, location, or description...">
            <div class="selection-info">
                <span id="selectedCount">0 selected</span>
                <button class="btn btn-success" id="copyButton" onclick="copySelectedProperties()" disabled>
                    📋 Copy Selected Details
                </button>
            </div>
        </div>
        
        <div class="progress-info" id="progressInfo" style="display: none;">
            <div class="loading-spinner"></div>
            <p id="progressText">Loading properties...</p>
        </div>
        
        <div class="properties-grid" id="propertiesGrid"></div>
        
        <div class="load-more" id="loadMoreContainer" style="display: none;">
            <button class="btn btn-primary" id="loadMoreBtn" onclick="loadMoreProperties()">
                Load More Properties
            </button>
        </div>
        
        <div class="no-results" id="noResults" style="display: none;">
            <h3>No properties found</h3>
            <p>Try adjusting your search criteria or check the API connection.</p>
        </div>
    </div>

    <script src="/app.js"></script>
</body>
</html>`;

    case "login.html":
      return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Login - Hospitable Properties Viewer</title>
    <link rel="stylesheet" href="/styles.css">
</head>
<body>
    <div class="auth-container">
        <form class="auth-form" method="POST" action="/login">
            <h2>🏠 Properties Viewer</h2>
            <p>Please login to access the properties dashboard</p>
            
            <div id="authError" class="auth-error" style="display: none;"></div>
            
            <div class="form-group">
                <label for="username">Username:</label>
                <input type="text" id="username" name="username" required>
            </div>
            
            <div class="form-group">
                <label for="password">Password:</label>
                <input type="password" id="password" name="password" required>
            </div>
            
            <button type="submit" class="btn btn-primary">Login</button>
        </form>
    </div>

    <script>
        const urlParams = new URLSearchParams(window.location.search);
        const error = urlParams.get('error');
        if (error) {
            const errorDiv = document.getElementById('authError');
            errorDiv.textContent = 'Invalid username or password. Please try again.';
            errorDiv.style.display = 'block';
        }
    </script>
</body>
</html>`;

    case "app.js":
      return `// Application state
let allProperties = [];
let filteredProperties = [];
let selectedProperties = new Set();
let currentPage = 1;
let isLoading = false;
let hasMorePages = true;
let totalProperties = 0;
let loadedProperties = 0;

// DOM elements
const searchBox = document.getElementById('searchBox');
const propertiesGrid = document.getElementById('propertiesGrid');
const selectedCount = document.getElementById('selectedCount');
const copyButton = document.getElementById('copyButton');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const loadMoreContainer = document.getElementById('loadMoreContainer');
const progressInfo = document.getElementById('progressInfo');
const progressText = document.getElementById('progressText');
const errorBanner = document.getElementById('errorBanner');
const errorMessage = document.getElementById('errorMessage');
const noResults = document.getElementById('noResults');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    searchBox.addEventListener('input', debounce(handleSearch, 300));
    loadInitialProperties();
});

async function loadInitialProperties() {
    showLoading('Loading properties...');
    currentPage = 1;
    allProperties = [];
    await loadProperties();
}

async function loadProperties() {
    if (isLoading) return;
    isLoading = true;
    loadMoreBtn.disabled = true;
    
    try {
        const response = await fetch(\`/api/properties?page=\${currentPage}\`);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Failed to load properties');
        }
        
        if (data.error) {
            showError(data.message, data.error);
            hideLoading();
            return;
        }
        
        totalProperties = data.meta.total;
        loadedProperties += data.data.length;
        allProperties.push(...data.data);
        
        updateProgress();
        renderProperties();
        
        hasMorePages = data.meta.current_page < data.meta.last_page;
        loadMoreContainer.style.display = hasMorePages ? 'block' : 'none';
        hideLoading();
        
    } catch (error) {
        console.error('Error loading properties:', error);
        showError(error.message, 'LOAD_ERROR');
        hideLoading();
    }
    
    isLoading = false;
    loadMoreBtn.disabled = false;
}

async function loadMoreProperties() {
    if (!hasMorePages || isLoading) return;
    showLoading(\`Loading more properties... (\${loadedProperties}/\${totalProperties})\`);
    currentPage++;
    await loadProperties();
}

function handleSearch() {
    const query = searchBox.value.toLowerCase().trim();
    
    if (query === '') {
        filteredProperties = allProperties;
    } else {
        filteredProperties = allProperties.filter(property => {
            return (
                property.name.toLowerCase().includes(query) ||
                property.public_name.toLowerCase().includes(query) ||
                property.address.display.toLowerCase().includes(query) ||
                property.description.toLowerCase().includes(query) ||
                property.summary.toLowerCase().includes(query)
            );
        });
    }
    renderProperties();
}

function renderProperties() {
    const propertiesToShow = filteredProperties.length > 0 || searchBox.value.trim() !== '' 
        ? filteredProperties : allProperties;
    propertiesGrid.innerHTML = '';
    
    if (propertiesToShow.length === 0) {
        if (allProperties.length === 0 && !isLoading) {
            noResults.style.display = 'block';
        }
        return;
    }
    
    noResults.style.display = 'none';
    propertiesToShow.forEach(property => {
        const propertyCard = createPropertyCard(property);
        propertiesGrid.appendChild(propertyCard);
    });
    updateSelectionUI();
}

function createPropertyCard(property) {
    const card = document.createElement('div');
    card.className = 'property-card';
    card.dataset.propertyId = property.id;
    
    if (selectedProperties.has(property.id)) {
        card.classList.add('selected');
    }
    
    const statusClass = property.listed ? 'status-listed' : 'status-unlisted';
    const statusText = property.listed ? 'Listed' : 'Unlisted';
    
    card.innerHTML = \`
        <img src="\${property.picture || '/placeholder.jpg'}" 
             alt="\${property.public_name}" 
             class="property-image"
             onerror="this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzUwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjhmOWZhIi8+CiAgPHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNiIgZmlsbD0iIzZjNzU3ZCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4=';">
        
        <div class="property-content">
            <div class="property-header">
                <div>
                    <h3 class="property-title">\${property.public_name}</h3>
                    <p class="property-name">\${property.name}</p>
                    <span class="property-status \${statusClass}">\${statusText}</span>
                </div>
                <input type="checkbox" class="property-checkbox" 
                       onchange="togglePropertySelection('\${property.id}')"
                       \${selectedProperties.has(property.id) ? 'checked' : ''}>
            </div>
            
            <div class="property-details">
                <div class="detail-item">
                    <span class="detail-label">Guests:</span>
                    <span class="detail-value">\${property.capacity.max}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Bedrooms:</span>
                    <span class="detail-value">\${property.capacity.bedrooms}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Bathrooms:</span>
                    <span class="detail-value">\${property.capacity.bathrooms}</span>
                </div>
                <div class="detail-item">
                    <span class="detail-label">Type:</span>
                    <span class="detail-value">\${property.property_type}</span>
                </div>
            </div>
            
            <div class="property-address">
                📍 \${property.address.display}
            </div>
            
            <div class="property-actions">
                <button class="btn-details" onclick="loadPropertyDetails('\${property.id}')" 
                        id="details-\${property.id}">
                    📊 Load Full Details
                </button>
            </div>
        </div>
    \`;
    return card;
}

function togglePropertySelection(propertyId) {
    if (selectedProperties.has(propertyId)) {
        selectedProperties.delete(propertyId);
    } else {
        selectedProperties.add(propertyId);
    }
    updateSelectionUI();
}

function updateSelectionUI() {
    const count = selectedProperties.size;
    selectedCount.textContent = \`\${count} selected\`;
    copyButton.disabled = count === 0;
    
    document.querySelectorAll('.property-card').forEach(card => {
        const propertyId = card.dataset.propertyId;
        if (selectedProperties.has(propertyId)) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    });
}

async function loadPropertyDetails(propertyId) {
    const button = document.getElementById(\`details-\${propertyId}\`);
    const originalText = button.textContent;
    
    try {
        button.textContent = '⏳ Loading...';
        button.disabled = true;
        
        const response = await fetch(\`/api/property/\${propertyId}\`);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Failed to load property details');
        }
        
        if (data.error) {
            throw new Error(data.message);
        }
        
        const propertyIndex = allProperties.findIndex(p => p.id === propertyId);
        if (propertyIndex !== -1) {
            allProperties[propertyIndex] = { ...allProperties[propertyIndex], ...data.data, _detailsLoaded: true };
            
            if (filteredProperties.length > 0) {
                const filteredIndex = filteredProperties.findIndex(p => p.id === propertyId);
                if (filteredIndex !== -1) {
                    filteredProperties[filteredIndex] = allProperties[propertyIndex];
                }
            }
        }
        
        button.textContent = '✅ Details Loaded';
        button.style.backgroundColor = '#d4edda';
        button.style.color = '#155724';
        
    } catch (error) {
        console.error('Error loading property details:', error);
        button.textContent = '❌ Load Failed';
        button.style.backgroundColor = '#f8d7da';
        button.style.color = '#721c24';
        showError(\`Failed to load details for property: \${error.message}\`, 'DETAILS_ERROR');
    }
}

async function copySelectedProperties() {
    if (selectedProperties.size === 0) return;
    
    const selectedData = allProperties.filter(property => 
        selectedProperties.has(property.id)
    );
    
    try {
        const jsonData = JSON.stringify(selectedData, null, 2);
        await navigator.clipboard.writeText(jsonData);
        
        const originalText = copyButton.textContent;
        copyButton.textContent = '✅ Copied!';
        setTimeout(() => {
            copyButton.textContent = originalText;
        }, 2000);
        
    } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        
        const jsonData = JSON.stringify(selectedData, null, 2);
        const newWindow = window.open('', '_blank');
        newWindow.document.write(\`
            <html>
                <head><title>Selected Properties Data</title></head>
                <body>
                    <h3>Selected Properties JSON Data</h3>
                    <p>Copy the data below:</p>
                    <textarea style="width: 100%; height: 400px;">\${jsonData}</textarea>
                </body>
            </html>
        \`);
    }
}

function updateProgress() {
    if (totalProperties > 0) {
        progressText.textContent = \`Loaded \${loadedProperties} of \${totalProperties} properties\`;
    }
}

function showLoading(message) {
    progressInfo.style.display = 'block';
    progressText.textContent = message;
    hideError();
}

function hideLoading() {
    progressInfo.style.display = 'none';
}

function showError(message, type) {
    errorMessage.textContent = message;
    errorBanner.classList.add('show');
    setTimeout(hideError, 10000);
}

function hideError() {
    errorBanner.classList.remove('show');
}

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
}`;

    case "styles.css":
      return `* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    line-height: 1.6;
    color: #333;
    background-color: #f5f5f5;
}

.container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 20px;
}

.header {
    background: white;
    padding: 20px;
    border-radius: 8px;
    margin-bottom: 20px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.header h1 {
    color: #2c3e50;
    margin-bottom: 10px;
}

.controls {
    display: flex;
    gap: 15px;
    align-items: center;
    flex-wrap: wrap;
    margin-bottom: 20px;
}

.search-box {
    flex: 1;
    min-width: 300px;
    padding: 12px;
    border: 2px solid #ddd;
    border-radius: 6px;
    font-size: 16px;
}

.search-box:focus {
    outline: none;
    border-color: #3498db;
}

.btn {
    padding: 12px 20px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 16px;
    font-weight: 500;
    transition: background-color 0.2s;
}

.btn-primary {
    background-color: #3498db;
    color: white;
}

.btn-primary:hover {
    background-color: #2980b9;
}

.btn-primary:disabled {
    background-color: #bdc3c7;
    cursor: not-allowed;
}

.btn-success {
    background-color: #27ae60;
    color: white;
}

.btn-success:hover {
    background-color: #219a52;
}

.selection-info {
    display: flex;
    align-items: center;
    gap: 15px;
    flex-wrap: wrap;
}

.error-banner {
    background-color: #e74c3c;
    color: white;
    padding: 15px;
    border-radius: 6px;
    margin-bottom: 20px;
    display: none;
}

.error-banner.show {
    display: block;
}

.loading {
    text-align: center;
    padding: 40px;
    background: white;
    border-radius: 8px;
    margin-bottom: 20px;
}

.loading-spinner {
    display: inline-block;
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #3498db;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: 10px;
}

@keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}

.properties-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
    gap: 20px;
}

.property-card {
    background: white;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    transition: transform 0.2s, box-shadow 0.2s;
}

.property-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.property-card.selected {
    border: 2px solid #3498db;
}

.property-image {
    width: 100%;
    height: 200px;
    object-fit: cover;
    background-color: #f8f9fa;
}

.property-content {
    padding: 20px;
}

.property-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 15px;
}

.property-title {
    font-size: 18px;
    font-weight: 600;
    color: #2c3e50;
    margin-bottom: 5px;
}

.property-name {
    font-size: 14px;
    color: #7f8c8d;
    margin-bottom: 10px;
}

.property-checkbox {
    width: 20px;
    height: 20px;
    cursor: pointer;
}

.property-details {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 15px;
}

.detail-item {
    font-size: 14px;
}

.detail-label {
    color: #7f8c8d;
    font-weight: 500;
}

.detail-value {
    color: #2c3e50;
}

.property-address {
    font-size: 14px;
    color: #7f8c8d;
    margin-bottom: 15px;
}

.property-actions {
    display: flex;
    gap: 10px;
}

.btn-details {
    background-color: #f8f9fa;
    color: #495057;
    border: 1px solid #dee2e6;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    flex: 1;
}

.btn-details:hover {
    background-color: #e9ecef;
}

.btn-details:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

.property-status {
    display: inline-block;
    padding: 4px 8px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
}

.status-listed {
    background-color: #d4edda;
    color: #155724;
}

.status-unlisted {
    background-color: #f8d7da;
    color: #721c24;
}

.load-more {
    text-align: center;
    margin: 30px 0;
}

.progress-info {
    background: white;
    padding: 15px;
    border-radius: 8px;
    margin-bottom: 20px;
    text-align: center;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.no-results {
    text-align: center;
    padding: 40px;
    background: white;
    border-radius: 8px;
    color: #7f8c8d;
}

.auth-container {
    max-width: 400px;
    margin: 100px auto;
    padding: 30px;
    background: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.auth-form {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

.auth-form h2 {
    text-align: center;
    color: #2c3e50;
    margin-bottom: 10px;
}

.auth-form p {
    text-align: center;
    color: #7f8c8d;
    margin-bottom: 20px;
}

.form-group {
    display: flex;
    flex-direction: column;
    gap: 5px;
}

.form-group label {
    font-weight: 500;
    color: #2c3e50;
}

.form-group input {
    padding: 12px;
    border: 2px solid #ddd;
    border-radius: 6px;
    font-size: 16px;
}

.form-group input:focus {
    outline: none;
    border-color: #3498db;
}

.auth-error {
    background-color: #f8d7da;
    color: #721c24;
    padding: 10px;
    border-radius: 6px;
    text-align: center;
    margin-bottom: 15px;
}

@media (max-width: 768px) {
    .controls {
        flex-direction: column;
        align-items: stretch;
    }
    
    .search-box {
        min-width: auto;
    }
    
    .selection-info {
        justify-content: center;
    }
    
    .properties-grid {
        grid-template-columns: 1fr;
    }
    
    .auth-container {
        margin: 50px 20px;
    }
}`;

    default:
      return "File not found";
  }
}
