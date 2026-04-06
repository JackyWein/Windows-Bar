# Windows Bar Plugin-Entwicklung

Willkommen to der Windows Bar plugin-entwicklung guide! This document explains how to create powerful plugins for Windows Bar.

## 🧪 Plugin-Struktur

```
plugins/
└── my-example-plugin/
    ├── manifest.json      # Plugin manifest (erforderlich)
    ├── main.js             # Plugin-hauptcode (erforderlich)
    └── icon.png             # Plugin icon (optional, 48x48)
```

## 1. Plugin-Manifest erstellen

The `manifest.json` file in your plugin folder defines your plugin:

```json
{
  "id": "my-example-plugin",
  "name": "My Example Plugin",
  "version": "1.0.0",
  "description": "Ein cools example plugin that demonstrates all the plugin development features",
  "author": "Your Name",
  "homepage": "https://github.com/your-repo/wiki/Plugins",
  "minAppVersion": "1.0.0",
  "provides": {
    "commands": true,
    "searchProvider": true,
    "hooks": true,
    "settings": true
  },
  "settingsSchema": [
    {
      "key": "greeting",
      "type": "text",
      "label": "Begrüßungstext",
      "description": "The text displayed when the /hello command is used",
      "placeholder": "Hello, World!",
      "default": "Hello! Welcome to Windows Bar!"
    },
    {
      "key": "showEmoji",
      "type": "boolean",
      "label": "Show emoji in greeting",
      "description": "Whether to show an emoji before the name in the greeting",
      "default": true
    },
    {
      "key": "repeatCount",
      "type": "number",
      "label": "Repeat Count",
      "description": "How many times to repeat the name in the greeting",
      "min": 1,
      "max": 10,
      "default": 3
    }
  ],
  "defaultSettings": {
    "greeting": "Hello! Welcome to Windows Bar!",
    "showEmoji": true,
    "repeatCount": 3
  }
}
```

### 2. Plugin-Hauptcode (main.js)

The main.js file contains your plugin's logic. This is where you register commands, search providers, hooks, and settings.

```javascript
// main.js - Example Plugin for Windows Bar
// This file demonstrates the plugin API and how to create powerful plugins

/**
 * @param {PluginContext} ctx - The plugin context provided by Windows Bar
 * @param {PluginAPI} api - API for registering commands, providers, etc.
 */
function initPlugin(ctx, api) {
  // Log that the plugin is loading
  ctx.logger.log('Example Plugin loaded!');
  
  // Register a command
  api.registerCommand({
    id: 'hello',
    trigger: '/hello',
    description: 'Shows a personalized greeting',
    category: 'text',
    handler: (args, ctx) => {
      const greeting = ctx.pluginSettings.greeting || 'Hello!';
      const showEmoji = ctx.pluginSettings.showEmoji !== false;
      const repeatCount = ctx.pluginSettings.repeatCount || 1;
      
      // Build the greeting with optional emoji
      let emoji = '';
      if (showEmoji) {
        emoji = '👋 ';
      }
      
      // Repeat the greeting
      let fullGreeting = '';
      for (let i = 0; i < repeatCount; i++) {
        fullGreeting += greeting;
        if (i < repeatCount - 1) {
          fullGreeting += '\n';
        }
      }
      
      return {
        results: [
          {
            id: `hello-${Date.now()}`,
            title: `${emoji}${fullGreeting}`,
            subtitle: `From Example Plugin`,
            type: 'text',
            path: `hello`,
            isWeb: false,
            isExpandBtn: false,
            isSubItem: false,
            isHelpCategory: false,
            copyToClipboard: fullGreeting
          }
        ]
      };
    }
  });
  
  // Register a search provider
  api.registerSearchProvider({
    id: 'example-search',
    name: 'Example Search',
    priority: 55, // Lower = higher priority
    triggers: ['!ex', '?'], // Prefix triggers
    search: (query, ctx) => {
      const results = [];
      
      // Check if query matches our triggers
      for (const trigger of triggers) {
        if (query.startsWith(trigger)) {
          const searchTerm = query.slice(trigger.length).trim();
          
          // Search for example results
          results.push({
            id: `example-${Date.now()}`,
            title: `Search: ${searchTerm}`,
            subtitle: `Example result from plugin`,
            type: 'text',
            path: `example://${searchTerm}`,
            isWeb: false
            iconBase64: null,
            isExpandBtn: false,
            isSubItem: false,
            isHelpCategory: false,
          });
        }
      }
      
      return results;
    }
  });
  
  // Register lifecycle hooks
  api.registerHook('onLoad', () => {
    ctx.logger.log('Plugin loaded successfully!');
  });
  
  api.registerHook('onEnable', () => {
    ctx.logger.log('Plugin enabled!');
  });
  
  api.registerHook('onDisable', () => {
    ctx.logger.log('Plugin disabled!');
  });
  
  api.registerHook('onSearch', (payload) => {
    ctx.logger.log('Search performed:', payload.query);
  });
  
  api.registerHook('onResultOpen', (payload) => {
    ctx.logger.log('Result opened:', payload.result.title);
  });
}

```

### 3. Plugin Icon (icon.png)

The `icon.png` file is the optional 48x48 pixel icon for the plugin. You can use any image editing tool to create a simple colored icon.

---

## 📋 Changelog

### v1.0.4 (Aktuell)
- **Search View Implementation**: Vollständige Search View mit Command Registry, Weather Integration und Keyboard Navigation Support
- **Command Registry**: Zentrales Registry-System für alle Commands implementiert
- **Weather Integration**: Wetter-Commands und -Anzeigen in die Search View integriert
- **Keyboard Navigation**: Verbesserte Tastaturnavigation in der Search View
- **UI/UX Verbesserungen**: Diverse Styling-Anpassungen in base.css und ai.css

### v1.0.3
- Release-Automatisierung und Bugfixes

### v1.0.2
- Stabilitätsverbesserungen

### v1.0.1
- Initiales Release mit Plugin-System Infrastruktur
</write_to_file>