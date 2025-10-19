# Hospitable Properties Viewer - Cloudflare Worker

A Cloudflare Worker application that provides a web interface for browsing Hospitable properties with progressive loading, search functionality, and clipboard copying capabilities.

## Features

- **🔐 Basic Authentication**: Login protection to prevent unauthorized access
- **📁 Separated Files**: Clean project structure with separate HTML, CSS, and JS files
- **Progressive Loading**: Loads properties in batches with "Getting more properties..." indicators
- **Real-time Search**: Filter properties by name, location, description, or summary
- **Property Selection**: Select multiple properties with checkboxes
- **Copy to Clipboard**: Export selected property details as JSON for use in other tools
- **Detailed Property Loading**: Fetch complete property details on-demand (including listings and amenities)
- **Error Handling**: Comprehensive error display for API authentication and network issues
- **Responsive Design**: Works on desktop and mobile devices

## Project Structure

```
├── worker.js          # Main Cloudflare Worker script with routing and authentication
├── index.html         # Main application HTML (served as separate file)
├── login.html         # Login page HTML (served as separate file)
├── styles.css         # CSS styles (served as separate file)
├── app.js             # JavaScript application logic (served as separate file)
├── wrangler.toml      # Cloudflare Worker configuration
├── package.json       # Dependencies and scripts
└── README.md         # This file
```

## API Integration

This application integrates with the Hospitable API:

- **Properties List**: `GET /v2/properties` - Fetches paginated property listings
- **Property Details**: `GET /v2/properties/{uuid}?include=listings,details` - Fetches complete property information

## Setup Instructions

### Prerequisites

1. A Cloudflare account
2. Wrangler CLI installed globally: `npm install -g wrangler`
3. A valid Hospitable API Bearer token

### Installation

1. **Clone/Download the project files**
2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Configure your secrets**:

   You need to set three secrets for your Cloudflare Worker:

   ```bash
   # Set your Hospitable API token (without "Bearer " prefix)
   wrangler secret put HOSPITABLE_API_TOKEN

   # Set authentication credentials
   wrangler secret put AUTH_USERNAME
   wrangler secret put AUTH_PASSWORD
   ```

   **API Token Example**: If your token is `Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9...`, you should enter just: `eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9...`

   **Authentication Example**:

   - Username: `admin`
   - Password: `your-secure-password-123`

### Deployment

1. **Deploy to Cloudflare Workers**:

   ```bash
   npm run deploy
   ```

   Or using wrangler directly:

   ```bash
   wrangler deploy
   ```

2. **Access your application**:
   After deployment, Cloudflare will provide you with a URL like:
   `https://hospitable-properties-viewer.your-subdomain.workers.dev`

### Development

To run the worker locally for development:

```bash
npm run dev
```

This will start a local development server, typically at `http://localhost:8787`

## Required Secrets

The following secrets must be configured in your Cloudflare Worker:

| Secret Name            | Description                                                 | How to Set                                 |
| ---------------------- | ----------------------------------------------------------- | ------------------------------------------ |
| `HOSPITABLE_API_TOKEN` | Your Hospitable API Bearer token (without "Bearer " prefix) | `wrangler secret put HOSPITABLE_API_TOKEN` |
| `AUTH_USERNAME`        | Username for basic authentication (e.g., "admin")           | `wrangler secret put AUTH_USERNAME`        |
| `AUTH_PASSWORD`        | Password for basic authentication (use a secure password)   | `wrangler secret put AUTH_PASSWORD`        |

## Main Purpose

**🤖 Chat with Your Property Data Using AI**

The primary purpose of this tool is to help you **export property data to chat with AI language models** (like ChatGPT, Claude, or any LLM). Here's how it works:

1. **Browse & Select**: Find properties you're interested in
2. **Copy Data**: Export complete property details as JSON
3. **Chat with AI**: Paste the data into any AI chat interface
4. **Get Insights**: Ask the AI questions about your properties, get analytics, comparisons, market insights, and detailed analysis

**Example AI Conversations:**

- "Analyze these properties and tell me which ones have the best amenities"
- "Compare the pricing strategy of these listings"
- "What are the common features across these high-rated properties?"
- "Generate a market report for these properties"
- "Which properties would be best for families vs business travelers?"

## Usage

1. **Login**: Visit your deployed URL and login with your configured username/password
2. **Browse Properties**: The application loads properties automatically after login
3. **Search**: Use the search box to filter properties by name and location
4. **Load More**: Click "Load More Properties" to fetch additional batches
5. **Select Properties**: Use checkboxes to select properties you're interested in
6. **Load Details**: Click "Load Full Details" for comprehensive property information
7. **Copy Data**: Click "Copy Selected Details" to copy property JSON to clipboard
8. **Chat with AI**: Paste the copied data into ChatGPT, Claude, or any AI chat interface for analysis
9. **Session**: Your login session will last 24 hours before requiring re-authentication

## Error Handling

The application handles various error scenarios:

- **API Token Missing**: Shows configuration instructions
- **Authentication Errors**: Invalid or expired API tokens
- **Rate Limiting**: When API requests are throttled
- **Network Errors**: Connection issues
- **Property Not Found**: Invalid property UUIDs

## API Rate Limits

Please be mindful of Hospitable API rate limits. The application loads properties in batches to avoid overwhelming the API.

## Troubleshooting

### Common Issues

1. **"API token not configured" error**:

   - Ensure you've set the `HOSPITABLE_API_TOKEN` secret
   - Verify the token is valid and not expired

2. **"Authentication failed" error**:

   - Check that your API token has the correct permissions
   - Ensure you didn't include "Bearer " prefix when setting the secret

3. **"Failed to load properties" error**:
   - Verify your internet connection
   - Check Hospitable API status
   - Ensure your API token hasn't expired

### Debugging

To debug locally:

1. Run `wrangler dev` to start local development
2. Check browser console for JavaScript errors
3. Review network requests in browser DevTools

## Customization

You can customize the application by modifying:

- **Batch Size**: Change the pagination in the API calls
- **Styling**: Modify the CSS in the HTML template
- **Search Fields**: Add more property fields to search functionality
- **Property Display**: Customize which property details are shown in cards

## Security Notes

- API tokens are stored securely as Cloudflare Worker secrets
- No sensitive data is logged or exposed in the frontend
- All API requests are proxied through the worker to protect credentials

## License

MIT License - Feel free to modify and distribute as needed.

## Support

For issues related to:

- **Cloudflare Workers**: Check [Cloudflare Workers documentation](https://developers.cloudflare.com/workers/)
- **Hospitable API**: Consult [Hospitable API documentation](https://docs.hospitable.com/)
- **This Application**: Review the code comments and error messages for guidance
