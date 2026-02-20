// ==UserScript==
// @name          Unfollowers Button
// @namespace     https://github.com/adrian-cancio
// @version       2026-02-20
// @description   Adds a convenient button to Instagram to detect and list unfollowers quickly and easily.
// @license       MIT
// @author        Adrián Cancio
// @updateURL     https://raw.githubusercontent.com/adrian-cancio/Userscripts/master/scripts/instagram-unfollowers.user.js
// @downloadURL   https://raw.githubusercontent.com/adrian-cancio/Userscripts/master/scripts/instagram-unfollowers.user.js
// @match         https://www.instagram.com/*
// @icon          https://www.google.com/s2/favicons?sz=64&domain=instagram.com
// @grant         GM_xmlhttpRequest
// @grant         GM_getValue
// @grant         GM_setValue
// @connect       raw.githubusercontent.com
// @connect       api.github.com
// ==/UserScript==

(function () {
  "use strict";

  var cachedScript = null;
  var cachedIcon = null;
  var isLoadingResources = false;
  var loadingError = false;

  // Cache keys for GM storage
  const CACHE_KEYS = {
    COMMIT_SHA: 'ig_unfollowers_commit_sha',
    SCRIPT: 'ig_unfollowers_script',
    ICON: 'ig_unfollowers_icon',
    LAST_CHECK: 'ig_unfollowers_last_check'
  };

  // GitHub API configuration
  const GITHUB_API = {
    OWNER: 'davidarroyo1234',
    REPO: 'InstagramUnfollowers',
    FILE_PATH: 'public/index.html',
    BRANCH: 'master'
  };

  // Check if cache needs update by comparing commit SHAs
  function checkForUpdates(callback) {
    const url = `https://api.github.com/repos/${GITHUB_API.OWNER}/${GITHUB_API.REPO}/commits?path=${GITHUB_API.FILE_PATH}&sha=${GITHUB_API.BRANCH}&per_page=1`;

    GM_xmlhttpRequest({
      method: "GET",
      url: url,
      headers: {
        'Accept': 'application/vnd.github.v3+json'
      },
      onload: function(response) {
        if (response.status === 200) {
          try {
            const commits = JSON.parse(response.responseText);
            if (commits && commits.length > 0) {
              const latestCommitSha = commits[0].sha;
              const cachedCommitSha = GM_getValue(CACHE_KEYS.COMMIT_SHA, null);

              // Check if we need to update
              const needsUpdate = !cachedCommitSha || cachedCommitSha !== latestCommitSha;

              console.log(`Latest commit: ${latestCommitSha.substring(0, 7)}`);
              if (cachedCommitSha) {
                console.log(`Cached commit: ${cachedCommitSha.substring(0, 7)}`);
              }

              callback(needsUpdate, latestCommitSha);
            } else {
              console.warn("No commits found for the file");
              callback(true, null);
            }
          } catch (e) {
            console.error("Error parsing GitHub API response:", e);
            callback(true, null);
          }
        } else if (response.status === 403) {
          // Rate limit exceeded, use cache if available
          console.warn("GitHub API rate limit exceeded. Using cached version.");
          callback(false, GM_getValue(CACHE_KEYS.COMMIT_SHA, null));
        } else {
          console.error("Failed to check for updates. Status:", response.status);
          callback(true, null);
        }
      },
      onerror: function(error) {
        console.error("Network error checking for updates:", error);
        // On error, try to use cache
        callback(false, GM_getValue(CACHE_KEYS.COMMIT_SHA, null));
      }
    });
  }

  // Load from GM storage cache
  function loadFromCache() {
    const script = GM_getValue(CACHE_KEYS.SCRIPT, null);
    const icon = GM_getValue(CACHE_KEYS.ICON, null);
    const commitSha = GM_getValue(CACHE_KEYS.COMMIT_SHA, null);

    if (script && commitSha) {
      console.log(`Loading from cache (commit: ${commitSha.substring(0, 7)})`);
      cachedScript = script;
      cachedIcon = icon;
      return true;
    }
    return false;
  }

  // Save to GM storage cache
  function saveToCache(script, icon, commitSha) {
    GM_setValue(CACHE_KEYS.SCRIPT, script);
    GM_setValue(CACHE_KEYS.ICON, icon || '');
    GM_setValue(CACHE_KEYS.COMMIT_SHA, commitSha);
    GM_setValue(CACHE_KEYS.LAST_CHECK, Date.now());
    console.log(`Cached resources (commit: ${commitSha.substring(0, 7)})`);
  }

  function showButton(el) {
    if (el.style.display === "block") {
      return;
    }
    el.style.display = "block";
    el.style.opacity = 0;
    el.onclick = function () {
      runUnfollowersScript();
    };
    (function fade() {
      var val = parseFloat(el.style.opacity);
      if (!((val += 0.01) > 1)) {
        setTimeout(() => {
          el.style.opacity = val;
        }, 1);
        requestAnimationFrame(fade);
      }
    })();
  }

  // Extract script from davidarroyo1234's HTML
  function extractScriptFromHTML(html) {
    try {
      // Find the start of the instagramScript variable
      const startMarker = 'const instagramScript = "';
      const startIndex = html.indexOf(startMarker);

      if (startIndex === -1) {
        console.error("Could not find instagramScript variable in HTML");
        return null;
      }

      // Start after the opening quote
      let pos = startIndex + startMarker.length;
      let scriptContent = '';
      let escaped = false;

      // Parse character by character, handling escape sequences
      while (pos < html.length) {
        const char = html[pos];

        if (escaped) {
          // Previous char was backslash, so this is escaped
          scriptContent += char;
          escaped = false;
        } else if (char === '\\') {
          // Start of escape sequence
          scriptContent += char;
          escaped = true;
        } else if (char === '"') {
          // Unescaped quote means end of string
          break;
        } else {
          scriptContent += char;
        }

        pos++;
      }

      // Now unescape the content properly using JSON.parse
      return JSON.parse('"' + scriptContent + '"');

    } catch (e) {
      console.error("Failed to extract/parse script:", e);
      return null;
    }
  }

  // Extract SVG icon from davidarroyo1234's HTML
  function extractIconFromHTML(html) {
    try {
      // Find the icon div with the SVG
      const iconMatch = html.match(/<div class="icon">\s*(<svg[\s\S]*?<\/svg>)\s*<\/div>/);
      if (iconMatch && iconMatch[1]) {
        return iconMatch[1];
      }
      console.error("Could not find icon SVG in HTML");
      return null;
    } catch (e) {
      console.error("Failed to extract icon:", e);
      return null;
    }
  }

  // Fetch resources from remote repository
  function fetchResourcesFromRemote(commitSha, callback, errorCallback) {
    console.log("Fetching Instagram Unfollowers resources from remote...");

    GM_xmlhttpRequest({
      method: "GET",
      url: "https://raw.githubusercontent.com/davidarroyo1234/InstagramUnfollowers/master/public/index.html",
      onload: function(response) {
        isLoadingResources = false;

        if (response.status === 200) {
          const script = extractScriptFromHTML(response.responseText);
          const icon = extractIconFromHTML(response.responseText);

          if (script) {
            cachedScript = script;
            cachedIcon = icon || null;

            // Save to persistent cache
            if (commitSha) {
              saveToCache(script, icon, commitSha);
            }

            if (!icon) {
              console.error("Icon extraction failed - using fallback icon");
            }

            console.log("✓ Instagram Unfollowers resources fetched successfully!");
            callback(script, icon);

          } else {
            console.error("Script extraction failed");
            loadingError = true;
            if (errorCallback) errorCallback();
          }

        } else {
          console.error("Failed to fetch resources. Status:", response.status);
          loadingError = true;
          if (errorCallback) errorCallback();
        }
      },
      onerror: function(error) {
        isLoadingResources = false;
        console.error("Network error fetching resources:", error);
        loadingError = true;
        if (errorCallback) errorCallback();
      }
    });
  }

  // Load resources (script and icon) with smart caching
  function loadResources(callback, errorCallback) {
    // If already loading, wait
    if (isLoadingResources) {
      setTimeout(() => loadResources(callback, errorCallback), 100);
      return;
    }

    // If there was a loading error, call error callback
    if (loadingError) {
      if (errorCallback) errorCallback();
      return;
    }

    // If already in memory cache, use it
    if (cachedScript) {
      callback(cachedScript, cachedIcon);
      return;
    }

    isLoadingResources = true;

    // Try to load from persistent cache first
    const hasCachedData = loadFromCache();

    if (hasCachedData) {
      // We have cached data, now check if it needs updating
      checkForUpdates((needsUpdate, latestCommitSha) => {
        if (needsUpdate && latestCommitSha) {
          console.log("🔄 Update available! Fetching new version...");
          fetchResourcesFromRemote(latestCommitSha, callback, errorCallback);
        } else {
          // Cache is up to date
          isLoadingResources = false;
          console.log("✓ Using cached resources (up to date)");
          callback(cachedScript, cachedIcon);
        }
      });
    } else {
      // No cache, fetch from remote
      console.log("No cache found. Fetching resources...");
      checkForUpdates((needsUpdate, latestCommitSha) => {
        fetchResourcesFromRemote(latestCommitSha, callback, errorCallback);
      });
    }
  }

  // Run the unfollowers script using a Blob URL to bypass CSP restrictions
  const runUnfollowersScript = () => {
    if (!cachedScript) {
      console.warn("Script not loaded yet. Please wait...");
      return;
    }

    try {
      const blob = new Blob([cachedScript], { type: 'application/javascript' });
      const url = URL.createObjectURL(blob);
      const scriptEl = document.createElement('script');
      scriptEl.src = url;
      scriptEl.onload = () => {
        scriptEl.remove();
        URL.revokeObjectURL(url);
      };
      scriptEl.onerror = () => {
        scriptEl.remove();
        URL.revokeObjectURL(url);
        console.error("Failed to execute Instagram Unfollowers script via Blob URL");
      };
      document.head.appendChild(scriptEl);
    } catch (error) {
      console.error("Error executing Instagram Unfollowers script:", error);
      alert("Error executing Instagram Unfollowers. Please check the console for details.");
    }
  };

  // Create the button element
  var div = document.createElement("div");
  div.id = "unfollowers-button";

  // Add keyframe animation for loading spinner
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    #unfollowers-button.loading {
      cursor: wait !important;
      pointer-events: none;
    }

    #unfollowers-button.error {
      cursor: not-allowed !important;
      pointer-events: none;
    }

    #unfollowers-button .spinner {
      border: 4px solid rgba(255, 255, 255, 0.3);
      border-top: 4px solid white;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      animation: spin 1s linear infinite;
      margin: auto;
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
    }
  `;
  document.head.appendChild(style);

  div.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    width: 60px;
    height: 60px;
    background: linear-gradient(135deg, #2c2c2c 0%, #1a1a1a 100%);
    border-radius: 50%;
    cursor: wait;
    display: none;
    opacity: 0;
    z-index: 9999;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2);
    transition: all 0.3s ease;
    pointer-events: none;
    border: 2px solid #444;
  `;

  // Add loading class initially
  div.classList.add('loading');

  // Loading spinner
  div.innerHTML = `<div class="spinner"></div>`;

  // Fallback icon (simple monochromatic version)
  const fallbackIcon = `
    <svg width="100%" height="100%" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="30" cy="20" r="8" fill="white" opacity="0.9"/>
      <ellipse cx="30" cy="40" rx="12" ry="10" fill="white" opacity="0.9"/>
      <rect x="40" y="18" width="10" height="3" rx="1.5" fill="white" opacity="0.7"/>
    </svg>
  `;

  // Load the dynamic icon from the repository
  loadResources(
    (script, icon) => {
      // Resources loaded successfully
      div.classList.remove('loading');
      div.style.cursor = 'pointer';
      div.style.pointerEvents = 'auto';

      // Update button with dynamic icon if available, otherwise use fallback
      if (icon) {
        div.innerHTML = icon.replace(
          /<svg/,
          '<svg width="100%" height="100%"'
        );
      } else {
        div.innerHTML = fallbackIcon;
      }

      // Add hover effects
      div.addEventListener('mouseenter', () => {
        if (!div.classList.contains('error')) {
          div.style.transform = 'scale(1.1)';
          div.style.boxShadow = '0 6px 25px rgba(0, 0, 0, 0.6), 0 4px 12px rgba(255, 255, 255, 0.1)';
          div.style.borderColor = '#666';
        }
      });

      div.addEventListener('mouseleave', () => {
        if (!div.classList.contains('error')) {
          div.style.transform = 'scale(1)';
          div.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2)';
          div.style.borderColor = '#444';
        }
      });

      console.log("✓ Instagram Unfollowers button ready!");
    },
    () => {
      // Error loading resources
      div.classList.remove('loading');
      div.classList.add('error');
      div.style.cursor = 'not-allowed';
      div.style.background = 'linear-gradient(135deg, #3a3a3a 0%, #252525 100%)';
      div.style.borderColor = '#ff4444';
      div.style.boxShadow = '0 4px 20px rgba(255, 68, 68, 0.3), 0 2px 8px rgba(0, 0, 0, 0.3)';
      div.innerHTML = `
        <svg width="100%" height="100%" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="30" cy="30" r="20" stroke="#ff4444" stroke-width="3" fill="none"/>
          <line x1="30" y1="20" x2="30" y2="32" stroke="#ff4444" stroke-width="3" stroke-linecap="round"/>
          <circle cx="30" cy="38" r="2" fill="#ff4444"/>
        </svg>
      `;
      console.error("✗ Failed to load Instagram Unfollowers script. Button disabled.");
    }
  );

  document.body.appendChild(div);

  // Show button immediately
  showButton(div);

  // Debug helper - expose to window for console access
  window.InstagramUnfollowersDebug = {
    showCache: function() {
      const commitSha = GM_getValue(CACHE_KEYS.COMMIT_SHA, null);
      const lastCheck = GM_getValue(CACHE_KEYS.LAST_CHECK, null);
      const scriptLength = GM_getValue(CACHE_KEYS.SCRIPT, '')?.length || 0;
      const iconLength = GM_getValue(CACHE_KEYS.ICON, '')?.length || 0;

      console.log('%c=== Instagram Unfollowers Cache ===', 'color: #00FFFF; font-weight: bold; font-size: 14px;');
      console.log('%cCommit SHA:', 'color: #888; font-weight: bold;', commitSha || 'Not cached');
      console.log('%cLast Check:', 'color: #888; font-weight: bold;', lastCheck ? new Date(lastCheck).toLocaleString() : 'Never');
      console.log('%cScript Size:', 'color: #888; font-weight: bold;', scriptLength ? `${(scriptLength / 1024).toFixed(2)} KB` : 'Not cached');
      console.log('%cIcon Size:', 'color: #888; font-weight: bold;', iconLength ? `${(iconLength / 1024).toFixed(2)} KB` : 'Not cached');
      console.log('%c===================================', 'color: #00FFFF; font-weight: bold;');

      return {
        commitSha,
        lastCheck: lastCheck ? new Date(lastCheck) : null,
        scriptLength,
        iconLength,
        totalSize: scriptLength + iconLength
      };
    },

    clearCache: function() {
      GM_setValue(CACHE_KEYS.COMMIT_SHA, null);
      GM_setValue(CACHE_KEYS.SCRIPT, null);
      GM_setValue(CACHE_KEYS.ICON, null);
      GM_setValue(CACHE_KEYS.LAST_CHECK, null);
      console.log('%c✓ Cache cleared! Reload the page to fetch fresh data.', 'color: #00FF00; font-weight: bold;');
    },

    forceUpdate: function() {
      this.clearCache();
      console.log('%c🔄 Cache cleared. Reloading page...', 'color: #FFB800; font-weight: bold;');
      setTimeout(() => location.reload(), 1000);
    },

    getScript: function() {
      return GM_getValue(CACHE_KEYS.SCRIPT, null);
    },

    getIcon: function() {
      return GM_getValue(CACHE_KEYS.ICON, null);
    }
  };

  // Log helper availability
  console.log('%c💡 Instagram Unfollowers Debug Tools Available!', 'color: #00FFFF; font-weight: bold; font-size: 12px;');
  console.log('%cUse in console:', 'color: #888;');
  console.log('  InstagramUnfollowersDebug.showCache()    - Show cache info');
  console.log('  InstagramUnfollowersDebug.clearCache()   - Clear cache');
  console.log('  InstagramUnfollowersDebug.forceUpdate()  - Force update & reload');
})();
